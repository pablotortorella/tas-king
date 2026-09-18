// ---------- CORS + Security Headers ----------

import { ALLOWED_ORIGINS } from "../constants.js";

export function createCorsMiddleware() {
  return async (c, next) => {
    const origin = c.req.header("origin") || "";

    // Preflight (OPTIONS) requests - responder antes de procesar
    if (c.req.method === "OPTIONS") {
      const headers = new Headers();
      if (ALLOWED_ORIGINS.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Dev-User");
        headers.set("Access-Control-Max-Age", "86400");
        headers.set("Access-Control-Allow-Credentials", "true");
      }
      return new Response(null, { status: 204, headers });
    }

    // Procesar request normal
    await next();

    // CORS: solo dominios permitidos
    if (ALLOWED_ORIGINS.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Dev-User");
      c.header("Access-Control-Allow-Credentials", "true");
    }

    // Security Headers (siempre)
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header(
      "Content-Security-Policy",
      // script-src sin 'unsafe-inline': todo el JavaScript de la app sale de
      // archivos propios. Un <script> inyectado en el documento no se ejecuta.
      //
      // style-src SÍ lo conserva, a propósito: quedan 148 atributos style= en el
      // markup, varios generados con valores interpolados (barras de progreso,
      // swatches de color). Migrarlos a CSSOM es un trabajo aparte, anotado en el
      // backlog. Declararlo acá deja la excepción a la vista en vez de escondida.
      //
      // frame-ancestors además de X-Frame-Options: el primero es lo que define la
      // especificación de CSP y lo que respetan los navegadores actuales; el
      // segundo cubre clientes viejos. Ver ADR-017.
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
      + "img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'none'; "
      + "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com"
    );

    // HSTS (solo en prod)
    if (!c.req.url.includes("localhost") && !c.req.url.includes("127.0.0.1")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
  };
}
