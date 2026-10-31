#!/usr/bin/env node
// Comprueba que el sitio público y la app cuenten lo mismo: las mismas herramientas con el mismo estado, enlaces a rutas que la app
// tiene, hacia el ambiente correcto, y que respondan; y que ninguna herramienta retirada reaparezca en el sitio ni en la app. Uso: `npm run verify:coherence:staging` o `...:production`, después de publicar
// la app y el sitio. La lógica pura (evaluarCoherencia) la prueba el CI contra el HTML del repositorio.
import { pathToFileURL } from "node:url";
import { HERRAMIENTAS, TASKING_URL } from "../apps/app/src/tools.js";

const ETIQUETA = { disponible: "Disponible", beta: "Versión Beta" };
const ENTORNOS = {
  production: { sitio: "https://homesuite.info", app: "https://app.homesuite.info", tasking: TASKING_URL.production },
  staging: { sitio: "https://site-staging.homesuite.info", app: "https://staging.homesuite.info", tasking: TASKING_URL.staging },
};
const RESPUESTAS_VALIDAS = [200, 301, 302, 303, 307, 308];
// Productos que no existen y no se nombran en ninguna parte (ni sitio ni app) hasta que existan. Compras: decisión del 2026-10-28.
const RETIRADAS = [{ nombre: "Compras", patron: /\bCompras\b|\/compras\b/u }];

export function urlsDelEntorno(entorno) {
  const urls = ENTORNOS[entorno];
  if (!urls) throw new Error(`Ambiente no habilitado: ${entorno}`);
  return urls;
}

function tarjetasDelSitio(home) {
  return [...home.matchAll(/<article class="tool-card[^"]*">([\s\S]*?)<\/article>/g)].map(([, cuerpo]) => {
    const enlace = cuerpo.match(/<a class="tool-link[^"]*" href="([^"]+)">\s*Conocé ([^\n<]+)/);
    return { nombre: enlace?.[2].trim(), landing: enlace?.[1], estado: cuerpo.match(/<span class="status[^"]*">([^<]+)<\/span>/)?.[1].trim() };
  });
}

const enlaces = (html, patron) => [...new Set([...html.matchAll(patron)].map((match) => match[1]))];

/**
 * @param {{ entorno: string, sitio: { home: string, landings: Record<string, string> }, appHome: string, sonda: (url: string) => number | Promise<number> }} datos
 * @returns {Promise<{ resultados: { ok: boolean, detalle: string }[], fallas: string[] }>}
 */
export async function evaluarCoherencia({ entorno, sitio, appHome, sonda }) {
  const urls = urlsDelEntorno(entorno);
  const resultados = [];
  const verificar = (ok, detalle) => resultados.push({ ok: Boolean(ok), detalle });

  const tarjetas = tarjetasDelSitio(sitio.home);
  const delSitio = tarjetas.map((tarjeta) => tarjeta.nombre);
  const delaApp = HERRAMIENTAS.map((tool) => tool.nombre);
  verificar(delSitio.join("|") === delaApp.join("|"), `herramientas del sitio [${delSitio.join(", ")}] frente a las de la app [${delaApp.join(", ")}]`);

  for (const tool of HERRAMIENTAS) {
    const tarjeta = tarjetas.find((candidata) => candidata.nombre === tool.nombre);
    const esperado = ETIQUETA[tool.estado];
    verificar(tarjeta?.estado === esperado, `${tool.nombre}: estado en el sitio «${tarjeta?.estado}», en la app «${esperado}»`);
    const landing = sitio.landings[tool.ruta.slice(1)];
    verificar(tarjeta?.landing === tool.ruta && landing, `${tool.nombre}: la tarjeta lleva a ${tarjeta?.landing} y la landing ${tool.ruta} ${landing ? "existe" : "no existe"}`);
    // La landing ofrece la entrada: TasKing a su Worker; las herramientas de la app, a su ruta en el ambiente.
    const entrada = tool.id === "tasks" ? urls.tasking : `${urls.app}${tool.ruta}`;
    verificar(landing?.includes(`href="${entrada}`), `${tool.nombre}: la landing ofrece la entrada ${entrada}`);
    verificar(appHome.includes(`href="${tool.ruta}"`), `${tool.nombre}: aparece en el inicio de la app (${tool.ruta})`);
  }

  const paginas = [sitio.home, ...Object.values(sitio.landings)].join("\n");
  const haciaLaApp = enlaces(paginas, /href="(https:\/\/(?:app|staging)\.homesuite\.info[^"]*)"/g);
  for (const url of haciaLaApp) {
    if (!url.startsWith(urls.app)) { verificar(false, `enlace a la app de otro ambiente: ${url}`); continue; }
    const ruta = url.slice(urls.app.length);
    const tool = HERRAMIENTAS.find((candidata) => candidata.ruta === ruta);
    verificar(tool, `enlace del sitio a ${url}: ${tool ? "la app la tiene" : `la app no tiene la ruta ${ruta}`}`);
    const estado = await sonda(url);
    verificar(RESPUESTAS_VALIDAS.includes(estado), `${url} responde ${estado}`);
  }

  // Producción nunca apunta a staging: ni un enlace del sitio ni de la app (los comentarios HTML no se ven y no cuentan).
  if (entorno === "production") {
    const visible = `${paginas}\n${appHome}`.replace(/<!--[\s\S]*?-->/g, "");
    verificar(!/staging/iu.test(visible), `producción no menciona hosts de staging${/staging/iu.test(visible) ? `: ${[...new Set(visible.match(/https?:\/\/[^\s"'<>]*staging[^\s"'<>]*/giu) ?? [])].join(", ")}` : ""}`);
  }

  for (const retirada of RETIRADAS) {
    verificar(!retirada.patron.test(paginas), `${retirada.nombre} no se nombra en el sitio público`);
    verificar(!retirada.patron.test(appHome), `${retirada.nombre} no se nombra en el inicio de la app`);
  }

  const haciaTasKing = enlaces(paginas, /href="(https:\/\/tas-king[a-z-]*\.pablotortorella\.workers\.dev[^"]*)"/g);
  verificar(haciaTasKing.length > 0, "el sitio enlaza a TasKing");
  for (const url of haciaTasKing) {
    verificar(url === urls.tasking, `enlace del sitio a TasKing ${url}${url === urls.tasking ? "" : ` (este ambiente espera ${urls.tasking})`}`);
    verificar(RESPUESTAS_VALIDAS.includes(await sonda(url)), `${url} responde`);
  }

  return { resultados, fallas: resultados.filter((resultado) => !resultado.ok).map((resultado) => resultado.detalle) };
}

async function main(entorno) {
  const urls = urlsDelEntorno(entorno);
  const leer = async (url) => {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`${url} respondió ${respuesta.status}`);
    return respuesta.text();
  };
  const sitio = { home: await leer(`${urls.sitio}/`), landings: {} };
  for (const slug of ["tareas", "cuentas-claras", "remanso", "jardin-zen"]) sitio.landings[slug] = await leer(`${urls.sitio}/${slug}`);
  const appHome = await leer(`${urls.app}/`);
  const sonda = async (url) => (await fetch(url, { redirect: "manual" })).status;
  const { resultados, fallas } = await evaluarCoherencia({ entorno, sitio, appHome, sonda });
  for (const { ok, detalle } of resultados) console.log(`${ok ? "OK  " : "FALLA"} ${detalle}`);
  console.log(fallas.length ? `\n${fallas.length} comprobación(es) fallaron en ${entorno}.` : `\nSitio y app coherentes en ${entorno} (${resultados.length} comprobaciones).`);
  process.exitCode = fallas.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] ?? "").catch((error) => { console.error(error.message); process.exitCode = 1; });
}
