import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { app, signSession } from "../src/index.js";

async function sessionCookieFor(email) {
  const token = await signSession({ email, exp: Date.now() + 60_000 }, env.SESSION_SECRET);
  return `session=${token}`;
}

async function requestWithCookie(path, cookie) {
  return app.request(`http://localhost${path}`, { headers: { Cookie: cookie } }, env);
}

async function requestWithDevUser(path, email) {
  return app.request(`http://localhost${path}`, { headers: { "X-Dev-User": email } }, env);
}

describe("revocación de acceso (allowed_emails) con sesión ya iniciada", () => {
  const email = "revocado@test.local";

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM allowed_emails WHERE email = ?").bind(email).run();
    await env.DB.prepare(
      "INSERT INTO allowed_emails (email, added_by, added_at) VALUES (?, 'seed', datetime('now'))"
    ).bind(email).run();
  });

  it("una cookie de sesión válida sigue funcionando mientras el email esté permitido", async () => {
    const cookie = await sessionCookieFor(email);
    const res = await requestWithCookie("/api/me", cookie);
    expect(res.status).toBe(200);
  });

  it("al remover el email de allowed_emails, la MISMA cookie ya emitida deja de servir de inmediato", async () => {
    const cookie = await sessionCookieFor(email);
    expect((await requestWithCookie("/api/me", cookie)).status).toBe(200);

    await env.DB.prepare("DELETE FROM allowed_emails WHERE email = ?").bind(email).run();

    const res = await requestWithCookie("/api/me", cookie);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("access_revoked");
    expect(body.error).toMatch(/revocado/i);
  });

  it("borra la cookie de sesión al detectar que el acceso fue revocado", async () => {
    const cookie = await sessionCookieFor(email);
    await env.DB.prepare("DELETE FROM allowed_emails WHERE email = ?").bind(email).run();

    const res = await requestWithCookie("/api/me", cookie);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/session=;/);
  });

  it("el bypass de dev/tests (X-Dev-User) no re-chequea allowed_emails", async () => {
    // Los tests unitarios y el dev local autentican con emails sintéticos que nunca
    // pasan por allowed_emails — este chequeo solo debe aplicar a sesiones de cookie real.
    const res = await requestWithDevUser("/api/me", "cualquier-email-de-test@test.local");
    expect(res.status).toBe(200);
  });
});
