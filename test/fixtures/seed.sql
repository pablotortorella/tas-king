-- Seed E2E: limpia todo y establece estado conocido antes de cada suite
-- Se ejecuta desde test/global-setup.js vía wrangler d1 execute

-- Limpiar en orden inverso a FK constraints
DELETE FROM checklist_items;
DELETE FROM checklists;
DELETE FROM card_goals;
DELETE FROM goals;
DELETE FROM card_labels;
DELETE FROM labels;
DELETE FROM attachments;
DELETE FROM comments;
DELETE FROM audit_log;
DELETE FROM cards;
DELETE FROM columns;
DELETE FROM board_members;
DELETE FROM boards;
DELETE FROM rate_limit_log;
DELETE FROM users;
DELETE FROM allowed_emails;
DELETE FROM pending_access;

-- Usuario E2E (autenticado via DEV_USER_EMAIL=e2e-admin@test.local en dev:e2e)
INSERT INTO users (id, email, name, is_admin, created_at)
  VALUES ('user-e2e', 'e2e-admin@test.local', 'E2E Admin', 1, 1000000000000);
INSERT INTO allowed_emails (email, added_by, added_at)
  VALUES ('e2e-admin@test.local', 'seed', '2026-01-01');

-- Tablero principal E2E. theme_prompt_seen=1 para que el prompt de bienvenida
-- de #10 (dispara para el dueño en tableros sin paleta asignada) no interfiera
-- con los tests existentes; e2e/board-theme.spec.js prueba ese flujo aparte.
INSERT INTO boards (id, name, owner_email, is_personal, created_at, theme_prompt_seen)
  VALUES ('board-e2e', 'Tablero E2E', 'e2e-admin@test.local', 1, 1000000000000, 1);
INSERT INTO board_members (board_id, email, role, created_at)
  VALUES ('board-e2e', 'e2e-admin@test.local', 'owner', 1000000000000);

-- Columnas por defecto del tablero E2E (mismos IDs que el frontend histórico)
INSERT INTO columns (id, board_id, name, position, is_done, created_at)
  VALUES ('por_conversar', 'board-e2e', 'Por conversar', 1, 0, 1000000000000);
INSERT INTO columns (id, board_id, name, position, is_done, created_at)
  VALUES ('pendiente', 'board-e2e', 'Pendiente', 2, 0, 1000000000000);
INSERT INTO columns (id, board_id, name, position, is_done, created_at)
  VALUES ('en_progreso', 'board-e2e', 'En progreso', 3, 0, 1000000000000);
INSERT INTO columns (id, board_id, name, position, is_done, created_at)
  VALUES ('por_revisar', 'board-e2e', 'Por revisar', 4, 0, 1000000000000);
INSERT INTO columns (id, board_id, name, position, is_done, created_at)
  VALUES ('terminado', 'board-e2e', 'Terminado', 5, 1, 1000000000000);

-- Etiqueta base reutilizable por los tests de etiquetas
INSERT INTO labels (id, board_id, name, color, position, created_at)
  VALUES ('label-seed', 'board-e2e', 'Semilla', '#4CAF50', 0, 1000000000000);

-- Tarjeta base para tests que necesitan una tarjeta preexistente
INSERT INTO cards (id, board_id, title, column_id, details, position, archived, created_at, updated_at)
  VALUES ('card-seed', 'board-e2e', 'Tarjeta seed', 'pendiente', 'Tarjeta base del seed', 1, 0, 1000000000000, 1000000000000);
