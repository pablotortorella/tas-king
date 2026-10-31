import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderTools } from "../../app/src/tools.js";
import { evaluarCoherencia, urlsDelEntorno } from "../../../scripts/homesuite-coherencia.mjs";

// Coherencia entre lo que anuncia el sitio público y lo que ofrece la app: mismas herramientas, mismo estado, enlaces a rutas que
// existen y al ambiente correcto. La misma lógica corre contra lo publicado con `npm run verify:coherence:<ambiente>`.
const leer = (name) => readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
const sitioDelRepositorio = async () => ({
  home: await leer("index"),
  landings: { tareas: await leer("tareas"), "cuentas-claras": await leer("cuentas-claras"), remanso: await leer("remanso"), "jardin-zen": await leer("jardin-zen") },
});
const responden = () => 200;
const evaluar = async (cambios = {}, entorno = "production") => evaluarCoherencia({ entorno, sitio: await sitioDelRepositorio(), appHome: renderTools(), sonda: responden, ...cambios });
const aStaging = (html) => html.replaceAll("https://app.homesuite.info", "https://staging.homesuite.info").replaceAll("https://tas-king.pablotortorella.workers.dev", "https://tas-king-staging.pablotortorella.workers.dev");

describe("coherencia entre el sitio público y la app", () => {
  it("el sitio del repositorio es coherente con la app de producción", async () => {
    const { fallas, resultados } = await evaluar();
    expect(fallas).toEqual([]);
    expect(resultados.length).toBeGreaterThanOrEqual(10);
  });

  it("lo que publica el worker de staging es coherente con la app de staging, y no con la de producción", async () => {
    const sitio = await sitioDelRepositorio();
    const enStaging = { home: aStaging(sitio.home), landings: Object.fromEntries(Object.entries(sitio.landings).map(([slug, html]) => [slug, aStaging(html)])) };
    expect((await evaluar({ sitio: enStaging }, "staging")).fallas).toEqual([]);
    expect((await evaluar({ sitio: enStaging }, "production")).fallas.length).toBeGreaterThan(0);
    expect((await evaluar({}, "staging")).fallas.length).toBeGreaterThan(0);
  });

  it("detecta una herramienta del sitio que la app no tiene", async () => {
    const sitio = await sitioDelRepositorio();
    const { fallas } = await evaluar({ sitio: { ...sitio, home: sitio.home.replaceAll("Conocé Remanso", "Conocé Meditación") } });
    expect(fallas.join("\n")).toMatch(/Remanso|Meditación/);
  });

  it("detecta un estado distinto entre el sitio y la app", async () => {
    const sitio = await sitioDelRepositorio();
    const home = sitio.home.replace(/class="status">Versión Beta<\/span>/, 'class="status status-available">Disponible</span>');
    expect((await evaluar({ sitio: { ...sitio, home } })).fallas.join("\n")).toMatch(/estado/i);
  });

  it("detecta un enlace a una ruta que la app no tiene", async () => {
    const sitio = await sitioDelRepositorio();
    const landings = { ...sitio.landings, remanso: sitio.landings.remanso.replace("app.homesuite.info/remanso", "app.homesuite.info/meditacion") };
    expect((await evaluar({ sitio: { ...sitio, landings } })).fallas.join("\n")).toMatch(/meditacion/);
  });

  it("detecta que Compras reaparece, en el sitio o en el inicio de la app", async () => {
    const sitio = await sitioDelRepositorio();
    const conCompras = { ...sitio, landings: { ...sitio.landings, tareas: sitio.landings.tareas.replace("También en HomeSuite", "Compras · También en HomeSuite") } };
    expect((await evaluar({ sitio: conCompras })).fallas.join("\n")).toMatch(/Compras/);
    expect((await evaluar({ appHome: `${renderTools()}<a href="/compras">Compras</a>` })).fallas.join("\n")).toMatch(/Compras/);
  });

  it("detecta el TasKing de otro ambiente", async () => {
    const sitio = await sitioDelRepositorio();
    const landings = { ...sitio.landings, tareas: sitio.landings.tareas.replace("https://tas-king.pablotortorella.workers.dev", "https://tas-king-staging.pablotortorella.workers.dev") };
    expect((await evaluar({ sitio: { ...sitio, landings } })).fallas.join("\n")).toMatch(/TasKing/);
  });

  it("detecta que la app no responde en la ruta a la que lleva el sitio", async () => {
    const { fallas } = await evaluar({ sonda: (url) => (url.endsWith("/cuentas-claras") ? 404 : 200) });
    expect(fallas.join("\n")).toMatch(/cuentas-claras.*404/);
  });

  it("detecta una herramienta del sitio que falta en el inicio de la app", async () => {
    const appHome = renderTools().replace('<a class="tool-card tool-card-calm" href="/remanso">', '<a class="tool-card" href="/otra">');
    expect((await evaluar({ appHome })).fallas.join("\n")).toMatch(/inicio de la app/);
  });

  it("en producción, ni el sitio ni la app pueden mencionar hosts de staging (los comentarios HTML no cuentan)", async () => {
    const sitio = await sitioDelRepositorio();
    expect((await evaluar()).fallas).toEqual([]);
    const conEnlace = { ...sitio, home: sitio.home.replace("https://app.homesuite.info/remanso", "https://staging.homesuite.info/remanso") };
    expect((await evaluar({ sitio: conEnlace })).fallas.join("\n")).toMatch(/staging/);
    expect((await evaluar({ appHome: `${renderTools()}<a href="https://tas-king-staging.pablotortorella.workers.dev">TasKing</a>` })).fallas.join("\n")).toMatch(/staging/);
    const soloComentario = { ...sitio, home: `${sitio.home}<!-- staging-app-entry -->` };
    expect((await evaluar({ sitio: soloComentario })).fallas).toEqual([]);
  });

  it("las URL de cada ambiente", () => {
    expect(urlsDelEntorno("production")).toMatchObject({ sitio: "https://homesuite.info", app: "https://app.homesuite.info", tasking: "https://tas-king.pablotortorella.workers.dev" });
    expect(urlsDelEntorno("staging")).toMatchObject({ sitio: "https://site-staging.homesuite.info", app: "https://staging.homesuite.info", tasking: "https://tas-king-staging.pablotortorella.workers.dev" });
    expect(() => urlsDelEntorno("otro")).toThrow(/Ambiente/);
  });
});
