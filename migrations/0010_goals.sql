-- 0010_goals.sql: objetivos por tablero + vínculo con tarjetas
-- Un objetivo agrupa tarjetas del mismo tablero. El progreso se deriva de
-- cuántas tarjetas vinculadas (no archivadas) están en la columna "terminado".

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0
);

CREATE INDEX idx_goals_board ON goals(board_id);

CREATE TABLE card_goals (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, goal_id)
);

CREATE INDEX idx_card_goals_card ON card_goals(card_id);
CREATE INDEX idx_card_goals_goal ON card_goals(goal_id);
