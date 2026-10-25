-- Los movimientos importados pasan a ser movimientos normales: procedencia e inferencia en la propia fila.
ALTER TABLE ledger_entries ADD COLUMN import_batch_id TEXT REFERENCES splitwise_import_batches(id);
ALTER TABLE ledger_entries ADD COLUMN source_row_number INTEGER CHECK(source_row_number IS NULL OR source_row_number >= 2);
ALTER TABLE ledger_entries ADD COLUMN inferred INTEGER NOT NULL DEFAULT 0 CHECK(inferred IN (0, 1));
CREATE INDEX ledger_entries_import_batch ON ledger_entries(ledger_id, import_batch_id);
CREATE UNIQUE INDEX ledger_entries_import_row ON ledger_entries(import_batch_id, source_row_number) WHERE import_batch_id IS NOT NULL;

-- Fila cruda del archivo, como auditoría de origen.
CREATE TABLE import_source_rows (
  ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  batch_id TEXT NOT NULL REFERENCES splitwise_import_batches(id),
  source_row_number INTEGER NOT NULL CHECK(source_row_number >= 2),
  raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
  PRIMARY KEY (ledger_id, entry_id),
  UNIQUE (batch_id, source_row_number),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id)
);

-- Filas del archivo, una por línea. owner_id es la vista previa y, al confirmar, pasa a ser el lote.
CREATE TABLE splitwise_import_rows (
  owner_id TEXT NOT NULL,
  line INTEGER NOT NULL CHECK(line >= 1),
  kind TEXT NOT NULL CHECK(kind IN ('movement', 'incident', 'summary')),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  PRIMARY KEY (owner_id, line)
);

-- Categorías que trae el archivo y todavía no existen en el libro: ocultas hasta publicar.
ALTER TABLE ledger_categories ADD COLUMN pending_import_batch_id TEXT REFERENCES splitwise_import_batches(id);
CREATE INDEX ledger_categories_pending ON ledger_categories(pending_import_batch_id) WHERE pending_import_batch_id IS NOT NULL;

-- Estado de un lote en carga: decisiones, mapeo ya resuelto y cuántas filas se espera cargar.
ALTER TABLE splitwise_import_batches ADD COLUMN review_json TEXT CHECK(review_json IS NULL OR json_valid(review_json));
ALTER TABLE splitwise_import_batches ADD COLUMN planned_count INTEGER NOT NULL DEFAULT 0 CHECK(planned_count >= 0);
-- Marca de la publicación ganadora: las escrituras de la publicación solo corren para quien cambió el estado.
ALTER TABLE splitwise_import_batches ADD COLUMN publish_token TEXT;

-- Las revisiones siguen siendo inmutables, salvo las de un movimiento de un lote que todavía no se publicó: descartar una
-- carga abandonada o cancelada tiene que poder borrar lo que cargó. Una vez publicado, nada se borra.
DROP TRIGGER entry_revisions_no_delete;
CREATE TRIGGER entry_revisions_no_delete
BEFORE DELETE ON entry_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM ledger_entries e
  JOIN splitwise_import_batches b ON b.id = e.import_batch_id
  WHERE e.ledger_id = OLD.ledger_id AND e.id = OLD.entry_id AND b.status = 'pending'
)
BEGIN
  SELECT RAISE(ABORT, 'entry revisions are immutable');
END;
