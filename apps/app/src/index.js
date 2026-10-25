import { Hono } from "hono";
import { cookie, createGoogleAuthorization, exchangeGoogleCode, getCookie, seal, unseal, validateGoogleIdToken, validReturnTo } from "./auth.js";
import { createCsrfToken, inspectCsrfRequest } from "./csrf.js";
import { registerProfileRoutes } from "./profile-routes.js";
import { AVATAR_COLORS, readOwnProfile } from "./profiles.js";
import { PROFILE_CLIENT_SCRIPT, renderProfileForm } from "./profile-ui.js";
import { checkRateLimit, RATE_LIMIT_RETRY_SECONDS } from "./rate-limit.js";
import { createSession, currentSession, expiredSessionCookie, revokeSession, sessionCookie } from "./sessions.js";
import { cancelInvitation, createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "./spaces.js";
import { GoogleIdentityConflictError, upsertGoogleUser } from "./users.js";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; img-src 'self' https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const DEMO_PAIRS = Object.freeze([
  ["Zelda", "Link"], ["Tom", "Jerry"], ["Sherlock", "Watson"],
  ["Quijote", "Sancho"], ["Robin", "Marian"], ["Shrek", "Fiona"],
  ["Frodo", "Sam"], ["Wallace", "Gromit"], ["Calvin", "Hobbes"],
  ["Mario", "Luigi"], ["Lilo", "Stitch"], ["Asterix", "Obelix"],
]);
let nextDemoIndex = 0;

function demoPair(c) {
  const requested = Number.parseInt(c.req.query("ejemplo") ?? "0", 10);
  const index = Number.isInteger(requested) ? Math.abs(requested) % DEMO_PAIRS.length : 0;
  return { owner: DEMO_PAIRS[index][0], member: DEMO_PAIRS[index][1], index };
}

function startDemoPair() {
  const index = nextDemoIndex;
  nextDemoIndex = (nextDemoIndex + 1) % DEMO_PAIRS.length;
  return { owner: DEMO_PAIRS[index][0], member: DEMO_PAIRS[index][1], index };
}

function demoQuery(index) {
  return `ejemplo=${index}`;
}

export const app = new Hono();

const OAUTH_COOKIE = "homesuite_oauth";
const MAX_MUTATION_BODY_BYTES = 16 * 1024;

function authConfig(env = {}) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, SESSION_SECRET: sessionSecret } = env;
  return typeof clientId === "string" && typeof clientSecret === "string" && typeof sessionSecret === "string" && sessionSecret.length >= 32
    ? { clientId, clientSecret, sessionSecret }
    : null;
}

function sessionSecret(env = {}) {
  return typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 32 ? env.SESSION_SECRET : null;
}

function setCookie(c, value) {
  c.header("Set-Cookie", value, { append: true });
}

function isSecureRequest(c) {
  return new URL(c.req.url).protocol === "https:";
}

function oauthCookie(value, secure, maxAge = 10 * 60) {
  return cookie(OAUTH_COOKIE, value, { maxAge, secure });
}

function html(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function avatar(profile) {
  const value = profile.avatar;
  const image = value.type === "photo" && value.photoUrl
    ? `<span class="avatar-fallback">${html(value.initial)}</span><img src="${html(value.photoUrl)}" alt="" referrerpolicy="no-referrer">`
    : value.type === "emoji" ? html(value.emoji) : html(value.initial);
  return `<span class="avatar avatar-${html(value.color)}" aria-hidden="true">${image}</span>`;
}

function page(title, content, profile = null) {
  const account = profile ? `<a class="account-link" href="/perfil" aria-label="Mi perfil: ${html(profile.displayName)}">${avatar(profile)}<span>${html(profile.displayName)}</span></a>` : "";
  const accountMenu = profile ? `<a href="/perfil">Mi perfil</a><form action="/auth/logout" method="post"><button type="submit">Cerrar sesión</button></form>` : "";
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(title)} · HomeSuite</title><link rel="stylesheet" href="/app.css"><script src="/shell.js" defer></script><body><main class="shell"><header class="shell-header"><a class="brand" href="/">⌂ HomeSuite</a><nav class="desktop-nav" aria-label="Herramientas de HomeSuite"><a href="/tareas">Tareas</a><a href="/cuentas-claras">Cuentas Claras</a><a href="/compras">Compras</a></nav><div class="header-actions">${account}<details class="menu"><summary aria-label="Abrir menú de HomeSuite">☰</summary><nav aria-label="Menú de HomeSuite"><a href="/">Inicio</a><a href="/tareas">Tareas</a><a href="/cuentas-claras">Cuentas Claras</a><a href="/compras">Compras</a>${accountMenu}</nav></details></div></header>${content}</main></body></html>`;
}

const AVATAR_CSS = Object.entries(AVATAR_COLORS).map(([token, color]) =>
  `.avatar-${token}{background:${color};color:${["ocean", "forest", "clay", "violet", "rose"].includes(token) ? "#fff" : "#20342a"}}`).join("");

function requestId(c) { return c.get("requestId") || "unknown"; }

async function enforceRateLimit(c, binding, key) {
  const limit = await checkRateLimit(binding, key);
  if (!limit.configured && c.env?.REQUIRE_RATE_LIMITS === "true") {
    console.error("[homesuite-app]", JSON.stringify({ event: "rate_limit_binding_missing", requestId: requestId(c) }));
    return c.json({ error: "Protección temporalmente no disponible.", requestId: requestId(c) }, 503);
  }
  if (limit.allowed) return null;
  c.header("Retry-After", String(RATE_LIMIT_RETRY_SECONDS));
  return c.json({ error: "Demasiadas solicitudes. Intentá de nuevo más tarde.", requestId: requestId(c) }, 429);
}

app.use("*", async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") || crypto.randomUUID());
  await next();
  c.header("X-Request-Id", requestId(c));
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
  if (new URL(c.req.url).pathname.startsWith("/api/") || ["/", "/cuentas-claras", "/tareas", "/compras", "/perfil"].includes(new URL(c.req.url).pathname)) c.header("Cache-Control", "private, no-store");
});

app.use("*", async (c, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    const contentLength = Number.parseInt(c.req.header("Content-Length") ?? "0", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_MUTATION_BODY_BYTES) {
      return c.json({ error: "La solicitud es demasiado grande.", requestId: requestId(c) }, 413);
    }
  }
  return next();
});

app.use("/auth/*", async (c, next) => {
  const limited = await enforceRateLimit(c, c.env?.AUTH_RATE_LIMITER, c.req.header("CF-Connecting-IP") || "unknown");
  if (limited) return limited;
  return next();
});

async function signedInUser(c) {
  const secret = sessionSecret(c.env);
  return secret ? currentSession(c.env.DB, c.req.raw, secret) : null;
}

app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (c.req.method !== "PATCH" || (path !== "/api/me/profile" && !/^\/api\/spaces\/[^/]+\/me\/presentation$/u.test(path))) return next();
  const host = new URL(c.req.url).hostname;
  const localEmail = (host === "localhost" || host === "127.0.0.1") ? localUser(c) : null;
  if (localEmail) {
    c.set("protectedUser", await ensureLocalUser(c.env.DB, localEmail));
    return next();
  }
  const secret = sessionSecret(c.env);
  const session = await signedInUser(c);
  if (!session) return c.json({ error: "Una sesión es requerida." }, 401);
  const limited = await enforceRateLimit(c, c.env?.MUTATION_RATE_LIMITER, session.id);
  if (limited) return limited;
  const csrf = await inspectCsrfRequest(c.req.raw, { sessionId: session.id, secret });
  if (!csrf.valid) return c.json({ error: "Solicitud no verificada.", code: "csrf_rejected" }, 403);
  c.set("protectedUser", session);
  return next();
});

app.get("/healthz", (c) => c.json({ status: "ok", service: "homesuite-app" }));

function localUser(c) {
  if (c.env?.DEV_LOCAL_MODE !== "true") return null;
  return c.req.query("as") || c.env.DEV_LOCAL_EMAIL || c.req.header("X-HomeSuite-Dev-Email") || null;
}

registerProfileRoutes(app, { signedInUser, localUser, ensureLocalUser });

app.get("/api/me", async (c) => {
  const email = localUser(c);
  if (email) {
    const user = await ensureLocalUser(c.env.DB, email);
    const profile = await readOwnProfile(c.env.DB, user.id);
    return c.json({ id: user.id, email: user.email, displayName: profile.displayName, profile, local: true });
  }
  const secret = sessionSecret(c.env);
  const session = await signedInUser(c);
  if (!session) return c.json({ error: "Una sesión es requerida." }, 401);
  const profile = await readOwnProfile(c.env.DB, session.user_id);
  const csrfToken = await createCsrfToken({ sessionId: session.id, secret });
  return c.json({ id: session.user_id, email: session.email, displayName: profile.displayName, profile, csrfToken });
});

app.use("/demo/*", async (c, next) => {
  if (c.env?.DEV_LOCAL_MODE !== "true") return c.text("No encontrado.", 404);
  await next();
});

app.get("/auth/google", async (c) => {
  const config = authConfig(c.env);
  if (!config) return c.html(page("Acceso no configurado", "<h1>El acceso todavía no está configurado.</h1><p>Esta aplicación aún no tiene un cliente de Google para este ambiente.</p>"), 503);
  const secure = isSecureRequest(c);
  const redirectUri = `${new URL(c.req.url).origin}/auth/callback`;
  const authorization = await createGoogleAuthorization({ clientId: config.clientId, redirectUri, returnTo: validReturnTo(c.req.query("returnTo")) });
  setCookie(c, oauthCookie(await seal(authorization.state, config.sessionSecret), secure));
  return c.redirect(authorization.url, 302);
});

app.get("/auth/callback", async (c) => {
  const config = authConfig(c.env);
  const secure = isSecureRequest(c);
  if (!config) return c.html(page("Acceso no configurado", "<h1>El acceso todavía no está configurado.</h1><p>Volvé a intentarlo cuando este ambiente tenga su cliente de Google.</p>"), 503);
  const raw = getCookie(c.req.header("Cookie"), OAUTH_COOKIE);
  const state = raw ? await unseal(decodeURIComponent(raw), config.sessionSecret) : null;
  const code = c.req.query("code");
  if (!state || state.expiresAt < Date.now() || !code || c.req.query("state") !== state.state) {
    setCookie(c, oauthCookie("", secure, 0));
    return c.html(page("No pudimos verificar el acceso", "<h1>No pudimos verificar el acceso.</h1><p>Volvé a iniciar sesión desde HomeSuite.</p>"), 400);
  }
  try {
    const redirectUri = `${new URL(c.req.url).origin}/auth/callback`;
    const tokens = await exchangeGoogleCode({ code, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri, codeVerifier: state.verifier });
    const identity = await validateGoogleIdToken({ idToken: tokens.id_token, audience: config.clientId, nonce: state.nonce });
    const user = await upsertGoogleUser(c.env.DB, identity);
    const session = await createSession(c.env.DB, { userId: user.id, secret: config.sessionSecret });
    setCookie(c, oauthCookie("", secure, 0));
    setCookie(c, sessionCookie(session.token, secure));
    return c.redirect(state.returnTo, 303);
  } catch (error) {
    setCookie(c, oauthCookie("", secure, 0));
    const message = error instanceof GoogleIdentityConflictError ? "Este email ya está vinculado a otra identidad de HomeSuite." : "No pudimos completar el acceso con Google. Intentá de nuevo.";
    return c.html(page("No pudimos iniciar sesión", `<h1>No pudimos iniciar sesión.</h1><p>${message}</p>`), 400);
  }
});

app.post("/auth/logout", async (c) => {
  const config = authConfig(c.env);
  if (config) await revokeSession(c.env.DB, c.req.raw, config.sessionSecret);
  setCookie(c, expiredSessionCookie(isSecureRequest(c)));
  return c.redirect("/", 303);
});

app.post("/api/local/spaces", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.json();
  const space = await createSpaceForUser(c.env.DB, { userId: user.id, name: body.name });
  return c.json(space, 201);
});

app.post("/local/spaces", async (c) => {
  const email = localUser(c);
  if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  const space = await createSpaceForUser(c.env.DB, { userId: user.id, name: body.name });
  return c.redirect(`/local/spaces/${space.id}`, 303);
});

app.get("/local/spaces/:spaceId", async (c) => {
  const email = localUser(c);
  if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const space = await c.env.DB.prepare("SELECT s.name, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE s.id = ? AND m.user_id = ?").bind(c.req.param("spaceId"), user.id).first();
  if (!space) return c.text("Espacio no encontrado.", 404);
  const invitations = space.role === "owner" ? await c.env.DB.prepare("SELECT invitee_email FROM invitations WHERE space_id = ? AND status = 'pending'").bind(c.req.param("spaceId")).all() : { results: [] };
  const members = await c.env.DB.prepare("SELECT u.display_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? ORDER BY m.role DESC, u.display_name").bind(c.req.param("spaceId")).all();
  const participants = members.results.map(member => `<div class="person"><strong>${html(member.display_name)}</strong><br><span class="muted">${member.role === "owner" ? "Titular" : "Integrante"}</span></div>`).join("");
  const pending = invitations.results.map(row => `<div class="person"><strong>${html(row.invitee_email)}</strong><br><span class="muted">Invitación pendiente</span><br><a class="button secondary" href="/local/invitations?as=${encodeURIComponent(row.invitee_email)}">Ver como invitada</a></div>`).join("");
  const management = space.role === "owner" ? `<section class="card"><h2>Participantes</h2>${participants}<h2>Invitar</h2><form action="/local/spaces/${c.req.param("spaceId")}/invitations" method="post"><label class="label">Email</label><input name="email" type="email" required placeholder="link@example.test"><button class="button">Invitar</button></form>${pending}</section>` : `<section class="card"><h2>Participantes</h2>${participants}<p>Como integrante podés acceder a Cuentas Claras. La administración de participantes queda en manos del titular.</p></section>`;
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${html(space.name)} · ${space.role === "owner" ? "Titular" : "Integrante"}</p><h1>Cuentas Claras está lista.</h1><p>Este espacio ya existe en D1 local. Todavía no inventamos saldos ni movimientos.</p>${management}`));
});

app.post("/local/spaces/:spaceId/invitations", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  await inviteToSpace(c.env.DB, { spaceId: c.req.param("spaceId"), inviterUserId: user.id, email: body.email });
  return c.redirect(`/local/spaces/${c.req.param("spaceId")}`, 303);
});

app.get("/local/invitations", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS space_name, inviter.display_name AS inviter_name FROM invitations i JOIN spaces s ON s.id = i.space_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending'").bind(user.email).all();
  const cards = rows.results.map(row => `<section class="card"><h2>${html(row.space_name)}</h2><p>Te invitó <strong>${html(row.inviter_name)}</strong>. Antes de aceptar no ves integrantes, movimientos ni saldos.</p><form action="/local/invitations/${row.id}?as=${encodeURIComponent(user.email)}" method="post"><button class="button" name="decision" value="accept">Aceptar invitación</button><button class="button secondary" name="decision" value="reject">Rechazar</button></form></section>`).join("") || "<p>No tenés invitaciones pendientes.</p>";
  return c.html(page("Invitaciones", `<p class="eyebrow">Cuentas Claras</p><h1>Invitaciones</h1>${cards}`));
});

app.post("/local/invitations/:invitationId", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  const accepted = body.decision === "accept";
  const spaceId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.id, email: user.email, accepted });
  return c.redirect(accepted ? `/local/spaces/${spaceId}?as=${encodeURIComponent(user.email)}` : `/local/invitations?as=${encodeURIComponent(user.email)}`, 303);
});

app.post("/api/local/spaces/:spaceId/invitations", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(c.req.param("spaceId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede invitar." }, 403);
  const body = await c.req.json();
  const invitation = await inviteToSpace(c.env.DB, { spaceId: c.req.param("spaceId"), inviterUserId: user.id, email: body.email });
  return c.json(invitation, 201);
});

app.get("/api/local/spaces/:spaceId/invitations", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(c.req.param("spaceId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede ver invitaciones." }, 403);
  const rows = await c.env.DB.prepare("SELECT id, invitee_email AS email, status FROM invitations WHERE space_id = ? ORDER BY created_at").bind(c.req.param("spaceId")).all();
  return c.json(rows.results);
});

app.delete("/api/local/spaces/:spaceId/invitations/:invitationId", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(c.req.param("spaceId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede cancelar invitaciones." }, 403);
  await cancelInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), spaceId: c.req.param("spaceId"), actorUserId: user.id });
  return c.body(null, 204);
});

app.get("/api/local/invitations/pending", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS space_name, inviter.display_name AS inviter_name FROM invitations i JOIN spaces s ON s.id = i.space_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending'").bind(user.email).all();
  return c.json(rows.results);
});

app.post("/api/local/invitations/:invitationId/:decision", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const accepted = c.req.param("decision") === "accept";
  if (!accepted && c.req.param("decision") !== "reject") return c.json({ error: "Decisión inválida." }, 400);
  const user = await ensureLocalUser(c.env.DB, email);
  const spaceId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.id, email: user.email, accepted });
  return c.json({ status: accepted ? "accepted" : "rejected", spaceId });
});

app.get("/app.css", (c) => c.body(`
  :root{font-family:system-ui,sans-serif;color:#20342a;background:#f7f2e8}
  *{box-sizing:border-box}body{margin:0}
  .shell{max-width:900px;margin:auto;padding:24px 24px 72px}
  .shell-header{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
  .shell-header .desktop-nav{display:flex;gap:8px 20px;flex-wrap:wrap}
  .shell-header nav a{color:#28533c;text-decoration:none;font-weight:700}
  .shell-header nav a:hover,.shell-header nav a:focus-visible{text-decoration:underline}
  .header-actions{display:flex;align-items:center;gap:12px}
  .account-link{display:flex;align-items:center;gap:9px;color:#20342a;text-decoration:none;font-weight:700;max-width:220px}
  .account-link span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .avatar{width:38px;height:38px;display:inline-grid;place-items:center;flex:none;border-radius:50%;font-size:1.2rem;overflow:hidden;position:relative}
  .avatar-fallback{position:absolute;inset:0;display:grid;place-items:center}
  .avatar img{width:100%;height:100%;object-fit:cover;position:relative}
  ${AVATAR_CSS}
  .menu{position:relative}.menu summary{list-style:none;cursor:pointer;border:1px solid #b8b1a5;border-radius:12px;padding:7px 11px;font-size:1.25rem;line-height:1.2}
  .menu summary::-webkit-details-marker{display:none}
  .menu nav{display:flex;flex-direction:column;gap:14px;position:absolute;right:0;top:calc(100% + 8px);min-width:190px;padding:18px;background:#fffaf0;border:1px solid #d9d0c0;border-radius:14px;box-shadow:0 12px 32px #20342a22;z-index:5}
  .menu form{margin:0}.menu button{font:inherit;color:#28533c;background:none;border:0;padding:0;cursor:pointer;font-weight:700}
  .brand{color:#206447;text-decoration:none;font-weight:800}
  .eyebrow{color:#d95f46;font-size:.8rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-top:72px}
  h1{font-family:Georgia,serif;font-size:clamp(2.7rem,9vw,4.8rem);line-height:1;margin:14px 0 22px}
  h2{font-family:Georgia,serif;font-size:2rem;margin:0 0 12px}
  p{font-size:1.1rem;line-height:1.6;color:#52665b}
  .tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:32px}
  .tool-card{display:flex;flex-direction:column;gap:12px;background:#fffaf0;border:1px solid #d9d0c0;border-radius:18px;padding:24px;color:#20342a;text-decoration:none}
  .tool-card:hover,.tool-card:focus-visible{border-color:#206447;box-shadow:0 8px 24px #20342a18}
  .tool-card strong{font-family:Georgia,serif;font-size:1.55rem}
  .tool-card span{color:#52665b;line-height:1.5}
  .card{background:#fffaf0;border:1px solid #d9d0c0;border-radius:18px;padding:24px;margin-top:28px}
  .button{display:inline-block;background:#206447;color:white;border:0;border-radius:999px;padding:14px 20px;text-decoration:none;font-weight:800;margin-top:14px;cursor:pointer}
  .button.secondary{background:transparent;color:#206447;border:1px solid #206447}
  .label{font-weight:800;display:block;margin:20px 0 7px}
  input,select{width:100%;padding:13px;border:1px solid #b8b1a5;border-radius:9px;font:inherit;background:white;color:#20342a}
  .profile-form h2:not(:first-child){margin-top:32px}
  .profile-form input:disabled{background:#eee9df;color:#68766d}
  .profile-form button:disabled{opacity:.65;cursor:wait}
  .notice{background:#e6f0e9;border-radius:10px;padding:14px;color:#28533c;font-size:.95rem}
  .person{border-top:1px solid #ddd3c3;padding:15px 0}
  .muted{font-size:.9rem;color:#68766d}
  @media(max-width:760px){.shell-header .desktop-nav{display:none}.account-link{max-width:145px}}
` , 200, { "Content-Type": "text/css; charset=utf-8" }));

app.get("/shell.js", (c) => c.body(`document.querySelectorAll('.avatar img').forEach((image) => { image.addEventListener('error', () => image.remove()); if (image.complete && !image.naturalWidth) image.remove(); });`, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" }));

app.get("/", async (c) => {
  if (c.env?.DEV_LOCAL_MODE === "true") {
    return c.html(page("Inicio", `<p class="eyebrow">HomeSuite</p><h1>Un lugar para organizarnos juntos.</h1><p>Elegí una herramienta para empezar.</p><section class="tools" aria-label="Herramientas"><a class="tool-card" href="/tareas"><strong>Fun TasKing</strong><span>Tableros para avanzar juntos.</span></a><a class="tool-card" href="/cuentas-claras"><strong>Cuentas Claras</strong><span>Gastos, ingresos y transferencias compartidas.</span></a><a class="tool-card" href="/compras"><strong>Compras</strong><span>Listas compartidas en preparación.</span></a></section>`));
  }
  const config = authConfig(c.env);
  const session = await signedInUser(c);
  if (session) {
    const profile = await readOwnProfile(c.env.DB, session.user_id);
    return c.html(page("Inicio", `<p class="eyebrow">HomeSuite</p><h1>Hola, ${html(profile.displayName)}.</h1><p>Elegí una herramienta para empezar.</p><section class="tools" aria-label="Herramientas"><a class="tool-card" href="/tareas"><strong>Fun TasKing</strong><span>Tableros para avanzar juntos.</span></a><a class="tool-card" href="/cuentas-claras"><strong>Cuentas Claras</strong><span>Entrá a ver el estado de esta herramienta.</span></a><a class="tool-card" href="/compras"><strong>Compras</strong><span>Listas compartidas en preparación.</span></a></section>`, profile));
  }
  const action = config ? `<a class="button" href="/auth/google?returnTo=%2F">Continuar con Google</a>` : "<p class=\"notice\">El acceso de este ambiente todavía no está configurado.</p>";
  return c.html(page("Inicio", `<p class="eyebrow">HomeSuite</p><h1>Un lugar para organizarnos juntos.</h1><p>Elegí una herramienta para empezar.</p><section class="tools" aria-label="Herramientas"><a class="tool-card" href="/tareas"><strong>Fun TasKing</strong><span>Tableros para avanzar juntos.</span></a><a class="tool-card" href="/cuentas-claras"><strong>Cuentas Claras</strong><span>Gastos, ingresos y transferencias compartidas.</span></a><a class="tool-card" href="/compras"><strong>Compras</strong><span>Listas compartidas en preparación.</span></a></section><section class="card"><h2>Tu cuenta</h2><p>Entrá con Google para guardar tu perfil y continuar en la suite.</p>${action}</section>`));
});

app.get("/cuentas-claras", async (c) => {
  if (c.env?.DEV_LOCAL_MODE === "true") {
    const { index } = startDemoPair();
    return c.html(page("Cuentas Claras", `<p class="eyebrow">Cuentas Claras</p><h1>Lo compartido, más claro.</h1><p>Un lugar privado para organizar las cuentas de tu casa, viaje o proyecto.</p><section class="card"><h2>Recorrido local</h2><p>Esta demostración guarda datos solamente en D1 local.</p><a class="button" href="/demo/crear-espacio?${demoQuery(index)}">Empezar recorrido</a></section>`));
  }
  const session = await signedInUser(c);
  if (session) {
    const profile = await readOwnProfile(c.env.DB, session.user_id);
    return c.html(page("Cuentas Claras", `<p class="eyebrow">Cuentas Claras</p><h1>Muy pronto.</h1><p>Hola, ${html(profile.displayName)}. Ya ingresaste con tu cuenta de Google. Estamos terminando la primera versión de Cuentas Claras; todavía no hay movimientos ni saldos para usar aquí.</p>`, profile));
  }
  const action = authConfig(c.env) ? `<a class="button" href="/auth/google?returnTo=%2Fcuentas-claras">Continuar con Google</a>` : "<p class=\"notice\">El acceso de este ambiente todavía no está configurado.</p>";
  return c.html(page("Cuentas Claras", `<p class="eyebrow">Cuentas Claras</p><h1>Las cuentas compartidas, más claras.</h1><p>Un lugar privado para organizar gastos, ingresos y transferencias de tu casa, viaje o proyecto.</p><section class="card"><h2>Empezá con tu cuenta</h2><p>Entrá con Google para acceder a Cuentas Claras.</p>${action}</section>`));
});

app.get("/tareas", async (c) => {
  const session = await signedInUser(c);
  const profile = session ? await readOwnProfile(c.env.DB, session.user_id) : null;
  return c.html(page("Fun TasKing", `<p class="eyebrow">Fun TasKing</p><h1>Lo que hay que hacer, a la vista.</h1><p>Fun TasKing ya está disponible mientras preparamos su lugar dentro de HomeSuite.</p><a class="button" href="https://tas-king-staging.pablotortorella.workers.dev">Abrir TasKing en staging</a>`, profile));
});

app.get("/compras", async (c) => {
  const session = await signedInUser(c);
  const profile = session ? await readOwnProfile(c.env.DB, session.user_id) : null;
  return c.html(page("Compras", `<p class="eyebrow">Compras</p><h1>Una lista para comprar mejor, juntos.</h1><p>Esta herramienta todavía está en preparación.</p>`, profile));
});

app.get("/perfil", async (c) => {
  const host = new URL(c.req.url).hostname;
  const localEmail = host === "localhost" || host === "127.0.0.1" ? localUser(c) : null;
  if (localEmail) {
    const user = await ensureLocalUser(c.env.DB, localEmail);
    const profile = await readOwnProfile(c.env.DB, user.id);
    return c.html(page("Mi perfil", renderProfileForm(profile, "", c.req.query("guardado") === "1"), profile));
  }
  const secret = sessionSecret(c.env);
  const session = await signedInUser(c);
  if (!session || !secret) return c.redirect("/auth/google?returnTo=%2Fperfil", 302);
  const profile = await readOwnProfile(c.env.DB, session.user_id);
  const csrfToken = await createCsrfToken({ sessionId: session.id, secret });
  return c.html(page("Mi perfil", renderProfileForm(profile, csrfToken, c.req.query("guardado") === "1"), profile));
});

app.get("/profile.js", (c) => c.body(PROFILE_CLIENT_SCRIPT, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" }));

app.get("/demo/crear-espacio", (c) => {
  const { owner, member, index } = demoPair(c);
  return c.html(page("Crear espacio", `<p class="eyebrow">Primer paso</p><h1>¿Cómo se llama este espacio?</h1><p>Puede ser tu casa, familia, viaje o cualquier contexto que compartan.</p><form class="card" method="post" action="/local/spaces"><label class="label" for="nombre">Nombre del espacio</label><input id="nombre" name="name" required maxlength="120" placeholder="Ej. Casa de ${owner} y ${member}"><button class="button" type="submit">Crear espacio</button></form>`));
});

app.get("/demo/espacio", (c) => {
  const name = c.req.query("nombre")?.trim() || "Casa compartida";
  const { owner, member, index } = demoPair(c);
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${html(name)}</p><h1>Cuentas Claras está lista.</h1><p>Cuando conectemos la cuenta real, aquí aparecerán los movimientos y balances del espacio. No inventamos números antes de tiempo.</p><section class="card"><h2>Participantes</h2><div class="person"><strong>${html(owner)}</strong><br><span class="muted">Titular del espacio</span></div><div class="person"><strong>${html(member)}</strong><br><span class="muted">Invitación pendiente · ${html(member.toLowerCase())}@example.com</span></div><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&${demoQuery(index)}">Ver lo que verá ${html(member)}</a></section>`));
});

app.get("/demo/invitacion", (c) => {
  const name = c.req.query("nombre") || "Casa compartida";
  const { owner, index } = demoPair(c);
  const answer = c.req.query("respuesta");
  const result = answer ? `<p class="notice">Invitación ${answer === "aceptar" ? "aceptada" : "rechazada"} en esta demostración. En la aplicación real la acción quedará auditada.</p>` : `<p class="notice">Antes de aceptar no ves integrantes, movimientos ni saldos.</p><a class="button" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=aceptar&${demoQuery(index)}">Aceptar invitación</a><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=rechazar&${demoQuery(index)}">Rechazar</a>`;
  return c.html(page("Invitación", `<p class="eyebrow">Invitación a Cuentas Claras</p><h1>${html(name)}</h1><p>Te invitó <strong>${html(owner)}</strong>. Si aceptás, vas a poder acceder a Cuentas Claras de este espacio.</p><section class="card">${result}</section>`));
});

app.notFound((c) => c.json({ error: "No encontrado." }, 404));

app.onError((error, c) => {
  console.error("[homesuite-app]", error);
  return c.json({ error: "Error interno." }, 500);
});

export default { fetch: app.fetch };
