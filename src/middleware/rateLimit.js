// ---------- Rate Limiting ----------

import { RATE_LIMITS } from "../constants.js";
import { getClientIP } from "./logging.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export async function trackRequest(db, ip, endpoint, method = "GET") {
  try {
    const id = uid();
    await db.prepare(
      "INSERT INTO rate_limit_log (id, ip, endpoint, ts, method) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, ip, endpoint, now(), method).run();
  } catch (e) {
    // Si la tabla no existe, ignorar silenciosamente (será creada en migration)
  }
}

export async function checkRateLimit(db, ip, endpoint, config) {
  try {
    const windowStart = now() - config.window;
    const row = await db.prepare(
      "SELECT COUNT(*) as count FROM rate_limit_log WHERE ip = ? AND endpoint = ? AND ts > ?"
    ).bind(ip, endpoint, windowStart).first();

    const count = row?.count || 0;
    return count < config.requests;
  } catch (e) {
    // Si la tabla no existe o hay error, permitir el request (rate limiting deshabilitado)
    console.warn("Rate limit check failed:", e.message);
    return true;
  }
}

export function createRateLimitMiddleware(endpoint, config) {
  return async (c, next) => {
    const db = c.env.DB;
    const ip = getClientIP(c);

    const allowed = await checkRateLimit(db, ip, endpoint, config);
    if (!allowed) {
      await trackRequest(db, ip, endpoint, c.req.method);
      return c.json({ error: "Demasiados intentos. Intentá de nuevo más tarde." }, 429);
    }

    await trackRequest(db, ip, endpoint, c.req.method);
    await next();
  };
}
