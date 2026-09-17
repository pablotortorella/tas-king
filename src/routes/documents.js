// ---------- Documentos HTML ----------
//
// Estas rutas existen por una sola razón: que las cabeceras de seguridad lleguen
// al documento que el navegador ejecuta.
//
// Sin ellas, el Asset Worker de Cloudflare sirve el HTML antes de que corra el
// User Worker, y createCorsMiddleware() nunca toca esas respuestas: la app queda
// sin CSP y sin X-Frame-Options en las únicas páginas donde esas protecciones
// importan. `run_worker_first` en wrangler.jsonc es lo que enruta los documentos
// hasta acá; este handler los busca en el binding de assets y deja que el
// middleware global agregue las cabeceras. Ver ADR-017.

// Páginas servidas sin extensión. Cloudflare redirige /landing.html -> /landing
// (html_handling por defecto), así que la URL canónica —la que el navegador
// termina cargando— es ésta, y es la que necesita las cabeceras.
//
// Esta lista tiene que coincidir con `assets.run_worker_first` en wrangler.jsonc.
// No se puede derivar de un lado al otro porque wrangler.jsonc es JSON, pero
// e2e/security-headers.spec.js recorre public/*.html y falla si alguna página
// quedó sin cubrir en cualquiera de los dos lugares.
export const EXTENSIONLESS_DOCUMENTS = [
  "/landing",
  "/releases",
  "/revoked",
  "/terminos",
];

// Reconstruye la respuesta del Asset Worker con cabeceras mutables, para que el
// middleware pueda agregarle las de seguridad. Preserva Content-Type,
// Cache-Control y ETag: perder el cacheo de un HTML de 208 KB sería una regresión
// de performance disfrazada de mejora de seguridad.
function withMutableHeaders(res) {
  // 204/304 no pueden llevar cuerpo; pasar uno haría throw en el constructor.
  const body = res.status === 204 || res.status === 304 ? null : res.body;
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
}

export function setupDocumentRoutes(app) {
  // Ojo: NO va detrás de createAuthMiddleware(). Hoy el HTML se sirve sin
  // autenticar y es el cliente quien decide tras llamar a /api/me. Autenticarlo
  // acá cambiaría comportamiento.
  const serveDocument = async (c) => {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    return withMutableHeaders(res);
  };

  app.get("/", serveDocument);

  // Cualquier .html, no una lista fija: `run_worker_first` manda todo /*.html
  // hasta acá, así que una página nueva sin ruta equivalente daría 404 en vez
  // de servirse. Estas respuestas suelen ser el redirect 307 a la URL sin
  // extensión; igual llevan cabeceras.
  app.get("/:document{.+\\.html}", serveDocument);

  for (const path of EXTENSIONLESS_DOCUMENTS) {
    app.get(path, serveDocument);
  }
}
