#!/usr/bin/env bash
set -euo pipefail

# ─── Colores ────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ─── Helpers ────────────────────────────────────────────────────────────────
header() {
  printf '\033[2J\033[H' 2>/dev/null || true
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════╗"
  echo "║         FUN TasKing!  —  Operador            ║"
  echo "╚══════════════════════════════════════════════╝"
  echo -e "${NC}"
}

section() { echo -e "\n${CYAN}${BOLD}  $1${NC}"; }

item() {
  local num="$1" label="$2" note="${3:-}"
  printf "  ${BOLD}%2s)${NC} %-38s ${DIM}%s${NC}\n" "$num" "$label" "$note"
}

pause() {
  echo ""
  read -r -p "  Presioná Enter para volver al menú..." _
}

confirm() {
  local prompt="${1:-¿Confirmar? [s/N]}"
  echo ""
  read -r -p "  $prompt " ans
  [[ "$ans" =~ ^[sS]$ ]]
}

briefing() {
  local title="$1" what="$2" risks="$3" gains="$4"
  echo ""
  echo -e "${BOLD}  ┌─ $title${NC}"
  echo -e "${BOLD}  │${NC}"
  echo -e "${BOLD}  │  QUÉ HACE:${NC}"
  echo -e "  │  $what" | fold -s -w 60 | sed 's/^/  │  /'
  echo -e "${BOLD}  │${NC}"
  echo -e "${YELLOW}${BOLD}  │  RIESGOS / LO QUE SE PIERDE:${NC}"
  echo -e "${YELLOW}  │  $risks${NC}" | fold -s -w 60 | sed 's/^/  │  /'
  echo -e "${BOLD}  │${NC}"
  echo -e "${GREEN}${BOLD}  │  LO QUE SE GANA:${NC}"
  echo -e "${GREEN}  │  $gains${NC}" | fold -s -w 60 | sed 's/^/  │  /'
  echo -e "${BOLD}  └──────────────────────────────────────${NC}"
}

escape_warning() {
  echo ""
  echo -e "${RED}${BOLD}  ╔══════════════════════════════════════════╗"
  echo -e "  ║  ⚠️   ESCAPE HATCH — ZONA DE RIESGO      ║"
  echo -e "  ║  Esta acción bypasea estándares del       ║"
  echo -e "  ║  proyecto de forma explícita y consciente.║"
  echo -e "  ╚══════════════════════════════════════════╝${NC}"
}

run() {
  echo ""
  echo -e "${DIM}  $ $*${NC}"
  echo ""
  eval "$@"
}

# ─── Acciones ───────────────────────────────────────────────────────────────

do_check_env() {
  briefing \
    "Verificar ambiente" \
    "Chequea Node, Wrangler, .dev.vars, wrangler.jsonc, DB local y Playwright. No modifica nada." \
    "Ninguno. Es solo lectura." \
    "Confirmás que el ambiente está listo antes de trabajar. Ideal para empezar una sesión o diagnosticar problemas."
  confirm "¿Verificar ambiente? [s/N]" && run "bash scripts/check-env.sh" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_dev() {
  briefing \
    "Arrancar servidor local" \
    "Inicia 'wrangler dev' en http://localhost:8787. Usa la DB local (.wrangler/state). No toca staging ni producción." \
    "Ocupa el puerto 8787. Si hay otro proceso escuchando, falla. No hay riesgo de datos." \
    "Podés desarrollar y ver cambios en tiempo real con la DB local."
  confirm "¿Arrancar servidor? [s/N]" && run "npm run dev" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_test_all() {
  briefing \
    "Correr suite completa de tests" \
    "Ejecuta vitest (unitarios + API) y playwright (E2E). Levanta servidor E2E temporario. Puede tardar 1-3 minutos." \
    "Ninguno. Los tests usan DB E2E aislada (.wrangler/e2e-state), no tocan datos locales ni remotos." \
    "Confirmás que todo funciona antes de commitear o deployar. Requerido por el flujo del proyecto."
  confirm "¿Correr tests? [s/N]" && run "npm run test:all" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_test_watch() {
  briefing \
    "Tests unitarios en modo watch" \
    "Corre vitest en modo interactivo: re-ejecuta solo los tests afectados al guardar archivos." \
    "Ninguno. Solo lectura + ejecución local." \
    "Feedback inmediato mientras desarrollás. Ideal para TDD o cuando trabajás en una feature específica."
  confirm "¿Arrancar test:watch? [s/N]" && run "npm run test:watch" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_reset_and_seed() {
  briefing \
    "Reset DB local + seed" \
    "Borra .wrangler/state/, re-aplica las 9 migraciones desde cero, y carga datos de ejemplo (tarjetas, etiquetas, checklist, comentarios)." \
    "IRREVERSIBLE para datos locales. Perdés todo lo que hayas cargado a mano en la DB local. El e2e-state NO se toca." \
    "DB local limpia con datos coherentes y realistas para desarrollar sin partir de cero."
  confirm "¿Resetear DB local y aplicar seed? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  echo ""
  echo "S" | run "bash scripts/db-reset-local.sh" && run "bash scripts/seed-local.sh"
  pause
}

do_reset_only() {
  briefing \
    "Reset DB local (sin seed)" \
    "Borra .wrangler/state/ y re-aplica las migraciones. Sin datos de ejemplo." \
    "IRREVERSIBLE para datos locales. Perdés todo lo cargado a mano. El e2e-state NO se toca." \
    "DB local absolutamente limpia. Útil para probar onboarding desde cero o reproducir bugs en estado vacío."
  confirm "¿Resetear DB local sin seed? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  echo "S" | run "bash scripts/db-reset-local.sh"
  pause
}

do_seed_only() {
  briefing \
    "Aplicar seed (sin reset)" \
    "Carga datos de ejemplo sobre la DB local existente. Si el seed ya fue aplicado, no hace nada (idempotente)." \
    "Bajo. Agrega datos pero no borra nada. Si ya existe el sentinel de seed, sale sin tocar nada." \
    "Datos de ejemplo disponibles sin perder lo que ya tenías en la DB local."
  confirm "¿Aplicar seed? [s/N]" && run "bash scripts/seed-local.sh" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_migrate_local() {
  briefing \
    "Aplicar migraciones pendientes (local)" \
    "Corre 'wrangler d1 migrations apply' en la DB local. Solo aplica migraciones que aún no se ejecutaron." \
    "Mínimo. Si una migración tiene un bug, puede dejar la DB en estado inconsistente. En ese caso usá 'reset DB local'." \
    "DB local al día con el schema actual. Necesario después de hacer pull de una rama con nuevas migraciones."
  confirm "¿Aplicar migraciones locales? [s/N]" && run "npm run db:migrate:local" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_e2e_reset() {
  briefing \
    "Reset estado E2E" \
    "Borra .wrangler/e2e-state/, re-aplica las 9 migraciones y carga el seed E2E base. El global-setup de Playwright también hace esto antes de cada run, pero este script lo fuerza manualmente." \
    "Borra el estado E2E. No afecta la DB local ni producción." \
    "Elimina estado corrupto o inesperado que haga fallar los tests E2E. Ideal cuando los tests fallan por razones de estado y no de código."
  confirm "¿Resetear estado E2E? [s/N]" && run "bash scripts/e2e-reset.sh" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_e2e_server() {
  briefing \
    "Arrancar servidor E2E" \
    "Inicia wrangler dev en puerto 8787 usando .wrangler/e2e-state y usuario e2e-admin@test.local. Permite correr playwright manualmente o con --ui." \
    "Ocupa el puerto 8787. Si ya hay un servidor dev corriendo, hay conflicto." \
    "Podés correr 'npm run test:e2e' o 'npx playwright test --ui' en paralelo para debugging interactivo."
  confirm "¿Arrancar servidor E2E? [s/N]" && run "npm run e2e:server" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_deploy_staging() {
  briefing \
    "Deploy a staging" \
    "Corre verify-ready (tests completos), luego despliega a Cloudflare staging y aplica migraciones en la DB de staging (tas-king-staging)." \
    "Toca el ambiente de staging compartido. Si los tests fallan, el deploy no avanza. Si las migraciones fallan a mitad, staging puede quedar inconsistente." \
    "Podés probar en una URL real (staging.workers.dev) antes de tocar producción. Datos de staging son independientes de producción."
  confirm "¿Deployar a staging? [s/N]" && run "npm run deploy:staging" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

do_deploy_prod() {
  briefing \
    "Deploy a PRODUCCIÓN" \
    "Corre verify-ready (tests completos), despliega a Cloudflare producción y aplica migraciones en la DB de producción (tas-king)." \
    "⚠️  AFECTA USUARIOS REALES. Si algo falla, hay downtime. Las migraciones de DB no se pueden deshacer automáticamente. El rollback requiere intervención manual." \
    "La versión más reciente llega a usuarios. Solo hacerlo después de validar en staging."
  echo ""
  echo -e "${RED}${BOLD}  Este es el deploy a PRODUCCIÓN. Usuarios reales serán afectados.${NC}"
  confirm "¿Estás seguro? ¿Ya revisaste staging? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  confirm "Última confirmación — ¿deployar a producción ahora? [s/N]" && run "npm run deploy" || echo -e "\n  ${DIM}Cancelado.${NC}"
  pause
}

# ─── Escape hatches ─────────────────────────────────────────────────────────

do_sql_local() {
  escape_warning
  briefing \
    "SQL directo en DB local" \
    "Abre un prompt para escribir SQL arbitrario contra la DB local. Sin validaciones ni tests." \
    "Podés corromper la DB local, dejarla en estado inconsistente, o borrar datos que no querías. No hay undo." \
    "Útil para inspeccionar datos rápido, probar queries, o forzar un estado específico sin escribir código."
  confirm "¿Continuar con SQL directo en local? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  echo ""
  echo -e "  ${DIM}Ingresá el SQL (una sola sentencia). Ctrl+C para cancelar.${NC}"
  read -r -p "  SQL> " sql
  if [ -n "$sql" ]; then
    run "npx wrangler d1 execute tas-king --local --command \"$sql\""
  fi
  pause
}

do_sql_staging() {
  escape_warning
  briefing \
    "SQL directo en DB de STAGING" \
    "Ejecuta SQL arbitrario contra la base de datos de staging remota (tas-king-staging)." \
    "⚠️  Toca la DB remota de staging. Podés borrar o corromper datos de staging. Requiere wrangler autenticado." \
    "Inspeccionar datos en staging, forzar estados para probar, limpiar datos de prueba acumulados."
  confirm "¿SQL directo en staging remoto? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  confirm "¿Segunda confirmación para staging remoto? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  echo ""
  echo -e "  ${DIM}Ingresá el SQL (una sola sentencia). Ctrl+C para cancelar.${NC}"
  read -r -p "  SQL> " sql
  if [ -n "$sql" ]; then
    run "npx wrangler d1 execute tas-king-staging --remote --env staging --command \"$sql\""
  fi
  pause
}

do_deploy_skip_tests() {
  escape_warning
  briefing \
    "Deploy a staging SIN correr tests" \
    "Despliega directamente a staging y aplica migraciones, saltando verify-ready (tests + check de secrets)." \
    "⚠️  Podés deployar código roto. Si hay un bug, staging queda en mal estado. Las migraciones siguen corriendo (no se saltean)." \
    "Útil cuando los tests fallan por razones de infraestructura (flakiness, browser no disponible) y ya sabés que el código está bien. Ahorra 2-3 minutos de CI."
  confirm "¿Deployar a staging SIN tests? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  confirm "¿Confirmás que omitir tests es intencional? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  run "wrangler deploy --env staging && npm run db:migrate:staging"
  pause
}

do_shell() {
  escape_warning
  briefing \
    "Shell con contexto del proyecto" \
    "Abre una subshell bash en el directorio raíz del proyecto. Podés correr cualquier comando libremente." \
    "Sin restricciones — podés hacer cualquier cosa: borrar archivos, modificar la DB, deployar sin guards. Todo queda en tu historial de shell." \
    "Máxima flexibilidad para situaciones no contempladas por el menú. Salí con 'exit' para volver."
  confirm "¿Abrir shell libre? [s/N]" || { echo -e "\n  ${DIM}Cancelado.${NC}"; pause; return; }
  echo -e "\n  ${DIM}Escribí 'exit' para volver al operador.${NC}\n"
  bash --norc --noprofile -i || true
  pause
}

# ─── Menú principal ──────────────────────────────────────────────────────────

main_menu() {
  while true; do
    header

    section "DESARROLLO"
    item  1 "Verificar ambiente"                  "check:env"
    item  2 "Arrancar servidor local"              "npm run dev"
    item  3 "Correr suite completa de tests"       "test:all"
    item  4 "Tests unitarios en modo watch"        "test:watch"

    section "BASE DE DATOS"
    item  5 "Reset DB local + seed"               "⚠️  borra datos locales"
    item  6 "Reset DB local (sin seed)"           "⚠️  borra datos locales"
    item  7 "Aplicar seed (sin reset)"            "idempotente"
    item  8 "Aplicar migraciones pendientes"      "db:migrate:local"

    section "E2E"
    item  9 "Reset estado E2E"                    "limpia e2e-state"
    item 10 "Arrancar servidor E2E"               "e2e:server"

    section "DEPLOY"
    item 11 "Deploy a staging"                    "con tests + migraciones"
    item 12 "Deploy a PRODUCCIÓN"                 "⚠️⚠️  afecta usuarios reales"

    section "ESCAPE HATCH  ⚠️"
    item 13 "SQL directo en DB local"             "sin validaciones"
    item 14 "SQL directo en DB de staging"        "remoto · doble confirmación"
    item 15 "Deploy a staging SIN tests"          "bypasea verify-ready"
    item 16 "Shell libre en el proyecto"          "sin restricciones"

    echo ""
    item  0 "Salir" ""
    echo ""
    read -r -p "  Opción: " choice

    case "$choice" in
      1)  do_check_env ;;
      2)  do_dev ;;
      3)  do_test_all ;;
      4)  do_test_watch ;;
      5)  do_reset_and_seed ;;
      6)  do_reset_only ;;
      7)  do_seed_only ;;
      8)  do_migrate_local ;;
      9)  do_e2e_reset ;;
      10) do_e2e_server ;;
      11) do_deploy_staging ;;
      12) do_deploy_prod ;;
      13) do_sql_local ;;
      14) do_sql_staging ;;
      15) do_deploy_skip_tests ;;
      16) do_shell ;;
      0)  echo -e "\n  ${DIM}Hasta la próxima.${NC}\n"; exit 0 ;;
      *)  echo -e "\n  ${YELLOW}Opción no válida.${NC}"; sleep 1 ;;
    esac
  done
}

main_menu
