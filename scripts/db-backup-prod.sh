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

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
OUTPUT="$BACKUP_DIR/prod-$TIMESTAMP.sql"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════╗"
echo "║   FUN TasKing! — db:backup:prod      ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

step "Creando directorio de backups"
mkdir -p "$BACKUP_DIR"
ok "$BACKUP_DIR"

step "Exportando DB de producción"
warn "Esto conecta a la DB remota de producción (solo lectura)."
npx wrangler d1 export tas-king --remote --output "$OUTPUT" --skip-confirmation 2>&1
ok "Backup guardado: $OUTPUT"

SIZE=$(du -sh "$OUTPUT" | cut -f1)
ok "Tamaño: $SIZE"

# Si existe una ruta de Dropbox configurada, copiar allí también
if [ -n "${DROPBOX_BACKUP_PATH:-}" ]; then
  step "Copiando a Dropbox"
  mkdir -p "$DROPBOX_BACKUP_PATH"
  cp "$OUTPUT" "$DROPBOX_BACKUP_PATH/"
  ok "Copiado a $DROPBOX_BACKUP_PATH/"
fi

echo -e "\n${GREEN}╔══════════════════════════════════════╗"
echo "║   ✅ Backup completado               ║"
printf "║   %-38s║\n" "$OUTPUT"
echo -e "╚══════════════════════════════════════╝${NC}\n"
