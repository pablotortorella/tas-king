-- Iteración 3: usuarios, tableros y membresías.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  is_personal INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS board_members (
  board_id   TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (board_id, email)
);

-- Las cards pasan a pertenecer a un tablero y pueden tener responsable.
ALTER TABLE cards ADD COLUMN board_id TEXT;
ALTER TABLE cards ADD COLUMN assignee_email TEXT;

CREATE INDEX IF NOT EXISTS idx_cards_board ON cards(board_id, column_id, position);
CREATE INDEX IF NOT EXISTS idx_board_members_email ON board_members(email);

-- Backfill one-time: dueño actual de los datos existentes.
INSERT OR IGNORE INTO users (id, email, name, created_at)
  VALUES ('usr_pablo', 'pablotortorella@gmail.com', 'Pablo', strftime('%s','now')*1000);

INSERT OR IGNORE INTO boards (id, name, owner_email, is_personal, created_at)
  VALUES ('brd_pablo_personal', 'Mi tablero', 'pablotortorella@gmail.com', 1, strftime('%s','now')*1000);

INSERT OR IGNORE INTO board_members (board_id, email, role, created_at)
  VALUES ('brd_pablo_personal', 'pablotortorella@gmail.com', 'owner', strftime('%s','now')*1000);

-- Las tarjetas que ya existen quedan en el tablero personal de Pablo.
UPDATE cards SET board_id = 'brd_pablo_personal' WHERE board_id IS NULL;
