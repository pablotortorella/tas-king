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
  ["compras", "/compras", undefined],
  ["acceso sin configurar", "/auth/google", undefined],
];

describe("shell compartido de HomeSuite", () => {
  it.each(PAGES)("%s conserva su HTML", async (name, path, env) => {
    const response = await app.request(`${ORIGIN}${path}`, {}, env);
    const slug = name.replaceAll(" ", "-").normalize("NFD").replace(/[̀-ͯ]/gu, "");
    await expect(await response.text()).toMatchFileSnapshot(`./__snapshots__/shell/${slug}.html`);
  });

  it("las rutas HTML conservan política, no-store y cabeceras de seguridad", async () => {
    for (const path of ["/", "/tareas", "/cuentas-claras", "/compras"]) {
      const response = await app.request(`${ORIGIN}${path}`);
      expect(response.status, path).toBe(200);
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
});
