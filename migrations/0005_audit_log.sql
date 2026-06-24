-- Historial de actividad por tarjeta y tablero
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  card_id TEXT,
  action TEXT NOT NULL,
  email TEXT NOT NULL,
  ts INTEGER NOT NULL,
  details TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS audit_log_board ON audit_log (board_id, ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_card  ON audit_log (card_id, ts DESC);
