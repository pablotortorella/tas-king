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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — db:restore          ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# Uso: db-restore.sh <archivo.sql> [local|staging|prod]
FILE="${1:-}"
TARGET="${2:-local}"

if [ -z "$FILE" ]; then
  echo "  Uso: npm run db:restore -- <archivo.sql> [local|staging|prod]"
  echo ""
  echo "  Ejemplos:"
  echo "    npm run db:restore -- backups/prod-20260626-030000.sql local"
  echo "    npm run db:restore -- backups/prod-20260626-030000.sql staging"
  echo "    npm run db:restore -- backups/prod-20260626-030000.sql prod"
  echo ""
  echo "  Backups disponibles en backups/:"
  ls backups/*.sql 2>/dev/null | sort -r | head -10 || echo "    (ninguno)"
  exit 1
fi

[ -f "$FILE" ] || fail "Archivo no encontrado: $FILE"

SIZE=$(du -sh "$FILE" | cut -f1)

case "$TARGET" in
  local)
    echo -e "  Destino:  ${GREEN}LOCAL${NC} (.wrangler/state)"
    echo -e "  Archivo:  $FILE ($SIZE)"
    warn "Esto REEMPLAZA todos los datos de la DB local."
    read -r -p "  ¿Continuar? [s/N] " ans
    [[ "$ans" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }

    step "Restaurando en DB local"
    rm -rf .wrangler/state
    npx wrangler d1 migrations apply tas-king --local
    npx wrangler d1 execute tas-king --local --file "$FILE"
    ok "DB local restaurada desde $FILE"
    ;;

  staging)
    echo -e "  Destino:  ${YELLOW}STAGING${NC} (remoto — tas-king-staging)"
    echo -e "  Archivo:  $FILE ($SIZE)"
    warn "Esto REEMPLAZA todos los datos de staging."
    read -r -p "  ¿Continuar? [s/N] " ans
    [[ "$ans" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
    read -r -p "  Segunda confirmación para staging remoto [s/N] " ans2
    [[ "$ans2" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }

    step "Restaurando en staging"
    npx wrangler d1 execute tas-king-staging --remote --env staging --file "$FILE"
    ok "Staging restaurado desde $FILE"
    ;;

  prod|production)
    echo -e "  Destino:  ${RED}PRODUCCIÓN${NC} (remoto — tas-king)"
    echo -e "  Archivo:  $FILE ($SIZE)"
    echo ""
    echo -e "${RED}${BOLD:-}  ⚠️  ESTO REEMPLAZA LA BASE DE DATOS DE PRODUCCIÓN.${NC}"
    echo -e "${RED}  Los usuarios reales perderán los datos posteriores al backup.${NC}"
    echo ""
    read -r -p "  Primera confirmación [s/N] " ans
    [[ "$ans" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
    read -r -p "  Segunda confirmación — ¿seguro? [s/N] " ans2
    [[ "$ans2" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 0; }
    read -r -p "  Escribí 'RESTAURAR' para confirmar: " word
    [ "$word" = "RESTAURAR" ] || { echo "Cancelado."; exit 0; }

    step "Restaurando en producción"
    npx wrangler d1 execute tas-king --remote --file "$FILE"
    ok "Producción restaurada desde $FILE"
    warn "Verificá que la app funcione correctamente en https://tas-king.pablotortorella.workers.dev"
    ;;

  *)
    fail "Destino desconocido: '$TARGET'. Usá: local, staging, o prod"
    ;;
esac
