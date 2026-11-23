-- Cuentas sintéticas para probar la consola de administración (consola-administracion-homesuite, tareas 1.3 y 10.2): una dueña de la
-- suite (su id va en HOMESUITE_OWNER_USER_IDS de los scripts locales y E2E), una con el rol «tareas» y una sin rol. Idempotente.
INSERT OR IGNORE INTO users (id, google_sub, email, display_name) VALUES
  ('user_consola_owner', 'local:consola@example.test', 'consola@example.test', 'consola'),
  ('user_consola_tareas', 'local:tareas-admin@example.test', 'tareas-admin@example.test', 'tareas-admin'),
  ('user_consola_sin_rol', 'local:sin-rol@example.test', 'sin-rol@example.test', 'sin-rol');
INSERT OR IGNORE INTO platform_roles (user_id, scope, granted_by) VALUES ('user_consola_tareas', 'tareas', 'user_consola_owner');

-- Estadística sintética para ver la pestaña Suite con datos (sólo local y E2E): fotos de los últimos 14 días y personas por mes del mes
-- en curso y del anterior, en fechas de Colombia (UTC−5). No pisa los contadores que ya existan del mes en curso.
WITH RECURSIVE dias(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM dias WHERE n < 14)
INSERT OR IGNORE INTO usage_suite_snapshots (day, accounts, active_1d, active_7d, active_30d)
  SELECT date('now', '-5 hours', '-' || n || ' days'), 3, (n % 3), 2 + (n % 2), 3 FROM dias;
INSERT OR IGNORE INTO usage_period_people (period_type, period_key, tool, level, people) VALUES
  ('month', strftime('%Y-%m', 'now', '-5 hours', 'start of month', '-1 month'), 'tasks', 'entro', 3),
  ('month', strftime('%Y-%m', 'now', '-5 hours', 'start of month', '-1 month'), 'tasks', 'hizo', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours', 'start of month', '-1 month'), 'expenses', 'entro', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours', 'start of month', '-1 month'), 'expenses', 'hizo', 1),
  ('month', strftime('%Y-%m', 'now', '-5 hours', 'start of month', '-1 month'), 'calm', 'entro', 1),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'tasks', 'entro', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'tasks', 'hizo', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'expenses', 'entro', 3),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'expenses', 'hizo', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'calm', 'entro', 2),
  ('month', strftime('%Y-%m', 'now', '-5 hours'), 'calm', 'hizo', 1);
INSERT OR IGNORE INTO usage_daily_counts (day, tool, action, count) VALUES
  (date('now', '-5 hours', '-2 days'), 'expenses', 'movimiento_cargado', 4),
  (date('now', '-5 hours', '-1 days'), 'tasks', 'tarjeta_creada', 3),
  (date('now', '-5 hours', '-1 days'), 'tasks', 'tarjeta_movida', 5),
  (date('now', '-5 hours', '-1 days'), 'calm', 'sesion_terminada', 1);
