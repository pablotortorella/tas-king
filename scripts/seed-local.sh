#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — db:seed:local       ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Leer DEV_USER_EMAIL del .dev.vars
DEV_EMAIL=""
if [ -f ".dev.vars" ]; then
  DEV_EMAIL=$(grep "^DEV_USER_EMAIL=" .dev.vars | cut -d= -f2)
fi
if [ -z "$DEV_EMAIL" ]; then
  DEV_EMAIL="dev@example.com"
  warn "DEV_USER_EMAIL no encontrado en .dev.vars — usando $DEV_EMAIL"
fi

NOW=$(date +%s)000

SQL="
-- Registro centinela: si existe, el seed ya fue aplicado
SELECT COUNT(*) as c FROM cards WHERE id = 'seed_sentinel';
"

EXISTING=$(npx wrangler d1 execute tas-king --local --json --command "SELECT COUNT(*) as c FROM cards WHERE id = 'seed_sentinel'" 2>/dev/null \
  | grep -oP '"c":\s*\K[0-9]+' || echo "0")

if [ "$EXISTING" = "1" ]; then
  warn "El seed ya fue aplicado previamente. Usá 'npm run db:reset:local' para empezar de cero."
  exit 0
fi

step "Creando usuario de desarrollo"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO users (id, email, name, avatar_emoji, avatar_color, created_at)
VALUES ('usr_dev', '${DEV_EMAIL}', 'Dev Local', '🧑‍💻', '#6366f1', ${NOW});
"
ok "Usuario: ${DEV_EMAIL}"

step "Creando tablero personal"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO boards (id, name, owner_email, is_personal, created_at)
VALUES ('brd_dev_personal', 'Mi tablero', '${DEV_EMAIL}', 1, ${NOW});

INSERT OR IGNORE INTO board_members (board_id, email, role, created_at)
VALUES ('brd_dev_personal', '${DEV_EMAIL}', 'owner', ${NOW});
"
ok "Tablero personal creado"

step "Creando etiquetas"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO labels (id, board_id, name, color, position, created_at)
VALUES
  ('lbl_bug',     'brd_dev_personal', 'Bug',      '#ef4444', 0, ${NOW}),
  ('lbl_feature', 'brd_dev_personal', 'Feature',  '#3b82f6', 1, ${NOW}),
  ('lbl_ux',      'brd_dev_personal', 'UX',       '#a855f7', 2, ${NOW}),
  ('lbl_urgent',  'brd_dev_personal', 'Urgente',  '#f97316', 3, ${NOW});
"
ok "4 etiquetas creadas"

step "Creando tarjetas de ejemplo"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO cards (id, title, column_id, details, due, position, board_id, assignee_email, archived, created_at, updated_at)
VALUES
  ('seed_sentinel',  'Seed aplicado',          'pendiente',   'Registro centinela — no borrar.',               '',           0.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_1',    'Revisar diseño del login','pendiente',   'Verificar flujo OAuth en mobile.',              '2026-07-15', 1.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_2',    'Fix: botón guardar',      'en-progreso', 'En algunos casos no responde al primer click.', '2026-07-10', 0.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_3',    'Agregar paginación',      'en-progreso', 'El listado de tarjetas archivadas crece mucho.','2026-08-01', 1.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_4',    'Deploy a staging',        'revision',    'Verificar en URL real antes de producción.',    '2026-07-08', 0.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_5',    'Documentar API pública',  'terminado',   'Endpoints de boards y cards con ejemplos.',     '',           0.0, 'brd_dev_personal', '${DEV_EMAIL}', 0, ${NOW}, ${NOW}),
  ('seed_card_6',    'Tarjeta archivada',       'pendiente',   'Esta tarjeta está archivada.',                  '',           2.0, 'brd_dev_personal', '${DEV_EMAIL}', 1, ${NOW}, ${NOW});
"
ok "7 tarjetas creadas (incluye 1 archivada)"

step "Asociando etiquetas a tarjetas"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES
  ('seed_card_2', 'lbl_bug'),
  ('seed_card_2', 'lbl_urgent'),
  ('seed_card_1', 'lbl_ux'),
  ('seed_card_3', 'lbl_feature');
"
ok "Etiquetas asociadas"

step "Creando comentarios"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO comments (id, card_id, text, author_email, created_at)
VALUES
  ('seed_cmt_1', 'seed_card_2', 'Reproducido en Firefox y Chrome.', '${DEV_EMAIL}', ${NOW}),
  ('seed_cmt_2', 'seed_card_2', 'Puede ser un tema de event bubbling.', '${DEV_EMAIL}', ${NOW}),
  ('seed_cmt_3', 'seed_card_4', 'Listo para revisar.', '${DEV_EMAIL}', ${NOW});
"
ok "3 comentarios creados"

step "Creando checklist"
npx wrangler d1 execute tas-king --local --command "
INSERT OR IGNORE INTO checklists (id, card_id, name, position, created_at)
VALUES ('seed_chk_1', 'seed_card_1', 'Checklist de revisión', 0, ${NOW});

INSERT OR IGNORE INTO checklist_items (id, checklist_id, text, checked, position, created_at)
VALUES
  ('seed_chk_item_1', 'seed_chk_1', 'Probar en mobile', 1, 0, ${NOW}),
  ('seed_chk_item_2', 'seed_chk_1', 'Probar en desktop', 1, 1, ${NOW}),
  ('seed_chk_item_3', 'seed_chk_1', 'Revisar accesibilidad', 0, 2, ${NOW});
"
ok "Checklist con 3 ítems creada"

echo -e "\n${GREEN}╔══════════════════════════════════════╗"
echo "║   ✅ Seed completado                 ║"
echo "║      6 tarjetas · 4 etiquetas        ║"
echo "║      3 comentarios · 1 checklist     ║"
echo "║                                      ║"
echo "║   Corré 'npm run dev' para verlo.    ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"
