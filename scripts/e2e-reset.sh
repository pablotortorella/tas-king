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

E2E_STATE=".wrangler/e2e-state"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — e2e:reset           ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# 1. Limpiar estado E2E
step "Limpiando estado E2E"
if [ -d "$E2E_STATE" ]; then
  rm -rf "$E2E_STATE"
  ok "Estado E2E eliminado"
else
  ok "No había estado E2E previo"
fi

# 2. Aplicar migraciones en estado E2E limpio
step "Aplicando migraciones"
npx wrangler d1 migrations apply tas-king --local --persist-to "$E2E_STATE"
ok "Migraciones aplicadas"

# 3. Aplicar seed base
step "Aplicando seed E2E"
npx wrangler d1 execute tas-king --local --persist-to "$E2E_STATE" --file test/fixtures/seed.sql
ok "Seed aplicado"

echo -e "\n${GREEN}╔══════════════════════════════════════╗"
echo "║   ✅ Estado E2E reseteado            ║"
echo "║      Corré 'npm run test:e2e'        ║"
echo "║      o 'npm run e2e:server'          ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"
