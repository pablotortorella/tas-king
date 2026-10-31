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

echo "Importando backup en una base SQLite local aislada..."
# El export de D1 crea las tablas en el orden de las migraciones: una clave foránea agregada después (por ejemplo
# `pending_import_batch_id`) puede apuntar a una tabla que se crea más abajo, y con claves foráneas activas la carga falla
# en cuanto hay filas. La carga las desactiva y la comprobación posterior (`PRAGMA foreign_key_check`) las verifica.
node --no-warnings -e '
  const fs = require("node:fs");
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(process.argv[3]);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(fs.readFileSync(process.argv[1], "utf8"));
  const run = sql => db.prepare(sql).all().map(row => ({ ...row }));
  const checks = [
    { results: run("PRAGMA quick_check") },
    { results: run("PRAGMA foreign_key_check") },
    { results: run("SELECT COUNT(*) AS essential_tables FROM sqlite_master WHERE type = \u0027table\u0027 AND name IN (\u0027users\u0027, \u0027groups\u0027, \u0027memberships\u0027, \u0027invitations\u0027, \u0027sessions\u0027)") },
  ];
  fs.writeFileSync(process.argv[2], JSON.stringify(checks));
' "$SQL_FILE" "$RESULT_FILE" "$STATE_DIR/restore.db"

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
