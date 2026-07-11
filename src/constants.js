// ---------- Constants ----------

// Id de la columna "Terminado" (debe coincidir con COLUMNS en public/index.html).
// Se usa para derivar el progreso de los objetivos.
export const DONE_COLUMN = "terminado";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_ATTACHMENTS_PER_CARD = 10;

// Paletas de color disponibles por tablero (#10). candy_pop es la oficial/default
// (boards.theme = NULL se trata como candy_pop a efectos de render).
export const BOARD_THEMES = new Set(["candy_pop", "sunset_pop", "citrus_fresh", "jungle_pop"]);

export const ALLOWED_MIME_TYPES = new Set([
  // Imágenes
  "image/jpeg", "image/png", "image/webp", "image/gif",
  // Documentos
  "application/pdf", "text/plain", "text/csv",
  // Office
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const RATE_LIMITS = {
  login: { requests: 5, window: 15 * 60 * 1000 },          // 5 intentos / 15 min
  callback: { requests: 5, window: 15 * 60 * 1000 },       // 5 intentos / 15 min
  uploadAttachment: { requests: 50, window: 5 * 60 * 1000 }, // 50 / 5 min
  api: { requests: 500, window: 5 * 60 * 1000 },           // 500 / 5 min
};

// Retención de rate_limit_log: la ventana más larga de RATE_LIMITS es 15 min;
// 24 h dejan margen de sobra para diagnóstico sin que la tabla crezca sin límite.
// El cron (scheduled handler) borra las filas más viejas que esto.
export const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

export const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: "Lax", path: "/" };

export const ALLOWED_ORIGINS = [
  "https://tas-king.pablotortorella.workers.dev",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];
