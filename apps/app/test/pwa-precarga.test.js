import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calcularPrecarga, PUBLIC_DIR, renderizarModulo, SALIDA } from "../../../scripts/homesuite-app-pwa-precache.mjs";
import { PRECACHE_PUBLIC } from "../src/pwa-precache.js";
import { RUTAS_PRECARGA } from "../src/pwa.js";

// La lista de precarga sale del disco (design.md, D3): si se agrega o cambia un archivo de public/jardin-zen o public/remanso sin
// regenerarla (npm run pwa:precache:homesuite-app), estas pruebas fallan.
async function archivos(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const anidados = await Promise.all(entradas.map((entrada) => entrada.isDirectory() ? archivos(path.join(directorio, entrada.name)) : [path.join(directorio, entrada.name)]));
  return anidados.flat();
}

describe("pwa-precache.js", () => {
  it("coincide con el disco: rutas y SHA-256 (falla si sobra, falta o cambió un archivo)", async () => {
    const delDisco = await calcularPrecarga(PUBLIC_DIR);
    expect(PRECACHE_PUBLIC).toEqual(delDisco);
  });

  it("el archivo generado es exactamente lo que produce el script", async () => {
    expect(await readFile(SALIDA, "utf8")).toBe(renderizarModulo(await calcularPrecarga(PUBLIC_DIR)));
  });

  it("lleva la marca de «generado, no editar»", async () => {
    expect(await readFile(SALIDA, "utf8")).toMatch(/^\/\/ GENERADO por scripts\/homesuite-app-pwa-precache\.mjs/u);
  });

  it("cubre todo public/jardin-zen y public/remanso salvo el audio, y el favicon", async () => {
    const esperadas = [];
    for (const carpeta of ["jardin-zen", "remanso"]) {
      for (const archivo of await archivos(path.join(PUBLIC_DIR, carpeta))) esperadas.push(`/${path.relative(PUBLIC_DIR, archivo).split(path.sep).join("/")}`);
    }
    const sinAudio = esperadas.filter((ruta) => !ruta.startsWith("/remanso/audio/"));
    expect(PRECACHE_PUBLIC.map((item) => item.ruta).sort()).toEqual([...sinAudio, "/icons/homesuite-favicon.v1.svg"].sort());
  });

  it("ninguna ruta está bajo /remanso/audio/", () => {
    expect(PRECACHE_PUBLIC.filter((item) => item.ruta.startsWith("/remanso/audio/"))).toEqual([]);
    expect(RUTAS_PRECARGA.filter((ruta) => ruta.startsWith("/remanso/audio/"))).toEqual([]);
  });

  it("las huellas son SHA-256 hexadecimales", () => {
    for (const { sha256 } of PRECACHE_PUBLIC) expect(sha256).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe("el script de precarga", () => {
  it("deja afuera el audio aunque exista (carpeta temporal de prueba)", async () => {
    const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(path.join(tmpdir(), "precarga-"));
    try {
      await mkdir(path.join(dir, "remanso/audio"), { recursive: true });
      await mkdir(path.join(dir, "jardin-zen"));
      await mkdir(path.join(dir, "icons"));
      await writeFile(path.join(dir, "remanso/audio/lluvia.v1.opus"), "x");
      await writeFile(path.join(dir, "remanso/remanso.js"), "1");
      await writeFile(path.join(dir, "jardin-zen/a.js"), "2");
      await writeFile(path.join(dir, "icons/homesuite-favicon.v1.svg"), "<svg/>");
      await writeFile(path.join(dir, "icons/homesuite-192.v1.png"), "png");
      await writeFile(path.join(dir, "_headers"), "h");
      const lista = await calcularPrecarga(dir);
      expect(lista.map((item) => item.ruta)).toEqual(["/icons/homesuite-favicon.v1.svg", "/jardin-zen/a.js", "/remanso/remanso.js"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("RUTAS_PRECARGA (lista completa de D3)", () => {
  it.each(["/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso", "/app.css", "/ledger-ui.js", "/split.js", "/text.js", "/shell.js", "/pwa.js", "/manifest.webmanifest", "/icons/homesuite-favicon.v1.svg", "/jardin-zen/jardin-zen.js", "/remanso/remanso.js"])("incluye %s", (ruta) => {
    expect(RUTAS_PRECARGA).toContain(ruta);
  });

  it.each(["/", "/remanso", "/jardin-zen", "/perfil", "/profile.js", "/classify.js", "/import-progress.js", "/cuentas-claras", "/tareas", "/sw.js"])("excluye %s", (ruta) => {
    expect(RUTAS_PRECARGA).not.toContain(ruta);
  });

  it("no tiene rutas repetidas ni bajo /api/, /auth/ o /groups/", () => {
    expect(new Set(RUTAS_PRECARGA).size).toBe(RUTAS_PRECARGA.length);
    expect(RUTAS_PRECARGA.filter((ruta) => /^\/(api|auth|groups)(\/|$)/u.test(ruta))).toEqual([]);
  });
});
