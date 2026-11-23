-- Cuentas sintéticas para probar la consola de administración (consola-administracion-homesuite, tareas 1.3 y 10.2): una dueña de la
-- suite (su id va en HOMESUITE_OWNER_USER_IDS de los scripts locales y E2E), una con el rol «tareas» y una sin rol. Idempotente.
INSERT OR IGNORE INTO users (id, google_sub, email, display_name) VALUES
  ('user_consola_owner', 'local:consola@example.test', 'consola@example.test', 'consola'),
  ('user_consola_tareas', 'local:tareas-admin@example.test', 'tareas-admin@example.test', 'tareas-admin'),
  ('user_consola_sin_rol', 'local:sin-rol@example.test', 'sin-rol@example.test', 'sin-rol');
INSERT OR IGNORE INTO platform_roles (user_id, scope, granted_by) VALUES ('user_consola_tareas', 'tareas', 'user_consola_owner');
