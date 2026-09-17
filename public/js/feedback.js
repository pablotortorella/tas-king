// Señales hacia quien usa el tablero: pulso WIP, tip diario y celebración.
//
// Las tres empujan la misma idea desde ángulos distintos. El pulso invita a
// cerrar lo empezado antes de sumar algo nuevo ("dejar de empezar y empezar a
// terminar"). El tip enseña una práctica por día. El confeti celebra cuando algo
// llega a una columna de cierre. No son adornos: son la parte del producto que
// no organiza tareas sino que empuja a terminarlas.
//
// Lee el estado compartido pero no lo escribe.

import { estado, getDoneColumnIds } from "./core/state.js";
import { fechaLocal } from "./core/dom.js";

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

// ---------- Tip diario ----------

// El tip del día. El backend guarda un contador monótono de tips vistos; el
// ciclado se resuelve acá, junto al catálogo, para que agregar tips no toque
// el backend. Sin catálogo o sin avance, muestra el primero en vez de fallar.
function tipDelDia() {
  const catalogo = globalThis.DAILY_TIPS;
  if (!Array.isArray(catalogo) || !catalogo.length) return null;
  const indice = Number.isInteger(estado.me && estado.me.tipIndex) ? estado.me.tipIndex : 0;
  return catalogo[indice % catalogo.length];
}

// La franja del tip: permanente, sin descarte. Si no hay catálogo o no hay
// avance, no se muestra nada — nunca se rompe la carga del tablero por un tip.
export function renderTipDaily() {
  const franja = document.getElementById("tipDaily");
  if (!franja) return;
  const texto = tipDelDia();
  if (!texto) { franja.hidden = true; return; }
  document.getElementById("tipText").textContent = texto;
  franja.hidden = false;
}

// Realce diario: una vez por día, tras la primera interacción con el tablero,
// la franja titila para que se la note. El tope es por dispositivo a propósito
// (ver design.md): quien entra desde el teléfono y desde la compu lo ve en cada
// pantalla, porque el realce sirve ahí donde la persona está mirando.
export function maybeBlinkTip() {
  const franja = document.getElementById("tipDaily");
  if (!franja || franja.hidden) return;
  const hoy = fechaLocal();
  try {
    if (localStorage.getItem("tasking-tip-blink-date") === hoy) return;
    localStorage.setItem("tasking-tip-blink-date", hoy);
  } catch (e) { /* modo privado: realzar igual, sin recordar */ }
  franja.classList.remove("tip-blink");
  void franja.offsetWidth;                 // reinicia la animación si ya estaba puesta
  franja.classList.add("tip-blink");
}

// Una sola vez por sesión: loadBoard() se llama muchas veces.
let realceArmado = false;

export function armarRealceDelTip() {
  if (realceArmado) return;                // loadBoard() se llama muchas veces
  realceArmado = true;
  const tablero = document.getElementById("board");
  const alPrimerGesto = () => {
    tablero && tablero.removeEventListener("pointerdown", alPrimerGesto);
    document.removeEventListener("keydown", alPrimerGesto);
    maybeBlinkTip();
  };
  tablero && tablero.addEventListener("pointerdown", alPrimerGesto);
  document.addEventListener("keydown", alPrimerGesto);
}

export function celebrateCard(cardId) {
  launchConfetti();
  const el = document.querySelector(`.card[data-id="${cardId}"]`);
  if (!el) return;
  el.classList.remove("celebrating");
  void el.offsetWidth; // reflow para reiniciar la animación
  el.classList.add("celebrating");
  el.addEventListener("animationend", () => el.classList.remove("celebrating"), { once: true });
}

// ---------- Confeti ----------
//
// El IIFE que envolvía esto ya no hace falta: el scope de un módulo ES
// no filtra nada al global.

const canvas = document.getElementById("confetti-canvas");
const ctx = canvas.getContext("2d");
const COLORS = ["#ffd700","#ff6b6b","#4ecdc4","#45b7d1","#96ceb4","#ff9ff3","#54a0ff","#5f27cd","#00d2d3","#ff9f43"];
let particles = [], rafId = null;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resize);
resize();

export function launchConfetti() {
  particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 40,
    r: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    vx: (Math.random() - 0.5) * 6,
    vy: 3 + Math.random() * 5,
    gravity: 0.18 + Math.random() * 0.1,
    life: 1,
    decay: 0.012 + Math.random() * 0.008,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));
  if (rafId) cancelAnimationFrame(rafId);
  step();
}

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.shape === "rect") ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
    p.angle += p.spin; p.life -= p.decay;
  }
  if (particles.length) rafId = requestAnimationFrame(step);
}
