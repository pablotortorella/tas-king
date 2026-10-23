import { FinancialValidationError, validateEntryDraft } from "./finance.js";
import { createPlatformId } from "./platform.js";

export class LedgerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function getLedgerAccess(db, spaceId, userId) {
  const row = await db.prepare(`
    SELECT l.id, l.space_id, l.default_currency, l.archived_at, l.revision, m.role
    FROM expense_ledgers l JOIN memberships m ON m.space_id = l.space_id
    WHERE l.space_id = ? AND m.user_id = ?
  `).bind(spaceId, userId).first();
  if (!row) throw new LedgerError("No tenés acceso a este libro.", 404);
  return row;
}

export async function addParticipant(db, { spaceId, userId, name }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede agregar participantes.", 403);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  const displayName = typeof name === "string" ? name.trim() : "";
  if (!displayName || displayName.length > 120) throw new LedgerError("Ingresá un nombre de hasta 120 caracteres.");
  const id = createPlatformId("participant");
  await db.batch([
    db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name) VALUES (?, ?, ?)").bind(ledger.id, id, displayName),
    db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'participant_created', 'participant', ?)").bind(createPlatformId("event"), ledger.id, userId, id),
    db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ledger.id),
  ]);
  return { id, displayName };
}

async function participantsFor(db, ledgerId) {
  const rows = await db.prepare("SELECT id, display_name AS displayName, linked_user_id AS linkedUserId, active FROM ledger_participants WHERE ledger_id = ? ORDER BY created_at, id").bind(ledgerId).all();
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

async function requestHash(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
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
  let draft;
  try { draft = validateEntryDraft(input, allowedIds); }
  catch (error) { if (error instanceof FinancialValidationError) throw new LedgerError(error.message); throw error; }
  const details = validateDetails(input);
  const existing = entryId ? await db.prepare("SELECT id, created_by_user_id, current_revision, status FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(ledger.id, entryId).first() : null;
  if (entryId && !existing) throw new LedgerError("Movimiento no encontrado.", 404);
  if (existing && ledger.role !== "owner" && existing.created_by_user_id !== userId) throw new LedgerError("Sólo podés corregir tus movimientos.", 403);
  const id = entryId || createPlatformId("entry");
  const revision = existing ? expectedRevision + 1 : 1;
  const action = existing ? "revised" : "created";
  const snapshot = { ...details, ...draft, status: "active" };
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
    statements.push(db.prepare("UPDATE ledger_entries SET entry_type = ?, currency_code = ?, total_minor = ?, description = ?, note = ?, occurred_at = ?, current_revision = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND current_revision = ?").bind(draft.type, draft.currency, draft.totalMinor, details.description, details.note, details.occurredAt, revision, ledger.id, id, expectedRevision));
    statements.push(db.prepare("DELETE FROM entry_cash_parties WHERE ledger_id = ? AND entry_id = ?").bind(ledger.id, id));
    statements.push(db.prepare("DELETE FROM entry_allocations WHERE ledger_id = ? AND entry_id = ?").bind(ledger.id, id));
  } else {
    statements.push(db.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ledger.id, id, draft.type, draft.currency, draft.totalMinor, details.description, details.note, details.occurredAt, userId));
    statements.push(db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES (?, ?, 1, ?, 'created', ?)").bind(ledger.id, id, userId, JSON.stringify(snapshot)));
  }
  appendComponents(db, statements, ledger.id, id, draft);
  statements.push(db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, 'entry', ?)").bind(createPlatformId("event"), ledger.id, userId, `entry_${action}`, id));
  statements.push(db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ledger.id));
  try { await db.batch(statements); return response; }
  catch (error) { return replayOrThrow(db, ledger.id, userId, idempotencyKey, hash, error, entryId, expectedRevision); }
}

export async function voidEntry(db, { spaceId, userId, entryId, expectedRevision, idempotencyKey, reason = "" }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  const entry = await db.prepare("SELECT * FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(ledger.id, entryId).first();
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
      db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'entry_voided', 'entry', ?)").bind(createPlatformId("event"), ledger.id, userId, entryId),
      db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ledger.id),
    ]);
    return response;
  } catch (error) { return replayOrThrow(db, ledger.id, userId, idempotencyKey, hash, error, entryId, expectedRevision); }
}

export async function readLedger(db, { spaceId, userId }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  const participants = await participantsFor(db, ledger.id);
  const [entryRows, cashRows, allocationRows] = await Promise.all([
    db.prepare("SELECT e.*, u.display_name AS creator_name FROM ledger_entries e JOIN users u ON u.id = e.created_by_user_id WHERE e.ledger_id = ? ORDER BY e.occurred_at DESC, e.created_at DESC, e.id DESC").bind(ledger.id).all(),
    db.prepare("SELECT entry_id, participant_id, direction, amount_minor FROM entry_cash_parties WHERE ledger_id = ?").bind(ledger.id).all(),
    db.prepare("SELECT entry_id, participant_id, amount_minor FROM entry_allocations WHERE ledger_id = ?").bind(ledger.id).all(),
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
  const entries = entryRows.results.map(row => {
    const cashParties = cashByEntry.get(row.id) ?? [];
    const allocations = sharesByEntry.get(row.id) ?? [];
    const validated = validateEntryDraft({ type: row.entry_type, currency: row.currency_code, totalMinor: row.total_minor, cashParties, allocations }, participants.map(p => p.id));
    if (row.status === "active") for (const effect of validated.effects) {
      const key = `${row.currency_code}:${effect.participantId}`;
      const next = (balances.get(key) ?? 0) + effect.amountMinor;
      if (!Number.isSafeInteger(next)) throw new LedgerError("El saldo excede el rango permitido.", 500);
      balances.set(key, next);
    }
    return { id: row.id, type: row.entry_type, currency: row.currency_code, totalMinor: row.total_minor, description: row.description, note: row.note, occurredAt: row.occurred_at, status: row.status, revision: row.current_revision, createdByUserId: row.created_by_user_id, creatorName: row.creator_name, cashParties, allocations, effects: validated.effects };
  });
  return { ledger, participants, entries, balances: [...balances].map(([key, amountMinor]) => { const [currency, participantId] = key.split(":"); return { currency, participantId, amountMinor }; }) };
}

export async function exportLedger(db, { spaceId, userId }) {
  const data = await readLedger(db, { spaceId, userId });
  const revisions = await db.prepare("SELECT r.* FROM entry_revisions r WHERE r.ledger_id = ? ORDER BY r.entry_id, r.revision").bind(data.ledger.id).all();
  const events = await db.prepare("SELECT * FROM ledger_events WHERE ledger_id = ? ORDER BY created_at, id").bind(data.ledger.id).all();
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), ledger: data.ledger, participants: data.participants, entries: data.entries, revisions: revisions.results, events: events.results };
}
