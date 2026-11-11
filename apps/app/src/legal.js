import { PRODUCTION_APP_HOST } from "./tools.js";

// Textos legales de HomeSuite: versión vigente de cada uno, enlaces por ambiente y registro de la aceptación de cada persona.
// La VERSIÓN de un texto es la fecha de «Última actualización» de su página en apps/site/public/ (en ISO). Una prueba
// (legal-versions.test.js) lee las páginas y falla si la fecha y esta constante difieren. Specs: openspec/changes/politica-y-aceptacion.

// `upcoming` (opcional) anuncia una versión nueva antes de que rija: `{ version, effectiveFrom }` con `effectiveFrom` en ISO (día
// completo en hora de Colombia). Mientras exista, la página publicada ya muestra el texto nuevo, toda pantalla autenticada muestra la
// franja de aviso y la puerta sólo exige la versión nueva desde `effectiveFrom`. Al regir, se pasa `upcoming.version` a `version`.
export const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ version: "2026-11-04", path: "/terminos", title: "Términos y condiciones" }),
  privacy: Object.freeze({ version: "2026-11-04", path: "/privacidad", title: "Política de privacidad" }),
});

export const LEGAL_KEYS = Object.freeze(["terms", "privacy"]);
export const ACCEPT_METHODS = Object.freeze(["login", "gate"]);

// Mismo criterio que taskingUrl() en tools.js: producción sólo desde el dominio de producción de la app; cualquier otro host
// (staging, local) lleva al sitio de staging.
export const SITE_URL = Object.freeze({
  production: "https://homesuite.info",
  staging: "https://site-staging.homesuite.info",
});

export function siteUrl(hostname) {
  return hostname === PRODUCTION_APP_HOST ? SITE_URL.production : SITE_URL.staging;
}

export function legalLinks(hostname, documents = legalDocuments()) {
  const base = siteUrl(hostname);
  return Object.fromEntries(LEGAL_KEYS.map((key) => [key, `${base}${documents[key].path}`]));
}

// Gancho de pruebas: permite simular una versión próxima o un cambio de versión sin tocar la constante. Con `null` se restaura.
let activeDocuments = LEGAL_DOCUMENTS;
export function legalDocuments() {
  return activeDocuments;
}
export function useLegalDocuments(documents) {
  activeDocuments = documents ?? LEGAL_DOCUMENTS;
}

export const isLegalVersion = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);

// Colombia no tiene horario de verano: UTC-5 todo el año.
const effectiveFromMs = (iso) => Date.parse(`${iso}T00:00:00-05:00`);
const asMs = (now) => (now instanceof Date ? now.getTime() : now);

// Versión que se exige hoy de un documento.
export function requiredVersion(document, now = Date.now()) {
  const { upcoming } = document;
  return upcoming && asMs(now) >= effectiveFromMs(upcoming.effectiveFrom) ? upcoming.version : document.version;
}

export function requiredVersions(now = Date.now(), documents = legalDocuments()) {
  return Object.fromEntries(LEGAL_KEYS.map((key) => [key, requiredVersion(documents[key], now)]));
}

// Versión que muestra hoy la página del sitio: la próxima si ya está anunciada, si no la vigente.
export const publishedVersion = (document) => document.upcoming?.version ?? document.version;

// Versiones que el sistema conoce de un documento: sirven para validar lo que llega del navegador o de la cookie de estado.
export const knownVersions = (document) => [document.version, ...(document.upcoming ? [document.upcoming.version] : [])];

// Avisos de versiones próximas que todavía no rigen, para la franja.
export function upcomingNotices(now = Date.now(), documents = legalDocuments()) {
  return LEGAL_KEYS.flatMap((key) => {
    const { upcoming, title, path } = documents[key];
    return upcoming && asMs(now) < effectiveFromMs(upcoming.effectiveFrom)
      ? [{ key, title, path, version: upcoming.version, effectiveFrom: upcoming.effectiveFrom }]
      : [];
  });
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// «2026-11-04» -> «4 de noviembre de 2026»: el mismo formato de «Última actualización» en las páginas.
export function formatLegalDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}
export function parseLegalDate(text) {
  const match = /(\d{1,2}) de (\p{L}+) de (\d{4})/u.exec(text);
  const month = match ? MONTHS.indexOf(match[2]) + 1 : 0;
  return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

// ---- Registro de la aceptación ----

// Última versión aceptada de cada documento.
export async function acceptedVersions(db, userId) {
  const { results } = await db.prepare("SELECT document, MAX(version) AS version FROM legal_acceptances WHERE user_id = ? GROUP BY document").bind(userId).all();
  return Object.fromEntries(results.map((row) => [row.document, row.version]));
}

// Documentos cuya versión exigida es posterior a la aceptada (o que nunca se aceptaron). Las fechas ISO se comparan como texto.
export function pendingDocuments(accepted, required) {
  return LEGAL_KEYS.filter((key) => !accepted[key] || accepted[key] < required[key]);
}

export async function pendingFor(db, userId, now = Date.now(), documents = legalDocuments()) {
  const required = requiredVersions(now, documents);
  const accepted = await acceptedVersions(db, userId);
  return { required, accepted, pending: pendingDocuments(accepted, required) };
}

// Versiones válidas a partir de un objeto { terms, privacy } que llega del navegador (formulario de /aceptar): descarta lo desconocido y
// las versiones que el sistema nunca publicó, para que nadie registre una versión inexistente. Con `fallback` completa lo que falte.
export function sanitizeVersions(value, documents = legalDocuments(), fallback = null) {
  const out = {};
  for (const key of LEGAL_KEYS) {
    const candidate = value?.[key];
    if (isLegalVersion(candidate) && knownVersions(documents[key]).includes(candidate)) out[key] = candidate;
    else if (fallback?.[key]) out[key] = fallback[key];
  }
  return out;
}

// Versiones de la cookie firmada de estado de /auth/google: las firmó este servidor al empezar el flujo, así que pueden ser anteriores a las
// vigentes al volver (la persona vio esa versión). Sólo se comprueba la forma.
export function stateVersions(value) {
  return Object.fromEntries(LEGAL_KEYS.filter((key) => isLegalVersion(value?.[key])).map((key) => [key, value[key]]));
}

export async function recordAcceptances(db, userId, versions, method) {
  if (!ACCEPT_METHODS.includes(method)) throw new Error("Método de aceptación desconocido.");
  const statements = Object.entries(versions)
    .filter(([key, version]) => LEGAL_KEYS.includes(key) && isLegalVersion(version))
    .map(([key, version]) => db.prepare("INSERT OR IGNORE INTO legal_acceptances (user_id, document, version, method) VALUES (?, ?, ?, ?)").bind(userId, key, version, method));
  if (statements.length) await db.batch(statements);
  return statements.length;
}

// ---- Puerta de nueva aceptación ----

// La puerta sólo actúa si LEGAL_GATE=on: se despliega apagada y se enciende después de publicar los textos revisados (design.md, D4 y
// Migration Plan). Sin la variable queda apagada.
export const legalGateEnabled = (env) => env?.LEGAL_GATE === "on";

const STATIC_FILE = /^\/[\w.-]+\.(?:js|css|svg|png|ico|webp)$/u; // sólo archivos de la raíz que sirve el Worker (ver routes/assets.js)
// Rutas que funcionan aunque haya una versión sin aceptar: aceptar, cerrar sesión (todo /auth/), el estado, los recursos estáticos, lo
// que instala la app y la descarga de los datos propios. Los changes de baja de cuenta y de exportación agregan acá sus rutas (la baja de cuenta debe poder
// completarse sin aceptar la versión nueva). Las páginas legales viven en el sitio público, no en esta aplicación.
export const GATE_EXEMPT = Object.freeze([
  { methods: ["GET", "POST"], test: (path) => path === "/aceptar" },
  { methods: ["GET", "POST"], test: (path) => path.startsWith("/auth/") },
  { methods: ["GET", "HEAD"], test: (path) => path === "/healthz" },
  { methods: ["GET", "HEAD"], test: (path) => STATIC_FILE.test(path) },
  // La instalación de la app (pwa-instalable): el service worker precarga estas páginas, iguales para todas las personas; si redirigieran
  // a /aceptar la instalación fallaría y sin conexión quedaría la pantalla del navegador.
  { methods: ["GET", "HEAD"], test: (path) => path === "/manifest.webmanifest" || path === "/sin-conexion" || path.startsWith("/sin-conexion/") },
  { methods: ["GET"], test: (path) => /^\/groups\/[^/]+\/ledger\/export\.(?:json|csv)$/u.test(path) },
]);

export function isGateExempt(method, pathname) {
  return GATE_EXEMPT.some((rule) => rule.methods.includes(method) && rule.test(pathname));
}
