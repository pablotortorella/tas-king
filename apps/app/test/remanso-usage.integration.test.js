import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSession } from "../src/sessions.js";
import { ensureLocalUser } from "../src/groups.js";
import { colombiaDay, periodKeys } from "../src/usage-periods.js";

// Resultado de Remanso con cuenta (tarea 4.1; specs remanso-entrega y estadisticas-de-uso-homesuite).
const SECRET = "r".repeat(32);
const ENV = { DB: env.DB, SESSION_SECRET: SECRET, USAGE_MARKER_SECRET: "k".repeat(32) };
const ORIGIN = "https://app.test";

async function identity() {
  const user = await ensureLocalUser(env.DB, `remanso-uso-${crypto.randomUUID()}@example.test`);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
const send = (who, body, { csrf = who.csrf } = {}) => app.request(`${ORIGIN}/api/uso/remanso`, { method: "POST", headers: { Cookie: who.cookie, Origin: ORIGIN, "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) }, ENV);

const day = () => colombiaDay();
const people = async (level) => (await env.DB.prepare("SELECT people FROM usage_period_people WHERE period_type = 'day' AND period_key = ? AND tool = 'calm' AND level = ?").bind(day(), level).first())?.people ?? 0;
const actions = async (action) => (await env.DB.prepare("SELECT count FROM usage_daily_counts WHERE day = ? AND tool = 'calm' AND action = ?").bind(day(), action).first())?.count ?? 0;
const state = async () => ({ entro: await people("entro"), hizo: await people("hizo"), terminadas: await actions("sesion_terminada"), abandonadas: await actions("sesion_abandonada") });

describe("POST /api/uso/remanso", () => {
  it("«terminada» cuenta «hizo algo» y suma la sesión terminada", async () => {
    const who = await identity();
    const before = await state();
    expect((await send(who, { resultado: "terminada" })).status).toBe(204);
    expect(await state()).toEqual({ entro: before.entro + 1, hizo: before.hizo + 1, terminadas: before.terminadas + 1, abandonadas: before.abandonadas });
  });

  it("«abandonada» cuenta «entró» pero no «hizo algo», y suma la sesión abandonada", async () => {
    const who = await identity();
    const before = await state();
    expect((await send(who, { resultado: "abandonada" })).status).toBe(204);
    expect(await state()).toEqual({ entro: before.entro + 1, hizo: before.hizo, terminadas: before.terminadas, abandonadas: before.abandonadas + 1 });
  });

  it("un campo extra o un valor desconocido responde 400 sin escribir nada", async () => {
    const who = await identity();
    const before = await state();
    for (const body of [{ resultado: "terminada", minutos: 10 }, { resultado: "pausada" }, {}, [], "no-json", { resultado: "toString" }]) {
      expect((await send(who, body)).status).toBe(400);
    }
    expect(await state()).toEqual(before);
  });

  it("sin CSRF o sin sesión se rechaza", async () => {
    const who = await identity();
    const before = await state();
    expect((await send(who, { resultado: "terminada" }, { csrf: null })).status).toBe(403);
    expect((await app.request(`${ORIGIN}/api/uso/remanso`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "{\"resultado\":\"terminada\"}" }, ENV)).status).toBe(401);
    expect(await state()).toEqual(before);
  });

  it("la página trae el token sólo con sesión", async () => {
    const who = await identity();
    const signed = await (await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: who.cookie } }, ENV)).text();
    expect(signed).toMatch(/data-uso="[^"]+"/u);
    const anonymous = await (await app.request(`${ORIGIN}/remanso`, {}, ENV)).text();
    expect(anonymous).not.toContain("data-uso");
  });

  it("abrir Remanso con sesión cuenta «entró»", async () => {
    const who = await identity();
    const before = await state();
    await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: who.cookie } }, ENV);
    expect((await state()).entro).toBe(before.entro + 1);
    expect(periodKeys(day()).day).toBe(day());
  });
});
