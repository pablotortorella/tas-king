// Archivo de tarjetas.
//
// Archivar, restaurar y eliminar, más el overlay que lista lo archivado.
// Archivar es reversible y eliminar no: por eso solo el segundo pide confirmación
// y deleteCard devuelve si el borrado ocurrió, para que el modal sepa si cerrarse.
//
// Exporta el overlay porque la cadena de Escape vive en app.js y necesita saber
// cuál está abierto.

import { api } from "./core/api.js";
import { escapeHtml } from "./core/dom.js";
import { colName, estado } from "./core/state.js";
import { loadCards } from "./board.js";

// ---------- Archivar / Eliminar / Restaurar ----------
export async function archiveCard(id) {
  try { await api("POST", "/api/cards/" + id + "/archive"); await loadCards(); renderArchiveList(); }
  catch (e) { alert("No se pudo archivar: " + e.message); }
}

async function restoreCard(id) {
  try { await api("POST", "/api/cards/" + id + "/restore"); await loadCards(); renderArchiveList(); }
  catch (e) { alert("No se pudo restaurar: " + e.message); }
}

// Devuelve true si la tarjeta fue eliminada.
export async function deleteCard(id) {
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
export const archiveOverlay = document.getElementById("archiveOverlay");
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
