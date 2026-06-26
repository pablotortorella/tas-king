# AI_HANDOFF

## Estado actual
**FUN TasKing!** es un tablero Kanban minimalista multiusuario, desplegado en producción en
https://tas-king.pablotortorella.workers.dev. El proyecto está activo y en iteración continua.

**Versión actual**: v1.7 — **Tests**: 48 unitarios + 16 E2E ✅ Todos pasan

**Features completos**: Deep-link, Polling real-time, Celebración, Historial (#1), Etiquetas (#2),
Checklists (#3), Protección adjuntos (#4), JWT Google (#5), i18n landing, Panel admin, IO menu.

**Próximo**: #6 Modo oscuro, #7 Lead time/completitud, o mejoras de seguridad (CSP, rate limiting).

## 🎯 Objetivo siguiente sesión

Opciones priorizadas por Pablo (ver `memory/roadmap.md` para lista completa):

1. **#8 Workflow Analytics Engine** (alta): enriquecer `GET /api/cards/:id/history` con KPIs. Ver `docs/ADRs/ADR-013-workflow-analytics-engine.md` y `PROJECT_BACKLOG.md` para especificación completa.
   - Crear `calculateCardKPIs(cardId)` en `src/db/helpers.js`
   - Modificar endpoint en `src/routes/cards.js` para devolver DTO con `summaryMetrics` + `activityLog`
   - Tests unitarios con escenarios conocidos
2. **Seguridad** (alta): CSP headers, rate limiting granular
3. **UX** (alta): Tab/Enter en toda la interfaz de tarjetas, onboarding nuevos usuarios
4. **Features** (media): #6 Modo oscuro, #7 Lead time/tasa completitud, búsqueda avanzada

Ver `docs/STATUS.md` para estado detallado de cada feature.
Ver `docs/WORKFLOW.md` para cómo trabajar (branch → code → tests → PR → merge → deploy).

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
- `migrations/`: esquema D1 incremental (0001 init → 0009 checklists)
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
| ⇅ Menú IO | ✅ | Dropdown Datos: exportar CSV / copiar JSON / importar. |
| 🌐 i18n landing | ✅ | ES/EN/PT/ZH inline en landing.html. |
| #6 🌙 Modo oscuro | ❌ | CSS variables listas. Falta toggle + localStorage. |
| #7 📊 Lead time | ❌ | Métricas personales de productividad. |
| CSP headers | ❌ Seguridad | Content-Security-Policy pendiente. |

## Pendientes
- [x] #0 🔗 Deep-link a una tarjeta
- [x] ⚡ Polling de cambios en tiempo real
- [x] 🎉 Celebración al terminar
- [x] #1 📜 Historial de actividad
- [x] #2 🏷️ Etiquetas de colores + filtro
- [x] #3 ✅ Checklists / subtareas
- [x] #4 🔐 Proteger adjuntos
- [x] #5 🛡️ Validar JWT de Google
- [ ] Seguridad: CSP headers, rate limiting granular
- [ ] UX: Tab/Enter en toda la interfaz, onboarding nuevos usuarios
- [ ] #6 🌙 Modo oscuro/claro
- [ ] #7 📊 Lead time y tasa de completitud
- [ ] Búsqueda avanzada (full-text en título + detalles)

## No hacer
- No usar Cloudflare Access (no funciona en `*.workers.dev` sin dominio propio)
- No introducir un framework JS ni paso de build en el frontend (decisión de producto)
- No reemplazar datos al importar (import siempre agrega)
- No hardcodear emails de usuarios/admins en el código fuente
- No commitear `.dev.vars` (está en `.gitignore` — contiene credenciales)
- No borrar el tablero personal de un usuario (`is_personal=1`)

## Último handoff (2026-06-25, Tests E2E completos + fix reorder bug — Claude Sonnet 4.6)

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
