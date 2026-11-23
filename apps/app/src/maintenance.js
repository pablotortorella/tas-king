import { discardImportBatch } from "./splitwise-import.js";
import { addDays, colombiaDay, isClosed } from "./usage-periods.js";

export const EPHEMERAL_RETENTION_DAYS = 30;

export async function runMaintenance(db, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  const expiredInvitations = await db.prepare("UPDATE invitations SET status = 'expired', resolved_at = ? WHERE status = 'pending' AND datetime(expires_at) <= datetime(?)").bind(timestamp, timestamp).run();
  await db.prepare("INSERT OR IGNORE INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) SELECT 'audit_invitation_expired_' || id, NULL, group_id, 'invitation_expired', 'invitation', id FROM invitations WHERE status = 'expired'").run();
  const deletedSessions = await db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime(?, '-30 days') OR (revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime(?, '-30 days'))").bind(timestamp, timestamp).run();
  // Las filas de una vista previa vencida se van con ella; las que quedaron sin dueño (vista previa o lote) también.
  const deletedImportPreviews = await db.prepare("DELETE FROM splitwise_import_previews WHERE datetime(expires_at) <= datetime(?)").bind(timestamp).run();
  await db.prepare("DELETE FROM splitwise_import_rows WHERE owner_id NOT IN (SELECT id FROM splitwise_import_previews) AND owner_id NOT IN (SELECT id FROM splitwise_import_batches)").run();
  const staleBatches = await db.prepare("SELECT b.id FROM splitwise_import_batches b WHERE b.status = 'pending' AND datetime(COALESCE((SELECT MAX(e.created_at) FROM ledger_entries e WHERE e.import_batch_id = b.id), b.created_at)) <= datetime(?, '-1 day')").bind(timestamp).all();
  for (const batch of staleBatches.results) await discardImportBatch(db, batch.id);
  const purgedUsageMarkers = await purgeClosedUsageMarkers(db, now);
  const usageSnapshotDay = await saveSuiteSnapshot(db, now);
  return {
    expiredInvitations: expiredInvitations.meta?.changes ?? 0,
    deletedSessions: deletedSessions.meta?.changes ?? 0,
    deletedImportPreviews: deletedImportPreviews.meta?.changes ?? 0,
    deletedPendingImports: staleBatches.results.length,
    purgedUsageMarkers,
    usageSnapshotDay,
  };
}

// Estadística de uso (consola-administracion-homesuite, D7). Las marcas de un período se borran cuando el período termina (su último día
// es anterior al día de hoy en Colombia); los contadores de personas quedan para siempre. Si un día el cron no corre, la corrida
// siguiente borra todo lo vencido.
export async function purgeClosedUsageMarkers(db, now = new Date()) {
  const today = colombiaDay(now);
  const { results } = await db.prepare("SELECT DISTINCT period_type, period_key FROM usage_period_markers").all();
  const closed = results.filter((row) => isClosed(row.period_type, row.period_key, today));
  if (!closed.length) return 0;
  const outcomes = await db.batch(closed.map((row) => db.prepare("DELETE FROM usage_period_markers WHERE period_type = ? AND period_key = ?").bind(row.period_type, row.period_key)));
  return outcomes.reduce((total, outcome) => total + (outcome.meta?.changes ?? 0), 0);
}

// Foto del día de Colombia que termina (el cron de producción corre a las 23:23 de Colombia): cuentas y personas cuya última actividad
// cae en el día, en los últimos 7 y en los últimos 30. Dos corridas el mismo día dejan una sola foto, con los valores de la última.
export async function saveSuiteSnapshot(db, now = new Date()) {
  const day = colombiaDay(now);
  await db.prepare("INSERT OR REPLACE INTO usage_suite_snapshots (day, accounts, active_1d, active_7d, active_30d) SELECT ?, COUNT(*), COALESCE(SUM(last_active_on >= ?), 0), COALESCE(SUM(last_active_on >= ?), 0), COALESCE(SUM(last_active_on >= ?), 0) FROM users")
    .bind(day, day, addDays(day, -6), addDays(day, -29)).run();
  return day;
}
