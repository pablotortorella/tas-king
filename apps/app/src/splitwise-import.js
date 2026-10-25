import { categoryResolver, findCategoryByName, readCategories } from "./categories.js";
import { IMPORTED_GROUP } from "./category-data.js";
import { getLedgerAccess, LedgerError } from "./ledger.js";
import { inferComponents, mergeEffects } from "./import-infer.js";
import { sha256Hex } from "./hash.js";
import { createPlatformId } from "./platform.js";
import { defaultLayout, parseMovement, parseSignedMinor, parseSplitwiseCsv, SplitwiseCsvError } from "./splitwise-csv.js";
import { searchable } from "./text.js";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
// Filas que se cargan por petición. Cada tanda escribe seis sentencias (una por tabla) sobre un JSON, así que el costo
// por petición es casi constante; el valor se fijó midiendo con D1 local (ver CASO-REAL-INTERNO.md).
export const IMPORT_CHUNK = 100;
// Filas del archivo por sentencia al guardar la vista previa.
const PREVIEW_ROW_CHUNK = 150;
export const INCIDENTS_PAGE_SIZE = 25;
const DECISIONS = new Set(["exclude", "assume_default"]);


function assertOwner(ledger, message = "Sólo el titular puede importar.") {
  if (ledger.role !== "owner") throw new LedgerError(message, 403);
}

// ---------------------------------------------------------------------------------------------------------------
// Filas del archivo: se guardan una por línea para no depender del tamaño total y poder paginar.

function rowRecords(parsed) {
  return [
    ...parsed.movements.map(row => ({ line: row.line, kind: "movement", payload: { occurredAt: row.occurredAt, description: row.description, category: row.category, currency: row.currency, totalMinor: row.totalMinor, amounts: row.effects.map(effect => effect.amountMinor), note: row.note ?? "" } })),
    ...parsed.incidents.map(row => ({ line: row.line, kind: "incident", payload: { reason: row.reason, code: row.code, cells: row.cells } })),
    ...parsed.summaries.map(row => ({ line: row.line, kind: "summary", payload: { currency: row.currency, rawEffects: row.rawEffects } })),
  ].sort((a, b) => a.line - b.line);
}

function insertRowsStatements(db, ownerId, records) {
  const statements = [];
  for (let start = 0; start < records.length; start += PREVIEW_ROW_CHUNK) {
    statements.push(db.prepare("INSERT INTO splitwise_import_rows (owner_id, line, kind, payload_json) SELECT ?, json_extract(value, '$.line'), json_extract(value, '$.kind'), json_extract(value, '$.payload') FROM json_each(?)").bind(ownerId, JSON.stringify(records.slice(start, start + PREVIEW_ROW_CHUNK))));
  }
  return statements;
}

// Reconstruye el resultado del parser con todas las filas de una vista previa o de un lote.
export async function loadParsed(db, ownerId, meta) {
  const rows = (await db.prepare("SELECT line, kind, payload_json FROM splitwise_import_rows WHERE owner_id = ? ORDER BY line").bind(ownerId).all()).results;
  const names = meta.participantNames;
  const parsed = { participantNames: names, layout: meta.layout ?? defaultLayout(names), movements: [], incidents: [], summaries: [], totalRows: meta.totalRows };
  for (const row of rows) {
    const payload = JSON.parse(row.payload_json);
    if (row.kind === "movement") parsed.movements.push({ line: row.line, occurredAt: payload.occurredAt, description: payload.description, category: payload.category, currency: payload.currency, totalMinor: payload.totalMinor, note: payload.note, effects: payload.amounts.map((amountMinor, index) => ({ sourceName: names[index], amountMinor })) });
    else if (row.kind === "incident") parsed.incidents.push({ line: row.line, reason: payload.reason, code: payload.code, cells: payload.cells });
    else parsed.summaries.push({ line: row.line, currency: payload.currency, rawEffects: payload.rawEffects });
  }
  return parsed;
}

// ---------------------------------------------------------------------------------------------------------------
// Plan: resultado de aplicar el mapeo y las decisiones al archivo, sin escribir nada.

export function buildImportPlan(parsed, review, defaultCurrency) {
  const decisions = review?.decisions ?? {};
  if (!review || !Array.isArray(review.mapping) || review.mapping.length !== parsed.participantNames.length || parsed.incidents.some(incident => !DECISIONS.has(decisions[incident.line]))) {
    throw new LedgerError("Completá el mapeo y la decisión para cada incidente.");
  }
  const layout = parsed.layout ?? defaultLayout(parsed.participantNames);
  const rows = [...parsed.movements];
  const assumptions = [];
  const excluded = [];
  for (const incident of parsed.incidents) {
    const decision = decisions[incident.line];
    if (decision === "exclude") { excluded.push({ line: incident.line, reason: incident.reason }); continue; }
    if (decision === "assume_default" && incident.code === "missing_currency") {
      try { rows.push(parseMovement(incident.cells, parsed.participantNames, incident.line, defaultCurrency, layout)); }
      catch (error) { throw new LedgerError(`La fila ${incident.line} sigue siendo inválida: ${error.message}`); }
      assumptions.push({ line: incident.line, assumption: `Moneda ${defaultCurrency} elegida explícitamente` });
      continue;
    }
    throw new LedgerError(`La fila ${incident.line} necesita una decisión válida.`);
  }
  if (!rows.length) throw new LedgerError("No quedan movimientos para importar.");
  rows.sort((a, b) => a.line - b.line);
  // Con el mapeo elegido, cada fila debe poder representarse como un gasto: se comprueba antes de confirmar para que
  // la carga no falle a la mitad.
  const placeholders = review.mapping.map((choice, index) => (choice === "new" ? `new:${index}` : choice));
  for (const row of rows) {
    const result = inferComponents({ totalMinor: row.totalMinor, effects: mergeEffects(row.effects.map(effect => effect.amountMinor), placeholders), fallbackParticipantId: placeholders[0] });
    if (!result.ok) throw new LedgerError(`La fila ${row.line} no se puede importar con este mapeo: ${result.reason}`);
  }
  const currencies = [...new Set(rows.map(row => row.currency))];
  const totals = new Map();
  for (const row of rows) for (const effect of row.effects) {
    const key = `${row.currency}:${effect.sourceName}`;
    const next = (totals.get(key) ?? 0) + effect.amountMinor;
    if (!Number.isSafeInteger(next)) throw new LedgerError("Un saldo importado excede el rango permitido.");
    totals.set(key, next);
  }
  const reconciliation = [];
  const warnings = [];
  for (const summary of parsed.summaries) {
    const currency = summary.currency || (currencies.length === 1 ? currencies[0] : null);
    if (!currency) { warnings.push(`Fila ${summary.line}: el resumen no indica moneda y el archivo tiene varias.`); continue; }
    for (const effect of summary.rawEffects) {
      try {
        const sourceMinor = parseSignedMinor(effect.raw, currency);
        const importedMinor = totals.get(`${currency}:${effect.sourceName}`) ?? 0;
        reconciliation.push({ line: summary.line, currency, sourceName: effect.sourceName, sourceMinor, importedMinor, differenceMinor: importedMinor - sourceMinor });
      } catch (error) { warnings.push(`Fila ${summary.line}: el saldo de ${effect.sourceName} no se pudo comparar (${error.message}).`); }
    }
  }
  if (!parsed.summaries.length) warnings.push("El archivo no incluye una fila de saldos para comparar.");
  const longNames = new Set(rows.filter(row => row.category.trim().length > CATEGORY_NAME_LIMIT).map(row => row.category.trim()));
  if (longNames.size) warnings.push(`${longNames.size} ${longNames.size === 1 ? "categoría tiene" : "categorías tienen"} más de ${CATEGORY_NAME_LIMIT} caracteres y se acortan al importar.`);
  return { rows, assumptions, excluded, totals: [...totals].map(([key, amountMinor]) => { const separator = key.indexOf(":"); return { currency: key.slice(0, separator), sourceName: key.slice(separator + 1), amountMinor }; }), reconciliation, warnings };
}

// ---------------------------------------------------------------------------------------------------------------
// Vista previa

export async function createImportPreview(db, { spaceId, userId, fileName, csvText }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  assertOwner(ledger);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  if (typeof csvText !== "string" || new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES) throw new LedgerError("El CSV debe medir como máximo 2 MiB.", 413);
  let parsed;
  try { parsed = parseSplitwiseCsv(csvText); }
  catch (error) { if (error instanceof SplitwiseCsvError) throw new LedgerError(error.message); throw error; }
  const sourceHash = await sha256Hex(csvText);
  const existing = await db.prepare("SELECT id, status FROM splitwise_import_batches WHERE ledger_id = ? AND source_hash = ?").bind(ledger.id, sourceHash).first();
  if (existing) return { batchId: existing.id };
  const id = createPlatformId("preview");
  const cleanName = typeof fileName === "string" ? fileName.slice(0, 240) : "splitwise.csv";
  const meta = { participantNames: parsed.participantNames, layout: parsed.layout, totalRows: parsed.totalRows, counts: { movements: parsed.movements.length, incidents: parsed.incidents.length, summaries: parsed.summaries.length } };
  await db.batch([
    db.prepare("INSERT INTO splitwise_import_previews (id, ledger_id, actor_user_id, source_hash, file_name, parsed_json) VALUES (?, ?, ?, ?, ?, ?)").bind(id, ledger.id, userId, sourceHash, cleanName, JSON.stringify(meta)),
    ...insertRowsStatements(db, id, rowRecords(parsed)),
  ]);
  return { previewId: id };
}

export async function readImportPreview(db, { spaceId, userId, previewId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  assertOwner(ledger, "Sólo el titular puede revisar importaciones.");
  const row = await db.prepare("SELECT * FROM splitwise_import_previews WHERE id = ? AND ledger_id = ? AND actor_user_id = ? AND expires_at > CURRENT_TIMESTAMP").bind(previewId, ledger.id, userId).first();
  if (!row) throw new LedgerError("La previsualización venció. Volvé a cargar el archivo.", 404);
  return { ledger, id: row.id, batchId: row.batch_id, sourceHash: row.source_hash, fileName: row.file_name, meta: JSON.parse(row.parsed_json), review: row.review_json ? JSON.parse(row.review_json) : null };
}

// Totales por persona y las filas problemáticas de una página, sin cargar el archivo completo en la vista.
export async function readPreviewSummary(db, previewId, meta, { page = 1 } = {}) {
  const pages = Math.max(1, Math.ceil(meta.counts.incidents / INCIDENTS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const incidents = (await db.prepare("SELECT line, payload_json FROM splitwise_import_rows WHERE owner_id = ? AND kind = 'incident' ORDER BY line LIMIT ? OFFSET ?").bind(previewId, INCIDENTS_PAGE_SIZE, (current - 1) * INCIDENTS_PAGE_SIZE).all()).results.map(row => ({ line: row.line, ...JSON.parse(row.payload_json) }));
  const balances = [];
  for (const [index, name] of meta.participantNames.entries()) {
    const rows = (await db.prepare("SELECT json_extract(payload_json, '$.currency') AS currency, SUM(json_extract(payload_json, ?)) AS amount FROM splitwise_import_rows WHERE owner_id = ? AND kind = 'movement' GROUP BY 1 ORDER BY 1").bind(`$.amounts[${index}]`, previewId).all()).results;
    for (const row of rows) balances.push({ sourceName: name, currency: row.currency, amountMinor: row.amount });
  }
  return { incidents, balances, page: current, pages };
}

async function validateMapping(db, ledgerId, names, mapping) {
  if (!Array.isArray(mapping) || mapping.length !== names.length) throw new LedgerError("Mapeá todas las personas del archivo.");
  const participants = await db.prepare("SELECT id FROM ledger_participants WHERE ledger_id = ? AND active = 1 AND pending_import_batch_id IS NULL").bind(ledgerId).all();
  const available = new Set(participants.results.map(row => row.id));
  for (const choice of mapping) if (choice !== "new" && !available.has(choice)) throw new LedgerError("El mapeo contiene un participante ajeno o inactivo.");
}

async function assertNoOverlap(db, ledgerId, rows) {
  // Los movimientos importados no cuentan como propios: un libro con un lote publicado puede recibir movimientos nuevos.
  const firstNative = await db.prepare("SELECT MIN(occurred_at) AS first_date FROM ledger_entries WHERE ledger_id = ? AND status = 'active' AND import_batch_id IS NULL").bind(ledgerId).first();
  if (firstNative?.first_date && rows.some(row => row.occurredAt >= firstNative.first_date)) {
    throw new LedgerError(`El archivo se solapa con movimientos nuevos desde ${firstNative.first_date}. Revisá el corte de fechas antes de importar.`, 409);
  }
}

// Guarda el mapeo y las decisiones. Con partial=true acepta decisiones incompletas (para paginar los incidentes sin
// perder lo ya decidido); sin partial exige todo y devuelve el plan.
export async function reviewImportPreview(db, { spaceId, userId, previewId, mapping, decisions = {}, partial = false }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  await validateMapping(db, preview.ledger.id, preview.meta.participantNames, mapping);
  const saved = preview.review?.decisions ?? {};
  const merged = { ...saved };
  for (const [line, choice] of Object.entries(decisions)) {
    if (choice === "" || choice === null || choice === undefined) continue;
    if (!DECISIONS.has(choice)) throw new LedgerError("Decisión inválida.");
    merged[line] = choice;
  }
  const validLines = new Set((await db.prepare("SELECT line FROM splitwise_import_rows WHERE owner_id = ? AND kind = 'incident'").bind(previewId).all()).results.map(row => String(row.line)));
  for (const line of Object.keys(merged)) if (!validLines.has(line)) delete merged[line];
  const review = { mapping, decisions: merged };
  if (partial) {
    await db.prepare("UPDATE splitwise_import_previews SET review_json = ? WHERE id = ? AND ledger_id = ?").bind(JSON.stringify(review), previewId, preview.ledger.id).run();
    return { preview: { ...preview, review }, plan: null };
  }
  if (validLines.size > Object.keys(merged).length) throw new LedgerError(`Faltan decisiones: ${validLines.size - Object.keys(merged).length} fila(s) sin resolver.`);
  const parsed = await loadParsed(db, previewId, preview.meta);
  const plan = buildImportPlan(parsed, review, preview.ledger.default_currency);
  await assertNoOverlap(db, preview.ledger.id, plan.rows);
  await db.prepare("UPDATE splitwise_import_previews SET review_json = ? WHERE id = ? AND ledger_id = ?").bind(JSON.stringify(review), previewId, preview.ledger.id).run();
  return { preview: { ...preview, review }, plan };
}

export async function readImportPlan(db, { spaceId, userId, previewId }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  if (preview.batchId) throw new LedgerError("Esta importación ya se confirmó.", 409);
  if (!preview.review) throw new LedgerError("Revisá el archivo antes de confirmar.");
  const parsed = await loadParsed(db, previewId, preview.meta);
  return { preview, plan: buildImportPlan(parsed, preview.review, preview.ledger.default_currency) };
}

export async function cancelImportPreview(db, { spaceId, userId, previewId }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  if (preview.batchId) throw new LedgerError("Esta importación ya se confirmó: cancelala desde su pantalla de avance.", 409);
  await db.batch([
    db.prepare("DELETE FROM splitwise_import_rows WHERE owner_id = ?").bind(previewId),
    db.prepare("DELETE FROM splitwise_import_previews WHERE id = ? AND ledger_id = ?").bind(previewId, preview.ledger.id),
  ]);
}

// ---------------------------------------------------------------------------------------------------------------
// Lote: confirmar crea el lote pendiente; cargar escribe por tandas ocultas; publicar las muestra todas de una vez.

// Descarta un lote pendiente con todo lo que cargó. La usan el botón de cancelar y el mantenimiento diario.
export async function discardImportBatch(db, batchId) {
  const owned = "(ledger_id, entry_id) IN (SELECT ledger_id, id FROM ledger_entries WHERE import_batch_id = ?)";
  await db.batch([
    db.prepare("DELETE FROM import_source_rows WHERE batch_id = ?").bind(batchId),
    db.prepare(`DELETE FROM entry_allocations WHERE ${owned}`).bind(batchId),
    db.prepare(`DELETE FROM entry_cash_parties WHERE ${owned}`).bind(batchId),
    db.prepare(`DELETE FROM entry_revisions WHERE ${owned}`).bind(batchId),
    db.prepare("DELETE FROM ledger_entries WHERE import_batch_id = ?").bind(batchId),
    db.prepare("DELETE FROM splitwise_import_rows WHERE owner_id = ?").bind(batchId),
    db.prepare("DELETE FROM ledger_participants WHERE pending_import_batch_id = ?").bind(batchId),
    db.prepare("DELETE FROM ledger_categories WHERE pending_import_batch_id = ?").bind(batchId),
    db.prepare("DELETE FROM splitwise_import_batches WHERE id = ? AND status = 'pending'").bind(batchId),
  ]);
}

// Un nombre de categoría del libro admite 60 caracteres; el archivo puede traer más. Se acorta de forma uniforme (al
// crear y al buscar) y el plan lo advierte, así nada se pierde en silencio.
const CATEGORY_NAME_LIMIT = 60;
const importedCategoryName = text => String(text ?? "").trim().slice(0, CATEGORY_NAME_LIMIT).trim();

function newCategories(rows, existing) {
  const known = new Set(existing.map(category => category.nameKey));
  const wanted = new Map();
  for (const row of rows) {
    const name = importedCategoryName(row.category);
    const key = searchable(name);
    if (key && !known.has(key) && !wanted.has(key)) wanted.set(key, name);
  }
  return [...wanted].map(([nameKey, name]) => ({ name, name_key: nameKey }));
}

export async function confirmImportPreview(db, { spaceId, userId, previewId, acknowledgeDifference = false }) {
  // Repetir la confirmación (doble clic, reintento) devuelve el lote que ya creó esa vista previa.
  const confirmed = await readImportPreview(db, { spaceId, userId, previewId });
  if (confirmed.batchId) return confirmed.batchId;
  const { preview, plan } = await readImportPlan(db, { spaceId, userId, previewId });
  await validateMapping(db, preview.ledger.id, preview.meta.participantNames, preview.review.mapping);
  await assertNoOverlap(db, preview.ledger.id, plan.rows);
  if ((plan.reconciliation.some(item => item.differenceMinor !== 0) || plan.warnings.length) && !acknowledgeDifference) {
    throw new LedgerError("Confirmá que viste las diferencias o la falta de saldo fuente.");
  }
  const ledgerId = preview.ledger.id;
  const existing = await db.prepare("SELECT id, source_hash, status FROM splitwise_import_batches WHERE ledger_id = ?").bind(ledgerId).first();
  if (existing?.source_hash === preview.sourceHash) return existing.id;
  if (existing) throw new LedgerError(existing.status === "pending" ? "Ya hay una importación en curso. Terminala o cancelala antes de empezar otra." : "Este libro ya tiene una importación; las reimportaciones incrementales aún no están habilitadas.", 409);
  const batchId = createPlatformId("import");
  const mappedIds = [];
  const setup = [];
  preview.review.mapping.forEach((choice, index) => {
    if (choice === "new") {
      const id = createPlatformId("participant");
      mappedIds.push(id);
      setup.push(db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, active, pending_import_batch_id) VALUES (?, ?, ?, 0, ?)").bind(ledgerId, id, preview.meta.participantNames[index], batchId));
    } else mappedIds.push(choice);
  });
  const categories = await readCategories(db, ledgerId);
  const fresh = newCategories(plan.rows, categories);
  const stored = { mapping: mappedIds, participantNames: preview.meta.participantNames, layout: preview.meta.layout, decisions: preview.review.decisions, defaultCurrency: preview.ledger.default_currency };
  const statements = [
    db.prepare("INSERT INTO splitwise_import_batches (id, ledger_id, actor_user_id, source_hash, file_name, reconciliation_json, assumptions_json, excluded_rows_json, review_json, planned_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(batchId, ledgerId, userId, preview.sourceHash, preview.fileName, JSON.stringify({ rows: plan.reconciliation, warnings: plan.warnings }), JSON.stringify(plan.assumptions), JSON.stringify(plan.excluded), JSON.stringify(stored), plan.rows.length),
    ...setup,
  ];
  if (fresh.length) {
    const position = categories.reduce((max, category) => Math.max(max, category.position), 0);
    statements.push(db.prepare("INSERT OR IGNORE INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, icon, position, pending_import_batch_id) SELECT ?, 'category_' || lower(hex(randomblob(12))), json_extract(value, '$.name'), json_extract(value, '$.name_key'), ?, ?, 'tag', ? + CAST(key AS INTEGER) + 1, ? FROM json_each(?)").bind(ledgerId, IMPORTED_GROUP, searchable(IMPORTED_GROUP), position, batchId, JSON.stringify(fresh)));
  }
  statements.push(
    db.prepare("UPDATE splitwise_import_rows SET owner_id = ? WHERE owner_id = ?").bind(batchId, previewId),
    db.prepare("UPDATE splitwise_import_previews SET batch_id = ? WHERE id = ? AND ledger_id = ?").bind(batchId, previewId, ledgerId),
  );
  try {
    await db.batch(statements);
    return batchId;
  } catch (error) {
    const raced = await db.prepare("SELECT id, source_hash FROM splitwise_import_batches WHERE ledger_id = ?").bind(ledgerId).first();
    if (raced?.source_hash === preview.sourceHash) return raced.id;
    if (raced) throw new LedgerError("Ya hay una importación en curso. Terminala o cancelala antes de empezar otra.", 409);
    throw error;
  }
}

async function ownedBatch(db, { spaceId, userId, batchId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  const row = await db.prepare("SELECT * FROM splitwise_import_batches WHERE id = ? AND ledger_id = ?").bind(batchId, ledger.id).first();
  if (!row) throw new LedgerError("Lote no encontrado.", 404);
  return { ledger, row };
}

async function loadedCount(db, batchId) {
  return (await db.prepare("SELECT COUNT(*) AS loaded FROM ledger_entries WHERE import_batch_id = ?").bind(batchId).first()).loaded;
}

export async function readImportProgress(db, { spaceId, userId, batchId }) {
  const { ledger, row } = await ownedBatch(db, { spaceId, userId, batchId });
  assertOwner(ledger, "Sólo el titular puede ver el avance de una importación.");
  return { id: row.id, status: row.status, fileName: row.file_name, planned: row.planned_count, loaded: row.status === "committed" ? row.imported_count : await loadedCount(db, row.id) };
}

function entryIdFor(batchId, line) { return `entry_imp_${batchId.replace(/^import_/u, "")}_${String(line).padStart(7, "0")}`; }

// Filas que toca cargar ahora: las que siguen a la última cargada, ya con las decisiones aplicadas.
async function nextRows(db, batchId, review, after, limit) {
  const importable = [];
  let cursor = after;
  while (importable.length < limit) {
    const rows = (await db.prepare("SELECT line, kind, payload_json FROM splitwise_import_rows WHERE owner_id = ? AND kind IN ('movement', 'incident') AND line > ? ORDER BY line LIMIT ?").bind(batchId, cursor, limit * 2).all()).results;
    if (!rows.length) break;
    for (const row of rows) {
      cursor = row.line;
      const payload = JSON.parse(row.payload_json);
      if (row.kind === "movement") { importable.push({ line: row.line, ...payload }); continue; }
      if (review.decisions[row.line] !== "assume_default") continue;
      const parsed = parseMovement(payload.cells, review.participantNames, row.line, review.defaultCurrency, review.layout ?? defaultLayout(review.participantNames));
      importable.push({ line: row.line, occurredAt: parsed.occurredAt, description: parsed.description, category: parsed.category, currency: parsed.currency, totalMinor: parsed.totalMinor, amounts: parsed.effects.map(effect => effect.amountMinor), note: parsed.note });
      if (importable.length >= limit) break;
    }
  }
  return importable.slice(0, limit);
}

function chunkStatements(db, { ledgerId, userId, batch, review, rows, categoryByKey, categoryById }) {
  const entries = [];
  const revisions = [];
  const cash = [];
  const shares = [];
  const sources = [];
  for (const row of rows) {
    const id = entryIdFor(batch.id, row.line);
    const result = inferComponents({ totalMinor: row.totalMinor, effects: mergeEffects(row.amounts, review.mapping), fallbackParticipantId: review.mapping[0] });
    if (!result.ok) throw new LedgerError(`La fila ${row.line} no se puede importar: ${result.reason}`, 500);
    const categoryId = categoryByKey.get(searchable(importedCategoryName(row.category))) ?? null;
    const categoryName = categoryId ? categoryById.get(categoryId)?.name ?? null : null;
    entries.push({ id, currency: row.currency, total: row.totalMinor, description: row.description, note: row.note, occurredAt: row.occurredAt, categoryId, line: row.line });
    revisions.push({ id, snapshot: { description: row.description, note: row.note, occurredAt: row.occurredAt, type: "expense", currency: row.currency, totalMinor: row.totalMinor, cashParties: result.cashParties, allocations: result.allocations, categoryId, categoryName, status: "active", importedFrom: { batchId: batch.id, line: row.line } } });
    for (const party of result.cashParties) cash.push({ id, participantId: party.participantId, amount: party.amountMinor });
    for (const share of result.allocations) shares.push({ id, participantId: share.participantId, amount: share.amountMinor });
    sources.push({ id, line: row.line, raw: { line: row.line, ...row } });
  }
  return [
    db.prepare("INSERT OR IGNORE INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, created_by_user_id, category_id, import_batch_id, source_row_number, inferred) SELECT ?, json_extract(value, '$.id'), 'expense', json_extract(value, '$.currency'), json_extract(value, '$.total'), json_extract(value, '$.description'), json_extract(value, '$.note'), json_extract(value, '$.occurredAt'), ?, json_extract(value, '$.categoryId'), ?, json_extract(value, '$.line'), 1 FROM json_each(?)").bind(ledgerId, userId, batch.id, JSON.stringify(entries)),
    db.prepare("INSERT OR IGNORE INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) SELECT ?, json_extract(value, '$.id'), 1, ?, 'created', json_extract(value, '$.snapshot') FROM json_each(?)").bind(ledgerId, userId, JSON.stringify(revisions)),
    db.prepare("INSERT OR IGNORE INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.participantId'), 'out', json_extract(value, '$.amount') FROM json_each(?)").bind(ledgerId, JSON.stringify(cash)),
    db.prepare("INSERT OR IGNORE INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.participantId'), json_extract(value, '$.amount') FROM json_each(?)").bind(ledgerId, JSON.stringify(shares)),
    db.prepare("INSERT OR IGNORE INTO import_source_rows (ledger_id, entry_id, batch_id, source_row_number, raw_json) SELECT ?, json_extract(value, '$.id'), ?, json_extract(value, '$.line'), json_extract(value, '$.raw') FROM json_each(?)").bind(ledgerId, batch.id, JSON.stringify(sources)),
  ];
}

// Publicación atómica: un único lote de escrituras muestra todos los movimientos, personas y categorías a la vez. Las
// condiciones de cada sentencia repiten la guarda («cargadas todas las filas»), así que nada queda a medias.
async function publishBatch(db, ledger, userId, batch) {
  const token = createPlatformId("publish");
  const mine = "EXISTS (SELECT 1 FROM splitwise_import_batches WHERE id = ? AND status = 'committed' AND publish_token = ?)";
  await db.batch([
    db.prepare("UPDATE splitwise_import_batches SET status = 'committed', imported_count = planned_count, committed_at = CURRENT_TIMESTAMP, publish_token = ? WHERE id = ? AND status = 'pending' AND (SELECT COUNT(*) FROM ledger_entries WHERE import_batch_id = ?) >= planned_count").bind(token, batch.id, batch.id),
    db.prepare(`UPDATE ledger_participants SET active = 1, pending_import_batch_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE pending_import_batch_id = ? AND ${mine}`).bind(batch.id, batch.id, token),
    db.prepare(`UPDATE ledger_categories SET pending_import_batch_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE pending_import_batch_id = ? AND ${mine}`).bind(batch.id, batch.id, token),
    db.prepare(`INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) SELECT ?, ?, ?, 'splitwise_import_committed', 'import', ?, ? WHERE ${mine}`).bind(createPlatformId("event"), ledger.id, userId, batch.id, JSON.stringify({ importedCount: batch.planned_count, excludedCount: JSON.parse(batch.excluded_rows_json).length, assumptionCount: JSON.parse(batch.assumptions_json).length }), batch.id, token),
    db.prepare(`UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${mine}`).bind(ledger.id, batch.id, token),
    db.prepare(`DELETE FROM splitwise_import_rows WHERE owner_id = ? AND ${mine}`).bind(batch.id, batch.id, token),
  ]);
}

// Carga una tanda y, si era la última, publica. El avance se calcula desde lo ya cargado, no desde un contador, así que
// repetir o paralelizar tandas no duplica nada (identificadores determinísticos e INSERT OR IGNORE).
export async function loadImportChunk(db, { spaceId, userId, batchId, chunk = IMPORT_CHUNK }) {
  const { ledger, row: batch } = await ownedBatch(db, { spaceId, userId, batchId });
  assertOwner(ledger);
  if (batch.status === "committed") return { status: "committed", loaded: batch.imported_count, planned: batch.planned_count, done: true };
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  const review = JSON.parse(batch.review_json);
  let loaded = await loadedCount(db, batch.id);
  if (loaded < batch.planned_count) {
    const after = (await db.prepare("SELECT COALESCE(MAX(source_row_number), 0) AS cursor FROM ledger_entries WHERE import_batch_id = ?").bind(batch.id).first()).cursor;
    const rows = await nextRows(db, batch.id, review, after, chunk);
    if (rows.length) {
      const categories = await readCategories(db, ledger.id, { pendingBatchId: batch.id });
      const resolve = categoryResolver(categories);
      const categoryById = new Map(categories.map(category => [category.id, category]));
      const categoryByKey = new Map();
      for (const row of rows) {
        const key = searchable(importedCategoryName(row.category));
        if (!key || categoryByKey.has(key)) continue;
        const found = findCategoryByName(categories, importedCategoryName(row.category));
        if (found) categoryByKey.set(key, resolve(found.id)?.id ?? found.id);
      }
      await db.batch(chunkStatements(db, { ledgerId: ledger.id, userId: batch.actor_user_id, batch, review, rows, categoryByKey, categoryById }));
      loaded = await loadedCount(db, batch.id);
    }
  }
  if (loaded >= batch.planned_count) {
    await publishBatch(db, ledger, userId, batch);
    const done = await db.prepare("SELECT status, imported_count FROM splitwise_import_batches WHERE id = ?").bind(batch.id).first();
    if (done.status === "committed") return { status: "committed", loaded: done.imported_count, planned: batch.planned_count, done: true };
  }
  return { status: "pending", loaded, planned: batch.planned_count, done: false };
}

export async function cancelImportBatch(db, { spaceId, userId, batchId }) {
  const { ledger, row } = await ownedBatch(db, { spaceId, userId, batchId });
  assertOwner(ledger);
  if (row.status !== "pending") throw new LedgerError("Una importación publicada no se cancela: anulá sus movimientos uno por uno.", 409);
  await discardImportBatch(db, row.id);
}

export async function readImportBatch(db, { spaceId, userId, batchId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  const row = await db.prepare("SELECT * FROM splitwise_import_batches WHERE id = ? AND ledger_id = ? AND status = 'committed'").bind(batchId, ledger.id).first();
  if (!row) throw new LedgerError("Lote no encontrado.", 404);
  return { id: row.id, fileName: row.file_name, importedCount: row.imported_count, reconciliation: JSON.parse(row.reconciliation_json), assumptions: JSON.parse(row.assumptions_json), excluded: JSON.parse(row.excluded_rows_json), committedAt: row.committed_at };
}
