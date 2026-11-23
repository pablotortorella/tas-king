import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSession } from "../src/sessions.js";
import { ensureLocalUser } from "../src/groups.js";

// Consola de administración (tareas 6.1 a 6.3, 7.1 a 7.3 y 7.5; spec consola-administracion-homesuite).
const SECRET = "s".repeat(32);
const ORIGIN = "https://app.test";

afterEach(() => vi.restoreAllMocks());

async function identity(prefix) {
  const user = await ensureLocalUser(env.DB, `${prefix}-${crypto.randomUUID()}@example.test`);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
async function setup() {
  const owner = await identity("duenio");
  const tareas = await identity("rol-tareas");
  const cuentas = await identity("rol-cc");
  const plain = await identity("sin-rol");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO platform_roles (user_id, scope) VALUES (?, 'tareas')").bind(tareas.user.id),
    env.DB.prepare("INSERT INTO platform_roles (user_id, scope) VALUES (?, 'cuentas-claras')").bind(cuentas.user.id),
  ]);
  return { owner, tareas, cuentas, plain, env: { DB: env.DB, SESSION_SECRET: SECRET, HOMESUITE_OWNER_USER_IDS: ` otro_id , ${owner.user.id}` } };
}
const get = (who, path, e) => app.request(`${ORIGIN}${path}`, { headers: who ? { Cookie: who.cookie } : {}, redirect: "manual" }, e);
const postRole = (who, form, e, { csrf = who.csrf } = {}) => app.request(`${ORIGIN}/consola/administradores/roles`, { method: "POST", headers: { Cookie: who.cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded", ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, body: new URLSearchParams(form).toString(), redirect: "manual" }, e);
const tabsOf = (text) => [...text.matchAll(/<nav class="type-tabs console-tabs"[^>]*>(.*?)<\/nav>/gsu)].flatMap((match) => [...match[1].matchAll(/href="\/consola\/([^"]+)"/gu)].map((link) => link[1]));
const roleOf = async (userId) => (await env.DB.prepare("SELECT scope FROM platform_roles WHERE user_id = ? ORDER BY scope").bind(userId).all()).results.map((row) => row.scope);
const audits = async (action, actor) => (await env.DB.prepare("SELECT * FROM platform_audit_events WHERE action = ? AND actor_user_id = ?").bind(action, actor).all()).results;

describe("acceso a la consola", () => {
  it("el dueño ve las cuatro pestañas", async () => {
    const t = await setup();
    const response = await get(t.owner, "/consola/suite", t.env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(tabsOf(await response.text())).toEqual(["suite", "tareas", "cuentas-claras", "administradores"]);
    expect((await get(t.owner, "/consola", t.env)).headers.get("location")).toBe("/consola/suite");
  });

  it("con rol tareas se ve sólo Tareas; Suite, Administradores y su API responden 404", async () => {
    const t = await setup();
    expect((await get(t.tareas, "/consola", t.env)).headers.get("location")).toBe("/consola/tareas");
    const page = await get(t.tareas, "/consola/tareas", t.env);
    expect(page.status).toBe(200);
    expect(tabsOf(await page.text())).toEqual(["tareas"]);
    for (const path of ["/consola/suite", "/consola/administradores", "/consola/cuentas-claras", "/api/consola/suite"]) expect((await get(t.tareas, path, t.env)).status).toBe(404);
  });

  it("sin rol, sin sesión o sin secreto responde 404 con el mismo cuerpo que una ruta inexistente, y deja console_denied sin la cuenta", async () => {
    const t = await setup();
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = await get(t.plain, "/no-existe-esta-ruta", t.env);
    const expected = { status: missing.status, type: missing.headers.get("Content-Type"), body: await missing.text() };
    const noOwners = { DB: env.DB, SESSION_SECRET: SECRET };
    for (const [who, path, e] of [[t.plain, "/consola", t.env], [t.plain, "/api/consola/suite", t.env], [null, "/consola", t.env], [null, "/consola/suite", t.env], [t.owner, "/consola", noOwners], [t.owner, "/consola/inexistente", t.env]]) {
      const response = await get(who, path, e);
      expect({ status: response.status, type: response.headers.get("Content-Type"), body: await response.text() }).toEqual(expected);
    }
    const denied = warnings.mock.calls.map((call) => call.join(" ")).filter((line) => line.includes("console_denied"));
    expect(denied.length).toBeGreaterThanOrEqual(6);
    for (const line of denied) for (const who of [t.plain, t.owner]) { expect(line).not.toContain(who.user.id); expect(line).not.toContain(who.user.email); }
    expect(denied.some((line) => line.includes('"ownersConfigured":false'))).toBe(true);
  });

  it("compartir la administración completa: un segundo id en el secreto da el mismo acceso", async () => {
    const t = await setup();
    const second = await identity("segundo");
    const e = { ...t.env, HOMESUITE_OWNER_USER_IDS: `${t.owner.user.id},${second.user.id}` };
    expect(tabsOf(await (await get(second, "/consola/suite", e)).text())).toEqual(["suite", "tareas", "cuentas-claras", "administradores"]);
  });
});

describe("roles", () => {
  it("un administrador de herramienta que intenta dar un rol recibe 404 y no cambia nada", async () => {
    const t = await setup();
    const response = await postRole(t.tareas, { accion: "dar", correo: t.plain.user.email, herramienta: "tareas" }, t.env);
    expect(response.status).toBe(404);
    expect(await roleOf(t.plain.user.id)).toEqual([]);
  });

  it("sin CSRF se rechaza sin cambiar roles", async () => {
    const t = await setup();
    const response = await postRole(t.owner, { accion: "dar", correo: t.plain.user.email, herramienta: "tareas" }, t.env, { csrf: null });
    expect(response.status).toBe(403);
    expect(await roleOf(t.plain.user.id)).toEqual([]);
  });

  it("el dueño da y quita un rol: la cuenta ve la pestaña mientras lo tiene y ambos cambios quedan auditados sin correos", async () => {
    const t = await setup();
    const given = await postRole(t.owner, { accion: "dar", correo: t.plain.user.email.toUpperCase(), herramienta: "tareas" }, t.env);
    expect(given.headers.get("location")).toBe("/consola/administradores?aviso=rol-dado");
    expect(await roleOf(t.plain.user.id)).toEqual(["tareas"]);
    expect((await get(t.plain, "/consola/tareas", t.env)).status).toBe(200);
    expect((await postRole(t.owner, { accion: "dar", correo: t.plain.user.email, herramienta: "tareas" }, t.env)).headers.get("location")).toContain("sin-cambios");

    const removed = await postRole(t.owner, { accion: "quitar", cuenta: t.plain.user.id, herramienta: "tareas" }, t.env);
    expect(removed.headers.get("location")).toBe("/consola/administradores?aviso=rol-quitado");
    expect((await get(t.plain, "/consola/tareas", t.env)).status).toBe(404);

    const events = [...await audits("platform_role_granted", t.owner.user.id), ...await audits("platform_role_revoked", t.owner.user.id)];
    expect(events.map((row) => [row.action, row.entity_type, row.entity_id, JSON.parse(row.metadata_json)])).toEqual([
      ["platform_role_granted", "user", t.plain.user.id, { scope: "tareas" }],
      ["platform_role_revoked", "user", t.plain.user.id, { scope: "tareas" }],
    ]);
    const history = await (await get(t.owner, "/consola/administradores", t.env)).text();
    expect(history).toContain("Dio el rol Tareas");
    expect(history).toContain("Quitó el rol Tareas");
  });

  it("un correo sin cuenta o una herramienta desconocida no cambian nada", async () => {
    const t = await setup();
    expect((await postRole(t.owner, { accion: "dar", correo: "nadie@example.test", herramienta: "tareas" }, t.env)).headers.get("location")).toContain("cuenta-no-encontrada");
    expect((await postRole(t.owner, { accion: "dar", correo: t.plain.user.email, herramienta: "suite" }, t.env)).status).toBe(400);
    expect(await roleOf(t.plain.user.id)).toEqual([]);
  });
});

describe("enlace «Consola» en el menú de la cuenta", () => {
  it("aparece para el dueño y para un rol, y no para una cuenta sin rol", async () => {
    const t = await setup();
    const link = async (who) => (await (await get(who, "/perfil", t.env)).text()).includes('href="/consola"');
    expect(await link(t.owner)).toBe(true);
    expect(await link(t.tareas)).toBe(true);
    expect(await link(t.plain)).toBe(false);
  });
});

describe("pestañas", () => {
  it("Tareas: el rol ve totales y cuentas con correo, sin ranking ni en el HTML ni en la API; el dueño ve el ranking", async () => {
    const t = await setup();
    await env.DB.prepare("INSERT INTO tasking_identities (identity_id, legacy_email, user_id, name, created_at) VALUES (?, ?, ?, 'Persona de Tareas', 0)").bind(`ti_${crypto.randomUUID()}`, t.plain.user.email, t.plain.user.id).run();
    const forRole = await (await get(t.tareas, "/consola/tareas", t.env)).text();
    expect(forRole).toContain("Cuentas de Tareas");
    expect(forRole).toContain(t.plain.user.email);
    expect(forRole).not.toContain("Cuentas más activas");
    const api = await (await get(t.tareas, "/api/consola/tareas", t.env)).json();
    expect(api).not.toHaveProperty("ranking");
    expect(api.accounts.some((row) => row.email === t.plain.user.email)).toBe(true);
    expect(await (await get(t.owner, "/consola/tareas", t.env)).text()).toContain("Cuentas más activas");
    expect(await (await get(t.owner, "/api/consola/tareas", t.env)).json()).toHaveProperty("ranking");
  });

  it("cada vista de la lista de cuentas deja console_accounts_viewed sin correos", async () => {
    const t = await setup();
    await get(t.tareas, "/consola/tareas", t.env);
    await get(t.tareas, "/consola/tareas", t.env);
    const rows = await audits("console_accounts_viewed", t.tareas.user.id);
    expect(rows).toHaveLength(2);
    for (const row of rows) { expect(JSON.parse(row.metadata_json)).toEqual({ tool: "tasks" }); expect(JSON.stringify(row)).not.toContain("@"); }
  });

  it("Tareas no muestra contenido de tableros", async () => {
    const t = await setup();
    const text = await (await get(t.owner, "/consola/tareas", t.env)).text();
    expect(text).not.toMatch(/tasking_cards|Tarjeta secreta/u);
  });

  it("Cuentas Claras: la ven el dueño y el rol cuentas-claras, con el texto de que no hay herramientas", async () => {
    const t = await setup();
    for (const who of [t.owner, t.cuentas]) {
      const response = await get(who, "/consola/cuentas-claras", t.env);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Todavía no hay herramientas de administración para Cuentas Claras.");
    }
    expect((await get(t.tareas, "/consola/cuentas-claras", t.env)).status).toBe(404);
  });

  it("dos entradas el mismo día dejan una sola console_opened, con la pestaña y sin correo", async () => {
    const t = await setup();
    await get(t.owner, "/consola/suite", t.env);
    await get(t.owner, "/consola/tareas", t.env);
    const rows = await audits("console_opened", t.owner.user.id);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].metadata_json)).toEqual({ tab: "suite" });
    const all = (await env.DB.prepare("SELECT metadata_json FROM platform_audit_events WHERE action IN ('console_opened', 'console_accounts_viewed', 'platform_role_granted', 'platform_role_revoked')").all()).results;
    for (const row of all) expect(row.metadata_json).not.toContain("@");
  });
});

describe("pestaña Suite", () => {
  async function seedMonths() {
    const statements = [];
    const people = (key, tool, level, value) => statements.push(env.DB.prepare("INSERT OR REPLACE INTO usage_period_people (period_type, period_key, tool, level, people) VALUES ('month', ?, ?, ?, ?)").bind(key, tool, level, value));
    people("2025-09", "tasks", "entro", 7); people("2025-09", "tasks", "hizo", 3);
    people("2025-10", "tasks", "entro", 5); people("2025-10", "tasks", "hizo", 4);
    people("2025-10", "expenses", "entro", 2);
    statements.push(env.DB.prepare("INSERT OR REPLACE INTO usage_daily_counts (day, tool, action, count) VALUES ('2025-10-03', 'tasks', 'tarjeta_creada', 6), ('2025-10-20', 'tasks', 'tarjeta_creada', 4), ('2025-11-01', 'tasks', 'tarjeta_creada', 50)"));
    statements.push(env.DB.prepare("INSERT OR REPLACE INTO usage_suite_snapshots (day, accounts, active_1d, active_7d, active_30d) VALUES ('2025-10-30', 11, 2, 5, 8), ('2025-10-31', 12, 3, 6, 9)"));
    await env.DB.batch(statements);
  }
  const cells = (text, label) => { const row = new RegExp(`<tr><th scope="row"><a[^>]*>${label}</a></th>(.*?)</tr>`, "u").exec(text)?.[1] ?? ""; return [...row.matchAll(/<td>(.*?)<\/td>/gu)].map((match) => match[1]); };

  it("un mes con uso: cuentas, activas, tabla por herramienta con diferencia absoluta y acciones; sin porcentajes de variación", async () => {
    const t = await setup();
    await seedMonths();
    const text = await (await get(t.owner, "/consola/suite?periodo=mes&clave=2025-10", t.env)).text();
    expect(text).toContain("Octubre de 2025");
    expect(text).toMatch(/<dt>Cuentas<\/dt><dd>12<\/dd>/u);
    expect(text).toMatch(/<dt>Activas en 30 días<\/dt><dd>9<\/dd>/u);
    expect(cells(text, "Tareas")).toEqual(["5", "4", "80 %", "−2", "+1"]);
    expect(cells(text, "Cuentas Claras")).toEqual(["2", "0", "0 %", "+2", "0"]);
    expect(cells(text, "Remanso")).toEqual(["0", "0", "—", "0", "0"]);
    expect(text).toMatch(/<th scope="row">Tarjetas creadas<\/th><td>10<\/td>/u);
    // Las diferencias son absolutas: ningún «%» fuera de la columna de proporción.
    for (const label of ["Tareas", "Cuentas Claras", "Remanso"]) for (const value of cells(text, label).slice(3)) expect(value).not.toContain("%");
    expect(text).toContain('role="img"');
    expect(text).toContain("Ver como tabla");
    expect(text).toContain('href="/consola/suite?periodo=mes&amp;clave=2025-09"');
  });

  it("al elegir una herramienta muestra su serie por período", async () => {
    const t = await setup();
    await seedMonths();
    const text = await (await get(t.owner, "/consola/suite?periodo=mes&clave=2025-10&herramienta=tasks", t.env)).text();
    expect(text).toContain("Tareas: personas por mes");
    expect(text).toMatch(/<tr><th scope="row">sep\. 25<\/th><td>7<\/td><td>3<\/td><\/tr>/u);
  });

  it("un período anterior a la publicación dice que no hay datos, sin ceros", async () => {
    const t = await setup();
    const text = await (await get(t.owner, "/consola/suite?periodo=anio&clave=2020", t.env)).text();
    expect(text).toContain("No hay datos para este período");
    expect(text).not.toContain("<dt>Cuentas</dt>");
  });

  it("la API de la suite la ve sólo el dueño", async () => {
    const t = await setup();
    await seedMonths();
    const data = await (await get(t.owner, "/api/consola/suite?periodo=mes&clave=2025-10", t.env)).json();
    expect(data.tools.find((row) => row.tool === "tasks")).toMatchObject({ entro: 5, hizo: 4, diffEntro: -2, diffHizo: 1 });
    expect(JSON.stringify(data)).not.toMatch(/user_|@/u);
  });
});
