// Señales de flujo: el pulso WIP.
//
// "Dejar de empezar y empezar a terminar". Recorre las columnas en curso de
// derecha a izquierda con un pulso sutil, para invitar a cerrar lo empezado
// antes de sumar algo nuevo. Es la manifestación en la interfaz del principio
// Lean que sostiene el producto, no un adorno.
//
// Lee el estado compartido (columnas y tablero actual) pero no lo escribe.

import { estado, getDoneColumnIds } from "./core/state.js";

const WIP_PULSE_INTERVAL = 5 * 60 * 1000;
let wipPulseTimer = null;

function wipPulseEnabled() {
  try { return localStorage.getItem("tasking-wip-pulse") !== "off"; } catch (e) { return true; }
}
function syncWipPulseButton() {
  const btn = document.getElementById("wipPulseBtn");
  if (btn) btn.classList.toggle("wip-pulse-off", !wipPulseEnabled());
}
function toggleWipPulse() {
  const turningOn = !wipPulseEnabled();
  try { localStorage.setItem("tasking-wip-pulse", turningOn ? "on" : "off"); } catch (e) { /* modo privado */ }
  syncWipPulseButton();
  if (turningOn) runWipPulseSequence({ alwaysShowMessage: true }); // preview inmediato, sin esperar los 5 minutos
}

// Columnas "en curso": todas menos la primera (sin empezar) y las de cierre,
// ordenadas de la más cercana a terminar (derecha) a la más lejos (izquierda).
function wipColumnsRightToLeft() {
  if (estado.COLUMNS.length < 2) return [];
  const doneIds = getDoneColumnIds();
  const sorted = [...estado.COLUMNS].sort((a, b) => a.position - b.position);
  const firstId = sorted[0].id;
  return sorted
    .filter(c => c.id !== firstId && !doneIds.has(c.id))
    .sort((a, b) => b.position - a.position);
}

function pulseColumn(colId) {
  document.querySelectorAll(`.cards[data-col="${CSS.escape(colId)}"] .card`).forEach(el => {
    el.classList.remove("wip-pulse");
    void el.offsetWidth; // reflow para poder reiniciar la animación
    el.classList.add("wip-pulse");
    el.addEventListener("animationend", () => el.classList.remove("wip-pulse"), { once: true });
  });
}

function showWipToast() {
  const toast = document.getElementById("wipToast");
  if (!toast) return;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 5000);
}

// Límite de una vez por día: aplica solo al pulso automático, para no repetir
// el mensaje de fondo. Los disparos manuales (toggle, atajo P) lo muestran siempre.
function maybeShowWipToast() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem("tasking-wip-msg-date") === today) return;
    localStorage.setItem("tasking-wip-msg-date", today);
  } catch (e) { /* modo privado: mostrar igual, sin recordar */ }
  showWipToast();
}

export function runWipPulseSequence({ alwaysShowMessage = false } = {}) {
  const cols = wipColumnsRightToLeft();
  if (!cols.length) return;
  if (alwaysShowMessage) showWipToast(); else maybeShowWipToast();
  cols.forEach((col, i) => setTimeout(() => pulseColumn(col.id), i * 500));
}

export function startWipPulse() {
  stopWipPulse();
  wipPulseTimer = setInterval(() => {
    if (!estado.currentBoardId || document.hidden || !wipPulseEnabled()) return;
    runWipPulseSequence();
  }, WIP_PULSE_INTERVAL);
}
export function stopWipPulse() {
  if (wipPulseTimer) { clearInterval(wipPulseTimer); wipPulseTimer = null; }
}

/** Enlaza el botón del pulso. El orden de arranque se decide en app.js. */
export function initWipPulse() {
  document.getElementById("wipPulseBtn").addEventListener("click", toggleWipPulse);
  syncWipPulseButton();
}
