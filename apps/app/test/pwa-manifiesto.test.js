import { TASKING_DOCUMENT } from "../src/tasking/document.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { manifiesto } from "../src/pwa.js";
import { LIGHT } from "../src/theme.js";
import { alfas, leerPng } from "./helpers/png.js";

const publicDir = path.join(import.meta.dirname, "../public");
const pedir = (host) => app.request(`https://${host}/manifest.webmanifest`);

describe("manifiesto web", () => {
  it("en producción: id, start_url y scope «/», standalone y nombre «HomeSuite»", async () => {
    const respuesta = await pedir("app.homesuite.info");
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", name: "HomeSuite", short_name: "HomeSuite", lang: "es" });
  });

  it.each(["staging.homesuite.info", "localhost", "homesuite-app-staging.example.workers.dev"])("en %s el nombre identifica a staging", async (host) => {
    const datos = await (await pedir(host)).json();
    expect(datos.name).toBe("HomeSuite (staging)");
    expect(datos.short_name).toBe("HomeSuite staging");
    expect(datos.name).not.toBe("HomeSuite");
  });

  it.each(["app.homesuite.info", "staging.homesuite.info", "localhost"])("en %s ninguna URL es absoluta ni nombra un host", async (host) => {
    const texto = await (await pedir(host)).text();
    expect(texto).not.toMatch(/https?:|homesuite\.info|\/\//u);
    const datos = JSON.parse(texto);
    for (const url of [datos.id, datos.start_url, datos.scope, ...datos.icons.map((icono) => icono.src)]) expect(url).toMatch(/^\/(?!\/)/u);
  });

  it("los colores son el fondo de la paleta clara de theme.js", () => {
    const datos = manifiesto("app.homesuite.info");
    expect(datos.theme_color).toBe(LIGHT.bg);
    expect(datos.background_color).toBe(LIGHT.bg);
  });

  it("responde application/manifest+json con caché de una hora y las cabeceras comunes", async () => {
    const respuesta = await pedir("app.homesuite.info");
    expect(respuesta.headers.get("Content-Type")).toBe("application/manifest+json");
    expect(respuesta.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(respuesta.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  it("declara íconos de 192 y 512 «any» y «maskable»", () => {
    const iconos = manifiesto("app.homesuite.info").icons.map((icono) => `${icono.sizes}:${icono.purpose}`);
    expect(iconos.sort()).toEqual(["192x192:any", "192x192:maskable", "512x512:any", "512x512:maskable"]);
  });
});

describe("íconos", () => {
  const declarados = manifiesto("app.homesuite.info").icons;

  it.each(declarados.map((icono) => [icono.src, icono]))("%s existe, es PNG y mide lo que declara", async (src, icono) => {
    const png = leerPng(await readFile(path.join(publicDir, src)));
    expect(`${png.ancho}x${png.alto}`).toBe(icono.sizes);
    expect(icono.type).toBe("image/png");
  });

  it("el apple-touch-icon enlazado existe, mide 180x180 y es opaco", async () => {
    const html = await (await app.request("https://app.homesuite.info/")).text();
    const href = /<link rel="apple-touch-icon" sizes="180x180" href="([^"]+)">/u.exec(html)?.[1];
    expect(href).toBe("/icons/homesuite-apple-touch-180.v1.png");
    const png = leerPng(await readFile(path.join(publicDir, href)));
    expect([png.ancho, png.alto]).toEqual([180, 180]);
    expect([...new Set(alfas(png))]).toEqual([255]);
  });

  it.each(["homesuite-maskable-192.v1.png", "homesuite-maskable-512.v1.png"])("%s es un cuadrado lleno (opaco hasta las esquinas)", async (archivo) => {
    expect([...new Set(alfas(leerPng(await readFile(path.join(publicDir, "icons", archivo)))))]).toEqual([255]);
  });

  it.each(["homesuite-192.v1.png", "homesuite-512.v1.png"])("%s conserva la transparencia del favicon (esquinas transparentes)", async (archivo) => {
    const png = leerPng(await readFile(path.join(publicDir, "icons", archivo)));
    expect(alfas(png)[0]).toBe(0);
  });

  it("el favicon SVG de la app es idéntico al del sitio", async () => {
    const sitio = await readFile(path.join(import.meta.dirname, "../../site/public/HomeSuite-favicon-simplificado.svg"));
    expect((await readFile(path.join(publicDir, "icons/homesuite-favicon.v1.svg"))).equals(sitio)).toBe(true);
  });
});

describe("cabeza común de las páginas", () => {
  it.each(["/", "/auth/google", "/sin-conexion", "/jardin-zen", "/remanso"])("%s enlaza manifiesto, favicon, apple-touch-icon y /pwa.js del mismo origen", async (ruta) => {
    const html = await (await app.request(`https://app.homesuite.info${ruta}`)).text();
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/icons/homesuite-favicon.v1.svg">');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/icons/homesuite-apple-touch-180.v1.png">');
    expect(html).toContain('<script src="/pwa.js" defer></script>');
  });
});

describe('Tareas integrada en la PWA',()=>{
 it('mantiene el manifiesto e icono Apple de la suite y usa su propio favicon',()=>{
  expect(TASKING_DOCUMENT).toContain('href="/manifest.webmanifest"');
  expect(TASKING_DOCUMENT).toContain('href="/icons/homesuite-apple-touch-180.v1.png"');
  expect(TASKING_DOCUMENT).toContain('href="/tareas/favicon.v1.svg"');
  expect(TASKING_DOCUMENT).toContain('src="/pwa.js"');
 });
});
