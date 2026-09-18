import { readdirSync } from "fs";
import { resolve } from "path";
import { expect, test } from "@playwright/test";

// Cabeceras de seguridad sobre la respuesta HTTP servida.
//
// Por qué E2E y no un test unitario: el bug que motivó estos tests era
// justamente que las cabeceras existían en el middleware pero no llegaban al
// documento, porque el Asset Worker de Cloudflare responde antes que el Worker.
// Un test que invoca `app.request(...)` se saltea ese ruteo y da verde igual
// (así pasó `test/api.test.js` durante meses). La única verificación que sirve
// es pedir la URL como un cliente externo. Ver ADR-017.

const CABECERAS = {
  "content-security-policy": /default-src 'self'/,
  "x-frame-options": /^DENY$/,
  "x-content-type-options": /^nosniff$/,
  "referrer-policy": /^no-referrer$/,
  "permissions-policy": /camera=\(\)/,
};

// Derivado del filesystem a propósito: si alguien agrega una página a public/ y
// se olvida de sumarla a `run_worker_first` en wrangler.jsonc o a las rutas de
// src/routes/documents.js, este test falla en vez de dejarla sin protección.
function paginasPublicas() {
  return readdirSync(resolve(process.cwd(), "public"))
    .filter((f) => f.endsWith(".html"))
    // index.html se sirve como "/", que se prueba aparte.
    .filter((f) => f !== "index.html")
    .map((f) => `/${f.replace(/\.html$/, "")}`);
}

function esperarCabeceras(headers, url) {
  for (const [nombre, patron] of Object.entries(CABECERAS)) {
    expect(headers[nombre], `${url} debería traer ${nombre}`).toBeDefined();
    expect(headers[nombre], `${url}: ${nombre}`).toMatch(patron);
  }
}

test("el documento principal trae las cabeceras de seguridad", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  esperarCabeceras(res.headers(), "/");
});

test("las páginas públicas traen las mismas cabeceras", async ({ request }) => {
  const paginas = paginasPublicas();
  // Si esto da 0, el filtro quedó mal y el test no probaría nada.
  expect(paginas.length).toBeGreaterThan(0);

  for (const path of paginas) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} debería servirse`).toBe(200);
    esperarCabeceras(res.headers(), path);
  }
});

test("la variante .html también las trae, aunque redirija", async ({ request }) => {
  const res = await request.get("/landing.html", { maxRedirects: 0 });
  esperarCabeceras(res.headers(), "/landing.html");
});

test("la API conserva las cabeceras que ya tenía", async ({ request }) => {
  const res = await request.get("/api/me");
  expect(res.status()).toBe(200);
  esperarCabeceras(res.headers(), "/api/me");
});

test("el documento se sirve sin autenticar, como antes", async ({ request }) => {
  // El HTML nunca estuvo detrás de auth: la app llama a /api/me y decide desde
  // el cliente. Endurecer las cabeceras no debe cambiar eso.
  const res = await request.get("/", { headers: { cookie: "" } });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("<!DOCTYPE html>");
});

test("un request condicional sigue respondiendo 304, sin cuerpo", async ({ request }) => {
  // Pasar por el Worker no debe romper el cacheo: index.html pesa ~208 KB y
  // volver a mandarlo entero en cada visita sería una regresión de performance
  // escondida atrás de una mejora de seguridad.
  const primera = await request.get("/");
  const etag = primera.headers()["etag"];
  expect(etag, "el documento debería traer ETag").toBeTruthy();

  const segunda = await request.get("/", { headers: { "If-None-Match": etag } });
  expect(segunda.status()).toBe(304);
  expect(segunda.headers()["etag"]).toBe(etag);
  expect((await segunda.body()).length).toBe(0);
});

test("los assets estáticos no pasan por el Worker", async ({ request }) => {
  // `run_worker_first` está acotado a documentos a propósito: enrutar cada JS,
  // CSS e imagen por el Worker pagaría una invocación por asset para decorar
  // respuestas que no lo necesitan — el CSP gobierna el documento, no lo que
  // el documento carga.
  for (const asset of ["/tips.js", "/favicon.svg"]) {
    const res = await request.get(asset);
    expect(res.status(), `${asset} debería servirse`).toBe(200);
    expect(res.headers()["content-security-policy"], `${asset} no debería pasar por el Worker`).toBeUndefined();
  }
});

test("la política prohíbe el JavaScript inline", async ({ request }) => {
  // Es el objetivo de todo el refactor: mientras hubiera un <script> inline en
  // alguna página, script-src no podía soltar 'unsafe-inline', y con
  // 'unsafe-inline' un script inyectado en el documento se ejecuta igual.
  const csp = (await request.get("/")).headers()["content-security-policy"];

  expect(csp).toMatch(/script-src 'self'[;\s]/);
  expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(csp).not.toMatch(/unsafe-eval/);

  // frame-ancestors además de X-Frame-Options (ADR-017).
  expect(csp).toMatch(/frame-ancestors 'none'/);

  // style-src conserva 'unsafe-inline' a propósito: quedan atributos style= en
  // el markup. Si algún día se migran, este test es el recordatorio de venir acá.
  expect(csp).toMatch(/style-src 'self' 'unsafe-inline'/);
});

test("ninguna página sirve JavaScript inline", async ({ request }) => {
  // El complemento del test anterior: la política puede prohibirlo, pero si
  // quedara un bloque inline la página se rompería en silencio para quien la use.
  for (const path of ["/", ...paginasPublicas()]) {
    const html = await (await request.get(path, { maxRedirects: 0 })).text();
    const inline = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(m => m[2].trim().length > 0);
    expect(inline.map(m => m[2].trim().slice(0, 60)), `${path} no debería tener script inline`).toEqual([]);
  }
});

test("la ruta de documentos no tapa los adjuntos terminados en .html", async ({ request }) => {
  // El patrón de la ruta de documentos usaba `.+`, que cruza barras, así que
  // capturaba cualquier path terminado en .html — incluido /uploads/<key>.html.
  // Las keys se arman con uid() + la extensión del NOMBRE del archivo, no del
  // MIME, así que un adjunto puede terminar en .html y quedaba inalcanzable:
  // lo atendía el Asset Worker (404 vacío) en vez de la ruta de adjuntos.
  const html = await request.get("/uploads/inexistente.html");
  const png = await request.get("/uploads/inexistente.png");

  // Las dos las tiene que atender la misma ruta, la de adjuntos.
  expect(await html.text(), "/uploads/*.html debería atenderlo la ruta de adjuntos")
    .toBe(await png.text());
});
