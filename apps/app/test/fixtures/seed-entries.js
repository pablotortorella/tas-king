// Siembra movimientos directamente en la base (rápido, para pruebas de escala): gastos de 100,00 pagados por la primera
// persona y repartidos entre las dos, con su revisión inicial. No pasa por saveEntry a propósito.
export async function seedEntries(db, { ledgerId, userId, payerId, otherId, count, prefix = "Movimiento", categoryId = null, categoryName = null, day = "2026-05-01", idPrefix = "seed", note = "" }) {
  for (let start = 0; start < count; start += 150) {
    const rows = Array.from({ length: Math.min(150, count - start) }, (_, offset) => {
      const index = start + offset;
      const id = `${idPrefix}_${String(index).padStart(6, "0")}`;
      return { id, description: `${prefix} ${index}`, snapshot: { description: `${prefix} ${index}`, note, occurredAt: day, type: "expense", currency: "COP", totalMinor: 10000, cashParties: [{ participantId: payerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: payerId, amountMinor: 5000 }, { participantId: otherId, amountMinor: 5000 }], categoryId, categoryName, status: "active" } };
    });
    const json = JSON.stringify(rows);
    await db.batch([
      db.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, created_by_user_id, category_id) SELECT ?, json_extract(value, '$.id'), 'expense', 'COP', 10000, json_extract(value, '$.description'), ?, ?, ?, ? FROM json_each(?)").bind(ledgerId, note, day, userId, categoryId, json),
      db.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) SELECT ?, json_extract(value, '$.id'), 1, ?, 'created', json_extract(value, '$.snapshot') FROM json_each(?)").bind(ledgerId, userId, json),
      db.prepare("INSERT INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) SELECT ?, json_extract(value, '$.id'), ?, 'out', 10000 FROM json_each(?)").bind(ledgerId, payerId, json),
      db.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) SELECT ?, json_extract(value, '$.id'), ?, 5000 FROM json_each(?)").bind(ledgerId, payerId, json),
      db.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) SELECT ?, json_extract(value, '$.id'), ?, 5000 FROM json_each(?)").bind(ledgerId, otherId, json),
    ]);
  }
}
