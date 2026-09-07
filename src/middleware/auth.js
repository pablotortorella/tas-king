// ---------- Authentication ----------

import { getCookie, deleteCookie } from "hono/cookie";
import { RATE_LIMITS, COOKIE_OPTS, ACCESS_REVOKED_MESSAGE } from "../constants.js";
import { getClientIP, logger } from "./logging.js";
import { checkRateLimit, trackRequest } from "./rateLimit.js";
import { ensureUser, seedAdminIfNeeded, isEmailAllowed } from "../db/helpers.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

function b64urlFromBytes(buf) {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const b64urlFromStr = s => b64urlFromBytes(new TextEncoder().encode(s));
const strFromB64url = s => new TextDecoder().decode(b64urlToBytes(s));

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret || ""),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload, secret) {
  const data = b64urlFromStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(data));
  return data + "." + b64urlFromBytes(sig);
}

export async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlToBytes(sig), new TextEncoder().encode(data));
  if (!ok) return null;
  try {
    const obj = JSON.parse(strFromB64url(data));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch (e) { return null; }
}

export function isLocalRequest(url) {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// Email resuelto SOLO a partir de una cookie de sesión real (login con Google). A
// diferencia de resolveEmail(), nunca cae al bypass de X-Dev-User/DEV_USER_EMAIL — sirve
// para saber si conviene re-chequear la lista de acceso (ver checkAccessRevoked más abajo).
export async function resolveSessionEmail(c) {
  const token = getCookie(c, "session");
  if (!token) return null;
  const sess = await verifySession(token, c.env.SESSION_SECRET);
  return sess && sess.email ? sess.email.trim().toLowerCase() : null;
}

export async function resolveEmail(c) {
  const sessionEmail = await resolveSessionEmail(c);
  if (sessionEmail) return sessionEmail;
  if (!isLocalRequest(c.req.url)) return "";
  const dev = c.req.header("X-Dev-User") || c.env.DEV_USER_EMAIL;
  return dev ? dev.trim().toLowerCase() : "";
}

// Si el acceso de una sesión real fue revocado (removido de allowed_emails) después de
// haber iniciado sesión, la cookie firmada seguía siendo válida hasta por 30 días — el
// panel admin no cortaba el acceso de inmediato. Se re-chequea acá (no en el bypass de
// dev/tests) y se borra la cookie para no dejar una sesión "zombie". Reutilizable desde
// cualquier ruta que resuelva su propia autenticación (ver uploads.js).
export async function checkAccessRevoked(c, sessionEmail) {
  if (!sessionEmail) return null;
  const allowed = await isEmailAllowed(c.env.DB, sessionEmail, c.env.ALLOWED_EMAILS);
  if (allowed) return null;
  deleteCookie(c, "session", { path: "/" });
  return c.json({ error: ACCESS_REVOKED_MESSAGE, code: "access_revoked" }, 403);
}

export function createAuthMiddleware() {
  return async (c, next) => {
    // Rate limiting por IP y endpoint
    const ip = getClientIP(c);
    const endpoint = c.req.path;
    const allowed = await checkRateLimit(c.env.DB, ip, endpoint, RATE_LIMITS.api);
    if (!allowed) {
      await trackRequest(c.env.DB, ip, endpoint, c.req.method);
      return c.json({ error: "Demasiadas solicitudes. Intentá de nuevo más tarde." }, 429);
    }
    await trackRequest(c.env.DB, ip, endpoint, c.req.method);

    const sessionEmail = await resolveSessionEmail(c);
    const revoked = await checkAccessRevoked(c, sessionEmail);
    if (revoked) return revoked;

    const email = await resolveEmail(c);
    if (!email) return c.json({ error: "No autenticado." }, 401);

    // Ensure user exists y apply admin role if needed
    await ensureUser(c.env.DB, email);
    await seedAdminIfNeeded(c.env.DB, email, c.env.ADMIN_EMAILS);
    c.set("email", email);
    await next();
  };
}

export async function requireAdmin(c, next) {
  const email = c.get("email");
  const user = await c.env.DB.prepare("SELECT is_admin FROM users WHERE email = ?").bind(email).first();
  if (!user || !user.is_admin) return c.json({ error: "Acceso denegado." }, 403);
  await next();
}

export { b64urlFromBytes, b64urlFromStr, b64urlToBytes, strFromB64url, COOKIE_OPTS };
