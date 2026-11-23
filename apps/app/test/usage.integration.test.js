import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { readLedger } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createGroupForUser, ensureLocalUser } from "../src/groups.js";
import { recordUsage, touchLastActive, usageMarker } from "../src/usage.js";
import { colombiaDay, periodKeys } from "../src/usage-periods.js";

// Estadística de uso (change consola-administracion-homesuite, tareas 2.2, 2.3, 3.2 y 3.3; spec estadisticas-de-uso-homesuite).
const SECRET = "u".repeat(32);
const MARKER_SECRET = "m".repeat(32);
const ENV = { DB: env.DB, SESSION_SECRET: SECRET, USAGE_MARKER_SECRET: MARKER_SECRET };

afterEach(() => vi.restoreAllMocks());

const people = async (type, key, tool, level) => (await env.DB.prepare("SELECT people FROM usage_period_people WHERE period_type = ? AND period_key = ? AND tool = ? AND level = ?").bind(type, key, tool, level).first())?.people ?? 0;
const actions = async (day, tool, action) => (await env.DB.prepare("SELECT count FROM usage_daily_counts WHERE day = ? AND tool = ? AND action = ?").bind(day, tool, action).first())?.count ?? 0;
const snapshot = async (tool) => {
  const keys = periodKeys(colombiaDay());
  return {
    entroDay: await people("day", keys.day, tool, "entro"), hizoDay: await people("day", keys.day, tool, "hizo"),
    entroMonth: await people("month", keys.month, tool, "entro"), hizoMonth: await people("month", keys.month, tool, "hizo"),
  };
};
const at = (day, hour = "15:00") => new Date(`${day}T${hour}:00-05:00`);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}

function request(who, path, init = {}, e = ENV) {
  const post = init.method === "POST";
  const body = post && init.form ? new URLSearchParams(init.form).toString() : init.body;
  const headers = { ...(who ? { Cookie: who.cookie } : {}), ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who?.csrf ?? "", "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  return app.request(`https://app.test${path}`, { method: init.method, body, headers, redirect: "manual" }, e);
}

async function book(name) {
  const owner = await identity(`${name}-${crypto.randomUUID()}@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.user.id, name });
  const data = await readLedger(env.DB, { groupId: group.id, userId: owner.user.id });
  return { owner, group, people: data.participants };
}
const entryForm = (t, extra = {}) => ({ type: "expense", currency: "COP", amount: "100,00", description: "Compra", occurredAt: "2026-10-24", payer: t.people[0].id, splitMethod: "equal", beneficiary: t.people[0].id, idempotencyKey: crypto.randomUUID(), ...extra });

// Base envuelta: cuenta las sentencias preparadas y puede hacer fallar las que mencionen un texto.
function spyDb({ failOn = null } = {}) {
  const sql = [];
  const db = new Proxy(env.DB, {
    get(target, property) {
      if (property === "prepare") return (text) => { sql.push(text); if (failOn && text.includes(failOn)) throw new Error("D1_ERROR simulado"); return target.prepare(text); };
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db, sql };
}

describe("marcas de período", () => {
  it("la misma cuenta da marcas distintas en períodos distintos y la marca no contiene el id", async () => {
    const base = { userId: "user_marca", tool: "tasks", level: "entro" };
    const week = await usageMarker(MARKER_SECRET, { ...base, periodType: "week", periodKey: "2026-W47" });
    const nextWeek = await usageMarker(MARKER_SECRET, { ...base, periodType: "week", periodKey: "2026-W48" });
    const month = await usageMarker(MARKER_SECRET, { ...base, periodType: "month", periodKey: "2026-11" });
    expect(new Set([week, nextWeek, month]).size).toBe(3);
    expect(week).not.toContain("user_marca");
    expect(week).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(await usageMarker(MARKER_SECRET, { ...base, periodType: "week", periodKey: "2026-W47" })).toBe(week);
    expect(await usageMarker("otro".repeat(8), { ...base, periodType: "week", periodKey: "2026-W47" })).not.toBe(week);
  });

  it("sin secreto no se mide", async () => {
    expect(await recordUsage(env.DB, { userId: "user_sin_secreto", tool: "tasks", level: "entro", secret: null, now: at("2031-01-10") })).toBe(false);
    expect(await people("day", "2031-01-10", "tasks", "entro")).toBe(0);
  });
});

describe("conteo de personas distintas por período", () => {
  it("la misma persona en veinte días de un mes cuenta 1 en el mes y 1 en cada día", async () => {
    const userId = `user_${crypto.randomUUID()}`;
    for (let day = 1; day <= 20; day++) {
      const iso = `2031-03-${String(day).padStart(2, "0")}`;
      await recordUsage(env.DB, { userId, tool: "tasks", level: "entro", secret: MARKER_SECRET, now: at(iso) });
      await recordUsage(env.DB, { userId, tool: "tasks", level: "entro", secret: MARKER_SECRET, now: at(iso, "20:00") });
    }
    expect(await people("month", "2031-03", "tasks", "entro")).toBe(1);
    expect(await people("quarter", "2031-Q1", "tasks", "entro")).toBe(1);
    expect(await people("year", "2031", "tasks", "entro")).toBe(1);
    const days = (await env.DB.prepare("SELECT SUM(people) AS total, COUNT(*) AS rows FROM usage_period_people WHERE period_type = 'day' AND period_key LIKE '2031-03-%' AND tool = 'tasks' AND level = 'entro'").first());
    expect(days).toEqual({ total: 20, rows: 20 });
    // Las semanas ISO tocadas por esos días: cada una cuenta 1.
    const weeks = await env.DB.prepare("SELECT DISTINCT people FROM usage_period_people WHERE period_type = 'week' AND period_key BETWEEN '2031-W09' AND '2031-W12' AND tool = 'tasks' AND level = 'entro'").all();
    expect(weeks.results).toEqual([{ people: 1 }]);
  });

  it("«hizo algo» cuenta también «entró», y la acción suma una vez por petición", async () => {
    const userId = `user_${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await recordUsage(env.DB, { userId, tool: "expenses", level: "hizo", action: "movimiento_cargado", secret: MARKER_SECRET, now: at("2031-04-02") });
    expect(await people("day", "2031-04-02", "expenses", "hizo")).toBe(1);
    expect(await people("day", "2031-04-02", "expenses", "entro")).toBe(1);
    expect(await people("month", "2031-04", "expenses", "entro")).toBe(1);
    expect(await actions("2031-04-02", "expenses", "movimiento_cargado")).toBe(3);
  });

  it("dos peticiones simultáneas del mismo día no cuentan dos veces", async () => {
    const userId = `user_${crypto.randomUUID()}`;
    await Promise.all([1, 2, 3].map(() => recordUsage(env.DB, { userId, tool: "calm", level: "entro", secret: MARKER_SECRET, now: at("2031-05-05") })));
    expect(await people("day", "2031-05-05", "calm", "entro")).toBe(1);
    expect(await people("year", "2031", "calm", "entro")).toBe(1);
  });

  it("dos personas distintas cuentan 2; las marcas no guardan el id, el correo ni el nombre", async () => {
    const first = await ensureLocalUser(env.DB, `marca-${crypto.randomUUID()}@example.test`);
    const second = await ensureLocalUser(env.DB, `marca-${crypto.randomUUID()}@example.test`);
    for (const user of [first, second]) await recordUsage(env.DB, { userId: user.id, tool: "tasks", level: "hizo", action: "comentario", secret: MARKER_SECRET, now: at("2031-06-06") });
    expect(await people("day", "2031-06-06", "tasks", "hizo")).toBe(2);
    const rows = (await env.DB.prepare("SELECT * FROM usage_period_markers").all()).results.map((row) => JSON.stringify(row));
    for (const user of [first, second]) {
      expect(rows.some((row) => row.includes(user.id) || row.includes(user.email) || row.includes(user.display_name))).toBe(false);
    }
  });
});

describe("medición en el Worker", () => {
  it("un movimiento cargado suma la acción y los dos niveles", async () => {
    const t = await book("uso-carga");
    const before = await snapshot("expenses");
    const day = colombiaDay();
    const actionsBefore = await actions(day, "expenses", "movimiento_cargado");
    const response = await request(t.owner, `/groups/${t.group.slug}/ledger/entries`, { method: "POST", form: entryForm(t) });
    expect(response.status).toBe(303);
    const after = await snapshot("expenses");
    expect(after.entroDay - before.entroDay).toBe(1);
    expect(after.hizoDay - before.hizoDay).toBe(1);
    expect(after.hizoMonth - before.hizoMonth).toBe(1);
    expect(await actions(day, "expenses", "movimiento_cargado")).toBe(actionsBefore + 1);
    // Abrir el libro después ya no suma personas (contó hoy), y no hay acción de «entró».
    expect((await request(t.owner, `/groups/${t.group.slug}`)).status).toBe(200);
    expect((await snapshot("expenses")).entroDay).toBe(after.entroDay);
  });

  it("una carga rechazada por validación, permiso o CSRF no suma nada", async () => {
    const t = await book("uso-rechazo");
    const stranger = await identity(`ajena-${crypto.randomUUID()}@example.test`);
    const day = colombiaDay();
    const before = { ...(await snapshot("expenses")), count: await actions(day, "expenses", "movimiento_cargado") };
    expect((await request(t.owner, `/groups/${t.group.slug}/ledger/entries`, { method: "POST", form: entryForm(t, { amount: "" }) })).status).toBe(400);
    expect((await request(stranger, `/groups/${t.group.slug}/ledger/entries`, { method: "POST", form: entryForm(t) })).status).toBeGreaterThanOrEqual(400);
    expect((await request({ ...t.owner, csrf: "falso" }, `/groups/${t.group.slug}/ledger/entries`, { method: "POST", form: entryForm(t) })).status).toBe(403);
    expect({ ...(await snapshot("expenses")), count: await actions(day, "expenses", "movimiento_cargado") }).toEqual(before);
  });

  it("una visita sin sesión no lee ni escribe la base", async () => {
    const { db, sql } = spyDb();
    const response = await request(null, "/remanso", {}, { ...ENV, DB: db });
    expect(response.status).toBe(200);
    expect(sql).toEqual([]);
  });

  it("Jardín Zen con sesión no suma uso de ninguna herramienta", async () => {
    const who = await identity(`zen-${crypto.randomUUID()}@example.test`);
    const { db, sql } = spyDb();
    expect((await request(who, "/jardin-zen", {}, { ...ENV, DB: db })).status).toBe(200);
    expect(sql.some((text) => text.includes("usage_"))).toBe(false);
  });

  it("un fallo de escritura de la medición no cambia la respuesta y deja usage_write_failed en el log", async () => {
    const t = await book("uso-falla");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = spyDb({ failOn: "usage_daily_counts" });
    const response = await request(t.owner, `/groups/${t.group.slug}/ledger/entries`, { method: "POST", form: entryForm(t) }, { ...ENV, DB: db });
    expect(response.status).toBe(303);
    const saved = await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id });
    expect(saved.entries).toHaveLength(1);
    const logged = errors.mock.calls.map((call) => call.join(" ")).filter((line) => line.includes("usage_write_failed"));
    expect(logged).toHaveLength(1);
    expect(logged[0]).not.toContain(t.owner.user.id);
    expect(logged[0]).not.toContain(t.owner.user.email);
  });

  it("sin secreto de marcas no mide y lo deja en el log, sin cortar la respuesta", async () => {
    const t = await book("uso-sin-secreto");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const before = await snapshot("expenses");
    const response = await request(t.owner, `/groups/${t.group.slug}`, {}, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(response.status).toBe(200);
    expect(await snapshot("expenses")).toEqual(before);
    expect(errors.mock.calls.some((call) => call.join(" ").includes("usage_secret_missing"))).toBe(true);
  });
});

describe("última actividad", () => {
  const lastActive = async (userId) => (await env.DB.prepare("SELECT last_active_on FROM users WHERE id = ?").bind(userId).first()).last_active_on;

  it("tres peticiones del mismo día escriben una vez", async () => {
    const who = await identity(`activa-${crypto.randomUUID()}@example.test`);
    const { db, sql } = spyDb();
    for (const path of ["/", "/perfil", "/jardin-zen"]) expect((await request(who, path, {}, { ...ENV, DB: db })).status).toBe(200);
    expect(sql.filter((text) => text.startsWith("UPDATE users SET last_active_on"))).toHaveLength(1);
    expect(await lastActive(who.user.id)).toBe(colombiaDay());
  });

  it("el cambio de día en Colombia la actualiza", async () => {
    const user = await ensureLocalUser(env.DB, `dia-${crypto.randomUUID()}@example.test`);
    expect(await touchLastActive(env.DB, { userId: user.id, lastActiveOn: null, now: new Date("2031-07-11T04:50:00Z") })).toBe(true); // 23:50 del 10
    expect(await lastActive(user.id)).toBe("2031-07-10");
    expect(await touchLastActive(env.DB, { userId: user.id, lastActiveOn: "2031-07-10", now: new Date("2031-07-11T05:10:00Z") })).toBe(true); // 00:10 del 11
    expect(await lastActive(user.id)).toBe("2031-07-11");
    // Una carrera con una fecha leída vieja no la hace retroceder ni la escribe otra vez.
    expect(await touchLastActive(env.DB, { userId: user.id, lastActiveOn: "2031-07-10", now: new Date("2031-07-11T06:00:00Z") })).toBe(false);
  });

  it("/aceptar no la escribe", async () => {
    const who = await identity(`aceptar-${crypto.randomUUID()}@example.test`);
    const { db, sql } = spyDb();
    await request(who, "/aceptar", {}, { ...ENV, DB: db, LEGAL_GATE: "on" });
    expect(sql.some((text) => text.startsWith("UPDATE users SET last_active_on"))).toBe(false);
    expect(await lastActive(who.user.id)).toBeNull();
  });

  it("sin sesión no se escribe", async () => {
    const { db, sql } = spyDb();
    await request(null, "/", {}, { ...ENV, DB: db });
    expect(sql.some((text) => text.includes("last_active_on"))).toBe(false);
  });
});
