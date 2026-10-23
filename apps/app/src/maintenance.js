export const EPHEMERAL_RETENTION_DAYS = 30;

export async function runMaintenance(db, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  const expiredInvitations = await db.prepare("UPDATE invitations SET status = 'expired', resolved_at = ? WHERE status = 'pending' AND datetime(expires_at) <= datetime(?)").bind(timestamp, timestamp).run();
  await db.prepare("INSERT OR IGNORE INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) SELECT 'audit_invitation_expired_' || id, NULL, space_id, 'invitation_expired', 'invitation', id FROM invitations WHERE status = 'expired'").run();
  const deletedSessions = await db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?, '-30 days') OR (revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime(?, '-30 days'))").bind(timestamp, timestamp).run();
  const deletedImportPreviews = await db.prepare("DELETE FROM splitwise_import_previews WHERE datetime(expires_at) <= datetime(?)").bind(timestamp).run();
  const staleBatches = await db.prepare("SELECT id FROM splitwise_import_batches WHERE status = 'pending' AND datetime(created_at) <= datetime(?, '-1 day')").bind(timestamp).all();
  for (const batch of staleBatches.results) await db.batch([
    db.prepare("DELETE FROM splitwise_import_effects WHERE entry_id IN (SELECT id FROM splitwise_import_entries WHERE batch_id = ?)").bind(batch.id),
    db.prepare("DELETE FROM splitwise_import_entries WHERE batch_id = ?").bind(batch.id),
    db.prepare("DELETE FROM ledger_participants WHERE pending_import_batch_id = ?").bind(batch.id),
    db.prepare("DELETE FROM splitwise_import_batches WHERE id = ? AND status = 'pending'").bind(batch.id),
  ]);
  return {
    expiredInvitations: expiredInvitations.meta?.changes ?? 0,
    deletedSessions: deletedSessions.meta?.changes ?? 0,
    deletedImportPreviews: deletedImportPreviews.meta?.changes ?? 0,
    deletedPendingImports: staleBatches.results.length,
  };
}
