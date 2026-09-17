// El tablero: cargar sus datos y dibujarlo.
//
// Capa intermedia entre el núcleo y las features. Las features la importan —
// necesitan `await loadCards()` y su valor de retorno, cosa que un aviso por el
// bus no puede dar—, y este módulo no importa ninguna feature: cuando necesita
// avisar algo hacia arriba emite y app.js decide quién atiende.
//
// theme.js es la excepción aparente: se importa desde acá porque no depende de
// nada, así que queda por debajo de esta capa y no la contradice.
//
// De las 18 funciones del grupo solo se exportan 8. El resto —el render de una
// tarjeta, los filtros de visibilidad, los controles del encabezado— son asunto
// interno del tablero y nadie afuera tiene por qué llamarlas.

import { api } from "./core/api.js";
import { emit } from "./core/bus.js";
import { avatarHtml, escapeHtml, fechaLocal, fmtDate, shortName } from "./core/dom.js";
import { currentBoard, estado, getDoneColumnIds, memberByEmail } from "./core/state.js";
import { applyBoardPalette } from "./theme.js";

// Carga el usuario, sus tableros y el tablero actual.
export async function loadBoard() {
  try {
    estado.me = await api("GET", "/api/me?today=" + fechaLocal());
    emit("sesion:cargada");
    const saved = localStorage.getItem("tasKingBoardId");
    if (!estado.me.boards.some(b => b.id === estado.currentBoardId)) estado.currentBoardId = null;
    if (!estado.currentBoardId) {
      estado.currentBoardId = (saved && estado.me.boards.some(b => b.id === saved)) ? saved
        : (estado.me.boards[0] && estado.me.boards[0].id) || null;
    }
    renderBoardSelect();
    await loadMembers();
    await loadCards();
    emit("tablero:cargado");
  } catch (e) {
    // sin sesión válida → mandar al login con Google
    if (e.status === 401) { window.location.href = "/landing.html"; return; }
    const errorDetails = `Status: ${e.status || "?"}, Message: ${e.message || "desconocido"}`;
    board.innerHTML = '<div style="padding:24px;color:#c0392b;font-size:14px">'
      + "❌ No se pudo cargar el tablero. Revisá tu conexión y volvé a intentar.<br><br>"
      + "<strong>Detalles del error:</strong><br>"
      + escapeHtml(errorDetails) + "</div>";
    console.error("loadBoard error:", e);
  }
}

// Trae las tarjetas del tablero actual y re-renderiza.
export async function loadCards() {
  const boardId = estado.currentBoardId;
  const mutationRevision = estado.cardMutationRevision;
  const loadRevision = ++estado.boardLoadRevision;
  const isCurrent = () => boardId === estado.currentBoardId && mutationRevision === estado.cardMutationRevision
    && loadRevision === estado.boardLoadRevision && !estado.pendingCardMutations && !(estado.cardDrag && estado.cardDrag.active);
  if (estado.pendingCardMutations) { estado.boardRefreshPending = true; return false; }
  if (!estado.currentBoardId) {
    estado.state = { cards: [], columns: [] }; estado.COLUMNS = [];
    estado.boardLabels = []; estado.boardGoals = [];
    applyBoardPalette(null);
    emit("columnas:cambiaron"); render(); emit("objetivos:cambiaron"); return true;
  }
  localStorage.setItem("tasKingBoardId", estado.currentBoardId);
  applyBoardPalette(currentBoard() && currentBoard().theme);
  const nextState = await api("GET", "/api/boards/" + boardId + "/cards");
  if (!isCurrent()) return false;
  // Publicar las tarjetas al recibirlas: otros controles del modal leen state
  // mientras se cargan los catálogos. Una respuesta anterior a un guardado se descarta.
  estado.state = nextState;
  estado.COLUMNS = estado.state.columns || [];
  emit("columnas:cambiaron");
  let nextLabels = [], nextGoals = [];
  try { nextLabels = await api("GET", "/api/boards/" + boardId + "/labels"); }
  catch (e) { /* el catálogo puede no estar disponible */ }
  if (!isCurrent()) return false;
  try { nextGoals = await api("GET", "/api/boards/" + boardId + "/goals"); }
  catch (e) { /* los objetivos pueden no estar disponibles */ }
  if (!isCurrent()) return false;
  estado.boardLabels = nextLabels;
  estado.boardGoals = nextGoals;
  estado.lastKnownVersion = estado.state.version || 0;
  render();
  emit("objetivos:cambiaron");
  return true;
}

export async function withCardMutation(action) {
  estado.pendingCardMutations++;
  estado.cardMutationRevision++;
  emit("mutacion:inicio");
  try { return await action(); }
  finally {
    estado.pendingCardMutations--;
    estado.cardMutationRevision++;
    emit("mutacion:fin");
    // Si se cambió de tablero durante la escritura, atender esa carga pendiente.
    if (!estado.pendingCardMutations && estado.boardRefreshPending) {
      estado.boardRefreshPending = false;
      await loadCards().catch(e => console.error("No se pudo actualizar el tablero", e));
    }
  }
}

export function applySavedCard(boardId, card) {
  if (boardId !== estado.currentBoardId) return;
  const index = estado.state.cards.findIndex(c => c.id === card.id);
  if (index >= 0 && estado.state.cards[index].column === card.column) estado.state.cards[index] = card;
  else {
    // Las tarjetas nuevas o movidas se guardan al final de su columna.
    estado.state.cards = estado.state.cards.filter(c => c.id !== card.id);
    estado.state.cards.push(card);
  }
  // Mismo criterio que goalsWithProgress() del servidor, usando los datos cargados.
  const doneColumn = estado.COLUMNS.find(c => c.isDone)?.id || "terminado";
  estado.boardGoals = estado.boardGoals.map(goal => {
    const linked = estado.state.cards.filter(c => !c.archived && (c.goals || []).some(g => g.id === goal.id));
    const done = linked.filter(c => c.column === doneColumn).length;
    return { ...goal, total: linked.length, done, pct: linked.length ? Math.round(done / linked.length * 100) : 0 };
  });
  // No adelantar lastKnownVersion con una escritura individual: podría ocultar
  // cambios de otras personas. El siguiente poll reconciliará el tablero completo.
  render();
  emit("objetivos:cambiaron");
}

export async function loadGoals() {
  try { estado.boardGoals = await api("GET", "/api/boards/" + estado.currentBoardId + "/goals"); }
  catch (e) { estado.boardGoals = []; }
}

export async function loadMembers() {
  if (!estado.currentBoardId) { estado.members = []; renderAssigneeFilter(); return; }
  try { estado.members = (await api("GET", "/api/boards/" + estado.currentBoardId + "/members")).members; }
  catch (e) { estado.members = []; }
  renderAssigneeFilter();
}

function renderBoardSelect() {
  const sel = document.getElementById("boardSelect");
  sel.innerHTML = "";
  estado.me.boards.forEach(b => {
    const o = document.createElement("option");
    o.value = b.id;
    o.textContent = (b.isPersonal ? "👤 " : "👥 ") + b.name;
    sel.appendChild(o);
  });
  sel.value = estado.currentBoardId;
  updateBoardControls();
}

// ¿El usuario puede administrar (renombrar/eliminar) el tablero actual?
const canManageBoard = () => {
  const b = currentBoard();
  return !!(b && b.role === "owner" && !b.isPersonal);
};

export function updateBoardControls() {
  // el lápiz de renombrar solo aparece en tableros compartidos propios
  document.getElementById("editBoardBtn").style.display = canManageBoard() ? "" : "none";
}

function renderAssigneeFilter() {
  const sel = document.getElementById("assigneeFilter");
  const prev = estado.assigneeFilter;
  sel.innerHTML = '<option value="">👤 Todos</option>';
  estado.members.forEach(m => {
    const o = document.createElement("option");
    o.value = m.email; o.textContent = (m.avatarEmoji ? m.avatarEmoji + " " : "") + (m.name || shortName(m.email));
    sel.appendChild(o);
  });
  if (estado.members.some(m => m.email === prev)) sel.value = prev;
  else { estado.assigneeFilter = ""; sel.value = ""; }
}

function isOverdue(card) {
  if (!card.due || getDoneColumnIds().has(card.column)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(card.due + "T00:00:00") < today;
}

// Urgente: vence hoy o mañana (o ya venció), y no está en columna de cierre.
function isUrgent(card) {
  if (!card.due || getDoneColumnIds().has(card.column)) return false;
  const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(card.due + "T00:00:00") <= tomorrow;
}

// ---------- Render del tablero ----------
export const board = document.getElementById("board");

// ¿La tarjeta coincide con el texto buscado? (título, detalles y comentarios)
function matchesSearch(card) {
  if (!estado.searchQuery) return true;
  const haystack = [
    card.title,
    card.details,
    ...(card.comments || []).map(c => c.text),
  ].join(" ").toLowerCase();
  return haystack.includes(estado.searchQuery);
}

function matchesAssignee(card) {
  return !estado.assigneeFilter || card.assignee === estado.assigneeFilter;
}

function matchesLabels(card) {
  if (estado.activeLabelFilters.size === 0) return true;
  return (card.labels || []).some(l => estado.activeLabelFilters.has(l.id));
}

function isOwner() {
  if (!estado.me || !estado.me.boards) return false;
  const b = estado.me.boards.find(b => b.id === estado.currentBoardId);
  return b && b.role === "owner";
}

export function render() {
  board.innerHTML = "";
  const owner = isOwner();
  estado.COLUMNS.forEach((col, colIdx) => {
    const cards = estado.state.cards.filter(c => c.column === col.id && !c.archived && matchesSearch(c) && matchesAssignee(c) && matchesLabels(c) && (!estado.urgentFilter || isUrgent(c)));
    const activeCards = estado.state.cards.filter(c => c.column === col.id && !c.archived).length;
    const colEl = document.createElement("div");
    colEl.className = "column";
    const doneMarker = col.isDone ? ' <span title="Columna de cierre">✅</span>' : "";
    const isFirst = colIdx === 0;
    const isLast  = colIdx === estado.COLUMNS.length - 1;
    colEl.innerHTML = `
      <div class="column-header">
        <span class="col-name-text">${escapeHtml(col.name)}${doneMarker}</span>
        <div class="col-actions">
          ${owner && !isFirst ? `<button class="col-action-btn col-move-btn" data-col="${col.id}" data-dir="left" title="Mover columna a la izquierda">◀</button>` : ""}
          ${owner && !isLast  ? `<button class="col-action-btn col-move-btn" data-col="${col.id}" data-dir="right" title="Mover columna a la derecha">▶</button>` : ""}
          ${owner ? `<button class="col-action-btn col-rename-btn" data-col="${col.id}" title="Renombrar columna">✏️</button>` : ""}
          ${owner ? `<button class="col-action-btn col-toggle-done-btn" data-col="${col.id}" data-done="${col.isDone ? '1' : '0'}" title="${col.isDone ? 'Quitar columna de cierre' : 'Marcar como columna de cierre'}">🏁</button>` : ""}
          ${owner && activeCards === 0 ? `<button class="col-action-btn col-delete-btn" data-col="${col.id}" title="Eliminar columna">🗑️</button>` : ""}
          <span class="count">${cards.length}</span>
        </div>
      </div>
      <div class="cards" data-col="${col.id}"></div>
      <div class="add-card" data-col="${col.id}">+ Añadir tarjeta</div>
    `;
    const cardsEl = colEl.querySelector(".cards");
    cards.forEach(card => cardsEl.appendChild(renderCard(card)));

    // drag & drop de tarjetas: implementado con Pointer Events, ver startCardDrag() más abajo
    // (no usa HTML5 dragover/drop nativo porque no es confiable con touch en todos los navegadores)

    colEl.querySelector(".add-card").addEventListener("click", () => emit("tarjeta:abrir", { id: null, columna: col.id }));
    board.appendChild(colEl);
  });

  // Botón "+ Columna" al final (solo owner)
  if (owner && estado.currentBoardId) {
    const addColEl = document.createElement("div");
    addColEl.className = "add-column";
    addColEl.innerHTML = `
      <button class="add-column-btn">+ Columna</button>
      <div class="add-column-form" style="display:none">
        <input class="add-column-input" type="text" placeholder="Nombre de la columna" maxlength="50">
        <div class="add-column-row">
          <button class="add-column-confirm">✓ Agregar</button>
          <button class="add-column-cancel">✕</button>
        </div>
      </div>
    `;
    const addBtn   = addColEl.querySelector(".add-column-btn");
    const form     = addColEl.querySelector(".add-column-form");
    const input    = addColEl.querySelector(".add-column-input");
    const confirm  = addColEl.querySelector(".add-column-confirm");
    const cancel   = addColEl.querySelector(".add-column-cancel");

    addBtn.addEventListener("click", () => { addBtn.style.display = "none"; form.style.display = "flex"; input.focus(); });

    const doAdd = async () => {
      const name = input.value.trim();
      if (!name) return;
      try {
        await api("POST", "/api/boards/" + estado.currentBoardId + "/columns", { name });
        await loadCards();
      } catch (err) { alert(err.message || "Error al crear columna"); await loadCards(); }
    };
    input.addEventListener("keydown", async e => { if (e.key === "Enter") { e.preventDefault(); await doAdd(); } if (e.key === "Escape") await loadCards(); });
    confirm.addEventListener("click", doAdd);
    cancel.addEventListener("click", () => loadCards());

    board.appendChild(addColEl);
  }

}

function renderCard(card) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.id = card.id;

  // Resaltado por objetivo seleccionado: las vinculadas se marcan, el resto se atenúa.
  if (estado.activeGoalFilter) {
    if ((card.goals || []).some(g => g.id === estado.activeGoalFilter)) el.classList.add("card-goal-match");
    else el.classList.add("card-dimmed");
  }

  const badges = [];
  if (card.assignee) {
    const p = memberByEmail(card.assignee) || { email: card.assignee };
    badges.push(`<span class="badge assignee">${avatarHtml(p, 16)} ${escapeHtml(p.name || shortName(card.assignee))}</span>`);
  }
  if (card.due) badges.push(`<span class="badge ${isOverdue(card) ? "overdue" : ""}">📅 ${fmtDate(card.due)}</span>`);
  if (card.checklists && card.checklists.length) {
    const totalItems = card.checklists.reduce((s, cl) => s + cl.items.length, 0);
    const doneItems  = card.checklists.reduce((s, cl) => s + cl.items.filter(i => i.checked).length, 0);
    if (totalItems > 0) badges.push(`<span class="badge${doneItems === totalItems ? ' badge-done' : ''}">☑ ${doneItems}/${totalItems}</span>`);
  }
  if (card.goals && card.goals.length) badges.push(`<span class="badge" title="${escapeHtml(card.goals.map(g => g.title).join(", "))}">🎯 ${card.goals.length}</span>`);
  if (card.comments && card.comments.length) badges.push(`<span class="badge">💬 ${card.comments.length}</span>`);
  if (card.attachments && card.attachments.length) badges.push(`<span class="badge">📎 ${card.attachments.length}</span>`);
  if (card.details) badges.push(`<span class="badge">≡</span>`);

  const labels = (card.labels || []).map(l =>
    `<span class="label-chip" style="background:${l.color}" data-label-id="${l.id}" title="${escapeHtml(l.name)}">${escapeHtml(l.name)}</span>`
  ).join("");

  el.innerHTML = `
    <div class="card-title">${escapeHtml(card.title) || "(sin título)"}</div>
    ${badges.length ? `<div class="card-meta">${badges.join("")}</div>` : ""}
    ${labels ? `<div class="card-labels">${labels}</div>` : ""}
  `;
  el.addEventListener("click", () => {
    if (el._justDragged) { el._justDragged = false; return; }
    emit("tarjeta:abrir", { id: card.id });
  });
  el.addEventListener("pointerdown", e => emit("tarjeta:arrastre", { e, el, card }));
  return el;
}

// Texto legible de un evento del log de auditoría.
//
// Vive acá y no con el modal porque lo usan dos features —el historial de una
// tarjeta y la actividad del tablero en el panel de administración— y lee las
// columnas del tablero. Una feature puede importar del tablero; de otra feature, no.
export function actionLabel(action, details) {
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
