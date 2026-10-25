import { Hono } from "hono";
import { cookie, createGoogleAuthorization, exchangeGoogleCode, getCookie, seal, unseal, validateGoogleIdToken, validReturnTo } from "./auth.js";
import { inspectCsrfRequest } from "./csrf.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerEntryRoutes, recentFor } from "./routes/entries.js";
import { registerImportRoutes } from "./routes/import.js";
import { recategorizationNoticeFor, registerRecategorizeRoutes } from "./routes/recategorize.js";
import { csrfInput, formError, ledgerFailure, page, requestId, sessionSecret, signedInUser, signInRequired } from "./route-kit.js";
import { CURRENCY_MINOR_UNITS, currencyLabel } from "./finance.js";
import { addParticipant, exportLedger, readLedger } from "./ledger.js";
import { ledgerCsv } from "./ledger-ui.js";
import { assertLedgerWritable, setLedgerArchived } from "./ledger-admin.js";
import { PAGE_SIZE, renderBookHead, renderLedgerOverview, renderPeople } from "./overview-ui.js";
import { slowBookEvent } from "./perf.js";
import { avatar, escapeHtml, noticeFor } from "./ui-parts.js";
import { runMaintenance } from "./maintenance.js";
import { checkRateLimit, RATE_LIMIT_RETRY_SECONDS } from "./rate-limit.js";
import { createSession, currentSession, expiredSessionCookie, revokeSession, sessionCookie } from "./sessions.js";
import { cancelInvitation, createSpaceForUser, ensureLocalUser, inviteToSpace, renameSpace, resolveInvitation, resolveSpace } from "./spaces.js";
import { GoogleIdentityConflictError, upsertGoogleUser } from "./users.js";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests",
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
const MAX_IMPORT_BODY_BYTES = 2 * 1024 * 1024 + 16 * 1024;


function authConfig(env = {}) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
  const secret = sessionSecret(env);
  return typeof clientId === "string" && typeof clientSecret === "string" && secret
    ? { clientId, clientSecret, sessionSecret: secret }
    : null;
}






function logFailure(c, event, error) {
  console.error("[homesuite-app]", JSON.stringify({
    event,
    requestId: requestId(c),
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    errorName: error instanceof Error ? error.name : "UnknownError",
  }));
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


const html = escapeHtml;


function isProtectedMutation(c) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) return false;
  const path = new URL(c.req.url).pathname;
  return path === "/auth/logout" || path === "/spaces" || path.startsWith("/spaces/") || path.startsWith("/invitations/");
}

function isMutation(c) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method);
}

function clientAddress(c) {
  return c.req.header("CF-Connecting-IP") || "unknown";
}

async function enforceRateLimit(c, limiter, key) {
  const result = await checkRateLimit(limiter, key);
  if (!result.configured && c.env?.REQUIRE_RATE_LIMITS === "true") {
    logFailure(c, "rate_limit_binding_missing", new Error("RateLimitBindingMissing"));
    return c.json({ error: "Protección temporalmente no disponible.", requestId: requestId(c) }, 503);
  }
  if (result.allowed) return null;
  c.header("Retry-After", String(RATE_LIMIT_RETRY_SECONDS));
  console.warn("[homesuite-app]", JSON.stringify({ event: "rate_limited", requestId: requestId(c), method: c.req.method, path: new URL(c.req.url).pathname }));
  return c.json({ error: "Demasiadas solicitudes. Intentá de nuevo más tarde.", requestId: requestId(c) }, 429);
}

app.use("*", async (c, next) => {
  c.set("requestId", c.req.header("cf-ray") || crypto.randomUUID());
  await next();
  c.header("X-Request-Id", requestId(c));
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
  if (new URL(c.req.url).pathname.startsWith("/spaces/") || new URL(c.req.url).pathname === "/cuentas-claras") c.header("Cache-Control", "private, no-store");
});

app.use("*", async (c, next) => {
  if (isMutation(c)) {
    const contentLength = Number.parseInt(c.req.header("Content-Length") ?? "0", 10);
    const limit = new URL(c.req.url).pathname.endsWith("/ledger/import/preview") ? MAX_IMPORT_BODY_BYTES : MAX_MUTATION_BODY_BYTES;
    if (Number.isFinite(contentLength) && contentLength > limit) {
      return c.json({ error: "La solicitud es demasiado grande.", requestId: requestId(c) }, 413);
    }
  }
  await next();
});

app.use("/auth/*", async (c, next) => {
  const limited = await enforceRateLimit(c, c.env?.AUTH_RATE_LIMITER, clientAddress(c));
  if (limited) return limited;
  await next();
});

app.use("*", async (c, next) => {
  if (!isProtectedMutation(c)) return next();
  const secret = sessionSecret(c.env);
  const user = secret ? await currentSession(c.env.DB, c.req.raw, secret) : null;
  if (!user) return signInRequired(c);
  const limited = await enforceRateLimit(c, c.env?.MUTATION_RATE_LIMITER, user.id);
  if (limited) return limited;
  const csrf = await inspectCsrfRequest(c.req.raw, { sessionId: user.id, secret });
  if (!csrf.valid) {
    console.warn("[homesuite-app]", JSON.stringify({
      event: "csrf_rejected",
      requestId: requestId(c),
      reason: csrf.reason,
      hasOrigin: Boolean(c.req.header("Origin")),
      hasReferer: Boolean(c.req.header("Referer")),
      secFetchSite: c.req.header("Sec-Fetch-Site") ?? "missing",
    }));
    return c.html(formError("Solicitud no verificada", `Recargá la página e intentá de nuevo. Código: ${requestId(c)}.`), 403);
  }
  c.set("protectedUser", user);
  await next();
});

app.get("/healthz", (c) => c.json({ status: "ok", service: "homesuite-app" }));

function localUser(c) {
  if (c.env?.DEV_LOCAL_MODE !== "true") return null;
  return c.req.query("as") || c.req.header("X-HomeSuite-Dev-Email") || c.env.DEV_LOCAL_EMAIL || null;
}

app.get("/api/me", async (c) => {
  const email = localUser(c);
  if (email) {
    const user = await ensureLocalUser(c.env.DB, email);
    return c.json({ id: user.id, email: user.email, displayName: user.display_name, local: true });
  }
  const session = await signedInUser(c);
  if (!session) return c.json({ error: "Una sesión es requerida." }, 401);
  return c.json({ id: session.user_id, email: session.email, displayName: session.display_name });
});

app.get("/api/local/session", async (c) => {
  const email = localUser(c);
  const secret = sessionSecret(c.env);
  if (!email || !secret) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const session = await createSession(c.env.DB, { userId: user.id, secret });
  setCookie(c, sessionCookie(session.token, true));
  const invitation = await c.env.DB.prepare("SELECT id FROM invitations WHERE invitee_email = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP LIMIT 1").bind(user.email).first();
  const membership = invitation ? null : await c.env.DB.prepare("SELECT 1 AS found FROM memberships WHERE user_id = ? LIMIT 1").bind(user.id).first();
  return c.redirect(invitation ? "/invitations" : membership ? "/cuentas-claras" : "/spaces/new", 303);
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
    logFailure(c, "oauth_callback_failed", error);
    setCookie(c, oauthCookie("", secure, 0));
    const message = error instanceof GoogleIdentityConflictError ? "Este email ya está vinculado a otra identidad de HomeSuite." : "No pudimos completar el acceso con Google. Intentá de nuevo.";
    return c.html(page("No pudimos iniciar sesión", `<h1>No pudimos iniciar sesión.</h1><p>${message}</p>`), 400);
  }
});

app.post("/auth/logout", async (c) => {
  const secret = sessionSecret(c.env);
  if (secret) await revokeSession(c.env.DB, c.req.raw, secret);
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
  const management = space.role === "owner" ? `<section class="card"><h2>Participantes</h2>${participants}<h2>Invitar</h2><form action="/local/spaces/${c.req.param("spaceId")}/invitations" method="post"><label class="label" for="local-invite-email">Email</label><input id="local-invite-email" name="email" type="email" required placeholder="link@example.test"><button class="button">Invitar</button></form>${pending}</section>` : `<section class="card"><h2>Participantes</h2>${participants}<p>Como integrante podés acceder a Cuentas Claras. La administración de participantes queda en manos del titular.</p></section>`;
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



async function canonicalSpacePath(c, next) {
  const key = c.req.param("spaceId");
  if (c.req.method !== "GET" || !key?.startsWith("space_")) return next();
  const user = await signedInUser(c);
  if (!user) return next();
  const membership = await c.env.DB.prepare("SELECT 1 FROM memberships WHERE space_id = ? AND user_id = ?").bind(key, user.user_id).first();
  if (!membership) return next();
  const space = await resolveSpace(c.env.DB, key);
  if (!space) return next();
  const url = new URL(c.req.url);
  const prefix = `/spaces/${encodeURIComponent(key)}`;
  return c.redirect(`/spaces/${encodeURIComponent(space.slug)}${url.pathname.slice(prefix.length)}${url.search}`, 308);
}

app.use("/spaces/:spaceId", canonicalSpacePath);
app.use("/spaces/:spaceId/*", canonicalSpacePath);

app.get("/spaces/new", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  return c.html(page("Crear espacio", `<a class="back-link" href="/">← Volver</a><p class="eyebrow">Cuentas Claras</p><h1>Un grupo nuevo, cuentas claras.</h1><p>Un grupo puede ser tu casa, un viaje o un proyecto. Creás el espacio y su libro en un solo paso; después sumás personas e historial.</p><form class="card" method="post" action="/spaces">${await csrfInput(c, user)}<label class="label" for="nombre">Nombre</label><input id="nombre" name="name" required maxlength="120" autocomplete="off" placeholder="Ej. Casa compartida"><label class="label" for="currency">Moneda predeterminada</label><select id="currency" name="currency">${Object.keys(CURRENCY_MINOR_UNITS).map(currency => `<option value="${currency}"${currency === "COP" ? " selected" : ""}>${html(currencyLabel(currency))}</option>`).join("")}</select><p class="hint">Cada movimiento puede usar otra moneda.</p><fieldset class="start-choice"><legend>Cómo querés empezar</legend><div class="choices"><label class="choice"><input type="radio" name="start" value="zero" checked><span>Empezar en cero</span></label><label class="choice"><input type="radio" name="start" value="splitwise"><span>Traer de Splitwise</span></label><label class="choice"><input type="radio" name="start" value="opening" disabled><span>Saldos anteriores · todavía no disponible</span></label></div><p class="hint">No se guarda ningún dato hasta que confirmes la importación.</p></fieldset><button class="button" type="submit">Crear espacio</button></form>`));
});

app.post("/spaces", async (c) => {
  const user = c.get("protectedUser");
  try {
    const body = await c.req.parseBody();
    const space = await createSpaceForUser(c.env.DB, { userId: user.user_id, name: body.name, defaultCurrency: body.currency || "COP" });
    const target = body.start === "splitwise" ? "/ledger/import" : "";
    return c.redirect(`/spaces/${encodeURIComponent(space.slug)}${target}`, 303);
  } catch {
    return c.html(formError("No pudimos crear el espacio", "Elegí un nombre de hasta 120 caracteres."), 400);
  }
});


app.get("/spaces/:spaceId", async (c) => {
  const started = Date.now();
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const space = await c.env.DB.prepare("SELECT s.id, s.name, s.slug, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("spaceId"), c.req.param("spaceId"), user.user_id).first();
  if (!space) return c.html(formError("Espacio no encontrado", "No tenés acceso a este espacio.", 404), 404);
  const owner = space.role === "owner";
  const [members, invitations, csrf, ledger] = await Promise.all([
    c.env.DB.prepare("SELECT m.user_id, u.display_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? ORDER BY m.role DESC, u.display_name").bind(space.id).all(),
    owner ? c.env.DB.prepare("SELECT id, invitee_email, target_participant_id FROM invitations WHERE space_id = ? AND status = 'pending' ORDER BY created_at").bind(space.id).all() : { results: [] },
    csrfInput(c, user),
    readLedger(c.env.DB, { spaceId: space.id, userId: user.user_id }),
  ]);
  const people = renderPeople({ data: ledger, space, members: members.results, invitations: invitations.results, csrf, owner, userId: user.user_id });
  const batchNotice = await recategorizationNoticeFor(c, user, space, csrf);
  const content = `${batchNotice || noticeFor(c.req.query("aviso"))}${renderBookHead(space, ledger, user.user_id)}${renderLedgerOverview(ledger, { spaceId: space.slug, userId: user.user_id, csrf, query: c.req.query("q") ?? "", category: c.req.query("categoria") ?? "", person: c.req.query("quien") ?? "", recent: recentFor(ledger, c.req.query("nuevo"), c.req.query("aviso")), below: people, limit: Math.min(5000, Math.max(PAGE_SIZE, Number.parseInt(c.req.query("mostrar") ?? "", 10) || PAGE_SIZE)) })}`;
  const slow = slowBookEvent({ elapsedMs: Date.now() - started, entries: ledger.entries.length, participants: ledger.participants.length, categories: ledger.categories.length, requestId: requestId(c) }, c.env.SLOW_BOOK_MS);
  if (slow) console.warn(JSON.stringify(slow));
  return c.html(page("Cuentas Claras", content, { wide: true, spaceHref: `/spaces/${encodeURIComponent(space.slug)}` }));
});

app.post("/spaces/:spaceId/participants", async (c) => {
  const user = c.get("protectedUser");
  try {
    await addParticipant(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, name: (await c.req.parseBody()).name });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=participante`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

registerImportRoutes(app);

registerEntryRoutes(app);

registerCategoryRoutes(app);

registerRecategorizeRoutes(app);

app.get("/spaces/:spaceId/ledger/export.json", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await exportLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    c.header("Content-Disposition", "attachment; filename=cuentas-claras.json");
    c.header("Cache-Control", "private, no-store");
    return c.json(data);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/export.csv", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    c.header("Content-Disposition", "attachment; filename=cuentas-claras.csv");
    c.header("Cache-Control", "private, no-store");
    return c.body(ledgerCsv(data), 200, { "Content-Type": "text/csv; charset=utf-8" });
  } catch (error) { return ledgerFailure(c, error); }
});

for (const [action, archived, notice] of [["archive", true, "archivado"], ["restore", false, "restaurado"]]) {
  app.post(`/spaces/:spaceId/ledger/${action}`, async (c) => {
    const user = c.get("protectedUser");
    try {
      await setLedgerArchived(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, archived });
      return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=${notice}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}

app.post("/spaces/:spaceId/rename", async (c) => {
  const user = c.get("protectedUser");
  try {
    await renameSpace(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, name: (await c.req.parseBody()).name });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=renombrado`, 303);
  } catch {
    return c.html(formError("No pudimos guardar el nombre", "Sólo el titular puede usar un nombre válido."), 403);
  }
});

app.post("/spaces/:spaceId/invitations", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT m.role FROM memberships m JOIN spaces s ON s.id = m.space_id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("spaceId"), c.req.param("spaceId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés invitar", "Sólo el titular puede invitar integrantes.", 403), 403);
  try { await assertLedgerWritable(c.env.DB, c.req.param("spaceId"), user.user_id); } catch (error) { return ledgerFailure(c, error); }
  try {
    const body = await c.req.parseBody();
    await inviteToSpace(c.env.DB, { spaceId: c.req.param("spaceId"), inviterUserId: user.user_id, email: body.email, targetParticipantId: body.targetParticipantId || null });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=invitacion`, 303);
  } catch {
    return c.html(formError("No pudimos crear la invitación", "Usá un email válido que no tenga una invitación pendiente."), 400);
  }
});

app.post("/spaces/:spaceId/invitations/:invitationId/cancel", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT m.role FROM memberships m JOIN spaces s ON s.id = m.space_id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("spaceId"), c.req.param("spaceId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés cancelar", "Sólo el titular puede cancelar invitaciones.", 403), 403);
  try {
    await cancelInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), spaceId: c.req.param("spaceId"), actorUserId: user.user_id });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=cancelada`, 303);
  } catch {
    return c.html(formError("Invitación no encontrada", "La invitación ya no está pendiente.", 404), 404);
  }
});

app.get("/invitations", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS space_name, inviter.display_name AS inviter_name FROM invitations i JOIN spaces s ON s.id = i.space_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending' ORDER BY i.created_at").bind(user.email).all();
  const csrf = await csrfInput(c, user);
  const cards = rows.results.map((row) => `<section class="card"><h2>${html(row.space_name)}</h2><p>Te invitó <strong>${html(row.inviter_name)}</strong>. Antes de aceptar no ves integrantes, movimientos ni saldos.</p><form action="/invitations/${encodeURIComponent(row.id)}" method="post">${csrf}<button class="button" name="decision" value="accept">Aceptar invitación</button><button class="button secondary" name="decision" value="reject">Rechazar</button></form></section>`).join("") || "<p>No tenés invitaciones pendientes.</p>";
  return c.html(page("Invitaciones", `<p class="eyebrow">Cuentas Claras</p><h1>Invitaciones</h1>${cards}<a class="button secondary" href="/">Volver</a>`));
});

app.post("/invitations/:invitationId", async (c) => {
  const user = c.get("protectedUser");
  const body = await c.req.parseBody();
  if (body.decision !== "accept" && body.decision !== "reject") return c.html(formError("Decisión inválida", "Elegí aceptar o rechazar la invitación."), 400);
  try {
    const accepted = body.decision === "accept";
    const spaceId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.user_id, email: user.email, accepted });
    const space = accepted ? await resolveSpace(c.env.DB, spaceId) : null;
    return c.redirect(space ? `/spaces/${encodeURIComponent(space.slug)}` : "/invitations", 303);
  } catch {
    return c.html(formError("Invitación no encontrada", "La invitación no existe, ya fue resuelta o no te corresponde.", 404), 404);
  }
});

function spaceRow(space) {
  return `<div class="person-row">${avatar(space.name, { seed: space.id })}<div class="grow"><a href="/spaces/${encodeURIComponent(space.slug)}"><strong>${html(space.name)}</strong></a><span class="muted">${space.role === "owner" ? "Titular" : "Integrante"}</span></div></div>`;
}

app.get("/cuentas-claras", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const rows = await c.env.DB.prepare("SELECT s.id, s.name, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE m.user_id = ? ORDER BY s.name").bind(user.user_id).all();
  const listed = await Promise.all(rows.results.map(async row => ({ ...row, slug: (await resolveSpace(c.env.DB, row.id)).slug })));
  if (listed.length === 1) return c.redirect(`/spaces/${encodeURIComponent(listed[0].slug)}`, 303);
  const spaces = listed.map((space) => spaceRow(space)).join("") || "<p>No tenés espacios todavía.</p>";
  return c.html(page("Cuentas Claras", `<p class="eyebrow">Cuentas Claras</p><h1>Elegí un espacio.</h1><p>Cada espacio conserva sus integrantes y, cuando exista, su propia historia de movimientos.</p><section class="card">${spaces}<a class="button" href="/spaces/new">Crear espacio</a></section>`));
});

registerAssetRoutes(app);

app.get("/", async (c) => {
  if (c.env?.DEV_LOCAL_MODE === "true") {
    const { index } = startDemoPair();
    return c.html(page("Bienvenida", `<p class="eyebrow">Cuentas Claras</p><h1>Lo compartido, más claro.</h1><p>Un lugar privado para organizar las cuentas de tu casa, viaje o proyecto.</p><section class="card"><h2>Empezá con tu cuenta</h2><p>Este es un recorrido local de prueba: guarda datos solamente en D1 local.</p><a class="button" href="/demo/crear-espacio?${demoQuery(index)}">Continuar con Google</a></section>`));
  }
  const config = authConfig(c.env);
  const session = await signedInUser(c);
  if (session) {
    const spaces = await c.env.DB.prepare("SELECT s.id, s.name, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE m.user_id = ? ORDER BY s.name").bind(session.user_id).all();
    const pending = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM invitations WHERE invitee_email = ? AND status = 'pending'").bind(session.email).first();
    const listed = await Promise.all(spaces.results.map(async row => ({ ...row, slug: (await resolveSpace(c.env.DB, row.id)).slug })));
    const list = listed.length ? listed.map((space) => spaceRow(space)).join("") : "<p>Todavía no formás parte de ningún espacio.</p>";
    return c.html(page("HomeSuite", `<p class="eyebrow">HomeSuite</p><h1>Hola, ${html(session.display_name)}.</h1><p>Elegí un espacio o creá el primero para empezar con Cuentas Claras.</p><section class="card"><h2>Tus espacios</h2>${list}<a class="button" href="/spaces/new">Crear espacio</a><a class="button secondary" href="/invitations">Invitaciones${pending.count ? ` (${pending.count})` : ""}</a></section><form action="/auth/logout" method="post">${await csrfInput(c, session)}<button class="button secondary">Cerrar sesión</button></form>`));
  }
  const action = config ? `<a class="button" href="/auth/google?returnTo=%2F">Continuar con Google</a>` : "<p class=\"notice\">El acceso de este ambiente todavía no está configurado.</p>";
  return c.html(page("Bienvenida", `<p class="eyebrow">Cuentas Claras</p><h1>Lo compartido, más claro.</h1><p>Un lugar privado para organizar las cuentas de tu casa, viaje o proyecto.</p><section class="card"><h2>Empezá con tu cuenta</h2><p>Entrá con Google para acceder a HomeSuite.</p>${action}</section>`));
});

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
  logFailure(c, "unhandled_error", error);
  return c.json({ error: "Error interno.", requestId: requestId(c) }, 500);
});

export default {
  fetch: app.fetch,
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runMaintenance(env.DB).then((result) => {
      console.log("[homesuite-app]", JSON.stringify({ event: "maintenance_completed", ...result }));
    }));
  },
};
