import { seal, unseal } from "./auth.js";

const PURPOSE = "csrf";

function requestOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin) return origin;
  const referer = request.headers.get("Referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function hasTrustedOrigin(request) {
  return requestOrigin(request) === new URL(request.url).origin;
}

export function createCsrfToken({ sessionId, secret }) {
  return seal({ purpose: PURPOSE, sessionId }, secret);
}

export async function validateCsrfRequest(request, { sessionId, secret }) {
  if (!hasTrustedOrigin(request)) return false;

  let token = request.headers.get("X-CSRF-Token");
  if (!token && request.headers.get("Content-Type")?.includes("application/x-www-form-urlencoded")) {
    const body = await request.clone().formData();
    token = body.get("_csrf");
  }
  if (typeof token !== "string" || !token) return false;

  const payload = await unseal(token, secret);
  return payload?.purpose === PURPOSE && payload.sessionId === sessionId;
}
