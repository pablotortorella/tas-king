import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createSession } from "../src/sessions.js";
import { upsertGoogleUser } from "../src/users.js";

// Las rutas nuevas de la PWA no leen sesión, cookies, usuario local ni D1 (design.md, D3 y D12), y las páginas sin conexión no llevan
// nada de la persona aunque el pedido traiga una sesión válida.
const SECRET = "p".repeat(32);
const ORIGEN = "https://staging.homesuite.info";
const NOMBRE = "Persona Muy Reconocible";
const RUTAS = ["/sw.js", "/pwa.js", "/manifest.webmanifest", "/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso"];

// DB con contador: cualquier consulta (prepare, batch, exec) suma.
function baseContada() {
  const cuenta = { consultas: 0 };
  const DB = new Proxy(env.DB, {
    get(objetivo, propiedad) {
      const valor = Reflect.get(objetivo, propiedad, objetivo);
      if (typeof valor !== "function") return valor;
      return (...argumentos) => {
        if (["prepare", "batch", "exec", "dump"].includes(propiedad)) cuenta.consultas += 1;
        return valor.apply(objetivo, argumentos);
      };
    },
  });
  return { DB, cuenta };
}

async function sesionValida() {
  const sufijo = crypto.randomUUID();
  const email = `pwa-${sufijo}@example.test`;
  const usuario = await upsertGoogleUser(env.DB, { sub: `pwa-${sufijo}`, email, name: NOMBRE, picture: "https://lh3.googleusercontent.com/avatar-privado" });
  const sesion = await createSession(env.DB, { userId: usuario.id, secret: SECRET });
  return { email, cookie: `__Host-homesuite_session=${encodeURIComponent(sesion.token)}` };
}

describe("páginas «Sin conexión» con una sesión válida", () => {
  it.each(RUTAS.slice(3))("%s no trae nombre, email, avatar ni _csrf, ni Set-Cookie, y no consulta D1", async (ruta) => {
    const { email, cookie } = await sesionValida();
    const { DB, cuenta } = baseContada();
    const respuesta = await app.request(`${ORIGEN}${ruta}`, { headers: { Cookie: cookie } }, { DB, SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s" });
    expect(respuesta.status).toBe(200);
    const html = await respuesta.text();
    for (const privado of [NOMBRE, email, "avatar-privado", "_csrf", "account-link", "Cerrar sesión", "avatar"]) expect(html, privado).not.toContain(privado);
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
    expect(respuesta.headers.get("Cache-Control")).toBe("no-cache");
    expect(respuesta.headers.get("Content-Security-Policy")).toContain("script-src 'self'; style-src 'self'");
    expect(cuenta.consultas).toBe(0);
  });

  it.each(RUTAS.slice(3))("%s con DEV_LOCAL_MODE y DEV_LOCAL_EMAIL (localhost) no trae el usuario local ni consulta D1", async (ruta) => {
    const { DB, cuenta } = baseContada();
    const respuesta = await app.request(`http://localhost:8787${ruta}`, {}, { DB, SESSION_SECRET: SECRET, DEV_LOCAL_MODE: "true", DEV_LOCAL_EMAIL: "zelda-privada@example.test" });
    const html = await respuesta.text();
    expect(html).not.toContain("zelda");
    expect(html).not.toContain("_csrf");
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
    expect(cuenta.consultas).toBe(0);
  });

  it("la copia de Remanso sale con el nivel sin cuenta aunque haya sesión", async () => {
    const { cookie } = await sesionValida();
    const html = await (await app.request(`${ORIGEN}/sin-conexion/remanso`, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: SECRET })).text();
    expect(html).toContain('data-acceso="libre"');
    expect(html).not.toContain("data-nombre=");
  });
});

describe("costo: las rutas nuevas no consultan D1", () => {
  it.each(RUTAS)("%s, con y sin cookie de sesión, cero consultas", async (ruta) => {
    const { cookie } = await sesionValida();
    for (const cabeceras of [{}, { Cookie: cookie }]) {
      const { DB, cuenta } = baseContada();
      const respuesta = await app.request(`${ORIGEN}${ruta}`, { headers: cabeceras }, { DB, SESSION_SECRET: SECRET });
      expect(respuesta.status).toBe(200);
      await respuesta.text();
      expect(cuenta.consultas, `${ruta} ${JSON.stringify(cabeceras)}`).toBe(0);
    }
  });

  it("el contador funciona: /perfil con sesión sí consulta D1", async () => {
    const { cookie } = await sesionValida();
    const { DB, cuenta } = baseContada();
    await app.request(`${ORIGEN}/perfil`, { headers: { Cookie: cookie } }, { DB, SESSION_SECRET: SECRET });
    expect(cuenta.consultas).toBeGreaterThan(0);
  });
});

describe("la revocación sigue valiendo en la siguiente navegación", () => {
  it("una sesión revocada se ve sin cuenta en /remanso (el service worker no la guarda: nada de la persona está en las copias)", async () => {
    const { cookie } = await sesionValida();
    const antes = await (await app.request(`${ORIGEN}/remanso`, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: SECRET })).text();
    expect(antes).toContain('data-acceso="cuenta"');
    await env.DB.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL").run();
    const despues = await (await app.request(`${ORIGEN}/remanso`, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: SECRET })).text();
    expect(despues).toContain('data-acceso="libre"');
  });
});
