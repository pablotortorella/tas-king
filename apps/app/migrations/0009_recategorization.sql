-- Operaciones de recategorización: un lote por operación y, por movimiento cambiado, la categoría que tenía antes.
CREATE TABLE recategorization_batches (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('bulk', 'quick', 'undo')),
  category_id TEXT,
  status TEXT NOT NULL DEFAULT 'applying' CHECK(status IN ('applying', 'applied')),
  planned INTEGER NOT NULL DEFAULT 0 CHECK(planned >= 0),
  changed INTEGER NOT NULL DEFAULT 0 CHECK(changed >= 0),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK(skipped >= 0),
  undo_of TEXT,
  undone_at TEXT,
  token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, id)
);
CREATE INDEX recategorization_batches_recent ON recategorization_batches(ledger_id, actor_user_id, created_at DESC);

CREATE TABLE recategorization_items (
  ledger_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 2),
  previous_category_id TEXT,
  PRIMARY KEY (ledger_id, batch_id, entry_id),
  FOREIGN KEY (ledger_id, batch_id) REFERENCES recategorization_batches(ledger_id, id),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id)
);
