import { formatMoney } from "./finance.js";
import { escapeHtml } from "./ledger-ui.js";

function basePath(spaceId) { return `/spaces/${encodeURIComponent(spaceId)}/ledger/import`; }
function list(items, render) { return items.length ? `<ul>${items.map(render).join("")}</ul>` : "<p>Ninguno.</p>"; }

export function renderImportUpload({ spaceId, csrf }) {
  return `<p class="eyebrow">Cuentas Claras</p><h1>Importar Splitwise</h1><p>Elegí el CSV exportado de este grupo o relación. Verás personas, filas y saldos antes de confirmar.</p><form class="ledger-form" method="post" enctype="multipart/form-data" action="${basePath(spaceId)}/preview">${csrf}<label>Archivo CSV<input type="file" name="file" accept=".csv,text/csv" required></label><div class="form-actions"><button class="button" type="submit">Previsualizar</button><a class="button secondary" href="/spaces/${encodeURIComponent(spaceId)}">Cancelar</a></div></form>`;
}

export function renderImportPreview({ spaceId, csrf, preview, participants }) {
  const base = basePath(spaceId);
  const source = preview.parsed;
  const options = (sourceName, index) => {
    const matching = participants.find(person => person.displayName.normalize("NFD").toLowerCase() === sourceName.normalize("NFD").toLowerCase());
    return `<label>${escapeHtml(sourceName)}<select name="mapping_${index}" required><option value="new"${matching ? "" : " selected"}>Crear participante nuevo</option>${participants.map(person => `<option value="${escapeHtml(person.id)}"${matching?.id === person.id ? " selected" : ""}>${escapeHtml(person.displayName)}</option>`).join("")}</select></label>`;
  };
  const incidentControls = source.incidents.map((incident, index) => `<div class="incident-row"><strong>Fila ${incident.line}</strong><span>${escapeHtml(incident.reason)}</span><select name="decision_${index}" required><option value="">Elegí qué hacer</option><option value="exclude">Excluir esta fila</option>${incident.code === "missing_currency" ? `<option value="assume_default">Usar ${escapeHtml(preview.ledger.default_currency)} para esta fila</option>` : ""}</select></div>`).join("");
  const totals = new Map();
  for (const row of source.movements) for (const effect of row.effects) {
    const key = `${row.currency}:${effect.sourceName}`;
    totals.set(key, (totals.get(key) ?? 0) + effect.amountMinor);
  }
  const balanceRows = [...totals].map(([key, minor]) => { const [currency, ...nameParts] = key.split(":"); return `<tr><td>${escapeHtml(nameParts.join(":"))}</td><td>${escapeHtml(formatMoney(minor, currency))}</td></tr>`; }).join("");
  return `<p class="eyebrow">Vista previa · ${escapeHtml(preview.fileName)}</p><h1>Revisá el archivo</h1><p>${source.movements.length} movimientos válidos · ${source.incidents.length} incidentes · ${source.summaries.length} filas de resumen.</p><section class="ledger-section"><h2>Saldos de filas válidas</h2><table class="balance-table"><tbody>${balanceRows}</tbody></table></section><form class="ledger-form" method="post" action="${base}/previews/${encodeURIComponent(preview.id)}/review">${csrf}<fieldset><legend>Personas del archivo</legend><div class="share-grid">${source.participantNames.map(options).join("")}</div></fieldset><fieldset><legend>Filas que necesitan una decisión</legend><p class="muted">Estas filas no se pueden importar automáticamente. Podés excluirlas o, cuando sólo falta la moneda, usar la moneda predeterminada del grupo. La decisión quedará registrada en el lote.</p>${incidentControls || "<p>No hay filas problemáticas.</p>"}</fieldset><button class="button" type="submit">Revisar saldos y decisiones</button></form><form method="post" action="${base}/previews/${encodeURIComponent(preview.id)}/cancel">${csrf}<button class="button secondary" type="submit">Cancelar importación</button></form>`;
}

export function renderImportReview({ spaceId, csrf, preview, plan, participants }) {
  const base = basePath(spaceId);
  const people = new Map(participants.map(person => [person.id, person.displayName]));
  const mapping = preview.parsed.participantNames.map((name, index) => `<li>${escapeHtml(name)} → ${escapeHtml(preview.review.mapping[index] === "new" ? "Participante nuevo" : people.get(preview.review.mapping[index]) ?? "Desconocido")}</li>`).join("");
  const balances = plan.totals.map(row => `<tr><td>${escapeHtml(row.sourceName)}</td><td>${escapeHtml(formatMoney(row.amountMinor, row.currency))}</td></tr>`).join("");
  const comparison = plan.reconciliation.map(row => `<tr><td>${escapeHtml(row.sourceName)}</td><td>${escapeHtml(row.currency)}</td><td>${escapeHtml(formatMoney(row.sourceMinor, row.currency))}</td><td>${escapeHtml(formatMoney(row.importedMinor, row.currency))}</td><td>${escapeHtml(formatMoney(row.differenceMinor, row.currency))}</td></tr>`).join("");
  const hasGap = plan.reconciliation.some(row => row.differenceMinor !== 0) || plan.warnings.length > 0;
  return `<p class="eyebrow">Confirmación · ${escapeHtml(preview.fileName)}</p><h1>Así quedará el libro</h1><p>${plan.rows.length} movimientos a importar. Ninguna fila de resumen se guarda como movimiento.</p><section class="ledger-section"><h2>Personas</h2><ul>${mapping}</ul></section><section class="ledger-section"><h2>Saldos a incorporar</h2><table class="balance-table"><tbody>${balances}</tbody></table></section><section class="ledger-section"><h2>Conciliación con el origen</h2>${comparison ? `<div class="table-scroll"><table class="balance-table"><thead><tr><th>Persona</th><th>Moneda</th><th>Origen</th><th>Importado</th><th>Diferencia</th></tr></thead><tbody>${comparison}</tbody></table></div>` : "<p>El archivo no tiene un resumen comparable.</p>"}${list(plan.warnings, warning => `<li>${escapeHtml(warning)}</li>`)}</section><section class="ledger-section"><h2>Supuestos</h2>${list(plan.assumptions, row => `<li>Fila ${row.line}: ${escapeHtml(row.assumption)}</li>`)}<h2>Filas excluidas</h2>${list(plan.excluded, row => `<li>Fila ${row.line}: ${escapeHtml(row.reason)}</li>`)}</section><form class="ledger-form" method="post" action="${base}/previews/${encodeURIComponent(preview.id)}/confirm">${csrf}${hasGap ? `<label class="check-row"><input type="checkbox" name="acknowledgeDifference" value="yes" required>Revisé la diferencia o la falta de saldo fuente</label>` : ""}<div class="form-actions"><button class="button" type="submit">Confirmar importación</button><a class="button secondary" href="${base}/previews/${encodeURIComponent(preview.id)}">Modificar decisiones</a></div></form>`;
}

export function renderImportBatch({ spaceId, batch }) {
  const reconciliation = batch.reconciliation.rows.map(row => `<li>${escapeHtml(row.sourceName)} · ${escapeHtml(row.currency)} · diferencia ${escapeHtml(formatMoney(row.differenceMinor, row.currency))}</li>`).join("");
  return `<p class="eyebrow">Splitwise · ${escapeHtml(batch.fileName)}</p><h1>Importación completada</h1><p>${batch.importedCount} movimientos importados el ${escapeHtml(batch.committedAt)}.</p><section class="ledger-section"><h2>Conciliación</h2>${reconciliation ? `<ul>${reconciliation}</ul>` : "<p>No había saldo fuente para comparar.</p>"}${list(batch.reconciliation.warnings, warning => `<li>${escapeHtml(warning)}</li>`)}</section><section class="ledger-section"><h2>Supuestos</h2>${list(batch.assumptions, row => `<li>Fila ${row.line}: ${escapeHtml(row.assumption)}</li>`)}<h2>Filas excluidas</h2>${list(batch.excluded, row => `<li>Fila ${row.line}: ${escapeHtml(row.reason)}</li>`)}</section><a class="button" href="/spaces/${encodeURIComponent(spaceId)}">Ver el libro</a>`;
}
