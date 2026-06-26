#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — db:reset:local      ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

warn "Esto borrará todos los datos locales y re-aplicará las migraciones desde cero."
read -r -p "¿Continuar? [s/N] " confirm
[[ "$confirm" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }

# 1. Borrar estado local (pero preservar e2e-state)
step "Borrando estado local de wrangler"
if [ -d ".wrangler/state" ]; then
  rm -rf .wrangler/state
  ok "Estado local eliminado"
else
  ok "No había estado local previo"
fi

# 2. Re-aplicar migraciones
step "Aplicando migraciones desde cero"
npx wrangler d1 migrations apply tas-king --local
ok "Migraciones aplicadas"

echo -e "\n${GREEN}╔══════════════════════════════════════╗"
echo "║   ✅ DB local reseteada              ║"
echo "║      Corré 'npm run dev' para        ║"
echo "║      arrancar con datos limpios.     ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"
