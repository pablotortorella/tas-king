import { requestId, signedInUser } from "../route-kit.js";

// Quién entra a la consola (change consola-administracion-homesuite, design.md D9; spec consola-administracion-homesuite).
// - Dueños de la suite: identificadores internos de `users` en el secreto HOMESUITE_OWNER_USER_IDS, nunca en la base ni por correo.
// - Roles por herramienta: tabla platform_roles («tareas», «cuentas-claras»); sólo un dueño los da o los quita.
// Para quien no puede entrar, la consola no existe: la misma respuesta 404 que una ruta inexistente de la app.

export const ROLE_SCOPES = Object.freeze(["tareas", "cuentas-claras"]);
// Pestañas en orden. `scope` es el rol que la abre además del dueño; sin `scope`, sólo dueños.
export const CONSOLE_TABS = Object.freeze([
  Object.freeze({ id: "suite", label: "Suite", scope: null }),
  Object.freeze({ id: "tareas", label: "Tareas", scope: "tareas" }),
  Object.freeze({ id: "cuentas-claras", label: "Cuentas Claras", scope: "cuentas-claras" }),
  Object.freeze({ id: "administradores", label: "Administradores", scope: null }),
]);
export const SCOPE_LABELS = Object.freeze({ tareas: "Tareas", "cuentas-claras": "Cuentas Claras" });

export function ownerIds(env = {}) {
  const raw = typeof env.HOMESUITE_OWNER_USER_IDS === "string" ? env.HOMESUITE_OWNER_USER_IDS : "";
  return [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
}

export const isOwner = (env, userId) => Boolean(userId) && ownerIds(env).includes(userId);

export async function roleScopes(db, userId) {
  const { results } = await db.prepare("SELECT scope FROM platform_roles WHERE user_id = ? ORDER BY scope").bind(userId).all();
  return results.map((row) => row.scope).filter((scope) => ROLE_SCOPES.includes(scope));
}

export function allowedTabs({ owner, scopes }) {
  return CONSOLE_TABS.filter((tab) => owner || (tab.scope && scopes.includes(tab.scope))).map((tab) => tab.id);
}

// Acceso de la persona con sesión. Sin cookie de sesión no consulta la base. Se resuelve una vez por petición.
export async function consoleAccess(c) {
  const cached = c.get("consoleAccess");
  if (cached) return cached;
  const session = await signedInUser(c);
  let access = { session: null, owner: false, scopes: [], tabs: [] };
  if (session) {
    const owner = isOwner(c.env, session.user_id);
    const scopes = await roleScopes(c.env.DB, session.user_id);
    access = { session, owner, scopes, tabs: allowedTabs({ owner, scopes }) };
  }
  c.set("consoleAccess", access);
  return access;
}

// La misma respuesta que app.notFound (index.js), para que la consola no se distinga de una ruta inexistente. El intento queda sólo en
// el log del Worker, sin la cuenta.
export function consoleNotFound(c, reason) {
  console.warn("[homesuite-app]", JSON.stringify({ event: "console_denied", requestId: requestId(c), reason, ownersConfigured: ownerIds(c.env).length > 0 }));
  return c.json({ error: "No encontrado." }, 404);
}
