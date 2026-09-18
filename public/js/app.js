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
import { closeImportPreview, importOverlay } from "./io.js";
import "./admin.js";   // se engancha solo a sus controles
import "./columns.js"; // idem
import { archiveCard, archiveOverlay, deleteCard } from "./archive.js";
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

  // Paleta fija para avatares por defecto (derivada del email).
  // Devuelve el HTML de un avatar (círculo con color + emoji o inicial).
  // Busca el perfil de un miembro del tablero actual por email.

  // Perfil del usuario actual (con email) para pasarlo a avatarHtml.

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
