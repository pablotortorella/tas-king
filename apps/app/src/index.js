import { Hono } from "hono";
import { cookie, createGoogleAuthorization, exchangeGoogleCode, getCookie, seal, unseal, validateGoogleIdToken, validReturnTo } from "./auth.js";
import { createCsrfToken, inspectCsrfRequest } from "./csrf.js";
import { CURRENCY_MINOR_UNITS, currencyLabel, FinancialValidationError } from "./finance.js";
import { addParticipant, exportLedger, getLedgerAccess, LedgerError, readLedger, saveEntry, voidEntry } from "./ledger.js";
import { escapeHtml, ledgerCsv, parseEntryForm, renderEntryDetail, renderEntryForm, renderLedgerOverview } from "./ledger-ui.js";
import { runMaintenance } from "./maintenance.js";
import { checkRateLimit, RATE_LIMIT_RETRY_SECONDS } from "./rate-limit.js";
import { createSession, currentSession, expiredSessionCookie, revokeSession, sessionCookie } from "./sessions.js";
import { cancelInvitation, createSpaceForUser, ensureLocalUser, inviteToSpace, renameSpace, resolveInvitation } from "./spaces.js";
import { GoogleIdentityConflictError, upsertGoogleUser } from "./users.js";
import { buildImportPlan, cancelImportPreview, commitImportPreview, createImportPreview, readImportBatch, readImportPreview, reviewImportPreview } from "./splitwise-import.js";
import { renderImportBatch, renderImportPreview, renderImportReview, renderImportUpload } from "./splitwise-ui.js";

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

function sessionSecret(env = {}) {
  return typeof env.SESSION_SECRET === "string" && env.SESSION_SECRET.length >= 32 ? env.SESSION_SECRET : null;
}

function authConfig(env = {}) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
  const secret = sessionSecret(env);
  return typeof clientId === "string" && typeof clientSecret === "string" && secret
    ? { clientId, clientSecret, sessionSecret: secret }
    : null;
}

async function signedInUser(c) {
  const secret = sessionSecret(c.env);
  return secret ? currentSession(c.env.DB, c.req.raw, secret) : null;
}

function signInRequired(c) {
  return c.redirect(`/auth/google?returnTo=${encodeURIComponent(new URL(c.req.url).pathname)}`, 303);
}

function formError(title, message, status = 400) {
  return page(title, `<p class="eyebrow">Cuentas Claras</p><h1>${html(title)}</h1><p class="notice" role="alert">${html(message)}</p><a class="button secondary" href="/">Volver</a>`);
}

function ledgerFailure(c, error) {
  if (!(error instanceof LedgerError) && !(error instanceof FinancialValidationError)) throw error;
  const status = error.status ?? 400;
  if (c.req.header("Accept")?.includes("application/json")) return c.json({ error: error.message }, status);
  return c.html(formError("No pudimos guardar", error.message), status);
}

function requestId(c) {
  return c.get("requestId") ?? "unknown";
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

function page(title, content) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(title)} · HomeSuite</title><link rel="stylesheet" href="/app.css"><script src="/ledger-ui.js" defer></script><body><main class="shell"><a class="brand" href="/">⌂ HomeSuite</a>${content}</main></body></html>`;
}

function html(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function csrfInput(c, user) {
  const token = await createCsrfToken({ sessionId: user.id, secret: sessionSecret(c.env) });
  return `<input type="hidden" name="_csrf" value="${html(token)}">`;
}

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
  return c.redirect(invitation ? "/invitations" : "/spaces/new", 303);
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



app.get("/spaces/new", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  return c.html(page("Crear espacio", `<p class="eyebrow">Cuentas Claras</p><h1>Nuevo grupo</h1><form class="card" method="post" action="/spaces">${await csrfInput(c, user)}<label class="label" for="nombre">Nombre</label><input id="nombre" name="name" required maxlength="120" autocomplete="organization"><label class="label" for="currency">Moneda predeterminada</label><select id="currency" name="currency">${Object.keys(CURRENCY_MINOR_UNITS).map(currency => `<option value="${currency}"${currency === "COP" ? " selected" : ""}>${html(currencyLabel(currency))}</option>`).join("")}</select><button class="button" type="submit">Crear espacio</button></form>`));
});

app.post("/spaces", async (c) => {
  const user = c.get("protectedUser");
  try {
    const body = await c.req.parseBody();
    const space = await createSpaceForUser(c.env.DB, { userId: user.user_id, name: body.name, defaultCurrency: body.currency || "COP" });
    return c.redirect(`/spaces/${encodeURIComponent(space.id)}`, 303);
  } catch {
    return c.html(formError("No pudimos crear el espacio", "Elegí un nombre de hasta 120 caracteres."), 400);
  }
});

app.get("/spaces/:spaceId", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const space = await c.env.DB.prepare("SELECT s.id, s.name, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE s.id = ? AND m.user_id = ?").bind(c.req.param("spaceId"), user.user_id).first();
  if (!space) return c.html(formError("Espacio no encontrado", "No tenés acceso a este espacio.", 404), 404);
  const members = await c.env.DB.prepare("SELECT u.display_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? ORDER BY m.role DESC, u.display_name").bind(space.id).all();
  const invitations = space.role === "owner" ? await c.env.DB.prepare("SELECT id, invitee_email FROM invitations WHERE space_id = ? AND status = 'pending' ORDER BY created_at").bind(space.id).all() : { results: [] };
  const csrf = await csrfInput(c, user);
  const ledger = await readLedger(c.env.DB, { spaceId: space.id, userId: user.user_id });
  const participants = members.results.map((member) => `<div class="person"><strong>${html(member.display_name)}</strong><br><span class="muted">${member.role === "owner" ? "Titular" : "Integrante"}</span></div>`).join("");
  const pending = invitations.results.map((invitation) => `<div class="person"><strong>${html(invitation.invitee_email)}</strong><br><span class="muted">Invitación pendiente</span><form action="/spaces/${encodeURIComponent(space.id)}/invitations/${encodeURIComponent(invitation.id)}/cancel" method="post">${csrf}<button class="button secondary">Cancelar invitación</button></form></div>`).join("");
  const nominalOptions = ledger.participants.filter(person => !person.linkedUserId && person.active).map(person => `<option value="${html(person.id)}">${html(person.displayName)}</option>`).join("");
  const ownerTools = space.role === "owner" ? `<section class="ledger-section"><h2>Administrar grupo</h2><form action="/spaces/${encodeURIComponent(space.id)}/participants" method="post">${csrf}<label class="label" for="participant-name">Participante sin cuenta</label><input id="participant-name" name="name" required maxlength="120"><button class="button secondary">Agregar participante</button></form><form action="/spaces/${encodeURIComponent(space.id)}/rename" method="post">${csrf}<label class="label" for="space-name">Nombre del grupo</label><input id="space-name" name="name" required maxlength="120" value="${html(space.name)}"><button class="button secondary">Guardar nombre</button></form><form action="/spaces/${encodeURIComponent(space.id)}/invitations" method="post">${csrf}<label class="label" for="email">Invitar por email</label><input id="email" name="email" type="email" required autocomplete="email"><label class="label" for="target-participant">Vincular con participante (opcional)</label><select id="target-participant" name="targetParticipantId"><option value="">Crear uno nuevo</option>${nominalOptions}</select><button class="button">Invitar</button></form>${pending}</section>` : "";
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${html(space.role === "owner" ? "Titular" : "Integrante")}</p><h1>${html(space.name)}</h1>${renderLedgerOverview(ledger, { spaceId: space.id, userId: user.user_id, query: c.req.query("q") ?? "" })}<section class="ledger-section"><h2>Integrantes</h2>${participants}</section>${ownerTools}<a class="button secondary" href="/cuentas-claras">Cambiar grupo</a>`));
});

app.post("/spaces/:spaceId/participants", async (c) => {
  const user = c.get("protectedUser");
  try {
    await addParticipant(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, name: (await c.req.parseBody()).name });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/import", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const ledger = await getLedgerAccess(c.env.DB, c.req.param("spaceId"), user.user_id);
    if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede importar.", 403);
    return c.html(page("Importar Splitwise", renderImportUpload({ spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user) })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/import/preview", async (c) => {
  const user = c.get("protectedUser");
  try {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) throw new LedgerError("Seleccioná un CSV de hasta 2 MiB.", 413);
    const result = await createImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, fileName: file.name, csvText: await file.text() });
    const base = `/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/import`;
    return c.redirect(result.batchId ? `${base}/batches/${encodeURIComponent(result.batchId)}` : `${base}/previews/${encodeURIComponent(result.previewId)}`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/import/previews/:previewId", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const preview = await readImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId") });
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    return c.html(page("Previsualizar Splitwise", renderImportPreview({ spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), preview, participants: data.participants.filter(person => person.active) })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/import/previews/:previewId/review", async (c) => {
  const user = c.get("protectedUser");
  try {
    const preview = await readImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId") });
    const form = await c.req.formData();
    const mapping = preview.parsed.participantNames.map((_, index) => form.get(`mapping_${index}`));
    const decisions = preview.parsed.incidents.map((_, index) => form.get(`decision_${index}`));
    await reviewImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId"), mapping, decisions });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/import/previews/${encodeURIComponent(c.req.param("previewId"))}/review`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/import/previews/:previewId/review", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const preview = await readImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId") });
    if (!preview.review) throw new LedgerError("Revisá el archivo antes de confirmar.");
    const plan = buildImportPlan(preview.parsed, preview.review, preview.ledger.default_currency);
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    return c.html(page("Confirmar Splitwise", renderImportReview({ spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), preview, plan, participants: data.participants })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/import/previews/:previewId/cancel", async (c) => {
  const user = c.get("protectedUser");
  try {
    await cancelImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId") });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/import/previews/:previewId/confirm", async (c) => {
  const user = c.get("protectedUser");
  try {
    const form = await c.req.formData();
    const batchId = await commitImportPreview(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, previewId: c.req.param("previewId"), acknowledgeDifference: form.get("acknowledgeDifference") === "yes" });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/import/batches/${encodeURIComponent(batchId)}`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/import/batches/:batchId", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const batch = await readImportBatch(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, batchId: c.req.param("batchId") });
    return c.html(page("Importación Splitwise", renderImportBatch({ spaceId: c.req.param("spaceId"), batch })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/new", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    if (data.ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
    const type = ["expense", "income", "transfer"].includes(c.req.query("type")) ? c.req.query("type") : "expense";
    return c.html(page("Agregar movimiento", renderEntryForm(data, { spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), userId: user.user_id, type })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/entries", async (c) => {
  const user = c.get("protectedUser");
  try {
    const form = await c.req.formData();
    const saved = await saveEntry(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, input: parseEntryForm(form), idempotencyKey: form.get("idempotencyKey") });
    const location = `/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/entries/${encodeURIComponent(saved.id)}`;
    return c.req.header("Accept")?.includes("application/json") ? c.json({ ...saved, location }, 201) : c.redirect(location, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/entries/:entryId", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    const entry = data.entries.find(row => row.id === c.req.param("entryId"));
    if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
    const revisions = entry.imported ? { results: [] } : await c.env.DB.prepare("SELECT r.revision, r.action, r.created_at, r.snapshot_json, u.display_name AS actor_name FROM entry_revisions r JOIN users u ON u.id = r.actor_user_id WHERE r.ledger_id = ? AND r.entry_id = ? ORDER BY r.revision").bind(data.ledger.id, entry.id).all();
    return c.html(page(entry.description, renderEntryDetail(entry, data, { spaceId: c.req.param("spaceId"), userId: user.user_id, revisions: revisions.results })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/entries/:entryId/edit", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    const entry = data.entries.find(row => row.id === c.req.param("entryId"));
    if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
    if (entry.status !== "active" || (data.ledger.role !== "owner" && entry.createdByUserId !== user.user_id)) throw new LedgerError("No podés corregir este movimiento.", 403);
    return c.html(page("Corregir movimiento", renderEntryForm(data, { spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), userId: user.user_id, entry })));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/entries/:entryId/edit", async (c) => {
  const user = c.get("protectedUser");
  try {
    const form = await c.req.formData();
    const saved = await saveEntry(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, entryId: c.req.param("entryId"), expectedRevision: Number(form.get("expectedRevision")), input: parseEntryForm(form), idempotencyKey: form.get("idempotencyKey") });
    const location = `/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/entries/${encodeURIComponent(saved.id)}`;
    return c.req.header("Accept")?.includes("application/json") ? c.json({ ...saved, location }) : c.redirect(location, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/spaces/:spaceId/ledger/entries/:entryId/void", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
    const entry = data.entries.find(row => row.id === c.req.param("entryId"));
    if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
    if (entry.status !== "active" || (data.ledger.role !== "owner" && entry.createdByUserId !== user.user_id)) throw new LedgerError("No podés anular este movimiento.", 403);
    const spacePath = `/spaces/${encodeURIComponent(c.req.param("spaceId"))}`;
    return c.html(page("Anular movimiento", `<p class="eyebrow">Cuentas Claras</p><h1>Anular ${escapeHtml(entry.description)}</h1><p>El movimiento dejará de afectar los saldos y seguirá visible en el historial.</p><form class="ledger-form" method="post" action="${spacePath}/ledger/entries/${encodeURIComponent(entry.id)}/void">${await csrfInput(c, user)}<input type="hidden" name="expectedRevision" value="${entry.revision}"><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}"><label>Motivo (opcional)<textarea name="reason" maxlength="1000" rows="2"></textarea></label><div class="form-actions"><button class="button" type="submit">Confirmar anulación</button><a class="button secondary" href="${spacePath}/ledger/entries/${encodeURIComponent(entry.id)}">Cancelar</a></div></form>`));
  } catch (error) { return ledgerFailure(c, error); }
});

app.post("/spaces/:spaceId/ledger/entries/:entryId/void", async (c) => {
  const user = c.get("protectedUser");
  try {
    const form = await c.req.formData();
    await voidEntry(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, entryId: c.req.param("entryId"), expectedRevision: Number(form.get("expectedRevision")), idempotencyKey: form.get("idempotencyKey"), reason: form.get("reason") });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/entries/${encodeURIComponent(c.req.param("entryId"))}`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

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

app.post("/spaces/:spaceId/rename", async (c) => {
  const user = c.get("protectedUser");
  try {
    await renameSpace(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, name: (await c.req.parseBody()).name });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}`, 303);
  } catch {
    return c.html(formError("No pudimos guardar el nombre", "Sólo el titular puede usar un nombre válido."), 403);
  }
});

app.post("/spaces/:spaceId/invitations", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(c.req.param("spaceId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés invitar", "Sólo el titular puede invitar integrantes.", 403), 403);
  try {
    const body = await c.req.parseBody();
    await inviteToSpace(c.env.DB, { spaceId: c.req.param("spaceId"), inviterUserId: user.user_id, email: body.email, targetParticipantId: body.targetParticipantId || null });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}`, 303);
  } catch {
    return c.html(formError("No pudimos crear la invitación", "Usá un email válido que no tenga una invitación pendiente."), 400);
  }
});

app.post("/spaces/:spaceId/invitations/:invitationId/cancel", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(c.req.param("spaceId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés cancelar", "Sólo el titular puede cancelar invitaciones.", 403), 403);
  try {
    await cancelInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), spaceId: c.req.param("spaceId"), actorUserId: user.user_id });
    return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}`, 303);
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
    return c.redirect(accepted ? `/spaces/${encodeURIComponent(spaceId)}` : "/invitations", 303);
  } catch {
    return c.html(formError("Invitación no encontrada", "La invitación no existe, ya fue resuelta o no te corresponde.", 404), 404);
  }
});

app.get("/cuentas-claras", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const rows = await c.env.DB.prepare("SELECT s.id, s.name, m.role FROM spaces s JOIN memberships m ON m.space_id = s.id WHERE m.user_id = ? ORDER BY s.name").bind(user.user_id).all();
  if (rows.results.length === 1) return c.redirect(`/spaces/${encodeURIComponent(rows.results[0].id)}`, 303);
  const spaces = rows.results.map((space) => `<div class="person"><a href="/spaces/${encodeURIComponent(space.id)}"><strong>${html(space.name)}</strong></a><br><span class="muted">${space.role === "owner" ? "Titular" : "Integrante"}</span></div>`).join("") || "<p>No tenés espacios todavía.</p>";
  return c.html(page("Cuentas Claras", `<p class="eyebrow">Cuentas Claras</p><h1>Elegí un espacio.</h1><p>Cada espacio conserva sus integrantes y, cuando exista, su propia historia de movimientos.</p><section class="card">${spaces}<a class="button" href="/spaces/new">Crear espacio</a></section>`));
});

const LEDGER_STYLES = `
select,textarea{width:100%;padding:13px;border:1px solid #b8b1a5;border-radius:8px;background:#fff;font:inherit;color:#20342a}
button{cursor:pointer}.ledger-section{border-top:1px solid #d9d0c0;padding:28px 0;margin-top:28px}.ledger-section h2{font-size:1.65rem}.section-top,.form-actions,.quick-actions,.export-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.section-top .eyebrow{margin:0}.section-top .button{margin:0}.quick-actions{justify-content:flex-start;margin-top:18px}.quick-actions a,.export-actions a{color:#206447;font-weight:700}.balance-table{width:100%;border-collapse:collapse;text-align:left}.balance-table th,.balance-table td{padding:12px 8px;border-bottom:1px solid #ded7ca}.balance-table th:last-child,.balance-table td:last-child{text-align:right}.money{font-variant-numeric:tabular-nums;white-space:nowrap}.owes{color:#a0352d}.owed{color:#206447}.entry-list{list-style:none;padding:0;margin:0}.entry-row{border-bottom:1px solid #ded7ca}.entry-row a{display:flex;justify-content:space-between;gap:16px;padding:14px 0;color:inherit;text-decoration:none}.entry-row small{display:block;color:#68766d;margin-top:4px}.entry-voided{opacity:.7}.entry-amount{font-size:1.5rem;color:#20342a}.ledger-form{display:grid;gap:18px;margin-top:24px}.ledger-form label{display:grid;gap:7px;font-weight:700}.ledger-form fieldset{border:1px solid #d9d0c0;padding:15px}.ledger-form legend{font-weight:800}.form-grid,.share-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.ledger-form .check-row{display:flex;align-items:center;gap:9px;margin:8px 0;font-weight:400}.check-row input{width:auto}.ledger-form .button{margin:0}.form-actions{justify-content:flex-start}.form-feedback{margin:0}.pending-entry{border:1px solid #d9d0c0;padding:12px;color:#52665b}.ledger-section ol{padding-left:20px;line-height:1.8}
.search-form{display:grid;grid-template-columns:auto 1fr auto;align-items:end;gap:10px;margin:16px 0}.search-form label{font-weight:700}.search-form .button{margin:0}.incident-row{display:grid;grid-template-columns:auto 1fr minmax(170px,230px);gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #ded7ca}.incident-row span{min-width:0;overflow-wrap:anywhere}.table-scroll{overflow-x:auto}.table-scroll .balance-table{min-width:650px}.ledger-form input[type=file]{font:inherit}.ledger-form .check-row input[type=checkbox]{width:auto}
@media(max-width:560px){.shell{padding:20px 16px 56px}.section-top{align-items:flex-start}.section-top .button{width:100%;text-align:center}.balance-table th,.balance-table td{padding:10px 4px;font-size:.88rem}.form-grid,.share-grid{grid-template-columns:1fr}.entry-row a{align-items:flex-start}.entry-row .money{font-size:.9rem}.form-actions .button{flex:1;text-align:center}.search-form{grid-template-columns:1fr}.incident-row{grid-template-columns:1fr}}
`;

app.get("/app.css", (c) => c.body(`:root{font-family:system-ui,sans-serif;color:#20342a;background:#f7f2e8}*{box-sizing:border-box}body{margin:0}.shell{max-width:720px;margin:auto;padding:32px 24px 72px}.brand{color:#206447;text-decoration:none;font-weight:800}.eyebrow{color:#d95f46;font-size:.8rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-top:72px}h1{font-family:Georgia,serif;font-size:clamp(2.7rem,9vw,4.8rem);line-height:1;margin:14px 0 22px}h2{font-family:Georgia,serif;font-size:2rem;margin:0 0 12px}p{font-size:1.1rem;line-height:1.6;color:#52665b}.card{background:#fffaf0;border:1px solid #d9d0c0;border-radius:18px;padding:24px;margin-top:28px}.button{display:inline-block;background:#206447;color:white;border:0;border-radius:999px;padding:14px 20px;text-decoration:none;font-weight:800;margin-top:14px}.button.secondary{background:transparent;color:#206447;border:1px solid #206447}.label{font-weight:800;display:block;margin:20px 0 7px}input{width:100%;padding:13px;border:1px solid #b8b1a5;border-radius:9px;font:inherit}.notice{background:#e6f0e9;border-radius:10px;padding:14px;color:#28533c;font-size:.95rem}.person{border-top:1px solid #ddd3c3;padding:15px 0}.muted{font-size:.9rem;color:#68766d}${LEDGER_STYLES}` , 200, { "Content-Type": "text/css; charset=utf-8" }));

app.get("/ledger-ui.js", (c) => c.body(`document.querySelectorAll("form[data-optimistic]").forEach(form=>form.addEventListener("submit",async event=>{if(!form.reportValidity())return;event.preventDefault();const button=form.querySelector('button[type="submit"]');const feedback=form.querySelector(".form-feedback");const data=new FormData(form);const preview=document.createElement("p");preview.className="pending-entry";preview.textContent=[data.get("description"),data.get("amount"),data.get("currency"),"pendiente"].filter(Boolean).join(" · ");feedback.before(preview);feedback.textContent="Guardando movimiento…";button.disabled=true;try{const response=await fetch(form.action,{method:"POST",body:data,headers:{Accept:"application/json"},credentials:"same-origin"});const result=await response.json();if(!response.ok)throw new Error(result.error||"No pudimos guardar el movimiento.");location.assign(result.location)}catch(error){preview.remove();feedback.textContent=error.message;button.disabled=false}}));`, 200, { "Content-Type": "text/javascript; charset=utf-8" }));

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
    const list = spaces.results.length ? spaces.results.map((space) => `<div class="person"><a href="/spaces/${encodeURIComponent(space.id)}"><strong>${html(space.name)}</strong></a><br><span class="muted">${space.role === 'owner' ? 'Titular' : 'Integrante'}</span></div>`).join("") : "<p>Todavía no formás parte de ningún espacio.</p>";
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
