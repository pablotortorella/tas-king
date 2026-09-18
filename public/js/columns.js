// Gestión de columnas del tablero.
//
// Crear, renombrar, mover y eliminar columnas. Todo cuelga de un solo listener
// delegado sobre el tablero, así que el módulo no exporta nada: se engancha al
// importarse, igual que admin.js.
//
// Las columnas de cierre son varias y se marcan con is_done: esa decisión está
// desacoplada de la posición, así que mover una columna no cambia qué significa
// "terminado".

import { api } from "./core/api.js";
import { estado } from "./core/state.js";
import { board, loadBoard, loadCards } from "./board.js";

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
