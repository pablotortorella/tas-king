// Teclado: atajos globales del tablero.
//
// F mis tareas · U urgentes · N tarjeta nueva bajo el mouse · P pulso WIP ·
// 0-9 filtro por etiqueta · F1 ayuda.
//
// Los atajos se inhiben mientras el foco está en un campo de texto y mientras
// hay un overlay abierto: si no, escribir una descripción dispararía filtros.
//
// No importa ninguna feature: cuando el atajo pertenece a otra —abrir una
// tarjeta, disparar el pulso— emite y app.js decide quién atiende. La cadena de
// Escape se queda en app.js a propósito: decidir qué cierra Esc es cableado,
// igual que las suscripciones del bus.

import { emit } from "./core/bus.js";
import { estado } from "./core/state.js";
import { render } from "./board.js";

// ---------- Atajos de teclado (F = mis tareas, U = urgentes, N = nueva tarjeta) ----------
let mouseX = 0, mouseY = 0;
document.addEventListener("mousemove", e => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

// F: alterna el filtro entre "mis tareas" (asignadas a mí) y "todos".
function toggleMyTasks() {
  if (!estado.me) return;
  estado.assigneeFilter = (estado.assigneeFilter === estado.me.email) ? "" : estado.me.email;
  const sel = document.getElementById("assigneeFilter");
  sel.value = [...sel.options].some(o => o.value === estado.assigneeFilter) ? estado.assigneeFilter : "";
  if (sel.value !== estado.assigneeFilter) estado.assigneeFilter = sel.value;  // por si no soy opción del filtro
  render();
}

// U: alterna el filtro de urgentes (vencen hoy/mañana).
function toggleUrgent() {
  estado.urgentFilter = !estado.urgentFilter;
  document.getElementById("urgentBtn").classList.toggle("urgent-on", estado.urgentFilter);
  render();
}
document.getElementById("urgentBtn").addEventListener("click", toggleUrgent);

// N: crea una tarjeta en la columna bajo el mouse (o la primera si está afuera).
function newCardUnderMouse() {
  const el = document.elementFromPoint(mouseX, mouseY);
  const col = el && el.closest ? el.closest(".column") : null;
  const cardsEl = col && col.querySelector(".cards");
  emit("tarjeta:abrir", { id: null, columna: cardsEl ? cardsEl.dataset.col : estado.COLUMNS[0].id });
}

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();

  // F1: ayuda (siempre disponible)
  if (k === "f1") { e.preventDefault(); toggleHelpModal(); return; }

  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
  // Con la ayuda abierta no corren los atajos del tablero. Cerrarla es tarea de
  // la cadena de Escape, en app.js, que es el único lugar donde se decide qué
  // cierra Esc cuando hay varios overlays.
  if (ayudaAbierta()) return;

  // Si hay modal de tarjeta abierto, solo permitir esc para cerrarlo
  if (document.querySelector(".overlay.open")) return;

  if (k === "f") { e.preventDefault(); toggleMyTasks(); }
  else if (k === "u") { e.preventDefault(); toggleUrgent(); }
  else if (k === "n") { e.preventDefault(); newCardUnderMouse(); }
  else if (k === "p") { e.preventDefault(); emit("pulso:manual"); }
  else if (k === "0") { e.preventDefault(); estado.activeLabelFilters.clear(); render(); }
  else if (k >= "1" && k <= "9") {
    const idx = parseInt(k) - 1;
    const label = estado.boardLabels[idx];
    if (label) {
      e.preventDefault();
      if (estado.activeLabelFilters.has(label.id)) {
        estado.activeLabelFilters.delete(label.id);
      } else {
        estado.activeLabelFilters.clear();
        estado.activeLabelFilters.add(label.id);
      }
      render();
    }
  }
});

// ---------- Modal de ayuda (F1) ----------

const helpModal = document.getElementById("helpModal");

export function ayudaAbierta() {
  return helpModal.classList.contains("open");
}

export function cerrarAyuda() {
  helpModal.classList.remove("open");
}

function toggleHelpModal() {
  helpModal.classList.toggle("open");
}

document.getElementById("helpCloseBtn").addEventListener("click", () => cerrarAyuda());
