import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { htmlSinConexion } from "../src/pwa.js";
import { ACCOUNT_MARKER, ACCOUNT_MENU_MARKER, GROUP_MARKER, GROUP_MENU_MARKER, renderPage } from "../src/ui-parts.js";
import { expectCleanDocument } from "./helpers/documento.js";

const ORIGEN = "https://staging.homesuite.info";
const MARCAS = [ACCOUNT_MARKER, ACCOUNT_MENU_MARKER, GROUP_MARKER, GROUP_MENU_MARKER];
const RUTAS = ["/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso"];

describe("renderPage con cuenta: false", () => {
  it("no incluye ninguna de las cuatro marcas de cuenta y grupo", () => {
    const html = renderPage("Prueba", "<p>hola</p>", { cuenta: false });
    for (const marca of MARCAS) expect(html).not.toContain(marca);
    expect(html).toContain('<a href="/">Inicio</a><a href="/groups">Mis grupos</a>');
  });

  it("por omisión conserva las marcas (las páginas con sesión no cambian)", () => {
    const html = renderPage("Prueba", "<p>hola</p>");
    for (const marca of MARCAS) expect(html).toContain(marca);
  });

  it("no incluye marcas ni con grupo (tabbar) cuando se pide sin cuenta", () => {
    for (const marca of MARCAS) expect(renderPage("Prueba", "x", { cuenta: false, groupHref: "/groups/x" })).not.toContain(marca);
  });
});

describe.each(RUTAS)("%s", (ruta) => {
  it("responde una página limpia, sin marcas de cuenta, sin código ni estilos incrustados", async () => {
    const respuesta = await app.request(`${ORIGEN}${ruta}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Content-Type")).toContain("text/html");
    const html = await respuesta.text();
    for (const marca of MARCAS) expect(html).not.toContain(marca);
    expect(html).not.toContain("_csrf");
    expectCleanDocument(html);
  });

  it("lleva Cache-Control: no-cache, la política de contenido y no establece cookies", async () => {
    const respuesta = await app.request(`${ORIGEN}${ruta}`);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-cache");
    expect(respuesta.headers.get("Content-Security-Policy")).toContain("script-src 'self'; style-src 'self'");
    expect(respuesta.headers.get("X-Frame-Options")).toBe("DENY");
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("/sin-conexion (genérica)", () => {
  it("ofrece «Reintentar» sin JavaScript (href vacío) y enlaces a Jardín Zen y Remanso", async () => {
    const html = await (await app.request(`${ORIGEN}/sin-conexion`)).text();
    expect(html).toContain("<h1>Sin conexión</h1>");
    expect(html).toMatch(/<a class="button" href="">Reintentar<\/a>/u);
    expect(html).toContain('href="/jardin-zen"');
    expect(html).toContain('href="/remanso"');
  });

  it("es la misma que genera htmlSinConexion (la que entra en la versión)", async () => {
    expect(await (await app.request(`${ORIGEN}/sin-conexion`)).text()).toBe(htmlSinConexion());
  });
});

describe("/sin-conexion/jardin-zen", () => {
  it("trae la escena de Jardín Zen y sus recursos", async () => {
    const html = await (await app.request(`${ORIGEN}/sin-conexion/jardin-zen`)).text();
    expect(html).toContain('id="jardin-zen"');
    expect(html).toContain("/jardin-zen/jardin-zen.css");
    expect(html).toContain("/jardin-zen/jardin-zen.js");
  });
});

describe("/sin-conexion/remanso", () => {
  const CON_GOOGLE = { GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s", SESSION_SECRET: "s".repeat(32) };

  it("sale con el nivel sin cuenta y el aviso de que no hay conexión", async () => {
    const html = await (await app.request(`${ORIGEN}/sin-conexion/remanso`, {}, CON_GOOGLE)).text();
    expect(html).toContain('data-acceso="libre"');
    expect(html).not.toContain("data-nombre=");
    expect(html).toContain("Sin conexión: se muestran las opciones sin cuenta.");
    expect(html).toContain("Si ya entraste, tu sesión sigue abierta: cuando vuelva la conexión, recargá para ver todo.");
    expect(html).toContain('data-libre-fondos="silencio,agua,bosque"');
    expect(html).toContain("/remanso/remanso.js");
  });

  it("no ofrece entrar con Google: sin conexión ese enlace no puede funcionar, aunque el ambiente lo tenga configurado", async () => {
    for (const env of [CON_GOOGLE, undefined]) {
      const html = await (await app.request(`${ORIGEN}/sin-conexion/remanso`, {}, env)).text();
      expect(html).not.toContain("data-login=");
      expect(html).not.toContain("Continuar con Google");
    }
  });
});
