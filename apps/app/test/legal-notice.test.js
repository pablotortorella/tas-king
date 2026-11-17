import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

// Toda pantalla pública que ofrezca «Continuar con Google» lleva el aviso de aceptación con los dos enlaces (design.md, D6). La prueba
// recorre las pantallas sin sesión y falla si alguna contiene un enlace a /auth/google sin el aviso. Las rutas que sin sesión redirigen
// directo a Google (/cuentas-claras, /invitations, /perfil, /groups) no muestran una pantalla: la persona vuelve sin aceptación
// registrada y la puerta de nueva aceptación se la pide (ver legal.integration.test.js).
const ORIGIN = "https://app.homesuite.info";
const ENV = { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", SESSION_SECRET: "s".repeat(32) };

const PUBLIC_PATHS = ["/", "/tareas", "/remanso", "/jardin-zen", "/cuentas-claras", "/invitations", "/perfil", "/groups", "/groups/new", "/auth/google", "/demo/crear-grupo"];

async function visit(path, env = ENV) {
  const response = await app.request(`${ORIGIN}${path}`, { redirect: "manual" }, env);
  return { status: response.status, location: response.headers.get("location"), body: response.headers.get("content-type")?.includes("text/html") ? await response.text() : "" };
}

describe("aviso de aceptación en las pantallas de acceso", () => {
  it.each(PUBLIC_PATHS)("%s: si ofrece «Continuar con Google» lo hace con el aviso y los dos enlaces", async (path) => {
    const { body } = await visit(path);
    if (!body.includes('href="/auth/google') && !body.includes("/auth/google")) return;
    expect(body, `aviso en ${path}`).toContain("Al continuar aceptás los");
    expect(body).toContain("18 años o más");
    expect(body).toContain('href="https://homesuite.info/terminos"');
    expect(body).toContain('href="https://homesuite.info/privacidad"');
    // el aviso queda antes del botón, no al final de la página
    expect(body.indexOf("Al continuar aceptás los")).toBeLessThan(body.indexOf('href="/auth/google'));
    // y el enlace avisa al servidor de que la persona vio el aviso
    expect(body).toContain("acepta=1");
  });

  it("al menos dos pantallas públicas ofrecen el acceso con el aviso (la prueba no pasa en vacío)", async () => {
    const withLink = [];
    for (const path of PUBLIC_PATHS) if ((await visit(path)).body.includes("/auth/google")) withLink.push(path);
    expect(withLink).toEqual(expect.arrayContaining(["/", "/remanso"]));
  });

  it("las rutas que redirigen directo a Google no muestran una pantalla con enlace sin aviso", async () => {
    for (const path of ["/cuentas-claras", "/invitations", "/perfil", "/groups"]) {
      const { status, location, body } = await visit(path);
      expect([302, 303], path).toContain(status);
      expect(location).toContain("/auth/google");
      expect(body).not.toContain("<a ");
    }
  });

  it("sin cliente de Google no se ofrece el acceso ni el aviso del botón", async () => {
    const { body } = await visit("/", {});
    expect(body).not.toContain("/auth/google");
    expect(body).toContain("todavía no está configurado");
  });

  it("el pie con privacidad y términos está en las pantallas con y sin acceso", async () => {
    for (const path of ["/", "/tareas", "/jardin-zen", "/groups/new"]) {
      const { body } = await visit(path);
      if (!body) continue;
      expect(body, path).toContain('<nav class="legal-footer" aria-label="Textos legales">');
      expect(body).toContain('>Privacidad</a>');
      expect(body).toContain('>Términos y condiciones</a>');
    }
  });

  it("Remanso conserva su inicio sin desplazamiento: no lleva el pie, pero sí el aviso junto al botón de acceso", async () => {
    const { body } = await visit("/remanso");
    expect(body).not.toContain("legal-footer");
    expect(body).toContain("Al continuar aceptás los");
  });

  it("en staging los enlaces apuntan al sitio de staging", async () => {
    const response = await app.request("https://staging.homesuite.info/", {}, ENV);
    const body = await response.text();
    expect(body).toContain('href="https://site-staging.homesuite.info/terminos"');
    expect(body).not.toContain('href="https://homesuite.info/');
  });
});
