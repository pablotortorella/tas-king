import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { LEGAL_DOCUMENTS, pendingFor, recordAcceptances, useLegalDocuments } from "../src/legal.js";
import { createSession } from "../src/sessions.js";
import { upsertGoogleUser } from "../src/users.js";

// Registro y puerta de aceptación de los textos legales (specs aceptacion-de-terminos). El inicio de sesión con Google se recorre completo
// (autorización, estado firmado, intercambio de código e ID token) con la red de Google reemplazada por una prueba firmada localmente.
const SECRET = "g".repeat(32);
const ORIGIN = "https://app.homesuite.info";
const CLIENT_ID = "test-client";
const GATE_ON = { DB: env.DB, SESSION_SECRET: SECRET, GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "test-secret", LEGAL_GATE: "on" };
const GATE_OFF = { ...GATE_ON, LEGAL_GATE: undefined };
const CURRENT = LEGAL_DOCUMENTS.terms.version;
const NEWER = "2027-06-01";
const documentsAt = (version) => ({ terms: { ...LEGAL_DOCUMENTS.terms, version }, privacy: { ...LEGAL_DOCUMENTS.privacy, version } });

afterEach(() => { useLegalDocuments(null); vi.unstubAllGlobals(); });

const b64 = (input) => btoa(String.fromCharCode(...(typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input)))).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
let keys; let publicJwk;
beforeAll(async () => {
  keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  publicJwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "legal-test", alg: "RS256", use: "sig" };
});

async function idToken(nonce, identity) {
  const header = b64(JSON.stringify({ alg: "RS256", kid: "legal-test" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ iss: "https://accounts.google.com", aud: CLIENT_ID, exp: now + 600, iat: now, nonce, email_verified: true, ...identity }));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64(signature)}`;
}

function stubGoogle(token) {
  vi.stubGlobal("fetch", async (url) => {
    const target = String(url);
    if (target.includes("oauth2.googleapis.com/token")) return Response.json({ id_token: await token() });
    if (target.includes("googleapis.com/oauth2/v3/certs")) return Response.json({ keys: [publicJwk] });
    throw new Error(`Red no prevista en la prueba: ${target}`);
  });
}

const cookiePair = (response, name) => response.headers.getSetCookie().map((line) => line.split(";")[0]).find((pair) => pair.startsWith(`${name}=`));

// Recorre /auth/google -> Google -> /auth/callback. `startPath` permite empezar con o sin el aviso (`acepta=1`).
async function signInWithGoogle({ sub, email, startPath = "/auth/google?returnTo=%2F&acepta=1", between = () => {} }) {
  const start = await app.request(`${ORIGIN}${startPath}`, undefined, GATE_ON);
  expect(start.status).toBe(302);
  const authorization = new URL(start.headers.get("location"));
  const oauth = cookiePair(start, "homesuite_oauth");
  stubGoogle(() => idToken(authorization.searchParams.get("nonce"), { sub, email, name: "Persona de Prueba" }));
  await between();
  const callback = await app.request(`${ORIGIN}/auth/callback?code=abc&state=${authorization.searchParams.get("state")}`, { headers: { Cookie: oauth } }, GATE_ON);
  expect(callback.status).toBe(303);
  return { callback, session: cookiePair(callback, "__Host-homesuite_session") };
}

const rowsOf = async (email) => (await env.DB.prepare("SELECT a.document, a.version, a.method FROM legal_acceptances a JOIN users u ON u.id = a.user_id WHERE u.email = ? ORDER BY a.document").bind(email).all()).results;
const uniqueIdentity = (prefix) => { const id = crypto.randomUUID(); return { sub: `${prefix}-${id}`, email: `${prefix}-${id}@example.test` }; };

async function sessionFor(prefix = "gate") {
  const identity = uniqueIdentity(prefix);
  const user = await upsertGoogleUser(env.DB, { ...identity, name: "Persona de Prueba", picture: null });
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` };
}
const get = (path, cookie, e = GATE_ON) => app.request(`${ORIGIN}${path}`, { headers: { Cookie: cookie }, redirect: "manual" }, e);

describe("registro de la aceptación al iniciar sesión", () => {
  it("primer ingreso desde una pantalla con aviso: dos filas con la versión vigente y el método login", async () => {
    const identity = uniqueIdentity("primero");
    await signInWithGoogle(identity);
    expect(await rowsOf(identity.email)).toEqual([
      { document: "privacy", version: LEGAL_DOCUMENTS.privacy.version, method: "login" },
      { document: "terms", version: LEGAL_DOCUMENTS.terms.version, method: "login" },
    ]);
  });

  it("si la versión cambia durante el flujo se registra la que la persona veía al empezar, y la puerta pide la nueva", async () => {
    const identity = uniqueIdentity("cambio");
    useLegalDocuments(documentsAt("2026-11-04"));
    const { session } = await signInWithGoogle({ ...identity, between: () => useLegalDocuments(documentsAt(NEWER)) });
    expect(await rowsOf(identity.email)).toEqual([
      { document: "privacy", version: "2026-11-04", method: "login" },
      { document: "terms", version: "2026-11-04", method: "login" },
    ]);
    const response = await get("/", session);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/aceptar?next=%2F");
  });

  it("un acceso por enlace directo, sin aviso, inicia sesión sin registrar aceptación y la puerta la pide", async () => {
    const identity = uniqueIdentity("directo");
    const { session } = await signInWithGoogle({ ...identity, startPath: "/auth/google?returnTo=%2F" });
    expect(await rowsOf(identity.email)).toEqual([]);
    const response = await get("/groups/new", session);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/aceptar?next=%2Fgroups%2Fnew");
  });

  it("una persona que ya aceptó, al volver, no ve la puerta", async () => {
    const identity = uniqueIdentity("vuelve");
    await signInWithGoogle(identity);
    const { session } = await signInWithGoogle(identity);
    expect((await get("/", session)).status).toBe(200);
    expect(await rowsOf(identity.email)).toHaveLength(2);
  });

  it("nunca guarda dirección IP ni agente de usuario", async () => {
    const columns = (await env.DB.prepare("PRAGMA table_info(legal_acceptances)").all()).results.map((row) => row.name);
    expect(columns).toEqual(["user_id", "document", "version", "accepted_at", "method"]);
  });
});

describe("puerta de nueva aceptación", () => {
  it("una persona sin la versión vigente va a /aceptar, y /aceptar le dice qué debe aceptar", async () => {
    const { cookie } = await sessionFor();
    const redirect = await get("/groups/new?x=1", cookie);
    expect(redirect.status).toBe(303);
    expect(redirect.headers.get("location")).toBe("/aceptar?next=%2Fgroups%2Fnew%3Fx%3D1");
    const page = await get("/aceptar?next=%2Fgroups%2Fnew", cookie);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("private, no-store");
    const html = await page.text();
    expect(html).toContain("Antes de seguir");
    expect(html).toContain("Aceptar y continuar");
    expect(html).toContain("No acepto: cerrar sesión");
    expect(html).toContain('name="next" value="/groups/new"');
  });

  it("aceptar registra las versiones mostradas con el método gate y deja pasar", async () => {
    const { user, cookie } = await sessionFor();
    const html = await (await get("/aceptar", cookie)).text();
    const token = html.match(/action="\/aceptar"[^>]*><input type="hidden" name="_csrf" value="([^"]+)"/u)?.[1];
    expect(token).toBeTruthy();
    const accept = await app.request(`${ORIGIN}/aceptar`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, terms: CURRENT, privacy: CURRENT, next: "/groups/new" }).toString(),
      redirect: "manual",
    }, GATE_ON);
    expect(accept.status).toBe(303);
    expect(accept.headers.get("location")).toBe("/groups/new");
    const rows = (await env.DB.prepare("SELECT document, version, method FROM legal_acceptances WHERE user_id = ? ORDER BY document").bind(user.id).all()).results;
    expect(rows).toEqual([{ document: "privacy", version: CURRENT, method: "gate" }, { document: "terms", version: CURRENT, method: "gate" }]);
    expect((await get("/groups/new", cookie)).status).toBe(200);
    // con todo aceptado, /aceptar ya no tiene nada que pedir
    expect((await get("/aceptar?next=%2Fgroups", cookie)).headers.get("location")).toBe("/groups");
  });

  it("aceptar sin el token CSRF se rechaza y no registra nada", async () => {
    const { user, cookie } = await sessionFor();
    const response = await app.request(`${ORIGIN}/aceptar`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ terms: CURRENT, privacy: CURRENT }).toString(),
    }, GATE_ON);
    expect(response.status).toBe(403);
    expect((await pendingFor(env.DB, user.id)).pending).toEqual(["terms", "privacy"]);
  });

  it("una versión inventada en el formulario no se registra: se usa la vigente", async () => {
    const { user, cookie } = await sessionFor();
    const html = await (await get("/aceptar", cookie)).text();
    const token = html.match(/name="_csrf" value="([^"]+)"/u)?.[1];
    await app.request(`${ORIGIN}/aceptar`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, terms: "1999-01-01", privacy: "no-es-una-fecha", next: "//evil.example" }).toString(),
      redirect: "manual",
    }, GATE_ON);
    const rows = (await env.DB.prepare("SELECT version FROM legal_acceptances WHERE user_id = ?").bind(user.id).all()).results;
    expect(rows.map((row) => row.version)).toEqual([CURRENT, CURRENT]);
  });

  it("una mutación con versión pendiente recibe 403 y no cambia nada", async () => {
    const { user, cookie } = await sessionFor();
    const before = (await env.DB.prepare("SELECT COUNT(*) AS n FROM groups").first()).n;
    const html = await (await get("/aceptar", cookie)).text();
    const token = html.match(/name="_csrf" value="([^"]+)"/u)?.[1];
    const response = await app.request(`${ORIGIN}/groups`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, name: "No debería crearse" }).toString(),
    }, GATE_ON);
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Falta aceptar los textos vigentes");
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM groups").first()).n).toBe(before);
    expect((await pendingFor(env.DB, user.id)).pending).toHaveLength(2);
  });

  it("la API responde 403 con el destino, sin redirigir", async () => {
    const { cookie } = await sessionFor();
    const response = await get("/api/me", cookie);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "legal_acceptance_required", location: "/aceptar" });
  });

  it("cerrar sesión funciona sin aceptar y no registra aceptación", async () => {
    const { user, cookie } = await sessionFor();
    const html = await (await get("/aceptar", cookie)).text();
    const token = html.match(/action="\/auth\/logout"[^>]*><input type="hidden" name="_csrf" value="([^"]+)"/u)?.[1];
    expect(token).toBeTruthy();
    const out = await app.request(`${ORIGIN}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token }).toString(),
      redirect: "manual",
    }, GATE_ON);
    expect(out.status).toBe(303);
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/iu);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM legal_acceptances WHERE user_id = ?").bind(user.id).first()).n).toBe(0);
    expect((await get("/api/me", cookie)).status).toBe(401);
  });

  it("las rutas exentas siguen disponibles con una versión pendiente: estado, estáticos y descarga de datos propios", async () => {
    const { cookie } = await sessionFor();
    expect((await get("/healthz", cookie)).status).toBe(200);
    expect((await get("/app.css", cookie)).status).toBe(200);
    expect((await get("/shell.js", cookie)).status).toBe(200);
    // la descarga de un grupo no se bloquea por la puerta: llega a la ruta, que responde por la pertenencia (no 303 a /aceptar)
    const download = await get("/groups/inexistente/ledger/export.json", cookie);
    expect(download.headers.get("location") ?? "").not.toContain("/aceptar");
    expect(await download.text()).not.toContain("Falta aceptar");
  });

  it("sin sesión la puerta no actúa", async () => {
    const response = await app.request(`${ORIGIN}/`, { redirect: "manual" }, GATE_ON);
    expect(response.status).toBe(200);
  });

  it("apagada (sin LEGAL_GATE=on) no pide nada aunque falte la aceptación", async () => {
    const { cookie } = await sessionFor();
    expect((await get("/groups/new", cookie, GATE_OFF)).status).toBe(200);
    expect((await get("/api/me", cookie, GATE_OFF)).status).toBe(200);
  });

  it("encendida y apagada se comporta distinto con la misma persona", async () => {
    const { cookie } = await sessionFor();
    expect((await get("/groups/new", cookie, GATE_ON)).status).toBe(303);
    expect((await get("/groups/new", cookie, GATE_OFF)).status).toBe(200);
  });
});

describe("versión próxima y franja de aviso", () => {
  it("antes de la fecha muestra la franja y no pide aceptar; desde la fecha pide aceptar", async () => {
    const { user, cookie } = await sessionFor("franja");
    await recordAcceptances(env.DB, user.id, { terms: CURRENT, privacy: CURRENT }, "login");
    const future = Date.now() + 10 * 24 * 3600 * 1000;
    const isoIn10Days = new Date(future).toISOString().slice(0, 10);
    useLegalDocuments({ terms: LEGAL_DOCUMENTS.terms, privacy: { ...LEGAL_DOCUMENTS.privacy, upcoming: { version: isoIn10Days, effectiveFrom: isoIn10Days } } });
    const before = await get("/", cookie);
    expect(before.status).toBe(200);
    const html = await before.text();
    expect(html).toContain('<aside class="legal-band"');
    expect(html).toContain("Política de privacidad");
    // sin sesión no se muestra la franja
    expect(await (await app.request(`${ORIGIN}/`, undefined, GATE_ON)).text()).not.toContain("legal-band");

    // el reloj del servidor pasa la fecha: se simula adelantando la fecha de entrada en vigor al pasado
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    useLegalDocuments({ terms: LEGAL_DOCUMENTS.terms, privacy: { ...LEGAL_DOCUMENTS.privacy, version: CURRENT, upcoming: { version: "2099-01-01", effectiveFrom: yesterday } } });
    const after = await get("/", cookie);
    expect(after.status).toBe(303);
    expect(after.headers.get("location")).toContain("/aceptar");
    expect(await (await get("/aceptar", cookie)).text()).toContain("Cambió: versión del");
  });
});

describe("conservación de las aceptaciones", () => {
  it("las filas guardan solo un identificador opaco, la versión, la fecha y el método", async () => {
    const identity = uniqueIdentity("opaco");
    await signInWithGoogle(identity);
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(identity.email).first();
    const rows = (await env.DB.prepare("SELECT * FROM legal_acceptances WHERE user_id = ?").bind(user.id).all()).results;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["accepted_at", "document", "method", "user_id", "version"]);
      expect(row.user_id).toMatch(/^user_/u);
      expect(JSON.stringify(row)).not.toContain(identity.email);
    }
  });
});
