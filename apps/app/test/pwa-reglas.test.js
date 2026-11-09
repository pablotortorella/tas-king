import { describe, expect, it } from "vitest";
import { cachesABorrar, calcularVersion, decidirPedido, paginaSinConexion, RUTAS_PRECARGA } from "../src/pwa.js";

// Reglas puras del service worker (design.md, D2, D3 y D6). Las mismas funciones viajan dentro de /sw.js con su propio texto.
const base = { metodo: "GET", modo: "no-cors", mismoOrigen: true, ruta: "/x", busqueda: "", conRange: false };
const pedido = (cambios) => ({ ...base, ...cambios });

describe("decidirPedido", () => {
  it.each([
    ["POST de un formulario", { metodo: "POST", ruta: "/groups/x/ledger" }, "red"],
    ["POST aunque la ruta esté en la lista", { metodo: "POST", ruta: "/app.css" }, "red"],
    ["HEAD", { metodo: "HEAD", ruta: "/app.css" }, "red"],
    ["otro origen", { mismoOrigen: false, ruta: "/app.css" }, "red"],
    ["otro origen en una navegación", { mismoOrigen: false, modo: "navigate", ruta: "/" }, "red"],
    ["/auth/google", { ruta: "/auth/google" }, "red"],
    ["/auth/callback", { ruta: "/auth/callback", busqueda: "?code=1&state=2" }, "red"],
    ["/auth/google como navegación", { modo: "navigate", ruta: "/auth/google" }, "red"],
    ["/auth/callback como navegación", { modo: "navigate", ruta: "/auth/callback" }, "red"],
    ["/api/me", { ruta: "/api/me" }, "red"],
    ["/api/me como navegación", { modo: "navigate", ruta: "/api/me" }, "red"],
    ["con Range, aunque esté en la lista", { ruta: "/remanso/remanso.js", conRange: true }, "red"],
    ["el audio de Remanso", { ruta: "/remanso/audio/lluvia.v1.opus" }, "red"],
    ["el audio de Remanso como navegación", { modo: "navigate", ruta: "/remanso/audio/lluvia.v1.opus" }, "red"],
    ["/sw.js", { ruta: "/sw.js" }, "red"],
    ["/sw.js como navegación", { modo: "navigate", ruta: "/sw.js" }, "red"],
    ["navegación a /", { modo: "navigate", ruta: "/" }, "navegacion"],
    ["navegación a una página de un grupo", { modo: "navigate", ruta: "/groups/x" }, "navegacion"],
    ["navegación a /jardin-zen", { modo: "navigate", ruta: "/jardin-zen" }, "navegacion"],
    ["navegación con parámetros de búsqueda", { modo: "navigate", ruta: "/perfil", busqueda: "?guardado=1" }, "navegacion"],
    ["GET /app.css", { ruta: "/app.css" }, "precarga"],
    ["GET /app.css?x=1 (con parámetros)", { ruta: "/app.css", busqueda: "?x=1" }, "red"],
    ["GET /profile.js (fuera de la lista)", { ruta: "/profile.js" }, "red"],
    ["GET /classify.js (fuera de la lista)", { ruta: "/classify.js" }, "red"],
    ["GET de un módulo de Remanso", { ruta: "/remanso/remanso-engine.js" }, "precarga"],
    ["GET de un ícono PNG (no está en la lista)", { ruta: "/icons/homesuite-192.v1.png" }, "red"],
    ["GET de cualquier otra ruta del mismo origen", { ruta: "/groups/x/ledger/export.json" }, "red"],
  ])("%s -> %s", (_nombre, cambios, esperado) => {
    expect(decidirPedido(pedido(cambios), RUTAS_PRECARGA)).toBe(esperado);
  });

  it("la lista de precarga se pasa como parámetro: con otra lista cambia lo que va a la caché", () => {
    expect(decidirPedido(pedido({ ruta: "/otra.js" }), ["/otra.js"])).toBe("precarga");
    expect(decidirPedido(pedido({ ruta: "/app.css" }), [])).toBe("red");
  });

  it("ninguna ruta de la lista de precarga se decide como «red» con un GET simple", () => {
    for (const ruta of RUTAS_PRECARGA) expect(decidirPedido(pedido({ ruta }), RUTAS_PRECARGA), ruta).toBe("precarga");
  });

  it("no depende de nada fuera de sí misma (se incrusta en /sw.js con su texto)", () => {
    const texto = decidirPedido.toString();
    expect(texto).not.toMatch(/\bimport\b|\brequire\b/u);
    const aislada = new Function(`const __name = (t) => t; return (${texto});`)();
    expect(aislada(pedido({ ruta: "/app.css" }), ["/app.css"])).toBe("precarga");
  });
});

describe("paginaSinConexion", () => {
  it.each([
    ["/jardin-zen", "/sin-conexion/jardin-zen"],
    ["/jardin-zen/", "/sin-conexion/jardin-zen"],
    ["/remanso", "/sin-conexion/remanso"],
    ["/remanso/", "/sin-conexion/remanso"],
    ["/cuentas-claras", "/sin-conexion"],
    ["/", "/sin-conexion"],
    ["/groups/x", "/sin-conexion"],
    ["/perfil", "/sin-conexion"],
    ["/remanso-otra", "/sin-conexion"],
  ])("%s -> %s", (ruta, esperada) => {
    expect(paginaSinConexion(ruta)).toBe(esperada);
  });

  it("devuelve rutas que están en la lista de precarga", () => {
    for (const ruta of ["/", "/remanso", "/jardin-zen", "/x"]) expect(RUTAS_PRECARGA).toContain(paginaSinConexion(ruta));
  });
});

describe("cachesABorrar", () => {
  it("borra solo las homesuite-pwa-* de otras versiones", () => {
    const nombres = ["homesuite-pwa-a", "homesuite-pwa-b", "workbox-precache", "homesuite-pwa", "otra-homesuite-pwa-c", "HOMESUITE-PWA-d"];
    expect(cachesABorrar(nombres, "homesuite-pwa-b")).toEqual(["homesuite-pwa-a"]);
  });

  it("sin cachés viejas no borra nada", () => {
    expect(cachesABorrar(["homesuite-pwa-b", "ajena"], "homesuite-pwa-b")).toEqual([]);
    expect(cachesABorrar([], "homesuite-pwa-b")).toEqual([]);
  });
});

describe("calcularVersion", () => {
  const partes = () => ({
    sw: "texto del service worker",
    huellas: [{ ruta: "/remanso/remanso.js", sha256: "a".repeat(64) }, { ruta: "/jardin-zen/jardin-zen.js", sha256: "b".repeat(64) }],
    cadenas: { "/app.css": "body{}", "/shell.js": "1+1" },
    paginas: { "/sin-conexion": "<html>genérica</html>", "/sin-conexion/remanso": "<html>remanso</html>" },
  });

  it("son 12 caracteres hexadecimales", async () => {
    expect(await calcularVersion(partes())).toMatch(/^[0-9a-f]{12}$/u);
  });

  it("no cambia si no cambia nada", async () => {
    expect(await calcularVersion(partes())).toBe(await calcularVersion(partes()));
  });

  it.each([
    ["una huella de public/", (p) => { p.huellas[0].sha256 = "c".repeat(64); }],
    ["un archivo nuevo en public/", (p) => { p.huellas.push({ ruta: "/remanso/nuevo.js", sha256: "d".repeat(64) }); }],
    ["una cadena del Worker precargada", (p) => { p.cadenas["/app.css"] = "body{color:red}"; }],
    ["una página sin conexión", (p) => { p.paginas["/sin-conexion/remanso"] = "<html>otra</html>"; }],
    ["el texto del service worker", (p) => { p.sw += " "; }],
  ])("cambia si cambia %s", async (_nombre, modificar) => {
    const cambiada = partes();
    modificar(cambiada);
    expect(await calcularVersion(cambiada)).not.toBe(await calcularVersion(partes()));
  });

  it("no depende del orden en que se declaran las rutas", async () => {
    const a = partes();
    const b = partes();
    b.huellas.reverse();
    b.cadenas = Object.fromEntries(Object.entries(b.cadenas).reverse());
    expect(await calcularVersion(b)).toBe(await calcularVersion(a));
  });
});
