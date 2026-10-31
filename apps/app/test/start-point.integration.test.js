import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { readLedger } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { ensureLocalUser } from "../src/groups.js";

const SECRET = "p".repeat(32);

async function post(email, form, path = "/groups") {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  const csrf = await createCsrfToken({ sessionId: session.id, secret: SECRET });
  const response = await app.request(`https://app.test${path}`, {
    method: "POST", body: new URLSearchParams(form),
    headers: { Cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, Origin: "https://app.test", "X-CSRF-Token": csrf, "Content-Type": "application/x-www-form-urlencoded" }, redirect: "manual",
  }, { DB: env.DB, SESSION_SECRET: SECRET });
  return { response, user };
}
async function newForm(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return (await app.request("https://app.test/groups/new", { headers: { Cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` } }, { DB: env.DB, SESSION_SECRET: SECRET })).text();
}

describe("punto de partida de un grupo", () => {
  it("el formulario ofrece las tres opciones, en cero elegida y saldos anteriores deshabilitada", async () => {
    const html = await newForm("sp-form@example.test");
    expect(html).toContain("Cómo querés empezar");
    expect(html).toMatch(/<input type="radio" name="start" value="zero" checked>/u);
    expect(html).toMatch(/<input type="radio" name="start" value="splitwise">/u);
    expect(html).toMatch(/<input type="radio" name="start" value="opening" disabled>/u);
    expect(html).toContain("todavía no disponible");
  });

  it("sin tocar la elección el grupo se crea en cero y se muestra su libro", async () => {
    const { response } = await post("sp-cero@example.test", { name: "Casa cero", currency: "COP" });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toMatch(/^\/groups\/casa-cero$/u);
  });

  it("«Traer de Splitwise» crea el grupo y lleva directo a la importación; abandonar deja el libro vacío", async () => {
    const { response, user } = await post("sp-splitwise@example.test", { name: "Casa splitwise", currency: "COP", start: "splitwise" });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/groups/casa-splitwise/ledger/import");
    const data = await readLedger(env.DB, { groupId: "casa-splitwise", userId: user.id });
    expect(data.entries).toHaveLength(0);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM splitwise_import_batches WHERE ledger_id = ?").bind(data.ledger.id).first()).toMatchObject({ n: 0 });
  });

  it("«Saldos anteriores» no se puede forzar: se trata como empezar en cero", async () => {
    const { response } = await post("sp-apertura@example.test", { name: "Casa apertura", currency: "COP", start: "opening" });
    expect(response.headers.get("Location")).toBe("/groups/casa-apertura");
  });

  it("un valor desconocido también cae en cero", async () => {
    const { response } = await post("sp-raro@example.test", { name: "Casa rara", currency: "COP", start: "<script>" });
    expect(response.headers.get("Location")).toBe("/groups/casa-rara");
  });
});
