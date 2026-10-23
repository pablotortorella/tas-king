import { getLedgerAccess, LedgerError } from "./ledger.js";
import { createPlatformId } from "./platform.js";
import { parseMovement, parseSignedMinor, parseSplitwiseCsv, SplitwiseCsvError } from "./splitwise-csv.js";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function hashText(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function buildImportPlan(parsed, review, defaultCurrency) {
  if (!review || !Array.isArray(review.mapping) || review.mapping.length !== parsed.participantNames.length || !Array.isArray(review.decisions) || review.decisions.length !== parsed.incidents.length) {
    throw new LedgerError("Completá el mapeo y la decisión para cada incidente.");
  }
  const rows = [...parsed.movements];
  const assumptions = [];
  const excluded = [];
  for (const [index, incident] of parsed.incidents.entries()) {
    const decision = review.decisions[index];
    if (decision === "exclude") { excluded.push({ line: incident.line, reason: incident.reason }); continue; }
    if (decision === "assume_default" && incident.code === "missing_currency") {
      try { rows.push(parseMovement(incident.cells, parsed.participantNames, incident.line, defaultCurrency)); }
      catch (error) { throw new LedgerError(`La fila ${incident.line} sigue siendo inválida: ${error.message}`); }
      assumptions.push({ line: incident.line, assumption: `Moneda ${defaultCurrency} elegida explícitamente` });
      continue;
    }
    throw new LedgerError(`La fila ${incident.line} necesita una decisión válida.`);
  }
  if (!rows.length) throw new LedgerError("No quedan movimientos para importar.");
  rows.sort((a, b) => a.line - b.line);
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
  return { rows, assumptions, excluded, totals: [...totals].map(([key, amountMinor]) => { const separator = key.indexOf(":"); return { currency: key.slice(0, separator), sourceName: key.slice(separator + 1), amountMinor }; }), reconciliation, warnings };
}

export async function createImportPreview(db, { spaceId, userId, fileName, csvText }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede importar.", 403);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  if (typeof csvText !== "string" || new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES) throw new LedgerError("El CSV debe medir como máximo 2 MiB.", 413);
  let parsed;
  try { parsed = parseSplitwiseCsv(csvText); }
  catch (error) { if (error instanceof SplitwiseCsvError) throw new LedgerError(error.message); throw error; }
  const sourceHash = await hashText(csvText);
  const existing = await db.prepare("SELECT id, status FROM splitwise_import_batches WHERE ledger_id = ? AND source_hash = ?").bind(ledger.id, sourceHash).first();
  if (existing?.status === "committed") return { batchId: existing.id };
  const id = createPlatformId("preview");
  const cleanName = typeof fileName === "string" ? fileName.slice(0, 240) : "splitwise.csv";
  await db.prepare("INSERT INTO splitwise_import_previews (id, ledger_id, actor_user_id, source_hash, file_name, parsed_json) VALUES (?, ?, ?, ?, ?, ?)").bind(id, ledger.id, userId, sourceHash, cleanName, JSON.stringify(parsed)).run();
  return { previewId: id };
}

export async function readImportPreview(db, { spaceId, userId, previewId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede revisar importaciones.", 403);
  const row = await db.prepare("SELECT * FROM splitwise_import_previews WHERE id = ? AND ledger_id = ? AND actor_user_id = ? AND expires_at > CURRENT_TIMESTAMP").bind(previewId, ledger.id, userId).first();
  if (!row) throw new LedgerError("La previsualización venció. Volvé a cargar el archivo.", 404);
  return { ledger, id: row.id, sourceHash: row.source_hash, fileName: row.file_name, parsed: JSON.parse(row.parsed_json), review: row.review_json ? JSON.parse(row.review_json) : null };
}

async function validateMapping(db, ledgerId, names, mapping) {
  if (!Array.isArray(mapping) || mapping.length !== names.length) throw new LedgerError("Mapeá todas las personas del archivo.");
  const participants = await db.prepare("SELECT id FROM ledger_participants WHERE ledger_id = ? AND active = 1 AND pending_import_batch_id IS NULL").bind(ledgerId).all();
  const available = new Set(participants.results.map(row => row.id));
  for (const choice of mapping) if (choice !== "new" && !available.has(choice)) throw new LedgerError("El mapeo contiene un participante ajeno o inactivo.");
}

async function assertNoOverlap(db, ledgerId, rows) {
  const firstNative = await db.prepare("SELECT MIN(occurred_at) AS first_date FROM ledger_entries WHERE ledger_id = ? AND status = 'active'").bind(ledgerId).first();
  if (firstNative?.first_date && rows.some(row => row.occurredAt >= firstNative.first_date)) {
    throw new LedgerError(`El archivo se solapa con movimientos nuevos desde ${firstNative.first_date}. Revisá el corte de fechas antes de importar.`, 409);
  }
}

export async function reviewImportPreview(db, { spaceId, userId, previewId, mapping, decisions }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  await validateMapping(db, preview.ledger.id, preview.parsed.participantNames, mapping);
  const review = { mapping, decisions };
  const plan = buildImportPlan(preview.parsed, review, preview.ledger.default_currency);
  await assertNoOverlap(db, preview.ledger.id, plan.rows);
  await db.prepare("UPDATE splitwise_import_previews SET review_json = ? WHERE id = ? AND ledger_id = ?").bind(JSON.stringify(review), previewId, preview.ledger.id).run();
  return { preview: { ...preview, review }, plan };
}

export async function cancelImportPreview(db, { spaceId, userId, previewId }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  await db.prepare("DELETE FROM splitwise_import_previews WHERE id = ? AND ledger_id = ?").bind(previewId, preview.ledger.id).run();
}

async function cleanupPendingBatch(db, batchId) {
  await db.batch([
    db.prepare("DELETE FROM splitwise_import_effects WHERE entry_id IN (SELECT id FROM splitwise_import_entries WHERE batch_id = ?)").bind(batchId),
    db.prepare("DELETE FROM splitwise_import_entries WHERE batch_id = ?").bind(batchId),
    db.prepare("DELETE FROM ledger_participants WHERE pending_import_batch_id = ?").bind(batchId),
    db.prepare("DELETE FROM splitwise_import_batches WHERE id = ? AND status = 'pending'").bind(batchId),
  ]);
}

export async function commitImportPreview(db, { spaceId, userId, previewId, acknowledgeDifference = false }) {
  const preview = await readImportPreview(db, { spaceId, userId, previewId });
  if (!preview.review) throw new LedgerError("Revisá el mapeo y los incidentes antes de confirmar.");
  await validateMapping(db, preview.ledger.id, preview.parsed.participantNames, preview.review.mapping);
  const plan = buildImportPlan(preview.parsed, preview.review, preview.ledger.default_currency);
  await assertNoOverlap(db, preview.ledger.id, plan.rows);
  if ((plan.reconciliation.some(item => item.differenceMinor !== 0) || plan.warnings.length) && !acknowledgeDifference) {
    throw new LedgerError("Confirmá que viste las diferencias o la falta de saldo fuente.");
  }
  const existing = await db.prepare("SELECT id, source_hash, status FROM splitwise_import_batches WHERE ledger_id = ?").bind(preview.ledger.id).first();
  if (existing?.status === "committed" && existing.source_hash === preview.sourceHash) return existing.id;
  if (existing) throw new LedgerError(existing.status === "pending" ? "Ya hay una importación en curso. Intentá más tarde." : "Este libro ya tiene una importación; las reimportaciones incrementales aún no están habilitadas.", 409);
  const batchId = createPlatformId("import");
  const mappedIds = [];
  const setup = [db.prepare("INSERT INTO splitwise_import_batches (id, ledger_id, actor_user_id, source_hash, file_name, source_summary_json, reconciliation_json, assumptions_json, excluded_rows_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(batchId, preview.ledger.id, userId, preview.sourceHash, preview.fileName, JSON.stringify(preview.parsed.summaries), JSON.stringify({ rows: plan.reconciliation, warnings: plan.warnings }), JSON.stringify(plan.assumptions), JSON.stringify(plan.excluded))];
  preview.review.mapping.forEach((choice, index) => {
    if (choice === "new") {
      const id = createPlatformId("participant");
      mappedIds.push(id);
      setup.push(db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, active, pending_import_batch_id) VALUES (?, ?, ?, 0, ?)").bind(preview.ledger.id, id, preview.parsed.participantNames[index], batchId));
    } else mappedIds.push(choice);
  });
  try {
    await db.batch(setup);
    let statements = [];
    for (const row of plan.rows) {
      const entryId = createPlatformId("imported");
      statements.push(db.prepare("INSERT INTO splitwise_import_entries (ledger_id, id, batch_id, source_row_number, occurred_at, description, category, currency_code, total_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(preview.ledger.id, entryId, batchId, row.line, row.occurredAt, row.description, row.category, row.currency, row.totalMinor));
      const effects = new Map();
      row.effects.forEach((effect, index) => effects.set(mappedIds[index], (effects.get(mappedIds[index]) ?? 0) + effect.amountMinor));
      for (const [participantId, amountMinor] of effects) {
        if (!Number.isSafeInteger(amountMinor)) throw new LedgerError(`La fila ${row.line} excede el rango permitido.`);
        statements.push(db.prepare("INSERT INTO splitwise_import_effects (ledger_id, entry_id, participant_id, amount_minor) VALUES (?, ?, ?, ?)").bind(preview.ledger.id, entryId, participantId, amountMinor));
      }
      if (statements.length >= 60) { await db.batch(statements); statements = []; }
    }
    if (statements.length) await db.batch(statements);
    await db.batch([
      db.prepare("UPDATE splitwise_import_batches SET status = 'committed', imported_count = ?, committed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(plan.rows.length, batchId),
      db.prepare("UPDATE ledger_participants SET active = 1, pending_import_batch_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE pending_import_batch_id = ?").bind(batchId),
      db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, 'splitwise_import_committed', 'import', ?, ?)").bind(createPlatformId("event"), preview.ledger.id, userId, batchId, JSON.stringify({ importedCount: plan.rows.length, excludedCount: plan.excluded.length, assumptionCount: plan.assumptions.length })),
      db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(preview.ledger.id),
    ]);
    return batchId;
  } catch (error) {
    const own = await db.prepare("SELECT id FROM splitwise_import_batches WHERE id = ? AND status = 'pending'").bind(batchId).first();
    if (own) await cleanupPendingBatch(db, batchId);
    const raced = await db.prepare("SELECT id, status FROM splitwise_import_batches WHERE ledger_id = ? AND source_hash = ?").bind(preview.ledger.id, preview.sourceHash).first();
    if (raced?.status === "committed") return raced.id;
    if (raced?.status === "pending") throw new LedgerError("Ya hay una importación en curso. Intentá más tarde.", 409);
    throw error;
  }
}

export async function readImportBatch(db, { spaceId, userId, batchId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  const row = await db.prepare("SELECT * FROM splitwise_import_batches WHERE id = ? AND ledger_id = ? AND status = 'committed'").bind(batchId, ledger.id).first();
  if (!row) throw new LedgerError("Lote no encontrado.", 404);
  return { id: row.id, fileName: row.file_name, importedCount: row.imported_count, summaries: JSON.parse(row.source_summary_json), reconciliation: JSON.parse(row.reconciliation_json), assumptions: JSON.parse(row.assumptions_json), excluded: JSON.parse(row.excluded_rows_json), committedAt: row.committed_at };
}
