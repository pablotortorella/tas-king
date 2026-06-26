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
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║     FUN TasKing! — setup:local       ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# 1. Node version
step "Verificando Node.js"
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js 18+ requerido (tenés v${NODE_VERSION})"
fi
ok "Node.js $(node -v)"

# 2. Dependencias
step "Instalando dependencias"
npm install
ok "npm install completado"

# 3. .dev.vars
step "Verificando .dev.vars"
if [ ! -f ".dev.vars" ]; then
  cp .dev.vars.example .dev.vars
  warn ".dev.vars creado desde .dev.vars.example — completá los valores antes de correr la app"
else
  ok ".dev.vars ya existe"
fi

# Verificar que tenga las variables mínimas no vacías
MISSING=()
while IFS= read -r line; do
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  [[ "$key" == "GOOGLE_CLIENT_ID" || "$key" == "GOOGLE_CLIENT_SECRET" ]] && continue
  if [ -z "$val" ]; then
    MISSING+=("$key")
  fi
done < .dev.vars

if [ ${#MISSING[@]} -gt 0 ]; then
  warn "Variables sin valor en .dev.vars: ${MISSING[*]}"
  warn "Completalas antes de correr 'npm run dev'"
else
  ok ".dev.vars con variables mínimas configuradas"
fi

# 4. Migraciones locales
step "Aplicando migraciones DB local"
npx wrangler d1 migrations apply tas-king --local
ok "Migraciones aplicadas"

# 5. Playwright
step "Verificando Playwright"
if npx playwright --version &>/dev/null; then
  if [ -d "$HOME/.cache/ms-playwright" ] || [ -d "$HOME/snap/chromium" ] || command -v chromium &>/dev/null || command -v google-chrome &>/dev/null; then
    ok "Playwright + browser disponibles"
  else
    warn "Playwright instalado pero sin browsers — instalando chromium..."
    npx playwright install chromium
    ok "Chromium instalado"
  fi
else
  warn "Playwright no encontrado — instalando browsers..."
  npx playwright install chromium
  ok "Chromium instalado"
fi

echo -e "\n${GREEN}╔══════════════════════════════════════╗"
echo "║   ✅ Setup completado — listo para   ║"
echo "║      'npm run dev'                   ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"
