import { formatMoney } from "./finance.js";
import { categoryGroups } from "./categories.js";
import { categoryIcon } from "./category-data.js";
import { escapeHtml, shortDate } from "./ui-parts.js";
import { MAX_BATCH } from "./recategorize.js";

function path(spaceId) { return `/spaces/${encodeURIComponent(spaceId)}`; }
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Selector de categoría agrupado (solo categorías vigentes).
export function categorySelect(categories, { name = "categoryId", selected = "", label = "Categoría", required = true, id = "" } = {}) {
  const groups = categoryGroups(categories).map(group => `<optgroup label="${escapeHtml(group.name)}">${group.categories.map(category => `<option value="${escapeHtml(category.id)}"${category.id === selected ? " selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</optgroup>`).join("");
  return `<label${id ? ` for="${id}"` : ""}>${escapeHtml(label)}<select${id ? ` id="${id}"` : ""} name="${name}"${required ? " required" : ""}><option value="">Elegí una categoría</option>${groups}</select></label>`;
}

// Barra para cambiar la categoría de lo seleccionado. Funciona sin script: el formulario envía las casillas marcadas, o el
// criterio completo (búsqueda y filtro) si se elige «todos los resultados».
export function selectionBar({ spaceId, data, query, category, total, csrf }) {
  return `<div class="selection-bar"><h3>Cambiar la categoría de varios movimientos</h3><p class="hint">Marcá movimientos de la lista o elegí todos los resultados de la búsqueda o el filtro actual.</p><div class="selection-controls">${categorySelect(data.categories ?? [], { label: "Nueva categoría", id: "bulk-category" })}<label class="check-row"><input type="checkbox" name="all" value="1">Todos los ${total} resultados, también los que no se ven</label><button class="button" type="submit">Revisar el cambio</button></div><input type="hidden" name="query" value="${escapeHtml(query)}"><input type="hidden" name="categoria" value="${escapeHtml(category)}">${csrf}<p class="selection-count" aria-live="polite" data-selection-count></p></div>`;
}

export function renderRecategorizePreview({ spaceId, csrf, preview, criteria, key }) {
  const base = `${path(spaceId)}/ledger/recategorize`;
  const hidden = criteria.all
    ? `<input type="hidden" name="all" value="1"><input type="hidden" name="query" value="${escapeHtml(criteria.query ?? "")}"><input type="hidden" name="categoria" value="${escapeHtml(criteria.category ?? "")}">`
    : criteria.ids.map(id => `<input type="hidden" name="ids" value="${escapeHtml(id)}">`).join("");
  const skipped = preview.skipped;
  const notes = [
    skipped.permission ? `${plural(skipped.permission, "movimiento queda", "movimientos quedan")} fuera porque no son tuyos` : "",
    skipped.voided ? `${plural(skipped.voided, "movimiento anulado se omite", "movimientos anulados se omiten")}` : "",
    skipped.unchanged ? `${plural(skipped.unchanged, "ya tiene", "ya tienen")} esa categoría` : "",
    skipped.transfers ? `${plural(skipped.transfers, "transferencia se omite", "transferencias se omiten")} (no llevan categoría)` : "",
  ].filter(Boolean);
  const rows = preview.sample.map(item => `<li><strong>${escapeHtml(item.description)}</strong> <span class="muted">${escapeHtml(shortDate(item.occurredAt))} · ${escapeHtml(formatMoney(item.totalMinor, item.currency))} · ahora: ${escapeHtml(item.current ?? "Sin categoría")}</span></li>`).join("");
  return `<a class="back-link" href="${path(spaceId)}">← Volver al libro</a><p class="eyebrow">Cuentas Claras</p><h1>Cambiar categoría</h1><p class="lead-count">Cambiarán ${plural(preview.count, "movimiento", "movimientos")} a <span class="chip cat">${categoryIcon("tag")}${escapeHtml(preview.category.name)}</span>.</p>${notes.length ? `<ul class="plain-list">${notes.map(note => `<li class="muted">${escapeHtml(note)}</li>`).join("")}</ul>` : ""}<section class="ledger-section"><h2>Muestra</h2><ul class="plain-list">${rows}</ul>${preview.count > preview.sample.length ? `<p class="footnote">…y ${preview.count - preview.sample.length} más.</p>` : ""}</section><p class="hint">Cada movimiento recibe una revisión en su historial y después podés deshacer toda la operación. Máximo ${new Intl.NumberFormat("es-CO").format(MAX_BATCH)} por vez.</p><form class="ledger-form" method="post" action="${base}">${csrf}${hidden}<input type="hidden" name="categoryId" value="${escapeHtml(preview.category.id)}"><input type="hidden" name="expectedRevision" value="${preview.ledgerRevision}"><input type="hidden" name="key" value="${escapeHtml(key)}"><div class="form-actions"><button class="button" type="submit">Confirmar el cambio</button><a class="button secondary" href="${path(spaceId)}">Cancelar</a></div></form>`;
}

// Aviso posterior a una operación, con el botón para deshacerla si corresponde.
export function recategorizationNotice({ spaceId, csrf, batch, back = "" }) {
  if (batch.kind === "undo") return `<p class="notice" role="status">Se deshizo la operación: ${plural(batch.changed, "movimiento volvió", "movimientos volvieron")} a su categoría anterior${batch.skipped ? `; ${plural(batch.skipped, "quedó", "quedaron")} como estaba${batch.skipped === 1 ? "" : "n"} porque se modificó después` : ""}.</p>`;
  const undo = batch.canUndo ? `<form class="inline-form" method="post" action="${path(spaceId)}/ledger/recategorize/${encodeURIComponent(batch.id)}/undo">${csrf}${back ? `<input type="hidden" name="volver" value="${escapeHtml(back)}">` : ""}<button class="button secondary" type="submit">Deshacer</button></form>` : "";
  return `<div class="notice" role="status"><span>Se cambió la categoría de ${plural(batch.changed, "movimiento", "movimientos")} a «${escapeHtml(batch.categoryName ?? "")}»${batch.skipped ? ` (${plural(batch.skipped, "omitido", "omitidos")})` : ""}.</span>${undo}</div>`;
}

export function renderClassify({ spaceId, csrf, current, names, remaining, suggestion, recents, categories, skipped, last, key }) {
  const base = `${path(spaceId)}/ledger/classify`;
  const skipParam = skipped.length ? `?saltar=${encodeURIComponent(skipped.join(","))}` : "";
  const header = `<a class="back-link" href="${path(spaceId)}">← Volver al libro</a><p class="eyebrow">Cuentas Claras</p><h1>Clasificar rápido</h1>`;
  if (!current) return `${header}<div class="empty"><h3>No quedan movimientos pendientes.</h3><p>Todos tus movimientos tienen categoría.</p></div><a class="button big" href="${path(spaceId)}">Volver al libro</a>`;
  const hidden = `${csrf}<input type="hidden" name="entryId" value="${escapeHtml(current.id)}"><input type="hidden" name="key" value="${escapeHtml(key)}"><input type="hidden" name="saltar" value="${escapeHtml(skipped.join(","))}">`;
  const suggest = suggestion ? `<div class="suggestion"><p><strong>Sugerida:</strong> <span class="chip cat">${categoryIcon("tag")}${escapeHtml(suggestion.name)}</span></p><p class="muted">${escapeHtml(suggestion.reason)}</p><form method="post" action="${base}">${hidden}<button class="button" type="submit" name="categoryId" value="${escapeHtml(suggestion.categoryId)}" data-accept>Aceptar la sugerida <kbd>Enter</kbd></button></form></div>` : '<p class="muted">Sin sugerencia: no hay movimientos parecidos con una categoría clara.</p>';
  const recent = recents.length ? `<form method="post" action="${base}" class="recents">${hidden}<p class="lead">Recientes</p><div class="chips">${recents.map((category, index) => `<button class="chip-button" type="submit" name="categoryId" value="${escapeHtml(category.id)}" data-key="${index + 1}"><kbd>${index + 1}</kbd> ${escapeHtml(category.name)}</button>`).join("")}</div></form>` : "";
  const undo = last?.canUndo ? `<form method="post" action="${path(spaceId)}/ledger/recategorize/${encodeURIComponent(last.id)}/undo">${csrf}<input type="hidden" name="volver" value="classify"><input type="hidden" name="saltar" value="${escapeHtml(skipped.join(","))}"><button class="button secondary" type="submit" data-undo>Deshacer la última <kbd>U</kbd></button></form>` : "";
  const nextSkip = encodeURIComponent([...skipped, current.id].join(","));
  const who = current.cashParties.filter(party => party.direction === "out").map(party => names.get(party.participantId) ?? "Participante").join(", ");
  return `${header}<p class="lead-count" aria-live="polite" data-remaining>Quedan ${plural(remaining, "movimiento pendiente", "movimientos pendientes")}</p><section class="classify-card"><h2>${escapeHtml(current.description)}</h2><p class="entry-amount">${escapeHtml(formatMoney(current.totalMinor, current.currency))}</p><p class="muted">${escapeHtml(shortDate(current.occurredAt))}${who ? ` · pagó ${escapeHtml(who)}` : ""}</p>${current.note ? `<p class="muted">${escapeHtml(current.note)}</p>` : ""}${suggest}${recent}<form method="post" action="${base}" class="all-categories">${hidden}${categorySelect(categories, { label: "Otra categoría", id: "classify-category" })}<button class="button secondary" type="submit">Asignar</button></form><div class="classify-actions"><a class="button secondary" href="${base}?saltar=${nextSkip}" data-skip>Saltar <kbd>S</kbd></a>${undo}</div></section><script type="module" src="/classify.js"></script>`;
}
