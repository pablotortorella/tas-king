// Arrastre de tarjetas y paneo del tablero.
//
// Dos gestos de puntero que comparten poco salvo el medio: mover una tarjeta
// entre columnas, y correr el tablero arrastrando el fondo o el encabezado.
// Están juntos porque los dos escuchan pointermove/pointerup en window y hay que
// poder leer de un solo lado quién reacciona a qué.
//
// El estado del arrastre vive en `estado.cardDrag` y no acá: loadCards() y el
// polling lo consultan para no re-renderizar una tarjeta en movimiento.

import { api } from "./core/api.js";
import { emit } from "./core/bus.js";
import { estado, getDoneColumnIds } from "./core/state.js";
import { board, loadBoard, render } from "./board.js";

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".card:not(.dragging)")];
  let closest = { offset: -Infinity, element: null };
  for (const child of els) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

// Reconstruye state.cards (columna + orden) a partir del orden actual del DOM.
function rebuildOrderFromDom() {
  const newOrder = [];
  const seenIds = new Set();
  board.querySelectorAll(".cards").forEach(container => {
    const colId = container.dataset.col;
    container.querySelectorAll(".card").forEach(el => {
      // Si un re-render (ej. el polling) pisó el tablero a mitad de un arrastre, el nodo
      // viejo de la tarjeta arrastrada queda "huérfano" y se re-inserta junto al nuevo que
      // el render acaba de crear — mismo id, dos elementos. Sin este guard, la tarjeta
      // quedaría duplicada en state.cards (y por lo tanto en pantalla) hasta el próximo poll.
      if (seenIds.has(el.dataset.id)) return;
      const card = estado.state.cards.find(c => c.id === el.dataset.id);
      if (card) { seenIds.add(card.id); card.column = colId; newOrder.push(card); }
    });
  });
  // por seguridad, conservar cualquier tarjeta que no haya quedado en el DOM
  estado.state.cards.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
  estado.state.cards = newOrder;
}

// Envía al backend la columna y posición de cada tarjeta según el orden actual.
function persistOrder() {
  const items = [];
  estado.COLUMNS.forEach(col => {
    let pos = 0;
    estado.state.cards.filter(c => c.column === col.id).forEach(c => {
      items.push({ id: c.id, column: col.id, position: ++pos });
    });
  });
  return api("POST", "/api/boards/" + estado.currentBoardId + "/reorder", items);
}

  // ---------- Drag & drop de tarjetas (Pointer Events) ----------
// HTML5 Drag&Drop nativo (dragstart/dragover) depende de que el navegador traduzca
// gestos táctiles a esos eventos. Chrome lo hace (de forma no estándar); Firefox para
// Android no, así que ahí tocar y arrastrar una tarjeta solo scrollea el tablero.
// Con Pointer Events el mismo código maneja mouse y touch en cualquier navegador.
const CARD_DRAG_THRESHOLD = 5; // px de movimiento antes de considerar que empezó un arrastre

export function startCardDrag(e, el, card) {
  if (e.pointerType === "mouse" && e.button !== 0) return; // solo botón principal
  if (estado.cardDrag) return;
  e.preventDefault(); // el D&D nativo HTML5 prevenía la selección de texto solo; con Pointer Events hay que hacerlo a mano
  estado.cardDrag = { el, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false };
}

function activateCardDrag(e) {
  estado.cardDrag.active = true;
  estado.cardDrag.el._justDragged = true;
  estado.cardDrag.el.classList.add("dragging");
  estado.cardDrag.el.style.pointerEvents = "none"; // para que elementFromPoint "vea" lo que hay debajo
  // Reparentar la tarjeta entre columnas mientras el navegador tiene una selección de
  // texto "en vuelo" confunde su heurística de selección (nodos moviéndose de lugar) y
  // termina seleccionando cosas por fuera de la tarjeta, incluso con preventDefault() en
  // el pointerdown. user-select:none en toda la página durante el arrastre lo evita del todo.
  document.body.classList.add("dragging-active");
  window.getSelection()?.removeAllRanges();
  try { estado.cardDrag.el.setPointerCapture(estado.cardDrag.pointerId); } catch { /* no soportado, no es crítico */ }
}

function endCardDrag() {
  const wasActive = estado.cardDrag.active;
  const el = estado.cardDrag.el;
  el.classList.remove("dragging");
  el.style.pointerEvents = "";
  document.body.classList.remove("dragging-active");
  document.querySelectorAll(".cards.drag-over").forEach(c => c.classList.remove("drag-over"));
  estado.cardDrag = null;
  return wasActive;
}

window.addEventListener("pointermove", e => {
  if (!estado.cardDrag || e.pointerId !== estado.cardDrag.pointerId) return;
  if (!estado.cardDrag.active) {
    const dist = Math.hypot(e.clientX - estado.cardDrag.startX, e.clientY - estado.cardDrag.startY);
    if (dist < CARD_DRAG_THRESHOLD) return;
    activateCardDrag(e);
  }
  e.preventDefault();
  // Defensa extra: si a pesar de todo el navegador arrancó una selección, la limpiamos
  // en cada tick — nunca llega a verse (el próximo repaint ya está sin selección).
  if (window.getSelection()?.toString()) window.getSelection().removeAllRanges();
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const cardsEl = target && target.closest(".cards");
  document.querySelectorAll(".cards.drag-over").forEach(c => { if (c !== cardsEl) c.classList.remove("drag-over"); });
  if (!cardsEl) return;
  cardsEl.classList.add("drag-over");
  const afterEl = getDragAfterElement(cardsEl, e.clientY);
  if (afterEl == null) cardsEl.appendChild(estado.cardDrag.el);
  else cardsEl.insertBefore(estado.cardDrag.el, afterEl);
});

window.addEventListener("pointerup", async e => {
  if (!estado.cardDrag || e.pointerId !== estado.cardDrag.pointerId) return;
  if (!endCardDrag()) return; // no hubo arrastre real: fue un tap/click normal
  const doneColIds = getDoneColumnIds();
  const prevCols = Object.fromEntries(estado.state.cards.map(c => [c.id, c.column]));
  rebuildOrderFromDom();
  render();                 // refleja el nuevo orden de inmediato
  // celebrar tarjetas que acaban de llegar a cualquier columna de cierre
  estado.state.cards.filter(c => doneColIds.has(c.column) && !doneColIds.has(prevCols[c.id]))
    .forEach(c => emit("tarjeta:celebrar", c.id));
  try { await persistOrder(); }
  catch (err) { alert("No se pudo guardar el orden: " + err.message); loadBoard(); }
});

window.addEventListener("pointercancel", e => {
  if (!estado.cardDrag || e.pointerId !== estado.cardDrag.pointerId) return;
  endCardDrag();
});

// ---------- Mover el tablero arrastrando el fondo o el header (mouse) ----------
// En celular el arrastre con el dedo ya mueve el tablero de forma nativa.
let panning = false, panX = 0, panY = 0, panL = 0, panT = 0;

// Es "agarrable" todo lo que no sea una tarjeta ni un control interactivo.
function isPannable(target) {
  return !target.closest(".card, .add-card, button, input, textarea, select, a, label, .overlay");
}

function startPan(e) {
  if (e.pointerType !== "mouse" || e.button !== 0) return;  // solo botón principal del mouse
  if (!isPannable(e.target)) return;
  panning = true;
  panX = e.clientX; panY = e.clientY;
  panL = board.scrollLeft; panT = board.scrollTop;
  board.classList.add("panning");
  headerEl.classList.add("panning");
  e.preventDefault();   // evita seleccionar texto al arrastrar
}

const headerEl = document.querySelector("header");
headerEl.addEventListener("pointerdown", startPan);
board.addEventListener("pointerdown", startPan);
window.addEventListener("pointermove", e => {
  if (!panning) return;
  board.scrollLeft = panL - (e.clientX - panX);
  board.scrollTop = panT - (e.clientY - panY);
});
window.addEventListener("pointerup", () => {
  panning = false;
  board.classList.remove("panning");
  headerEl.classList.remove("panning");
});
