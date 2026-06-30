import { Hono } from "hono";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createLoggingMiddleware, logger, getClientIP } from "./middleware/logging.js";
import { createAuthMiddleware, requireAdmin } from "./middleware/auth.js";
import { setupAuthRoutes } from "./routes/auth.js";
import { setupUserRoutes } from "./routes/users.js";
import { setupBoardRoutes } from "./routes/boards.js";
import { setupCardRoutes } from "./routes/cards.js";
import { setupUploadRoutes } from "./routes/uploads.js";
import { setupAdminRoutes } from "./routes/admin.js";
import { setupLabelRoutes } from "./routes/labels.js";
import { setupChecklistRoutes } from "./routes/checklists.js";
import { setupGoalRoutes } from "./routes/goals.js";
import { runBackup } from "./backup.js";

const app = new Hono();

// ---------- Global Middleware ----------
app.use(createCorsMiddleware());
app.use(createLoggingMiddleware());

// Error handler: captura todas las excepciones no manejadas
app.onError((err, c) => {
  const ip = getClientIP(c);
  const path = c.req.path;
  const message = err.message || "Error desconocido";
  const stack = err.stack || "";

  logger.error(`Exception in ${c.req.method} ${path}`, {
    ip,
    message,
    stack: stack.split("\n")[0],
  });

  console.error(`[ERROR] ${c.req.method} ${path}:`, err);

  return c.json({
    error: `Server error: ${message}`,
    path,
    method: c.req.method,
  }, 500);
});

// ---------- Public Routes (Auth) ----------
setupAuthRoutes(app);

// ---------- Protected Routes (API) ----------
app.use("/api/*", createAuthMiddleware());

// Rutas de usuario
setupUserRoutes(app);

// Rutas de tableros
setupBoardRoutes(app);

// Rutas de tarjetas
setupCardRoutes(app);

// Rutas de etiquetas
setupLabelRoutes(app);

// Rutas de checklists
setupChecklistRoutes(app);

// Rutas de objetivos
setupGoalRoutes(app);

// Rutas de uploads (servir archivos)
setupUploadRoutes(app);

// Rutas de admin (requieren admin)
app.use("/api/admin/*", requireAdmin);
setupAdminRoutes(app);

export { app };

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runBackup(env).then((result) => {
        const status = result.errors.length === 0 ? "✅" : "⚠️";
        console.log(`[backup] ${status} r2=${result.r2} github=${result.github}`, result.errors);
      })
    );
  },
};

// Exportaciones puras para tests unitarios
export {
  b64urlFromBytes,
  b64urlFromStr,
  b64urlToBytes,
  isLocalRequest,
  signSession,
  strFromB64url,
  verifySession,
} from "./middleware/auth.js";

export {
  attachmentToJSON,
  cardToJSON,
  commentToJSON,
  extOf,
} from "./db/queries.js";
