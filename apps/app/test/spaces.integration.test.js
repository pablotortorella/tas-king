import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSession, currentSession, revokeSession } from "../src/sessions.js";
import { createSpaceForUser, ensureLocalUser, renameSpace, resolveSpace } from "../src/spaces.js";

describe("URLs estables de grupos", () => {
  it("normaliza acentos, numera duplicados y conserva la URL al renombrar", async () => {
    const owner = await ensureLocalUser(env.DB, "slugs-owner@example.test");
    const first = await createSpaceForUser(env.DB, { userId: owner.id, name: "Casa Bogotá" });
    const second = await createSpaceForUser(env.DB, { userId: owner.id, name: "Casa Bogotá" });
    const third = await createSpaceForUser(env.DB, { userId: owner.id, name: "Casa Bogotá" });
    expect([first.slug, second.slug, third.slug]).toEqual(["casa-bogota", "casa-bogota-2", "casa-bogota-3"]);
    const renamed = await renameSpace(env.DB, { spaceId: first.slug, userId: owner.id, name: "Otra casa" });
    expect(renamed.slug).toBe(first.slug);
    expect((await resolveSpace(env.DB, first.id)).slug).toBe(first.slug);
    const reserved = await createSpaceForUser(env.DB, { userId: owner.id, name: "New" });
    expect(reserved.slug).toBe("new-2");
  });

  it("asigna una URL legible al primer acceso de un grupo previo", async () => {
    await env.DB.prepare("INSERT INTO spaces (id, name) VALUES ('space_legacy_slug', 'Viaje al Perú')").run();
    expect((await resolveSpace(env.DB, "space_legacy_slug")).slug).toBe("viaje-al-peru");
  });
});

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


let realIdentityIndex = 0;
const REAL_SESSION_SECRET = "r".repeat(32);

async function realIdentity(emailPrefix) {
  realIdentityIndex += 1;
  const id = `u_real_${realIdentityIndex}`;
  const email = `${emailPrefix}-${realIdentityIndex}@example.test`;
  await env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind(id, `google-${id}`, email, emailPrefix).run();
  const session = await createSession(env.DB, { userId: id, secret: REAL_SESSION_SECRET });
  return {
    id,
    email,
    context: { DB: env.DB, SESSION_SECRET: REAL_SESSION_SECRET },
    headers: { Cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` },
    csrfToken: await createCsrfToken({ sessionId: session.id, secret: REAL_SESSION_SECRET }),
  };
}

function authenticatedRequest(identity, url, init = {}) {
  const method = init.method ?? "GET";
  const mutationHeaders = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ? { Origin: new URL(url).origin, "X-CSRF-Token": identity.csrfToken }
    : {};
  return app.request(url, { ...init, headers: { ...identity.headers, ...mutationHeaders, ...(init.headers ?? {}) } }, identity.context);
}

describe("recorrido web con sesión real", () => {
  it("rechaza mutaciones sin token CSRF o desde otro origen", async () => {
    const owner = await realIdentity("csrf-real");
    const withoutToken = await app.request("https://app.test/spaces", {
      method: "POST",
      headers: { ...owner.headers, Origin: "https://app.test", "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=No+crear",
    }, owner.context);
    expect(withoutToken.status).toBe(403);

    const crossOrigin = await app.request("https://app.test/spaces", {
      method: "POST",
      headers: { ...owner.headers, Origin: "https://evil.example", "X-CSRF-Token": owner.csrfToken, "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Tampoco+crear",
    }, owner.context);
    expect(crossOrigin.status).toBe(403);

    const spaces = await env.DB.prepare("SELECT COUNT(*) AS count FROM memberships WHERE user_id = ?").bind(owner.id).first();
    expect(spaces.count).toBe(0);
  });

  it("incluye un token CSRF firmado en los formularios autenticados", async () => {
    const owner = await realIdentity("forms-real");
    const response = await authenticatedRequest(owner, "https://app.test/spaces/new");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('name="_csrf"');
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("crea y renombra un espacio exclusivamente para su titular", async () => {
    const owner = await realIdentity("zelda-real");
    const created = await authenticatedRequest(owner, "https://app.test/spaces", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Casa+Hyrule" });
    expect(created.status).toBe(303);
    const location = created.headers.get("location");
    expect(location).toBe("/spaces/casa-hyrule");
    const page = await authenticatedRequest(owner, `https://app.test${location}`);
    expect(await page.text()).toContain("Casa Hyrule");
    const renamed = await authenticatedRequest(owner, `https://app.test${location}/rename`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Hyrule+compartido" });
    expect(renamed.status).toBe(303);
    expect(renamed.headers.get("location")).toBe(`${location}?aviso=renombrado`);
    const confirmed = await authenticatedRequest(owner, `https://app.test${renamed.headers.get("location")}`);
    expect(await confirmed.text()).toContain("Nombre del grupo guardado.");
    const forged = await authenticatedRequest(owner, `https://app.test${location}?aviso=%3Cscript%3Ealert(1)%3C/script%3E`);
    expect(await forged.text()).not.toContain("<script>alert(1)");
    const space = await env.DB.prepare("SELECT id, name, slug FROM spaces WHERE slug = ?").bind(location.split("/").at(-1)).first();
    expect(space.name).toBe("Hyrule compartido");
    expect(space.slug).toBe("casa-hyrule");
    const legacy = await authenticatedRequest(owner, `https://app.test/spaces/${space.id}`);
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get("location")).toBe(location);
    const audit = await env.DB.prepare("SELECT action FROM platform_audit_events WHERE space_id = ? ORDER BY created_at DESC LIMIT 1").bind(space.id).first();
    expect(audit.action).toBe("space_renamed");
    const outsider = await realIdentity("ganon-real");
    const forbidden = await authenticatedRequest(outsider, `https://app.test${location}/rename`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Nope" });
    expect(forbidden.status).toBe(403);
  });

  it("mantiene la invitación privada, acepta una vez y aísla a terceras personas", async () => {
    const owner = await realIdentity("link-real");
    const created = await authenticatedRequest(owner, "https://app.test/spaces", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Viaje+Kakariko" });
    const location = created.headers.get("location");
    const invitee = await realIdentity("zelda-invite");
    const invited = await authenticatedRequest(owner, `https://app.test${location}/invitations`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `email=${encodeURIComponent(invitee.email)}` });
    expect(invited.status).toBe(303);
    const invitationPage = await authenticatedRequest(invitee, "https://app.test/invitations");
    const invitationHtml = await invitationPage.text();
    expect(invitationHtml).toContain("Viaje Kakariko");
    expect(invitationHtml).toContain("link-real");
    expect(invitationHtml).not.toContain("Participantes");
    const invitation = await env.DB.prepare("SELECT i.id FROM invitations i JOIN spaces s ON s.id = i.space_id WHERE s.slug = ? AND i.invitee_email = ?").bind(location.split("/").at(-1), invitee.email).first();
    const accepted = await authenticatedRequest(invitee, `https://app.test/invitations/${invitation.id}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "decision=accept" });
    expect(accepted.headers.get("location")).toBe(location);
    const joined = await authenticatedRequest(invitee, `https://app.test${location}`);
    expect(joined.status).toBe(200);
    const outsider = await realIdentity("outsider-real");
    const hidden = await authenticatedRequest(outsider, `https://app.test${location}`);
    expect(hidden.status).toBe(404);
  });

  it("permite al titular cancelar una pendiente y prohíbe hacerlo a otra persona", async () => {
    const owner = await realIdentity("sam-real");
    const created = await authenticatedRequest(owner, "https://app.test/spaces", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Comarca" });
    const location = created.headers.get("location");
    const invitee = await realIdentity("frodo-real");
    await authenticatedRequest(owner, `https://app.test${location}/invitations`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `email=${encodeURIComponent(invitee.email)}` });
    const invitation = await env.DB.prepare("SELECT i.id FROM invitations i JOIN spaces s ON s.id = i.space_id WHERE s.slug = ? AND i.invitee_email = ?").bind(location.split("/").at(-1), invitee.email).first();
    const denied = await authenticatedRequest(invitee, `https://app.test${location}/invitations/${invitation.id}/cancel`, { method: "POST" });
    expect(denied.status).toBe(403);
    const canceled = await authenticatedRequest(owner, `https://app.test${location}/invitations/${invitation.id}/cancel`, { method: "POST" });
    expect(canceled.status).toBe(303);
    const state = await env.DB.prepare("SELECT status FROM invitations WHERE id = ?").bind(invitation.id).first();
    expect(state.status).toBe("canceled");
  });
});
