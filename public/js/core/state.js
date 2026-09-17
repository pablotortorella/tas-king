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
};
