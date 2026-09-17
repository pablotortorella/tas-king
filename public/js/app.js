// Frontend de FUN TasKing!
//
// Movido tal cual desde el <script> inline de public/index.html, sin cambios de
// comportamiento: este paso es solo la extraccion. La division en modulos ES por
// dominio viene despues, en commits propios. Ver ADR-017.

import {
  AVATAR_COLORS, avatarHtml, defaultColor, escapeHtml,
  fechaLocal, fmtDate, relativeTime, shortName, uid,
} from "./core/dom.js";
import { api } from "./core/api.js";
import { colName, currentBoard, estado, getDoneColumnIds, memberByEmail } from "./core/state.js";
import { emit, on } from "./core/bus.js";
import { PALETTES, applyBoardPalette, initTheme } from "./theme.js";
import {
  armarRealceDelTip, celebrateCard, initWipPulse, launchConfetti, maybeBlinkTip,
  renderTipDaily, runWipPulseSequence, startWipPulse, stopWipPulse,
} from "./feedback.js";
import {
  applySavedCard, board, loadBoard, loadCards, loadGoals, loadMembers,
  render, updateBoardControls, withCardMutation,
} from "./board.js";
import { startCardDrag } from "./drag.js";
import { closeImportPreview, importOverlay } from "./io.js";

(function () {
  "use strict";

  initTheme();

  // Cableado de los avisos del tablero. board.js no conoce a las features: emite
  // y acá se decide quién atiende. Son avisos sin respuesta esperada; lo que se
  // espera (loadCards, loadBoard, render) se sigue llamando directo.
  on("sesion:cargada", () => { renderMe(); renderTipDaily(); armarRealceDelTip(); });
  on("tablero:cargado", () => checkThemePrompt());
  on("columnas:cambiaron", () => populateColumnSelect());
  on("objetivos:cambiaron", () => refreshGoalsUI());
  on("tarjeta:abrir", ({ id, columna }) => openModal(id, columna));
  on("tarjeta:arrastre", ({ e, el, card }) => startCardDrag(e, el, card));
  on("tarjeta:celebrar", id => celebrateCard(id));

  initWipPulse();
  window.runWipPulseSequence = runWipPulseSequence; // hook manual / tests E2E
  window.maybeBlinkTip = maybeBlinkTip;            // hook manual / tests E2E
  window.launchConfetti = launchConfetti;          // hook manual

  // Paleta fija para avatares por defecto (derivada del email).
  // Devuelve el HTML de un avatar (círculo con color + emoji o inicial).
  // Busca el perfil de un miembro del tablero actual por email.

  // Perfil del usuario actual (con email) para pasarlo a avatarHtml.
  const meProfile = () => ({
    email: estado.me.email,
    name: estado.me.profile.name,
    avatarEmoji: estado.me.profile.avatarEmoji,
    avatarColor: estado.me.profile.avatarColor,
  });
  function renderMe() {
    document.getElementById("profileBtn").innerHTML =
      avatarHtml(meProfile(), 22) + "<span>" + escapeHtml(estado.me.profile.name) + "</span>";
    const adminBtn = document.getElementById("adminBtn");
    const adminBadge = document.getElementById("adminBadge");
    adminBtn.style.display = estado.me.isAdmin ? "inline-block" : "none";
    if (estado.me.isAdmin && estado.me.pendingCount > 0) {
      adminBadge.style.display = "block";
      adminBadge.textContent = estado.me.pendingCount;
    } else {
      adminBadge.style.display = "none";
    }
  }

  // Capa de datos: API REST contra el backend (Worker + D1).

  // Fecha local en formato YYYY-MM-DD. Se la mandamos al backend para que el día
  // del tip cambie a la medianoche de la persona y no a la del servidor.


          // ---------- Polling de cambios en tiempo real ----------
  let pollTimer = null;
  let pollInFlight = false;
  let checklistRefreshPending = false;
  const POLL_INTERVAL = 5000;

  async function pollTick() {
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
        if (estado.editingId && overlay.classList.contains("open")) {
          renderComments(); // El campo del comentario y los demás borradores no se tocan.
          checklistRefreshPending = true;
        }
        estado.state.cards.filter(c => getDoneColumnIds().has(c.column) && !prevTerminados.has(c.id))
          .forEach(c => celebrateCard(c.id));
      }
      refreshSyncedChecklists();
    } catch (e) { /* ignorar errores de red silenciosamente */ }
    finally { pollInFlight = false; }
  }
  window.pollTick = pollTick; // hook manual / tests E2E

  function refreshSyncedChecklists() {
    if (!checklistRefreshPending) return;
    if (!estado.editingId || !overlay.classList.contains("open")) { checklistRefreshPending = false; return; }
    const section = document.getElementById("fChecklistsSection");
    // No reconstruir el campo que la persona está editando. El siguiente poll
    // atiende lo pendiente aunque ya no haya otra revisión del tablero.
    if (section.contains(document.activeElement)) return;
    const drafts = new Map([...section.querySelectorAll(".checklist-section")].map(el =>
      [el.dataset.checklistId, el.querySelector(".checklist-add input")?.value || ""]));
    renderChecklists();
    section.querySelectorAll(".checklist-section").forEach(el => {
      const input = el.querySelector(".checklist-add input");
      if (input && drafts.has(el.dataset.checklistId)) input.value = drafts.get(el.dataset.checklistId);
    });
    checklistRefreshPending = false;
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollTick, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

            const goalsBoard = document.getElementById("goalsBoard");

  // ---------- Vista de objetivos (vista amplia + panel lateral) ----------
  const goalsDrawer = document.getElementById("goalsDrawer");
  const goalsDrawerList = document.getElementById("goalsDrawerList");

  function showView(view) {
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
  function refreshGoalsUI() {
    renderGoalsList(goalsBoard, false, true);
    if (goalsDrawer.classList.contains("open")) renderGoalsList(goalsDrawerList, true, false);
  }

  // ---------- Panel lateral de objetivos ----------
  function openGoalsDrawer() {
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

  function closeGoalsDrawer() {
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
  const metricsDrawer = document.getElementById("metricsDrawer");

  function openMetricsDrawer() {
    closeGoalsDrawer();
    metricsDrawer.classList.add("open");
    document.body.classList.add("metrics-open");
    loadMetrics();
  }
  function closeMetricsDrawer() {
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
        openModal(li.dataset.id);
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
  // ---------- Archivar / Eliminar / Restaurar ----------
  async function archiveCard(id) {
    try { await api("POST", "/api/cards/" + id + "/archive"); await loadCards(); renderArchiveList(); }
    catch (e) { alert("No se pudo archivar: " + e.message); }
  }

  async function restoreCard(id) {
    try { await api("POST", "/api/cards/" + id + "/restore"); await loadCards(); renderArchiveList(); }
    catch (e) { alert("No se pudo restaurar: " + e.message); }
  }

  // Devuelve true si la tarjeta fue eliminada.
  async function deleteCard(id) {
    const card = estado.state.cards.find(c => c.id === id);
    if (!card) return false;
    const name = card.title ? `“${card.title}”` : "esta tarjeta";
    if (!confirm(`¿Eliminar ${name} de forma permanente?\n\nEsta acción no se puede deshacer.`)) return false;
    try {
      await api("DELETE", "/api/cards/" + id);
      await loadCards();
      renderArchiveList();
      return true;
    } catch (e) { alert("No se pudo eliminar: " + e.message); return false; }
  }

  // ---------- Overlay de archivadas ----------
  const archiveOverlay = document.getElementById("archiveOverlay");
  const archiveList = document.getElementById("archiveList");

  function renderArchiveList() {
    const archived = estado.state.cards
      .filter(c => c.archived)
      .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    archiveList.innerHTML = "";
    if (!archived.length) {
      archiveList.innerHTML = '<div class="archive-empty">No hay tarjetas archivadas.</div>';
      return;
    }
    archived.forEach(card => {
      const row = document.createElement("div");
      row.className = "archive-row";
      const when = card.archivedAt ? new Date(card.archivedAt).toLocaleDateString("es") : "";
      row.innerHTML = `
        <div class="info">
          <div class="t">${escapeHtml(card.title) || "(sin título)"}</div>
          <div class="sub">${escapeHtml(colName(card.column))}${when ? " · archivada el " + when : ""}</div>
        </div>
        <div class="ops">
          <button class="btn btn-ghost btn-small" data-act="restore">Restaurar</button>
          <button class="btn btn-danger btn-small" data-act="delete">Eliminar</button>
        </div>
      `;
      row.querySelector('[data-act="restore"]').addEventListener("click", () => restoreCard(card.id));
      row.querySelector('[data-act="delete"]').addEventListener("click", () => deleteCard(card.id));
      archiveList.appendChild(row);
    });
  }

  document.getElementById("archiveBtn").addEventListener("click", () => {
    renderArchiveList();
    archiveOverlay.classList.add("open");
  });
  document.getElementById("archiveCloseBtn").addEventListener("click", () => archiveOverlay.classList.remove("open"));
  archiveOverlay.addEventListener("click", e => { if (e.target === archiveOverlay) archiveOverlay.classList.remove("open"); });

  // ---------- Modal ----------
  const overlay = document.getElementById("overlay");
  const fTitle = document.getElementById("fTitle");
  const fColumn = document.getElementById("fColumn");
  const fDetails = document.getElementById("fDetails");
  const fDue = document.getElementById("fDue");
  const fAssignee = document.getElementById("fAssignee");
  const fAttachments = document.getElementById("fAttachments");
  const fComments = document.getElementById("fComments");
  const fLabelsSection = document.getElementById("fLabelsSection");
  const fGoalsSection = document.getElementById("fGoalsSection");

  // poblar el selector de columnas (se llama cada vez que cambian las columnas del tablero)
  function populateColumnSelect() {
    const prev = fColumn.value;
    fColumn.innerHTML = "";
    estado.COLUMNS.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id; opt.textContent = c.name;
      fColumn.appendChild(opt);
    });
    // restaurar selección previa si sigue siendo válida
    if (prev && estado.COLUMNS.some(c => c.id === prev)) fColumn.value = prev;
  }

  // pobla el selector de responsable con los miembros del tablero actual
  function populateAssignee(selected) {
    const label = m => (m.avatarEmoji ? m.avatarEmoji + " " : "") + (m.name || shortName(m.email));
    fAssignee.innerHTML = '<option value="">— Sin asignar —</option>';
    estado.members.forEach(m => {
      const o = document.createElement("option");
      o.value = m.email; o.textContent = label(m);
      fAssignee.appendChild(o);
    });
    // si el responsable actual ya no es miembro, igual lo mostramos para no perderlo
    if (selected && !estado.members.some(m => m.email === selected)) {
      const o = document.createElement("option");
      o.value = selected; o.textContent = shortName(selected) + " (no miembro)";
      fAssignee.appendChild(o);
    }
    fAssignee.value = selected || "";
  }


  function actionLabel(action, details) {
    const d = details || {};
    // Prefiere el nombre guardado en el evento; cae en el nombre actual como fallback para eventos viejos.
    const colName = (id, saved) => saved || (estado.COLUMNS.find(c => c.id === id) || { name: id }).name;
    switch (action) {
      case "card_created":
        return d.column ? `Creó la tarjeta en "${colName(d.column, d.columnName)}"` : "Creó la tarjeta";
      case "card_deleted":   return "Eliminó la tarjeta";
      case "card_archived":  return "Archivó la tarjeta";
      case "card_restored":  return "Restauró la tarjeta";
      case "comment_added":  return "Comentó";
      case "attachment_added":
        return d.files && d.files.length ? `Adjuntó: ${d.files.join(", ")}` : "Subió un adjunto";
      case "card_moved":
        return d.column ? `Movió a "${colName(d.column.to, d.column.toName)}"` : "Movió la tarjeta";
      case "card_edited": {
        const parts = [];
        if (d.title)    parts.push("cambió el título");
        if (d.column)   parts.push(`movió a "${colName(d.column.to, d.column.toName)}"`);
        if (d.details)  parts.push("editó la descripción");
        if (d.due)      parts.push(d.due.to ? `fecha: ${d.due.to}` : "quitó la fecha");
        if (d.assignee) parts.push(d.assignee.to ? `asignó a ${shortName(d.assignee.to)}` : "quitó el responsable");
        return parts.length ? `Editó: ${parts.join(", ")}` : "Editó la tarjeta";
      }
      case "column_renamed":
        return d.from && d.to ? `Renombró columna "${d.from}" → "${d.to}"` : "Renombró una columna";
      case "column_created":
        return d.name ? `Creó la columna "${d.name}"` : "Creó una columna";
      case "column_deleted":
        return d.name ? `Eliminó la columna "${d.name}"` : "Eliminó una columna";
      case "column_moved":
        return d.name ? `Movió "${d.name}" hacia la ${d.direction === "left" ? "izquierda" : "derecha"}` : "Reordenó columnas";
      default: return action;
    }
  }

  async function renderHistory() {
    const field = document.getElementById("historyField");
    const list = document.getElementById("fHistory");
    if (!estado.editingId) { field.style.display = "none"; return; }
    field.style.display = "";
    list.innerHTML = '<li class="history-empty">Cargando…</li>';
    try {
      const { history } = await api("GET", "/api/cards/" + estado.editingId + "/history");
      if (!history.length) {
        list.innerHTML = '<li class="history-empty">Sin historial aún.</li>';
        return;
      }
      list.innerHTML = history.map(e => `
        <li class="history-entry">
          ${avatarHtml(e.author, 18)}
          <div class="history-body">
            <span class="history-who">${escapeHtml(e.author.name)} </span>
            <span class="history-action">${escapeHtml(actionLabel(e.action, e.details))}</span>
            <time class="history-time" title="${new Date(e.ts).toLocaleString("es")}">${relativeTime(e.ts)}</time>
          </div>
        </li>`).join("");
    } catch (_) {
      list.innerHTML = '<li class="history-empty">No se pudo cargar el historial.</li>';
    }
  }

  function openModal(id, defaultCol) {
    checklistRefreshPending = false;
    estado.editingId = id;
    const card = id ? estado.state.cards.find(c => c.id === id) : null;
    document.getElementById("modalTitle").textContent = card ? "Editar tarjeta" : "Nueva tarjeta";
    fTitle.value = card ? card.title : "";
    fColumn.value = card ? card.column : (defaultCol || (estado.COLUMNS[0] || {}).id || "");
    fDetails.value = card ? card.details : "";
    fDue.value = card ? (card.due || "") : "";
    populateAssignee(card ? card.assignee : "");
    estado.draftAttachments = card ? (card.attachments || []).map(a => ({ ...a })) : [];
    estado.removedAttachmentIds = [];
    estado.draftChecklists = [];
    estado.draftGoals = [];
    document.getElementById("deleteCardBtn").style.display = card ? "" : "none";
    document.getElementById("archiveCardBtn").style.display = card ? "" : "none";
    renderDraftAttachments();
    renderLabels();
    renderCardGoals();
    renderChecklists();
    renderComments();
    renderHistory();
    if (id) history.replaceState(null, "", "?card=" + id);
    overlay.classList.add("open");
    fTitle.focus();
  }

  function closeModal() {
    overlay.classList.remove("open");
    history.replaceState(null, "", location.pathname);
    estado.editingId = null;
    // liberar las URLs temporales de los adjuntos nuevos no guardados
    estado.draftAttachments.forEach(a => { if (a._previewUrl) URL.revokeObjectURL(a._previewUrl); });
    estado.draftAttachments = [];
    estado.removedAttachmentIds = [];
    estado.draftChecklists = [];
    estado.draftGoals = [];
    document.getElementById("fCommentInput").value = "";
    document.getElementById("historyField").style.display = "none";
  }

  // Comentarios: se publican al instante con autor (lee de state por editingId).
  function renderComments() {
    fComments.innerHTML = "";
    const input = document.getElementById("fCommentInput");
    const addBtn = document.getElementById("addCommentBtn");
    if (!estado.editingId) {
      input.disabled = true; addBtn.disabled = true;
      input.placeholder = "Guardá la tarjeta para comentar";
      return;
    }
    input.disabled = false; addBtn.disabled = false;
    input.placeholder = "Escribir un comentario...";
    const card = estado.state.cards.find(c => c.id === estado.editingId);
    (card ? card.comments || [] : []).forEach(cm => {
      const author = cm.author || { name: "—" };
      const li = document.createElement("li");
      li.className = "comment";
      li.innerHTML = `
        <span class="del" title="Eliminar">✕</span>
        <div class="c-head">${avatarHtml(author, 18)}<span class="c-author">${escapeHtml(author.name || "—")}</span>
          <time>${new Date(cm.ts).toLocaleString("es")}</time></div>
        <div class="c-text">${escapeHtml(cm.text)}</div>
      `;
      li.querySelector(".del").addEventListener("click", () => deleteComment(cm.id));
      fComments.appendChild(li);
    });
  }

  document.getElementById("addCommentBtn").addEventListener("click", addComment);
  document.getElementById("fCommentInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addComment(); }
  });
  async function addComment() {
    if (!estado.editingId) return;
    const input = document.getElementById("fCommentInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
      await api("POST", "/api/cards/" + estado.editingId + "/comments", { text });
      await loadCards();        // actualiza el contador de la tarjeta
      renderComments();
    } catch (e) { alert("No se pudo comentar: " + e.message); }
  }
  async function deleteComment(id) {
    try {
      await api("DELETE", "/api/comments/" + id);
      await loadCards();
      renderComments();
    } catch (e) { alert("No se pudo borrar el comentario: " + e.message); }
  }

  // ---- Checklists ----
  // Modo borrador (tarjeta nueva): todas las ops son en memoria sobre draftChecklists.
  // Modo API (tarjeta existente): cada op llama al backend y recarga state.
  function renderChecklists() {
    const section = document.getElementById("fChecklistsSection");
    section.innerHTML = "";

    const isDraft = !estado.editingId;
    let checklists;
    if (isDraft) {
      checklists = estado.draftChecklists;
    } else {
      const card = estado.state.cards.find(c => c.id === estado.editingId);
      checklists = card ? (card.checklists || []) : [];
    }

    function updateBar(cl, bar, progressEl) {
      const done = cl.items.filter(i => i.checked).length;
      const tot  = cl.items.length;
      bar.style.width = (tot ? Math.round(done / tot * 100) : 0) + "%";
      progressEl.textContent = tot ? `${done}/${tot}` : "";
    }

    checklists.forEach(cl => {
      const wrap = document.createElement("div");
      wrap.className = "checklist-section";
      wrap.dataset.checklistId = cl.id;

      // ── Header ──
      const header = document.createElement("div");
      header.className = "checklist-header";

      const nameEl = document.createElement("input");
      nameEl.type = "text";
      nameEl.className = "checklist-name";
      nameEl.value = cl.name;
      nameEl.title = "Clic para editar el nombre";
      nameEl.addEventListener("change", async () => {
        const name = nameEl.value.trim();
        if (!name || name === cl.name) { nameEl.value = cl.name; return; }
        if (isDraft) {
          cl.name = name;
        } else {
          try {
            await api("PUT", "/api/checklists/" + cl.id, { name });
            cl.name = name;
          } catch (e) { nameEl.value = cl.name; alert("No se pudo renombrar: " + e.message); }
        }
      });
      nameEl.addEventListener("keydown", e => { if (e.key === "Enter") nameEl.blur(); });

      const progressEl = document.createElement("span");
      progressEl.className = "checklist-progress";

      const delBtn = document.createElement("button");
      delBtn.className = "checklist-delete";
      delBtn.textContent = "✕";
      delBtn.title = "Eliminar checklist";
      delBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta lista y todas sus subtareas?")) return;
        if (isDraft) {
          estado.draftChecklists = estado.draftChecklists.filter(x => x.id !== cl.id);
          renderChecklists();
        } else {
          try {
            await api("DELETE", "/api/checklists/" + cl.id);
            await loadCards();
            renderChecklists();
          } catch (e) { alert("No se pudo eliminar: " + e.message); }
        }
      });

      header.appendChild(nameEl);
      header.appendChild(progressEl);
      header.appendChild(delBtn);
      wrap.appendChild(header);

      // ── Barra de progreso ──
      const barWrap = document.createElement("div");
      barWrap.className = "checklist-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "checklist-bar";
      barWrap.appendChild(bar);
      wrap.appendChild(barWrap);
      updateBar(cl, bar, progressEl);

      // ── Ítems ──
      const ul = document.createElement("ul");
      ul.className = "checklist-items";

      const renderItems = () => {
        ul.innerHTML = "";
        cl.items.slice().sort((a, b) => a.position - b.position).forEach((item, idx, arr) => {
          const li = document.createElement("li");
          li.className = "checklist-item";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = item.checked;
          cb.addEventListener("change", async () => {
            if (isDraft) {
              item.checked = cb.checked;
              textEl.classList.toggle("checked", item.checked);
              updateBar(cl, bar, progressEl);
            } else {
              try {
                const updated = await api("PUT", "/api/checklist-items/" + item.id, { checked: cb.checked });
                item.checked = updated.checked;
                textEl.classList.toggle("checked", item.checked);
                await loadCards();
                const c2 = estado.state.cards.find(c => c.id === estado.editingId);
                const cl2 = c2 && (c2.checklists || []).find(x => x.id === cl.id);
                if (cl2) updateBar(cl2, bar, progressEl);
              } catch (e) { cb.checked = !cb.checked; alert("Error: " + e.message); }
            }
          });

          const textEl = document.createElement("input");
          textEl.type = "text";
          textEl.className = "checklist-item-text" + (item.checked ? " checked" : "");
          textEl.value = item.text;
          textEl.title = "Clic para editar";
          textEl.addEventListener("change", async () => {
            const text = textEl.value.trim();
            if (!text || text === item.text) { textEl.value = item.text; return; }
            if (isDraft) {
              item.text = text;
            } else {
              try {
                await api("PUT", "/api/checklist-items/" + item.id, { text });
                item.text = text;
                await loadCards();
              } catch (e) { textEl.value = item.text; alert("Error: " + e.message); }
            }
          });
          textEl.addEventListener("keydown", e => { if (e.key === "Enter") textEl.blur(); });

          const swapPositions = (a, b) => { [a.position, b.position] = [b.position, a.position]; };

          const upBtn = document.createElement("button");
          upBtn.className = "checklist-item-move";
          upBtn.textContent = "▲";
          upBtn.title = "Subir";
          upBtn.disabled = idx === 0;
          upBtn.addEventListener("click", async () => {
            const sorted = cl.items.slice().sort((a, b) => a.position - b.position);
            const i = sorted.findIndex(x => x.id === item.id);
            if (i <= 0) return;
            swapPositions(sorted[i], sorted[i - 1]);
            if (isDraft) { cl.items = sorted; renderItems(); }
            else {
              await api("POST", "/api/checklists/" + cl.id + "/reorder", sorted.map(it => ({ id: it.id, position: it.position })));
              await loadCards();
              const cl2 = (estado.state.cards.find(c => c.id === estado.editingId)?.checklists || []).find(x => x.id === cl.id);
              if (cl2) { cl.items = cl2.items; renderItems(); }
            }
          });

          const downBtn = document.createElement("button");
          downBtn.className = "checklist-item-move";
          downBtn.textContent = "▼";
          downBtn.title = "Bajar";
          downBtn.disabled = idx === arr.length - 1;
          downBtn.addEventListener("click", async () => {
            const sorted = cl.items.slice().sort((a, b) => a.position - b.position);
            const i = sorted.findIndex(x => x.id === item.id);
            if (i >= sorted.length - 1) return;
            swapPositions(sorted[i], sorted[i + 1]);
            if (isDraft) { cl.items = sorted; renderItems(); }
            else {
              await api("POST", "/api/checklists/" + cl.id + "/reorder", sorted.map(it => ({ id: it.id, position: it.position })));
              await loadCards();
              const cl2 = (estado.state.cards.find(c => c.id === estado.editingId)?.checklists || []).find(x => x.id === cl.id);
              if (cl2) { cl.items = cl2.items; renderItems(); }
            }
          });

          const delItemBtn = document.createElement("button");
          delItemBtn.className = "checklist-item-del";
          delItemBtn.textContent = "✕";
          delItemBtn.title = "Eliminar ítem";
          delItemBtn.addEventListener("click", async () => {
            if (isDraft) {
              cl.items = cl.items.filter(x => x.id !== item.id);
              renderItems();
              updateBar(cl, bar, progressEl);
            } else {
              try {
                await api("DELETE", "/api/checklist-items/" + item.id);
                cl.items = cl.items.filter(x => x.id !== item.id);
                await loadCards();
                renderItems();
                const cl2 = (estado.state.cards.find(c => c.id === estado.editingId)?.checklists || []).find(x => x.id === cl.id);
                if (cl2) updateBar(cl2, bar, progressEl);
              } catch (e) { alert("Error: " + e.message); }
            }
          });

          li.appendChild(cb);
          li.appendChild(textEl);
          li.appendChild(upBtn);
          li.appendChild(downBtn);
          li.appendChild(delItemBtn);
          ul.appendChild(li);
        });
      };

      renderItems();
      wrap.appendChild(ul);

      // ── Agregar ítem ──
      const addRow = document.createElement("div");
      addRow.className = "checklist-add";
      const addInput = document.createElement("input");
      addInput.type = "text";
      addInput.placeholder = "Nueva subtarea...";
      const addItemBtn = document.createElement("button");
      addItemBtn.className = "btn btn-small btn-primary";
      addItemBtn.textContent = "Agregar";
      const doAdd = async () => {
        const text = addInput.value.trim();
        if (!text) return;
        addInput.value = "";
        if (isDraft) {
          cl.items.push({ id: crypto.randomUUID(), text, checked: false, position: cl.items.length });
          renderItems();
          updateBar(cl, bar, progressEl);
          addInput.focus();
        } else {
          try {
            const newItem = await api("POST", "/api/checklists/" + cl.id + "/items", { text });
            cl.items.push(newItem);
            await loadCards();
            const cl2 = (estado.state.cards.find(c => c.id === estado.editingId)?.checklists || []).find(x => x.id === cl.id);
            if (cl2) { cl.items = cl2.items; }
            renderItems();
            updateBar(cl, bar, progressEl);
            addInput.focus();
          } catch (e) { alert("Error: " + e.message); }
        }
      };
      addItemBtn.addEventListener("click", doAdd);
      addInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } });
      addRow.appendChild(addInput);
      addRow.appendChild(addItemBtn);
      wrap.appendChild(addRow);

      section.appendChild(wrap);
    });

    // ── Botón agregar checklist (siempre visible en el modal) ──
    const addClBtn = document.createElement("button");
    addClBtn.className = "btn btn-ghost btn-small add-checklist-btn";
    addClBtn.textContent = "☑ Agregar checklist";
    addClBtn.addEventListener("click", async () => {
      if (isDraft) {
        estado.draftChecklists.push({ id: crypto.randomUUID(), name: "Lista de tareas", items: [], position: estado.draftChecklists.length });
        renderChecklists();
      } else {
        try {
          await api("POST", "/api/cards/" + estado.editingId + "/checklists", { name: "Lista de tareas" });
          await loadCards();
          renderChecklists();
        } catch (e) { alert("Error: " + e.message); }
      }
    });
    section.appendChild(addClBtn);
  }

  // Etiquetas: gestión de etiquetas asignadas a la tarjeta
  const LABEL_COLORS = [
    "#F44336", "#2196F3", "#4CAF50", "#FFC107", "#FF9800",
    "#9C27B0", "#00BCD4", "#009688", "#E91E63", "#3F51B5",
  ];

  function renderLabels() {
    fLabelsSection.innerHTML = "";
    if (!estado.editingId) return;
    const card = estado.state.cards.find(c => c.id === estado.editingId);
    const cardLabels = card ? (card.labels || []) : [];

    const section = document.createElement("div");
    section.className = "labels-section";
    section.innerHTML = `<h3>🏷️ Etiquetas</h3>`;

    if (cardLabels.length > 0) {
      const listDiv = document.createElement("div");
      listDiv.className = "labels-list";
      cardLabels.forEach(label => {
        const chip = document.createElement("div");
        chip.className = "label-in-card";
        chip.style.backgroundColor = label.color;
        chip.innerHTML = `${escapeHtml(label.name)}<span class="remove">✕</span>`;
        chip.querySelector(".remove").addEventListener("click", () => removeLabel(label.id));
        listDiv.appendChild(chip);
      });
      section.appendChild(listDiv);
    }

    const btn = document.createElement("button");
    btn.className = "add-label-btn";
    btn.textContent = cardLabels.length ? "+ Agregar etiqueta" : "+ Asignar etiqueta";
    btn.addEventListener("click", () => toggleLabelPicker());
    section.appendChild(btn);

    fLabelsSection.appendChild(section);
  }

  let labelPickerVisible = false;
  function toggleLabelPicker() {
    labelPickerVisible = !labelPickerVisible;
    const existing = fLabelsSection.querySelector(".label-picker");
    if (existing) { existing.remove(); labelPickerVisible = false; return; }

    const card = estado.state.cards.find(c => c.id === estado.editingId);
    const cardLabels = card ? (card.labels || []) : [];
    const assignedIds = new Set(cardLabels.map(l => l.id));

    const picker = document.createElement("div");
    picker.className = "label-picker";

    // Lista de etiquetas existentes
    const existingDiv = document.createElement("div");
    existingDiv.className = "existing-labels";
    existingDiv.innerHTML = '<h4 style="margin:0 0 6px;font-size:11px;font-weight:600;color:var(--muted)">Etiquetas del tablero:</h4>';

    estado.boardLabels.forEach(label => {
      const row = document.createElement("div");
      row.className = "existing-label";
      row.style.backgroundColor = assignedIds.has(label.id) ? label.color + "22" : "";
      row.innerHTML = `
        <span style="color:${label.color};font-weight:600">${escapeHtml(label.name)}</span>
        <div class="actions">
          ${assignedIds.has(label.id)
            ? `<span class="del" data-label-id="${label.id}">Quitar</span>`
            : `<span style="cursor:pointer;color:var(--accent)" data-label-id="${label.id}">Agregar</span>`
          }
          <span style="cursor:pointer;color:var(--danger);margin-left:auto" data-delete="${label.id}" title="Borrar etiqueta">✕</span>
        </div>
      `;
      const addBtn = row.querySelector(`[data-label-id="${label.id}"]`);
      if (assignedIds.has(label.id)) {
        addBtn.addEventListener("click", () => removeLabel(label.id));
      } else {
        addBtn.addEventListener("click", () => assignLabel(label.id));
      }
      const delBtn = row.querySelector(`[data-delete="${label.id}"]`);
      delBtn.addEventListener("click", async () => {
        if (confirm("¿Eliminar esta etiqueta?")) {
          try {
            await api("DELETE", `/api/boards/${estado.currentBoardId}/labels/${label.id}`);
            await loadCards();
            labelPickerVisible = false;
            renderLabels();
          } catch (e) { alert("Error: " + e.message); }
        }
      });
      existingDiv.appendChild(row);
    });

    picker.appendChild(existingDiv);

    // Crear etiqueta nueva
    const createDiv = document.createElement("div");
    createDiv.innerHTML = `
      <h4 style="margin:10px 0 6px;font-size:11px;font-weight:600;color:var(--muted)">Crear etiqueta:</h4>
      <input type="text" id="newLabelName" placeholder="Nombre..." maxlength="30" style="width:100%;margin-bottom:6px">
      <div class="label-colors" id="colorGrid"></div>
      <button id="createLabelBtn" style="width:100%;padding:6px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">Crear</button>
    `;
    picker.appendChild(createDiv);

    const colorGrid = picker.querySelector("#colorGrid");
    let selectedColor = LABEL_COLORS[0];
    LABEL_COLORS.forEach(color => {
      const opt = document.createElement("div");
      opt.className = "color-opt" + (color === selectedColor ? " selected" : "");
      opt.style.backgroundColor = color;
      opt.addEventListener("click", () => {
        picker.querySelectorAll(".color-opt").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedColor = color;
      });
      colorGrid.appendChild(opt);
    });

    picker.querySelector("#createLabelBtn").addEventListener("click", () => createLabel(selectedColor));
    picker.querySelector("#newLabelName").addEventListener("keydown", e => {
      if (e.key === "Enter") createLabel(selectedColor);
    });

    fLabelsSection.appendChild(picker);
  }

  const pendingLabelChanges = new Set();
  async function changeCardLabel(cardId, boardId, labelId, assigned) {
    if (!cardId) return;
    const key = cardId + ":" + labelId;
    if (pendingLabelChanges.has(key)) return;
    pendingLabelChanges.add(key);
    try {
      await withCardMutation(async () => {
        await api(assigned ? "POST" : "DELETE", `/api/cards/${cardId}/labels/${labelId}`);
        if (boardId !== estado.currentBoardId) return;
        const card = estado.state.cards.find(c => c.id === cardId);
        if (!card) return;
        const label = estado.boardLabels.find(l => l.id === labelId);
        const labels = (card.labels || []).filter(l => l.id !== labelId);
        if (assigned && label) labels.push({ id: label.id, name: label.name, color: label.color });
        labels.sort((a, b) => estado.boardLabels.findIndex(l => l.id === a.id) - estado.boardLabels.findIndex(l => l.id === b.id));
        applySavedCard(boardId, { ...card, labels });
        if (estado.editingId === cardId) renderLabels();
      });
    } catch (e) { alert((assigned ? "No se pudo asignar: " : "No se pudo quitar: ") + e.message); }
    finally { pendingLabelChanges.delete(key); }
  }

  function assignLabel(labelId) {
    return changeCardLabel(estado.editingId, estado.currentBoardId, labelId, true);
  }

  function removeLabel(labelId) {
    return changeCardLabel(estado.editingId, estado.currentBoardId, labelId, false);
  }

  // ---------- Objetivos dentro del modal de tarjeta ----------
  function renderCardGoals() {
    fGoalsSection.innerHTML = "";
    if (!estado.boardGoals && !estado.editingId) return;

    // En modo edición los goals vienen del state; en modo borrador de draftGoals
    let cardGoals;
    if (estado.editingId) {
      const card = estado.state.cards.find(c => c.id === estado.editingId);
      cardGoals = card ? (card.goals || []) : [];
    } else {
      cardGoals = estado.boardGoals.filter(g => estado.draftGoals.includes(g.id));
    }

    const section = document.createElement("div");
    section.className = "goals-card-section";
    section.innerHTML = `<h3>🎯 Objetivos</h3>`;

    if (cardGoals.length > 0) {
      const listDiv = document.createElement("div");
      cardGoals.forEach(goal => {
        const chip = document.createElement("span");
        chip.className = "goal-in-card";
        chip.innerHTML = `${escapeHtml(goal.title)}<span class="remove" title="Quitar del objetivo">✕</span>`;
        chip.querySelector(".remove").addEventListener("click", () => {
          if (estado.editingId) removeGoal(goal.id);
          else { estado.draftGoals = estado.draftGoals.filter(id => id !== goal.id); renderCardGoals(); }
        });
        listDiv.appendChild(chip);
      });
      section.appendChild(listDiv);
    }

    const btn = document.createElement("button");
    btn.className = "add-goal-btn";
    btn.textContent = cardGoals.length ? "+ Vincular a otro objetivo" : "+ Vincular a un objetivo";
    btn.addEventListener("click", toggleGoalPicker);
    section.appendChild(btn);

    fGoalsSection.appendChild(section);
  }

  function toggleGoalPicker() {
    const existing = fGoalsSection.querySelector(".goal-picker");
    if (existing) { existing.remove(); return; }

    const assignedIds = estado.editingId
      ? new Set((estado.state.cards.find(c => c.id === estado.editingId)?.goals || []).map(g => g.id))
      : new Set(estado.draftGoals);

    const picker = document.createElement("div");
    picker.className = "goal-picker";

    const existingDiv = document.createElement("div");
    existingDiv.innerHTML = '<h4 style="margin:0 0 6px;font-size:11px;font-weight:600;color:var(--muted)">Objetivos del tablero:</h4>';

    if (!estado.boardGoals.length) {
      const none = document.createElement("div");
      none.style.cssText = "font-size:12px;color:var(--muted);margin-bottom:6px";
      none.textContent = "No hay objetivos todavía. Creá uno abajo.";
      existingDiv.appendChild(none);
    }

    estado.boardGoals.forEach(goal => {
      const row = document.createElement("div");
      row.className = "existing-goal";
      const assigned = assignedIds.has(goal.id);
      row.innerHTML = `
        <span style="flex:1;font-weight:600">${escapeHtml(goal.title)}</span>
        ${assigned
          ? `<span class="del" style="cursor:pointer;color:var(--danger)" data-goal-id="${goal.id}">Quitar</span>`
          : `<span style="cursor:pointer;color:var(--accent)" data-goal-id="${goal.id}">Vincular</span>`
        }
      `;
      row.querySelector(`[data-goal-id="${goal.id}"]`)
        .addEventListener("click", () => {
          if (estado.editingId) {
            assigned ? removeGoal(goal.id) : assignGoal(goal.id);
          } else {
            if (assigned) estado.draftGoals = estado.draftGoals.filter(id => id !== goal.id);
            else if (!estado.draftGoals.includes(goal.id)) estado.draftGoals.push(goal.id);
            picker.remove();
            renderCardGoals();
          }
        });
      existingDiv.appendChild(row);
    });
    picker.appendChild(existingDiv);

    const createDiv = document.createElement("div");
    createDiv.innerHTML = `
      <h4 style="margin:10px 0 6px;font-size:11px;font-weight:600;color:var(--muted)">Crear objetivo:</h4>
      <input type="text" id="newGoalInline" placeholder="Título del objetivo..." maxlength="120">
      <button id="createGoalInlineBtn" style="width:100%;padding:6px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">Crear y vincular</button>
    `;
    picker.appendChild(createDiv);

    const create = async () => {
      const title = (picker.querySelector("#newGoalInline").value || "").trim();
      if (!title) { alert("Escribí un título."); return; }
      try {
        const goal = await api("POST", "/api/boards/" + estado.currentBoardId + "/goals", { title });
        if (estado.editingId) {
          await api("POST", `/api/cards/${estado.editingId}/goals/${goal.id}`);
          await loadCards();
        } else {
          await loadCards(); // refresca boardGoals con el nuevo objetivo
          if (!estado.draftGoals.includes(goal.id)) estado.draftGoals.push(goal.id);
        }
        renderCardGoals();
      } catch (e) { alert("No se pudo crear: " + e.message); }
    };
    createDiv.querySelector("#createGoalInlineBtn").addEventListener("click", create);
    createDiv.querySelector("#newGoalInline").addEventListener("keydown", e => {
      if (e.key === "Enter") create();
    });

    fGoalsSection.appendChild(picker);
  }

  async function assignGoal(goalId) {
    try {
      await api("POST", `/api/cards/${estado.editingId}/goals/${goalId}`);
      await loadCards();
      renderCardGoals();
    } catch (e) { alert("No se pudo vincular: " + e.message); }
  }

  async function removeGoal(goalId) {
    try {
      await api("DELETE", `/api/cards/${estado.editingId}/goals/${goalId}`);
      await loadCards();
      renderCardGoals();
    } catch (e) { alert("No se pudo quitar: " + e.message); }
  }

  async function createLabel(color) {
    if (!estado.editingId || !estado.currentBoardId) return;
    const cardId = estado.editingId, boardId = estado.currentBoardId;
    const name = document.getElementById("newLabelName")?.value.trim();
    if (!name) return alert("Falta nombre de etiqueta");
    try {
      await withCardMutation(async () => {
        const label = await api("POST", `/api/boards/${boardId}/labels`, { name, color });
        if (boardId === estado.currentBoardId) estado.boardLabels.push(label);
        await changeCardLabel(cardId, boardId, label.id, true);
        labelPickerVisible = false;
      });
    } catch (e) { alert("No se pudo crear: " + e.message); }
  }

  // Adjuntos: los nuevos quedan pendientes como File y se suben al Guardar.
  document.getElementById("fFile").addEventListener("change", e => {
    Array.from(e.target.files).forEach(file => {
      const isImage = file.type.startsWith("image/");
      estado.draftAttachments.push({
        _new: true,
        file,
        originalName: file.name,
        isImage,
        _previewUrl: isImage ? URL.createObjectURL(file) : null,
      });
    });
    e.target.value = "";
    renderDraftAttachments();
  });

  function renderDraftAttachments() {
    fAttachments.innerHTML = "";
    estado.draftAttachments.forEach((a, i) => {
      const el = document.createElement("div");
      el.className = "attachment";
      const name = a.originalName || "archivo";
      const src = a._new ? a._previewUrl : a.url;   // imágenes: preview local o url del servidor
      const inner = a.isImage && src
        ? `<img src="${src}" alt="${escapeHtml(name)}">`
        : `<div class="file-icon">📄</div>`;
      const linkOpen = a._new ? "" : `<a href="${a.url}" download="${escapeHtml(name)}" target="_blank">`;
      const linkClose = a._new ? "" : `</a>`;
      el.innerHTML = `
        <span class="del" data-i="${i}">✕</span>
        ${linkOpen}${inner}${linkClose}
        <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
      `;
      el.querySelector(".del").addEventListener("click", () => {
        const removed = estado.draftAttachments.splice(i, 1)[0];
        if (removed._new && removed._previewUrl) URL.revokeObjectURL(removed._previewUrl);
        else if (removed.id) estado.removedAttachmentIds.push(removed.id);  // borrar en el servidor al guardar
        renderDraftAttachments();
      });
      fAttachments.appendChild(el);
    });
  }

  // Guardar / eliminar / cancelar
  const saveBtn = document.getElementById("saveBtn");
  // Mientras hay una escritura de tarjeta en vuelo, Guardar queda deshabilitado.
  // El aviso lo emite withCardMutation, que lleva la cuenta; qué se hace con esa
  // información es decisión del modal, que es quien tiene el botón.
  on("mutacion:inicio", () => { saveBtn.disabled = true; });
  on("mutacion:fin", () => { saveBtn.disabled = estado.pendingCardMutations > 0; });
  saveBtn.addEventListener("click", async () => {
    if (estado.pendingCardMutations) return;
    const title = fTitle.value.trim();
    if (!title) { fTitle.focus(); fTitle.style.borderColor = "var(--danger)"; return; }
    fTitle.style.borderColor = "";

    const payload = {
      title,
      column: fColumn.value,
      details: fDetails.value.trim(),
      due: fDue.value || "",
      assignee: fAssignee.value || null,
    };

    const boardId = estado.currentBoardId, cardId = estado.editingId;
    const removedIds = [...estado.removedAttachmentIds];
    const nuevos = estado.draftAttachments.filter(a => a._new);
    const checklists = cardId ? [] : structuredClone(estado.draftChecklists);
    const goals = cardId ? [] : [...estado.draftGoals];
    try {
      await withCardMutation(async () => {
        // 1) crear o actualizar la tarjeta (campos + comentarios)
        let card = cardId
          ? await api("PUT", "/api/cards/" + cardId, payload)
          : await api("POST", "/api/boards/" + boardId + "/cards", payload);

        // 2) borrar los adjuntos existentes que se quitaron
        for (const aid of removedIds) await api("DELETE", "/api/attachments/" + aid);

        // 3) subir los adjuntos nuevos
        if (nuevos.length) {
          const fd = new FormData();
          nuevos.forEach(a => fd.append("files", a.file, a.originalName));
          const res = await fetch("/api/cards/" + card.id + "/attachments", { method: "POST", body: fd });
          if (!res.ok) {
            let msg = res.statusText;
            try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
            throw new Error(msg);
          }
        }

        // 4) persistir checklists del borrador (sólo en tarjetas nuevas)
        if (checklists.length) {
          for (const cl of checklists) {
            const savedCl = await api("POST", "/api/cards/" + card.id + "/checklists", { name: cl.name });
            for (const item of cl.items.slice().sort((a, b) => a.position - b.position)) {
              const savedItem = await api("POST", "/api/checklists/" + savedCl.id + "/items", { text: item.text });
              if (item.checked) await api("PUT", "/api/checklist-items/" + savedItem.id, { checked: true });
            }
          }
        }

        // 5) vincular objetivos del borrador (sólo en tarjetas nuevas)
        if (goals.length) {
          for (const goalId of goals) {
            await api("POST", `/api/cards/${card.id}/goals/${goalId}`);
          }
        }

        // Los recursos agregados después del POST/PUT no están en esa respuesta.
        // En ese caso releer sólo esta tarjeta, nunca las tres colecciones del tablero.
        if (removedIds.length || nuevos.length || checklists.length || goals.length) {
          card = await api("GET", "/api/cards/" + card.id);
        }
        applySavedCard(boardId, card);
        if (boardId === estado.currentBoardId && estado.editingId === cardId) closeModal();
      });
    } catch (e) {
      alert("No se pudo guardar: " + e.message);
    }
  });

  document.getElementById("deleteCardBtn").addEventListener("click", async () => {
    if (!estado.editingId) return;
    if (await deleteCard(estado.editingId)) closeModal();   // pide confirmación adentro
  });

  document.getElementById("archiveCardBtn").addEventListener("click", async () => {
    if (!estado.editingId) return;
    await archiveCard(estado.editingId);
    closeModal();
  });

  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (overlay.classList.contains("open")) closeModal();
    else if (profileOverlay.classList.contains("open")) profileOverlay.classList.remove("open");
    else if (importOverlay.classList.contains("open")) closeImportPreview();
    else if (membersOverlay.classList.contains("open")) membersOverlay.classList.remove("open");
    else if (archiveOverlay.classList.contains("open")) archiveOverlay.classList.remove("open");
    else if (goalsDrawer.classList.contains("open")) closeGoalsDrawer();
    else if (metricsDrawer.classList.contains("open")) closeMetricsDrawer();
    else if (themePromptOverlay.classList.contains("open")) skipThemePrompt();
  });

  // ---------- Buscador y filtro por responsable ----------
  document.getElementById("searchInput").addEventListener("input", e => {
    estado.searchQuery = e.target.value.trim().toLowerCase();
    render();
  });
  document.getElementById("assigneeFilter").addEventListener("change", e => {
    estado.assigneeFilter = e.target.value;
    render();
  });

  // ---------- Selector de tablero y nuevo tablero ----------
  document.getElementById("boardSelect").addEventListener("change", async e => {
    estado.currentBoardId = e.target.value;
    estado.assigneeFilter = "";
    estado.activeGoalFilter = null;
    closeGoalsDrawer();
    showView("tasks");
    updateBoardControls();
    await loadMembers();
    await loadCards();
    checkThemePrompt();
    startPolling();
    startWipPulse();
  });

  // Renombrar rápido desde el header (lápiz)
  document.getElementById("editBoardBtn").addEventListener("click", async () => {
    const b = currentBoard();
    if (!b) return;
    const name = prompt("Nuevo nombre del tablero:", b.name);
    if (!name || !name.trim() || name.trim() === b.name) return;
    try {
      await api("PATCH", "/api/boards/" + estado.currentBoardId, { name: name.trim() });
      await loadBoard();
    } catch (e) { alert("No se pudo renombrar: " + e.message); }
  });

  document.getElementById("newBoardBtn").addEventListener("click", async () => {
    const name = prompt("Nombre del nuevo tablero:");
    if (!name || !name.trim()) return;
    try {
      const b = await api("POST", "/api/boards", { name: name.trim() });
      estado.currentBoardId = b.id;
      await loadBoard();
    } catch (e) { alert("No se pudo crear el tablero: " + e.message); }
  });

  // ---------- Modal de miembros ----------
  const membersOverlay = document.getElementById("membersOverlay");

  // ---------- Configuración del tablero: tabs ----------
  function switchSettingsTab(tab) {
    document.getElementById("settingsMiembrosPanel").style.display  = tab === "miembros"  ? "" : "none";
    document.getElementById("settingsEtiquetasPanel").style.display = tab === "etiquetas" ? "" : "none";
    document.getElementById("settingsTemaPanel").style.display      = tab === "tema"      ? "" : "none";
    document.getElementById("settingsTabMiembros").classList.toggle("active",  tab === "miembros");
    document.getElementById("settingsTabEtiquetas").classList.toggle("active", tab === "etiquetas");
    document.getElementById("settingsTabTema").classList.toggle("active",      tab === "tema");
    if (tab === "etiquetas") renderBoardLabelsManager();
    if (tab === "tema") renderBoardThemeManager();
  }
  document.getElementById("settingsTabMiembros").addEventListener("click",  () => switchSettingsTab("miembros"));
  document.getElementById("settingsTabEtiquetas").addEventListener("click", () => switchSettingsTab("etiquetas"));
  document.getElementById("settingsTabTema").addEventListener("click",      () => switchSettingsTab("tema"));

  // ---------- Selector de paleta del tablero (#10) ----------
  function renderBoardThemeManager() {
    const b = currentBoard();
    const isOwner = b && b.role === "owner";
    const current = (b && b.theme) || "candy_pop";
    const grid = document.getElementById("boardThemeGrid");
    grid.innerHTML = "";
    PALETTES.forEach(p => {
      const opt = document.createElement("div");
      opt.className = "theme-opt" + (p.key === current ? " sel" : "") + (isOwner ? "" : " disabled");
      opt.innerHTML = `<span class="theme-swatch" style="background:${p.swatch}"></span><span>${escapeHtml(p.label)}</span>`;
      if (isOwner) {
        opt.addEventListener("click", async () => {
          if (p.key === current) return;
          try {
            await api("PATCH", "/api/boards/" + estado.currentBoardId, { theme: p.key });
            await loadBoard();
            renderBoardThemeManager();
          } catch (e) { alert("No se pudo cambiar la paleta: " + e.message); }
        });
      }
      grid.appendChild(opt);
    });
    document.getElementById("themeOwnerHint").style.display = isOwner ? "none" : "";
  }

  // ---------- Prompt de bienvenida por tablero (#10) ----------
  // Solo el dueño lo ve, y solo una vez por tablero (boards.theme_prompt_seen).
  const themePromptOverlay = document.getElementById("themePromptOverlay");
  function checkThemePrompt() {
    const b = currentBoard();
    if (!b || b.role !== "owner" || b.themePromptSeen) return;
    const grid = document.getElementById("themePromptGrid");
    grid.innerHTML = "";
    PALETTES.forEach(p => {
      const opt = document.createElement("div");
      opt.className = "theme-opt";
      opt.innerHTML = `<span class="theme-swatch" style="background:${p.swatch}"></span><span>${escapeHtml(p.label)}</span>`;
      opt.addEventListener("click", async () => {
        try {
          await api("PATCH", "/api/boards/" + estado.currentBoardId, { theme: p.key });
          themePromptOverlay.classList.remove("open");
          await loadBoard();
        } catch (e) { alert("No se pudo guardar la paleta: " + e.message); }
      });
      grid.appendChild(opt);
    });
    themePromptOverlay.classList.add("open");
  }
  async function skipThemePrompt() {
    if (!themePromptOverlay.classList.contains("open")) return;
    try {
      await api("PATCH", "/api/boards/" + estado.currentBoardId, { themePromptSeen: true });
      themePromptOverlay.classList.remove("open");
      await loadBoard();
    } catch (e) { alert("No se pudo guardar: " + e.message); }
  }
  document.getElementById("themePromptSkipBtn").addEventListener("click", skipThemePrompt);
  themePromptOverlay.addEventListener("click", e => { if (e.target === themePromptOverlay) skipThemePrompt(); });

  // ---------- Gestión de etiquetas del tablero ----------
  function renderBoardLabelsManager() {
    const list = document.getElementById("boardLabelsList");
    list.innerHTML = "";
    if (!estado.boardLabels.length) {
      list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:6px 0">Sin etiquetas en este tablero.</div>';
      return;
    }
    estado.boardLabels.forEach(label => {
      const row = document.createElement("div");
      row.className = "board-label-row";
      row.dataset.id = label.id;
      row.innerHTML = `
        <span class="board-label-swatch" style="background:${label.color}"></span>
        <span class="board-label-name">${escapeHtml(label.name)}</span>
        <div style="display:flex;gap:4px">
          <button class="col-action-btn board-label-edit-btn" data-id="${label.id}" title="Editar">✏️</button>
          <button class="col-action-btn board-label-del-btn" data-id="${label.id}" style="color:var(--danger)" title="Eliminar">✕</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll(".board-label-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => startEditBoardLabel(btn.dataset.id));
    });
    list.querySelectorAll(".board-label-del-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const label = estado.boardLabels.find(l => l.id === btn.dataset.id);
        if (!label || !confirm(`¿Eliminar la etiqueta "${label.name}"? Se quitará de todas las tarjetas.`)) return;
        try {
          await api("DELETE", `/api/boards/${estado.currentBoardId}/labels/${btn.dataset.id}`);
          await loadCards();
          renderBoardLabelsManager();
        } catch (e) { alert(e.message || "Error al eliminar etiqueta"); }
      });
    });
  }

  function startEditBoardLabel(labelId) {
    const label = estado.boardLabels.find(l => l.id === labelId);
    if (!label) return;
    const list = document.getElementById("boardLabelsList");
    const row = list.querySelector(`[data-id="${labelId}"]`);
    if (!row) return;

    let editColor = label.color;
    const form = document.createElement("div");
    form.className = "board-label-edit-form";
    form.innerHTML = `
      <input type="text" value="${escapeHtml(label.name)}" maxlength="30" placeholder="Nombre...">
      <div class="label-colors" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-small" id="saveLabelEditBtn">Guardar</button>
        <button class="btn btn-ghost btn-small" id="cancelLabelEditBtn">Cancelar</button>
      </div>
    `;
    row.replaceWith(form);

    const colorGrid = form.querySelector(".label-colors");
    LABEL_COLORS.forEach(color => {
      const opt = document.createElement("div");
      opt.className = "color-opt" + (color === editColor ? " selected" : "");
      opt.style.backgroundColor = color;
      opt.addEventListener("click", () => {
        form.querySelectorAll(".color-opt").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        editColor = color;
      });
      colorGrid.appendChild(opt);
    });

    form.querySelector("#saveLabelEditBtn").addEventListener("click", async () => {
      const name = form.querySelector("input").value.trim();
      if (!name) return;
      try {
        await api("PUT", `/api/boards/${estado.currentBoardId}/labels/${labelId}`, { name, color: editColor });
        await loadCards();
        renderBoardLabelsManager();
      } catch (e) { alert(e.message || "Error al actualizar etiqueta"); }
    });
    form.querySelector("#cancelLabelEditBtn").addEventListener("click", () => renderBoardLabelsManager());
  }

  // Color picker para crear etiqueta desde configuración
  let boardSelectedColor = LABEL_COLORS[0];
  (function initBoardColorGrid() {
    const grid = document.getElementById("boardColorGrid");
    LABEL_COLORS.forEach(color => {
      const opt = document.createElement("div");
      opt.className = "color-opt" + (color === boardSelectedColor ? " selected" : "");
      opt.style.backgroundColor = color;
      opt.addEventListener("click", () => {
        grid.querySelectorAll(".color-opt").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        boardSelectedColor = color;
      });
      grid.appendChild(opt);
    });
  })();

  document.getElementById("boardCreateLabelBtn").addEventListener("click", async () => {
    const input = document.getElementById("boardLabelName");
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    try {
      await api("POST", `/api/boards/${estado.currentBoardId}/labels`, { name, color: boardSelectedColor });
      input.value = "";
      await loadCards();
      renderBoardLabelsManager();
    } catch (e) { alert(e.message || "Error al crear etiqueta"); }
  });
  document.getElementById("boardLabelName").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("boardCreateLabelBtn").click(); }
  });

  function renderMembers() {
    const b = currentBoard();
    const isOwner = b && b.role === "owner";
    document.getElementById("membersTitle").textContent = "⚙️ " + (b ? b.name : "");
    // invitar, renombrar y eliminar tablero solo para el dueño
    document.getElementById("inviteRow").style.display = isOwner ? "" : "none";
    // renombrar: solo el dueño, y no en el tablero personal
    document.getElementById("renameRow").style.display = (isOwner && b && !b.isPersonal) ? "" : "none";
    document.getElementById("renameInput").value = b ? b.name : "";
    // días de anticipación para "por vencer": solo el dueño lo edita
    document.getElementById("dueSoonRow").style.display = isOwner ? "" : "none";
    document.getElementById("dueSoonInput").value = b ? b.dueSoonDays : 3;
    const delBtn = document.getElementById("deleteBoardBtn");
    delBtn.style.display = (isOwner && b && !b.isPersonal) ? "" : "none";

    const list = document.getElementById("membersList");
    list.innerHTML = estado.members.length ? "" : '<div class="members-empty">Sin miembros.</div>';
    estado.members.forEach(m => {
      const row = document.createElement("div");
      row.className = "member-row";
      const canRemove = isOwner && m.role !== "owner";
      row.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px">${avatarHtml(m, 24)}
          <span>${escapeHtml(m.name || shortName(m.email))} <span class="role">· ${escapeHtml(m.email)} · ${m.role === "owner" ? "dueño" : "miembro"}</span></span></span>
        ${canRemove ? '<button class="btn btn-danger btn-small" data-rm="' + escapeHtml(m.email) + '">Quitar</button>' : ""}
      `;
      const rm = row.querySelector("[data-rm]");
      if (rm) rm.addEventListener("click", async () => {
        try {
          await api("DELETE", "/api/boards/" + estado.currentBoardId + "/members/" + encodeURIComponent(m.email));
          await loadMembers(); renderMembers();
        } catch (e) { alert("No se pudo quitar: " + e.message); }
      });
      list.appendChild(row);
    });
  }

  document.getElementById("membersBtn").addEventListener("click", () => {
    if (!estado.currentBoardId) return;
    switchSettingsTab("miembros");
    renderMembers();
    membersOverlay.classList.add("open");
  });
  document.getElementById("membersCloseBtn").addEventListener("click", () => membersOverlay.classList.remove("open"));
  membersOverlay.addEventListener("click", e => { if (e.target === membersOverlay) membersOverlay.classList.remove("open"); });

  document.getElementById("inviteBtn").addEventListener("click", invite);
  document.getElementById("inviteEmail").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); invite(); } });
  async function invite() {
    const input = document.getElementById("inviteEmail");
    const email = input.value.trim();
    if (!email) return;
    try {
      await api("POST", "/api/boards/" + estado.currentBoardId + "/members", { email });
      input.value = "";
      await loadBoard();          // actualiza memberCount en el selector
      renderMembers();
    } catch (e) { alert("No se pudo invitar: " + e.message); }
  }

  document.getElementById("renameBtn").addEventListener("click", renameBoard);
  document.getElementById("renameInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); renameBoard(); } });
  async function renameBoard() {
    const name = document.getElementById("renameInput").value.trim();
    if (!name) return;
    try {
      await api("PATCH", "/api/boards/" + estado.currentBoardId, { name });
      await loadBoard();          // refresca el nombre en el selector
      renderMembers();
    } catch (e) { alert("No se pudo renombrar: " + e.message); }
  }

  document.getElementById("dueSoonBtn").addEventListener("click", saveDueSoonDays);
  async function saveDueSoonDays() {
    const days = parseInt(document.getElementById("dueSoonInput").value, 10);
    if (!Number.isInteger(days) || days < 0 || days > 90) { alert("Ingresá un número de días entre 0 y 90."); return; }
    try {
      await api("PATCH", "/api/boards/" + estado.currentBoardId, { dueSoonDays: days });
      await loadBoard();
      renderMembers();
    } catch (e) { alert("No se pudo guardar: " + e.message); }
  }

  document.getElementById("deleteBoardBtn").addEventListener("click", async () => {
    const b = currentBoard();
    if (!b) return;
    if (!confirm(`¿Eliminar el tablero “${b.name}” y todas sus tarjetas?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await api("DELETE", "/api/boards/" + estado.currentBoardId);
      membersOverlay.classList.remove("open");
      estado.currentBoardId = null;       // loadBoard elegirá el personal
      await loadBoard();
    } catch (e) { alert("No se pudo eliminar el tablero: " + e.message); }
  });

  // ---------- Modal de perfil ----------
  const profileOverlay = document.getElementById("profileOverlay");
  const EMOJI_SET = ["😀","😎","🦊","🐼","🐯","🦁","🐸","🦉","🚀","⭐","🔥","🌈","🎯","🧠","💡","🛠️","📌","🎨","🍀","☕"];
  let profileColor = "";

  function previewProfile() {
    const emoji = document.getElementById("profileEmoji").value.trim();
    document.getElementById("profilePreview").innerHTML = avatarHtml({
      email: estado.me.email,
      name: document.getElementById("profileName").value || shortName(estado.me.email),
      avatarEmoji: emoji || null,
      avatarColor: profileColor || null,
    }, 40);
    document.querySelectorAll("#colorPicker .opt").forEach(o => o.classList.toggle("sel", o.dataset.color === profileColor));
    document.querySelectorAll("#emojiPicker .opt").forEach(o => o.classList.toggle("sel", o.textContent === emoji));
  }

  (function buildPickers() {
    const ep = document.getElementById("emojiPicker");
    EMOJI_SET.forEach(em => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "opt"; b.textContent = em;
      b.addEventListener("click", () => { document.getElementById("profileEmoji").value = em; previewProfile(); });
      ep.appendChild(b);
    });
    const cp = document.getElementById("colorPicker");
    AVATAR_COLORS.forEach(col => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "opt color-opt"; b.style.background = col; b.dataset.color = col;
      b.addEventListener("click", () => { profileColor = col; previewProfile(); });
      cp.appendChild(b);
    });
  })();

  function openProfile() {
    document.getElementById("profileName").value = estado.me.profile.name || "";
    document.getElementById("profileEmoji").value = estado.me.profile.avatarEmoji || "";
    document.getElementById("profileEmail").textContent = estado.me.email;
    profileColor = estado.me.profile.avatarColor || "";
    previewProfile();
    profileOverlay.classList.add("open");
  }

  document.getElementById("profileBtn").addEventListener("click", openProfile);
  document.getElementById("profileName").addEventListener("input", previewProfile);
  document.getElementById("profileEmoji").addEventListener("input", previewProfile);
  document.getElementById("profileCancelBtn").addEventListener("click", () => profileOverlay.classList.remove("open"));
  profileOverlay.addEventListener("click", e => { if (e.target === profileOverlay) profileOverlay.classList.remove("open"); });
  document.getElementById("profileSaveBtn").addEventListener("click", async () => {
    const btn = document.getElementById("profileSaveBtn");
    btn.disabled = true;
    try {
      const prof = await api("PUT", "/api/me", {
        name: document.getElementById("profileName").value.trim(),
        avatarEmoji: document.getElementById("profileEmoji").value.trim(),
        avatarColor: profileColor,
      });
      estado.me.profile = { name: prof.name, avatarEmoji: prof.avatarEmoji, avatarColor: prof.avatarColor };
      renderMe();
      await loadMembers();   // refresca avatares en filtro y miembros
      render();              // refresca avatares en las tarjetas
      profileOverlay.classList.remove("open");
    } catch (e) { alert("No se pudo guardar el perfil: " + e.message); }
    finally { btn.disabled = false; }
  });

  // ENTER en el título guarda la tarjeta
  fTitle.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("saveBtn").click(); }
  });

  // Ctrl+Enter (o Cmd+Enter) en los detalles guarda y cierra
  fDetails.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById("saveBtn").click();
    }
  });

  // ---------- Gestión de columnas (mover / renombrar / eliminar) ----------
  board.addEventListener("click", async e => {
    if (e.target.closest(".col-move-btn")) {
      const btn = e.target.closest(".col-move-btn");
      const colId = btn.dataset.col;
      const dir   = btn.dataset.dir;
      btn.disabled = true;
      try {
        await api("PATCH", "/api/boards/" + estado.currentBoardId + "/columns/" + colId, { direction: dir });
        await loadCards();
      } catch (err) { alert(err.message || "Error al mover columna"); btn.disabled = false; }
      return;
    }
    if (e.target.closest(".col-toggle-done-btn")) {
      const btn = e.target.closest(".col-toggle-done-btn");
      const colId = btn.dataset.col;
      const isDone = btn.dataset.done === "1";
      btn.disabled = true;
      try {
        await api("PATCH", "/api/boards/" + estado.currentBoardId + "/columns/" + colId, { isDone: !isDone });
        await loadCards();
      } catch (err) { alert(err.message || "Error al actualizar la columna"); btn.disabled = false; }
      return;
    }
    if (e.target.closest(".col-rename-btn")) {
      const btn = e.target.closest(".col-rename-btn");
      const colId = btn.dataset.col;
      const col = estado.COLUMNS.find(c => c.id === colId);
      if (!col) return;
      const header = btn.closest(".column-header");
      const nameSpan = header.querySelector(".col-name-text");
      const input = document.createElement("input");
      input.className = "col-rename-input";
      input.value = col.name;
      nameSpan.replaceWith(input);
      input.select();
      let saved = false;
      const save = async () => {
        if (saved) return; saved = true;
        const newName = input.value.trim();
        if (newName && newName !== col.name) {
          try { await api("PATCH", "/api/boards/" + estado.currentBoardId + "/columns/" + colId, { name: newName }); }
          catch (err) { alert(err.message || "Error al renombrar"); }
        }
        await loadCards();
      };
      input.addEventListener("keydown", async ev => { if (ev.key === "Enter") { ev.preventDefault(); await save(); } if (ev.key === "Escape") { saved = true; await loadCards(); } });
      input.addEventListener("blur", save);
      return;
    }
    if (e.target.closest(".col-delete-btn")) {
      const btn = e.target.closest(".col-delete-btn");
      const colId = btn.dataset.col;
      const col = estado.COLUMNS.find(c => c.id === colId);
      if (!confirm(`¿Eliminar la columna "${col?.name || colId}"?`)) return;
      try {
        await api("DELETE", "/api/boards/" + estado.currentBoardId + "/columns/" + colId);
        await loadCards();
      } catch (err) { alert(err.message || "Error al eliminar columna"); }
    }
  });

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
    openModal(null, cardsEl ? cardsEl.dataset.col : estado.COLUMNS[0].id);
  }

  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();

    // F1: ayuda (siempre disponible)
    if (k === "f1") { e.preventDefault(); toggleHelpModal(); return; }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const helpOpen = document.querySelector("#helpModal.open");
    if (helpOpen) return;

    // Esc: cerrar ayuda
    if (k === "escape" && helpOpen) { e.preventDefault(); toggleHelpModal(); return; }

    // Si hay modal de tarjeta abierto, solo permitir esc para cerrarlo
    if (document.querySelector(".overlay.open")) return;

    if (k === "f") { e.preventDefault(); toggleMyTasks(); }
    else if (k === "u") { e.preventDefault(); toggleUrgent(); }
    else if (k === "n") { e.preventDefault(); newCardUnderMouse(); }
    else if (k === "p") { e.preventDefault(); runWipPulseSequence({ alwaysShowMessage: true }); }
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

  // ---------- Panel de administración ----------
  const adminOverlay = document.getElementById("adminOverlay");
  const adminUserList = document.getElementById("adminUserList");
  const adminNewEmail = document.getElementById("adminNewEmail");

  // Tabs
  function switchAdminTab(tab) {
    document.getElementById("adminPanelUsuarios").style.display    = tab === "usuarios"    ? "" : "none";
    document.getElementById("adminPanelActividad").style.display   = tab === "actividad"   ? "" : "none";
    document.getElementById("adminPanelStats").style.display       = tab === "stats"       ? "" : "none";
    document.getElementById("adminPanelSolicitudes").style.display = tab === "solicitudes" ? "" : "none";
    document.getElementById("adminTabUsuarios").classList.toggle("active",    tab === "usuarios");
    document.getElementById("adminTabActividad").classList.toggle("active",   tab === "actividad");
    document.getElementById("adminTabStats").classList.toggle("active",       tab === "stats");
    document.getElementById("adminTabSolicitudes").classList.toggle("active", tab === "solicitudes");
    if (tab === "actividad")   renderActivity();
    if (tab === "stats")       renderStats();
    if (tab === "solicitudes") renderPending();
  }
  document.getElementById("adminTabUsuarios").addEventListener("click",    () => switchAdminTab("usuarios"));
  document.getElementById("adminTabActividad").addEventListener("click",   () => switchAdminTab("actividad"));
  document.getElementById("adminTabStats").addEventListener("click",       () => switchAdminTab("stats"));
  document.getElementById("adminTabSolicitudes").addEventListener("click", () => switchAdminTab("solicitudes"));

  async function renderStats() {
    try {
      const stats = await api("GET", "/api/admin/stats");
      document.getElementById("statUsers").textContent = stats.users || 0;
      document.getElementById("statActiveUsers").textContent = stats.activeUsers || 0;
      document.getElementById("statInactiveUsers").textContent = stats.inactiveUsers?.length || 0;
      document.getElementById("statBoards").textContent = stats.boards || 0;
      document.getElementById("statCards").textContent = stats.cards || 0;

      // Archivos
      const fileCount = stats.files?.count || 0;
      const totalSize = stats.files?.totalSize || 0;
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      document.getElementById("statFileCount").textContent = fileCount;
      document.getElementById("statFileSize").textContent = sizeInMB + " MB";

      // Gráfico de actividad de cuentas
      const active = stats.activeUsers || 0;
      const inactive = stats.inactiveUsers?.length || 0;
      const total = active + inactive || 1;
      const activePercent = (active / total) * 100;
      const inactivePercent = (inactive / total) * 100;
      document.getElementById("userActivityBar").innerHTML = `
        <div style="width:${activePercent}%;background:var(--success);transition:all 0.3s"></div>
        <div style="width:${inactivePercent}%;background:#e67e22;transition:all 0.3s"></div>
      `;

      // Top 10 usuarios
      const topList = document.getElementById("topUsersList");
      if (stats.topUsers?.length > 0) {
        topList.innerHTML = stats.topUsers.map(u =>
          `<div style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
             <div>
               <div style="font-weight:600;color:var(--text)">${escapeHtml(u.name || u.email)}</div>
               <div style="font-size:10px;color:#999">${u.boards} tableros • ${u.cards} tarjetas • ${u.comments} comentarios</div>
             </div>
             <div style="font-weight:bold;color:#0079bf">${u.activity}</div>
           </div>`
        ).join("");
      }

      // Mostrar lista de usuarios inactivos si hay
      const section = document.getElementById("inactiveUsersSection");
      const list = document.getElementById("inactiveUsersList");
      if (stats.inactiveUsers?.length > 0) {
        section.style.display = "";
        list.innerHTML = stats.inactiveUsers.map(u =>
          `<div style="padding:4px 0;display:flex;justify-content:space-between">
             <span>${escapeHtml(u.email)}</span>
             <span style="color:#999;font-size:10px">${u.name ? escapeHtml(u.name) : '—'}</span>
           </div>`
        ).join("");
      } else {
        section.style.display = "none";
      }

      document.getElementById("statsTimestamp").textContent = "Actualizado: " + new Date(stats.timestamp).toLocaleString("es");
    } catch (e) {
      document.getElementById("statUsers").textContent = "Error";
      document.getElementById("statActiveUsers").textContent = "Error";
      document.getElementById("statInactiveUsers").textContent = "Error";
      document.getElementById("statBoards").textContent = "Error";
      document.getElementById("statCards").textContent = "Error";
    }
  }

  async function renderActivity() {
    if (!estado.currentBoardId) return;
    const actList = document.getElementById("adminActivityList");
    const userFilter = document.getElementById("activityUserFilter").value;
    const from = document.getElementById("activityFrom").value;
    const to   = document.getElementById("activityTo").value;

    // Poblar selector de usuarios con miembros del tablero (solo la primera vez)
    const sel = document.getElementById("activityUserFilter");
    if (sel.options.length <= 1) {
      sel.innerHTML = '<option value="">Todos los usuarios</option>'
        + estado.members.map(m => `<option value="${escapeHtml(m.email)}">${escapeHtml(m.name || m.email)}</option>`).join("");
    }

    actList.innerHTML = '<div class="activity-empty">Cargando…</div>';
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (userFilter) params.set("user", userFilter);
      if (from) params.set("from", String(new Date(from).getTime()));
      if (to)   params.set("to",   String(new Date(to + "T23:59:59").getTime()));
      const data = await api("GET", "/api/boards/" + estado.currentBoardId + "/activity?" + params);
      if (!data.activity.length) {
        actList.innerHTML = '<div class="activity-empty">Sin actividad en este período.</div>';
        return;
      }
      actList.innerHTML = data.activity.map(e => {
        const cardInfo = (e.cardTitle || (e.details && e.details.title))
          ? `<div class="activity-card">📋 ${escapeHtml(e.cardTitle || e.details.title)}</div>` : "";
        return `<div class="activity-entry">
          ${avatarHtml(e.author, 20)}
          <div class="activity-body">
            <span class="activity-who">${escapeHtml(e.author.name)} </span>
            <span class="activity-action">${escapeHtml(actionLabel(e.action, e.details))}</span>
            ${cardInfo}
          </div>
          <time class="activity-time" title="${new Date(e.ts).toLocaleString("es")}">${relativeTime(e.ts)}</time>
        </div>`;
      }).join("");
    } catch (_) {
      actList.innerHTML = '<div class="activity-empty" style="color:var(--danger)">Error al cargar la actividad.</div>';
    }
  }

  document.getElementById("activityFilterBtn").addEventListener("click", renderActivity);
  document.getElementById("activityResetBtn").addEventListener("click", () => {
    document.getElementById("activityUserFilter").value = "";
    document.getElementById("activityFrom").value = "";
    document.getElementById("activityTo").value = "";
    document.getElementById("activityUserFilter").innerHTML = '<option value="">Todos los usuarios</option>';
    renderActivity();
  });

  async function openAdmin() {
    switchAdminTab("actividad");
    adminOverlay.classList.add("open");
    await renderAdminList();
  }

  async function renderAdminList() {
    adminUserList.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">Cargando…</div>';
    try {
      const data = await api("GET", "/api/admin/users");
      const adminEmails = new Set(data.admins.map(a => a.email));
      if (!data.allowed.length) {
        adminUserList.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">No hay usuarios permitidos aún.</div>';
        return;
      }
      adminUserList.innerHTML = data.allowed.map(u => {
        const isAdm = adminEmails.has(u.email);
        const isSelf = u.email === estado.me.email;
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:13px">${escapeHtml(u.email)}${isAdm ? ' <span title="Admin" style="font-size:11px;background:#ffe082;border-radius:3px;padding:1px 5px">Admin</span>' : ''}</span>
          ${!isSelf ? `<label title="Admin" style="font-size:12px;color:#555;cursor:pointer"><input type="checkbox" data-email="${escapeHtml(u.email)}" data-action="admin" ${isAdm ? "checked" : ""}> Admin</label>` : ""}
          ${!isSelf ? `<button data-email="${escapeHtml(u.email)}" data-action="remove" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:16px" title="Eliminar">✕</button>` : ""}
        </div>`;
      }).join("");

      adminUserList.querySelectorAll("[data-action='remove']").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm(`¿Eliminar acceso a ${btn.dataset.email}?`)) return;
          await api("DELETE", "/api/admin/allowed/" + encodeURIComponent(btn.dataset.email));
          await renderAdminList();
        });
      });
      adminUserList.querySelectorAll("[data-action='admin']").forEach(chk => {
        chk.addEventListener("change", async () => {
          await api("POST", "/api/admin/set-admin", { email: chk.dataset.email, isAdmin: chk.checked });
          await renderAdminList();
        });
      });
    } catch (e) {
      adminUserList.innerHTML = '<div style="padding:12px;color:#c0392b;font-size:13px">Error al cargar usuarios.</div>';
    }
  }

  async function renderPending() {
    api("POST", "/api/admin/pending/seen").catch(() => {});
    document.getElementById("adminBadge").style.display = "none";
    const list = document.getElementById("adminPendingList");
    list.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">Cargando…</div>';
    try {
      const data = await api("GET", "/api/admin/pending");
      if (!data.pending.length) {
        list.innerHTML = '<div style="padding:16px;color:#888;font-size:13px;text-align:center">No hay solicitudes pendientes. 🎉</div>';
        return;
      }
      list.innerHTML = data.pending.map(u => `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${escapeHtml(u.name || u.email)}</div>
            <div style="font-size:11px;color:#888">${escapeHtml(u.email)}</div>
            <div style="font-size:10px;color:#aaa;margin-top:2px">${new Date(u.requested_at).toLocaleString("es")}</div>
          </div>
          <button data-email="${escapeHtml(u.email)}" data-action="approve" class="btn btn-primary btn-small">Aprobar</button>
          <button data-email="${escapeHtml(u.email)}" data-action="deny" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:18px;padding:2px 6px" title="Rechazar">✕</button>
        </div>
      `).join("");
      list.querySelectorAll("[data-action='approve']").forEach(btn => {
        btn.addEventListener("click", async () => {
          await api("POST", `/api/admin/pending/${encodeURIComponent(btn.dataset.email)}/approve`);
          await renderPending();
          await renderAdminList();
        });
      });
      list.querySelectorAll("[data-action='deny']").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm(`¿Rechazar solicitud de ${btn.dataset.email}?`)) return;
          await api("DELETE", `/api/admin/pending/${encodeURIComponent(btn.dataset.email)}`);
          await renderPending();
        });
      });
    } catch (e) {
      list.innerHTML = '<div style="padding:12px;color:#c0392b;font-size:13px">Error al cargar solicitudes.</div>';
    }
  }

  document.getElementById("adminBtn").addEventListener("click", openAdmin);
  document.getElementById("adminCloseBtn").addEventListener("click", () => adminOverlay.classList.remove("open"));

  // Modal de ayuda (F1)
  const helpModal = document.getElementById("helpModal");
  function toggleHelpModal() {
    helpModal.classList.toggle("open");
  }
  document.getElementById("helpCloseBtn").addEventListener("click", () => toggleHelpModal());
  adminOverlay.addEventListener("click", e => { if (e.target === adminOverlay) adminOverlay.classList.remove("open"); });

  document.getElementById("adminAddBtn").addEventListener("click", async () => {
    const email = adminNewEmail.value.trim().toLowerCase();
    if (!email) return;
    try {
      await api("POST", "/api/admin/allowed", { email });
      adminNewEmail.value = "";
      await renderAdminList();
    } catch (e) {
      alert(e.message || "Error al agregar usuario.");
    }
  });
  adminNewEmail.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("adminAddBtn").click(); });

  async function checkDeepLink() {
    const cardId = new URLSearchParams(location.search).get("card");
    if (!cardId) return;
    if (estado.state.cards.find(c => c.id === cardId)) { openModal(cardId); return; }
    try {
      const data = await api("GET", "/api/cards/" + cardId);
      if (data.boardId !== estado.currentBoardId) {
        estado.currentBoardId = data.boardId;
        document.getElementById("boardSelect").value = estado.currentBoardId;
        updateBoardControls();
        await loadMembers();
        await loadCards();
      }
      openModal(cardId);
    } catch (e) {
      history.replaceState(null, "", location.pathname);
    }
  }

  loadBoard().then(() => { startPolling(); startWipPulse(); checkDeepLink(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stopPolling(); stopWipPulse(); } else { startPolling(); startWipPulse(); }
  });
})();
