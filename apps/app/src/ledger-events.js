import { createPlatformId } from "./platform.js";

// Cada escritura que cambia un libro deja un evento en su línea de tiempo y sube la revisión del libro (la usan las vistas
// previas para detectar que algo cambió). Devuelve las dos sentencias para sumarlas al mismo lote de la escritura.
export function recordLedgerChange(db, { ledgerId, userId, action, entityType, entityId, metadata = null }) {
  const event = metadata
    ? db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(createPlatformId("event"), ledgerId, userId, action, entityType, entityId, JSON.stringify(metadata))
    : db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?)").bind(createPlatformId("event"), ledgerId, userId, action, entityType, entityId);
  return [event, db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ledgerId)];
}
