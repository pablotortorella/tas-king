-- Tabla de columnas configurables por tablero

CREATE TABLE IF NOT EXISTS columns (
  id         TEXT NOT NULL,
  board_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  position   REAL NOT NULL DEFAULT 0,
  is_done    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (board_id, id)
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id, position);

-- Insertar las 5 columnas por defecto para todos los tableros existentes.
-- Se usan los mismos IDs del frontend hardcodeado para compatibilidad con
-- las tarjetas existentes (column_id en cards ya tiene esos valores).
INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at)
SELECT 'por_conversar', b.id, 'Por conversar', 1, 0, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM boards b;

INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at)
SELECT 'pendiente', b.id, 'Pendiente', 2, 0, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM boards b;

INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at)
SELECT 'en_progreso', b.id, 'En progreso', 3, 0, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM boards b;

INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at)
SELECT 'por_revisar', b.id, 'Por revisar', 4, 0, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM boards b;

INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at)
SELECT 'terminado', b.id, 'Terminado', 5, 1, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM boards b;
