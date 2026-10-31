#!/usr/bin/env bash
# Vacía por completo la base D1 de staging de HomeSuite App (tablas, índices, triggers y el registro de migraciones) para volver a
# aplicar las migraciones desde cero. Solo staging, solo con confirmación explícita y backup previo.
#
#   bash scripts/homesuite-app-reset-staging.sh rehearse <directorio-de-estado>   ensayo en D1 local descartable
#   bash scripts/homesuite-app-reset-staging.sh show                              muestra el SQL, no ejecuta nada
#   CONFIRM_RESET_STAGING=homesuite-app-db-staging bash scripts/homesuite-app-reset-staging.sh staging
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

MODE="${1:-}"
DATABASE="homesuite-app-db-staging"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/homesuite-reset.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

run_sql() { # run_sql <local|staging> <state-dir|-> <comando o archivo>
  local target="$1" state="$2" kind="$3" value="$4" extra=()
  if [ "$target" = "local" ]; then
    extra=(homesuite-app-local --local --persist-to "$state")
  else
    extra=("$DATABASE" --remote --env staging)
  fi
  npx wrangler d1 execute "${extra[@]}" --config apps/app/wrangler.jsonc "--$kind" "$value" --yes --json
}

# Genera el SQL que borra cada tabla propia (los índices y triggers caen con su tabla); no toca tablas internas de SQLite ni de Cloudflare.
build_sql() { # build_sql <local|staging> <state-dir|->
  run_sql "$1" "$2" command "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name" > "$WORK_DIR/tables.json"
  node -e '
    const batches = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const names = batches.flatMap(batch => batch.results ?? []).map(row => row.name);
    const quote = name => `"${name.replaceAll("\"", "\"\"")}"`;
    console.log(["PRAGMA defer_foreign_keys = true;", ...names.map(name => `DROP TABLE IF EXISTS ${quote(name)};`)].join("\n"));
  ' "$WORK_DIR/tables.json" > "$WORK_DIR/reset.sql"
}

case "$MODE" in
  rehearse)
    STATE="${2:-}"
    if [ -z "$STATE" ]; then echo "Uso: rehearse <directorio-de-estado descartable>" >&2; exit 1; fi
    build_sql local "$STATE"
    cat "$WORK_DIR/reset.sql"
    run_sql local "$STATE" file "$WORK_DIR/reset.sql" > /dev/null
    echo "Ensayo local terminado."
    ;;
  show)
    build_sql staging -
    echo "-- Esto se ejecutaría contra $DATABASE (remoto, staging):"
    cat "$WORK_DIR/reset.sql"
    ;;
  staging)
    if [ "${CONFIRM_RESET_STAGING:-}" != "$DATABASE" ]; then
      echo "Falta la confirmación explícita: CONFIRM_RESET_STAGING=$DATABASE" >&2
      echo "Antes: npm run db:backup:homesuite-app:staging y revisar el SQL con el modo show." >&2
      exit 1
    fi
    build_sql staging -
    cat "$WORK_DIR/reset.sql"
    run_sql staging - file "$WORK_DIR/reset.sql" > /dev/null
    echo "Base de staging vaciada. Siguiente paso: npm run deploy:homesuite-app:staging"
    ;;
  *)
    echo "Uso: rehearse <estado> | show | staging (con CONFIRM_RESET_STAGING)" >&2
    echo "Producción no está habilitada." >&2
    exit 1
    ;;
esac
