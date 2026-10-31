import { createCsrfToken } from "./csrf.js";
import { FinancialValidationError } from "./finance.js";
import { LedgerError } from "./errors.js";
import { currentSession } from "./sessions.js";
import { escapeHtml, renderPage } from "./ui-parts.js";

// Utilidades comunes de las rutas: sesión, errores de formulario, páginas y el campo CSRF. Las usan index.js y cada módulo
// de rutas (routes/*.js), para que ninguno dependa de otro.
const html = escapeHtml;

export function sessionSecret(env = {}) {
  return typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 32 ? env.SESSION_SECRET : null;
}

// La sesión se resuelve una sola vez por petición (varias capas la consultan: ruta, menú de cuenta, protección de escrituras).
export async function signedInUser(c) {
  const cached = c.get("sessionUser");
  if (cached !== undefined) return cached;
  const secret = sessionSecret(c.env);
  const user = secret ? await currentSession(c.env.DB, c.req.raw, secret) : null;
  c.set("sessionUser", user);
  return user;
}

export function signInRequired(c) {
  return c.redirect(`/auth/google?returnTo=${encodeURIComponent(new URL(c.req.url).pathname)}`, 303);
}

export function formError(title, message, status = 400) {
  return page(title, `<p class="eyebrow">Cuentas Claras</p><h1>${html(title)}</h1><p class="notice" role="alert">${html(message)}</p><a class="button secondary" href="/">Volver</a>`);
}

export function ledgerFailure(c, error) {
  if (!(error instanceof LedgerError) && !(error instanceof FinancialValidationError)) throw error;
  const status = error.status ?? 400;
  if (c.req.header("Accept")?.includes("application/json")) return c.json({ error: error.message }, status);
  return c.html(formError("No pudimos guardar", error.message), status);
}

export function requestId(c) {
  return c.get("requestId") ?? "unknown";
}

export function page(title, content, options) {
  return renderPage(title, content, options);
}

export async function csrfInput(c, user) {
  const token = await createCsrfToken({ sessionId: user.id, secret: sessionSecret(c.env) });
  return `<input type="hidden" name="_csrf" value="${html(token)}">`;
}
