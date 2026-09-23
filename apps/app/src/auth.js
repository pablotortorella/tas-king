const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function base64UrlJson(value) {
  return base64Url(encoder.encode(JSON.stringify(value)));
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(decoder.decode(decodeBase64Url(value)));
}

function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export function validReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export function getCookie(header, name) {
  if (!header) return null;
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export function cookie(name, value, { maxAge, secure = true } = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) attributes.push("Secure");
  if (typeof maxAge === "number") attributes.push(`Max-Age=${maxAge}`);
  return attributes.join("; ");
}

export async function seal(value, secret) {
  const body = base64UrlJson(value);
  return `${body}.${base64Url(await hmac(body, secret))}`;
}

export async function unseal(token, secret) {
  if (typeof token !== "string") return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = base64Url(await hmac(body, secret));
  if (signature.length !== expected.length) return null;
  let matches = 0;
  for (let index = 0; index < signature.length; index += 1) matches |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
  if (matches !== 0) return null;
  try { return decodeJson(body); } catch { return null; }
}

export async function createGoogleAuthorization({ clientId, redirectUri, returnTo }) {
  const verifier = randomBase64Url(48);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return { url: url.toString(), state: { state, verifier, nonce, returnTo: validReturnTo(returnTo), expiresAt: Date.now() + 10 * 60 * 1000 } };
}

export async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri, fetcher = fetch }) {
  const response = await fetcher(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("Google no aceptó el código de acceso.");
  const body = await response.json();
  if (typeof body.id_token !== "string") throw new Error("Google no devolvió una identidad válida.");
  return body;
}

export async function validateGoogleIdToken({ idToken, audience, nonce, fetcher = fetch, now = Date.now() }) {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) throw new Error("ID token inválido.");
  let header; let payload;
  try { header = decodeJson(encodedHeader); payload = decodeJson(encodedPayload); } catch { throw new Error("ID token inválido."); }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Algoritmo de ID token no admitido.");
  const response = await fetcher(GOOGLE_JWKS_ENDPOINT);
  if (!response.ok) throw new Error("No fue posible validar la firma de Google.");
  const { keys } = await response.json();
  const jwk = keys?.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) throw new Error("La clave de Google no está disponible.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(encodedSignature), signed);
  if (!validSignature) throw new Error("La firma de Google no es válida.");
  const currentSeconds = Math.floor(now / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!GOOGLE_ISSUERS.has(payload.iss) || !audiences.includes(audience) || (audiences.length > 1 && payload.azp !== audience) || payload.exp <= currentSeconds || (payload.iat && payload.iat > currentSeconds + 60) || payload.nonce !== nonce || payload.email_verified !== true || typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string") {
    throw new Error("Los claims de Google no son válidos.");
  }
  return { sub: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : "" };
}
