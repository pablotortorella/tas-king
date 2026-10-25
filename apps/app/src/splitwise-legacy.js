import { inferComponents } from "./import-infer.js";
import { findCategoryByName, readCategories, resolveCategory } from "./categories.js";
import { createPlatformId } from "./platform.js";
import { IMPORTED_GROUP } from "./category-data.js";
import { searchable } from "./text.js";

// Conversión (idempotente) de los lotes publicados con el modelo anterior (tablas splitwise_import_entries y
// splitwise_import_effects, un efecto por persona) a movimientos normales, antes de retirar esas tablas con ops/retire-legacy-import-tables.sql. La corre el mantenimiento diario mientras existan; verifica que el
// saldo de cada persona sea idéntico antes y después y recién entonces borra las filas viejas.
export async function convertLegacyImports(db) {
  const batches = (await db.prepare("SELECT id, ledger_id, actor_user_id FROM splitwise_import_batches WHERE status = 'committed' AND EXISTS (SELECT 1 FROM splitwise_import_entries e WHERE e.batch_id = splitwise_import_batches.id)").all()).results;
  const report = [];
  for (const batch of batches) {
    const entries = (await db.prepare("SELECT * FROM splitwise_import_entries WHERE batch_id = ? ORDER BY source_row_number").bind(batch.id).all()).results;
    const effectRows = (await db.prepare("SELECT x.entry_id, x.participant_id, x.amount_minor FROM splitwise_import_effects x JOIN splitwise_import_entries e ON e.ledger_id = x.ledger_id AND e.id = x.entry_id WHERE e.batch_id = ?").bind(batch.id).all()).results;
    const byEntry = new Map();
    for (const row of effectRows) { if (!byEntry.has(row.entry_id)) byEntry.set(row.entry_id, []); byEntry.get(row.entry_id).push({ participantId: row.participant_id, amountMinor: row.amount_minor }); }
    const currencyOf = new Map(entries.map(entry => [entry.id, entry.currency_code]));
    const before = new Map();
    for (const row of effectRows) {
      const key = `${currencyOf.get(row.entry_id)}:${row.participant_id}`;
      before.set(key, (before.get(key) ?? 0) + row.amount_minor);
    }
    const categories = await readCategories(db, batch.ledger_id);
    const wanted = new Map();
    for (const entry of entries) { const key = searchable(entry.category); if (key && !findCategoryByName(categories, entry.category) && !wanted.has(key)) wanted.set(key, entry.category.trim()); }
    const statements = [];
    if (wanted.size) {
      const position = categories.reduce((max, category) => Math.max(max, category.position), 0);
      statements.push(db.prepare("INSERT OR IGNORE INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, icon, position) SELECT ?, 'category_' || lower(hex(randomblob(12))), json_extract(value, '$.name'), json_extract(value, '$.name_key'), ?, ?, 'tag', ? + CAST(key AS INTEGER) + 1 FROM json_each(?)").bind(batch.ledger_id, IMPORTED_GROUP, searchable(IMPORTED_GROUP), position, JSON.stringify([...wanted].map(([nameKey, name]) => ({ name, name_key: nameKey })))));
    }
    await db.batch(statements.length ? statements : [db.prepare("SELECT 1")]);
    const all = await readCategories(db, batch.ledger_id);
    let converted = 0;
    let skipped = 0;
    for (const entry of entries) {
      const effects = byEntry.get(entry.id) ?? [];
      const fallback = effects[0]?.participantId ?? null;
      const result = inferComponents({ totalMinor: entry.total_minor, effects, fallbackParticipantId: fallback });
      if (!result.ok) throw new Error(`Fila ${entry.source_row_number} del lote ${batch.id} no se puede convertir: ${result.reason}`);
      const found = findCategoryByName(all, entry.category);
      const categoryId = found ? resolveCategory(all, found.id)?.id ?? found.id : null;
      const snapshot = { description: entry.description, note: "", occurredAt: entry.occurred_at, type: "expense", currency: entry.currency_code, totalMinor: entry.total_minor, cashParties: result.cashParties, allocations: result.allocations, categoryId, categoryName: found?.name ?? null, status: "active", importedFrom: { batchId: batch.id, line: entry.source_row_number, legacy: true } };
      const exists = await db.prepare("SELECT 1 AS present FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(batch.ledger_id, entry.id).first();
      if (exists) { skipped += 1; continue; }
      await db.batch([
        db.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, created_by_user_id, category_id, import_batch_id, source_row_number, inferred) VALUES (?, ?, 'expense', ?, ?, ?, '', ?, ?, ?, ?, ?, 1)").bind(batch.ledger_id, entry.id, entry.currency_code, entry.total_minor, entry.description, entry.occurred_at, batch.actor_user_id, categoryId, batch.id, entry.source_row_number),
        db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES (?, ?, 1, ?, 'created', ?)").bind(batch.ledger_id, entry.id, batch.actor_user_id, JSON.stringify(snapshot)),
        ...result.cashParties.map(party => db.prepare("INSERT INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES (?, ?, ?, 'out', ?)").bind(batch.ledger_id, entry.id, party.participantId, party.amountMinor)),
        ...result.allocations.map(share => db.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES (?, ?, ?, ?)").bind(batch.ledger_id, entry.id, share.participantId, share.amountMinor)),
        db.prepare("INSERT INTO import_source_rows (ledger_id, entry_id, batch_id, source_row_number, raw_json) VALUES (?, ?, ?, ?, ?)").bind(batch.ledger_id, entry.id, batch.id, entry.source_row_number, JSON.stringify({ line: entry.source_row_number, legacy: true, description: entry.description, category: entry.category })),
      ]);
      converted += 1;
    }
    // Verificación: el saldo de cada persona y moneda debe ser el mismo antes y después de convertir.
    const after = (await db.prepare("SELECT e.currency_code AS currency, c.participant_id AS pid, SUM(c.amount_minor) AS amount FROM entry_cash_parties c JOIN ledger_entries e ON e.ledger_id = c.ledger_id AND e.id = c.entry_id WHERE e.import_batch_id = ? GROUP BY 1, 2").bind(batch.id).all()).results;
    const owed = (await db.prepare("SELECT e.currency_code AS currency, a.participant_id AS pid, SUM(a.amount_minor) AS amount FROM entry_allocations a JOIN ledger_entries e ON e.ledger_id = a.ledger_id AND e.id = a.entry_id WHERE e.import_batch_id = ? GROUP BY 1, 2").bind(batch.id).all()).results;
    const net = new Map();
    for (const row of after) net.set(`${row.currency}:${row.pid}`, (net.get(`${row.currency}:${row.pid}`) ?? 0) + row.amount);
    for (const row of owed) net.set(`${row.currency}:${row.pid}`, (net.get(`${row.currency}:${row.pid}`) ?? 0) - row.amount);
    for (const key of new Set([...before.keys(), ...net.keys()])) {
      if ((before.get(key) ?? 0) !== (net.get(key) ?? 0)) throw new Error(`El saldo ${key} cambió al convertir el lote ${batch.id}: ${before.get(key) ?? 0} antes, ${net.get(key) ?? 0} después.`);
    }
    await db.batch([
      db.prepare("DELETE FROM splitwise_import_effects WHERE (ledger_id, entry_id) IN (SELECT ledger_id, id FROM splitwise_import_entries WHERE batch_id = ?)").bind(batch.id),
      db.prepare("DELETE FROM splitwise_import_entries WHERE batch_id = ?").bind(batch.id),
      db.prepare("UPDATE splitwise_import_batches SET planned_count = imported_count WHERE id = ?").bind(batch.id),
      db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, 'splitwise_import_converted', 'import', ?, ?)").bind(createPlatformId("event"), batch.ledger_id, batch.actor_user_id, batch.id, JSON.stringify({ converted, skipped })),
    ]);
    report.push({ batchId: batch.id, converted, skipped });
  }
  return report;
}
