// Tabla de rutas medidas (change consola-administracion-homesuite, design.md D1; spec estadisticas-de-uso-homesuite). El middleware de
// medición traduce la ruta que respondió (método y patrón de Hono) en { herramienta, nivel, acción }. Una ruta que no figura acá no se
// mide. Jardín Zen y las páginas sin sesión no figuran. Remanso suma sus resultados por su propia ruta (POST /api/uso/remanso).
// Una prueba (usage-catalog.test.js) recorre la tabla contra las rutas registradas en la app: si una herramienta cambia una ruta, falla.
// Al sumar una acción nueva a una herramienta, agregala acá y en ACTION_LABELS.

export const USAGE_CATALOG = Object.freeze([
  // Cuentas Claras: abrir un libro; cargar, editar o borrar (anular) un movimiento; confirmar una importación.
  { method: "GET", path: "/groups/:groupId", tool: "expenses", level: "entro", action: null },
  { method: "POST", path: "/groups/:groupId/ledger/entries", tool: "expenses", level: "hizo", action: "movimiento_cargado" },
  { method: "POST", path: "/groups/:groupId/ledger/entries/:entryId/edit", tool: "expenses", level: "hizo", action: "movimiento_editado" },
  { method: "POST", path: "/groups/:groupId/ledger/entries/:entryId/void", tool: "expenses", level: "hizo", action: "movimiento_borrado" },
  { method: "POST", path: "/groups/:groupId/ledger/import/previews/:previewId/confirm", tool: "expenses", level: "hizo", action: "importacion_confirmada" },
  // Tareas: abrir un tablero (el cliente pide sus tarjetas); crear, mover o editar una tarjeta; comentar; adjuntar.
  { method: "GET", path: "/api/tareas/boards/:boardId/cards", tool: "tasks", level: "entro", action: null },
  { method: "POST", path: "/api/tareas/boards/:boardId/cards", tool: "tasks", level: "hizo", action: "tarjeta_creada" },
  { method: "POST", path: "/api/tareas/boards/:boardId/reorder", tool: "tasks", level: "hizo", action: "tarjeta_movida" },
  { method: "PUT", path: "/api/tareas/cards/:id", tool: "tasks", level: "hizo", action: "tarjeta_editada" },
  { method: "POST", path: "/api/tareas/cards/:id/comments", tool: "tasks", level: "hizo", action: "comentario" },
  { method: "POST", path: "/api/tareas/cards/:id/attachments", tool: "tasks", level: "hizo", action: "adjunto" },
  // Remanso: abrir Remanso con sesión. Terminar o abandonar una sesión llega por POST /api/uso/remanso.
  { method: "GET", path: "/remanso", tool: "calm", level: "entro", action: null },
]);

// Acciones de Remanso que informa el navegador (D8): resultado -> nivel y acción.
export const REMANSO_RESULTS = Object.freeze({
  terminada: { tool: "calm", level: "hizo", action: "sesion_terminada" },
  abandonada: { tool: "calm", level: "entro", action: "sesion_abandonada" },
});

export const TOOL_LABELS = Object.freeze({ expenses: "Cuentas Claras", tasks: "Tareas", calm: "Remanso" });

export const ACTION_LABELS = Object.freeze({
  expenses: Object.freeze({ movimiento_cargado: "Movimientos cargados", movimiento_editado: "Movimientos editados", movimiento_borrado: "Movimientos borrados", importacion_confirmada: "Importaciones confirmadas" }),
  tasks: Object.freeze({ tarjeta_creada: "Tarjetas creadas", tarjeta_movida: "Tarjetas movidas", tarjeta_editada: "Tarjetas editadas", comentario: "Comentarios", adjunto: "Adjuntos" }),
  calm: Object.freeze({ sesion_terminada: "Sesiones terminadas", sesion_abandonada: "Sesiones abandonadas" }),
});

const BY_ROUTE = new Map(USAGE_CATALOG.map((entry) => [`${entry.method} ${entry.path}`, entry]));

export function classifyRoute(method, routePath) {
  return BY_ROUTE.get(`${method} ${routePath}`) ?? null;
}
