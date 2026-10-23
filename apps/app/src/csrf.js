import { seal, unseal } from "./auth.js";

const PURPOSE = "csrf";

function requestOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin) return { source: "origin", value: origin };
  const referer = request.headers.get("Referer");
  if (!referer) return null;
  try {
    return { source: "referer", value: new URL(referer).origin };
  } catch {
    return { source: "referer", value: null };
  }
}

export function hasTrustedOrigin(request) {
  const declared = requestOrigin(request);
  if (declared?.value === "null" && declared.source === "origin") {
    return request.headers.get("Sec-Fetch-Site") === "same-origin";
  }
  if (declared) return declared.value === new URL(request.url).origin;
  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

export function createCsrfToken({ sessionId, secret }) {
  return seal({ purpose: PURPOSE, sessionId }, secret);
}

export async function inspectCsrfRequest(request, { sessionId, secret }) {
  if (!hasTrustedOrigin(request)) return { valid: false, reason: "untrusted_origin" };

  let token = request.headers.get("X-CSRF-Token");
  if (!token && /application\/x-www-form-urlencoded|multipart\/form-data/iu.test(request.headers.get("Content-Type") ?? "")) {
    const body = await request.clone().formData();
    token = body.get("_csrf");
  }
  if (typeof token !== "string" || !token) return { valid: false, reason: "token_missing" };

  const payload = await unseal(token, secret);
  if (!payload || payload.purpose !== PURPOSE) return { valid: false, reason: "token_invalid" };
  if (payload.sessionId !== sessionId) return { valid: false, reason: "session_mismatch" };
  return { valid: true, reason: null };
}

export async function validateCsrfRequest(request, context) {
  return (await inspectCsrfRequest(request, context)).valid;
}
