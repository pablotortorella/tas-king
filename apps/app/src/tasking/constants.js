// ---------- Constants ----------

// Id de la columna "Terminado" (debe coincidir con estado.COLUMNS en public/js/core/state.js).
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

