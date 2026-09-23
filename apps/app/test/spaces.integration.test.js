import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createSession, currentSession, revokeSession } from "../src/sessions.js";

describe("D1: invariantes de espacios", () => {
  it("permite un solo titular por espacio", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind("u_owner", "sub-owner", "owner@example.test", "Owner"),
      env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind("u_other", "sub-other", "other@example.test", "Other"),
      env.DB.prepare("INSERT INTO spaces (id, name) VALUES (?, ?)").bind("s_1", "Casa"),
      env.DB.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, ?)").bind("s_1", "u_owner", "owner"),
    ]);
    await expect(env.DB.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, ?)").bind("s_1", "u_other", "owner").run()).rejects.toThrow();
  });

  it("impide dos invitaciones pendientes para el mismo email y espacio", async () => {
    await env.DB.prepare("INSERT INTO invitations (id, space_id, invitee_email, inviter_user_id) VALUES (?, ?, ?, ?)").bind("i_1", "s_1", "link@example.test", "u_owner").run();
    await expect(env.DB.prepare("INSERT INTO invitations (id, space_id, invitee_email, inviter_user_id) VALUES (?, ?, ?, ?)").bind("i_2", "s_1", "link@example.test", "u_owner").run()).rejects.toThrow();
  });
});

describe("API local de espacios", () => {
  const headers = { "Content-Type": "application/json", "X-HomeSuite-Dev-Email": "zelda@example.test" };
  it("crea espacio, titular, invitación y auditoría", async () => {
    const created = await app.request("http://app.test/api/local/spaces", { method: "POST", headers, body: JSON.stringify({ name: "Casa de Hyrule" }) }, env);
    expect(created.status).toBe(201);
    const space = await created.json();
    const invited = await app.request(`http://app.test/api/local/spaces/${space.id}/invitations`, { method: "POST", headers, body: JSON.stringify({ email: "LINK@example.test" }) }, env);
    expect(invited.status).toBe(201);
    expect((await invited.json()).email).toBe("link@example.test");
    const events = await env.DB.prepare("SELECT action FROM platform_audit_events WHERE space_id = ? ORDER BY created_at").bind(space.id).all();
    expect(events.results.map(event => event.action)).toEqual(["space_created", "invitation_created"]);
  });

  it("sólo deja cancelar al titular y conserva la cancelación auditada", async () => {
    const ownerHeaders = { "Content-Type": "application/json", "X-HomeSuite-Dev-Email": "mario@example.test" };
    const created = await app.request("http://app.test/api/local/spaces", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: "Mushroom" }) }, env);
    const space = await created.json();
    const invitation = await (await app.request(`http://app.test/api/local/spaces/${space.id}/invitations`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ email: "luigi@example.test" }) }, env)).json();
    const denied = await app.request(`http://app.test/api/local/spaces/${space.id}/invitations/${invitation.id}`, { method: "DELETE", headers: { "X-HomeSuite-Dev-Email": "luigi@example.test" } }, env);
    expect(denied.status).toBe(403);
    const canceled = await app.request(`http://app.test/api/local/spaces/${space.id}/invitations/${invitation.id}`, { method: "DELETE", headers: ownerHeaders }, env);
    expect(canceled.status).toBe(204);
    const rows = await (await app.request(`http://app.test/api/local/spaces/${space.id}/invitations`, { headers: ownerHeaders }, env)).json();
    expect(rows).toEqual([{ id: invitation.id, email: "luigi@example.test", status: "canceled" }]);
  });

  it("revela sólo contexto mínimo y aceptar crea membresía", async () => {
    const ownerHeaders = { "Content-Type": "application/json", "X-HomeSuite-Dev-Email": "zelda2@example.test" };
    const space = await (await app.request("http://app.test/api/local/spaces", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: "Hyrule" }) }, env)).json();
    const invitation = await (await app.request(`http://app.test/api/local/spaces/${space.id}/invitations`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ email: "link2@example.test" }) }, env)).json();
    const inviteeHeaders = { "X-HomeSuite-Dev-Email": "link2@example.test" };
    const pending = await (await app.request("http://app.test/api/local/invitations/pending", { headers: inviteeHeaders }, env)).json();
    expect(pending).toEqual([{ id: invitation.id, space_name: "Hyrule", inviter_name: "zelda2" }]);
    const accepted = await app.request(`http://app.test/api/local/invitations/${invitation.id}/accept`, { method: "POST", headers: inviteeHeaders }, env);
    expect(accepted.status).toBe(200);
    const member = await env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)").bind(space.id, "link2@example.test").first();
    expect(member.role).toBe("member");
  });

  it("conserva la identidad local al aceptar desde el formulario", async () => {
    const ownerHeaders = { "Content-Type": "application/json", "X-HomeSuite-Dev-Email": "tom@example.test" };
    const space = await (await app.request("http://app.test/api/local/spaces", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ name: "Casa Tom" }) }, env)).json();
    const invitation = await (await app.request(`http://app.test/api/local/spaces/${space.id}/invitations`, { method: "POST", headers: ownerHeaders, body: JSON.stringify({ email: "jerry@example.test" }) }, env)).json();
    const response = await app.request(`http://app.test/local/invitations/${invitation.id}?as=jerry@example.test`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "decision=accept" }, env);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/local/spaces/${space.id}?as=jerry%40example.test`);
  });
});

describe("D1: sesiones de HomeSuite", () => {
  it("crea una sesión firmada, la resuelve y permite cerrarla", async () => {
    await env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind("u_session", "sub-session", "session@example.test", "Session User").run();
    const secret = "s".repeat(32);
    const created = await createSession(env.DB, { userId: "u_session", secret });
    const request = new Request("https://app.test/api/me", { headers: { Cookie: `__Host-homesuite_session=${encodeURIComponent(created.token)}` } });
    await expect(currentSession(env.DB, request, secret)).resolves.toMatchObject({ user_id: "u_session", email: "session@example.test" });
    await revokeSession(env.DB, request, secret);
    await expect(currentSession(env.DB, request, secret)).resolves.toBeNull();
  });

  it("redirige a Google con PKCE sólo si el ambiente tiene secretos completos", async () => {
    const authEnv = { DB: env.DB, GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "not-a-real-secret", SESSION_SECRET: "s".repeat(32) };
    const response = await app.request("https://app.test/auth/google?returnTo=%2Fcuentas-claras", undefined, authEnv);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location"));
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("returnTo")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("homesuite_oauth=");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rechaza un callback OAuth sin estado firmado, antes de intercambiar el código", async () => {
    const authEnv = { DB: env.DB, GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "not-a-real-secret", SESSION_SECRET: "s".repeat(32) };
    const response = await app.request("https://app.test/auth/callback?code=untrusted&state=other", undefined, authEnv);
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("No pudimos verificar el acceso");
  });
});
