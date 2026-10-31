CREATE TABLE ledger_categories (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
  name_key TEXT NOT NULL CHECK(length(name_key) BETWEEN 1 AND 60),
  group_name TEXT NOT NULL CHECK(length(group_name) BETWEEN 1 AND 60),
  group_key TEXT NOT NULL CHECK(length(group_key) BETWEEN 1 AND 60),
  icon TEXT NOT NULL DEFAULT 'tag',
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  merged_into TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, id),
  UNIQUE (ledger_id, name_key),
  FOREIGN KEY (ledger_id, merged_into) REFERENCES ledger_categories(ledger_id, id),
  CHECK(merged_into IS NULL OR merged_into <> id)
);

ALTER TABLE ledger_entries ADD COLUMN category_id TEXT;
CREATE INDEX ledger_entries_category ON ledger_entries(ledger_id, category_id);

CREATE TRIGGER ledger_categories_no_merge_cycle
BEFORE UPDATE OF merged_into ON ledger_categories
WHEN NEW.merged_into IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'category merge cycle')
  WHERE EXISTS (
    WITH RECURSIVE chain(id) AS (
      SELECT NEW.merged_into
      UNION
      SELECT c.merged_into FROM ledger_categories c JOIN chain ON c.id = chain.id
      WHERE c.ledger_id = NEW.ledger_id AND c.merged_into IS NOT NULL
    )
    SELECT 1 FROM chain WHERE id = NEW.id
  );
END;
