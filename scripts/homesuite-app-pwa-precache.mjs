#!/usr/bin/env node
// Genera apps/app/src/pwa-precache.js: la lista cerrada de archivos de apps/app/public/ que el service worker precarga, con la
// huella SHA-256 de cada uno. Entran jardin-zen/** y remanso/** (sin remanso/audio/**) y el favicon de la app; nada más.
// Uso: `npm run pwa:precache:homesuite-app` después de cambiar un archivo de esas carpetas. Una prueba
// (apps/app/test/pwa-precarga.test.js) falla si el archivo generado no coincide con el disco.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = path.join(RAIZ, "apps/app/public");
export const SALIDA = path.join(RAIZ, "apps/app/src/pwa-precache.js");

const CARPETAS = ["jardin-zen", "remanso"];
const EXCLUIDAS = ["remanso/audio/"];
const SUELTOS = ["icons/homesuite-favicon.v1.svg"];

async function archivos(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const anidados = await Promise.all(entradas.map((entrada) => entrada.isDirectory() ? archivos(path.join(directorio, entrada.name)) : [path.join(directorio, entrada.name)]));
  return anidados.flat();
}

export async function calcularPrecarga(publicDir = PUBLIC_DIR) {
  const relativos = new Set(SUELTOS);
  for (const carpeta of CARPETAS) {
    for (const archivo of await archivos(path.join(publicDir, carpeta))) relativos.add(path.relative(publicDir, archivo).split(path.sep).join("/"));
  }
  const elegidos = [...relativos].filter((relativo) => !EXCLUIDAS.some((prefijo) => relativo.startsWith(prefijo))).sort();
  return Promise.all(elegidos.map(async (relativo) => ({
    ruta: `/${relativo}`,
    sha256: createHash("sha256").update(await readFile(path.join(publicDir, relativo))).digest("hex"),
  })));
}

export function renderizarModulo(lista) {
  const filas = lista.map(({ ruta, sha256 }) => `  { ruta: ${JSON.stringify(ruta)}, sha256: ${JSON.stringify(sha256)} },`).join("\n");
  return `// GENERADO por scripts/homesuite-app-pwa-precache.mjs (npm run pwa:precache:homesuite-app). NO EDITAR A MANO.
// Archivos de apps/app/public/ que precarga el service worker, con su huella SHA-256. Sin remanso/audio/**.
export const PRECACHE_PUBLIC = Object.freeze([
${filas}
]);
`;
}

async function main() {
  const lista = await calcularPrecarga();
  await writeFile(SALIDA, renderizarModulo(lista));
  console.log(`pwa-precache.js: ${lista.length} archivos`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
