// HomeSuite App instalable (openspec/changes/pwa-instalable): manifiesto, service worker, script de registro y página «Sin conexión».
//
// El service worker solo precarga una lista cerrada de recursos PÚBLICOS (RUTAS_PRECARGA) y nunca escribe en la caché después. Las
// navegaciones van siempre a la red; solo si la red falla se sirve una página sin conexión sin datos de la persona. Las reglas
// viven en funciones puras (decidirPedido, paginaSinConexion, cachesABorrar) que se prueban con Vitest y viajan dentro de /sw.js
// con su propio texto (Function.prototype.toString), igual que split.js: por eso deben ser autosuficientes (sin variables libres
// ni importaciones) y por eso wrangler.jsonc mantiene `minify: false` (served-modules-config.test.js).
import { sha256Hex } from "./hash.js";
import { htmlJardinZenSinConexion } from "./jardin-zen.js";
import { PRECACHE_PUBLIC } from "./pwa-precache.js";
import { htmlRemansoSinConexion } from "./remanso.js";
import { appCss } from "./styles.js";
import { LEDGER_CLIENT_JS } from "./client.js";
import { SHELL_SCRIPT } from "./routes/shell.js";
import { SPLIT_MODULE_SOURCE } from "./split.js";
import { TEXT_MODULE_SOURCE } from "./text.js";
import { LIGHT } from "./theme.js";
import { PRODUCTION_APP_HOST } from "./tools.js";
import { escapeHtml, renderPage } from "./ui-parts.js";

export const PREFIJO_CACHE = "homesuite-pwa-";
export const MODO_APAGADO = "off";

// Qué se guarda: páginas sin conexión (las genera el Worker sin sesión), cadenas constantes del Worker que cargan todas las páginas,
// el manifiesto y los archivos de public/ de Jardín Zen y Remanso (lista generada desde el disco). Nunca páginas con sesión ni audio.
export const RUTAS_PRECARGA = Object.freeze([
  "/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso",
  "/app.css", "/ledger-ui.js", "/split.js", "/text.js", "/shell.js", "/pwa.js",
  "/manifest.webmanifest",
  ...PRECACHE_PUBLIC.map((item) => item.ruta),
]);

// --- Reglas puras (se incrustan en /sw.js con su texto: autosuficientes) ---------------------------------------------------------

// Qué hace el service worker con un pedido. «red»: no interceptar (el navegador lo resuelve como si no hubiera service worker);
// «navegacion»: red y, solo si falla, página sin conexión; «precarga»: red primero y, si falla, la copia guardada.
// El orden es el de la tabla de design.md (D2).
export function decidirPedido({ metodo, modo, mismoOrigen, ruta, busqueda, conRange }, precarga) {
  if (metodo !== "GET") return "red";
  if (!mismoOrigen) return "red";
  if (ruta === "/auth" || ruta.startsWith("/auth/")) return "red";
  if (ruta === "/api" || ruta.startsWith("/api/")) return "red";
  if (conRange) return "red";
  if (ruta.startsWith("/remanso/audio/")) return "red";
  if (ruta === "/sw.js") return "red";
  if (modo === "navigate") return "navegacion";
  if (!busqueda && precarga.includes(ruta)) return "precarga";
  return "red";
}

// Página sin conexión que corresponde a una ruta navegada sin red.
export function paginaSinConexion(ruta) {
  if (ruta === "/jardin-zen" || ruta === "/jardin-zen/") return "/sin-conexion/jardin-zen";
  if (ruta === "/remanso" || ruta === "/remanso/") return "/sin-conexion/remanso";
  return "/sin-conexion";
}

// Cachés a borrar al activar una versión: solo las homesuite-pwa-* de otras versiones; las ajenas no se tocan. `actual` es el nombre completo.
export function cachesABorrar(nombres, actual) {
  return nombres.filter((nombre) => nombre.startsWith("homesuite-pwa-") && nombre !== actual);
}

// --- Service worker -----------------------------------------------------------------------------------------------------------------

// Texto del service worker normal. `version` y `precarga` quedan dentro del texto; no hay comillas invertidas ni `${` en el cuerpo.
export function swNormal({ version, precarga }) {
  return `// HomeSuite App · service worker ${version}. Generado por el Worker (apps/app/src/pwa.js); no se edita a mano.
const __name = (target) => target;
const VERSION = ${JSON.stringify(version)};
const CACHE = "homesuite-pwa-" + VERSION;
const PRECARGA = ${JSON.stringify(precarga)};

${decidirPedido.toString()}

${paginaSinConexion.toString()}

${cachesABorrar.toString()}

// Instalación atómica: toda la lista o nada. Sin credenciales, y se rechaza cualquier respuesta que no sea un 200 del mismo origen sin
// redirecciones, o que se declare privada: si una página sin conexión se volviera personal, la instalación falla y sigue la versión anterior.
async function precargar() {
  const cache = await caches.open(CACHE);
  try {
    await Promise.all(PRECARGA.map(async (ruta) => {
      const respuesta = await fetch(new Request(ruta, { credentials: "omit", cache: "no-cache" }));
      const control = (respuesta.headers.get("Cache-Control") || "").toLowerCase();
      if (respuesta.status !== 200 || respuesta.type !== "basic" || respuesta.redirected || /\\b(private|no-store)\\b/.test(control)) {
        throw new Error("Precarga rechazada: " + ruta);
      }
      await cache.put(ruta, respuesta);
    }));
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precargar().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Sin navigation preload: con él activo Chromium pide también las navegaciones que no se interceptan (/auth/google) y el servidor
    // recibe dos pedidos (dos cookies de estado OAuth). Se desactiva por si una instalación previa lo había habilitado.
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (error) { /* sin navigation preload */ }
    }
    const nombres = await caches.keys();
    await Promise.all(cachesABorrar(nombres, CACHE).map((nombre) => caches.delete(nombre)));
    await self.clients.claim();
  })());
});

// La página real siempre viene de la red; la respuesta (incluidos los errores del servidor y las redirecciones) se devuelve tal cual.
// Solo si la red falla se sirve la copia de una página sin conexión. No se lee ni se guarda nada de la respuesta.
async function navegar(event, ruta) {
  try {
    return await fetch(event.request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    return (await cache.match(paginaSinConexion(ruta), { ignoreVary: true })) || Response.error();
  }
}

// Red primero; solo si falla, la copia de la versión instalada. No escribe en la caché.
async function precargada(request, ruta) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    return (await cache.match(ruta, { ignoreVary: true })) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const decision = decidirPedido({
    metodo: event.request.method,
    modo: event.request.mode,
    mismoOrigen: url.origin === self.location.origin,
    ruta: url.pathname,
    busqueda: url.search,
    conRange: event.request.headers.has("range"),
  }, PRECARGA);
  if (decision === "navegacion") event.respondWith(navegar(event, url.pathname));
  else if (decision === "precarga") event.respondWith(precargada(event.request, url.pathname));
});
`;
}

// Apagado de emergencia (PWA_SW=off): sin manejador fetch, borra las cachés homesuite-pwa-* y se desregistra. No recarga las pestañas
// abiertas (cortaría una sesión de Remanso en curso).
export function swApagado() {
  return `// HomeSuite App · service worker apagado (PWA_SW=off): borra sus cachés y se desregistra.
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((nombre) => nombre.startsWith("homesuite-pwa-")).map((nombre) => caches.delete(nombre)));
    await self.registration.unregister();
  })());
});
`;
}

// --- Registro (/pwa.js) -------------------------------------------------------------------------------------------------------------

export const PWA_JS = `if ("serviceWorker" in navigator) {
  const registrar = () => { navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {}); };
  if (document.readyState === "complete") registrar(); else window.addEventListener("load", registrar);
}
`;

export const PWA_JS_APAGADO = `if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registros) => registros.forEach((registro) => registro.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((nombres) => nombres.filter((nombre) => nombre.startsWith("homesuite-pwa-")).forEach((nombre) => caches.delete(nombre))).catch(() => {});
}
`;

// --- Manifiesto -----------------------------------------------------------------------------------------------------------------------

// Todas las URLs son relativas al origen: el mismo código sirve producción y staging. El nombre distingue a staging para poder tener las dos
// instalaciones en un mismo teléfono (textos provisorios, los revisa Pablo).
export function manifiesto(hostname) {
  const produccion = hostname === PRODUCTION_APP_HOST;
  const icono = (archivo, tamano, purpose) => ({ src: `/icons/${archivo}`, sizes: `${tamano}x${tamano}`, type: "image/png", purpose });
  return {
    id: "/",
    start_url: "/",
    scope: "/",
    name: produccion ? "HomeSuite" : "HomeSuite (staging)",
    short_name: produccion ? "HomeSuite" : "HomeSuite staging",
    description: "Organizá, cuidá y disfrutá tu hogar.",
    lang: "es",
    dir: "ltr",
    display: "standalone",
    theme_color: LIGHT.bg,
    background_color: LIGHT.bg,
    icons: [
      icono("homesuite-192.v1.png", 192, "any"),
      icono("homesuite-512.v1.png", 512, "any"),
      icono("homesuite-maskable-192.v1.png", 192, "maskable"),
      icono("homesuite-maskable-512.v1.png", 512, "maskable"),
    ],
  };
}

// --- Página «Sin conexión» genérica ---------------------------------------------------------------------------------------------------

// Sin cuenta ni grupo: sin sesión, sin cookies, sin D1. «Reintentar» vuelve a pedir la misma URL sin JavaScript (href vacío).
export function htmlSinConexion(page = renderPage) {
  return page("Sin conexión", `<p class="eyebrow">HomeSuite</p><h1>Sin conexión</h1><p>No pudimos conectarnos. Revisá tu conexión y volvé a intentar.</p><a class="button" href="">Reintentar</a><section class="card"><h2>Mientras tanto</h2><p>Jardín Zen y Remanso funcionan sin conexión si ya los abriste en este dispositivo.</p><p><a href="/jardin-zen">Jardín Zen</a> · <a href="/remanso">Remanso</a></p></section>`, { cuenta: false });
}

// --- Versión ----------------------------------------------------------------------------------------------------------------------------

// La versión cambia si y solo si cambia algo de lo precargado o el propio service worker: 12 hex de un SHA-256 sobre el texto del
// service worker, las huellas de public/, las cadenas del Worker y las páginas sin conexión (en orden fijo).
export async function calcularVersion({ sw, huellas, cadenas, paginas }) {
  const ordenado = (objeto) => Object.entries(objeto).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const resumen = JSON.stringify({
    sw: await sha256Hex(sw),
    huellas: [...huellas].sort((a, b) => (a.ruta < b.ruta ? -1 : 1)).map((item) => [item.ruta, item.sha256]),
    cadenas: await Promise.all(ordenado(cadenas).map(async ([ruta, texto]) => [ruta, await sha256Hex(texto)])),
    paginas: await Promise.all(ordenado(paginas).map(async ([ruta, texto]) => [ruta, await sha256Hex(texto)])),
  });
  return (await sha256Hex(resumen)).slice(0, 12);
}

// El nombre del ambiente cambia el nombre del manifiesto, y el manifiesto se precarga: entran las dos variantes.
function textosPrecargados(googleConfigured) {
  return {
    cadenas: {
      "/app.css": appCss(),
      "/ledger-ui.js": LEDGER_CLIENT_JS,
      "/split.js": SPLIT_MODULE_SOURCE,
      "/text.js": TEXT_MODULE_SOURCE,
      "/shell.js": SHELL_SCRIPT,
      "/pwa.js": PWA_JS,
      "/manifest.webmanifest": JSON.stringify([manifiesto(PRODUCTION_APP_HOST), manifiesto("staging")]),
    },
    paginas: {
      "/sin-conexion": htmlSinConexion(),
      "/sin-conexion/jardin-zen": htmlJardinZenSinConexion(renderPage),
      "/sin-conexion/remanso": htmlRemansoSinConexion({ page: renderPage, html: escapeHtml, loginDisponible: googleConfigured }),
    },
  };
}

// Se calcula una vez por isolate y por si el acceso con Google está configurado (lo único del ambiente que cambia una página sin conexión).
const memo = new Map();

export function versionPwa(googleConfigured = false) {
  const clave = Boolean(googleConfigured);
  if (!memo.has(clave)) {
    const sw = swNormal({ version: "", precarga: RUTAS_PRECARGA });
    const promesa = calcularVersion({ sw, huellas: PRECACHE_PUBLIC, ...textosPrecargados(clave) }).then((version) => ({ version, texto: swNormal({ version, precarga: RUTAS_PRECARGA }) }));
    promesa.catch(() => memo.delete(clave));
    memo.set(clave, promesa);
  }
  return memo.get(clave);
}

// --- Rutas ------------------------------------------------------------------------------------------------------------------------------

const JS = "text/javascript; charset=utf-8";

export function registerPwaRoutes(app, { googleConfigured }) {
  const apagado = (c) => c.env?.PWA_SW === MODO_APAGADO;

  app.get("/sw.js", async (c) => {
    const cabeceras = { "Content-Type": JS, "Cache-Control": "no-cache" };
    if (apagado(c)) return c.body(swApagado(), 200, { ...cabeceras, ETag: '"apagado"' });
    const { version, texto } = await versionPwa(googleConfigured(c.env));
    const etag = `"${version}"`;
    const candidatas = (c.req.header("If-None-Match") ?? "").split(",").map((valor) => valor.trim().replace(/^W\//u, ""));
    if (candidatas.includes(etag)) return c.body(null, 304, { "Cache-Control": "no-cache", ETag: etag });
    return c.body(texto, 200, { ...cabeceras, ETag: etag });
  });

  app.get("/pwa.js", (c) => c.body(apagado(c) ? PWA_JS_APAGADO : PWA_JS, 200, { "Content-Type": JS, "Cache-Control": "public, max-age=3600" }));

  app.get("/manifest.webmanifest", (c) => c.body(JSON.stringify(manifiesto(new URL(c.req.url).hostname)), 200, { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" }));

  app.get("/sin-conexion", (c) => c.html(htmlSinConexion(), 200, { "Cache-Control": "no-cache" }));
}
