import { createCsrfToken } from "../csrf.js";
import { PROFILE_CLIENT_SCRIPT, renderProfileForm } from "../profile-ui.js";
import { readOwnProfile } from "../profiles.js";
import { page, sessionSecret, signedInUser } from "../route-kit.js";
import { ensureLocalUser } from "../groups.js";
import { escapeHtml } from "../ui-parts.js";

const html = escapeHtml;
const TOOLS = `<section class="tools" aria-label="Herramientas"><a class="tool-card" href="/tareas"><strong>Fun TasKing</strong><span>Tableros para avanzar juntos.</span></a><a class="tool-card" href="/cuentas-claras"><strong>Cuentas Claras</strong><span>Gastos, ingresos y transferencias compartidas.</span></a><a class="tool-card" href="/compras"><strong>Compras</strong><span>Listas compartidas en preparación.</span></a></section>`;

// Comportamiento común del encabezado: si la foto del avatar no carga se muestra la inicial, y el menú se cierra con
// Escape, al tocar afuera o al elegir una opción que sólo cambia de lugar dentro de la misma página.
const SHELL_SCRIPT = `document.querySelectorAll('.avatar img').forEach((image) => { image.addEventListener('error', () => image.remove()); if (image.complete && !image.naturalWidth) image.remove(); });
const menu = document.querySelector('details.menu');
if (menu) {
  const close = () => { menu.open = false; };
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menu.open) { close(); menu.querySelector('summary').focus(); } });
  document.addEventListener('click', (event) => { if (menu.open && !menu.contains(event.target)) close(); });
  menu.addEventListener('click', (event) => { if (event.target.closest('nav a[href*="#"]')) close(); });
}`;

// Inicio de HomeSuite, las otras herramientas y «Mi perfil». El encabezado con la cuenta lo pone renderPage.
export function registerShellRoutes(app, { authConfig, localUser }) {
  app.get("/", async (c) => {
    const session = await signedInUser(c);
    if (session) {
      const profile = await readOwnProfile(c.env.DB, session.user_id);
      return c.html(page("Inicio", `<p class="eyebrow">HomeSuite</p><h1>Hola, ${html(profile.displayName)}.</h1><p>Elegí una herramienta para empezar.</p>${TOOLS}`));
    }
    const action = authConfig(c.env) ? '<a class="button" href="/auth/google?returnTo=%2F">Continuar con Google</a>' : '<p class="notice">El acceso de este ambiente todavía no está configurado.</p>';
    return c.html(page("Inicio", `<p class="eyebrow">HomeSuite</p><h1>Un lugar para organizarnos juntos.</h1><p>Elegí una herramienta para empezar.</p>${TOOLS}<section class="card"><h2>Tu cuenta</h2><p>Entrá con Google para guardar tu perfil y continuar en la suite.</p>${action}</section>`));
  });

  app.get("/tareas", (c) => c.html(page("Fun TasKing", '<p class="eyebrow">Fun TasKing</p><h1>Lo que hay que hacer, a la vista.</h1><p>Fun TasKing ya está disponible mientras preparamos su lugar dentro de HomeSuite.</p><a class="button" href="https://tas-king-staging.pablotortorella.workers.dev">Abrir TasKing en staging</a>')));

  app.get("/compras", (c) => c.html(page("Compras", '<p class="eyebrow">Compras</p><h1>Una lista para comprar mejor, juntos.</h1><p>Esta herramienta todavía está en preparación.</p>')));

  app.get("/perfil", async (c) => {
    const host = new URL(c.req.url).hostname;
    const localEmail = host === "localhost" || host === "127.0.0.1" ? localUser(c) : null;
    if (localEmail) {
      const user = await ensureLocalUser(c.env.DB, localEmail);
      const profile = await readOwnProfile(c.env.DB, user.id);
      return c.html(page("Mi perfil", renderProfileForm(profile, "", c.req.query("guardado") === "1")));
    }
    const secret = sessionSecret(c.env);
    const session = await signedInUser(c);
    if (!session || !secret) return c.redirect("/auth/google?returnTo=%2Fperfil", 302);
    const profile = await readOwnProfile(c.env.DB, session.user_id);
    const csrfToken = await createCsrfToken({ sessionId: session.id, secret });
    return c.html(page("Mi perfil", renderProfileForm(profile, csrfToken, c.req.query("guardado") === "1")));
  });

  app.get("/profile.js", (c) => c.body(PROFILE_CLIENT_SCRIPT, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" }));
  app.get("/shell.js", (c) => c.body(SHELL_SCRIPT, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" }));
}
