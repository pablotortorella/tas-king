-- Consola de administración y estadística de uso de HomeSuite (openspec/changes/consola-administracion-homesuite, design.md D2, D3 y D10).
-- Aditiva: el código anterior no conoce estas tablas ni la columna nueva y sigue funcionando sin ellas.

-- Última actividad por persona: sólo la fecha del día en Colombia (AAAA-MM-DD), sin hora y sin herramienta. Se borra con la cuenta.
ALTER TABLE users ADD COLUMN last_active_on TEXT CHECK(last_active_on IS NULL OR last_active_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');

-- Conteos diarios de acciones, sin persona, grupo ni tablero. No se borran.
CREATE TABLE usage_daily_counts (
  day TEXT NOT NULL,
  tool TEXT NOT NULL CHECK(tool IN ('expenses', 'tasks', 'calm')),
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY (day, tool, action)
);

-- Personas distintas por período de calendario cerrado y por nivel («entró», «hizo algo»). No se borran.
CREATE TABLE usage_period_people (
  period_type TEXT NOT NULL CHECK(period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_key TEXT NOT NULL,
  tool TEXT NOT NULL CHECK(tool IN ('expenses', 'tasks', 'calm')),
  level TEXT NOT NULL CHECK(level IN ('entro', 'hizo')),
  people INTEGER NOT NULL DEFAULT 0 CHECK(people >= 0),
  PRIMARY KEY (period_type, period_key, tool, level)
);

-- Marcas para no contar dos veces a la misma persona en un período: HMAC con el secreto del Worker, nunca el identificador en claro.
-- Se borran cuando el período termina (mantenimiento diario).
CREATE TABLE usage_period_markers (
  period_type TEXT NOT NULL CHECK(period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_key TEXT NOT NULL,
  tool TEXT NOT NULL CHECK(tool IN ('expenses', 'tasks', 'calm')),
  level TEXT NOT NULL CHECK(level IN ('entro', 'hizo')),
  marker TEXT NOT NULL,
  PRIMARY KEY (period_type, period_key, tool, level, marker)
) WITHOUT ROWID;
CREATE INDEX usage_period_markers_by_period ON usage_period_markers(period_type, period_key);

-- Foto diaria de la suite (mantenimiento): total de cuentas y personas activas en 1, 7 y 30 días. Sin personas. No se borra.
CREATE TABLE usage_suite_snapshots (
  day TEXT PRIMARY KEY,
  accounts INTEGER NOT NULL CHECK(accounts >= 0),
  active_1d INTEGER NOT NULL CHECK(active_1d >= 0),
  active_7d INTEGER NOT NULL CHECK(active_7d >= 0),
  active_30d INTEGER NOT NULL CHECK(active_30d >= 0)
);

-- Roles de administración por herramienta. Los dueños de la suite no viven acá: están en el secreto HOMESUITE_OWNER_USER_IDS.
CREATE TABLE platform_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK(scope IN ('tareas', 'cuentas-claras')),
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, scope)
);

-- La marca heredada de administrador de TasKing pasa a ser el rol «tareas», sólo para identidades con cuenta HomeSuite (D10). La columna
-- is_admin queda intacta para poder volver atrás; deja de leerse y se retira en un change posterior.
INSERT OR IGNORE INTO platform_roles (user_id, scope, granted_by, granted_at)
  SELECT user_id, 'tareas', NULL, CURRENT_TIMESTAMP FROM tasking_identities WHERE is_admin = 1 AND user_id IS NOT NULL;
