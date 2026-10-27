#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PREFIX="${1:-}"
if [[ ! "$PREFIX" =~ ^production/[0-9]{8}T[0-9]{6}Z$ ]]; then
  echo "Uso: npm run db:verify-backup:homesuite-app -- production/<timestamp-UTC>" >&2
  exit 1
fi

BUCKET="homesuite-app-backups"
STATE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/homesuite-backup-verify.XXXXXX")"
trap 'rm -rf -- "$STATE_DIR"' EXIT
umask 077

for filename in database.sql bookmark.json manifest.txt; do
  if ! npx wrangler r2 object get "$BUCKET/$PREFIX/$filename" --remote --file "$STATE_DIR/$filename" > /dev/null 2>&1; then
    echo "No se pudo recuperar $filename del backup indicado." >&2
    exit 1
  fi
  test -s "$STATE_DIR/$filename"
done

get_field() { sed -n "s/^$1=//p" "$STATE_DIR/manifest.txt" | head -n 1; }
test "$(get_field environment)" = production
test "$(get_field database)" = homesuite-app-db
test "$(get_field created_at)" = "${PREFIX#production/}"
EXPECTED_HASH="$(get_field sha256)"
[[ "$EXPECTED_HASH" =~ ^[0-9a-f]{64}$ ]]
test "$(sha256sum "$STATE_DIR/database.sql" | cut -d' ' -f1)" = "$EXPECTED_HASH"

bash scripts/homesuite-app-restore-drill.sh "$STATE_DIR/database.sql" > /dev/null
printf 'Backup verificado desde R2: %s (SHA-256 y restauración local correctos)\n' "$PREFIX"
