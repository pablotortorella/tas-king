#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

ENVIRONMENT="${1:-staging}"
case "$ENVIRONMENT" in
  staging)
    DATABASE="homesuite-app-db-staging"
    ;;
  *)
    echo "Ambiente no habilitado para backup de HomeSuite: $ENVIRONMENT" >&2
    echo "Producción seguirá bloqueada hasta crear sus recursos y retención externa." >&2
    exit 1
    ;;
esac

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${HOMESUITE_BACKUP_DIR:-$ROOT/backups/homesuite-app}"
DESTINATION="$BACKUP_ROOT/$ENVIRONMENT/$TIMESTAMP"
SQL_FILE="$DESTINATION/database.sql"
BOOKMARK_FILE="$DESTINATION/bookmark.json"
MANIFEST_FILE="$DESTINATION/manifest.txt"

mkdir -p "$DESTINATION"

echo "Obteniendo bookmark de $DATABASE..."
npx wrangler d1 time-travel info "$DATABASE" \
  --env "$ENVIRONMENT" \
  --config apps/app/wrangler.jsonc \
  --json > "$BOOKMARK_FILE"

echo "Exportando $DATABASE..."
npx wrangler d1 export "$DATABASE" \
  --remote \
  --env "$ENVIRONMENT" \
  --config apps/app/wrangler.jsonc \
  --output "$SQL_FILE" \
  --skip-confirmation

test -s "$BOOKMARK_FILE"
test -s "$SQL_FILE"

{
  printf 'environment=%s\n' "$ENVIRONMENT"
  printf 'database=%s\n' "$DATABASE"
  printf 'created_at=%s\n' "$TIMESTAMP"
  printf 'sha256=%s\n' "$(sha256sum "$SQL_FILE" | cut -d' ' -f1)"
} > "$MANIFEST_FILE"

printf 'Backup de HomeSuite completo: %s\n' "$DESTINATION"
printf 'HOMESUITE_BACKUP_SQL=%s\n' "$SQL_FILE"
