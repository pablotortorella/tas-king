import { CURRENCY_MINOR_UNITS, currencyLabel, formatMoney, normalizeCurrency, parseMoney, splitEqually } from "./finance.js";
import { LedgerError } from "./errors.js";
import { escapeHtml, ICONS, shortDate, spacePath as path } from "./ui-parts.js";
import { searchable } from "./text.js";
import { categoryIcon } from "./category-data.js";
import { resolveCategory } from "./categories.js";
import { categoryOptionGroups } from "./category-options.js";

export { escapeHtml };

export function entryLabel(type) { return ({ expense: "Gasto", income: "Ingreso", transfer: "Transferencia" })[type] ?? type; }

export { filterByCategory, listResults, searchLedger } from "./search.js";

export function categoryChip(entry) {
  const info = entry.categoryInfo;
  if (info) return `<span class="chip cat">${categoryIcon(info.icon)}${escapeHtml(info.name)}</span>`;
  return entry.type === "transfer" ? "" : '<span class="chip cat none">Sin categoría</span>';
}

// Selector agrupado de categorías con un campo para escribir una nueva. Sin JavaScript funciona igual: el servidor compara
// lo escrito por su forma normalizada y usa la existente o crea la nueva. La categoría que ya tenía un movimiento se
// ofrece aunque esté archivada, para que corregirlo no la pierda.
function categorySection(data, entry) {
  const categories = data.categories ?? [];
  const current = entry?.categoryId ? categories.find(category => category.id === entry.categoryId) : null;
  const target = current ? resolveCategory(categories, current.id) : null;
  const keepArchived = current && target && target.status === "archived" ? target : null;
  const selectedId = target?.status === "active" ? target.id : keepArchived ? keepArchived.id : "";
  const option = (category, suffix = "") => `<option value="${escapeHtml(category.id)}" data-key="${escapeHtml(category.nameKey)}"${category.id === selectedId ? " selected" : ""}>${escapeHtml(category.name)}${suffix}</option>`;
  const groups = categoryOptionGroups(categories, { option: category => option(category) });
  const archived = keepArchived ? option(keepArchived, " (archivada)") : "";
  return `<fieldset class="category-field"><legend>Categoría (opcional)</legend><label>Elegí una<select name="categoryId"><option value="">Sin categoría</option>${archived}${groups}</select></label><label>O escribí una nueva<input name="categoryNew" maxlength="60" autocomplete="off" placeholder="Ej.: Peluquería"></label><p class="hint category-hint" role="status" aria-live="polite"></p></fieldset>`;
}

export function revisionSummary(row, previous) {
  const snapshot = JSON.parse(row.snapshot_json);
  if (row.action === "created") return "Movimiento creado";
  if (row.action === "voided") return snapshot.reason ? `Motivo: ${snapshot.reason}` : "Sin motivo indicado";
  const before = previous ? JSON.parse(previous.snapshot_json) : {};
  const changed = [];
  for (const [key, label] of [["description", "descripción"], ["occurredAt", "fecha"], ["totalMinor", "importe"], ["currency", "moneda"], ["cashParties", "quién pagó o recibió"], ["allocations", "reparto"], ["note", "nota"]]) {
    if (JSON.stringify(snapshot[key]) !== JSON.stringify(before[key])) changed.push(label);
  }
  // Los movimientos anteriores a este campo no guardan el método: sólo se compara cuando ambas revisiones lo tienen.
  if (before.split !== undefined && JSON.stringify(snapshot.split) !== JSON.stringify(before.split)) changed.push("forma de reparto");
  // La categoría se compara por identificador: renombrarla después no cuenta como un cambio de este movimiento.
  if ((snapshot.categoryId ?? null) !== (before.categoryId ?? null)) changed.push("categoría");
  return changed.length ? `Cambió: ${changed.join(", ")}` : "Sin cambios de contenido";
}

export function inputAmount(amountMinor, currency) {
  if (amountMinor === undefined) return "";
  const units = CURRENCY_MINOR_UNITS[currency];
  const scale = 10n ** BigInt(units);
  const amount = BigInt(amountMinor);
  return `${amount / scale}${units ? `.${String(amount % scale).padStart(units, "0")}` : ""}`;
}

// Prefijo del campo de cada persona según el método de reparto (el reparto igual no tiene campos).
export const SPLIT_INPUT_PREFIX = Object.freeze({ equal: "", exact: "share_", percent: "percent_", shares: "parts_", fixed: "fixed_" });

// Los pagadores que el formulario conserva tal cual (movimientos con varios pagadores). Deben seguir sumando el total.
function keptPayers(form, type, totalMinor) {
  const direction = type === "expense" ? "out" : "in";
  const parties = [];
  for (const [name, value] of form.entries()) {
    if (!name.startsWith("payerAmount_")) continue;
    const amountMinor = Number(value);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new LedgerError("Los pagadores del movimiento no son válidos.");
    parties.push({ participantId: name.slice("payerAmount_".length), direction, amountMinor });
  }
  if (!parties.length || parties.reduce((sum, party) => sum + party.amountMinor, 0) !== totalMinor) {
    throw new LedgerError("Cambiaste el importe de un movimiento con varios pagadores: elegí un solo pagador o dejá el importe como estaba.");
  }
  return parties;
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
  const beneficiaries = form.getAll("beneficiary");
  if (!beneficiaries.length) throw new LedgerError("Elegí al menos un participante.");
  const method = form.get("splitMethod");
  if (!Object.hasOwn(SPLIT_INPUT_PREFIX, method)) throw new LedgerError("Reparto inválido.");
  // El importe de cada persona lo calcula el servidor con la regla única (split.js); aquí sólo se leen los datos.
  const prefix = SPLIT_INPUT_PREFIX[method];
  const inputs = {};
  if (prefix) for (const participantId of beneficiaries) inputs[participantId] = String(form.get(`${prefix}${participantId}`) ?? "").trim();
  const payer = form.get("payer");
  const cashParties = payer === KEEP_PAYERS ? keptPayers(form, type, totalMinor) : [{ participantId: payer, direction: type === "expense" ? "out" : "in", amountMinor: totalMinor }];
  return { type, currency, totalMinor, description, note, occurredAt,
    categoryId: form.has("categoryId") ? String(form.get("categoryId")) : undefined, categoryName: form.has("categoryNew") ? String(form.get("categoryNew")) : undefined,
    split: { method, beneficiaries, inputs },
    cashParties, allocations: [] };
}

const TYPE_HINTS = Object.freeze({
  expense: "Alguien pagó algo que le correspondía a una o más personas.",
  income: "Alguien recibió dinero que le corresponde a una o más personas.",
  transfer: "Alguien le entregó dinero a otra persona. No es un gasto.",
});

function choice(input, label) { return `<label class="choice">${input}<span>${escapeHtml(label)}</span></label>`; }
function radioChoices(participants, name, selectedId, ownId) {
  return `<div class="choices">${participants.filter(p => p.active).map(p => choice(`<input type="radio" name="${name}" value="${escapeHtml(p.id)}"${selectedId === p.id ? " checked" : ""} required>`, personLabel(p, ownId))).join("")}</div>`;
}
export const KEEP_PAYERS = "__keep__";

// Quién pagó (o recibió). Un movimiento con varios pagadores (típico de una importación) no se puede representar con un
// solo botón: se ofrece «mantener los pagadores actuales», marcado por defecto, y sus importes viajan en campos ocultos para
// que corregir otra cosa no cambie los saldos sin que nadie lo note.
function payerFieldset({ type, entry, people, ownId, names, currency }) {
  const direction = type === "income" ? "in" : "out";
  const parties = entry?.cashParties.filter(party => party.direction === direction) ?? [];
  const legend = type === "income" ? "¿Quién recibió?" : "¿Quién pagó?";
  if (parties.length <= 1) return `<fieldset><legend>${legend}</legend>${radioChoices(people, "payer", parties[0]?.participantId ?? ownId, ownId)}</fieldset>`;
  const summary = parties.map(party => `${names.get(party.participantId) ?? "Participante"} ${formatMoney(party.amountMinor, currency)}`).join(" · ");
  const keep = choice(`<input type="radio" name="payer" value="${KEEP_PAYERS}" checked required>`, `Mantener los actuales: ${summary}`);
  const hidden = parties.map(party => `<input type="hidden" name="payerAmount_${escapeHtml(party.participantId)}" value="${party.amountMinor}">`).join("");
  const others = people.filter(person => person.active).map(person => choice(`<input type="radio" name="payer" value="${escapeHtml(person.id)}" required>`, `Solo ${personLabel(person, ownId)}`)).join("");
  return `<fieldset><legend>${legend}</legend><p class="hint">Este movimiento tiene varios (${parties.length}). Si lo dejás así, sus aportes no cambian.</p><div class="choices">${keep}${others}</div>${hidden}</fieldset>`;
}

function personLabel(person, ownId) { return person.id === ownId ? `${person.displayName} · vos` : person.displayName; }

const SPLIT_METHODS = Object.freeze([["equal", "Igual"], ["exact", "Importes exactos"], ["percent", "Porcentajes"], ["shares", "Partes"], ["fixed", "Algunos fijos"]]);
const SPLIT_HINTS = Object.freeze({
  equal: "Todas las personas elegidas pagan lo mismo.",
  exact: "Escribí cuánto le toca a cada persona. Deben sumar el total.",
  percent: "Escribí el porcentaje de cada persona. Deben sumar 100 %.",
  shares: "Dale a cada persona un número de partes, por ejemplo 2 adultos y 1 chico. Con 0 partes queda fuera.",
  fixed: "Quien tiene un importe fijo paga solo eso. El resto se reparte en partes iguales entre las demás personas elegidas.",
});

// Reparto de un gasto o ingreso: personas elegidas, atajo «lo debe todo», métodos y los campos de cada método.
// Cada persona lleva su posición en el grupo (data-order) para que la vista previa desempate como el servidor.
function splitSection({ data, visible, selected, ownId, method, inputs }) {
  const position = new Map(data.participants.map((person, index) => [person.id, index]));
  const chips = visible.map(p => choice(`<input type="checkbox" name="beneficiary" value="${escapeHtml(p.id)}" data-order="${position.get(p.id)}" data-name="${escapeHtml(p.displayName)}"${selected.has(p.id) ? " checked" : ""}>`, personLabel(p, ownId))).join("");
  const shortcut = visible.filter(p => p.active).map(p => `<button type="button" class="chip-button" data-all-to="${escapeHtml(p.id)}">Lo debe todo ${escapeHtml(p.displayName)}</button>`).join("");
  const methods = SPLIT_METHODS.map(([value, label]) => choice(`<input type="radio" name="splitMethod" value="${value}"${method === value ? " checked" : ""}>`, label)).join("");
  const hints = SPLIT_METHODS.map(([value]) => `<p class="hint method-hint method-${value}">${SPLIT_HINTS[value]}</p>`).join("");
  const group = (name, prefix, placeholder, fallback, unit) => `<div class="share-grid method-fields method-${name}">${visible.map(p => `<label>${escapeHtml(personLabel(p, ownId))}${unit ? ` <span class="unit">${unit}</span>` : ""}<input name="${prefix}${escapeHtml(p.id)}" inputmode="decimal" placeholder="${placeholder}" value="${escapeHtml(method === name ? inputs[p.id] ?? "" : fallback)}" autocomplete="off"></label>`).join("")}</div>`;
  return `<fieldset><legend>¿Entre quiénes se reparte?</legend><div class="choices">${chips}</div><div class="all-to" hidden><span class="lead">Atajo:</span>${shortcut}</div></fieldset><fieldset><legend>¿Cómo se reparte?</legend><div class="choices">${methods}</div>${hints}${group("exact", "share_", "0,00", "")}${group("percent", "percent_", "0", "", "%")}${group("shares", "parts_", "1", "1", "partes")}${group("fixed", "fixed_", "Resto igual", "")}</fieldset>`;
}

export function renderEntryForm(data, { spaceId, csrf, userId, type = "expense", entry = null, prefill = {}, split = null }) {
  const edit = Boolean(entry);
  const currentType = entry?.type ?? type;
  const currency = entry?.currency ?? prefill.currency ?? data.ledger.default_currency;
  const ownId = data.participants.find(p => p.linkedUserId === userId)?.id;
  const people = [...data.participants].sort((a, b) => Number(b.id === ownId) - Number(a.id === ownId));
  const action = edit ? `${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/edit` : `${path(spaceId)}/ledger/entries`;
  // Un movimiento que conserva su método se reabre con él; uno anterior se deduce como igual o exacto.
  const spec = split && SPLIT_METHODS.some(([value]) => value === split.method) ? split : null;
  const selected = new Set(spec?.beneficiaries ?? entry?.allocations.map(share => share.participantId) ?? data.participants.filter(p => p.active).map(p => p.id));
  const shares = new Map(entry?.allocations.map(share => [share.participantId, share.amountMinor]) ?? []);
  const splitIds = people.filter(p => selected.has(p.id)).map(p => p.id);
  const equallySplit = !entry || currentType === "transfer" || splitEqually(entry.totalMinor, splitIds).every(share => shares.get(share.participantId) === share.amountMinor);
  const visible = people.filter(p => p.active || selected.has(p.id));
  const method = spec?.method ?? (equallySplit ? "equal" : "exact");
  const inputs = spec?.inputs ?? Object.fromEntries([...shares].map(([id, amount]) => [id, inputAmount(amount, currency)]));
  const fields = currentType === "transfer"
    ? `<fieldset><legend>De</legend>${radioChoices(people, "from", entry?.cashParties.find(p => p.direction === "out")?.participantId ?? prefill.from ?? ownId, ownId)}</fieldset><fieldset><legend>Para</legend>${radioChoices(people, "to", entry?.cashParties.find(p => p.direction === "in")?.participantId ?? prefill.to ?? people.find(p => p.active && p.id !== (prefill.from ?? ownId))?.id, ownId)}</fieldset>`
    : `${payerFieldset({ type: currentType, entry, people, ownId, names: new Map(data.participants.map(p => [p.id, p.displayName])), currency })}${categorySection(data, entry)}${splitSection({ data, visible, selected, ownId, method, inputs })}`;
  const tabs = edit ? "" : `<nav class="type-tabs" aria-label="Tipo de movimiento">${["expense", "income", "transfer"].map(kind => `<a href="${path(spaceId)}/ledger/new?type=${kind}"${kind === currentType ? ' aria-current="page"' : ""}>${ICONS[kind].replace('width="22" height="22"', 'width="18" height="18"')}${escapeHtml(entryLabel(kind))}</a>`).join("")}</nav>`;
  const label = entryLabel(currentType).toLowerCase();
  return `<a class="back-link" href="${path(spaceId)}">← Volver</a><p class="eyebrow">${escapeHtml(entryLabel(currentType))} · ${escapeHtml(data.ledger.default_currency)}</p><h1>${edit ? "Corregir" : "Agregar"} ${escapeHtml(label)}</h1>${tabs}<p class="hint">${escapeHtml(TYPE_HINTS[currentType] ?? "")}</p><form class="ledger-form" method="post" action="${action}" data-optimistic>${csrf}<input type="hidden" name="type" value="${escapeHtml(currentType)}"><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}">${edit ? `<input type="hidden" name="expectedRevision" value="${entry.revision}">` : ""}<label>Descripción<input name="description" maxlength="240" required value="${escapeHtml(entry?.description ?? "")}" autofocus autocomplete="off"></label><div class="form-grid amount-row"><label>Importe<input class="amount-input" name="amount" inputmode="decimal" required value="${escapeHtml(entry ? inputAmount(entry.totalMinor, currency) : prefill.amount ?? "")}" placeholder="0,00" autocomplete="off"></label><label>Moneda<select name="currency">${Object.keys(CURRENCY_MINOR_UNITS).map(code => `<option value="${code}" data-units="${CURRENCY_MINOR_UNITS[code]}"${code === currency ? " selected" : ""}>${escapeHtml(currencyLabel(code))}</option>`).join("")}</select></label></div><label>Fecha<input name="occurredAt" type="date" required value="${escapeHtml(entry?.occurredAt ?? new Date().toISOString().slice(0, 10))}"></label>${fields}<label>Nota (opcional)<textarea name="note" maxlength="1000" rows="2">${escapeHtml(entry?.note ?? "")}</textarea></label><section class="effect-preview" aria-live="polite" hidden><h3>Cómo queda este movimiento</h3><ul></ul><p class="preview-note hint"></p></section><p class="form-feedback" role="status" aria-live="polite"></p><div class="form-actions sticky-actions"><button class="button" type="submit">${edit ? "Guardar cambios" : `Guardar ${escapeHtml(label)}`}</button><a class="button secondary" href="${path(spaceId)}">Cancelar</a></div></form>`;
}

function bare(amountMinor, currency) { return formatMoney(amountMinor, currency).replace(`${currency} `, ""); }
function signedBare(amountMinor, currency) { return `${amountMinor > 0 ? "+" : ""}${bare(amountMinor, currency)}`; }
function effectClass(amountMinor) { return amountMinor > 0 ? "owed" : amountMinor < 0 ? "owes" : ""; }

function stamp(createdAt) {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/u.exec(String(createdAt));
  return match ? `${shortDate(match[1])}, ${match[2]} UTC` : String(createdAt);
}

function splitTable(entry, data) {
  const currency = entry.currency;
  const cash = (participantId, direction) => entry.cashParties.filter(p => p.participantId === participantId && p.direction === direction).reduce((sum, p) => sum + p.amountMinor, 0);
  const share = participantId => entry.allocations.find(p => p.participantId === participantId)?.amountMinor ?? 0;
  const effect = participantId => entry.effects.find(p => p.participantId === participantId)?.amountMinor ?? 0;
  const transfer = entry.type === "transfer";
  const heads = transfer ? ["Entregó", "Recibió"] : [entry.type === "income" ? "Recibió" : "Pagó", "Le toca"];
  const columns = transfer ? [id => cash(id, "out"), id => cash(id, "in")] : [id => cash(id, entry.type === "income" ? "in" : "out"), share];
  const involved = data.participants.filter(p => entry.effects.some(row => row.participantId === p.id) || entry.cashParties.some(row => row.participantId === p.id));
  const body = involved.map(p => `<tr><td>${escapeHtml(p.displayName)}</td><td class="money">${escapeHtml(bare(columns[0](p.id), currency))}</td><td class="money">${escapeHtml(bare(columns[1](p.id), currency))}</td><td class="money ${effectClass(effect(p.id))}">${escapeHtml(signedBare(effect(p.id), currency))}</td></tr>`).join("");
  const sums = columns.map(column => involved.reduce((total, p) => total + column(p.id), 0));
  return `<div class="table-scroll"><table class="balance-table split"><caption class="sr-only">Reparto del movimiento</caption><thead><tr><th scope="col">Persona</th><th scope="col">${heads[0]}</th><th scope="col">${heads[1]}</th><th scope="col">Efecto</th></tr></thead><tbody>${body}</tbody><tfoot><tr class="split-total"><td>Suma</td><td class="money">${escapeHtml(bare(sums[0], currency))}</td><td class="money">${escapeHtml(bare(sums[1], currency))}</td><td class="money">${escapeHtml(bare(involved.reduce((total, p) => total + effect(p.id), 0), currency))}</td></tr></tfoot></table></div><p class="footnote">Importes en ${escapeHtml(currency)}.</p>`;
}

function splitNote(entry, data) {
  if (entry.type === "transfer") return "";
  const names = new Map(data.participants.map(p => [p.id, p.displayName]));
  const ids = entry.allocations.map(share => share.participantId);
  const equal = splitEqually(entry.totalMinor, ids).every(share => entry.allocations.find(row => row.participantId === share.participantId)?.amountMinor === share.amountMinor);
  const absent = data.participants.filter(p => p.active && !ids.includes(p.id)).map(p => names.get(p.id));
  return `<p class="footnote">${equal ? `Reparto igual entre ${ids.length} ${ids.length === 1 ? "persona" : "personas"}.` : "Reparto con importes exactos."}${absent.length ? ` ${escapeHtml(absent.join(" y "))} no ${absent.length === 1 ? "participa" : "participan"}.` : ""}</p>`;
}

// Origen de un movimiento importado: archivo, fila y, si el pagador y el reparto se dedujeron, cómo corregirlos.
function provenance(entry, spaceId) {
  if (!entry.importBatchId) return "";
  const inferred = entry.inferred ? '<p class="hint inferred">El pagador y el reparto se dedujeron de los saldos del archivo. Si no coinciden con lo que pasó, corregilos: el efecto original no cambia hasta que lo hagas.</p>' : "";
  return `<p class="entry-origin"><span class="chip imp">Importado de Splitwise · fila ${escapeHtml(entry.sourceRowNumber)}</span> <a href="${path(spaceId)}/ledger/import/batches/${encodeURIComponent(entry.importBatchId)}">Ver el lote</a></p>${inferred}`;
}

// Las revisiones que vienen de una recategorización en lote lo indican en el historial.
function batchMark(row) {
  try { return JSON.parse(row.snapshot_json).recategorizationBatch ? " · recategorización en lote" : ""; } catch { return ""; }
}

export function renderEntryDetail(entry, data, { spaceId, userId, revisions }) {
  const names = new Map(data.participants.map(p => [p.id, p.displayName]));
  const back = `<a class="back-link" href="${path(spaceId)}">← Volver al libro</a>`;
  const voided = entry.status === "voided";
  const creator = entry.createdByUserId === userId ? "vos" : entry.creatorName;
  const list = direction => entry.cashParties.filter(p => p.direction === direction).map(p => names.get(p.participantId) ?? "Participante").join(", ");
  const who = entry.type === "expense" ? `pagó ${list("out")}` : entry.type === "income" ? `recibió ${list("in")}` : `${list("out")} → ${list("in")}`;
  const history = [...revisions].map((row, index) => `<li><strong>Revisión ${row.revision} · ${escapeHtml(row.actor_name)} ${row.action === "created" ? "creó el movimiento" : row.action === "voided" ? "anuló el movimiento" : "corrigió el movimiento"}</strong><br><span class="muted">${escapeHtml(revisionSummary(row, revisions[index - 1]))}${batchMark(row)} · ${escapeHtml(stamp(row.created_at))}</span></li>`).reverse().join("");
  const mayEdit = entry.status === "active" && (data.ledger.role === "owner" || entry.createdByUserId === userId);
  const actions = mayEdit ? `<div class="detail-actions"><a class="button secondary" href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/edit">Corregir</a><a class="button danger" href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}/void">Anular</a></div><p class="footnote">Anular no borra: queda visible como anulado y deja de contar en los saldos.</p>` : "";
  return `${back}<div class="badges"><span class="chip ${voided ? "void" : "ok"}">${escapeHtml(entryLabel(entry.type))}</span><span class="chip">${voided ? "Anulado" : "Vigente"} · revisión ${entry.revision}</span></div><h1>${escapeHtml(entry.description)}</h1><p class="entry-amount">${escapeHtml(formatMoney(entry.totalMinor, entry.currency))}${voided ? " · Anulado" : ""}</p>${provenance(entry, spaceId)}${entry.type === "transfer" ? "" : `<p class="entry-category">${categoryChip(entry)}${entry.categoryInfo ? ` <span class="muted">${escapeHtml(entry.categoryInfo.group)}</span>` : ""}</p>`}<p class="muted">${escapeHtml(shortDate(entry.occurredAt))} · ${escapeHtml(who)} · Cargado por ${escapeHtml(creator)}</p>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}<section class="ledger-section"><h2>${voided ? "Efecto original, no vigente" : "Cómo se repartió"}</h2>${splitTable(entry, data)}${splitNote(entry, data)}</section><section class="ledger-section"><h2>Historial</h2><ol class="timeline">${history}</ol></section>${actions}`;
}
export function ledgerCsv(data) {
  const quote = value => {
    const text = String(value ?? "");
    const safe = typeof value === "string" && /^[\s]*[=+@-]/u.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [["id", "fecha", "tipo", "descripcion", "nota", "moneda", "total_menor", "estado", "revision", "participante_id", "efecto_menor", "origen", "lote", "fila_origen", "categoria"]];
  for (const entry of data.entries) for (const effect of entry.effects) lines.push([entry.id, entry.occurredAt, entry.type, entry.description, entry.note, entry.currency, entry.totalMinor, entry.status, entry.revision, effect.participantId, entry.status === "active" ? effect.amountMinor : 0, entry.importBatchId ? "Splitwise" : "HomeSuite", entry.importBatchId ?? "", entry.sourceRowNumber ?? "", entry.categoryInfo?.name ?? ""]);
  return `\uFEFF${lines.map(row => row.map(quote).join(",")).join("\r\n")}\r\n`;
}
