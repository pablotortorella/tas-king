-- Unir personas: la persona unida se conserva como registro (merged_into_id) y cada unión queda anotada con sus movimientos.
ALTER TABLE ledger_participants ADD COLUMN merged_into_id TEXT;
CREATE INDEX ledger_participants_merged ON ledger_participants(ledger_id, merged_into_id) WHERE merged_into_id IS NOT NULL;

CREATE TABLE person_merges (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applying' CHECK(status IN ('applying', 'applied')),
  planned INTEGER NOT NULL DEFAULT 0 CHECK(planned >= 0),
  changed INTEGER NOT NULL DEFAULT 0 CHECK(changed >= 0),
  voided INTEGER NOT NULL DEFAULT 0 CHECK(voided >= 0),
  token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, id),
  UNIQUE (ledger_id, source_id),
  CHECK (source_id <> target_id),
  FOREIGN KEY (ledger_id, source_id) REFERENCES ledger_participants(ledger_id, id),
  FOREIGN KEY (ledger_id, target_id) REFERENCES ledger_participants(ledger_id, id)
);

-- Un elemento por movimiento tocado: qué revisión escribió la unión y si lo revisó o lo anuló (por una transferencia entre ambas personas).
CREATE TABLE person_merge_items (
  ledger_id TEXT NOT NULL,
  merge_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 2),
  kind TEXT NOT NULL CHECK(kind IN ('revised', 'voided')),
  PRIMARY KEY (ledger_id, merge_id, entry_id),
  FOREIGN KEY (ledger_id, merge_id) REFERENCES person_merges(ledger_id, id),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id)
);
