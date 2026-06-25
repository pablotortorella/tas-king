// ---------- Routes: Authentication ----------

import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  signSession, verifySession, resolveEmail, COOKIE_OPTS,
  b64urlToBytes, strFromB64url
} from "../middleware/auth.js";
import { createRateLimitMiddleware } from "../middleware/rateLimit.js";
import { RATE_LIMITS } from "../constants.js";
import { logger, getClientIP } from "../middleware/logging.js";
import { isEmailAllowed, seedAdminIfNeeded, ensureUser } from "../db/helpers.js";

const now = () => Date.now();
const uid = () => crypto.randomUUID();

function deniedPage(msg) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acceso</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f5f7;color:#172b4d;
    display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .box{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(9,30,66,.2);padding:28px 32px;max-width:420px;text-align:center}
    a{display:inline-block;margin-top:16px;background:#0079bf;color:#fff;text-decoration:none;padding:8px 16px;border-radius:5px}
    </style></head><body><div class="box"><h2>🔒 Acceso al tablero</h2><p>${msg}</p>
    <a href="/auth/login">Entrar con Google</a></div></body></html>`;
}

// Cache de public keys de Google en formato JWK (actualizar cada hora)
let googleKeysCache = { keys: [], exp: 0 };

async function getGooglePublicKeys() {
  const now = Date.now();
  if (googleKeysCache.exp > now) return googleKeysCache.keys;

  try {
    // v3/certs devuelve JWKs: compatible directo con crypto.subtle.importKey("jwk", ...)
    const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error("Failed to fetch Google keys");
    const data = await res.json();
    googleKeysCache = {
      keys: data.keys || [],
      exp: now + 3600 * 1000
    };
    return googleKeysCache.keys;
  } catch (e) {
    console.error("Error fetching Google keys:", e);
    return [];
  }
}

async function importJWK(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

function base64urlToBytes(str) {
  const padding = "==".slice(0, (4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function verifyGoogleJWT(idToken, expectedAudience) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(strFromB64url(headerB64));
  const payload = JSON.parse(strFromB64url(payloadB64));
  const signature = base64urlToBytes(signatureB64);

  // Validar claims estándar
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("Token expired");
  if (payload.iss !== "https://accounts.google.com") throw new Error("Invalid issuer");
  if (payload.aud !== expectedAudience) throw new Error("Invalid audience");
  if (!payload.email_verified) throw new Error("Email not verified");

  // Buscar la key correcta por kid
  const keys = await getGooglePublicKeys();
  const keyEntry = keys.find(k => k.kid === header.kid);
  if (!keyEntry) throw new Error("Key not found");

  // Verificar la firma usando JWK nativo
  const cryptoKey = await importJWK(keyEntry);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
  if (!isValid) throw new Error("Invalid signature");

  return payload;
}

export function setupAuthRoutes(app) {
  app.get("/auth/login", createRateLimitMiddleware("/auth/login", RATE_LIMITS.login), c => {
    const origin = new URL(c.req.url).origin;
    const state = crypto.randomUUID();
    setCookie(c, "oauth_state", state, { ...COOKIE_OPTS, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: origin + "/auth/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return c.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
  });

  app.get("/auth/callback", createRateLimitMiddleware("/auth/callback", RATE_LIMITS.callback), async c => {
    const ip = getClientIP(c);
    const url = new URL(c.req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || state !== getCookie(c, "oauth_state")) {
      logger.warn("Login: invalid OAuth state", { ip });
      return c.html(deniedPage("La sesión de login expiró o es inválida. Probá de nuevo."), 400);
    }
    deleteCookie(c, "oauth_state", { path: "/" });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID || "",
        client_secret: c.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: url.origin + "/auth/callback",
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) {
      logger.error("Login: Google token exchange failed", { ip, status: tokenRes.status });
      return c.html(deniedPage("No se pudo completar el login con Google."), 502);
    }
    const tok = await tokenRes.json();

    let claims;
    try {
      claims = await verifyGoogleJWT(tok.id_token, c.env.GOOGLE_CLIENT_ID);
    } catch (e) {
      logger.warn("Login: JWT verification failed", { ip, error: e.message });
      return c.html(deniedPage(`Falló la validación de seguridad: ${e.message}`), 403);
    }

    const email = (claims.email || "").trim().toLowerCase();
    if (!email) {
      logger.warn("Login: no email in claims", { ip });
      return c.html(deniedPage("Tu cuenta de Google no tiene un email."), 403);
    }

    const isAllowed = await isEmailAllowed(c.env.DB, email, c.env.ALLOWED_EMAILS);
    if (!isAllowed) {
      logger.warn("Login: email not in allowlist", { ip, email });
      // Registrar como solicitud pendiente para que el admin pueda aprobarla
      try {
        await c.env.DB.prepare(
          "INSERT OR IGNORE INTO pending_access (id, email, name, requested_at, seen) VALUES (?, ?, ?, ?, 0)"
        ).bind(uid(), email, claims.name || email.split("@")[0], now()).run();
      } catch (_) { /* tabla puede no existir en entornos viejos */ }
      return c.html(deniedPage(`La cuenta <b>${email}</b> no está autorizada para esta app. Tu solicitud fue registrada.`), 403);
    }

    await seedAdminIfNeeded(c.env.DB, email, c.env.ADMIN_EMAILS);
    await ensureUser(c.env.DB, email);

    const session = await signSession({ email, exp: now() + 30 * 24 * 3600 * 1000 }, c.env.SESSION_SECRET);
    setCookie(c, "session", session, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 });
    logger.info("Login successful", { ip, email });
    return c.redirect("/");
  });

  app.get("/auth/logout", c => {
    deleteCookie(c, "session", { path: "/" });
    return c.redirect("/");
  });
}

export { verifyGoogleJWT };
