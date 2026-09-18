// Exportar e importar el tablero.
//
// Cubre los dos formatos (JSON y CSV), la vista previa de importación y el menú
// desplegable de Datos. La importación es aditiva a propósito: agrega tarjetas
// al tablero en vez de reemplazarlo, así que un archivo equivocado no borra
// trabajo.
//
// El CSV lleva BOM: es lo que hace que Excel lo abra en UTF-8 y no rompa los
// acentos. Un test de caracterización lo fija, porque es fácil de perder sin
// notarlo.

import { api } from "./core/api.js";
import { escapeHtml, uid } from "./core/dom.js";
import { colName, currentBoard, estado } from "./core/state.js";
import { loadBoard, loadCards, render } from "./board.js";

// ---------- Exportar / Importar ----------
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
const stamp = () => new Date().toISOString().slice(0, 10);

// -- CSV (formato estándar, estilo Notion: una fila por tarjeta) --
const CSV_HEADER = ["Name", "Status", "Details", "Due", "Comments", "Archived"];

function csvEscape(v) {
  v = (v == null ? "" : String(v));
  return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function toCSV() {
  const rows = [CSV_HEADER];
  estado.state.cards.forEach(c => {
    rows.push([
      c.title || "",
      colName(c.column),
      c.details || "",
      c.due || "",
      (c.comments || []).map(x => x.text).join("\n"),
      c.archived ? "Sí" : "",
    ]);
  });
  // BOM para que Excel respete los acentos
  return "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n");
}

// Parser CSV (RFC 4180: comillas, comas y saltos de línea dentro de campos)
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // sacar BOM
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function fromCSV(text) {
  const rows = parseCSV(text).filter(r => r.some(c => c.trim() !== ""));
  if (rows.length < 2) throw new Error("El CSV no tiene filas de datos.");
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; } return -1; };
  const iTitle = col("name", "título", "titulo", "title", "nombre");
  const iStatus = col("status", "estado", "columna", "column");
  const iDetails = col("details", "detalles", "descripción", "descripcion");
  const iDue = col("due", "fecha límite", "fecha limite", "due date", "fecha");
  const iComments = col("comments", "comentarios");
  const iArchived = col("archived", "archivada", "archivado");
  if (iTitle === -1) throw new Error('Falta la columna "Name" (título).');

  const statusToCol = {};
  estado.COLUMNS.forEach(c => { statusToCol[c.name.toLowerCase()] = c.id; });

  const cards = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = idx => (idx === -1 ? "" : (r[idx] || "")).trim();
    const statusText = get(iStatus).toLowerCase();
    const due = get(iDue);
    cards.push({
      id: uid(),
      title: get(iTitle),
      column: statusToCol[statusText] || estado.COLUMNS[0].id,
      details: get(iDetails),
      due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "",
      comments: get(iComments).split("\n").map(s => s.trim()).filter(Boolean).map(t => ({ text: t, ts: Date.now() })),
      attachments: [],
      archived: /^(s[ií]|true|x|1)$/i.test(get(iArchived)),
      created: Date.now(),
    });
  }
  return { cards };
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  downloadFile(toCSV(), "tablero-" + stamp() + ".csv", "text/csv;charset=utf-8");
});
document.getElementById("exportBtn").addEventListener("click", () => {
  downloadFile(JSON.stringify(estado.state, null, 2), "tablero-" + stamp() + ".json", "application/json");
});

document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result);
      const isJson = /\.json$/i.test(file.name) || /^\s*[{\[]/.test(text);
      const data = isJson ? JSON.parse(text) : fromCSV(text);
      if (!data || !Array.isArray(data.cards)) throw new Error("Formato no reconocido.");
      openImportPreview(data.cards, file.name);
    } catch (err) { alert("No se pudo importar: " + err.message); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ---------- Vista previa de importación (no destructiva: agrega al tablero) ----------
export const importOverlay = document.getElementById("importOverlay");
let pendingImport = null;   // tarjetas parseadas a la espera de confirmación

export function openImportPreview(cards, fileName) {
  pendingImport = cards;
  const total = cards.length;
  const activas = cards.filter(c => !c.archived).length;
  const archivadas = total - activas;
  const conComentarios = cards.filter(c => (c.comments || []).length).length;
  const conEtiquetas   = cards.filter(c => (c.labels || []).length).length;
  const conChecklists  = cards.filter(c => (c.checklists || []).length).length;
  const conResponsable = cards.filter(c => c.assignee).length;

  // conteo por columna (en el orden del tablero), solo de las no archivadas
  const porColumna = estado.COLUMNS.map(col => {
    const n = cards.filter(c => !c.archived && (c.column || "por_conversar") === col.id).length;
    return n ? `<li><span>${escapeHtml(col.name)}</span><b>${n}</b></li>` : "";
  }).join("");

  document.getElementById("importSummary").innerHTML = `
    <p class="import-file">Archivo: <b>${escapeHtml(fileName)}</b></p>
    <ul class="import-stats">
      <li><span>Tarjetas a importar</span><b>${total}</b></li>
      ${archivadas ? `<li><span>· activas</span><b>${activas}</b></li><li><span>· archivadas</span><b>${archivadas}</b></li>` : ""}
      ${conComentarios ? `<li><span>· con comentarios</span><b>${conComentarios}</b></li>` : ""}
      ${conEtiquetas   ? `<li><span>· con etiquetas</span><b>${conEtiquetas}</b></li>` : ""}
      ${conChecklists  ? `<li><span>· con checklists</span><b>${conChecklists}</b></li>` : ""}
      ${conResponsable ? `<li><span>· con responsable</span><b>${conResponsable}</b></li>` : ""}
    </ul>
    ${porColumna ? `<p class="import-sub">Por columna:</p><ul class="import-stats">${porColumna}</ul>` : ""}
    <p class="hint">Se <b>agregarán</b> al tablero actual (no se borra nada). Los adjuntos no se importan desde CSV/JSON.</p>
  `;
  importOverlay.classList.add("open");
}

export function closeImportPreview() {
  importOverlay.classList.remove("open");
  pendingImport = null;
}

document.getElementById("importCancelBtn").addEventListener("click", closeImportPreview);
importOverlay.addEventListener("click", e => { if (e.target === importOverlay) closeImportPreview(); });
document.getElementById("importConfirmBtn").addEventListener("click", async () => {
  if (!pendingImport) return;
  const btn = document.getElementById("importConfirmBtn");
  btn.disabled = true;
  try {
    estado.state = await api("POST", "/api/boards/" + estado.currentBoardId + "/import", { cards: pendingImport });
    render();
    closeImportPreview();
  } catch (err) {
    alert("No se pudo importar: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---------- Menú IO (importar/exportar) ----------
const ioBtn = document.getElementById("ioBtn");
const ioPanel = document.getElementById("ioPanel");
ioBtn.addEventListener("click", e => {
  e.stopPropagation();
  const open = ioPanel.classList.toggle("open");
  ioBtn.setAttribute("aria-expanded", open);
});
ioPanel.addEventListener("click", () => {
  ioPanel.classList.remove("open");
  ioBtn.setAttribute("aria-expanded", "false");
});
document.addEventListener("click", e => {
  if (!ioBtn.contains(e.target) && !ioPanel.contains(e.target)) {
    ioPanel.classList.remove("open");
    ioBtn.setAttribute("aria-expanded", "false");
  }
});
