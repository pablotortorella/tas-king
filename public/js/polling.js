// Polling de cambios en tiempo real.
//
// Cada 5 segundos pregunta la revisión del tablero y, si cambió, recarga. Esa
// revisión es un contador opaco y no una fecha: comparar fechas no detectaba
// borrados ni escrituras en el mismo milisegundo (ADR-016).
//
// Se abstiene mientras hay una escritura en vuelo o un arrastre activo: recargar
// en medio de un arrastre deja el nodo de la tarjeta huérfano y la duplica en
// pantalla hasta el siguiente tick.
//
// No sabe nada del modal ni del confeti: avisa por el bus y cada quien decide.

import { api } from "./core/api.js";
import { emit } from "./core/bus.js";
import { estado, getDoneColumnIds } from "./core/state.js";
import { loadCards } from "./board.js";

// ---------- Polling de cambios en tiempo real ----------
let pollTimer = null;
let pollInFlight = false;
const POLL_INTERVAL = 5000;

export async function pollTick() {
  if (!estado.currentBoardId || document.hidden || estado.pendingCardMutations || pollInFlight) return;
  // loadCards() hace board.innerHTML = "" y reconstruye todas las tarjetas: si corre
  // mientras hay un arrastre en curso, el nodo de la tarjeta arrastrada queda huérfano
  // (desprendido del DOM que se acaba de tirar) pero cardDrag lo sigue moviendo con el
  // mouse — el próximo pointermove lo reinserta junto al nuevo nodo ya renderizado,
  // duplicando la tarjeta en pantalla hasta el siguiente poll. Se posterga al próximo tick.
  if (estado.cardDrag && estado.cardDrag.active) return;
  const boardId = estado.currentBoardId;
  const mutationRevision = estado.cardMutationRevision;
  pollInFlight = true;
  try {
    const { version } = await api("GET", "/api/boards/" + boardId + "/version");
    if (boardId !== estado.currentBoardId || mutationRevision !== estado.cardMutationRevision || estado.pendingCardMutations) return;
    if (version !== estado.lastKnownVersion) {
      const doneColIds = getDoneColumnIds();
      const prevTerminados = new Set(estado.state.cards.filter(c => doneColIds.has(c.column)).map(c => c.id));
      if (!(await loadCards())) return;
      emit("tablero:sincronizado");
      estado.state.cards.filter(c => getDoneColumnIds().has(c.column) && !prevTerminados.has(c.id))
        .forEach(c => emit("tarjeta:celebrar", c.id));
    }
    emit("poll:fin");
  } catch (e) { /* ignorar errores de red silenciosamente */ }
  finally { pollInFlight = false; }
}


export function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollTick, POLL_INTERVAL);
}

export function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
