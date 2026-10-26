#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

SQL_FILE="${1:-}"
if [ -z "$SQL_FILE" ] || [ ! -s "$SQL_FILE" ]; then
  echo "Uso: npm run db:restore-drill:homesuite-app -- <backup.sql>" >&2
  exit 1
fi

STATE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/homesuite-restore-drill.XXXXXX")"
RESULT_FILE="$STATE_DIR/checks.json"
trap 'rm -rf "$STATE_DIR"' EXIT

echo "Importando backup en D1 local aislada..."
npx wrangler d1 execute homesuite-app-local \
  --local \
  --persist-to "$STATE_DIR" \
  --config apps/app/wrangler.jsonc \
  --file "$SQL_FILE" \
  --yes

npx wrangler d1 execute homesuite-app-local \
  --local \
  --persist-to "$STATE_DIR" \
  --config apps/app/wrangler.jsonc \
  --command "PRAGMA quick_check; PRAGMA foreign_key_check; SELECT COUNT(*) AS essential_tables FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'groups', 'memberships', 'invitations', 'sessions');" \
  --json > "$RESULT_FILE"

node -e '
  const fs = require("node:fs");
  const batches = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const rows = batches.flatMap(batch => batch.results ?? []);
  const integrity = rows.find(row => Object.hasOwn(row, "quick_check"));
  const tables = rows.find(row => Object.hasOwn(row, "essential_tables"));
  if (integrity?.quick_check !== "ok") throw new Error("PRAGMA quick_check no devolvió ok");
  if ((batches[1]?.results ?? []).length !== 0) throw new Error("PRAGMA foreign_key_check encontró violaciones");
  if (Number(tables?.essential_tables) !== 5) throw new Error("Faltan tablas esenciales en el backup");
' "$RESULT_FILE"

echo "Restore drill correcto: integridad, foreign keys y tablas esenciales verificadas."
