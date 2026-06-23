-- Tabla de emails permitidos (reemplaza el Secret ALLOWED_EMAILS)
CREATE TABLE IF NOT EXISTS allowed_emails (
  email TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Flag de admin en usuarios
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
