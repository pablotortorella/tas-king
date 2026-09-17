// Objetivos y métricas del tablero.
//
// Dos paneles laterales que comparten forma y ciclo de vida: 🎯 Objetivos
// (gestión por metas, con progreso por objetivo) y 📊 ¿Cómo vamos? (burn-up,
// distribución de WIP y "¡Pilas con esto!" con las quietas y las por vencer).
//
// Están juntos porque comparten el mecanismo del cajón lateral y la vista amplia,
// y porque separarlos obligaría a que uno importara del otro. Si alguno crece,
// el corte natural es por panel.
//
// Abrir una tarjeta desde "¡Pilas con esto!" se avisa por el bus: el modal es
// otra feature.

import { api } from "./core/api.js";
import { emit } from "./core/bus.js";
import { escapeHtml } from "./core/dom.js";
import { estado } from "./core/state.js";
import { board, loadCards, loadGoals, render } from "./board.js";

// El contenedor de la vista amplia de objetivos, hermano del tablero.
const goalsBoard = document.getElementById("goalsBoard");

// ---------- Vista de objetivos (vista amplia + panel lateral) ----------
export const goalsDrawer = document.getElementById("goalsDrawer");
const goalsDrawerList = document.getElementById("goalsDrawerList");

export function showView(view) {
  estado.currentView = view;
  const isGoals = view === "goals";
  board.style.display = isGoals ? "none" : "";
  goalsBoard.style.display = isGoals ? "" : "none";
  refreshGoalsUI();
}

// Construye la tarjeta DOM de un objetivo. Si selectable, al hacer click resalta
// las tarjetas vinculadas en el tablero (atenúa el resto).
function buildGoalCard(goal, selectable) {
  const card = document.createElement("div");
  card.className = "goal-card" + (selectable && estado.activeGoalFilter === goal.id ? " selected" : "");
  const doneClass = goal.total > 0 && goal.done === goal.total ? " done" : "";
  card.innerHTML = `
    <div class="goal-head">
      <h3>${escapeHtml(goal.title)}</h3>
      <div class="goal-ops">
        <button data-act="edit" title="Editar objetivo">✏️</button>
        <button data-act="delete" title="Eliminar objetivo">🗑</button>
      </div>
    </div>
    ${goal.description ? `<div class="goal-desc">${escapeHtml(goal.description)}</div>` : ""}
    <div class="goal-progress${doneClass}"><span style="width:${goal.pct}%"></span></div>
    <div class="goal-stats">${goal.done}/${goal.total} tarjetas terminadas · ${goal.pct}%</div>
  `;
  card.querySelector('[data-act="edit"]').addEventListener("click", e => { e.stopPropagation(); editGoal(goal); });
  card.querySelector('[data-act="delete"]').addEventListener("click", e => { e.stopPropagation(); deleteGoal(goal); });
  if (selectable) {
    card.addEventListener("click", () => toggleGoalFilter(goal.id));
  }
  return card;
}

// Renderiza la lista de objetivos + formulario de creación dentro de un contenedor.
// selectable: en el panel, click en un objetivo resalta sus tarjetas.
// fullView: en la vista ampliada, agrega una barra para volver al tablero.
function renderGoalsList(container, selectable, fullView) {
  container.innerHTML = "";

  if (fullView) {
    const head = document.createElement("div");
    head.className = "goals-fullhead";
    head.innerHTML = `
      <span>🎯 Objetivos</span>
      <button class="btn btn-ghost btn-small goals-back-btn">📋 Volver al tablero</button>
    `;
    head.querySelector(".goals-back-btn").addEventListener("click", () => showView("tasks"));
    container.appendChild(head);
  }

  estado.boardGoals.forEach(goal => container.appendChild(buildGoalCard(goal, selectable)));

  if (!estado.boardGoals.length) {
    const empty = document.createElement("div");
    empty.className = "goals-empty";
    empty.textContent = "Todavía no hay objetivos. Creá uno para agrupar tus tarjetas y medir el avance.";
    container.appendChild(empty);
  }

  const create = document.createElement("div");
  create.className = "goal-create";
  create.innerHTML = `
    <input type="text" class="new-goal-title" placeholder="Título del objetivo..." maxlength="120">
    <textarea class="new-goal-desc" placeholder="Descripción (opcional)..." rows="2" maxlength="500"></textarea>
    <button class="btn btn-primary btn-small new-goal-btn">+ Crear objetivo</button>
  `;
  create.querySelector(".new-goal-btn").addEventListener("click", () => createGoal(create));
  container.appendChild(create);
}

// Re-renderiza la vista amplia y el panel (si está abierto).
export function refreshGoalsUI() {
  renderGoalsList(goalsBoard, false, true);
  if (goalsDrawer.classList.contains("open")) renderGoalsList(goalsDrawerList, true, false);
}

// ---------- Panel lateral de objetivos ----------
export function openGoalsDrawer() {
  goalsDrawer.classList.add("open");
  document.body.classList.add("drawer-open");
  renderGoalsList(goalsDrawerList, true, false);
}

// Ampliar: cierra el panel y muestra la vista de objetivos a pantalla completa.
function expandGoals() {
  goalsDrawer.classList.remove("open");
  document.body.classList.remove("drawer-open");
  showView("goals");
}

export function closeGoalsDrawer() {
  goalsDrawer.classList.remove("open");
  document.body.classList.remove("drawer-open");
  if (estado.activeGoalFilter) { estado.activeGoalFilter = null; render(); } // limpia el resaltado
}

function toggleGoalsDrawer() {
  if (goalsDrawer.classList.contains("open")) { closeGoalsDrawer(); return; }
  if (estado.currentView === "goals") showView("tasks"); // el panel trabaja sobre el tablero
  openGoalsDrawer();
}

// Selecciona/deselecciona un objetivo para resaltar sus tarjetas en el tablero.
function toggleGoalFilter(goalId) {
  estado.activeGoalFilter = estado.activeGoalFilter === goalId ? null : goalId;
  if (estado.currentView === "goals") showView("tasks"); // el resaltado se ve en el tablero
  render();
  refreshGoalsUI();
}

async function createGoal(container) {
  const title = (container.querySelector(".new-goal-title").value || "").trim();
  const description = (container.querySelector(".new-goal-desc").value || "").trim();
  if (!title) { alert("Escribí un título para el objetivo."); return; }
  try {
    await api("POST", "/api/boards/" + estado.currentBoardId + "/goals", { title, description });
    await loadGoals();
    refreshGoalsUI();
  } catch (e) { alert("No se pudo crear el objetivo: " + e.message); }
}

async function editGoal(goal) {
  const title = prompt("Título del objetivo:", goal.title);
  if (title === null) return;
  if (!title.trim()) { alert("El título no puede quedar vacío."); return; }
  const description = prompt("Descripción (opcional):", goal.description || "");
  if (description === null) return;
  try {
    await api("PUT", "/api/boards/" + estado.currentBoardId + "/goals/" + goal.id,
      { title: title.trim(), description: description.trim() });
    await loadGoals();
    refreshGoalsUI();
  } catch (e) { alert("No se pudo editar el objetivo: " + e.message); }
}

async function deleteGoal(goal) {
  if (!confirm(`¿Eliminar el objetivo “${goal.title}”?\n\nLas tarjetas no se borran, solo se desvinculan.`)) return;
  try {
    await api("DELETE", "/api/boards/" + estado.currentBoardId + "/goals/" + goal.id);
    if (estado.activeGoalFilter === goal.id) estado.activeGoalFilter = null;
    await loadCards(); // refresca también las tarjetas (perdieron el vínculo)
  } catch (e) { alert("No se pudo eliminar el objetivo: " + e.message); }
}

document.getElementById("goalsBtn").addEventListener("click", toggleGoalsDrawer);
document.getElementById("goalsExpandBtn").addEventListener("click", expandGoals);
document.getElementById("goalsDrawerClose").addEventListener("click", closeGoalsDrawer);

// ── Panel de métricas ──────────────────────────────────────────────────
export const metricsDrawer = document.getElementById("metricsDrawer");

function openMetricsDrawer() {
  closeGoalsDrawer();
  metricsDrawer.classList.add("open");
  document.body.classList.add("metrics-open");
  loadMetrics();
}
export function closeMetricsDrawer() {
  metricsDrawer.classList.remove("open");
  document.body.classList.remove("metrics-open");
}
function toggleMetricsDrawer() {
  if (metricsDrawer.classList.contains("open")) { closeMetricsDrawer(); return; }
  openMetricsDrawer();
}

async function loadMetrics() {
  if (!estado.currentBoardId) return;
  try {
    const m = await api("GET", "/api/boards/" + estado.currentBoardId + "/metrics");
    document.getElementById("mToday").textContent = m.completedByPeriod.today;
    document.getElementById("mWeek").textContent  = m.completedByPeriod.thisWeek;
    document.getElementById("mMonth").textContent = m.completedByPeriod.thisMonth;
    if (m.leadTimeDays) {
      document.getElementById("mLeadAvg").textContent = m.leadTimeDays.avg;
      document.getElementById("mLeadSub").textContent =
        "de " + m.leadTimeDays.sample + " tarjetas · mín " + m.leadTimeDays.min + " · máx " + m.leadTimeDays.max + " días";
    } else {
      document.getElementById("mLeadAvg").textContent = "N/A";
      document.getElementById("mLeadSub").textContent = "Sin tarjetas completadas aún";
    }
    renderBurnupChart(m.burnup);
    renderWipChart(m.wipByColumn);
    renderStaleCards(m.staleCards || []);
    renderDueSoonCards(m.dueSoonCards || []);
  } catch (e) {
    document.getElementById("mToday").textContent = "?";
  }
}

function renderStaleCards(cards) {
  const list = document.getElementById("metricsStaleList");
  if (!cards.length) {
    list.innerHTML = '<li style="font-size:12px;color:var(--muted)">¡Todo al día! No hay tareas quietas. 🎉</li>';
    return;
  }
  list.innerHTML = cards.map(c => {
    const dias = c.daysSinceUpdate === 0 ? "hoy" : c.daysSinceUpdate === 1 ? "hace 1 día" : "hace " + c.daysSinceUpdate + " días";
    return `<li class="stale-item" data-id="${escapeHtml(c.id)}" title="Abrir tarjeta">
      <div class="stale-item-title">${escapeHtml(c.title)}</div>
      <div class="stale-item-meta">📍 ${escapeHtml(c.columnName)} · ${dias}</div>
    </li>`;
  }).join("");
  bindStaleItemClicks(list);
}

function renderDueSoonCards(cards) {
  const list = document.getElementById("metricsDueSoonList");
  if (!cards.length) {
    list.innerHTML = '<li style="font-size:12px;color:var(--muted)">Sin vencimientos cercanos. 🎉</li>';
    return;
  }
  list.innerHTML = cards.map(c => {
    const dias = c.daysUntilDue < 0
      ? "venció hace " + (-c.daysUntilDue) + (c.daysUntilDue === -1 ? " día" : " días")
      : c.daysUntilDue === 0 ? "vence hoy"
      : c.daysUntilDue === 1 ? "vence mañana"
      : "vence en " + c.daysUntilDue + " días";
    return `<li class="stale-item" data-id="${escapeHtml(c.id)}" title="Abrir tarjeta">
      <div class="stale-item-title">${escapeHtml(c.title)}</div>
      <div class="stale-item-meta ${c.daysUntilDue < 0 ? "overdue" : ""}">📍 ${escapeHtml(c.columnName)} · ${dias}</div>
    </li>`;
  }).join("");
  bindStaleItemClicks(list);
}

function bindStaleItemClicks(list) {
  list.querySelectorAll(".stale-item[data-id]").forEach(li => {
    li.addEventListener("click", () => {
      closeMetricsDrawer();
      emit("tarjeta:abrir", { id: li.dataset.id });
    });
  });
}

function renderBurnupChart(data) {
  const wrap = document.getElementById("metricsBurnupWrap");
  const W = 312, H = 80, PAD = 4;
  // Construir los últimos 30 días
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  // Acumulado con carry-forward
  const byDate = new Map(data.map(d => [d.date, d.cumulative]));
  let last = 0;
  const points = days.map(date => {
    if (byDate.has(date)) last = byDate.get(date);
    return last;
  });
  const maxVal = Math.max(...points, 1);
  const barW = (W - PAD * 2) / 30;
  const bars = points.map((v, i) => {
    const h = Math.max(2, Math.round((v / maxVal) * (H - 12)));
    const x = (PAD + i * barW).toFixed(1);
    const y = H - h - 4;
    return `<rect x="${x}" y="${y}" width="${(barW - 1).toFixed(1)}" height="${h}" fill="var(--accent)" opacity="0.7" rx="1"/>`;
  }).join("");
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="height:${H}px">
      <text x="${PAD}" y="10" font-size="9" fill="var(--muted)">${maxVal}</text>
      ${bars}
    </svg>
    <div style="font-size:10px;color:var(--muted);display:flex;justify-content:space-between;margin-top:2px">
      <span>${days[0].slice(5)}</span><span>hoy</span>
    </div>`;
}

function renderWipChart(data) {
  const wrap = document.getElementById("metricsWipWrap");
  if (!data.length) { wrap.innerHTML = '<div style="color:var(--muted);font-size:12px">Sin columnas.</div>'; return; }
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const ROW_H = 22, PAD = 4, LABEL_W = 90, BAR_AREA = 170, NUM_W = 30;
  const svgH = data.length * ROW_H + PAD;
  const rows = data.map((col, i) => {
    const barW = Math.max(2, Math.round((col.count / maxCount) * BAR_AREA));
    const y = PAD + i * ROW_H;
    return `
      <text x="0" y="${y + 14}" font-size="11" fill="var(--text)"
        textLength="${LABEL_W - 4}" lengthAdjust="spacingAndGlyphs">${escapeHtml(col.name)}</text>
      <rect x="${LABEL_W}" y="${y + 4}" width="${barW}" height="14"
        fill="var(--accent)" opacity="0.6" rx="2"/>
      <text x="${LABEL_W + BAR_AREA + 4}" y="${y + 14}" font-size="11" fill="var(--muted)">${col.count}</text>`;
  }).join("");
  wrap.innerHTML = `<svg viewBox="0 0 ${LABEL_W + BAR_AREA + NUM_W} ${svgH}" style="height:${svgH}px">${rows}</svg>`;
}

document.getElementById("metricsBtn").addEventListener("click", toggleMetricsDrawer);
document.getElementById("metricsDrawerClose").addEventListener("click", closeMetricsDrawer);

// Tooltip global (escapa overflow del drawer)
const globalTip = document.getElementById("globalTip");
document.querySelectorAll(".info-tip").forEach(tip => {
  const text = tip.querySelector(".tip-text").textContent.trim();
  tip.addEventListener("mouseenter", e => {
    globalTip.textContent = text;
    globalTip.style.display = "block";
    const r = tip.getBoundingClientRect();
    const left = Math.min(r.left - 80, window.innerWidth - 226);
    globalTip.style.top  = (r.bottom + 6) + "px";
    globalTip.style.left = Math.max(8, left) + "px";
  });
  tip.addEventListener("mouseleave", () => { globalTip.style.display = "none"; });
});

        // Devuelve la tarjeta ante la cual hay que insertar (o null para agregar al final),
// según la posición vertical del cursor dentro de la columna.
