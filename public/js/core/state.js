// Estado compartido del frontend.
//
// Hasta acá estas variables vivían en el closure del IIFE de app.js, donde ~180
// funciones las leían y escribían sin que existiera un solo lugar donde ver qué
// muta qué. Concentrarlas es el punto: no esconderlas.
//
// Es un objeto con propiedades y no un binding mutable exportado (`export let`),
// porque un binding importado no se puede reasignar desde otro módulo. Los
// módulos leen y escriben `estado.X`, que además deja visible en cada uso que
// eso es estado compartido y no una variable local.
//
// Lo que NO vive acá: el estado que pertenece a una sola sección. `pollTimer` y
// `pollInFlight` son de polling, `cardDrag` es del arrastre, `pendingImport` es
// de importación. Estaban en el closure por falta de frontera, no porque fueran
// compartidos.

export const estado = {
  // ---------- Concurrencia: polling contra mutaciones en vuelo ----------
  //
  // Estos cinco se mudaron juntos y sin cambios de lógica a propósito. Son la
  // protección, ganada en los cambios de performance y de sincronización de
  // tablero, contra que un poll de fondo pise una escritura en curso o que una
  // respuesta vieja sobrescriba una nueva. Separarlos o "limpiarlos" acá
  // reintroduciría bugs ya resueltos; los cubren drag-no-duplicate,
  // board-sync y card-mutation-performance.
  pendingCardMutations: 0,
  cardMutationRevision: 0,
  boardLoadRevision: 0,
  boardRefreshPending: false,
  lastKnownVersion: 0,

  // ---------- Filtros y vista ----------
  // Qué subconjunto de tarjetas se está mirando. Nada de esto se persiste: son
  // decisiones de la sesión en curso.
  searchQuery: "",               // texto del buscador (minúsculas)
  assigneeFilter: "",            // email del responsable filtrado, o "" = todos
  urgentFilter: false,           // solo tareas urgentes (vencen hoy/mañana)
  activeLabelFilters: new Set(), // ids de etiquetas para filtro OR
  activeGoalFilter: null,        // id de objetivo seleccionado (resalta sus tarjetas)
  currentView: "tasks",          // "tasks" | "goals"

  // ---------- Modal de tarjeta: lo que se está editando ----------
  // Los borradores existen porque una tarjeta nueva todavía no tiene id: se
  // acumulan en memoria mientras se redacta y se vinculan después de crearla.
  editingId: null,            // id de la tarjeta abierta, o null si es nueva
  draftAttachments: [],       // adjuntos en edición (existentes + nuevos pendientes)
  removedAttachmentIds: [],   // adjuntos existentes marcados para borrar al guardar
  draftChecklists: [],        // checklists de una tarjeta aún sin guardar
  draftGoals: [],             // objetivos elegidos para una tarjeta aún sin guardar

  // ---------- Datos del tablero actual ----------
  // Se recargan al cambiar de tablero y con cada poll que detecta una revisión
  // nueva. `state` conserva su nombre original: renombrarlo sería un cambio
  // semántico y esta migración no toca comportamiento.
  COLUMNS: [],        // columnas del tablero actual
  state: { cards: [] },
  boardLabels: [],    // etiquetas del tablero actual
  boardGoals: [],     // objetivos del tablero actual (con progreso)
  members: [],        // miembros del tablero actual

  // ---------- Sesión ----------
  me: null,             // usuario actual + sus tableros
  currentBoardId: null, // tablero seleccionado

  // Arrastre en curso: { el, pointerId, startX, startY, active } o null.
  // Parece local del arrastre pero no lo es: loadCards() y el polling lo
  // consultan para no re-renderizar una tarjeta que se está moviendo.
  cardDrag: null,
};

// ---------- Derivados ----------
// No son estado: son lecturas del estado. Viven acá porque cualquier módulo que
// necesite saber qué columnas cierran, o en qué tablero está parado, lo pregunta
// sin tener que conocer la forma interna de `estado`.

/** Columnas marcadas con is_done=1; si no hay ninguna, la última por posición. */
export const getDoneColumnIds = () => {
  const done = estado.COLUMNS.filter(c => c.isDone).map(c => c.id);
  return new Set(done.length > 0 ? done : [(estado.COLUMNS[estado.COLUMNS.length - 1] || {}).id || "terminado"]);
};

export const currentBoard = () => estado.me && estado.me.boards.find(b => b.id === estado.currentBoardId);
