import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { cachesABorrar, decidirPedido, paginaSinConexion, PWA_JS, PWA_JS_APAGADO, RUTAS_PRECARGA, swApagado, swNormal, versionPwa } from "../src/pwa.js";

const ORIGEN = "https://staging.homesuite.info";
const sw = () => app.request(`${ORIGEN}/sw.js`);

describe("GET /sw.js", () => {
  it("responde JavaScript sin caché del navegador, con la CSP vigente y nosniff", async () => {
    const respuesta = await sw();
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(respuesta.headers.get("Cache-Control")).toBe("no-cache");
    expect(respuesta.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(respuesta.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  it("lleva la versión, la lista de precarga y el texto de las reglas", async () => {
    const respuesta = await sw();
    const texto = await respuesta.text();
    const { version } = await versionPwa();
    expect(version).toMatch(/^[0-9a-f]{12}$/u);
    expect(texto).toContain(`const VERSION = "${version}";`);
    expect(texto).toContain(JSON.stringify(RUTAS_PRECARGA));
    for (const regla of [decidirPedido, paginaSinConexion, cachesABorrar]) expect(texto).toContain(regla.toString());
  });

  it("ETag igual a la versión y 304 con If-None-Match", async () => {
    const { version } = await versionPwa();
    const primera = await sw();
    expect(primera.headers.get("ETag")).toBe(`"${version}"`);
    const segunda = await app.request(`${ORIGEN}/sw.js`, { headers: { "If-None-Match": `"${version}"` } });
    expect(segunda.status).toBe(304);
    expect(segunda.headers.get("Cache-Control")).toBe("no-cache");
    expect(await segunda.text()).toBe("");
    const otra = await app.request(`${ORIGEN}/sw.js`, { headers: { "If-None-Match": '"otra"' } });
    expect(otra.status).toBe(200);
  });

  it("la versión es la misma entre pedidos y no depende de la configuración de Google (las páginas sin conexión no llevan el acceso)", async () => {
    const { version } = await versionPwa();
    expect((await versionPwa()).version).toBe(version);
    const sinGoogle = await app.request(`${ORIGEN}/sw.js`);
    const conGoogle = await app.request(`${ORIGEN}/sw.js`, {}, { GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s", SESSION_SECRET: "s".repeat(32) });
    expect(sinGoogle.headers.get("ETag")).toBe(`"${version}"`);
    expect(conGoogle.headers.get("ETag")).toBe(`"${version}"`);
  });

  it("con PWA_SW=off responde 200 con el service worker de apagado: sin fetch, con unregister, sin navigate", async () => {
    const respuesta = await app.request(`${ORIGEN}/sw.js`, {}, { PWA_SW: "off" });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-cache");
    const texto = await respuesta.text();
    expect(texto).toBe(swApagado());
    expect(texto).not.toMatch(/addEventListener\(\s*["']fetch["']/u);
    expect(texto).toContain("self.registration.unregister()");
    expect(texto).not.toMatch(/navigate/u);
    expect(texto).toContain("homesuite-pwa-");
  });

  it("PWA_SW=on o ausente es el modo normal", async () => {
    const normal = await (await sw()).text();
    expect(await (await app.request(`${ORIGEN}/sw.js`, {}, { PWA_SW: "on" })).text()).toBe(normal);
  });
});

describe("GET /pwa.js", () => {
  it("modo normal: registra /sw.js con alcance / y updateViaCache none, con caché de una hora", async () => {
    const respuesta = await app.request(`${ORIGEN}/pwa.js`);
    expect(respuesta.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const texto = await respuesta.text();
    expect(texto).toBe(PWA_JS);
    expect(texto).toContain('register("/sw.js", { scope: "/", updateViaCache: "none" })');
    expect(texto).not.toContain("unregister");
  });

  it("modo apagado: no registra y desregistra lo que encuentre", async () => {
    const respuesta = await app.request(`${ORIGEN}/pwa.js`, {}, { PWA_SW: "off" });
    expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=3600");
    const texto = await respuesta.text();
    expect(texto).toBe(PWA_JS_APAGADO);
    expect(texto).not.toContain(".register(");
    expect(texto).toContain("getRegistrations");
    expect(texto).toContain("unregister()");
  });
});

// Ejecuta el texto real de /sw.js contra un entorno simulado (self, caches, fetch) para probar instalación, activación e intercepción.
function entorno({ respuestas = {}, red = true, cachesPrevias = [] } = {}) {
  const oyentes = {};
  const almacenes = new Map(cachesPrevias.map((nombre) => [nombre, new Map()]));
  const escrituras = [];
  const llamadas = [];
  let reclamado = false;
  let salto = false;
  const respuesta = (ruta) => {
    const dato = respuestas[ruta] ?? {};
    return { status: 200, type: "basic", redirected: false, headers: { get: (nombre) => (nombre.toLowerCase() === "cache-control" ? dato.control ?? "no-cache" : null) }, cuerpo: `copia de ${ruta}`, ...dato.respuesta };
  };
  const cacheDe = (nombre) => ({
    put: async (clave, valor) => { escrituras.push(clave); almacenes.get(nombre).set(String(clave), valor); },
    match: async (clave) => almacenes.get(nombre).get(String(clave)),
  });
  const contexto = {
    self: {
      location: { origin: ORIGEN },
      addEventListener: (tipo, funcion) => { oyentes[tipo] = funcion; },
      skipWaiting: () => { salto = true; return Promise.resolve(); },
      clients: { claim: async () => { reclamado = true; } },
      registration: { navigationPreload: { enable: async () => { contexto.preloadHabilitado = true; }, disable: async () => { contexto.preloadDeshabilitado = true; } } },
    },
    caches: {
      open: async (nombre) => { if (!almacenes.has(nombre)) almacenes.set(nombre, new Map()); return cacheDe(nombre); },
      keys: async () => [...almacenes.keys()],
      delete: async (nombre) => almacenes.delete(nombre),
    },
    Request: class { constructor(url, init) { this.url = url; this.init = init; } },
    Response: { error: () => ({ error: true }) },
    URL,
    Error,
    fetch: async (pedido) => {
      const ruta = typeof pedido === "string" ? pedido : pedido.url ?? new URL(pedido.request?.url ?? "").pathname;
      llamadas.push(pedido);
      if (!red) throw new TypeError("Failed to fetch");
      return respuesta(new URL(ruta, ORIGEN).pathname);
    },
  };
  vm.runInNewContext(`${contexto.__texto ?? ""}`, contexto);
  return { contexto, oyentes, almacenes, escrituras, llamadas, estado: () => ({ reclamado, salto }) };
}

async function cargar(opciones, texto) {
  const e = entorno(opciones);
  vm.runInNewContext(texto, e.contexto);
  return e;
}

async function esperar(evento) {
  let promesa;
  evento.waitUntil = (valor) => { promesa = valor; };
  return promesa;
}

const VERSION_PRUEBA = "abc123def456";
const TEXTO = swNormal({ version: VERSION_PRUEBA, precarga: RUTAS_PRECARGA });
const CACHE = `homesuite-pwa-${VERSION_PRUEBA}`;

describe("service worker (texto real de /sw.js, entorno simulado)", () => {
  it("instala: precarga toda la lista sin credenciales y toma el control", async () => {
    const e = await cargar({}, TEXTO);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    await instalacion;
    expect([...e.almacenes.get(CACHE).keys()].sort()).toEqual([...RUTAS_PRECARGA].sort());
    expect(e.llamadas.every((pedido) => pedido.init.credentials === "omit" && pedido.init.cache === "no-cache")).toBe(true);
    expect(e.estado().salto).toBe(true);
  });

  it.each([
    ["un 500", { respuesta: { status: 500 } }],
    ["un 404", { respuesta: { status: 404 } }],
    ["una respuesta opaca", { respuesta: { type: "opaque" } }],
    ["una respuesta de otro origen (cors)", { respuesta: { type: "cors" } }],
    ["una redirección", { respuesta: { redirected: true } }],
    ["Cache-Control: private", { control: "private, max-age=0" }],
    ["Cache-Control: no-store", { control: "no-store" }],
    ["Cache-Control: private, no-store", { control: "private, no-store" }],
  ])("la instalación falla y no deja caché si una ruta responde %s", async (_nombre, dato) => {
    const e = await cargar({ respuestas: { "/sin-conexion/remanso": dato } }, TEXTO);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    await expect(instalacion).rejects.toThrow(/Precarga rechazada/u);
    expect(e.almacenes.has(CACHE)).toBe(false);
    expect(e.estado().salto).toBe(false);
  });

  it("la instalación falla si la red falla", async () => {
    const e = await cargar({ red: false }, TEXTO);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    await expect(instalacion).rejects.toThrow();
    expect(e.almacenes.has(CACHE)).toBe(false);
  });

  it("acepta Cache-Control público y no-cache (es lo que sirven las páginas sin conexión)", async () => {
    const e = await cargar({ respuestas: { "/app.css": { control: "public, max-age=0, must-revalidate" } } }, TEXTO);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    await expect(instalacion).resolves.toBeUndefined();
  });

  it("el texto del service worker no habilita navigation preload ni lee preloadResponse", () => {
    expect(TEXTO).not.toMatch(/navigationPreload\.enable|preloadResponse/u);
    expect(TEXTO).toContain("navigationPreload.disable()");
  });

  it("activa: deshabilita navigation preload (nunca lo habilita), borra solo las homesuite-pwa-* viejas y toma el control", async () => {
    const e = await cargar({ cachesPrevias: ["homesuite-pwa-a", CACHE, "ajena"] }, TEXTO);
    let activacion;
    e.oyentes.activate({ waitUntil: (valor) => { activacion = valor; } });
    await activacion;
    expect([...e.almacenes.keys()].sort()).toEqual([CACHE, "ajena"].sort());
    expect(e.contexto.preloadDeshabilitado).toBe(true);
    expect(e.contexto.preloadHabilitado).toBeUndefined();
    expect(e.estado().reclamado).toBe(true);
  });

  async function pedido(e, { url, metodo = "GET", modo = "no-cors", rango = false, preload }) {
    let respondido;
    const evento = {
      request: { url: `${ORIGEN}${url}`, method: metodo, mode: modo, headers: { has: (nombre) => rango && nombre === "range" } },
      preloadResponse: Promise.resolve(preload),
      respondWith: (valor) => { respondido = valor; },
    };
    e.oyentes.fetch(evento);
    return respondido === undefined ? { interceptado: false } : { interceptado: true, respuesta: await respondido };
  }

  async function conCopias(opciones) {
    const e = await cargar(opciones, TEXTO);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    await instalacion;
    e.escrituras.length = 0;
    e.llamadas.length = 0;
    return e;
  }

  it.each([
    ["un POST", { url: "/groups/x/ledger", metodo: "POST" }],
    ["/auth/google", { url: "/auth/google", modo: "navigate" }],
    ["/auth/callback", { url: "/auth/callback?code=1&state=2", modo: "navigate" }],
    ["/api/me", { url: "/api/me" }],
    ["un pedido con Range", { url: "/remanso/remanso.js", rango: true }],
    ["el audio de Remanso", { url: "/remanso/audio/lluvia.v1.opus" }],
    ["/sw.js", { url: "/sw.js" }],
    ["un estático fuera de la lista", { url: "/profile.js" }],
    ["un estático de la lista con parámetros", { url: "/app.css?x=1" }],
  ])("no intercepta %s", async (_nombre, datos) => {
    const e = await conCopias({});
    expect((await pedido(e, datos)).interceptado).toBe(false);
    expect(e.llamadas).toEqual([]);
  });

  it("navegación con conexión: devuelve la respuesta del servidor tal cual y no la guarda", async () => {
    const e = await conCopias({});
    const { respuesta } = await pedido(e, { url: "/groups/x", modo: "navigate" });
    expect(respuesta.cuerpo).toBe("copia de /groups/x");
    expect(e.escrituras).toEqual([]);
  });

  it("navegación: ignora preloadResponse y pide una sola vez a la red", async () => {
    const e = await conCopias({});
    const { respuesta } = await pedido(e, { url: "/", modo: "navigate", preload: { cuerpo: "precargada" } });
    expect(respuesta.cuerpo).toBe("copia de /");
    expect(e.llamadas).toHaveLength(1);
  });

  it("un 404 o 500 del servidor se entrega tal cual, no la página sin conexión", async () => {
    for (const status of [404, 500]) {
      const e = await conCopias({ respuestas: { "/groups/x": { respuesta: { status } } } });
      const { respuesta } = await pedido(e, { url: "/groups/x", modo: "navigate" });
      expect(respuesta.status).toBe(status);
      expect(respuesta.cuerpo).toBe("copia de /groups/x");
    }
  });

  it.each([
    ["/jardin-zen", "/sin-conexion/jardin-zen"],
    ["/remanso", "/sin-conexion/remanso"],
    ["/cuentas-claras", "/sin-conexion"],
    ["/groups/x", "/sin-conexion"],
  ])("navegación sin red a %s sirve la copia de %s", async (ruta, copia) => {
    const e = await conCopias({});
    e.contexto.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const { respuesta } = await pedido(e, { url: ruta, modo: "navigate" });
    expect(respuesta.cuerpo).toBe(`copia de ${copia}`);
    expect(e.escrituras).toEqual([]);
  });

  it("un estático de la lista va primero a la red y solo sin red usa la copia; nunca escribe", async () => {
    const e = await conCopias({});
    e.contexto.fetch = async () => ({ status: 200, type: "basic", headers: { get: () => null }, cuerpo: "de la red" });
    expect((await pedido(e, { url: "/app.css" })).respuesta.cuerpo).toBe("de la red");
    e.contexto.fetch = async () => { throw new TypeError("Failed to fetch"); };
    expect((await pedido(e, { url: "/app.css" })).respuesta.cuerpo).toBe("copia de /app.css");
    expect(e.escrituras).toEqual([]);
  });

  it("sin red y sin copia la navegación falla como sin service worker (Response.error)", async () => {
    const e = await cargar({}, TEXTO);
    e.contexto.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const { respuesta } = await pedido(e, { url: "/", modo: "navigate" });
    expect(respuesta.error).toBe(true);
  });
});

describe("service worker apagado (texto real, entorno simulado)", () => {
  it("borra solo las cachés homesuite-pwa-*, se desregistra y no recarga pestañas", async () => {
    const e = entorno({ cachesPrevias: ["homesuite-pwa-a", "homesuite-pwa-b", "ajena"] });
    let desregistrado = false;
    e.contexto.self.registration = { unregister: async () => { desregistrado = true; } };
    vm.runInNewContext(swApagado(), e.contexto);
    expect(Object.keys(e.oyentes).sort()).toEqual(["activate", "install"]);
    let instalacion;
    e.oyentes.install({ waitUntil: (valor) => { instalacion = valor; } });
    expect(e.estado().salto).toBe(true);
    let activacion;
    e.oyentes.activate({ waitUntil: (valor) => { activacion = valor; } });
    await activacion;
    expect([...e.almacenes.keys()]).toEqual(["ajena"]);
    expect(desregistrado).toBe(true);
    expect(instalacion).toBeUndefined();
  });
});

describe("caracterización: lo que este cambio NO toca", () => {
  const CSP = "default-src 'self'; img-src 'self' https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests";

  it("SECURITY_HEADERS es idéntico al de la base (valor registrado el 2026-11-09, sin worker-src ni manifest-src)", async () => {
    const respuesta = await app.request(`${ORIGEN}/healthz`);
    expect(Object.fromEntries(["Content-Security-Policy", "Cross-Origin-Opener-Policy", "Permissions-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"].map((nombre) => [nombre, respuesta.headers.get(nombre)]))).toEqual({
      "Content-Security-Policy": CSP,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    expect(CSP).not.toMatch(/worker-src|manifest-src|Service-Worker-Allowed/u);
  });

  it("las rutas nuevas reciben exactamente los mismos encabezados de seguridad", async () => {
    const base = (await app.request(`${ORIGEN}/healthz`)).headers;
    for (const ruta of ["/sw.js", "/pwa.js", "/manifest.webmanifest", "/sin-conexion", "/sin-conexion/remanso", "/sin-conexion/jardin-zen"]) {
      const respuesta = await app.request(`${ORIGEN}${ruta}`);
      for (const nombre of ["Content-Security-Policy", "Cross-Origin-Opener-Policy", "Permissions-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"]) expect(respuesta.headers.get(nombre), `${ruta} ${nombre}`).toBe(base.get(nombre));
      expect(respuesta.headers.get("Service-Worker-Allowed"), ruta).toBeNull();
    }
  });

  it("apps/app/wrangler.jsonc no cambió (huella registrada el 2026-11-09)", () => {
    const huella = createHash("sha256").update(readFileSync(new URL("../wrangler.jsonc", import.meta.url))).digest("hex");
    expect(huella).toBe("5205324ac0a147addd04edd5e4c95b10bd33387d96feaa6ebb649275cb648a0b");
  });
});
