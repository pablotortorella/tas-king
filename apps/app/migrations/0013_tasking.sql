-- TasKing como dominio independiente dentro de HomeSuite. Migración aditiva.

PRAGMA foreign_keys = ON;

CREATE TABLE tasking_transfer_state (
 id INTEGER PRIMARY KEY CHECK(id = 1), phase TEXT NOT NULL CHECK(phase IN ('pending','loading','ready','active')) DEFAULT 'pending',
 batch_id TEXT, manifest_hash TEXT, activated_at TEXT
);
INSERT INTO tasking_transfer_state(id) VALUES(1);
CREATE TABLE tasking_transfer_batches (
 id TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('loading','ready','active')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tasking_transfer_objects (
 batch_id TEXT NOT NULL REFERENCES tasking_transfer_batches(id), table_name TEXT NOT NULL, entity_key TEXT NOT NULL, content_hash TEXT NOT NULL,
 PRIMARY KEY(batch_id,table_name,entity_key)
);
CREATE TABLE tasking_identities (
 identity_id TEXT PRIMARY KEY, legacy_user_id TEXT UNIQUE, legacy_email TEXT NOT NULL UNIQUE,
 user_id TEXT UNIQUE REFERENCES users(id), verified_sub TEXT UNIQUE,
 name TEXT NOT NULL DEFAULT '', avatar_emoji TEXT, avatar_color TEXT,
 is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)), tip_index INTEGER, tip_date TEXT,
 created_at INTEGER NOT NULL
);

CREATE TABLE tasking_attachments (
  id            TEXT PRIMARY KEY,
  card_id       TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL DEFAULT '',
  size          INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE tasking_audit_log (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  card_id TEXT,
  action TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  details TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE tasking_board_members (
  board_id   TEXT NOT NULL,
  identity_id      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (board_id, identity_id)
);

CREATE TABLE tasking_boards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_identity_id TEXT NOT NULL,
  is_personal INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
, due_soon_days INTEGER NOT NULL DEFAULT 3, theme TEXT, theme_prompt_seen INTEGER NOT NULL DEFAULT 0, sync_version INTEGER NOT NULL DEFAULT 0);

CREATE TABLE tasking_card_goals (
  card_id TEXT NOT NULL REFERENCES tasking_cards(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES tasking_goals(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, goal_id)
);

CREATE TABLE tasking_card_labels (
  card_id TEXT NOT NULL REFERENCES tasking_cards(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES tasking_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE tasking_cards (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  column_id   TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  due         TEXT NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  position    REAL NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
, board_id TEXT, assignee_identity_id TEXT);

CREATE TABLE tasking_checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES tasking_checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE tasking_checklists (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES tasking_cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Lista de tareas',
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE tasking_columns (
  id         TEXT NOT NULL,
  board_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  position   REAL NOT NULL DEFAULT 0,
  is_done    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (board_id, id)
);

CREATE TABLE tasking_comments (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
, author_identity_id TEXT);

CREATE TABLE tasking_goals (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES tasking_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0
);

CREATE TABLE tasking_labels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES tasking_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0
);

CREATE INDEX tasking_audit_log_board ON tasking_audit_log (board_id, ts DESC);

CREATE INDEX tasking_audit_log_card  ON tasking_audit_log (card_id, ts DESC);

CREATE INDEX tasking_idx_attachments_card ON tasking_attachments(card_id);

CREATE INDEX idx_board_members_identity_id ON tasking_board_members(identity_id);

CREATE INDEX tasking_idx_card_goals_card ON tasking_card_goals(card_id);

CREATE INDEX tasking_idx_card_goals_goal ON tasking_card_goals(goal_id);

CREATE INDEX tasking_idx_card_labels_card ON tasking_card_labels(card_id);

CREATE INDEX tasking_idx_cards_board ON tasking_cards(board_id, column_id, position);

CREATE INDEX tasking_idx_cards_column ON tasking_cards(column_id, position);

CREATE INDEX tasking_idx_columns_board ON tasking_columns(board_id, position);

CREATE INDEX tasking_idx_comments_card ON tasking_comments(card_id);

CREATE INDEX tasking_idx_goals_board ON tasking_goals(board_id);

CREATE INDEX tasking_idx_labels_board ON tasking_labels(board_id);

CREATE TRIGGER tasking_cards_sync_delete AFTER DELETE ON tasking_cards BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1 WHERE id = OLD.board_id;
END;

CREATE TRIGGER tasking_cards_sync_insert AFTER INSERT ON tasking_cards BEGIN
  UPDATE tasking_boards SET sync_version = MAX(sync_version + 1, NEW.updated_at)
    WHERE id = NEW.board_id;
END;

CREATE TRIGGER tasking_cards_sync_update AFTER UPDATE ON tasking_cards BEGIN
  UPDATE tasking_boards SET sync_version = MAX(sync_version + 1, NEW.updated_at)
    WHERE id IN (OLD.board_id, NEW.board_id);
END;

CREATE TRIGGER tasking_checklist_items_sync_delete AFTER DELETE ON tasking_checklist_items BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1 WHERE id = (
    SELECT c.board_id FROM tasking_cards c JOIN tasking_checklists cl ON cl.card_id = c.id
    WHERE cl.id = OLD.checklist_id
  );
END;

CREATE TRIGGER tasking_checklist_items_sync_insert AFTER INSERT ON tasking_checklist_items BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1 WHERE id = (
    SELECT c.board_id FROM tasking_cards c JOIN tasking_checklists cl ON cl.card_id = c.id
    WHERE cl.id = NEW.checklist_id
  );
END;

CREATE TRIGGER tasking_checklist_items_sync_update AFTER UPDATE ON tasking_checklist_items BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1 WHERE id IN (
    SELECT c.board_id FROM tasking_cards c JOIN tasking_checklists cl ON cl.card_id = c.id
    WHERE cl.id IN (OLD.checklist_id, NEW.checklist_id)
  );
END;

CREATE TRIGGER tasking_checklists_sync_delete AFTER DELETE ON tasking_checklists BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM tasking_cards WHERE id = OLD.card_id);
END;

CREATE TRIGGER tasking_checklists_sync_insert AFTER INSERT ON tasking_checklists BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM tasking_cards WHERE id = NEW.card_id);
END;

CREATE TRIGGER tasking_checklists_sync_update AFTER UPDATE ON tasking_checklists BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id IN (SELECT board_id FROM tasking_cards WHERE id IN (OLD.card_id, NEW.card_id));
END;

CREATE TRIGGER tasking_comments_sync_delete AFTER DELETE ON tasking_comments BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM tasking_cards WHERE id = OLD.card_id);
END;

CREATE TRIGGER tasking_comments_sync_insert AFTER INSERT ON tasking_comments BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM tasking_cards WHERE id = NEW.card_id);
END;

CREATE TRIGGER tasking_comments_sync_update AFTER UPDATE ON tasking_comments BEGIN
  UPDATE tasking_boards SET sync_version = sync_version + 1
    WHERE id IN (SELECT board_id FROM tasking_cards WHERE id IN (OLD.card_id, NEW.card_id));
END;

CREATE UNIQUE INDEX tasking_one_personal_per_identity ON tasking_boards(owner_identity_id) WHERE is_personal = 1;

CREATE TABLE tasking_verified_accounts (user_id TEXT PRIMARY KEY REFERENCES users(id), google_sub TEXT NOT NULL, email_authority INTEGER NOT NULL DEFAULT 1 CHECK(email_authority IN (0,1)), verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE VIEW tasking_presentations AS SELECT i.identity_id, i.user_id, i.legacy_email, COALESCE(u.display_name,i.name) AS name, COALESCE(u.email,i.legacy_email) AS contact_email,
 CASE WHEN i.user_id IS NULL THEN i.avatar_emoji WHEN p.avatar_mode='emoji' THEN p.avatar_emoji ELSE NULL END AS avatar_emoji,
 CASE WHEN i.user_id IS NULL THEN i.avatar_color ELSE p.avatar_color END AS avatar_color,
 CASE WHEN p.avatar_mode='google' THEN p.google_picture_url ELSE NULL END AS avatar_photo
 FROM tasking_identities i LEFT JOIN users u ON u.id=i.user_id LEFT JOIN user_profiles p ON p.user_id=i.user_id;

CREATE TRIGGER tasking_attachment_limit BEFORE INSERT ON tasking_attachments WHEN (SELECT COUNT(*) FROM tasking_attachments WHERE card_id=NEW.card_id)>=10 BEGIN SELECT RAISE(ABORT,'Tasking attachment limit'); END;

CREATE UNIQUE INDEX tasking_attachment_stored_name ON tasking_attachments(stored_name);
