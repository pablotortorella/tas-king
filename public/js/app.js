// Frontend de FUN TasKing!
//
// Movido tal cual desde el <script> inline de public/index.html, sin cambios de
// comportamiento: este paso es solo la extraccion. La division en modulos ES por
// dominio viene despues, en commits propios. Ver ADR-017.

import {
  AVATAR_COLORS, avatarHtml, defaultColor, escapeHtml,
  LABEL_COLORS, fechaLocal, fmtDate, relativeTime, shortName, uid,
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
  actionLabel, applySavedCard, board, loadBoard, loadCards, loadGoals, loadMembers,
  render, updateBoardControls, withCardMutation,
} from "./board.js";
import { startCardDrag } from "./drag.js";
import { pollTick, startPolling, stopPolling } from "./polling.js";
import { closeImportPreview, importOverlay } from "./io.js";
import "./admin.js";   // se engancha solo a sus controles
import "./columns.js"; // idem
import { archiveCard, archiveOverlay, deleteCard } from "./archive.js";
import {
  closeModal, openModal, overlay, populateColumnSelect, renderChecklists, renderComments,
} from "./card-modal.js";
import {
  closeGoalsDrawer, closeMetricsDrawer, goalsDrawer, metricsDrawer, refreshGoalsUI, showView,
} from "./goals.js";
import {
  checkThemePrompt, membersOverlay, openProfile, profileOverlay, renderMe,
  skipThemePrompt, themePromptOverlay,
} from "./boards.js";

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
  window.pollTick = pollTick;                      // hook manual / tests E2E

  // Paleta fija para avatares por defecto (derivada del email).
  // Devuelve el HTML de un avatar (círculo con color + emoji o inicial).
  // Busca el perfil de un miembro del tablero actual por email.

  // Perfil del usuario actual (con email) para pasarlo a avatarHtml.

  // Capa de datos: API REST contra el backend (Worker + D1).

  // Fecha local en formato YYYY-MM-DD. Se la mandamos al backend para que el día
  // del tip cambie a la medianoche de la persona y no a la del servidor.


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

  // Modal de ayuda (F1)
  const helpModal = document.getElementById("helpModal");
  function toggleHelpModal() {
    helpModal.classList.toggle("open");
  }
  document.getElementById("helpCloseBtn").addEventListener("click", () => toggleHelpModal());


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
