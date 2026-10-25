import { discardImportBatch } from "./splitwise-import.js";
import { convertLegacyImports } from "./splitwise-legacy.js";

export const EPHEMERAL_RETENTION_DAYS = 30;

export async function runMaintenance(db, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  const expiredInvitations = await db.prepare("UPDATE invitations SET status = 'expired', resolved_at = ? WHERE status = 'pending' AND datetime(expires_at) <= datetime(?)").bind(timestamp, timestamp).run();
  await db.prepare("INSERT OR IGNORE INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) SELECT 'audit_invitation_expired_' || id, NULL, space_id, 'invitation_expired', 'invitation', id FROM invitations WHERE status = 'expired'").run();
  const deletedSessions = await db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?, '-30 days') OR (revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime(?, '-30 days'))").bind(timestamp, timestamp).run();
  // Las filas de una vista previa vencida se van con ella; las que quedaron sin dueño (vista previa o lote) también.
  const deletedImportPreviews = await db.prepare("DELETE FROM splitwise_import_previews WHERE datetime(expires_at) <= datetime(?)").bind(timestamp).run();
  await db.prepare("DELETE FROM splitwise_import_rows WHERE owner_id NOT IN (SELECT id FROM splitwise_import_previews) AND owner_id NOT IN (SELECT id FROM splitwise_import_batches)").run();
  const staleBatches = await db.prepare("SELECT b.id FROM splitwise_import_batches b WHERE b.status = 'pending' AND datetime(COALESCE((SELECT MAX(e.created_at) FROM ledger_entries e WHERE e.import_batch_id = b.id), b.created_at)) <= datetime(?, '-1 day')").bind(timestamp).all();
  for (const batch of staleBatches.results) await discardImportBatch(db, batch.id);
  const legacyConverted = await convertLegacyBatches(db);
  return {
    expiredInvitations: expiredInvitations.meta?.changes ?? 0,
    deletedSessions: deletedSessions.meta?.changes ?? 0,
    deletedImportPreviews: deletedImportPreviews.meta?.changes ?? 0,
    deletedPendingImports: staleBatches.results.length,
    convertedLegacyBatches: legacyConverted,
  };
}

// Los lotes importados con el modelo anterior se convierten solos mientras sus tablas existan (verifica los saldos antes y
// después). Si las tablas ya se retiraron no hay nada que hacer; cualquier otro fallo se registra sin frenar el resto.
async function convertLegacyBatches(db) {
  try { return (await convertLegacyImports(db)).length; }
  catch (error) {
    if (!/no such table/iu.test(String(error?.message))) console.error("[homesuite-app]", JSON.stringify({ event: "legacy_import_conversion_failed", errorName: error instanceof Error ? error.name : "UnknownError" }));
    return 0;
  }
}
