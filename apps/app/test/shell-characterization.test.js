import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

// Caracterización del shell compartido: fija el HTML y las cabeceras que producen
// hoy las rutas de las demás herramientas. Cambiar `page()` o agregar una
// herramienta cambia estos snapshots; revisar el diff antes de actualizarlos
// (`vitest -u`): sólo deben aparecer las adiciones previstas.

const ORIGIN = "http://app.test";
const LOCAL_ENV = { DEV_LOCAL_MODE: "true" };

const PAGES = [
  ["raíz sin sesión", "/", undefined],
  ["raíz en modo local", "/", LOCAL_ENV],
  ["tareas", "/tareas", undefined],
  ["cuentas claras sin sesión", "/cuentas-claras", undefined],
  ["acceso sin configurar", "/auth/google", undefined],
];

describe("shell compartido de HomeSuite", () => {
  it.each(PAGES)("%s conserva su HTML", async (name, path, env) => {
    const response = await app.request(`${ORIGIN}${path}`, {}, env);
    const slug = name.replaceAll(" ", "-").normalize("NFD").replace(/[̀-ͯ]/gu, "");
    await expect(await response.text()).toMatchFileSnapshot(`./__snapshots__/shell/${slug}.html`);
  });

  it("las rutas HTML conservan política, no-store y cabeceras de seguridad", async () => {
    // Sin sesión, /cuentas-claras no muestra una página: redirige al acceso (303).
    for (const [path, status] of [["/", 200], ["/tareas", 200], ["/cuentas-claras", 303]]) {
      const response = await app.request(`${ORIGIN}${path}`);
      expect(response.status, path).toBe(status);
      expect(response.headers.get("Cache-Control"), path).toBe("private, no-store");
      expect(response.headers.get("Content-Security-Policy"), path).toContain("script-src 'self'; style-src 'self'");
      expect(response.headers.get("X-Frame-Options"), path).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options"), path).toBe("nosniff");
    }
  });

  it("/perfil sin sesión redirige al acceso con retorno a /perfil", async () => {
    const response = await app.request(`${ORIGIN}/perfil`);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/google?returnTo=%2Fperfil");
  });

  it("Compras no existe en la app: ni ruta ni tarjeta", async () => {
    expect((await app.request(`${ORIGIN}/compras`)).status).toBe(404);
    expect(await (await app.request(`${ORIGIN}/`)).text()).not.toMatch(/Compras|\/compras/u);
  });
});
