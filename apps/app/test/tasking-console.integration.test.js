import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSession } from "../src/sessions.js";
import { upsertGoogleUser } from "../src/users.js";

// Tareas integrada a la consola (tarea 8.1; spec tasking-integrado, «Conservación de funciones y experiencia»).
const ORIGIN = "https://staging.homesuite.info";
const SECRET = "t".repeat(32);

async function person() {
  const n = crypto.randomUUID();
  const user = await upsertGoogleUser(env.DB, { sub: n, email: `${n}@gmail.com`, name: `Persona ${n}` });
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { ...user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
const req = (user, path, method = "GET", body, extraEnv = {}) => app.request(ORIGIN + path, { method, headers: { Cookie: user.cookie, ...(method !== "GET" ? { Origin: ORIGIN, "X-CSRF-Token": user.csrf, "Content-Type": "application/json" } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { ...env, SESSION_SECRET: SECRET, ...extraEnv });
const me = async (user, extraEnv) => (await req(user, "/api/tareas/me", "GET", undefined, extraEnv)).json();

describe("administración de Tareas desde la consola", () => {
  it("una identidad con la marca heredada y sin rol ya no administra; el rol migrado sí; el dueño también", async () => {
    await env.DB.prepare("UPDATE tasking_transfer_state SET phase='active' WHERE id=1").run();
    const legacy = await person();
    const migrated = await person();
    const owner = await person();
    // Crea las identidades de Tareas y marca la heredada como hacía TasKing.
    for (const user of [legacy, migrated, owner]) expect((await req(user, "/api/tareas/me")).status).toBe(200);
    await env.DB.prepare("UPDATE tasking_identities SET is_admin = 1 WHERE user_id IN (?, ?)").bind(legacy.id, migrated.id).run();
    // Lo que hace la migración 0017 con las identidades que tienen cuenta, aplicado sólo a una para comparar.
    await env.DB.prepare("INSERT INTO platform_roles (user_id, scope) VALUES (?, 'tareas')").bind(migrated.id).run();

    const owners = { HOMESUITE_OWNER_USER_IDS: owner.id };
    expect((await me(legacy, owners)).isAdmin).toBe(false);
    expect((await me(migrated, owners)).isAdmin).toBe(true);
    expect((await me(owner, owners)).isAdmin).toBe(true);
    expect((await me(owner)).isAdmin).toBe(false); // sin el secreto no hay dueños
  });

  it("las rutas viejas de administración de Tareas ya no existen", async () => {
    const user = await person();
    await env.DB.prepare("INSERT INTO platform_roles (user_id, scope) VALUES (?, 'tareas')").bind(user.id).run();
    for (const [path, method, body] of [["/api/tareas/admin/users", "GET"], ["/api/tareas/admin/stats", "GET"], ["/api/tareas/admin/set-admin", "POST", { identityId: "x", isAdmin: true }]]) {
      expect((await req(user, path, method, body)).status).toBe(404);
    }
  });
});
