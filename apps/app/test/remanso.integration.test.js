import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { saveOwnProfile } from "../src/profiles.js";
import { createSession } from "../src/sessions.js";
import { upsertGoogleUser } from "../src/users.js";
import { expectCleanDocument } from "./helpers/documento.js";

const SECRET = "r".repeat(32);
const ORIGIN = "https://staging.homesuite.info";
const CONTEXT = { DB: env.DB, SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret" };

async function signedIn(name) {
  const suffix = crypto.randomUUID();
  const user = await upsertGoogleUser(env.DB, {
    sub: `remanso-${suffix}`, email: `remanso-${suffix}@example.test`, name, picture: "https://lh3.googleusercontent.com/avatar",
  });
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` };
}

describe("GET /remanso con sesión (D1)", () => {
  it("abre todo el nivel con cuenta y entrega el nombre del perfil", async () => {
    const { cookie } = await signedIn("Pablo");
    const response = await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: cookie } }, CONTEXT);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await response.text();
    expect(html).toContain('data-acceso="cuenta"');
    expect(html).toContain('data-nombre="Pablo"');
    expect(html).toContain('data-inicial-minutos="10" data-inicial-fondo="lluvia" data-inicial-gong="brillante" data-inicial-volumen="58"');
    expect(html).toContain('class="account-link" href="/perfil"');
    expectCleanDocument(html);
  });

  it("escapa el nombre: ni etiquetas ni comillas se interpretan como marcado", async () => {
    const { cookie } = await signedIn(`Ana <b>&"x"</b>`);
    const html = await (await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: cookie } }, CONTEXT)).text();
    expect(html).toContain('data-nombre="Ana &lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;"');
    expect(html).not.toContain("<b>");
    expectCleanDocument(html);
  });

  it("una sesión revocada vuelve al nivel libre", async () => {
    const { user, cookie } = await signedIn("Revocada");
    await env.DB.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(user.id).run();
    const html = await (await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: cookie } }, CONTEXT)).text();
    expect(html).toContain('data-acceso="libre"');
    expect(html).not.toContain("data-nombre=");
  });

  it("refleja el nombre vigente del perfil", async () => {
    const { user, cookie } = await signedIn("Nombre Viejo");
    await saveOwnProfile(env.DB, user.id, { expectedRevision: 0, displayName: "Nombre Nuevo" });
    const html = await (await app.request(`${ORIGIN}/remanso`, { headers: { Cookie: cookie } }, CONTEXT)).text();
    expect(html).toContain('data-nombre="Nombre Nuevo"');
  });

  it("en localhost con modo local usa el usuario local", async () => {
    const response = await app.request("http://localhost:8787/remanso", {}, { ...CONTEXT, DEV_LOCAL_MODE: "true", DEV_LOCAL_EMAIL: "zelda@example.test" });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('data-acceso="cuenta"');
    expect(html).toMatch(/data-nombre="[^"]+"/u);
  });

  it("la home con sesión suma la tarjeta de Remanso sin alterar las demás, sin Compras, y el menú no lista herramientas", async () => {
    const { cookie } = await signedIn("Home");
    const html = await (await app.request(`${ORIGIN}/`, { headers: { Cookie: cookie } }, CONTEXT)).text();
    expect(html).toContain('<a class="tool-card tool-card-calm" href="/remanso"><strong>Remanso</strong>');
    expect(html).toContain('<a class="tool-card tool-card-calm" href="/jardin-zen"><strong>Jardín Zen</strong>');
    for (const [href, clase] of [["/tareas", "tool-card tool-card-tasks"], ["/cuentas-claras", "tool-card tool-card-expenses"]]) expect(html).toContain(`<a class="${clase}" href="${href}">`);
    expect(html.match(/class="tool-card[ "]/gu)).toHaveLength(4);
    expect(html).not.toMatch(/Compras|\/compras/u);
    // El menú general ya no lista herramientas (Inicio, Mis grupos y la cuenta), así que Remanso solo está en la home.
    expect(html.match(/<a href="\/remanso">Remanso<\/a>/gu)).toBeNull();
  });
});
