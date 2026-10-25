-- Datos sintéticos para recorrer Cuentas Claras en local ("Casa compartida" del rediseño).
-- Idempotente: se puede ejecutar varias veces. Nada de esto es información real.

INSERT OR IGNORE INTO users (id, google_sub, email, display_name) VALUES
  ('user_demo_pablo', 'local:pablo@example.test', 'pablo@example.test', 'Pablo'),
  ('user_demo_laura', 'local:laura@example.test', 'laura@example.test', 'Laura');

INSERT OR IGNORE INTO spaces (id, name, slug) VALUES ('space_demo_casa', 'Casa compartida', 'casa-compartida');
INSERT OR IGNORE INTO memberships (space_id, user_id, role) VALUES
  ('space_demo_casa', 'user_demo_pablo', 'owner'),
  ('space_demo_casa', 'user_demo_laura', 'member');

INSERT OR IGNORE INTO expense_ledgers (id, space_id, default_currency) VALUES ('ledger_demo_casa', 'space_demo_casa', 'COP');
INSERT OR IGNORE INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES
  ('ledger_demo_casa', 'participant_demo_pablo', 'Pablo', 'user_demo_pablo'),
  ('ledger_demo_casa', 'participant_demo_laura', 'Laura', 'user_demo_laura'),
  ('ledger_demo_casa', 'participant_demo_ana', 'Ana', NULL),
  ('ledger_demo_casa', 'participant_demo_mateo', 'Mateo', NULL);

-- Ana tiene una invitación pendiente vinculada a su participante; Mateo no tiene cuenta.
INSERT OR IGNORE INTO invitations (id, space_id, invitee_email, inviter_user_id, target_participant_id) VALUES
  ('invite_demo_ana', 'space_demo_casa', 'ana@example.test', 'user_demo_pablo', 'participant_demo_ana');

-- Movimientos propios (importes en unidad menor: COP tiene 2 decimales).
INSERT OR IGNORE INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, note, occurred_at, status, current_revision, created_by_user_id) VALUES
  ('ledger_demo_casa', 'entry_demo_super', 'expense', 'COP', 28640000, 'Supermercado Éxito', '', '2026-10-22', 'active', 1, 'user_demo_pablo'),
  ('ledger_demo_casa', 'entry_demo_alquiler', 'income', 'COP', 180000000, 'Alquiler apto Laureles', 'Pago del inquilino', '2026-10-20', 'active', 2, 'user_demo_pablo'),
  ('ledger_demo_casa', 'entry_demo_adelanto', 'transfer', 'COP', 15000000, 'Adelanto para la feria', '', '2026-10-18', 'active', 1, 'user_demo_pablo'),
  ('ledger_demo_casa', 'entry_demo_seguro', 'expense', 'USD', 12000, 'Seguro de viaje', '', '2026-10-09', 'active', 1, 'user_demo_laura'),
  ('ledger_demo_casa', 'entry_demo_cena', 'expense', 'COP', 12000000, 'Cena de cumpleaños', 'Anulada: se pagó en efectivo aparte', '2026-10-03', 'voided', 2, 'user_demo_pablo');

INSERT OR IGNORE INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES
  ('ledger_demo_casa', 'entry_demo_super', 'participant_demo_pablo', 'out', 28640000),
  ('ledger_demo_casa', 'entry_demo_alquiler', 'participant_demo_ana', 'in', 180000000),
  ('ledger_demo_casa', 'entry_demo_adelanto', 'participant_demo_pablo', 'out', 15000000),
  ('ledger_demo_casa', 'entry_demo_adelanto', 'participant_demo_laura', 'in', 15000000),
  ('ledger_demo_casa', 'entry_demo_seguro', 'participant_demo_laura', 'out', 12000),
  ('ledger_demo_casa', 'entry_demo_cena', 'participant_demo_pablo', 'out', 12000000);

INSERT OR IGNORE INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES
  ('ledger_demo_casa', 'entry_demo_super', 'participant_demo_pablo', 7160000),
  ('ledger_demo_casa', 'entry_demo_super', 'participant_demo_laura', 7160000),
  ('ledger_demo_casa', 'entry_demo_super', 'participant_demo_ana', 7160000),
  ('ledger_demo_casa', 'entry_demo_super', 'participant_demo_mateo', 7160000),
  ('ledger_demo_casa', 'entry_demo_alquiler', 'participant_demo_ana', 90000000),
  ('ledger_demo_casa', 'entry_demo_alquiler', 'participant_demo_pablo', 90000000),
  ('ledger_demo_casa', 'entry_demo_seguro', 'participant_demo_laura', 4000),
  ('ledger_demo_casa', 'entry_demo_seguro', 'participant_demo_ana', 4000),
  ('ledger_demo_casa', 'entry_demo_seguro', 'participant_demo_pablo', 4000),
  ('ledger_demo_casa', 'entry_demo_cena', 'participant_demo_pablo', 3000000),
  ('ledger_demo_casa', 'entry_demo_cena', 'participant_demo_laura', 3000000),
  ('ledger_demo_casa', 'entry_demo_cena', 'participant_demo_ana', 3000000),
  ('ledger_demo_casa', 'entry_demo_cena', 'participant_demo_mateo', 3000000);

INSERT OR IGNORE INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json, created_at) VALUES
  ('ledger_demo_casa', 'entry_demo_super', 1, 'user_demo_pablo', 'created', '{"description":"Supermercado Éxito","totalMinor":28640000,"currency":"COP","status":"active"}', '2026-10-22 18:05:00'),
  ('ledger_demo_casa', 'entry_demo_alquiler', 1, 'user_demo_pablo', 'created', '{"description":"Alquiler apto Laureles","totalMinor":175000000,"currency":"COP","status":"active"}', '2026-10-20 18:05:00'),
  ('ledger_demo_casa', 'entry_demo_alquiler', 2, 'user_demo_pablo', 'revised', '{"description":"Alquiler apto Laureles","totalMinor":180000000,"currency":"COP","status":"active"}', '2026-10-21 10:42:00'),
  ('ledger_demo_casa', 'entry_demo_adelanto', 1, 'user_demo_pablo', 'created', '{"description":"Adelanto para la feria","totalMinor":15000000,"currency":"COP","status":"active"}', '2026-10-18 12:00:00'),
  ('ledger_demo_casa', 'entry_demo_seguro', 1, 'user_demo_laura', 'created', '{"description":"Seguro de viaje","totalMinor":12000,"currency":"USD","status":"active"}', '2026-10-09 09:30:00'),
  ('ledger_demo_casa', 'entry_demo_cena', 1, 'user_demo_pablo', 'created', '{"description":"Cena de cumpleaños","totalMinor":12000000,"currency":"COP","status":"active"}', '2026-10-03 22:10:00'),
  ('ledger_demo_casa', 'entry_demo_cena', 2, 'user_demo_pablo', 'voided', '{"reason":"Se pagó en efectivo aparte","status":"voided"}', '2026-10-04 09:00:00');

-- Lote importado de Splitwise (sintético) con dos filas.
INSERT OR IGNORE INTO splitwise_import_batches (id, ledger_id, actor_user_id, source_hash, file_name, status, imported_count, committed_at) VALUES
  ('batch_demo_casa', 'ledger_demo_casa', 'user_demo_pablo', '0000000000000000000000000000000000000000000000000000000000demo01', 'splitwise-casa-demo.csv', 'committed', 2, '2026-10-16 08:00:00');
-- Los importados son gastos normales: pagadores, reparto, revisión inicial y la fila cruda de origen (sintéticos).
INSERT OR IGNORE INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, occurred_at, created_by_user_id, import_batch_id, source_row_number, inferred, created_at, updated_at) VALUES
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'expense', 'COP', 9600000, 'Internet Tigo', '2026-10-15', 'user_demo_pablo', 'batch_demo_casa', 33, 1, '2026-10-16 08:00:00', '2026-10-16 08:00:00'),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'expense', 'COP', 6000000, 'Gas natural', '2026-10-12', 'user_demo_pablo', 'batch_demo_casa', 34, 1, '2026-10-16 08:00:00', '2026-10-16 08:00:00');
INSERT OR IGNORE INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'participant_demo_ana', 'out', 9600000),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'participant_demo_laura', 'out', 6000000);
INSERT OR IGNORE INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'participant_demo_ana', 3200000),
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'participant_demo_pablo', 3200000),
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'participant_demo_laura', 3200000),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'participant_demo_laura', 1500000),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'participant_demo_ana', 1500000),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'participant_demo_pablo', 1500000),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'participant_demo_mateo', 1500000);
INSERT OR IGNORE INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json, created_at) VALUES
  ('ledger_demo_casa', 'entry_imp_demo_internet', 1, 'user_demo_pablo', 'created', '{"description":"Internet Tigo","totalMinor":9600000,"currency":"COP","status":"active"}', '2026-10-16 08:00:00'),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 1, 'user_demo_pablo', 'created', '{"description":"Gas natural","totalMinor":6000000,"currency":"COP","status":"active"}', '2026-10-16 08:00:00');
INSERT OR IGNORE INTO import_source_rows (ledger_id, entry_id, batch_id, source_row_number, raw_json) VALUES
  ('ledger_demo_casa', 'entry_imp_demo_internet', 'batch_demo_casa', 33, '{"line":33,"description":"Internet Tigo"}'),
  ('ledger_demo_casa', 'entry_imp_demo_gas', 'batch_demo_casa', 34, '{"line":34,"description":"Gas natural"}');
