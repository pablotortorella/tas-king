-- 0007_labels.sql: etiquetas por tablero + filtro

CREATE TABLE labels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0
);

CREATE INDEX idx_labels_board ON labels(board_id);

CREATE TABLE card_labels (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE INDEX idx_card_labels_card ON card_labels(card_id);
