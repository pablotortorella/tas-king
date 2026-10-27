import { chunkByBytes } from "./chunking.js";
import { LedgerError } from "./errors.js";
import { recordLedgerChange } from "./ledger-events.js";
import { getLedgerAccess, nameKey, participantsFor, readLedger, VISIBLE_ENTRY_SQL } from "./ledger.js";
import { isTransferBetween, mergedSnapshot, movePerson, touchesPerson } from "./person-merge.js";
import { createPlatformId } from "./platform.js";
import { latestSnapshots, WRITE_CHUNK } from "./revisions.js";

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/u;
const SAMPLE_SIZE = 8;
const MAX_ROUNDS = 3;
export const VOID_REASON = "Unión de personas: las dos puntas de la transferencia pasaron a ser la misma persona.";

function requireOwner(ledger, action) {
  if (ledger.role !== "owner") throw new LedgerError(`Sólo el titular puede ${action}.`, 403);
  if (ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
}

// Renombrar: el nombre es único entre las personas vigentes del grupo (sin distinguir mayúsculas ni tildes).
export async function renamePerson(db, { groupId, userId, personId, name }) {
  const ledger = await getLedgerAccess(db, groupId, userId);
  requireOwner(ledger, "renombrar personas");
  const displayName = typeof name === "string" ? name.trim() : "";
  if (!displayName || displayName.length > 120) throw new LedgerError("Ingresá un nombre de hasta 120 caracteres.");
  const people = await participantsFor(db, ledger.id);
  const person = people.find(row => row.id === personId);
  if (!person) throw new LedgerError("Persona no encontrada.", 404);
  if (person.displayName === displayName) return { id: person.id, displayName, changed: false };
  if (people.some(row => row.id !== person.id && row.active && nameKey(row.displayName) === nameKey(displayName))) {
    throw new LedgerError("Ya hay una persona con ese nombre en el grupo. Usá otro para distinguirlas.", 409);
  }
  await db.batch([
    db.prepare("UPDATE ledger_participants SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND merged_into_id IS NULL").bind(displayName, ledger.id, person.id),
    ...recordLedgerChange(db, { ledgerId: ledger.id, userId, action: "participant_renamed", entityType: "participant", entityId: person.id, metadata: { from: person.displayName, to: displayName } }),
  ]);
  return { id: person.id, displayName, changed: true };
}

// Todo lo que una unión cambiaría, calculado con la lectura del libro. No escribe.
async function planMerge(db, { groupId, userId, sourceId, targetId }) {
  const data = await readLedger(db, { groupId, userId });
  requireOwner(data.ledger, "unir personas");
  if (!sourceId || !targetId) throw new LedgerError("Elegí las dos personas.");
  if (sourceId === targetId) throw new LedgerError("Elegí dos personas distintas.");
  const byId = new Map(data.participants.map(person => [person.id, person]));
  const source = byId.get(sourceId);
  const target = byId.get(targetId);
  if (!source || !target) {
    const merged = data.mergedParticipants.some(person => person.id === sourceId || person.id === targetId);
    throw new LedgerError(merged ? "Una de las personas ya fue unida a otra." : "Esa persona no pertenece al grupo.", merged ? 409 : 404);
  }
  if (!source.active || !target.active) throw new LedgerError("Una de las personas no está vigente.", 409);
  if (source.linkedUserId && target.linkedUserId) throw new LedgerError("Las dos personas tienen cuenta y son cuentas distintas: no se pueden unir.", 409);
  const affected = data.entries.filter(entry => entry.status === "active" && touchesPerson(entry, sourceId));
  const toVoid = affected.filter(entry => isTransferBetween(entry, sourceId, targetId));
  const voiding = new Set(toVoid.map(entry => entry.id));
  const toRevise = affected.filter(entry => !voiding.has(entry.id));
  const invitations = (await db.prepare("SELECT invitee_email FROM invitations WHERE group_id = ? AND status = 'pending' AND target_participant_id = ?").bind(data.ledger.group_id, sourceId).all()).results;
  const targetInvitations = (await db.prepare("SELECT invitee_email FROM invitations WHERE group_id = ? AND status = 'pending' AND target_participant_id = ?").bind(data.ledger.group_id, targetId).all()).results;
  const accountMoves = Boolean(source.linkedUserId) && !target.linkedUserId;
  const invitationMoves = invitations.length > 0 && !target.linkedUserId && targetInvitations.length === 0;
  const canceled = [...(invitationMoves ? [] : invitations), ...(accountMoves ? targetInvitations : [])].map(row => row.invitee_email);
  return { data, source, target, affected, toRevise, toVoid, accountMoves, invitation: { moves: invitationMoves ? invitations[0].invitee_email : null, canceled } };
}

const amountFor = (balances, personId) => new Map(balances.filter(row => row.participantId === personId).map(row => [row.currency, row.amountMinor]));

function sampleOf(entries) {
  return entries.slice(0, SAMPLE_SIZE).map(entry => ({ id: entry.id, description: entry.description, occurredAt: entry.occurredAt, currency: entry.currency, totalMinor: entry.totalMinor }));
}

// Paso 1: cuántos movimientos cambian, cuántos se anulan y cómo quedan los saldos. No escribe nada.
export async function previewMerge(db, args) {
  const plan = await planMerge(db, args);
  const sourceBalances = amountFor(plan.data.balances, plan.source.id);
  const targetBalances = amountFor(plan.data.balances, plan.target.id);
  const currencies = [...new Set([...sourceBalances.keys(), ...targetBalances.keys()])].sort();
  return {
    source: { id: plan.source.id, name: plan.source.displayName, linked: Boolean(plan.source.linkedUserId) },
    target: { id: plan.target.id, name: plan.target.displayName, linked: Boolean(plan.target.linkedUserId) },
    revise: plan.toRevise.length,
    voided: plan.toVoid.length,
    sample: sampleOf(plan.toRevise),
    voidedSample: sampleOf(plan.toVoid),
    balances: currencies.map(currency => ({ currency, source: sourceBalances.get(currency) ?? 0, target: targetBalances.get(currency) ?? 0, after: (sourceBalances.get(currency) ?? 0) + (targetBalances.get(currency) ?? 0) })),
    accountMoves: plan.accountMoves,
    invitation: plan.invitation,
    ledgerRevision: plan.data.ledger.revision,
  };
}

// Movimiento sin instantánea previa legible: se reconstruye con lo que se ve en la lectura del libro.
function fallbackSnapshot(entry) {
  return { description: entry.description, note: entry.note ?? "", occurredAt: entry.occurredAt, type: entry.type, currency: entry.currency, totalMinor: entry.totalMinor, cashParties: entry.cashParties, allocations: entry.allocations, categoryId: entry.categoryId ?? null };
}

// «El movimiento está listo para pasar a la revisión siguiente»: existe nuestra revisión como la que sigue a la vigente.
const PENDING_SET = "SELECT e.id FROM ledger_entries e WHERE e.ledger_id = ? AND e.status = 'active' AND e.id IN (SELECT json_extract(value, '$.id') FROM json_each(?)) AND EXISTS (SELECT 1 FROM entry_revisions r WHERE r.ledger_id = e.ledger_id AND r.entry_id = e.id AND r.revision = e.current_revision + 1 AND json_extract(r.snapshot_json, '$.personMerge') = ?)";
const INSERT_REVISION = action => `INSERT OR IGNORE INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) SELECT ?, e.id, json_extract(j.value, '$.next'), ?, '${action}', json_extract(j.value, '$.snapshot') FROM json_each(?) j CROSS JOIN ledger_entries e ON e.ledger_id = ? AND e.id = json_extract(j.value, '$.id') AND e.current_revision = json_extract(j.value, '$.rev') AND e.status = 'active'`;
const INSERT_ITEMS = kind => `INSERT OR IGNORE INTO person_merge_items (ledger_id, merge_id, entry_id, revision, kind) SELECT ?, ?, json_extract(j.value, '$.id'), json_extract(j.value, '$.next'), '${kind}' FROM json_each(?) j CROSS JOIN entry_revisions r ON r.ledger_id = ? AND r.entry_id = json_extract(j.value, '$.id') AND r.revision = json_extract(j.value, '$.next') AND json_extract(r.snapshot_json, '$.personMerge') = ?`;

// Escribe las tandas. Cada una es un solo db.batch guardado por «el movimiento sigue en la revisión que se vio»: uno corregido
// a mitad de camino no se toca y la siguiente ronda lo recoge. Entre tandas el libro siempre se lee bien (cada movimiento
// apunta a la persona unida, todavía vigente, o a la destinataria).
async function writeChunks(db, { plan, userId, mergeId }) {
  const ledgerId = plan.data.ledger.id;
  const sourceId = plan.source.id;
  const targetId = plan.target.id;
  const snapshots = await latestSnapshots(db, ledgerId, plan.toRevise.map(entry => entry.id));
  const revise = plan.toRevise.map(entry => ({
    id: entry.id, rev: entry.revision, next: entry.revision + 1,
    snapshot: mergedSnapshot(snapshots.get(entry.id) ?? fallbackSnapshot(entry), movePerson(entry, sourceId, targetId), mergeId),
  }));
  const voids = plan.toVoid.map(entry => ({
    id: entry.id, rev: entry.revision, next: entry.revision + 1,
    snapshot: { ...fallbackSnapshot(entry), reason: VOID_REASON, status: "voided", personMerge: mergeId },
  }));
  for (const part of chunkByBytes(voids, { maxItems: WRITE_CHUNK })) {
    const ids = JSON.stringify(part.map(({ id }) => ({ id })));
    const slim = JSON.stringify(part.map(({ id, next }) => ({ id, next })));
    await db.batch([
      db.prepare(INSERT_REVISION("voided")).bind(ledgerId, userId, JSON.stringify(part), ledgerId),
      db.prepare(`UPDATE ledger_entries SET status = 'voided', current_revision = current_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND status = 'active' AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?)) AND EXISTS (SELECT 1 FROM entry_revisions r WHERE r.ledger_id = ledger_entries.ledger_id AND r.entry_id = ledger_entries.id AND r.revision = ledger_entries.current_revision + 1 AND json_extract(r.snapshot_json, '$.personMerge') = ?)`).bind(ledgerId, ids, mergeId),
      db.prepare(INSERT_ITEMS("voided")).bind(ledgerId, mergeId, slim, ledgerId, mergeId),
    ]);
  }
  for (const part of chunkByBytes(revise, { maxItems: WRITE_CHUNK })) {
    const ids = JSON.stringify(part.map(({ id }) => ({ id })));
    const slim = JSON.stringify(part.map(({ id, next }) => ({ id, next })));
    const moveRows = (table, columns, conflict, extraSelect) => db.prepare(`INSERT INTO ${table} (ledger_id, entry_id, participant_id, ${columns}) SELECT c.ledger_id, c.entry_id, ?, ${extraSelect} FROM ${table} c WHERE c.ledger_id = ? AND c.participant_id = ? AND c.entry_id IN (${PENDING_SET}) ON CONFLICT (${conflict}) DO UPDATE SET amount_minor = amount_minor + excluded.amount_minor`).bind(targetId, ledgerId, sourceId, ledgerId, ids, mergeId);
    const dropRows = table => db.prepare(`DELETE FROM ${table} WHERE ledger_id = ? AND participant_id = ? AND entry_id IN (${PENDING_SET})`).bind(ledgerId, sourceId, ledgerId, ids, mergeId);
    await db.batch([
      db.prepare(INSERT_REVISION("revised")).bind(ledgerId, userId, JSON.stringify(part), ledgerId),
      moveRows("entry_cash_parties", "direction, amount_minor", "ledger_id, entry_id, participant_id, direction", "c.direction, c.amount_minor"),
      dropRows("entry_cash_parties"),
      moveRows("entry_allocations", "amount_minor", "ledger_id, entry_id, participant_id", "c.amount_minor"),
      dropRows("entry_allocations"),
      db.prepare(`UPDATE ledger_entries SET current_revision = current_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND status = 'active' AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?)) AND EXISTS (SELECT 1 FROM entry_revisions r WHERE r.ledger_id = ledger_entries.ledger_id AND r.entry_id = ledger_entries.id AND r.revision = ledger_entries.current_revision + 1 AND json_extract(r.snapshot_json, '$.personMerge') = ?)`).bind(ledgerId, ids, mergeId),
      db.prepare(INSERT_ITEMS("revised")).bind(ledgerId, mergeId, slim, ledgerId, mergeId),
    ]);
  }
}

const references = table => `EXISTS (SELECT 1 FROM ${table} x JOIN ledger_entries e ON e.ledger_id = x.ledger_id AND e.id = x.entry_id WHERE x.ledger_id = ? AND x.participant_id = ? AND e.status = 'active' AND ${VISIBLE_ENTRY_SQL})`;

// Cierra la unión: solo si ya ningún movimiento vigente apunta a la persona unida se la marca como unida, se traslada la
// cuenta, se resuelven las invitaciones y se escribe el evento y la revisión del libro, una sola vez (token de cierre).
async function finish(db, { plan, userId, mergeId }) {
  const ledger = plan.data.ledger;
  const sourceId = plan.source.id;
  const targetId = plan.target.id;
  const token = createPlatformId("finish");
  const mine = "EXISTS (SELECT 1 FROM person_merges WHERE ledger_id = ? AND id = ? AND status = 'applied' AND token = ?)";
  const mineArgs = [ledger.id, mergeId, token];
  await db.batch([
    db.prepare(`UPDATE person_merges SET status = 'applied', token = ?, changed = (SELECT COUNT(*) FROM person_merge_items WHERE ledger_id = ? AND merge_id = ? AND kind = 'revised'), voided = (SELECT COUNT(*) FROM person_merge_items WHERE ledger_id = ? AND merge_id = ? AND kind = 'voided') WHERE ledger_id = ? AND id = ? AND status = 'applying' AND NOT ${references("entry_cash_parties")} AND NOT ${references("entry_allocations")}`).bind(token, ledger.id, mergeId, ledger.id, mergeId, ledger.id, mergeId, ledger.id, sourceId, ledger.id, sourceId),
    db.prepare(`UPDATE invitations SET target_participant_id = ? WHERE group_id = ? AND status = 'pending' AND target_participant_id = ? AND NOT EXISTS (SELECT 1 FROM invitations x WHERE x.group_id = ? AND x.status = 'pending' AND x.target_participant_id = ?) AND EXISTS (SELECT 1 FROM ledger_participants WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL) AND ${mine}`).bind(targetId, ledger.group_id, sourceId, ledger.group_id, targetId, ledger.id, targetId, ...mineArgs),
    db.prepare(`UPDATE invitations SET status = 'canceled', resolved_at = CURRENT_TIMESTAMP WHERE group_id = ? AND status = 'pending' AND (target_participant_id = ? OR (? = 1 AND target_participant_id = ?)) AND ${mine}`).bind(ledger.group_id, sourceId, plan.accountMoves ? 1 : 0, targetId, ...mineArgs),
    db.prepare(`UPDATE ledger_participants SET active = 0, merged_into_id = ?, linked_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND ${mine}`).bind(targetId, ledger.id, sourceId, ...mineArgs),
    db.prepare(`UPDATE ledger_participants SET linked_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL AND ? IS NOT NULL AND ${mine}`).bind(plan.source.linkedUserId ?? null, ledger.id, targetId, plan.source.linkedUserId ?? null, ...mineArgs),
    db.prepare(`UPDATE ledger_participants SET merged_into_id = ? WHERE ledger_id = ? AND merged_into_id = ? AND ${mine}`).bind(targetId, ledger.id, sourceId, ...mineArgs),
    db.prepare(`INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) SELECT ?, ?, ?, 'person_merged', 'participant', ?, json_object('into', ?, 'changed', changed, 'voided', voided) FROM person_merges WHERE ledger_id = ? AND id = ? AND status = 'applied' AND token = ?`).bind(createPlatformId("event"), ledger.id, userId, sourceId, targetId, ledger.id, mergeId, token),
    db.prepare(`UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${mine}`).bind(ledger.id, ...mineArgs),
  ]);
  return db.prepare("SELECT * FROM person_merges WHERE ledger_id = ? AND id = ?").bind(ledger.id, mergeId).first();
}

function summarize(merge) {
  return { id: merge.id, sourceId: merge.source_id, targetId: merge.target_id, status: merge.status, planned: merge.planned, changed: merge.changed, voided: merge.voided };
}

// Paso 2: aplica. La clave de la confirmación identifica la unión: repetirla (o enviarla en simultáneo) devuelve la unión
// ya aplicada y, si se había cortado a la mitad, la completa sin duplicar nada. `hooks.beforeWrite` es solo para pruebas.
export async function applyMerge(db, { groupId, userId, sourceId, targetId, expectedRevision = null, key, hooks = {} }) {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw new LedgerError("Recargá la pantalla y volvé a intentar.");
  const access = await getLedgerAccess(db, groupId, userId);
  requireOwner(access, "unir personas");
  const mergeId = `merge_${key}`;
  let merge = await db.prepare("SELECT * FROM person_merges WHERE ledger_id = ? AND id = ?").bind(access.id, mergeId).first();
  if (merge && (merge.source_id !== sourceId || merge.target_id !== targetId)) throw new LedgerError("Esta solicitud ya se usó con otras personas. Recargá la pantalla y volvé a intentar.", 409);
  if (merge?.status === "applied") return summarize(merge);
  if (!merge) {
    const sameSource = await db.prepare("SELECT * FROM person_merges WHERE ledger_id = ? AND source_id = ?").bind(access.id, sourceId).first();
    if (sameSource && (sameSource.status === "applied" || sameSource.target_id !== targetId)) throw new LedgerError("Esa persona ya fue unida a otra.", 409);
    merge = sameSource ?? null;
  }
  let plan = await planMerge(db, { groupId, userId, sourceId, targetId });
  if (!merge) {
    if (expectedRevision !== null && Number(expectedRevision) !== plan.data.ledger.revision) throw new LedgerError("El grupo cambió desde la vista previa. Volvé a previsualizar antes de confirmar.", 409);
    const inserted = await db.prepare("INSERT OR IGNORE INTO person_merges (ledger_id, id, actor_user_id, source_id, target_id, planned) SELECT ?, ?, ?, ?, ?, ? WHERE (? IS NULL OR (SELECT revision FROM expense_ledgers WHERE id = ?) = ?)").bind(access.id, mergeId, userId, sourceId, targetId, plan.affected.length, expectedRevision, access.id, expectedRevision === null ? null : Number(expectedRevision)).run();
    if (!inserted.meta?.changes) {
      const raced = await db.prepare("SELECT * FROM person_merges WHERE ledger_id = ? AND (id = ? OR source_id = ?)").bind(access.id, mergeId, sourceId).first();
      if (!raced) throw new LedgerError("El grupo cambió desde la vista previa. Volvé a previsualizar antes de confirmar.", 409);
      if (raced.status === "applied") return summarize(raced);
      merge = raced;
    } else merge = { id: mergeId };
  }
  await hooks.beforeWrite?.();
  for (let round = 0; round < MAX_ROUNDS && plan.affected.length; round += 1) {
    await writeChunks(db, { plan, userId, mergeId: merge.id });
    plan = await planMerge(db, { groupId, userId, sourceId, targetId });
  }
  const done = await finish(db, { plan, userId, mergeId: merge.id });
  if (done?.status !== "applied") throw new LedgerError("La unión no terminó porque otras personas siguen cambiando movimientos. Repetí la confirmación.", 409);
  return summarize(done);
}

// Las uniones del grupo, de la más reciente a la más antigua, para mostrar «unida a …».
export async function readMerges(db, ledgerId) {
  const rows = await db.prepare("SELECT id, source_id, target_id, changed, voided, created_at FROM person_merges WHERE ledger_id = ? AND status = 'applied' ORDER BY created_at DESC, id").bind(ledgerId).all();
  return rows.results.map(row => ({ id: row.id, sourceId: row.source_id, targetId: row.target_id, changed: row.changed, voided: row.voided, createdAt: row.created_at }));
}
