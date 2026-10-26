const CANONICAL_HOST = "homesuite.info";
const STAGING_APP = "https://staging.homesuite.info";
const STAGING_TASKS = "https://tas-king-staging.pablotortorella.workers.dev";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'none'",
    "style-src 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

function secure(response, staging = false) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (staging) headers.set("X-Robots-Tag", "noindex, nofollow");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function redirectToCanonical(url) {
  const destination = new URL(url);
  destination.protocol = "https:";
  destination.hostname = CANONICAL_HOST;
  destination.port = "";
  return secure(Response.redirect(destination.toString(), 308));
}

function methodNotAllowed() {
  return secure(new Response("Método no permitido", {
    status: 405,
    headers: {
      "Allow": "GET, HEAD",
      "Content-Type": "text/plain; charset=utf-8",
    },
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const staging = env.SITE_ENV === "staging";

    if (url.hostname === `www.${CANONICAL_HOST}`) {
      return redirectToCanonical(url);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed();
    }

    const asset = await env.ASSETS.fetch(request);
    if (staging && request.method === "GET" && asset.status === 200 &&
        ["/cuentas-claras", "/cuentas-claras.html", "/tareas", "/tareas.html"].includes(url.pathname)) {
      const original = await asset.text();
      const content = url.pathname.startsWith("/cuentas-claras")
        ? original.replace("<!-- staging-app-entry -->", `<div class="product-actions"><a class="primary-action" href="${STAGING_APP}/cuentas-claras">Entrar a Cuentas Claras <span aria-hidden="true">→</span></a><p class="product-action-note">Acceso de prueba en HomeSuite staging con Google.</p></div>`)
        : original.replace("https://tas-king.pablotortorella.workers.dev", STAGING_TASKS);
      const headers = new Headers(asset.headers);
      headers.delete("Content-Length");
      headers.delete("Content-Encoding");
      headers.delete("ETag");
      headers.set("Cache-Control", "no-store");
      return secure(new Response(content, { status: asset.status, headers }), true);
    }
    return secure(asset, staging);
  },
};
