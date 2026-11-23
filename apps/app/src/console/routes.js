import { inspectCsrfRequest } from "../csrf.js";
import { normalizeEmail } from "../platform.js";
import { checkRateLimit } from "../rate-limit.js";
import { csrfInput, formError, page, requestId, sessionSecret } from "../route-kit.js";
import { CONSOLE_TABS, consoleAccess, consoleNotFound, isOwner, ROLE_SCOPES } from "./access.js";
import { adminData, auditAccountsViewed, auditConsoleOpened, selectedPeriod, setRole, suiteData, tareasData } from "./data.js";
import { consoleNav, renderAdmin, renderCuentasClaras, renderSuite, renderTareas } from "./ui.js";

// Rutas de la consola (change consola-administracion-homesuite, design.md D9 a D11). Toda ruta comprueba primero el acceso a la pestaña:
// sin permiso responde el mismo 404 que una ruta inexistente, también para las escrituras (antes de mirar CSRF).

const TAB_IDS = CONSOLE_TABS.map((tab) => tab.id);

async function accessTo(c, tab) {
  const access = await consoleAccess(c);
  if (!access.session) return { denied: consoleNotFound(c, "no_session") };
  if (!TAB_IDS.includes(tab) || !access.tabs.includes(tab)) return { denied: consoleNotFound(c, access.tabs.length ? "tab_not_allowed" : "no_role") };
  return { access };
}

function noStore(c) {
  c.header("Cache-Control", "private, no-store");
}

async function tabContent(c, tab, access) {
  const db = c.env.DB;
  if (tab === "suite") {
    const period = selectedPeriod(c.req.query());
    return renderSuite(await suiteData(db, period), period);
  }
  if (tab === "tareas") {
    const data = await tareasData(db, { includeRanking: access.owner });
    await auditAccountsViewed(db, { userId: access.session.user_id, tool: "tasks" });
    return renderTareas(data, { owner: access.owner });
  }
  if (tab === "cuentas-claras") return renderCuentasClaras();
  return renderAdmin(await adminData(db, c.env), { csrf: await csrfInput(c, access.session), notice: c.req.query("aviso") });
}

async function protectMutation(c, session) {
  const limit = await checkRateLimit(c.env?.MUTATION_RATE_LIMITER, session.id);
  if (!limit.configured && c.env?.REQUIRE_RATE_LIMITS === "true") return c.json({ error: "Protección temporalmente no disponible.", requestId: requestId(c) }, 503);
  if (!limit.allowed) { c.header("Retry-After", "60"); return c.json({ error: "Demasiadas solicitudes. Intentá de nuevo más tarde." }, 429); }
  const csrf = await inspectCsrfRequest(c.req.raw, { sessionId: session.id, secret: sessionSecret(c.env) });
  if (!csrf.valid) return c.html(formError("Solicitud no verificada", `Recargá la página e intentá de nuevo. Código: ${requestId(c)}.`), 403);
  return null;
}

export function registerConsoleRoutes(app) {
  app.get("/consola", async (c) => {
    const access = await consoleAccess(c);
    if (!access.tabs.length) return consoleNotFound(c, access.session ? "no_role" : "no_session");
    noStore(c);
    return c.redirect(`/consola/${access.tabs[0]}`, 303);
  });

  app.get("/consola/:tab", async (c) => {
    const tab = c.req.param("tab");
    const { access, denied } = await accessTo(c, tab);
    if (denied) return denied;
    noStore(c);
    const content = await tabContent(c, tab, access);
    await auditConsoleOpened(c.env.DB, { userId: access.session.user_id, tab });
    const label = CONSOLE_TABS.find((item) => item.id === tab).label;
    return c.html(page(`Consola · ${label}`, `${consoleNav(access.tabs, tab)}${content}`, { wide: true }));
  });

  // API de lectura, con los mismos permisos por pestaña. El ranking de Tareas viaja sólo para dueños.
  app.get("/api/consola/:tab", async (c) => {
    const tab = c.req.param("tab");
    if (!["suite", "tareas"].includes(tab)) return consoleNotFound(c, "unknown_api");
    const { access, denied } = await accessTo(c, tab);
    if (denied) return denied;
    noStore(c);
    if (tab === "suite") return c.json(await suiteData(c.env.DB, selectedPeriod(c.req.query())));
    const data = await tareasData(c.env.DB, { includeRanking: access.owner });
    await auditAccountsViewed(c.env.DB, { userId: access.session.user_id, tool: "tasks" });
    return c.json(data);
  });

  // Dar o quitar un rol: sólo dueños. Formulario con `accion` (dar | quitar), `herramienta` y `correo` (dar) o `cuenta` (quitar).
  app.post("/consola/administradores/roles", async (c) => {
    const { access, denied } = await accessTo(c, "administradores");
    if (denied) return denied;
    const rejected = await protectMutation(c, access.session);
    if (rejected) return rejected;
    const form = await c.req.parseBody();
    const scope = String(form.herramienta ?? "");
    const back = (notice) => c.redirect(`/consola/administradores?aviso=${notice}`, 303);
    if (!ROLE_SCOPES.includes(scope) || !["dar", "quitar"].includes(form.accion)) return c.html(formError("Pedido inválido", "Elegí una herramienta y una acción válidas."), 400);
    let userId = null;
    if (form.accion === "dar") {
      const email = normalizeEmail(String(form.correo ?? ""));
      const user = email ? await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first() : null;
      if (!user) return back("cuenta-no-encontrada");
      if (isOwner(c.env, user.id)) return back("acceso-total");
      userId = user.id;
    } else {
      userId = String(form.cuenta ?? "");
    }
    const changed = await setRole(c.env.DB, { actorUserId: access.session.user_id, userId, scope, grant: form.accion === "dar" });
    return back(changed ? (form.accion === "dar" ? "rol-dado" : "rol-quitado") : "sin-cambios");
  });
}

