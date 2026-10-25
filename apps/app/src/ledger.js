import { CURRENCY_MINOR_UNITS, FinancialValidationError, normalizeCurrency, validateEntryDraft } from "./finance.js";
import { splitAmount } from "./split.js";
import { createPlatformId } from "./platform.js";
import { categoryForEntry, categoryResolver, readCategories } from "./categories.js";
import { recordLedgerChange } from "./ledger-events.js";
import { LedgerError } from "./errors.js";
import { sha256Hex } from "./hash.js";

export { LedgerError };

export async function getLedgerAccess(db, spaceId, userId) {
  const row = await db.prepare(`
    SELECT l.id, l.space_id, l.default_currency, l.archived_at, l.revision, m.role
    FROM expense_ledgers l
    JOIN spaces s ON s.id = l.space_id
    JOIN memberships m ON m.space_id = l.space_id
    WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?
  `).bind(spaceId, spaceId, userId).first();
  if (!row) throw new LedgerError("No tenés acceso a este libro.", 404);
  return row;
}

export async function addParticipant(db, { spaceId, userId, name }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede agregar participantes.", 403);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  const displayName = typeof name === "string" ? name.trim() : "";
  if (!displayName || displayName.length > 120) throw new LedgerError("Ingresá un nombre de hasta 120 caracteres.");
  const sameName = value => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
  if ((await participantsFor(db, ledger.id)).some(person => person.active && sameName(person.displayName) === sameName(displayName))) {
    throw new LedgerError("Ya hay una persona con ese nombre en el grupo. Usá otro para distinguirlas.", 409);
  }
  const id = createPlatformId("participant");
  await db.batch([
    db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name) VALUES (?, ?, ?)").bind(ledger.id, id, displayName),
    ...recordLedgerChange(db, { ledgerId: ledger.id, userId, action: "participant_created", entityType: "participant", entityId: id }),
  ]);
  return { id, displayName };
}

async function participantsFor(db, ledgerId) {
  const rows = await db.prepare("SELECT id, display_name AS displayName, linked_user_id AS linkedUserId, active FROM ledger_participants WHERE ledger_id = ? AND pending_import_batch_id IS NULL ORDER BY created_at, id").bind(ledgerId).all();
  return rows.results;
}

function appendComponents(db, statements, ledgerId, entryId, draft) {
  for (const party of draft.cashParties) {
    statements.push(db.prepare("INSERT INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES (?, ?, ?, ?, ?)").bind(ledgerId, entryId, party.participantId, party.direction, party.amountMinor));
  }
  for (const share of draft.allocations) {
    statements.push(db.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES (?, ?, ?, ?)").bind(ledgerId, entryId, share.participantId, share.amountMinor));
  }
}

// ¿Quién pagó y el reparto guardados son los mismos del borrador? (compara por persona, sin importar el orden)
async function sameComponents(db, ledgerId, entryId, draft) {
  const [cash, shares] = await Promise.all([
    db.prepare("SELECT participant_id, direction, amount_minor FROM entry_cash_parties WHERE ledger_id = ? AND entry_id = ?").bind(ledgerId, entryId).all(),
    db.prepare("SELECT participant_id, amount_minor FROM entry_allocations WHERE ledger_id = ? AND entry_id = ?").bind(ledgerId, entryId).all(),
  ]);
  const key = rows => JSON.stringify(rows.map(row => [row.participantId, row.direction ?? "", row.amountMinor]).sort());
  return key(cash.results.map(row => ({ participantId: row.participant_id, direction: row.direction, amountMinor: row.amount_minor }))) === key(draft.cashParties)
    && key(shares.results.map(row => ({ participantId: row.participant_id, amountMinor: row.amount_minor }))) === key(draft.allocations);
}

const requestHash = payload => sha256Hex(JSON.stringify(payload));

// Si el movimiento trae la especificación del reparto (método y datos ingresados), el servidor calcula las
// asignaciones con la regla única y descarta cualquier importe calculado por el cliente. Sin especificación
// (llamadas internas con asignaciones ya resueltas) se conserva el comportamiento anterior.
function resolveSplit(input, participants) {
  if (!input.split) return { input, split: undefined };
  const currency = normalizeCurrency(input.currency);
  if (!currency) throw new LedgerError("Moneda no soportada.");
  const order = Object.fromEntries(participants.map((person, index) => [person.id, index]));
  const names = Object.fromEntries(participants.map(person => [person.id, person.displayName]));
  const { method, beneficiaries, inputs } = input.split;
  const result = splitAmount({ totalMinor: input.totalMinor, units: CURRENCY_MINOR_UNITS[currency], currency, method, beneficiaries, inputs, order, names });
  if (!result.ok) throw new LedgerError(result.error);
  const ordered = [...new Set(beneficiaries)].sort((a, b) => (order[a] ?? Infinity) - (order[b] ?? Infinity));
  return { input: { ...input, allocations: result.allocations }, split: { method, beneficiaries: ordered, inputs: inputs ?? {} } };
}

function validateDetails(input) {
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  const occurredAt = input.occurredAt;
  if (!description || description.length > 240) throw new LedgerError("Ingresá una descripción de hasta 240 caracteres.");
  if (note.length > 1000) throw new LedgerError("La nota es demasiado larga.");
  if (typeof occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(occurredAt) || Number.isNaN(Date.parse(`${occurredAt}T00:00:00Z`))) {
    throw new LedgerError("Ingresá una fecha válida.");
  }
  return { description, note, occurredAt };
}

async function replayOrThrow(db, ledgerId, userId, key, hash, error, entryId = null, expectedRevision = null) {
  const existing = await db.prepare("SELECT request_hash, response_json FROM idempotency_keys WHERE ledger_id = ? AND actor_user_id = ? AND idempotency_key = ?").bind(ledgerId, userId, key).first();
  if (existing) {
    if (existing.request_hash !== hash) throw new LedgerError("Esta solicitud ya fue usada con otros datos.", 409);
    return JSON.parse(existing.response_json);
  }
  if (entryId) {
    const current = await db.prepare("SELECT current_revision FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(ledgerId, entryId).first();
    if (current?.current_revision !== expectedRevision) throw new LedgerError("Este movimiento cambió. Recargá antes de guardar.", 409);
  }
  throw error;
}

export async function saveEntry(db, { spaceId, userId, input, idempotencyKey, entryId = null, expectedRevision = null }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new LedgerError("Recargá el formulario y volvé a intentar.");
  const participants = await participantsFor(db, ledger.id);
  const allowedIds = participants.map(row => row.id);
  const resolved = resolveSplit(input, participants);
  let draft;
  try { draft = validateEntryDraft(resolved.input, allowedIds); }
  catch (error) { if (error instanceof FinancialValidationError) throw new LedgerError(error.message); throw error; }
  const details = validateDetails(input);
  const existing = entryId ? await db.prepare(`SELECT e.id, e.created_by_user_id, e.current_revision, e.status, e.category_id, e.import_batch_id, e.inferred FROM ledger_entries e WHERE e.ledger_id = ? AND e.id = ? AND ${VISIBLE_ENTRY_SQL}`).bind(ledger.id, entryId).first() : null;
  if (entryId && !existing) throw new LedgerError("Movimiento no encontrado.", 404);
  if (existing && ledger.role !== "owner" && existing.created_by_user_id !== userId) throw new LedgerError("Sólo podés corregir tus movimientos.", 403);
  const id = entryId || createPlatformId("entry");
  const revision = existing ? expectedRevision + 1 : 1;
  const action = existing ? "revised" : "created";
  // Sin campo de categoría en la solicitud (llamadas internas) se conserva la que ya tenía; las transferencias no llevan.
  const wantsCategory = input.categoryId !== undefined || input.categoryName !== undefined;
  const category = draft.type === "transfer" || (!wantsCategory && !existing) ? null
    : !wantsCategory ? { id: existing.category_id }
    : await categoryForEntry(db, { ledgerId: ledger.id, userId, categoryId: input.categoryId, categoryName: input.categoryName, currentCategoryId: existing?.category_id ?? null });
  const categoryId = category?.id ?? null;
  const categoryName = categoryId ? (await readCategories(db, ledger.id)).find(row => row.id === categoryId)?.name ?? null : null;
  const snapshot = { ...details, ...draft, split: resolved.split, categoryId, categoryName, status: "active" };
  // La marca «inferido» de un importado desaparece cuando una corrección cambia quién pagó o el reparto.
  const inferred = existing?.inferred === 1 && (await sameComponents(db, ledger.id, id, draft)) ? 1 : 0;
  const hash = await requestHash({ entryId, expectedRevision, snapshot });
  const replay = await db.prepare("SELECT request_hash, response_json FROM idempotency_keys WHERE ledger_id = ? AND actor_user_id = ? AND idempotency_key = ?").bind(ledger.id, userId, idempotencyKey).first();
  if (replay) {
    if (replay.request_hash !== hash) throw new LedgerError("Esta solicitud ya fue usada con otros datos.", 409);
    return JSON.parse(replay.response_json);
  }
  if (existing && existing.status !== "active") throw new LedgerError("El movimiento ya fue anulado.", 409);
  if (existing && existing.current_revision !== expectedRevision) throw new LedgerError("Este movimiento cambió. Recargá antes de guardar.", 409);
  const response = { id, revision, action };
  const statements = [
    db.prepare("INSERT INTO idempotency_keys (ledger_id, actor_user_id, idempotency_key, request_hash, response_json) VALUES (?, ?, ?, ?, ?)").bind(ledger.id, userId, idempotencyKey, hash, JSON.stringify(response)),
  ];
  if (existing) {
    statements.push(db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES (?, ?, ?, ?, 'revised', ?)").bind(ledger.id, id, revision, userId, JSON.stringify(snapshot)));
    statements.push(db.prepare("UPDATE ledger_entries SET entry_type = ?, currency_code = ?, total_minor = ?, description = ?, note = ?, occurred_at = ?, category_id = ?, inferred = ?, current_revision = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND current_revision = ?").bind(draft.type, draft.currency, draft.totalMinor, details.description, details.note, details.occurredAt, categoryId, inferred, revision, ledger.id, id, expectedRevision));
    statements.push(db.prepare("DELETE FROM entry_cash_parties WHERE ledger_id = ? AND entry_id = ?").bind(ledger.id, id));
    statements.push(db.prepare("DELETE FROM entry_allocations WHERE ledger_id = ? AND entry_id = ?").bind(ledger.id, id));
  } else {
    statements.push(db.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, created_by_user_id, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ledger.id, id, draft.type, draft.currency, draft.totalMinor, details.description, details.note, details.occurredAt, userId, categoryId));
    statements.push(db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES (?, ?, 1, ?, 'created', ?)").bind(ledger.id, id, userId, JSON.stringify(snapshot)));
  }
  appendComponents(db, statements, ledger.id, id, draft);
  statements.push(...recordLedgerChange(db, { ledgerId: ledger.id, userId, action: `entry_${action}`, entityType: "entry", entityId: id }));
  try { await db.batch(statements); return response; }
  catch (error) { return replayOrThrow(db, ledger.id, userId, idempotencyKey, hash, error, entryId, expectedRevision); }
}

export async function voidEntry(db, { spaceId, userId, entryId, expectedRevision, idempotencyKey, reason = "" }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  const entry = await db.prepare(`SELECT e.* FROM ledger_entries e WHERE e.ledger_id = ? AND e.id = ? AND ${VISIBLE_ENTRY_SQL}`).bind(ledger.id, entryId).first();
  if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
  if (ledger.role !== "owner" && entry.created_by_user_id !== userId) throw new LedgerError("Sólo podés anular tus movimientos.", 403);
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new LedgerError("Recargá el formulario y volvé a intentar.");
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (cleanReason.length > 1000) throw new LedgerError("El motivo es demasiado largo.");
  const revision = expectedRevision + 1;
  const response = { id: entryId, revision, action: "voided" };
  const hash = await requestHash({ entryId, expectedRevision, reason: cleanReason, action: "voided" });
  const replay = await db.prepare("SELECT request_hash, response_json FROM idempotency_keys WHERE ledger_id = ? AND actor_user_id = ? AND idempotency_key = ?").bind(ledger.id, userId, idempotencyKey).first();
  if (replay) {
    if (replay.request_hash !== hash) throw new LedgerError("Esta solicitud ya fue usada con otros datos.", 409);
    return JSON.parse(replay.response_json);
  }
  if (entry.status !== "active" || entry.current_revision !== expectedRevision) throw new LedgerError("Este movimiento cambió. Recargá antes de anular.", 409);
  try {
    await db.batch([
      db.prepare("INSERT INTO idempotency_keys (ledger_id, actor_user_id, idempotency_key, request_hash, response_json) VALUES (?, ?, ?, ?, ?)").bind(ledger.id, userId, idempotencyKey, hash, JSON.stringify(response)),
      db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES (?, ?, ?, ?, 'voided', ?)").bind(ledger.id, entryId, revision, userId, JSON.stringify({ ...entry, reason: cleanReason, status: "voided" })),
      db.prepare("UPDATE ledger_entries SET status = 'voided', current_revision = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND current_revision = ?").bind(revision, ledger.id, entryId, expectedRevision),
      ...recordLedgerChange(db, { ledgerId: ledger.id, userId, action: "entry_voided", entityType: "entry", entityId: entryId }),
    ]);
    return response;
  } catch (error) { return replayOrThrow(db, ledger.id, userId, idempotencyKey, hash, error, entryId, expectedRevision); }
}

// La categoría que se muestra: sigue las fusiones hasta una vigente. Una archivada sin fusionar se sigue mostrando.
function categoryInfoFor(resolve, id) {
  const category = id ? resolve(id) : null;
  return category ? { id: category.id, name: category.name, group: category.group, groupKey: category.groupKey, icon: category.icon, generic: category.generic, archived: category.status === "archived" } : null;
}

// Un movimiento importado solo se ve cuando su lote ya se publicó; mientras se carga permanece oculto en todas las lecturas.
// Es la única definición de «visible»: toda consulta de movimientos (lista, partes, revisiones, exportación) la reutiliza.
export const VISIBLE_ENTRY_SQL = "(e.import_batch_id IS NULL OR EXISTS (SELECT 1 FROM splitwise_import_batches b WHERE b.id = e.import_batch_id AND b.status = 'committed'))";

export async function readLedger(db, { spaceId, userId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  const participants = await participantsFor(db, ledger.id);
  const visible = `SELECT e.id FROM ledger_entries e WHERE e.ledger_id = ? AND ${VISIBLE_ENTRY_SQL}`;
  const [categories, entryRows, cashRows, allocationRows] = await Promise.all([
    readCategories(db, ledger.id),
    db.prepare(`SELECT e.*, u.display_name AS creator_name FROM ledger_entries e JOIN users u ON u.id = e.created_by_user_id WHERE e.ledger_id = ? AND ${VISIBLE_ENTRY_SQL} ORDER BY e.occurred_at DESC, e.created_at DESC, e.rowid DESC`).bind(ledger.id).all(),
    db.prepare(`SELECT entry_id, participant_id, direction, amount_minor FROM entry_cash_parties WHERE ledger_id = ? AND entry_id IN (${visible})`).bind(ledger.id, ledger.id).all(),
    db.prepare(`SELECT entry_id, participant_id, amount_minor FROM entry_allocations WHERE ledger_id = ? AND entry_id IN (${visible})`).bind(ledger.id, ledger.id).all(),
  ]);
  const cashByEntry = new Map();
  const sharesByEntry = new Map();
  for (const row of cashRows.results) {
    if (!cashByEntry.has(row.entry_id)) cashByEntry.set(row.entry_id, []);
    cashByEntry.get(row.entry_id).push({ participantId: row.participant_id, direction: row.direction, amountMinor: row.amount_minor });
  }
  for (const row of allocationRows.results) {
    if (!sharesByEntry.has(row.entry_id)) sharesByEntry.set(row.entry_id, []);
    sharesByEntry.get(row.entry_id).push({ participantId: row.participant_id, amountMinor: row.amount_minor });
  }
  const balances = new Map();
  const addBalance = (currency, participantId, amountMinor) => {
    const key = `${currency}:${participantId}`;
    const next = (balances.get(key) ?? 0) + amountMinor;
    if (!Number.isSafeInteger(next)) throw new LedgerError("El saldo excede el rango permitido.", 500);
    balances.set(key, next);
  };
  const participantIds = participants.map(p => p.id);
  const resolveCategory = categoryResolver(categories);
  const entries = entryRows.results.map(row => {
    const cashParties = cashByEntry.get(row.id) ?? [];
    const allocations = sharesByEntry.get(row.id) ?? [];
    const validated = validateEntryDraft({ type: row.entry_type, currency: row.currency_code, totalMinor: row.total_minor, cashParties, allocations }, participantIds);
    if (row.status === "active") for (const effect of validated.effects) addBalance(row.currency_code, effect.participantId, effect.amountMinor);
    return { categoryId: row.category_id, categoryInfo: categoryInfoFor(resolveCategory, row.category_id), importBatchId: row.import_batch_id, sourceRowNumber: row.source_row_number, inferred: row.inferred === 1, id: row.id, type: row.entry_type, currency: row.currency_code, totalMinor: row.total_minor, description: row.description, note: row.note, occurredAt: row.occurred_at, status: row.status, revision: row.current_revision, createdByUserId: row.created_by_user_id, creatorName: row.creator_name, cashParties, allocations, effects: validated.effects };
  });
  return { ledger, participants, categories, entries, balances: [...balances].map(([key, amountMinor]) => { const [currency, participantId] = key.split(":"); return { currency, participantId, amountMinor }; }) };
}

export async function exportLedger(db, { spaceId, userId }) {
  const data = await readLedger(db, { spaceId, userId });
  const revisions = await db.prepare(`SELECT r.* FROM entry_revisions r JOIN ledger_entries e ON e.ledger_id = r.ledger_id AND e.id = r.entry_id WHERE r.ledger_id = ? AND ${VISIBLE_ENTRY_SQL} ORDER BY r.entry_id, r.revision`).bind(data.ledger.id).all();
  const events = await db.prepare("SELECT * FROM ledger_events WHERE ledger_id = ? ORDER BY created_at, id").bind(data.ledger.id).all();
  const imports = await db.prepare("SELECT id, source_hash, file_name, imported_count, source_summary_json, reconciliation_json, assumptions_json, excluded_rows_json, committed_at FROM splitwise_import_batches WHERE ledger_id = ? AND status = 'committed'").bind(data.ledger.id).all();
  const sourceRows = await db.prepare("SELECT s.entry_id, s.batch_id, s.source_row_number, s.raw_json FROM import_source_rows s JOIN splitwise_import_batches b ON b.id = s.batch_id WHERE s.ledger_id = ? AND b.status = 'committed' ORDER BY s.batch_id, s.source_row_number").bind(data.ledger.id).all();
  return { schemaVersion: 3, exportedAt: new Date().toISOString(), ledger: data.ledger, participants: data.participants, categories: data.categories, entries: data.entries, revisions: revisions.results, events: events.results, imports: imports.results, importSourceRows: sourceRows.results };
}
