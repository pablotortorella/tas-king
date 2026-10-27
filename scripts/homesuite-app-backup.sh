#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

ENVIRONMENT="${1:-staging}"
BACKUP_BUCKET=""
case "$ENVIRONMENT" in
  staging)
    DATABASE="homesuite-app-db-staging"
    ;;
  production)
    DATABASE="homesuite-app-db"
    BACKUP_BUCKET="homesuite-app-backups"
    ;;
  *)
    echo "Ambiente no habilitado para backup de HomeSuite: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077
if [ "$ENVIRONMENT" = production ]; then
  DESTINATION="$(mktemp -d "${TMPDIR:-/tmp}/homesuite-prod-backup.XXXXXX")"
  trap 'rm -rf -- "$DESTINATION"' EXIT
else
  BACKUP_ROOT="${HOMESUITE_BACKUP_DIR:-$ROOT/backups/homesuite-app}"
  DESTINATION="$BACKUP_ROOT/$ENVIRONMENT/$TIMESTAMP"
  mkdir -p "$DESTINATION"
fi
SQL_FILE="$DESTINATION/database.sql"
BOOKMARK_FILE="$DESTINATION/bookmark.json"
MANIFEST_FILE="$DESTINATION/manifest.txt"

echo "Obteniendo bookmark de $DATABASE..."
npx wrangler d1 time-travel info "$DATABASE" \
  --env "$ENVIRONMENT" \
  --config apps/app/wrangler.jsonc \
  --json > "$BOOKMARK_FILE"

echo "Exportando $DATABASE..."
if ! npx wrangler d1 export "$DATABASE" \
  --remote \
  --env "$ENVIRONMENT" \
  --config apps/app/wrangler.jsonc \
  --output "$SQL_FILE" \
  --skip-confirmation > /dev/null 2>&1; then
  echo "La exportación de $DATABASE falló; no se continuará con el backup." >&2
  exit 1
fi

test -s "$BOOKMARK_FILE"
test -s "$SQL_FILE"

{
  printf 'environment=%s\n' "$ENVIRONMENT"
  printf 'database=%s\n' "$DATABASE"
  printf 'created_at=%s\n' "$TIMESTAMP"
  printf 'sha256=%s\n' "$(sha256sum "$SQL_FILE" | cut -d' ' -f1)"
} > "$MANIFEST_FILE"

if [ "$ENVIRONMENT" = production ]; then
  echo "Comprobando restauración local aislada antes de subir el respaldo..."
  bash scripts/homesuite-app-restore-drill.sh "$SQL_FILE" > /dev/null
  echo "Restauración local e integridad correctas."
  OBJECT_PREFIX="$BACKUP_BUCKET/production/$TIMESTAMP"
  npx wrangler r2 object put "$OBJECT_PREFIX/database.sql" --remote --file "$SQL_FILE" --content-type application/sql --force
  npx wrangler r2 object put "$OBJECT_PREFIX/bookmark.json" --remote --file "$BOOKMARK_FILE" --content-type application/json --force
  # El manifiesto se sube último: indica que las tres piezas terminaron correctamente.
  npx wrangler r2 object put "$OBJECT_PREFIX/manifest.txt" --remote --file "$MANIFEST_FILE" --content-type text/plain --force
  printf 'Backup de HomeSuite completo en R2: %s\n' "$OBJECT_PREFIX"
else
  printf 'Backup de HomeSuite completo: %s\n' "$DESTINATION"
  printf 'HOMESUITE_BACKUP_SQL=%s\n' "$SQL_FILE"
fi
