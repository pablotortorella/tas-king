#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; FAILED=1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

FAILED=0

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — check:env           ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# 1. Node.js
echo -e "${CYAN}▶ Node.js${NC}"
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [ "$NODE_VERSION" -ge 18 ]; then
  ok "Node.js $(node -v)"
else
  fail "Node.js 18+ requerido — tenés v${NODE_VERSION} (o no está instalado)"
fi

# 2. Wrangler
echo -e "\n${CYAN}▶ Wrangler${NC}"
if npx wrangler --version &>/dev/null; then
  WRANGLER_VER=$(npx wrangler --version 2>/dev/null | head -1)
  ok "Wrangler $WRANGLER_VER"
else
  fail "Wrangler no encontrado — corré 'npm install'"
fi

# 3. .dev.vars
echo -e "\n${CYAN}▶ Variables de entorno (.dev.vars)${NC}"
REQUIRED_VARS=(DEV_USER_EMAIL SESSION_SECRET ALLOWED_EMAILS ADMIN_EMAILS)
OPTIONAL_VARS=(GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET)

if [ ! -f ".dev.vars" ]; then
  fail ".dev.vars no existe — copiá .dev.vars.example y completalo"
else
  ok ".dev.vars encontrado"

  for var in "${REQUIRED_VARS[@]}"; do
    val=$(grep "^${var}=" .dev.vars 2>/dev/null | cut -d= -f2- || echo "")
    if [ -z "$val" ]; then
      fail "$var no está definida o está vacía"
    else
      ok "$var definida"
    fi
  done

  for var in "${OPTIONAL_VARS[@]}"; do
    val=$(grep "^${var}=" .dev.vars 2>/dev/null | cut -d= -f2- || echo "")
    if [ -z "$val" ]; then
      warn "$var vacía (opcional — necesaria solo para probar OAuth local)"
    else
      ok "$var definida"
    fi
  done
fi

# 4. wrangler.jsonc — database_id configurado
echo -e "\n${CYAN}▶ wrangler.jsonc${NC}"
if [ ! -f "wrangler.jsonc" ]; then
  fail "wrangler.jsonc no encontrado"
else
  DB_IDS=$(grep '"database_id"' wrangler.jsonc | grep -v 'placeholder\|REEMPLAZAR\|YOUR_' || true)
  if [ -z "$DB_IDS" ]; then
    fail "database_id no configurado en wrangler.jsonc — creá la DB con 'npx wrangler d1 create tas-king'"
  else
    ok "database_id configurado en wrangler.jsonc"
  fi
fi

# 5. DB local inicializada
echo -e "\n${CYAN}▶ Base de datos local${NC}"
if [ -d ".wrangler/state/v3/d1" ]; then
  MIGRATION_COUNT=$(npx wrangler d1 migrations list tas-king --local 2>/dev/null | grep -c "✅" || echo "0")
  if [ "$MIGRATION_COUNT" -gt 0 ]; then
    ok "DB local inicializada ($MIGRATION_COUNT migraciones aplicadas)"
  else
    warn "DB local existe pero sin migraciones — corré 'npm run db:migrate:local'"
  fi
else
  warn "DB local no inicializada — corré 'npm run db:migrate:local' o 'npm run setup:local'"
fi

# 6. Playwright
echo -e "\n${CYAN}▶ Playwright${NC}"
if [ -d "$HOME/.cache/ms-playwright" ] || [ -d "$HOME/snap/chromium" ] || command -v chromium &>/dev/null || command -v google-chrome &>/dev/null; then
  ok "Browser disponible para tests E2E"
else
  warn "No se detectó browser para Playwright — corré 'npx playwright install chromium'"
fi

# 7. node_modules
echo -e "\n${CYAN}▶ Dependencias${NC}"
if [ -d "node_modules" ]; then
  ok "node_modules presente"
else
  fail "node_modules no existe — corré 'npm install'"
fi

# Resultado final
echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════╗"
  echo "║   ✅ Ambiente listo                  ║"
  echo -e "╚══════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔══════════════════════════════════════╗"
  echo "║   ❌ Hay problemas a resolver        ║"
  echo "║      Corré 'npm run setup:local'     ║"
  echo "║      para el setup completo.         ║"
  echo -e "╚══════════════════════════════════════╝${NC}"
  exit 1
fi
