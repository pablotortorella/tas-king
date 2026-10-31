CREATE TABLE splitwise_import_previews (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  source_hash TEXT NOT NULL CHECK(length(source_hash) = 64),
  file_name TEXT NOT NULL CHECK(length(file_name) <= 240),
  parsed_json TEXT NOT NULL CHECK(json_valid(parsed_json)),
  review_json TEXT CHECK(review_json IS NULL OR json_valid(review_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+1 hour'))
);
CREATE INDEX splitwise_previews_by_expiry ON splitwise_import_previews(expires_at);

CREATE TABLE splitwise_import_batches (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  source_hash TEXT NOT NULL CHECK(length(source_hash) = 64),
  file_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'committed')) DEFAULT 'pending',
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK(imported_count >= 0),
  source_summary_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(source_summary_json)),
  reconciliation_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(reconciliation_json)),
  assumptions_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(assumptions_json)),
  excluded_rows_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(excluded_rows_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_at TEXT,
  UNIQUE(ledger_id, source_hash)
);
CREATE UNIQUE INDEX splitwise_one_committed_batch_per_ledger ON splitwise_import_batches(ledger_id) WHERE status = 'committed';
CREATE INDEX splitwise_pending_batches ON splitwise_import_batches(created_at) WHERE status = 'pending';

ALTER TABLE ledger_participants ADD COLUMN pending_import_batch_id TEXT REFERENCES splitwise_import_batches(id);
CREATE INDEX ledger_participants_pending_import ON ledger_participants(pending_import_batch_id) WHERE pending_import_batch_id IS NOT NULL;

CREATE TABLE splitwise_import_entries (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  batch_id TEXT NOT NULL REFERENCES splitwise_import_batches(id),
  source_row_number INTEGER NOT NULL CHECK(source_row_number >= 2),
  occurred_at TEXT NOT NULL,
  description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 240),
  category TEXT NOT NULL DEFAULT '',
  currency_code TEXT NOT NULL,
  total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(ledger_id, id),
  UNIQUE(batch_id, source_row_number)
);
CREATE INDEX splitwise_import_timeline ON splitwise_import_entries(ledger_id, occurred_at DESC);

CREATE TABLE splitwise_import_effects (
  ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  PRIMARY KEY(ledger_id, entry_id, participant_id),
  FOREIGN KEY(ledger_id, entry_id) REFERENCES splitwise_import_entries(ledger_id, id),
  FOREIGN KEY(ledger_id, participant_id) REFERENCES ledger_participants(ledger_id, id)
);
