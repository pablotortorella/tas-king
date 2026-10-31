import { Hono } from "hono";
import { cookie, createGoogleAuthorization, decodeCookieValue, exchangeGoogleCode, getCookie, seal, unseal, validateGoogleIdToken, validReturnTo } from "./auth.js";
import { createCsrfToken, inspectCsrfRequest } from "./csrf.js";
import { registerProfileRoutes } from "./profile-routes.js";
import { registerRemansoRoutes } from "./remanso.js";
import { registerJardinZenRoutes } from "./jardin-zen.js";
import { readOwnProfile } from "./profiles.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerEntryRoutes, recentFor } from "./routes/entries.js";
import { registerImportRoutes } from "./routes/import.js";
import { recategorizationNoticeFor, registerRecategorizeRoutes } from "./routes/recategorize.js";
import { registerGroupSettingsRoutes } from "./routes/group-settings.js";
import { registerPeopleRoutes } from "./routes/people.js";
import { registerShellRoutes } from "./routes/shell.js";
import { fillAccount } from "./account-ui.js";
import { groupMenuItems, groupSwitch, renderGroupList } from "./group-ui.js";
import { entryTarget, lastGroupCookie, readLastGroup } from "./last-group.js";
import { csrfInput, formError, ledgerFailure, page, requestId, sessionSecret, signedInUser, signInRequired } from "./route-kit.js";
import { CURRENCY_MINOR_UNITS, currencyLabel } from "./finance.js";
import { addParticipant, exportLedger, readLedger } from "./ledger.js";
import { ledgerCsv } from "./ledger-ui.js";
import { assertLedgerWritable, setLedgerArchived } from "./ledger-admin.js";
import { PAGE_SIZE, renderBookHead, renderLedgerOverview } from "./overview-ui.js";
import { slowBookEvent } from "./perf.js";
import { ACCOUNT_MARKER, avatar, escapeHtml, GROUP_MARKER, GROUP_MENU_MARKER, noticeFor } from "./ui-parts.js";
import { runMaintenance } from "./maintenance.js";
import { checkRateLimit, RATE_LIMIT_RETRY_SECONDS } from "./rate-limit.js";
import { createSession, currentSession, expiredSessionCookie, revokeSession, sessionCookie } from "./sessions.js";
import { cancelInvitation, createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation, resolveGroup } from "./groups.js";
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
  return path === "/auth/logout" || path === "/groups" || path.startsWith("/groups/") || path.startsWith("/invitations/");
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
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/groups/") || path.startsWith("/api/") || ["/", "/cuentas-claras", "/tareas", "/perfil", "/remanso", "/jardin-zen"].includes(path)) c.header("Cache-Control", "private, no-store");
});

// Reemplaza las marcas de cuenta del encabezado en las páginas HTML con la persona que tiene sesión (si la hay).
app.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.get("Content-Type")?.includes("text/html")) return;
  const body = await c.res.clone().text();
  if (!body.includes(ACCOUNT_MARKER)) return;
  const session = await signedInUser(c);
  const profile = session ? await readOwnProfile(c.env.DB, session.user_id) : null;
  const secret = sessionSecret(c.env);
  const csrfField = session && secret ? `<input type="hidden" name="_csrf" value="${html(await createCsrfToken({ sessionId: session.id, secret }))}">` : "";
  c.res = new Response(fillAccount(body, profile, csrfField), c.res);
});

// En las pantallas de un grupo: completa el encabezado con el grupo (nombre con avatar que lleva a la lista) y el menú con sus secciones
// (y «Administrar grupo» para la persona titular), y recuerda el grupo en una cookie del navegador para volver a él al entrar a
// Cuentas Claras. Fuera de un grupo quita las marcas.
const GROUP_PAGE = /^\/groups\/([^/]+)(?:\/|$)/u;
app.use("*", async (c, next) => {
  await next();
  if (c.req.method !== "GET" || !c.res.headers.get("Content-Type")?.includes("text/html")) return;
  const body = await c.res.clone().text();
  if (!body.includes(GROUP_MARKER)) return;
  const key = GROUP_PAGE.exec(new URL(c.req.url).pathname)?.[1];
  const user = key && key !== "new" ? await signedInUser(c) : null;
  const row = user ? await c.env.DB.prepare("SELECT g.id, g.name, g.slug, g.description, g.avatar_emoji, g.avatar_color, m.role FROM groups g JOIN memberships m ON m.group_id = g.id WHERE (g.id = ? OR g.slug = ?) AND m.user_id = ?").bind(key, key, user.user_id).first() : null;
  c.res = new Response(body.replace(GROUP_MARKER, row ? groupSwitch(row) : "").replace(GROUP_MENU_MARKER, row ? groupMenuItems(row, row.role) : ""), c.res);
  if (row && c.res.status === 200) c.res.headers.append("Set-Cookie", lastGroupCookie(row.id, isSecureRequest(c)));
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

// Los PATCH del perfil (propio y por grupo) llevan JSON y se protegen aquí: sesión, límite de escrituras y CSRF.
app.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (c.req.method !== "PATCH" || (path !== "/api/me/profile" && !/^\/api\/groups\/[^/]+\/me\/presentation$/u.test(path))) return next();
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
  return c.req.query("as") || c.req.header("X-HomeSuite-Dev-Email") || c.env.DEV_LOCAL_EMAIL || null;
}

registerProfileRoutes(app, { signedInUser, localUser, ensureLocalUser });
registerRemansoRoutes(app, { page, html, signedInUser, localUser, ensureLocalUser, googleConfigured: (env) => Boolean(authConfig(env)) });
registerJardinZenRoutes(app, { page });

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

app.get("/api/local/session", async (c) => {
  const email = localUser(c);
  const secret = sessionSecret(c.env);
  if (!email || !secret) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const session = await createSession(c.env.DB, { userId: user.id, secret });
  setCookie(c, sessionCookie(session.token, true));
  const invitation = await c.env.DB.prepare("SELECT id FROM invitations WHERE invitee_email = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP LIMIT 1").bind(user.email).first();
  const membership = invitation ? null : await c.env.DB.prepare("SELECT 1 AS found FROM memberships WHERE user_id = ? LIMIT 1").bind(user.id).first();
  return c.redirect(invitation ? "/invitations" : membership ? "/cuentas-claras" : "/groups/new", 303);
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
  const state = raw ? await unseal(decodeCookieValue(raw), config.sessionSecret) : null;
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

app.post("/api/local/groups", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.json();
  const group = await createGroupForUser(c.env.DB, { userId: user.id, name: body.name });
  return c.json(group, 201);
});

app.post("/local/groups", async (c) => {
  const email = localUser(c);
  if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  const group = await createGroupForUser(c.env.DB, { userId: user.id, name: body.name });
  return c.redirect(`/local/groups/${group.id}`, 303);
});

app.get("/local/groups/:groupId", async (c) => {
  const email = localUser(c);
  if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const group = await c.env.DB.prepare("SELECT s.name, m.role FROM groups s JOIN memberships m ON m.group_id = s.id WHERE s.id = ? AND m.user_id = ?").bind(c.req.param("groupId"), user.id).first();
  if (!group) return c.text("Grupo no encontrado.", 404);
  const invitations = group.role === "owner" ? await c.env.DB.prepare("SELECT invitee_email FROM invitations WHERE group_id = ? AND status = 'pending'").bind(c.req.param("groupId")).all() : { results: [] };
  const members = await c.env.DB.prepare("SELECT u.display_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.role DESC, u.display_name").bind(c.req.param("groupId")).all();
  const participants = members.results.map(member => `<div class="person"><strong>${html(member.display_name)}</strong><br><span class="muted">${member.role === "owner" ? "Titular" : "Integrante"}</span></div>`).join("");
  const pending = invitations.results.map(row => `<div class="person"><strong>${html(row.invitee_email)}</strong><br><span class="muted">Invitación pendiente</span><br><a class="button secondary" href="/local/invitations?as=${encodeURIComponent(row.invitee_email)}">Ver como invitada</a></div>`).join("");
  const management = group.role === "owner" ? `<section class="card"><h2>Participantes</h2>${participants}<h2>Invitar</h2><form action="/local/groups/${c.req.param("groupId")}/invitations" method="post"><label class="label" for="local-invite-email">Email</label><input id="local-invite-email" name="email" type="email" required placeholder="link@example.test"><button class="button">Invitar</button></form>${pending}</section>` : `<section class="card"><h2>Participantes</h2>${participants}<p>Como integrante podés acceder a Cuentas Claras. La administración de participantes queda en manos del titular.</p></section>`;
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${html(group.name)} · ${group.role === "owner" ? "Titular" : "Integrante"}</p><h1>Cuentas Claras está lista.</h1><p>Este grupo ya existe en D1 local. Todavía no inventamos saldos ni movimientos.</p>${management}`));
});

app.post("/local/groups/:groupId/invitations", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  await inviteToGroup(c.env.DB, { groupId: c.req.param("groupId"), inviterUserId: user.id, email: body.email });
  return c.redirect(`/local/groups/${c.req.param("groupId")}`, 303);
});

app.get("/local/invitations", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS group_name, inviter.display_name AS inviter_name FROM invitations i JOIN groups s ON s.id = i.group_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending'").bind(user.email).all();
  const cards = rows.results.map(row => `<section class="card"><h2>${html(row.group_name)}</h2><p>Te invitó <strong>${html(row.inviter_name)}</strong>. Antes de aceptar no ves integrantes, movimientos ni saldos.</p><form action="/local/invitations/${row.id}?as=${encodeURIComponent(user.email)}" method="post"><button class="button" name="decision" value="accept">Aceptar invitación</button><button class="button secondary" name="decision" value="reject">Rechazar</button></form></section>`).join("") || "<p>No tenés invitaciones pendientes.</p>";
  return c.html(page("Invitaciones", `<p class="eyebrow">Cuentas Claras</p><h1>Invitaciones</h1>${cards}`));
});

app.post("/local/invitations/:invitationId", async (c) => {
  const email = localUser(c); if (!email) return c.text("Ruta local no disponible.", 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const body = await c.req.parseBody();
  const accepted = body.decision === "accept";
  const groupId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.id, email: user.email, accepted });
  return c.redirect(accepted ? `/local/groups/${groupId}?as=${encodeURIComponent(user.email)}` : `/local/invitations?as=${encodeURIComponent(user.email)}`, 303);
});

app.post("/api/local/groups/:groupId/invitations", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE group_id = ? AND user_id = ?").bind(c.req.param("groupId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede invitar." }, 403);
  const body = await c.req.json();
  const invitation = await inviteToGroup(c.env.DB, { groupId: c.req.param("groupId"), inviterUserId: user.id, email: body.email });
  return c.json(invitation, 201);
});

app.get("/api/local/groups/:groupId/invitations", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE group_id = ? AND user_id = ?").bind(c.req.param("groupId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede ver invitaciones." }, 403);
  const rows = await c.env.DB.prepare("SELECT id, invitee_email AS email, status FROM invitations WHERE group_id = ? ORDER BY created_at").bind(c.req.param("groupId")).all();
  return c.json(rows.results);
});

app.delete("/api/local/groups/:groupId/invitations/:invitationId", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const membership = await c.env.DB.prepare("SELECT role FROM memberships WHERE group_id = ? AND user_id = ?").bind(c.req.param("groupId"), user.id).first();
  if (membership?.role !== "owner") return c.json({ error: "Sólo el titular puede cancelar invitaciones." }, 403);
  await cancelInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), groupId: c.req.param("groupId"), actorUserId: user.id });
  return c.body(null, 204);
});

app.get("/api/local/invitations/pending", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const user = await ensureLocalUser(c.env.DB, email);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS group_name, inviter.display_name AS inviter_name FROM invitations i JOIN groups s ON s.id = i.group_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending'").bind(user.email).all();
  return c.json(rows.results);
});

app.post("/api/local/invitations/:invitationId/:decision", async (c) => {
  const email = localUser(c);
  if (!email) return c.json({ error: "Ruta local no disponible." }, 404);
  const accepted = c.req.param("decision") === "accept";
  if (!accepted && c.req.param("decision") !== "reject") return c.json({ error: "Decisión inválida." }, 400);
  const user = await ensureLocalUser(c.env.DB, email);
  const groupId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.id, email: user.email, accepted });
  return c.json({ status: accepted ? "accepted" : "rejected", groupId });
});



async function canonicalGroupPath(c, next) {
  const key = c.req.param("groupId");
  if (c.req.method !== "GET" || !key?.startsWith("group_")) return next();
  const user = await signedInUser(c);
  if (!user) return next();
  const membership = await c.env.DB.prepare("SELECT 1 FROM memberships WHERE group_id = ? AND user_id = ?").bind(key, user.user_id).first();
  if (!membership) return next();
  const group = await resolveGroup(c.env.DB, key);
  if (!group) return next();
  const url = new URL(c.req.url);
  const prefix = `/groups/${encodeURIComponent(key)}`;
  return c.redirect(`/groups/${encodeURIComponent(group.slug)}${url.pathname.slice(prefix.length)}${url.search}`, 308);
}

app.use("/groups/:groupId", canonicalGroupPath);
app.use("/groups/:groupId/*", canonicalGroupPath);

app.get("/groups/new", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  return c.html(page("Crear grupo", `<a class="back-link" href="/">← Volver</a><p class="eyebrow">Cuentas Claras</p><h1>Un grupo nuevo, cuentas claras.</h1><p>Un grupo puede ser tu casa, un viaje o un proyecto. Creás el grupo en un solo paso; después sumás personas e historial.</p><form class="card" method="post" action="/groups">${await csrfInput(c, user)}<label class="label" for="nombre">Nombre</label><input id="nombre" name="name" required maxlength="120" autocomplete="off" placeholder="Ej. Casa compartida"><label class="label" for="currency">Moneda predeterminada</label><select id="currency" name="currency">${Object.keys(CURRENCY_MINOR_UNITS).map(currency => `<option value="${currency}"${currency === "COP" ? " selected" : ""}>${html(currencyLabel(currency))}</option>`).join("")}</select><p class="hint">Cada movimiento puede usar otra moneda.</p><fieldset class="start-choice"><legend>Cómo querés empezar</legend><div class="choices"><label class="choice"><input type="radio" name="start" value="zero" checked><span>Empezar en cero</span></label><label class="choice"><input type="radio" name="start" value="splitwise"><span>Traer de Splitwise</span></label><label class="choice"><input type="radio" name="start" value="opening" disabled><span>Saldos anteriores · todavía no disponible</span></label></div><p class="hint">No se guarda ningún dato hasta que confirmes la importación.</p></fieldset><button class="button" type="submit">Crear grupo</button></form>`));
});

app.post("/groups", async (c) => {
  const user = c.get("protectedUser");
  try {
    const body = await c.req.parseBody();
    const group = await createGroupForUser(c.env.DB, { userId: user.user_id, name: body.name, defaultCurrency: body.currency || "COP" });
    const target = body.start === "splitwise" ? "/ledger/import" : "";
    return c.redirect(`/groups/${encodeURIComponent(group.slug)}${target}`, 303);
  } catch {
    return c.html(formError("No pudimos crear el grupo", "Elegí un nombre de hasta 120 caracteres."), 400);
  }
});


app.get("/groups/:groupId", async (c) => {
  const started = Date.now();
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const group = await c.env.DB.prepare("SELECT s.id, s.name, s.slug, s.description, s.avatar_emoji, s.avatar_color, m.role FROM groups s JOIN memberships m ON m.group_id = s.id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("groupId"), c.req.param("groupId"), user.user_id).first();
  if (!group) return c.html(formError("Grupo no encontrado", "No tenés acceso a este grupo.", 404), 404);
  const [csrf, ledger] = await Promise.all([
    csrfInput(c, user),
    readLedger(c.env.DB, { groupId: group.id, userId: user.user_id }),
  ]);
  const batchNotice = await recategorizationNoticeFor(c, user, group, csrf);
  const content = `${batchNotice || noticeFor(c.req.query("aviso"))}${renderBookHead(group, ledger, user.user_id)}${renderLedgerOverview(ledger, { groupId: group.slug, userId: user.user_id, csrf, query: c.req.query("q") ?? "", category: c.req.query("categoria") ?? "", person: c.req.query("quien") ?? "", recent: recentFor(ledger, c.req.query("nuevo"), c.req.query("aviso")), limit: Math.min(5000, Math.max(PAGE_SIZE, Number.parseInt(c.req.query("mostrar") ?? "", 10) || PAGE_SIZE)) })}`;
  const slow = slowBookEvent({ elapsedMs: Date.now() - started, entries: ledger.entries.length, participants: ledger.participants.length, categories: ledger.categories.length, requestId: requestId(c) }, c.env.SLOW_BOOK_MS);
  if (slow) console.warn(JSON.stringify(slow));
  return c.html(page("Cuentas Claras", content, { wide: true, groupHref: `/groups/${encodeURIComponent(group.slug)}` }));
});

app.post("/groups/:groupId/participants", async (c) => {
  const user = c.get("protectedUser");
  try {
    await addParticipant(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, name: (await c.req.parseBody()).name });
    return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/people?aviso=participante`, 303);
  } catch (error) { return ledgerFailure(c, error); }
});

registerPeopleRoutes(app);
registerGroupSettingsRoutes(app);

registerImportRoutes(app);

registerEntryRoutes(app);

registerCategoryRoutes(app);

registerRecategorizeRoutes(app);

app.get("/groups/:groupId/ledger/export.json", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await exportLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
    c.header("Content-Disposition", "attachment; filename=cuentas-claras.json");
    c.header("Cache-Control", "private, no-store");
    return c.json(data);
  } catch (error) { return ledgerFailure(c, error); }
});

app.get("/groups/:groupId/ledger/export.csv", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  try {
    const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
    c.header("Content-Disposition", "attachment; filename=cuentas-claras.csv");
    c.header("Cache-Control", "private, no-store");
    return c.body(ledgerCsv(data), 200, { "Content-Type": "text/csv; charset=utf-8" });
  } catch (error) { return ledgerFailure(c, error); }
});

for (const [action, archived, notice] of [["archive", true, "archivado"], ["restore", false, "restaurado"]]) {
  app.post(`/groups/:groupId/ledger/${action}`, async (c) => {
    const user = c.get("protectedUser");
    try {
      await setLedgerArchived(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, archived });
      return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/settings?aviso=${notice}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}

app.post("/groups/:groupId/invitations", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT m.role FROM memberships m JOIN groups s ON s.id = m.group_id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("groupId"), c.req.param("groupId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés invitar", "Sólo el titular puede invitar integrantes.", 403), 403);
  try { await assertLedgerWritable(c.env.DB, c.req.param("groupId"), user.user_id); } catch (error) { return ledgerFailure(c, error); }
  try {
    const body = await c.req.parseBody();
    await inviteToGroup(c.env.DB, { groupId: c.req.param("groupId"), inviterUserId: user.user_id, email: body.email, targetParticipantId: body.targetParticipantId || null });
    return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/people?aviso=invitacion`, 303);
  } catch {
    return c.html(formError("No pudimos crear la invitación", "Usá un email válido que no tenga una invitación pendiente."), 400);
  }
});

app.post("/groups/:groupId/invitations/:invitationId/cancel", async (c) => {
  const user = c.get("protectedUser");
  const membership = await c.env.DB.prepare("SELECT m.role FROM memberships m JOIN groups s ON s.id = m.group_id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("groupId"), c.req.param("groupId"), user.user_id).first();
  if (membership?.role !== "owner") return c.html(formError("No podés cancelar", "Sólo el titular puede cancelar invitaciones.", 403), 403);
  try {
    await cancelInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), groupId: c.req.param("groupId"), actorUserId: user.user_id });
    return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/people?aviso=cancelada`, 303);
  } catch {
    return c.html(formError("Invitación no encontrada", "La invitación ya no está pendiente.", 404), 404);
  }
});

app.get("/invitations", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  const rows = await c.env.DB.prepare("SELECT i.id, s.name AS group_name, inviter.display_name AS inviter_name FROM invitations i JOIN groups s ON s.id = i.group_id JOIN users inviter ON inviter.id = i.inviter_user_id WHERE i.invitee_email = ? AND i.status = 'pending' ORDER BY i.created_at").bind(user.email).all();
  const csrf = await csrfInput(c, user);
  const cards = rows.results.map((row) => `<section class="card"><h2>${html(row.group_name)}</h2><p>Te invitó <strong>${html(row.inviter_name)}</strong>. Antes de aceptar no ves integrantes, movimientos ni saldos.</p><form action="/invitations/${encodeURIComponent(row.id)}" method="post">${csrf}<button class="button" name="decision" value="accept">Aceptar invitación</button><button class="button secondary" name="decision" value="reject">Rechazar</button></form></section>`).join("") || "<p>No tenés invitaciones pendientes.</p>";
  return c.html(page("Invitaciones", `<p class="eyebrow">Cuentas Claras</p><h1>Invitaciones</h1>${cards}<a class="button secondary" href="/">Volver</a>`));
});

app.post("/invitations/:invitationId", async (c) => {
  const user = c.get("protectedUser");
  const body = await c.req.parseBody();
  if (body.decision !== "accept" && body.decision !== "reject") return c.html(formError("Decisión inválida", "Elegí aceptar o rechazar la invitación."), 400);
  try {
    const accepted = body.decision === "accept";
    const groupId = await resolveInvitation(c.env.DB, { invitationId: c.req.param("invitationId"), userId: user.user_id, email: user.email, accepted });
    const group = accepted ? await resolveGroup(c.env.DB, groupId) : null;
    return c.redirect(group ? `/groups/${encodeURIComponent(group.slug)}` : "/invitations", 303);
  } catch {
    return c.html(formError("Invitación no encontrada", "La invitación no existe, ya fue resuelta o no te corresponde.", 404), 404);
  }
});

async function myGroups(c, user) {
  const rows = await c.env.DB.prepare("SELECT g.id, m.role FROM groups g JOIN memberships m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.name").bind(user.user_id).all();
  return Promise.all(rows.results.map(async row => ({ ...(await resolveGroup(c.env.DB, row.id)), role: row.role })));
}

// La lista de grupos de la persona: siempre se muestra, también con un solo grupo.
app.get("/groups", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  return c.html(page("Tus grupos", renderGroupList(await myGroups(c, user))));
});

// Entrar a Cuentas Claras: abre el último grupo visitado en este navegador (si la persona sigue siendo integrante), el único grupo
// que tenga, o la lista. Un valor recordado que no es de la persona se ignora sin decir si existe.
app.get("/cuentas-claras", async (c) => {
  const user = await signedInUser(c);
  if (!user) return signInRequired(c);
  return c.redirect(entryTarget({ groups: await myGroups(c, user), lastGroupId: readLastGroup(c.req.header("Cookie")) }), 303);
});

registerAssetRoutes(app);

registerShellRoutes(app, { authConfig, localUser });

app.get("/demo/crear-grupo", (c) => {
  const { owner, member, index } = demoPair(c);
  return c.html(page("Crear grupo", `<p class="eyebrow">Primer paso</p><h1>¿Cómo se llama este grupo?</h1><p>Puede ser tu casa, familia, viaje o cualquier contexto que compartan.</p><form class="card" method="post" action="/local/groups"><label class="label" for="nombre">Nombre del grupo</label><input id="nombre" name="name" required maxlength="120" placeholder="Ej. Casa de ${owner} y ${member}"><button class="button" type="submit">Crear grupo</button></form>`));
});

app.get("/demo/grupo", (c) => {
  const name = c.req.query("nombre")?.trim() || "Casa compartida";
  const { owner, member, index } = demoPair(c);
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${html(name)}</p><h1>Cuentas Claras está lista.</h1><p>Cuando conectemos la cuenta real, aquí aparecerán los movimientos y balances del grupo. No inventamos números antes de tiempo.</p><section class="card"><h2>Participantes</h2><div class="person"><strong>${html(owner)}</strong><br><span class="muted">Titular del grupo</span></div><div class="person"><strong>${html(member)}</strong><br><span class="muted">Invitación pendiente · ${html(member.toLowerCase())}@example.com</span></div><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&${demoQuery(index)}">Ver lo que verá ${html(member)}</a></section>`));
});

app.get("/demo/invitacion", (c) => {
  const name = c.req.query("nombre") || "Casa compartida";
  const { owner, index } = demoPair(c);
  const answer = c.req.query("respuesta");
  const result = answer ? `<p class="notice">Invitación ${answer === "aceptar" ? "aceptada" : "rechazada"} en esta demostración. En la aplicación real la acción quedará auditada.</p>` : `<p class="notice">Antes de aceptar no ves integrantes, movimientos ni saldos.</p><a class="button" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=aceptar&${demoQuery(index)}">Aceptar invitación</a><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=rechazar&${demoQuery(index)}">Rechazar</a>`;
  return c.html(page("Invitación", `<p class="eyebrow">Invitación a Cuentas Claras</p><h1>${html(name)}</h1><p>Te invitó <strong>${html(owner)}</strong>. Si aceptás, vas a poder acceder a Cuentas Claras de este grupo.</p><section class="card">${result}</section>`));
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
