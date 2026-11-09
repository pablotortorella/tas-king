#!/usr/bin/env node
// Genera los íconos de instalación de HomeSuite App a partir del favicon simplificado vigente del sitio, sin tocar su dibujo ni su
// paleta. Uso: `npm run pwa:iconos:homesuite-app` (necesita el Chromium de Playwright; si la versión del lockfile no encuentra el
// navegador instalado, `CHROMIUM_PATH=/ruta/a/chromium npm run pwa:iconos:homesuite-app`). Los PNG se versionan en
// apps/app/public/icons/ con el número de versión en el nombre; si cambia un ícono, subir la versión (.v2) y el manifiesto.
//
//   homesuite-192/512.v1.png            «any»: el favicon tal cual, fondo transparente
//   homesuite-maskable-192/512.v1.png   «maskable»: cuadrado lleno con el degradado del propio favicon y el dibujo al 80 %
//   homesuite-apple-touch-180.v1.png    lo mismo, opaco (iOS rellena la transparencia por su cuenta)
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FUENTE = path.join(RAIZ, "apps/site/public/HomeSuite-favicon-simplificado.svg");
export const DESTINO = path.join(RAIZ, "apps/app/public/icons");
export const FAVICON = "homesuite-favicon.v1.svg";
// Colores del degradado de fondo del favicon (#fondo): se leen del SVG para no copiarlos a mano.
export const ESCALA_SEGURA = 0.8;

export const ICONOS = Object.freeze([
  { archivo: "homesuite-192.v1.png", tamano: 192, tipo: "any" },
  { archivo: "homesuite-512.v1.png", tamano: 512, tipo: "any" },
  { archivo: "homesuite-maskable-192.v1.png", tamano: 192, tipo: "maskable" },
  { archivo: "homesuite-maskable-512.v1.png", tamano: 512, tipo: "maskable" },
  { archivo: "homesuite-apple-touch-180.v1.png", tamano: 180, tipo: "apple" },
]);

function colorDeFondo(svg) {
  const degradado = /<linearGradient id="fondo"[^>]*>\s*<stop stop-color="(#[0-9a-f]{6})"\/>\s*<stop offset="1" stop-color="(#[0-9a-f]{6})"\/>/iu.exec(svg);
  if (!degradado) throw new Error("No se encontró el degradado «fondo» en el favicon.");
  return { desde: degradado[1], hasta: degradado[2] };
}

// El SVG del favicon va tal cual dentro de un <img> (data URI); el contenedor sólo decide fondo y escala.
export function documento({ svg, tamano, tipo }) {
  const dibujo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const { desde, hasta } = colorDeFondo(svg);
  const lleno = tipo !== "any";
  const lado = lleno ? Math.round(tamano * ESCALA_SEGURA) : tamano;
  const fondo = lleno ? `background:linear-gradient(160deg,${desde},${hasta});` : "background:transparent;";
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}body{width:${tamano}px;height:${tamano}px;${fondo}display:flex;align-items:center;justify-content:center;overflow:hidden}img{width:${lado}px;height:${lado}px;display:block}</style><body><img src="${dibujo}" width="${lado}" height="${lado}" alt=""></body>`;
}

async function generar() {
  const { chromium } = await import("playwright");
  const svg = await readFile(FUENTE, "utf8");
  await mkdir(DESTINO, { recursive: true });
  await copyFile(FUENTE, path.join(DESTINO, FAVICON));
  const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const icono of ICONOS) {
      const pagina = await navegador.newPage({ viewport: { width: icono.tamano, height: icono.tamano }, deviceScaleFactor: 1 });
      await pagina.setContent(documento({ svg, ...icono }));
      await pagina.waitForFunction(() => document.images[0].complete);
      const png = await pagina.screenshot({ omitBackground: icono.tipo === "any", type: "png" });
      await writeFile(path.join(DESTINO, icono.archivo), png);
      await pagina.close();
      console.log(`${icono.archivo} (${icono.tamano}×${icono.tamano}, ${icono.tipo})`);
    }
  } finally {
    await navegador.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await generar();
