# AI_HANDOFF

## Estado actual
**FUN TasKing!** es un tablero Kanban minimalista multiusuario, desplegado en producción en
https://tas-king.pablotortorella.workers.dev. El proyecto está activo y en iteración continua.

**Versión actual**: v2.1 — **Tests**: 101 unitarios + 29 E2E ✅ Todos pasan  
**Rama**: `main` — producción actualizada ✅

**Features completos**: Deep-link, Polling real-time, Celebración con confeti, Historial (#1),
Etiquetas (#2) con gestión desde ⚙️, Checklists (#3), Protección adjuntos (#4), JWT Google (#5),
Modo oscuro (#6), Panel ¿Cómo vamos? / Métricas (#7 + #8), Objetivos (#8), Columnas de cierre
múltiples (🏁 toggle isDone), Columnas customizables (crear/renombrar/eliminar/reordenar),
Import/Export JSON+CSV completos (labels + checklists + assignee), Modal tarjeta 2 columnas,
CSP + Security headers, i18n landing, Panel admin, IO menu.

**Próximo**: #9 ¡Pilas con esto! como puerta de entrada inteligente (ver PROJECT_BACKLOG.md),
o mejoras de UX (onboarding nuevos usuarios, búsqueda full-text).

## 🎯 Objetivo siguiente sesión

Opciones priorizadas:

1. **#9 ¡Pilas con esto! inteligente** (alta): convertir la sección en puerta de entrada activa al abrir la app — "¿por dónde empezamos hoy?". Ver ideas en PROJECT_BACKLOG.md.
2. **Onboarding nuevos usuarios** (media): primera vez que alguien entra y ve el tablero vacío, guiarlos.
3. **Búsqueda full-text** (baja): buscar por título + detalles en todas las tarjetas.
4. **Objetivos: fecha límite + semáforo de riesgo** (media): extiende #8 con 🟢🟡🔴.

Ver `docs/STATUS.md` para estado detallado de cada feature.
Ver `docs/WORKFLOW.md` para cómo trabajar — incluye estándares de UI que deben cumplirse en cada feature nueva.

## Stack
- **Runtime**: Cloudflare Workers
- **Framework API**: Hono (JS)
- **Base de datos**: Cloudflare D1 (SQLite) — migraciones en `migrations/`
- **Almacenamiento de archivos**: Cloudflare R2 (`tas-king-uploads`)
- **Frontend**: HTML/CSS/JS vanilla en un único `public/index.html` (sin build)
- **Auth**: OAuth 2.0 con Google, implementado dentro del Worker. Cookie de sesión firmada con HMAC
- **Dev local**: `wrangler dev` con D1/R2 emulados. Usuario simulado vía `DEV_USER_EMAIL` en `.dev.vars`

## Decisiones tomadas
- **Un solo archivo de frontend**: `public/index.html` sin framework ni build step. Decisión
  deliberada para mantener simplicidad operativa.
- **Sin Cloudflare Access**: se intentó pero no funciona en subdominios `*.workers.dev`. Se
  implementó OAuth de Google directamente en el Worker.
- **Emails permitidos en D1**: la lista de acceso pasó del Secret `ALLOWED_EMAILS` a la tabla
  `allowed_emails`, para poder gestionarla desde la UI. El Secret se mantiene como fallback.
- **Admins configurables vía Secret `ADMIN_EMAILS`**: quienes forkeen el repo definen sus propios
  admins; no hay emails hardcodeados en el código.
- **Import agrega, no reemplaza**: la importación de tarjetas nunca pisa datos existentes.
- **Roles owner/member**: no hay "solo lectura". El tablero personal tiene `is_personal=1` y no
  se puede borrar.
- **Backfill de datos históricos**: la migración `0002` hardcodea `pablotortorella@gmail.com`
  para los datos previos al multiusuario — esto es específico de esta instancia.

## Archivos importantes
- `src/index.js`: setup del Worker (~80 líneas) — importa routes y middlewares
- `src/routes/`: auth, boards, cards, checklists, labels, uploads, admin, users
- `public/index.html`: frontend completo — UI Kanban, modales, drag & drop, atajos (~2800 líneas)
- `migrations/`: esquema D1 incremental (0001 init → 0010 goals)
- `wrangler.jsonc`: configuración de Workers, D1 y R2
- `.dev.vars`: variables locales (no commiteado — ver README para el formato)
- `docs/STATUS.md`: **[IMPORTANTE]** estado de cada feature (qué está hecho, qué falta, tests)
- `memory/roadmap.md`: backlog priorizado con razones
- `memory/SESSION.md`: contexto de la última sesión
- `e2e/`: suites Playwright (attachments, checklists, critical-flows, history)
- `test/fixtures/seed.sql`: estado inicial de la DB para E2E

## Al finalizar cada sesión

**1. Actualizar `docs/STATUS.md`**: (SIEMPRE, incluso si "no pasó nada")
   - Agregar la feature completada en la sección correspondiente (✅ o ❌)
   - Incluir: qué hace, dónde está implementado, qué tests tiene
   - Actualizar fecha "Última actualización" y "Próxima feature"
   - Si algo quedó a mitad, marcarlo con ⚠️ y notas de qué falta

**2. Actualizar otros archivos si corresponde**:
   - **`AI_HANDOFF.md`**: sección "Último handoff" con resumen de lo que se hizo
   - **`README.md`**: si se agregaron funcionalidades, secrets, comandos o cambió el stack
   - **`TESTING.md`**: si cambió la estrategia o se agregaron nuevos requisitos de testing

**3. Correr tests antes de commit**:
   ```bash
   npm run test:all
   ```

**4. Commit y push**:
   - Incluir `docs/STATUS.md` en el commit (la razón principal)
   - Mensaje: describe qué feature se completó o qué cambió
   - Ejemplo: `Agregar tests E2E para deep-link: URL válida, inexistente, archivada`

## Comandos útiles
```bash
# Inicio de sesión
npm run check:env                  # diagnóstico rápido del ambiente (recomendado al iniciar)

# Desarrollo
npm install                        # instalar dependencias
npm run dev                        # servidor local → http://localhost:8787
npm run test:all                   # suite completa (unitarios + E2E)

# Base de datos local
npm run db:migrate:local           # aplicar migraciones pendientes en D1 local
npm run db:reset:local             # borrar DB local y re-aplicar desde cero ⚠️
npm run db:seed:local              # cargar datos de ejemplo (idempotente)

# E2E
npm run e2e:reset                  # limpiar estado E2E + re-aplicar seed (ante estado corrupto)
npm run e2e:server                 # servidor E2E solo (para debugging de tests)

# Deploy
npm run deploy:staging             # deploy a staging (con tests)
npm run deploy                     # deploy a producción (con tests) ⚠️ requiere aprobación
npm run db:migrate:remote          # aplicar migraciones en D1 producción

# Operación manual
npm run operator                   # menú interactivo (solo para humanos — no usar en scripts)
npx wrangler secret put <NOMBRE>   # cargar un secret en producción
npx wrangler d1 execute tas-king --remote --command "SELECT ..."  # consulta SQL en prod
```

Hay tests unitarios y de API con Vitest ejecutándose en Workerd con D1/R2 emulados, más tests
E2E con Playwright. `npm run test:all` ejecuta la suite completa. La estrategia y el checklist
manual complementario para IAs y personas están en `TESTING.md`.

## Estado de features del backlog

| Item | Estado | Notas |
|---|---|---|
| #0 🔗 Deep-link | ✅ Tests E2E | `checkDeepLink()` + GET `/api/cards/:id`. 4 casos cubiertos. |
| ⚡ Polling real-time | ✅ Manual | `/api/boards/:id/version` + cliente cada 5s. |
| 🎉 Celebración | ✅ Manual | Confeti + animación. Sin test E2E (difícil). |
| #1 📜 Historial | ✅ Tests E2E | `audit_log`, 8 eventos, panel modal + admin. Drag & drop registrado. |
| #2 🏷️ Etiquetas | ✅ Tests E2E | `labels`+`card_labels`, filtro 1-9, paleta 10 colores. |
| #3 ✅ Checklists | ✅ Tests E2E | `checklists`+`checklist_items`, modo borrador, badge ☑ N/M. |
| #4 🔐 Adjuntos | ✅ Tests E2E | 2-layer validation: sesión + membresía + MIME + tamaño + cantidad. |
| #5 🛡️ JWT Google | ✅ Unitarios | Firma RSA + claims. Detecta tampering. |
| #8 🎯 Objetivos | ✅ Tests (PR #9) | `goals`+`card_goals`, panel lateral + ⛶ Ampliar, filtro/lente, progreso por columna. Pendiente revisar en staging. |
| ⇅ Menú IO | ✅ | Dropdown Datos: exportar CSV / copiar JSON / importar. |
| 🌐 i18n landing | ✅ | ES/EN/PT/ZH inline en landing.html. |
| #6 🌙 Modo oscuro | ✅ Tests E2E | Toggle 🌙/☀️ en header, `data-theme` + `color-scheme`, localStorage, prefers-color-scheme, sin flash. |
| #7 📊 Lead time | ❌ | Métricas personales de productividad. |
| CSP + security headers | ✅ | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy en `middleware/cors.js`. Rate limiting por endpoint en `middleware/rateLimit.js`. Pendiente: audit/hardening. |

## Pendientes
- [x] #0 🔗 Deep-link a una tarjeta
- [x] ⚡ Polling de cambios en tiempo real
- [x] 🎉 Celebración al terminar
- [x] #1 📜 Historial de actividad
- [x] #2 🏷️ Etiquetas de colores + filtro
- [x] #3 ✅ Checklists / subtareas
- [x] #4 🔐 Proteger adjuntos
- [x] #5 🛡️ Validar JWT de Google
- [x] #8 🎯 Gestión de objetivos (MVP) — PR #9, pendiente revisar en staging + merge
- [ ] Seguridad: CSP headers, rate limiting granular
- [ ] UX: Tab/Enter en toda la interfaz, onboarding nuevos usuarios
- [x] #6 🌙 Modo oscuro/claro
- [ ] #7 📊 Lead time y tasa de completitud
- [ ] Búsqueda avanzada (full-text en título + detalles)

## No hacer
- No usar Cloudflare Access (no funciona en `*.workers.dev` sin dominio propio)
- No introducir un framework JS ni paso de build en el frontend (decisión de producto)
- No reemplazar datos al importar (import siempre agrega)
- No hardcodear emails de usuarios/admins en el código fuente
- No commitear `.dev.vars` (está en `.gitignore` — contiene credenciales)
- No borrar el tablero personal de un usuario (`is_personal=1`)

## Último handoff (2026-07-01, UX teclado + import completo + documentación — Sonnet 4.6)

### ✅ Import JSON completo
El endpoint `POST /api/boards/:boardId/import` ahora restaura la totalidad de los datos exportados:
- **Responsable** (`assignee_email`): se asigna solo si el email es miembro del tablero destino.
- **Etiquetas**: busca por nombre (case-insensitive) en el tablero; reutiliza las existentes, crea las nuevas hasta el límite de 10.
- **Checklists** con todos sus ítems (texto, checked/unchecked, posición).
- Adjuntos: se ignoran sin error (los archivos binarios no viajan en el JSON).
- La vista previa de importación muestra cuántas tarjetas traen cada tipo de dato.
- **8 nuevos tests** en `test/import.test.js` → 101 unit ✅

### ✅ Modal de tarjeta en dos columnas
Layout CSS Grid `@media (min-width: 700px)` sin cambios de JS:
- **Izquierda**: título, campo-fila (columna + responsable), detalles, checklists, comentarios, historial.
- **Derecha**: objetivos (arriba por su componente estratégica), etiquetas, fecha límite, adjuntos.
- Mobile: sigue siendo una sola columna, sin cambios.

### ✅ Gestión de etiquetas en ⚙️ Configuración
Nueva tab "🏷️ Etiquetas" en el modal de settings del tablero. Permite editar nombre/color o borrar etiquetas existentes, y crear nuevas. Usa los endpoints PUT/DELETE de `src/routes/labels.js` (ya existían pero no tenían UI).

### ✅ UX de teclado — ESC y orden de tabs Admin
- ESC cierra el panel de Objetivos y el de Métricas (sumados a la cadena de cierre existente).
- Tabs del panel Admin reordenados: Actividad del tablero → 📊 Estadísticas → Usuarios → 🔔 Solicitudes.
- El resto de los handlers de Enter/Ctrl+Enter ya estaban implementados desde sesiones anteriores.

### ✅ Columnas de cierre múltiples (sesión anterior, completado)
- Botón 🏁 por columna (owners) marca/desmarca como `is_done=1`. Marcador ✅ en nombre.
- `is_done` desacoplado de la posición: mover una columna no cambia su estado.
- Confeti, métricas, staleCards e isUrgent/isOverdue usan todas las columnas `is_done=1`.

### ✅ Documentación de estándares (esta sesión)
- **ADR-014** (`docs/ADRs/ADR-014-keyboard-ux-standards.md`): criterios de teclado (Enter / Ctrl+Enter / ESC), tabla de estado de implementación, alternativas descartadas.
- **WORKFLOW.md** ampliado: nueva sección "Estándares de UI y consistencia" con checklist obligatorio para cualquier feature con interfaz — tipografía, teclado e import/export en sync.

### Estado final
- **101 unit + 29 E2E ✅ todos pasan**
- **main = staging = producción ✅**
- Notas de versión v2.0 y v2.1 publicadas en `/releases`

---

## Handoff anterior (2026-06-30, Panel Métricas + Columnas customizables — Sonnet 4.6)

### ✅ Columnas customizables — MVP completo
- **Migración** `migrations/0011_columns.sql`: tabla `columns` con PK compuesta `(board_id, id)`,
  índice `idx_columns_board`, e inserción automática de las 5 columnas por defecto en todos los
  tableros existentes con los IDs legacy (`por_conversar`, `pendiente`, `en_progreso`, `por_revisar`, `terminado`).
- **`src/db/columns.js`** (módulo nuevo, sin dependencias circulares):
  `DEFAULT_COLUMNS`, `columnToJSON`, `createDefaultColumns`, `getDoneColumnId`.
  Todos los demás módulos importan desde acá.
- **`src/routes/columns.js`**: REST completo con 4 endpoints:
  - `GET /api/boards/:boardId/columns` — lista columnas del tablero
  - `POST /api/boards/:boardId/columns` — crear columna (owner only, máx 10, nombre máx 50 chars)
  - `PATCH /api/boards/:boardId/columns/:columnId` — renombrar o marcar como `isDone`
  - `DELETE /api/boards/:boardId/columns/:columnId` — eliminar (owner only, sin tarjetas activas, no puede ser la última; transfiere flag `isDone` si era la columna de cierre)
- **`src/db/queries.js`**: `getBoard()` ahora lee las columnas de la DB (antes hardcodeadas).
  Devuelve `{ version, columns, cards }`.
- **`src/routes/goals.js`**: usa `getDoneColumnId()` en lugar de la constante `"terminado"`.
- **`src/routes/boards.js`**: al crear un tablero nuevo llama `createDefaultColumns()`; al borrar un tablero borra sus columnas.
- **`public/index.html`**:
  - `COLUMNS` ahora es dinámico (se llena desde `state.columns` al cargar el tablero).
  - Cada columna muestra botones **✏** (renombrar) y **✕** (eliminar) junto al contador de tarjetas.
  - Widget **`+ Columna`** al final del board (solo owner) con input inline + confirm/cancel.
  - Delegación de eventos en `#board` para renombrar (reemplaza `.col-name-text` por `<input>`)
    y eliminar (confirm nativo + DELETE API).
  - `getDoneColumnId()` derivado de `COLUMNS` (no más constante hardcodeada `"terminado"`).
- **Tests**: 10 unitarios (`test/columns.test.js`) + 4 E2E seriales (`e2e/columns.spec.js`).
  **Total post-sesión: 69 unit + 22 E2E ✅ todos pasan**.

### 🌿 Rama / PR
- Rama: `claude/board-column-customization-jfqgmd` — **pusheada, PR por abrir**.
- **No hay PR abierto todavía** — el usuario debe abrirlo (ver pasos abajo).

### ⏭️ PARA RETOMAR: revisar columnas en staging y mergear

**Paso 0 — Mergear PR #9 (Objetivos) primero** (si aún no está mergeado):
```bash
# Revisar el PR #9 en GitHub y hacer merge desde la UI, o:
git fetch origin main
# Una vez mergeado, continuar con el paso 1.
```

**Paso 1 — Abrir PR para la rama de columnas** (desde GitHub UI o con `gh`):
```
Base: main
Branch: claude/board-column-customization-jfqgmd
Título: Columnas customizables: crear, renombrar y eliminar
```

**Paso 2 — Revisar en staging**:
```bash
git checkout claude/board-column-customization-jfqgmd
npm install
npx wrangler login            # si no estás logueado
npm run deploy:staging        # deploya + aplica migraciones en D1 staging
# → https://tas-king-staging.<subdominio>.workers.dev
```
- **Qué probar**: abrir un tablero → botones ✏ y ✕ en cada columna → renombrar → crear columna nueva → eliminar columna vacía → verificar que el confeti sigue disparando al mover tarjeta a la columna "done" → verificar que el progreso de objetivos sigue funcionando.

**Paso 3 — Deploy a producción** (después de aprobación explícita):
```bash
npm run deploy                # incluye test:all + backup previo automático
npm run db:migrate:remote     # aplica 0010_goals.sql + 0011_columns.sql en D1 prod
```

### ⚠️ Nota de entorno (E2E en remoto)
El browser de Playwright instalado localmente puede diferir del disponible en el entorno remoto.
Si los E2E fallan con "Executable doesn't exist", usar:
```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```
Localmente con `npx playwright install` no hace falta esta variable.

---

## Handoff anterior (2026-06-30, Gestión de objetivos #8 — Opus 4.8)

### ✅ Objetivos (gestión por metas) — MVP completo
- **Decisión Opción A**: objetivos DENTRO de cada tablero (un tablero = un proyecto). No hay tablero de estrategia separado. Ver `docs/ADRs.md` → **ADR-013** (alternativas B/C/D + criterios de migración).
- **DB**: migración `0010_goals.sql` (tablas `goals` + `card_goals`, índices + CASCADE).
- **Backend**: `src/routes/goals.js` (CRUD + vincular/desvincular + progreso). Constante `DONE_COLUMN` en `src/constants.js`. `getBoard()` y `cardJSONById()` exponen `card.goals`.
- **Frontend** (`public/index.html`):
  - Acceso único **🎯 Objetivos** → **panel lateral** (drawer izquierda). Dentro, **⛶ Ampliar** → vista a pantalla completa con "📋 Volver al tablero".
  - **Filtro/lente**: seleccionar un objetivo en el panel resalta sus tarjetas (`card-goal-match`) y atenúa el resto (`card-dimmed`).
  - Sección "🎯 Objetivos" en el modal de tarjeta + badge 🎯 en el Kanban.
  - Render compartido: `renderGoalsList` / `buildGoalCard` / `refreshGoalsUI`.
- **Tests**: 11 unit (`test/goals.test.js`) + 2 E2E (`e2e/goals.spec.js`). **Total: 59 unit + 18 E2E ✅**

### 🌿 Rama / PR
- Rama: `claude/goal-management-features-71ddci`.
- **PR #9** abierto hacia `main`: https://github.com/pablotortorella/tas-king/pull/9 (dispara CI Tests). **Sin merge** — esperando revisión en staging.

### ⏭️ PARA RETOMAR: ver #8 en staging (cuando estés frente a la compu)
```bash
git fetch origin claude/goal-management-features-71ddci
git checkout claude/goal-management-features-71ddci
npm install
npx wrangler login            # una vez, si no estás logueado en Cloudflare
npm run deploy:staging        # corre tests, deploya y migra la D1 de staging
# → https://tas-king-staging.<tu-subdominio>.workers.dev
```
- **Pre-requisito** (si nunca deployaste staging): cargar los secrets en ese entorno:
  ```bash
  npx wrangler secret put SESSION_SECRET --env staging
  npx wrangler secret put GOOGLE_CLIENT_ID --env staging
  npx wrangler secret put GOOGLE_CLIENT_SECRET --env staging
  npx wrangler secret put ADMIN_EMAILS --env staging
  ```
- Staging usa D1 `tas-king-staging` + R2 `tas-king-uploads-staging` (datos separados de prod).
- **Qué probar**: 🎯 Objetivos → crear un objetivo, vincular una tarjeta, moverla a "Terminado" (ver progreso 100%), ⛶ Ampliar, y la lente (seleccionar objetivo resalta/atenúa tarjetas).
- Si staging OK → mergear PR #9 y luego `npm run deploy` (con aprobación explícita, según CLAUDE.md).

### ⚠️ Nota de entorno (solo CI / ejecución remota)
- En el entorno remoto el browser de Playwright fijado (1228) no está instalado; los E2E se corren con `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`. **Localmente NO hace falta** (usás `npx playwright install`). `playwright.config.mjs` respeta esa variable opcional sin afectar CI.

### Extensiones futuras de la temática (detalle en ADR-013)
1. Fecha objetivo + semáforo 🟢🟡🔴. 2. Key results numéricos (mini-OKR). 3. Burn-up con `audit_log`. 4. Métricas #7 por objetivo. 5. Reordenar/archivar objetivos. 6. Opción B (cross-board) si la estrategia cruza tableros.

---

## Anterior handoff (2026-06-26, Infraestructura ops + Disaster Recovery — Claude Sonnet 4.6)

### ✅ Scripts de operación idempotentes (commit c1b6a30)
- `.dev.vars.example`: plantilla commiteada para onboarding
- `scripts/setup-local.sh`, `check-env.sh`, `db-reset-local.sh`, `seed-local.sh`, `e2e-reset.sh`, `operator.sh`
- `npm run check:env` incorporado al checklist de inicio en CLAUDE.md y QUICK_START.md
- `npm run operator`: menú interactivo con briefing de riesgos/ganancias antes de cada acción
- `dev:e2e` separado en `e2e:setup` + `e2e:server`

### ✅ Disaster Recovery (commit 50c7cce)
- `src/backup.js`: genera dump SQL de D1, sube a R2, pushea a GitHub vía PAT
- `src/index.js`: handler `scheduled` para Cron Trigger cada 8h; `export { app }` para tests
- `wrangler.jsonc`: cron `"0 */8 * * *"` en env production
- `scripts/db-backup-prod.sh`: backup manual local con `wrangler d1 export --remote`
- `scripts/db-restore.sh`: restaura .sql en local/staging/prod con confirmaciones escalonadas
- `npm run deploy` ahora incluye backup previo automático
- `docs/DISASTER_RECOVERY.md`: runbook (4 escenarios, setup, RPO 8h / RTO 30min)

### ⚠️ Pendiente para activar backup off-platform
```bash
# 1. Crear repo privado tas-king-backups en GitHub
# 2. Crear PAT fine-grained con contents:write solo sobre ese repo
npx wrangler secret put GITHUB_BACKUP_TOKEN --env production
npx wrangler secret put GITHUB_BACKUP_REPO --env production
# Valor: pablotortorella/tas-king-backups
```
Sin estos secrets, el backup a R2 funciona igual. El push a GitHub queda deshabilitado silenciosamente.

### Estado tests
- 48 unitarios (Vitest) ✅
- 16 E2E (Playwright) ✅

---

## Anterior handoff (2026-06-25, Tests E2E completos + fix reorder bug — Claude Sonnet 4.6)

### ✅ Infraestructura de tests E2E con seed data
- `test/fixtures/seed.sql`: limpia toda la DB y re-inserta estado conocido (usuario admin E2E, tablero, etiqueta, tarjeta base)
- `test/global-setup.mjs`: corre seed antes de cada suite vía `wrangler d1 execute`
- `playwright.config.mjs`: registra globalSetup

### ✅ 3 nuevas suites E2E
- `e2e/checklists.spec.js`: 4 tests (crear, renombrar, borrador, badge verde)
- `e2e/attachments.spec.js`: 2 tests (badge 📎, persistencia al reabrir)
- `e2e/history.spec.js`: 4 tests (creación, modal, drag & drop, edición)

### ✅ Fix: reorder con muchos cards (bug D1 en producción y local)
- Endpoint `POST /api/boards/:boardId/reorder` usaba `IN (?, ?, ...)` con spread de todos los IDs
- Con tableros grandes → "too many SQL variables" en D1 local (offset 245)
- Fix: `WHERE board_id = ?` (sin IN) + batch UPDATE chunked a 40 cards por batch

### ✅ Fix: simulación drag & drop en Playwright
- `page.dragTo()` / `page.dragAndDrop()` no disparan bien los HTML5 drag events del frontend
- Solución: `page.evaluate()` que agrega `.dragging`, mueve nodo DOM y dispara `drop`
- `waitForResponse(/reorder)` garantiza que `card_moved` esté logeado antes de abrir el historial

### ✅ Fix selectors de adjuntos en tests
- Clase real: `.attachment` (no `.draft-attachment`)
- Badge correcto: `📎` (no `≡` que es para card.details)

### Deploy
- Todo en main ✅ — commit `9cbfc2f`
- **Pendiente de deploy a staging/producción** (sin cambios de usuario visible, tests internos)

### Estado tests
- 48 unitarios (Vitest) ✅
- 16 E2E (Playwright) ✅

---

## Anterior handoff (2026-06-24, Refactor modular + optimización doc — Claude Haiku 4.5)

**ESTA SESIÓN — Refactoring completo + optimización de documentación (MERGED A MAIN)**

### ✅ Refactor: Estructura modular limpia
- **Problema**: `src/index.js` tenía 1267 líneas, monolítico, difícil de navegar
- **Solución**: extraído en estructura temática (~100-150 líneas c/u)
  - `src/constants.js`: constantes globales
  - `src/middleware/`: cors, logging, rateLimit, auth
  - `src/routes/`: auth, users, boards, cards, uploads, admin
  - `src/db/`: queries, helpers
- **Resultado**: `src/index.js` ahora ~80 líneas (solo setup)
- **Tests**: ✅ 38 unitarios + 5 E2E — todos pasan
- **Estándar**: Documentado en CLAUDE.md
- **Commits**: `6bb784f`, `2d1999b`, `34b2c2b`

### ✅ Optimización: Documentación sin duplicación
- **Problema**: 5 archivos a leer = ~5000 tokens innecesarios
- **Solución**:
  - **QUICK_START.md** (NEW): único archivo de lectura al inicio
  - **memory/SESSION.md** (NEW): contexto persistente entre sesiones
  - **CLAUDE.md** (REFACTOR): simplificado, sin duplicación
- **Resultado**: 90% menos contexto inicial (~500 vs 5000 tokens)
- **Beneficio**: Más espacio para trabajo real

### ✅ Merge a main
- Todos los cambios en main (commit `34b2c2b`)
- Tests pasan en main: ✅ 38 unitarios + 5 E2E
- GitHub actualizado
- **Estado**: 🚀 Listo para Feature #2 Etiquetas

---

## Anterior handoff (2026-06-24, Sesión de seguridad + historial — Claude Haiku 4.5)

**ESTA SESIÓN — Dos features de seguridad + mejora de historial**

### ✅ #4 Protección de adjuntos (Opción A) — 2-layer validation
- **GET `/uploads/:key`** requiere autenticación (401) + membresía del tablero (403)
- **POST `/api/cards/:id/attachments`** valida MIME types, tamaño (20 MB), cantidad (10)
- Tests: 3 casos de seguridad
- v1.5 deployado

### ✅ #5 Validar JWT de Google — Hardening de OAuth
- **verifyGoogleJWT()**: valida firma RSA con `crypto.subtle.verify()`
- **getGooglePublicKeys()**: cachea keys de Google por 24h
- **Claims validados**: exp, iss, aud, email_verified
- Token inválido → 403 con error específico
- Tests: 6 casos de validación (firma, exp, iss, aud, email_verified, caching)
- **ADR-011** registrado: decisión de arquitectura con problema/solución/alternativas
- v1.6 deployado (`e7e42ae8`)

### ✅ #1 Historial — Mostrar creación como primer evento
- GET `/api/cards/:id/history` sintetiza evento de creación si no hay historial
- Frontend muestra: "Creó la tarjeta en [columna]" con fecha original
- Compatibilidad: tarjetas antiguas usan `card.created_at` como timestamp
- Reemplaza "Sin historial aún." — siempre hay al menos un evento
- v1.7 deployado (`3b81ba74`)

**Actualizado**:
- docs/STATUS.md: #1 y #4 y #5 marcados 100% completo
- docs/backlog.txt: #8 "Mejoras adjuntos" expandido (BAJA prioridad, detalles técnicos)
- docs/ADRs.md: ADR-011 nuevo sobre JWT validation

**Anteriormente en sesiones previas**:
- ✅ v1.4: Historial de actividad (#1) — tabla audit_log, eventos registrados, panel en modal + admin
- ✅ v1.3: Panel admin + Polling real-time + Celebración (confeti + animación)
- ✅ v1.2: Atajos, footer, responsive header
- ✅ v1.1: Perfiles, avatares, comentarios con autor

---

## Último handoff anterior (2026-06-23 — antes de fundaciones)

**Sesión: Historial de actividad (#1 del backlog)**

Implementado el historial completo, de punta a punta:

- **Migración** `migrations/0005_audit_log.sql`: tabla `audit_log` con índices por `board_id` y `card_id`. Aplicada en local y en producción.
- **Backend** `src/index.js`:
  - Helper `logEvent(db, boardId, cardId, action, email, details)` reutilizable
  - 8 eventos registrados: `card_created`, `card_edited`, `card_moved`, `card_deleted`, `card_archived`, `card_restored`, `comment_added`, `attachment_added`
  - `card_edited` guarda diff exacto por campo (title, column, details, due, assignee)
  - `card_moved` se emite cuando solo cambia la columna (drag & drop o UI)
  - GET `/api/cards/:id/history` — historial de tarjeta (últimos 100 eventos)
  - GET `/api/boards/:boardId/activity` — actividad del tablero (hasta 500, con `?user=`, `?from=`, `?to=`)
- **Frontend** `public/index.html`:
  - Sección "📜 Historial" en modal de tarjeta: avatar + nombre + acción en español + tiempo relativo
  - Se oculta para tarjetas nuevas, carga al abrir existentes
  - `actionLabel(action, details)` convierte cada evento a texto descriptivo en español
  - `relativeTime(ts)` formatea: "ahora / hace N min / hace Nh / fecha"
  - Nueva pestaña "Actividad del tablero" en panel Admin (junto a "Usuarios")
  - Filtros: por miembro del tablero + rango de fechas + botón Limpiar
- **Tests**: 22/22 pasando (17 unitarios + 5 E2E). Tests E2E del historial pendientes (no automatizados aún).
- **Deploy**: migración y código deployados en producción (`c240a917`).

**Próximo**: #2 Etiquetas + filtro (tablas `labels` y `card_labels`, UI en modal, filtro en header, página AYUDA F1).

## Handoffs anteriores
**Sesión 2026-06-23 (Claude Sonnet 4.6)**:
- Se subió la carpeta `docs/` al repo (contexto compartido entre IAs y humanos)
- Se habilitaron dos nuevos usuarios en producción: `florenciatortorella@gmail.com` y
  `leonardo.agudelo@kleer.la` (vía Secret `ALLOWED_EMAILS`)
- Se implementó el **panel de administración** completo:
  - Migración `0004_admin.sql`: tabla `allowed_emails` + columna `is_admin` en `users`
  - Backend: endpoints `/api/admin/users`, `/api/admin/allowed` (GET/POST/DELETE),
    `/api/admin/set-admin`; middleware `requireAdmin`; helpers `isEmailAllowed` y
    `seedAdminIfNeeded`
  - Frontend: botón "⚙ Admin" en header (solo para admins), modal con lista de usuarios,
    agregar/eliminar, checkbox de promoción a admin
  - Deploy a producción + seed de los 5 emails existentes en `allowed_emails`
  - Secret `ADMIN_EMAILS=pablotortorella@gmail.com` cargado en producción
- Se actualizó el README con instrucciones completas de setup (OAuth, secrets, primer admin)
- Se creó este archivo `AI_HANDOFF.md`
