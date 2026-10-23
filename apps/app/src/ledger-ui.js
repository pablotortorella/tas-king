import { CURRENCY_MINOR_UNITS, currencyLabel, formatMoney, normalizeCurrency, parseMoney, splitEqually } from "./finance.js";
import { LedgerError } from "./ledger.js";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function path(spaceId) { return `/spaces/${encodeURIComponent(spaceId)}`; }
function option(value, label, selected) { return `<option value="${escapeHtml(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`; }
function selectedOptions(participants, selectedId) { return participants.filter(p => p.active).map(p => option(p.id, p.displayName, selectedId === p.id)).join(""); }
function entryLabel(type) { return ({ expense: "Gasto", income: "Ingreso", transfer: "Transferencia" })[type] ?? type; }

function revisionSummary(row, previous) {
  const snapshot = JSON.parse(row.snapshot_json);
  if (row.action === "created") return "Movimiento creado";
  if (row.action === "voided") return snapshot.reason ? `Motivo: ${snapshot.reason}` : "Sin motivo indicado";
  const before = previous ? JSON.parse(previous.snapshot_json) : {};
  const changed = [];
  for (const [key, label] of [["description", "descripción"], ["occurredAt", "fecha"], ["totalMinor", "importe"], ["currency", "moneda"], ["cashParties", "quién pagó o recibió"], ["allocations", "reparto"], ["note", "nota"]]) {
    if (JSON.stringify(snapshot[key]) !== JSON.stringify(before[key])) changed.push(label);
  }
  return changed.length ? `Cambió: ${changed.join(", ")}` : "Sin cambios de contenido";
}

function inputAmount(amountMinor, currency) {
  if (amountMinor === undefined) return "";
  const units = CURRENCY_MINOR_UNITS[currency];
  const scale = 10n ** BigInt(units);
  const amount = BigInt(amountMinor);
  return `${amount / scale}${units ? `.${String(amount % scale).padStart(units, "0")}` : ""}`;
}

export function parseEntryForm(form) {
  const type = form.get("type");
  const currency = normalizeCurrency(form.get("currency"));
  const totalMinor = parseMoney(form.get("amount"), currency);
  const description = form.get("description");
  const note = form.get("note") || "";
  const occurredAt = form.get("occurredAt");
  if (type === "transfer") {
    return { type, currency, totalMinor, description, note, occurredAt,
      cashParties: [
        { participantId: form.get("from"), direction: "out", amountMinor: totalMinor },
        { participantId: form.get("to"), direction: "in", amountMinor: totalMinor },
      ], allocations: [] };
  }
  if (type !== "expense" && type !== "income") throw new LedgerError("Tipo de movimiento inválido.");
  const beneficiaryIds = form.getAll("beneficiary");
  if (!beneficiaryIds.length) throw new LedgerError("Elegí al menos un participante.");
  const method = form.get("splitMethod");
  const allocations = method === "equal"
    ? splitEqually(totalMinor, beneficiaryIds).filter(share => share.amountMinor > 0)
    : method === "exact"
      ? beneficiaryIds.map(participantId => ({ participantId, amountMinor: parseMoney(form.get(`share_${participantId}`), currency) }))
      : (() => { throw new LedgerError("Reparto inválido."); })();
  return { type, currency, totalMinor, description, note, occurredAt,
    cashParties: [{ participantId: form.get("payer"), direction: type === "expense" ? "out" : "in", amountMinor: totalMinor }], allocations };
}

export function renderEntryForm(data, { spaceId, csrf, userId, type = "expense", entry = null }) {
  const edit = Boolean(entry);
  const currentType = entry?.type ?? type;
  const currency = entry?.currency ?? data.ledger.default_currency;
  const action = edit ? `${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/edit` : `${path(spaceId)}/ledger/entries`;
  const selected = new Set(entry?.allocations.map(share => share.participantId) ?? data.participants.filter(p => p.active).map(p => p.id));
  const shares = new Map(entry?.allocations.map(share => [share.participantId, share.amountMinor]) ?? []);
  const singleParty = entry?.cashParties.find(p => p.direction === (currentType === "income" ? "in" : "out"))?.participantId;
  const ownId = data.participants.find(p => p.linkedUserId === userId)?.id;
  const splitIds = data.participants.filter(p => selected.has(p.id)).map(p => p.id);
  const equallySplit = !entry || currentType === "transfer" || splitEqually(entry.totalMinor, splitIds).every(share => shares.get(share.participantId) === share.amountMinor);
  const fields = currentType === "transfer"
    ? `<div class="form-grid"><label>De<select name="from" required>${selectedOptions(data.participants, entry?.cashParties.find(p => p.direction === "out")?.participantId ?? ownId)}</select></label><label>Para<select name="to" required>${selectedOptions(data.participants, entry?.cashParties.find(p => p.direction === "in")?.participantId ?? data.participants.find(p => p.active && p.id !== ownId)?.id)}</select></label></div>`
    : `<label>${currentType === "income" ? "Recibió" : "Pagó"}<select name="payer" required>${selectedOptions(data.participants, singleParty ?? ownId)}</select></label><fieldset><legend>Se reparte entre</legend>${data.participants.filter(p => p.active || selected.has(p.id)).map(p => `<label class="check-row"><input type="checkbox" name="beneficiary" value="${escapeHtml(p.id)}"${selected.has(p.id) ? " checked" : ""}>${escapeHtml(p.displayName)}</label>`).join("")}</fieldset><fieldset><legend>Reparto</legend><label class="check-row"><input type="radio" name="splitMethod" value="equal"${equallySplit ? " checked" : ""}>Igual</label><label class="check-row"><input type="radio" name="splitMethod" value="exact"${equallySplit ? "" : " checked"}>Importes exactos</label><div class="share-grid">${data.participants.filter(p => p.active || selected.has(p.id)).map(p => `<label>${escapeHtml(p.displayName)}<input name="share_${escapeHtml(p.id)}" inputmode="decimal" placeholder="0,00" value="${escapeHtml(shares.has(p.id) ? inputAmount(shares.get(p.id), currency) : "")}"></label>`).join("")}</div></fieldset>`;
  return `<p class="eyebrow">${escapeHtml(entryLabel(currentType))} · ${escapeHtml(data.ledger.default_currency)}</p><h1>${edit ? "Corregir" : "Agregar"} ${escapeHtml(entryLabel(currentType).toLowerCase())}</h1><form class="ledger-form" method="post" action="${action}" data-optimistic>${csrf}<input type="hidden" name="type" value="${escapeHtml(currentType)}"><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}">${edit ? `<input type="hidden" name="expectedRevision" value="${entry.revision}">` : ""}<label>Descripción<input name="description" maxlength="240" required value="${escapeHtml(entry?.description ?? "")}" autofocus></label><div class="form-grid"><label>Importe<input name="amount" inputmode="decimal" required value="${escapeHtml(entry ? inputAmount(entry.totalMinor, currency) : "")}" placeholder="0,00"></label><label>Moneda<select name="currency">${Object.keys(CURRENCY_MINOR_UNITS).map(code => option(code, currencyLabel(code), code === currency)).join("")}</select></label><label>Fecha<input name="occurredAt" type="date" required value="${escapeHtml(entry?.occurredAt ?? new Date().toISOString().slice(0, 10))}"></label></div>${fields}<label>Nota (opcional)<textarea name="note" maxlength="1000" rows="2">${escapeHtml(entry?.note ?? "")}</textarea></label><div class="form-actions"><button class="button" type="submit">Guardar</button><a class="button secondary" href="${path(spaceId)}">Cancelar</a></div><p class="form-feedback" role="status" aria-live="polite"></p></form>`;
}

export function renderLedgerOverview(data, { spaceId, userId }) {
  const currencies = [...new Set([data.ledger.default_currency, ...data.balances.map(b => b.currency)])];
  const balanceRows = currencies.flatMap(currency => data.participants.map(p => {
    const amount = data.balances.find(b => b.currency === currency && b.participantId === p.id)?.amountMinor ?? 0;
    return `<tr><td>${escapeHtml(p.displayName)}</td><td>${escapeHtml(currency)}</td><td class="money ${amount < 0 ? "owes" : amount > 0 ? "owed" : ""}">${amount > 0 ? "Le deben " : amount < 0 ? "Debe " : ""}${escapeHtml(formatMoney(Math.abs(amount), currency))}</td></tr>`;
  })).join("");
  const rows = data.entries.map(entry => `<li class="entry-row ${entry.status === "voided" ? "entry-voided" : ""}"><a href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}"><span><strong>${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.occurredAt)} · ${escapeHtml(entryLabel(entry.type))} · ${escapeHtml(entry.creatorName)}${entry.status === "voided" ? " · Anulado" : ""}</small></span><strong class="money">${escapeHtml(formatMoney(entry.totalMinor, entry.currency))}</strong></a></li>`).join("");
  const people = data.participants.map(p => `<div class="person"><strong>${escapeHtml(p.displayName)}</strong><br><span class="muted">${p.linkedUserId ? "Cuenta vinculada" : "Sin cuenta"}${p.active ? "" : " · Inactivo"}</span></div>`).join("");
  return `<section class="ledger-section"><div class="section-top"><div><p class="eyebrow">Cuentas Claras</p><h2>Balances</h2></div><a class="button" href="${path(spaceId)}/ledger/new">Agregar movimiento</a></div><table class="balance-table"><thead><tr><th>Participante</th><th>Moneda</th><th>Saldo</th></tr></thead><tbody>${balanceRows}</tbody></table><div class="quick-actions"><a href="${path(spaceId)}/ledger/new?type=expense">Gasto</a><a href="${path(spaceId)}/ledger/new?type=income">Ingreso</a><a href="${path(spaceId)}/ledger/new?type=transfer">Transferencia</a></div></section><section class="ledger-section"><div class="section-top"><h2>Movimientos</h2><div class="export-actions"><a href="${path(spaceId)}/ledger/export.json">JSON</a><a href="${path(spaceId)}/ledger/export.csv">CSV</a></div></div>${rows ? `<ul class="entry-list">${rows}</ul>` : "<p>Todavía no hay movimientos.</p>"}</section><section class="ledger-section"><h2>Participantes</h2>${people}</section>`;
}

export function renderEntryDetail(entry, data, { spaceId, userId, revisions }) {
  const names = new Map(data.participants.map(p => [p.id, p.displayName]));
  const effects = entry.effects.map(effect => `<tr><td>${escapeHtml(names.get(effect.participantId) ?? "Participante")}</td><td class="money">${escapeHtml(formatMoney(effect.amountMinor, entry.currency))}</td></tr>`).join("");
  const history = revisions.map((row, index) => `<li>${escapeHtml(row.created_at)} · ${escapeHtml(row.actor_name)} · ${row.action === "created" ? "Creó" : row.action === "voided" ? "Anuló" : "Corrigió"} · versión ${row.revision}<br><span class="muted">${escapeHtml(revisionSummary(row, revisions[index - 1]))}</span></li>`).join("");
  const mayEdit = entry.status === "active" && (data.ledger.role === "owner" || entry.createdByUserId === userId);
  return `<p class="eyebrow">${escapeHtml(entryLabel(entry.type))} · ${escapeHtml(entry.occurredAt)}</p><h1>${escapeHtml(entry.description)}</h1><p class="entry-amount">${escapeHtml(formatMoney(entry.totalMinor, entry.currency))}${entry.status === "voided" ? " · Anulado" : ""}</p>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}<section class="ledger-section"><h2>${entry.status === "voided" ? "Efecto original, no vigente" : "Efecto en el saldo"}</h2><table class="balance-table"><tbody>${effects}</tbody></table></section><section class="ledger-section"><h2>Historial</h2><ol>${history}</ol></section>${mayEdit ? `<div class="form-actions"><a class="button" href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/edit">Corregir</a><a class="button secondary" href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/void">Anular</a></div>` : ""}<a class="button secondary" href="${path(spaceId)}">Volver al libro</a>`;
}

export function ledgerCsv(data) {
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [["id", "fecha", "tipo", "descripcion", "nota", "moneda", "total_menor", "estado", "revision", "participante_id", "efecto_menor"]];
  for (const entry of data.entries) for (const effect of entry.effects) lines.push([entry.id, entry.occurredAt, entry.type, entry.description, entry.note, entry.currency, entry.totalMinor, entry.status, entry.revision, effect.participantId, entry.status === "active" ? effect.amountMinor : 0]);
  return `\uFEFF${lines.map(row => row.map(quote).join(",")).join("\r\n")}\r\n`;
}
