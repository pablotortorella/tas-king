import { categoryForEntry, readCategories, resolveCategory } from "./categories.js";
import { chunkByBytes } from "./chunking.js";
import { LedgerError } from "./errors.js";
import { sha256Hex } from "./hash.js";
import { getLedgerAccess, readLedger } from "./ledger.js";
import { latestSnapshots, WRITE_CHUNK } from "./revisions.js";
import { listResults } from "./search.js";
import { suggestCategory } from "./suggest.js";
import { createPlatformId } from "./platform.js";
import { isPending } from "./suggest.js";

export { isPending };

// Máximo de movimientos por operación y tamaño de cada escritura. Se fijaron midiendo con D1 local (ver
// CASO-REAL-INTERNO.md); los límites de D1 remoto siguen sin verificarse.
export const MAX_BATCH = 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,120}$/u;
const SAMPLE_SIZE = 8;

// Resuelve el conjunto con el mismo código que usa la lista: ids explícitos, o la búsqueda y el filtro vigentes.
export function selectEntries(data, criteria) {
  if (criteria?.all) return listResults(data, { query: criteria.query, category: criteria.category, person: criteria.person });
  const ids = new Set((criteria?.ids ?? []).map(String));
  return data.entries.filter(entry => ids.has(entry.id));
}

// La clave de idempotencia identifica una solicitud concreta: la misma clave con otro criterio o categoría se rechaza.
function requestFingerprint(criteria, categoryId, kind) {
  const normalized = criteria?.all ? { all: true, query: criteria.query ?? "", category: criteria.category ?? "", person: criteria.person ?? "" } : { ids: [...new Set((criteria?.ids ?? []).map(String))].sort() };
  return sha256Hex(JSON.stringify({ criteria: normalized, categoryId, kind }));
}

function mayChange(ledger, userId, entry) {
  return entry.status === "active" && entry.type !== "transfer" && (ledger.role === "owner" || entry.createdByUserId === userId);
}

function money(value) { return new Intl.NumberFormat("es-CO").format(value); }

async function loadContext(db, { groupId, userId, criteria, categoryId, currentCategoryId = null }) {
  const data = await readLedger(db, { groupId, userId });
  if (data.ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
  const category = await categoryForEntry(db, { ledgerId: data.ledger.id, userId, categoryId, currentCategoryId });
  if (!category) throw new LedgerError("Elegí la categoría que querés aplicar.");
  const selected = selectEntries(data, criteria);
  if (!selected.length) throw new LedgerError("No hay movimientos seleccionados.");
  const eligible = [];
  const skipped = { voided: 0, permission: 0, unchanged: 0, transfers: 0 };
  for (const entry of selected) {
    if (entry.status !== "active") skipped.voided += 1;
    else if (entry.type === "transfer") skipped.transfers += 1;
    else if (!mayChange(data.ledger, userId, entry)) skipped.permission += 1;
    else if (entry.categoryInfo?.id === category.id) skipped.unchanged += 1;
    else eligible.push(entry);
  }
  return { data, category, selected, eligible, skipped };
}

function tooMany(count) {
  return new LedgerError(`Una operación admite hasta ${money(MAX_BATCH)} movimientos y este conjunto tiene ${money(count)}. Aplicala en partes: quedarían ${money(count - MAX_BATCH)} para repetirla.`, 413);
}

// Paso 1: cuántos cambiarían, una muestra y la revisión actual del libro. No escribe nada.
export async function previewRecategorization(db, { groupId, userId, criteria, categoryId }) {
  const { data, category, selected, eligible, skipped } = await loadContext(db, { groupId, userId, criteria, categoryId });
  if (eligible.length > MAX_BATCH) throw tooMany(eligible.length);
  return {
    count: eligible.length,
    selected: selected.length,
    sample: eligible.slice(0, SAMPLE_SIZE).map(entry => ({ id: entry.id, description: entry.description, occurredAt: entry.occurredAt, currency: entry.currency, totalMinor: entry.totalMinor, current: entry.categoryInfo?.name ?? null })),
    skipped,
    category: { id: category.id, name: category.name },
    ledgerRevision: data.ledger.revision,
  };
}

// Escribe una revisión por movimiento y un solo UPDATE por tanda. Las tres sentencias de cada tanda comparten la guarda
// «el movimiento sigue en la revisión que se vio», así que un movimiento corregido a mitad de camino simplemente no se toca.
async function writeChanges(db, { ledger, userId, batchId, changes, categoryName }) {
  const snapshots = await latestSnapshots(db, ledger.id, changes.map(change => change.entry.id));
  const prepared = changes.map(change => {
      const entry = change.entry;
      const previous = snapshots.get(entry.id) ?? { description: entry.description, note: entry.note, occurredAt: entry.occurredAt, type: entry.type, currency: entry.currency, totalMinor: entry.totalMinor, cashParties: entry.cashParties, allocations: entry.allocations, paymentMethod: entry.paymentMethod ?? null };
      const name = categoryName(change.categoryId);
      return {
        id: entry.id, rev: entry.revision, next: entry.revision + 1, categoryId: change.categoryId, previous: entry.categoryId ?? null,
        snapshot: { ...previous, categoryId: change.categoryId, categoryName: name, status: "active", recategorizationBatch: batchId },
      };
    });
  // Tandas de hasta WRITE_CHUNK movimientos y de tamaño acotado (una sentencia de D1 no admite ~100 KB).
  for (const part of chunkByBytes(prepared, { maxItems: WRITE_CHUNK })) {
    // Solo las revisiones llevan la instantánea completa; el UPDATE y los elementos del lote reciben únicamente lo que usan.
    const json = JSON.stringify(part);
    const slim = JSON.stringify(part.map(({ id, next, previous }) => ({ id, next, previous })));
    // El UPDATE va agrupado por categoría de destino y se guarda con «existe nuestra revisión como la siguiente del
    // movimiento»: así busca por clave primaria en lugar de recorrer el JSON por cada fila del libro.
    const targets = [...new Set(part.map(item => item.categoryId))];
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) SELECT ?, e.id, json_extract(j.value, '$.next'), ?, 'revised', json_extract(j.value, '$.snapshot') FROM json_each(?) j CROSS JOIN ledger_entries e ON e.ledger_id = ? AND e.id = json_extract(j.value, '$.id') AND e.current_revision = json_extract(j.value, '$.rev') AND e.status = 'active'").bind(ledger.id, userId, json, ledger.id),
      ...targets.map(target => db.prepare("UPDATE ledger_entries SET category_id = ?, current_revision = current_revision + 1, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND status = 'active' AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?)) AND EXISTS (SELECT 1 FROM entry_revisions r WHERE r.ledger_id = ledger_entries.ledger_id AND r.entry_id = ledger_entries.id AND r.revision = ledger_entries.current_revision + 1 AND json_extract(r.snapshot_json, '$.recategorizationBatch') = ?)").bind(target, ledger.id, JSON.stringify(part.filter(item => item.categoryId === target).map(({ id }) => ({ id }))), batchId)),
      db.prepare("INSERT OR IGNORE INTO recategorization_items (ledger_id, batch_id, entry_id, revision, previous_category_id) SELECT ?, ?, json_extract(j.value, '$.id'), json_extract(j.value, '$.next'), json_extract(j.value, '$.previous') FROM json_each(?) j CROSS JOIN entry_revisions r ON r.ledger_id = ? AND r.entry_id = json_extract(j.value, '$.id') AND r.revision = json_extract(j.value, '$.next') AND json_extract(r.snapshot_json, '$.recategorizationBatch') = ?").bind(ledger.id, batchId, slim, ledger.id, batchId),
    ]);
  }
}

// Cierra la operación: marca el lote como aplicado y, solo para quien ganó esa transición, escribe el evento y sube la
// revisión del libro (repetir la confirmación o dos pestañas no las duplican).
async function finish(db, { ledger, userId, batchId, skipped, extra = [] }) {
  const token = createPlatformId("finish");
  const mine = "EXISTS (SELECT 1 FROM recategorization_batches WHERE ledger_id = ? AND id = ? AND status = 'applied' AND token = ?)";
  await db.batch([
    db.prepare("UPDATE recategorization_batches SET status = 'applied', token = ?, skipped = ?, changed = (SELECT COUNT(*) FROM recategorization_items WHERE ledger_id = ? AND batch_id = ?) WHERE ledger_id = ? AND id = ? AND status = 'applying'").bind(token, skipped, ledger.id, batchId, ledger.id, batchId),
    db.prepare(`INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) SELECT ?, ?, ?, 'recategorization_applied', 'recategorization', ?, json_object('changed', (SELECT changed FROM recategorization_batches WHERE ledger_id = ? AND id = ?), 'skipped', ?) WHERE ${mine}`).bind(createPlatformId("event"), ledger.id, userId, batchId, ledger.id, batchId, skipped, ledger.id, batchId, token),
    db.prepare(`UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ${mine}`).bind(ledger.id, ledger.id, batchId, token),
    ...extra.map(statement => statement(token, mine)),
  ]);
  return db.prepare("SELECT id, kind, category_id, status, planned, changed, skipped, undo_of, undone_at, created_at FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(ledger.id, batchId).first();
}

function summarize(batch) {
  return { id: batch.id, kind: batch.kind, status: batch.status, planned: batch.planned, changed: batch.changed, skipped: batch.skipped, undoOf: batch.undo_of, undone: Boolean(batch.undone_at) };
}

// Paso 2: aplica. La clave de la confirmación es el identificador del lote: repetirla (o enviarla en simultáneo) devuelve el
// lote ya aplicado y, si se había cortado a la mitad, lo completa sin duplicar nada.
// `hooks.beforeWrite` es un punto de enganche solo para pruebas (simula un corte o una edición concurrente justo antes de escribir).
export async function applyRecategorization(db, { groupId, userId, criteria, categoryId, expectedRevision = null, key, kind = "bulk", hooks = {} }) {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw new LedgerError("Recargá la pantalla y volvé a intentar.");
  const ledgerAccess = await getLedgerAccess(db, groupId, userId);
  const batchId = `recat_${key}`;
  const fingerprint = await requestFingerprint(criteria, categoryId, kind);
  const existing = await db.prepare("SELECT * FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(ledgerAccess.id, batchId).first();
  if (existing && (existing.actor_user_id !== userId || (existing.request_hash && existing.request_hash !== fingerprint))) throw new LedgerError("Esta solicitud ya se usó con otros datos. Recargá la pantalla y volvé a intentar.", 409);
  const resuming = Boolean(existing && existing.status === "applying");
  if (existing && !resuming) return summarize(existing);
  const { data, category, selected, eligible } = await loadContext(db, { groupId, userId, criteria, categoryId });
  if (eligible.length > MAX_BATCH) throw tooMany(eligible.length);
  if (!resuming) {
    if (expectedRevision !== null && Number(expectedRevision) !== data.ledger.revision) throw new LedgerError("El grupo cambió desde la vista previa. Volvé a previsualizar antes de confirmar.", 409);
    if (!eligible.length) throw new LedgerError("No hay movimientos para cambiar: ya tienen esa categoría o no podés modificarlos.");
    const insert = await db.prepare("INSERT OR IGNORE INTO recategorization_batches (ledger_id, id, actor_user_id, kind, category_id, planned, request_hash) SELECT ?, ?, ?, ?, ?, ?, ? WHERE (? IS NULL OR (SELECT revision FROM expense_ledgers WHERE id = ?) = ?)").bind(data.ledger.id, batchId, userId, kind, category.id, eligible.length, fingerprint, expectedRevision, data.ledger.id, expectedRevision === null ? 0 : Number(expectedRevision)).run();
    if (!insert.meta?.changes) {
      const raced = await db.prepare("SELECT * FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(data.ledger.id, batchId).first();
      if (raced) return summarize(raced);
      throw new LedgerError("El grupo cambió desde la vista previa. Volvé a previsualizar antes de confirmar.", 409);
    }
  }
  // Al reanudar, los que ya se escribieron figuran como «ya tienen la categoría»: lo omitido es lo seleccionado menos lo planeado.
  const skippedCount = selected.length - (resuming ? existing.planned : eligible.length);
  const done = new Set((await db.prepare("SELECT entry_id FROM recategorization_items WHERE ledger_id = ? AND batch_id = ?").bind(data.ledger.id, batchId).all()).results.map(row => row.entry_id));
  const pending = eligible.filter(entry => !done.has(entry.id)).map(entry => ({ entry, categoryId: category.id }));
  await hooks.beforeWrite?.();
  await writeChanges(db, { ledger: data.ledger, userId, batchId, changes: pending, categoryName: () => category.name });
  return summarize(await finish(db, { ledger: data.ledger, userId, batchId, skipped: skippedCount }));
}

export async function readRecategorizationBatch(db, { groupId, userId, batchId }) {
  const ledger = await getLedgerAccess(db, groupId, userId);
  const batch = await db.prepare("SELECT b.*, u.display_name AS actor_name FROM recategorization_batches b JOIN users u ON u.id = b.actor_user_id WHERE b.ledger_id = ? AND b.id = ?").bind(ledger.id, batchId).first();
  if (!batch) throw new LedgerError("Operación no encontrada.", 404);
  const categories = await readCategories(db, ledger.id);
  return { ...summarize(batch), actorName: batch.actor_name, actorUserId: batch.actor_user_id, createdAt: batch.created_at, categoryName: resolveCategory(categories, batch.category_id)?.name ?? null, canUndo: batch.status === "applied" && batch.kind !== "undo" && !batch.undone_at && (ledger.role === "owner" || batch.actor_user_id === userId) };
}

// Deshacer: restaura la categoría anterior solo de los movimientos cuya revisión vigente sigue siendo la del lote. Los
// que se modificaron después quedan como están y se informan.
export async function undoRecategorization(db, { groupId, userId, batchId, key = null }) {
  const ledger = await getLedgerAccess(db, groupId, userId);
  if (ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
  const batch = await db.prepare("SELECT * FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(ledger.id, batchId).first();
  if (!batch) throw new LedgerError("Operación no encontrada.", 404);
  if (batch.kind === "undo") throw new LedgerError("Un deshacer no se deshace: volvé a aplicar la categoría.", 409);
  if (ledger.role !== "owner" && batch.actor_user_id !== userId) throw new LedgerError("Sólo quien aplicó la operación o la persona titular puede deshacerla.", 403);
  if (batch.status !== "applied") throw new LedgerError("La operación todavía no terminó.", 409);
  if (batch.undone_at) throw new LedgerError("Esta operación ya se deshizo.", 409);
  const undoId = `recat_undo_${batchId.replace(/^recat_/u, "")}`;
  const existingUndo = await db.prepare("SELECT * FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(ledger.id, undoId).first();
  if (existingUndo?.status === "applied") return { ...summarize(existingUndo), kept: [] };
  const items = (await db.prepare("SELECT entry_id, revision, previous_category_id FROM recategorization_items WHERE ledger_id = ? AND batch_id = ?").bind(ledger.id, batchId).all()).results;
  const data = await readLedger(db, { groupId, userId });
  const byId = new Map(data.entries.map(entry => [entry.id, entry]));
  const categories = data.categories;
  const changes = [];
  const kept = [];
  for (const item of items) {
    const entry = byId.get(item.entry_id);
    if (!entry || entry.revision !== item.revision || entry.status !== "active") { kept.push({ id: item.entry_id, description: entry?.description ?? "Movimiento", reason: entry?.status === "voided" ? "se anuló después" : "se modificó después" }); continue; }
    changes.push({ entry, categoryId: item.previous_category_id });
  }
  if (!existingUndo) {
    const inserted = await db.prepare("INSERT OR IGNORE INTO recategorization_batches (ledger_id, id, actor_user_id, kind, category_id, planned, undo_of) VALUES (?, ?, ?, 'undo', NULL, ?, ?)").bind(ledger.id, undoId, userId, changes.length, batchId).run();
    if (!inserted.meta?.changes) {
      const raced = await db.prepare("SELECT * FROM recategorization_batches WHERE ledger_id = ? AND id = ?").bind(ledger.id, undoId).first();
      if (raced?.status === "applied") return { ...summarize(raced), kept: [] };
    }
  }
  const nameOf = id => (id ? resolveCategory(categories, id)?.name ?? null : null);
  await writeChanges(db, { ledger, userId, batchId: undoId, changes, categoryName: nameOf });
  const markUndone = (token, mine) => db.prepare(`UPDATE recategorization_batches SET undone_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND undone_at IS NULL AND ${mine}`).bind(ledger.id, batchId, ledger.id, undoId, token);
  const done = await finish(db, { ledger, userId, batchId: undoId, skipped: kept.length, extra: [markUndone] });
  return { ...summarize(done), kept };
}

// Clasificar rápido: asigna una categoría a un solo movimiento con el mismo mecanismo (tipo «quick»), así se puede deshacer.
export async function classifyOne(db, { groupId, userId, entryId, categoryId, key }) {
  return applyRecategorization(db, { groupId, userId, criteria: { ids: [entryId] }, categoryId, expectedRevision: null, key, kind: "quick" });
}

// ---------------------------------------------------------------------------------------------------------------
// Clasificar rápido: la cola de pendientes, las categorías recientes y lo que necesita la pantalla.

export const RECENT_CATEGORY_LIMIT = 5;

// La cola: los pendientes del usuario (la persona titular ve todos; un integrante, los suyos) en el orden de la lista; los
// saltados van al final en el orden en que se saltaron.
export function classifyQueue(data, userId, skipped = []) {
  const mine = entry => data.ledger.role === "owner" || entry.createdByUserId === userId;
  const pending = data.entries.filter(entry => isPending(entry) && mine(entry));
  const fresh = pending.filter(entry => !skipped.includes(entry.id));
  const later = skipped.map(id => pending.find(entry => entry.id === id)).filter(Boolean);
  const [current = null] = [...fresh, ...later];
  return { pending, current, remaining: pending.length };
}

// Las categorías que se ofrecen con atajo numérico: primero las que esta persona usó hace poco y después las más usadas
// entre los movimientos ya categorizados. Solo vigentes y sin repetir.
export function rankCategories({ categories, entries, recentIds, limit = RECENT_CATEGORY_LIMIT }) {
  const usage = new Map();
  for (const entry of entries) if (entry.status === "active" && entry.categoryInfo && !isPending(entry)) usage.set(entry.categoryInfo.id, (usage.get(entry.categoryInfo.id) ?? 0) + 1);
  const ranked = [...new Set([...recentIds, ...[...usage].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([id]) => id)])];
  const active = new Map(categories.filter(category => category.status === "active").map(category => [category.id, category]));
  return ranked.map(id => active.get(id)).filter(Boolean).slice(0, limit);
}

// Todo lo que la pantalla necesita para mostrar el siguiente pendiente.
export async function readClassifyContext(db, { groupId, userId, skipped = [] }) {
  const data = await readLedger(db, { groupId, userId });
  if (data.ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
  const { current, remaining } = classifyQueue(data, userId, skipped);
  const recentIds = (await db.prepare("SELECT category_id FROM recategorization_batches WHERE ledger_id = ? AND actor_user_id = ? AND kind != 'undo' AND category_id IS NOT NULL ORDER BY rowid DESC LIMIT 40").bind(data.ledger.id, userId).all()).results.map(row => row.category_id);
  const lastRow = await db.prepare("SELECT id FROM recategorization_batches WHERE ledger_id = ? AND actor_user_id = ? AND kind = 'quick' AND status = 'applied' AND undone_at IS NULL ORDER BY rowid DESC LIMIT 1").bind(data.ledger.id, userId).first();
  const categorized = data.entries.filter(entry => entry.status === "active" && entry.categoryInfo && !isPending(entry));
  return {
    data, current, remaining,
    suggestion: current ? suggestCategory(current, categorized) : null,
    recents: rankCategories({ categories: data.categories, entries: data.entries, recentIds }),
    last: lastRow ? await readRecategorizationBatch(db, { groupId, userId, batchId: lastRow.id }) : null,
  };
}
