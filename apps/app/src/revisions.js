// Lectura compartida por las operaciones que revisan muchos movimientos (recategorización, unión de personas).
export const WRITE_CHUNK = 100;

// Instantánea de la revisión vigente de cada movimiento, de a WRITE_CHUNK ids por consulta.
export async function latestSnapshots(db, ledgerId, ids) {
  const found = new Map();
  for (let start = 0; start < ids.length; start += WRITE_CHUNK) {
    const part = ids.slice(start, start + WRITE_CHUNK);
    const rows = (await db.prepare("SELECT r.entry_id, r.snapshot_json FROM entry_revisions r JOIN ledger_entries e ON e.ledger_id = r.ledger_id AND e.id = r.entry_id AND e.current_revision = r.revision WHERE r.ledger_id = ? AND r.entry_id IN (SELECT value FROM json_each(?))").bind(ledgerId, JSON.stringify(part)).all()).results;
    for (const row of rows) found.set(row.entry_id, JSON.parse(row.snapshot_json));
  }
  return found;
}
