import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createSession } from "../src/sessions.js";
import { upsertGoogleUser } from "../src/users.js";

// «Cerrar sesión» del menú de cuenta. Estuvo roto en staging y en producción: el formulario del menú no llevaba el token CSRF que la ruta
// exige, así que toda persona veía «Solicitud no verificada» y no podía salir. Ninguna prueba ejercía el envío del formulario.
const SECRET = "l".repeat(32);
const ORIGIN = "https://app.homesuite.info";
const CONTEXT = { DB: env.DB, SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" };

async function signedIn(name) {
  const suffix = crypto.randomUUID();
  const user = await upsertGoogleUser(env.DB, { sub: `logout-${suffix}`, email: `logout-${suffix}@example.test`, name, picture: "https://lh3.googleusercontent.com/avatar" });
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` };
}

const formToken = (html) => html.match(/<form action="\/auth\/logout" method="post"><input type="hidden" name="_csrf" value="([^"]+)">/u)?.[1];
const post = (cookie, token, extra = {}) => app.request(`${ORIGIN}/auth/logout`, {
  method: "POST",
  headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded", ...extra },
  body: token === undefined ? "" : new URLSearchParams({ _csrf: token }).toString(),
}, CONTEXT);

describe("cerrar sesión desde el menú de cuenta", () => {
  it.each(["/", "/perfil", "/remanso"])("el menú de %s trae el formulario con el token de la sesión", async (path) => {
    const { cookie } = await signedIn("Pablo");
    const html = await (await app.request(`${ORIGIN}${path}`, { headers: { Cookie: cookie } }, CONTEXT)).text();
    expect(formToken(html), `formulario de cierre de sesión en ${path}`).toMatch(/^[\w-]{20,}/u);
  });

  it("enviar el formulario cierra la sesión: vuelve al inicio, expira la cookie y la sesión deja de valer", async () => {
    const { cookie } = await signedIn("Pablo");
    const token = formToken(await (await app.request(`${ORIGIN}/`, { headers: { Cookie: cookie } }, CONTEXT)).text());
    const response = await post(cookie, token);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Set-Cookie")).toMatch(/__Host-homesuite_session=;.*Max-Age=0/iu);
    expect((await app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } }, CONTEXT)).status).toBe(401);
  });

  it("sin token se rechaza y la sesión sigue vigente", async () => {
    const { cookie } = await signedIn("Pablo");
    expect((await post(cookie, undefined)).status).toBe(403);
    expect((await app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } }, CONTEXT)).status).toBe(200);
  });

  it("el token de otra sesión no sirve", async () => {
    const mia = await signedIn("Pablo");
    const otra = await signedIn("Ana");
    const tokenAjeno = formToken(await (await app.request(`${ORIGIN}/`, { headers: { Cookie: otra.cookie } }, CONTEXT)).text());
    expect((await post(mia.cookie, tokenAjeno)).status).toBe(403);
    expect((await app.request(`${ORIGIN}/api/me`, { headers: { Cookie: mia.cookie } }, CONTEXT)).status).toBe(200);
  });

  it("desde otro origen se rechaza aunque el token sea válido", async () => {
    const { cookie } = await signedIn("Pablo");
    const token = formToken(await (await app.request(`${ORIGIN}/`, { headers: { Cookie: cookie } }, CONTEXT)).text());
    expect((await post(cookie, token, { Origin: "https://otro.example" })).status).toBe(403);
  });

  it("sin sesión no hay menú de cuenta ni formulario", async () => {
    const html = await (await app.request(`${ORIGIN}/`, {}, CONTEXT)).text();
    expect(html).not.toContain("/auth/logout");
  });
});
