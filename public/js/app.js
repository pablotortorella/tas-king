// Frontend de FUN TasKing! — composition root.
//
// Este archivo no implementa nada: arranca la aplicación y decide quién atiende
// qué. Tres responsabilidades, y ninguna más:
//
//   1. Suscribir los avisos del bus. Los módulos emiten sin saber quién escucha;
//      acá, y solo acá, se decide el destinatario.
//   2. Registrar los hooks de window que usan los tests E2E.
//   3. La cadena de Escape y el arranque.
//
// La cadena de Escape vive acá a propósito: decidir qué cierra Esc cuando hay
// varios overlays abiertos es cableado entre módulos, no lógica de ninguno. Es
// también la razón de que varias features exporten su overlay.
//
// Ver ADR-017 y openspec/changes/extraer-frontend-a-modulos/design.md (D3) para
// la dirección de dependencias entre capas.

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
import "./keyboard.js";  // se engancha solo a sus atajos
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
  on("pulso:manual", () => runWipPulseSequence({ alwaysShowMessage: true }));

  initWipPulse();

  // Hooks para los tests E2E. Cada uno tiene una prueba que lo usa; antes de
  // sacar alguno, mirar cuál. No son deuda: son la costura que permite disparar
  // un tick o un pulso sin esperar cinco minutos de reloj.
  window.pollTick = pollTick;                       // drag-no-duplicate, access-revoked
  window.runWipPulseSequence = runWipPulseSequence; // wip-pulse
  window.maybeBlinkTip = maybeBlinkTip;             // tip-diario
  window.launchConfetti = launchConfetti;           // disparo manual

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
