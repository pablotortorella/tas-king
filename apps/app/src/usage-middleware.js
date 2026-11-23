import { matchedRoutes } from "hono/route";
import { isGateExempt } from "./legal.js";
import { requestId, signedInUser } from "./route-kit.js";
import { classifyRoute } from "./usage-catalog.js";
import { recordUsage, touchLastActive, usageSecret } from "./usage.js";

// Medición de uso (change consola-administracion-homesuite, design.md D1 y D2). Va después de la puerta legal y del control de
// mutaciones: si la puerta pidió aceptar o una escritura se rechazó, este middleware no llega a correr. Mira la respuesta ya armada y
// escribe fuera del camino de la respuesta (waitUntil). Un fallo de la medición nunca cambia la respuesta: queda en el log sin datos de
// la persona.

const MEASURED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
// Éxito: 2xx, o la redirección con la que responden los formularios que guardaron bien (Cuentas Claras responde 303 al guardar).
const succeeded = (status) => status >= 200 && status < 400;

export function logUsage(c, event, error) {
  console.error("[homesuite-app]", JSON.stringify({ event, requestId: requestId(c), errorName: error instanceof Error ? error.name : error ? "UnknownError" : undefined }));
}

// Corre la tarea en segundo plano si el Worker tiene contexto de ejecución; si no (pruebas con app.request), la espera.
export function inBackground(c, task) {
  let ctx = null;
  try { ctx = c.executionCtx; } catch { ctx = null; }
  const guarded = Promise.resolve().then(task).catch((error) => logUsage(c, "usage_write_failed", error));
  if (ctx && typeof ctx.waitUntil === "function") { ctx.waitUntil(guarded); return Promise.resolve(); }
  return guarded;
}

// Patrón de la ruta que respondió: la primera ruta con método propio (los middlewares se registran como ALL).
function respondingRoute(c) {
  try { return matchedRoutes(c).find((route) => route.method !== "ALL")?.path ?? null; } catch { return null; }
}

// Sesión de la petición. Sin cookie de sesión no consulta la base. `protectedUser` lo deja el control de mutaciones con la misma forma.
async function sessionOf(c) {
  const protectedUser = c.get("protectedUser");
  if (protectedUser?.user_id) return protectedUser;
  return signedInUser(c);
}

export async function measureUsage(c, next) {
  await next();
  if (!MEASURED_METHODS.has(c.req.method)) return;
  if (isGateExempt(c.req.method, new URL(c.req.url).pathname)) return;
  const session = await sessionOf(c);
  if (!session?.user_id) return;
  const entry = succeeded(c.res.status) ? classifyRoute(c.req.method, respondingRoute(c)) : null;
  const secret = usageSecret(c.env);
  await inBackground(c, () => touchLastActive(c.env.DB, { userId: session.user_id, lastActiveOn: session.last_active_on }));
  if (!entry) return;
  if (!secret) { logUsage(c, "usage_secret_missing"); return; }
  await inBackground(c, () => recordUsage(c.env.DB, { userId: session.user_id, tool: entry.tool, level: entry.level, action: entry.action, secret }));
}
