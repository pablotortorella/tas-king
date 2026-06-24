-- Solicitudes de acceso pendientes (usuarios que intentaron loguearse pero no están en la lista)
CREATE TABLE IF NOT EXISTS pending_access (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  requested_at INTEGER NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0
);
