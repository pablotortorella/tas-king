import { cookie, getCookie, seal, unseal } from "./auth.js";
import { createPlatformId } from "./platform.js";

export const SESSION_COOKIE = "__Host-homesuite_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function expiration(now) {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

export async function createSession(db, { userId, secret, now = new Date() }) {
  const id = createPlatformId("session");
  const expiresAt = expiration(now);
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(id, userId, expiresAt).run();
  return { id, expiresAt, token: await seal({ id, expiresAt }, secret) };
}

export async function currentSession(db, request, secret, now = new Date()) {
  const raw = getCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  const token = raw ? await unseal(decodeURIComponent(raw), secret) : null;
  if (!token?.id || !token.expiresAt || token.expiresAt <= now.toISOString()) return null;
  return db.prepare("SELECT s.id, u.id AS user_id, u.email, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND s.revoked_at IS NULL").bind(token.id, now.toISOString()).first();
}

export function sessionCookie(token, secure) {
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE_SECONDS, secure });
}

export function expiredSessionCookie(secure) {
  return cookie(SESSION_COOKIE, "", { maxAge: 0, secure });
}

export async function revokeSession(db, request, secret) {
  const raw = getCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  const token = raw ? await unseal(decodeURIComponent(raw), secret) : null;
  if (token?.id) await db.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL").bind(token.id).run();
}
