import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { readOwnPresentation, readOwnProfile, saveOwnNickname, saveOwnProfile, updateGoogleProfile } from "../src/profiles.js";
import { createSession } from "../src/sessions.js";
import { createSpaceForUser } from "../src/spaces.js";
import { upsertGoogleUser } from "../src/users.js";

const SECRET = "p".repeat(32);
const ORIGIN = "https://staging.homesuite.info";

async function identity(label) {
  const suffix = crypto.randomUUID();
  const user = await upsertGoogleUser(env.DB, {
    sub: `profile-${suffix}`, email: `${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-${suffix}@example.test`,
    name: label, picture: "https://lh3.googleusercontent.com/avatar",
  });
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return {
    ...user, context: { DB: env.DB, SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" },
    cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`,
    csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }),
  };
}

function request(user, path, method = "GET", body, extraHeaders = {}) {
  return app.request(`${ORIGIN}${path}`, {
    method,
    headers: {
      Cookie: user.cookie,
      ...(method !== "GET" ? { Origin: ORIGIN, "X-CSRF-Token": user.csrf, "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, user.context);
}

describe("perfil compartido en D1 y HTTP", () => {
  it("entra a la suite y muestra Muy pronto sólo al navegar a Cuentas Claras", async () => {
    const user = await identity("Ana Google");
    const signedIn = await request(user, "/");
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await signedIn.text();
    expect(html).toContain("Hola, Ana Google.");
    expect(html).toContain('href="/cuentas-claras"');
    expect(html).toContain('class="account-link" href="/perfil"');
    expect(html).toContain('<a href="/perfil">Mi perfil</a>');
    expect(html).not.toContain("Muy pronto.");
    const cuentas = await request(user, "/cuentas-claras");
    expect(cuentas.status).toBe(200);
    expect(await cuentas.text()).toContain("Muy pronto.");
    const profilePage = await request(user, "/perfil");
    expect(profilePage.status).toBe(200);
    expect(profilePage.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await profilePage.text()).toContain('id="profile-form"');
    const publicPage = await app.request(`${ORIGIN}/`, undefined, user.context);
    expect(await publicPage.text()).toContain("Continuar con Google");
    const publicCuentas = await app.request(`${ORIGIN}/cuentas-claras`, undefined, user.context);
    expect(await publicCuentas.text()).toContain("/auth/google?returnTo=%2Fcuentas-claras");
    const guestProfile = await app.request(`${ORIGIN}/perfil`, undefined, user.context);
    expect(guestProfile.status).toBe(302);
    expect(guestProfile.headers.get("Location")).toBe("/auth/google?returnTo=%2Fperfil");
    const me = await (await request(user, "/api/me")).json();
    expect(me.profile.avatar.type).toBe("photo");
    expect(me.csrfToken).toBeTruthy();
  });

  it("acepta una sola edición simultánea y audita sólo la ganadora", async () => {
    const user = await identity("Concurrente");
    const revision = (await readOwnProfile(env.DB, user.id)).revision;
    const attempts = await Promise.allSettled(["Uno", "Dos"].map(displayName =>
      saveOwnProfile(env.DB, user.id, { expectedRevision: revision, displayName })));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await readOwnProfile(env.DB, user.id)).displayName).toBe(attempts.find(result => result.status === "fulfilled").value.displayName);
    const audits = await env.DB.prepare("SELECT COUNT(*) AS n FROM platform_audit_events WHERE actor_user_id = ? AND action = 'profile_updated'").bind(user.id).first();
    expect(audits.n).toBe(1);
  });

  it("conserva preferencias frente a Google y detecta revisiones obsoletas sin auditoría falsa", async () => {
    const user = await identity("Google Ana");
    const initial = await readOwnProfile(env.DB, user.id);
    expect(initial).toMatchObject({ displayName: "Google Ana", nameSource: "google", avatar: { mode: "google", type: "photo" } });

    const edited = await saveOwnProfile(env.DB, user.id, {
      expectedRevision: initial.revision, displayName: "Ana", avatarMode: "emoji", emoji: "🌻", color: "amber",
    });
    expect(edited).toMatchObject({ displayName: "Ana", avatar: { mode: "emoji", emoji: "🌻", color: "amber" } });
    await updateGoogleProfile(env.DB, user.id, { name: "Google Ana Nueva", picture: "https://lh3.googleusercontent.com/new" });
    expect(await readOwnProfile(env.DB, user.id)).toMatchObject({ displayName: "Ana", googleDisplayName: "Google Ana Nueva", avatar: { mode: "emoji" } });
    await expect(saveOwnProfile(env.DB, user.id, { expectedRevision: initial.revision, displayName: "Viejo" }))
      .rejects.toMatchObject({ status: 409 });
    const current = await readOwnProfile(env.DB, user.id);
    const restored = await saveOwnProfile(env.DB, user.id, { expectedRevision: current.revision, nameSource: "google", avatarMode: "google" });
    expect(restored).toMatchObject({ displayName: "Google Ana Nueva", avatar: { type: "photo", photoUrl: "https://lh3.googleusercontent.com/new" } });
    expect(restored.avatar.savedEmoji).toBe("🌻");
    const legacy = await env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(user.id).first();
    expect(legacy.display_name).toBe("Google Ana Nueva");
    const audits = await env.DB.prepare("SELECT action FROM platform_audit_events WHERE actor_user_id = ? AND action = 'profile_updated'").bind(user.id).all();
    expect(audits.results).toHaveLength(2);
  });

  it("autoriza sólo integrantes, separa apodos y rechaza una petición anterior al reingreso", async () => {
    const owner = await identity("Pablo");
    const member = await identity("Celeste");
    const outsider = await identity("Ajenos");
    const first = await createSpaceForUser(env.DB, { userId: owner.id, name: `Cole ${crypto.randomUUID()}` });
    const second = await createSpaceForUser(env.DB, { userId: owner.id, name: `Fútbol ${crypto.randomUUID()}` });
    await env.DB.prepare("INSERT INTO memberships (space_id, user_id, role, membership_generation) VALUES (?, ?, 'member', ?)")
      .bind(first.id, member.id, crypto.randomUUID()).run();

    const before = await readOwnPresentation(env.DB, first.id, owner.id);
    expect(before.nickname).toBeNull();
    const after = await saveOwnNickname(env.DB, first.id, owner.id, {
      nickname: "Papá de Celes", expectedRevision: before.revision, generation: before.generation,
    });
    expect(after).toMatchObject({ displayName: "Pablo", nickname: "Papá de Celes" });
    expect((await readOwnPresentation(env.DB, second.id, owner.id)).nickname).toBeNull();
    expect((await (await request(member, `/api/spaces/${first.id}/members`)).json()).members)
      .toEqual(expect.arrayContaining([expect.objectContaining({ userId: owner.id, nickname: "Papá de Celes" })]));
    expect((await request(outsider, `/api/spaces/${first.id}/members`)).status).toBe(404);
    expect((await request(outsider, `/api/spaces/${first.id}/me/presentation`)).status).toBe(404);
    expect((await request(member, `/api/spaces/${second.id}/members`)).status).toBe(404);

    await env.DB.prepare("DELETE FROM memberships WHERE space_id = ? AND user_id = ?").bind(first.id, member.id).run();
    await env.DB.prepare("INSERT INTO memberships (space_id, user_id, role, membership_generation) VALUES (?, ?, 'member', ?)")
      .bind(first.id, member.id, crypto.randomUUID()).run();
    const newMembership = await readOwnPresentation(env.DB, first.id, member.id);
    expect(newMembership.nickname).toBeNull();
    await expect(saveOwnNickname(env.DB, first.id, member.id, {
      nickname: "Viejo", expectedRevision: 0, generation: "stale-generation",
    })).rejects.toMatchObject({ status: 409 });
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM platform_audit_events WHERE actor_user_id = ? AND action = 'nickname_updated'").bind(member.id).first();
    expect(count.n).toBe(0);
  });

  it("aplica sesión, CSRF, validación y mantiene privados los datos Google de otros integrantes", async () => {
    const owner = await identity("Privada");
    const outsider = await identity("Otra");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: `Privado ${crypto.randomUUID()}` });
    const own = await request(owner, "/api/me/profile");
    expect(own.status).toBe(200);
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
    const profile = await own.json();
    const members = await (await request(owner, `/api/spaces/${space.id}/members`)).json();
    expect(JSON.stringify(members)).not.toContain(owner.email);
    expect(JSON.stringify(members)).not.toContain("profile-");
    expect(JSON.stringify(members)).not.toContain("googleDisplayName");

    const patch = { expectedRevision: profile.revision, displayName: "Nombre propio" };
    expect((await app.request(`${ORIGIN}/api/me/profile`, { method: "PATCH", headers: { Cookie: owner.cookie, Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(patch) }, owner.context)).status).toBe(403);
    expect((await request(owner, "/api/me/profile", "PATCH", patch, { Origin: "https://evil.test" })).status).toBe(403);
    expect((await request(owner, "/api/me/profile", "PATCH", { ...patch, userId: outsider.id })).status).toBe(400);
    expect((await request(owner, "/api/me/profile", "PATCH", patch)).status).toBe(200);
    const me = await (await request(owner, "/api/me")).json();
    expect(me.displayName).toBe("Nombre propio");
    expect(me.profile.displayName).toBe("Nombre propio");
    expect((await request(outsider, `/api/spaces/${space.id}/members`)).status).toBe(404);
  });

});
