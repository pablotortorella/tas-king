import { getLedgerAccess, LedgerError } from "./ledger.js";
import { recordLedgerChange } from "./ledger-events.js";

// Archivar deja el libro de sólo lectura (lecturas y exportación siguen funcionando) y es reversible.
// Lo hace únicamente el titular y queda auditado en ledger_events.
export async function setLedgerArchived(db, { spaceId, userId, archived }) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede archivar o restaurar el grupo.", 403);
  if (Boolean(ledger.archived_at) === archived) throw new LedgerError(archived ? "El grupo ya está archivado." : "El grupo no está archivado.", 409);
  await db.batch([
    db.prepare(`UPDATE expense_ledgers SET archived_at = ${archived ? "CURRENT_TIMESTAMP" : "NULL"}, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(ledger.id),
    ...recordLedgerChange(db, { ledgerId: ledger.id, userId, action: archived ? "ledger_archived" : "ledger_restored", entityType: "ledger", entityId: ledger.id }),
  ]);
}

export async function assertLedgerWritable(db, spaceId, userId) {
  const ledger = await getLedgerAccess(db, spaceId, userId);
  if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
  return ledger;
}
