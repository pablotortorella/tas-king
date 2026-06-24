# AI_HANDOFF

## Estado actual
**FUN TasKing!** es un tablero Kanban minimalista multiusuario, desplegado en producción en
https://tas-king.pablotortorella.workers.dev. El proyecto está activo y en iteración continua.

**Última actualización (esta sesión)**: Dashboard admin mejorado + backlog actualizado.
- **Feature completada**: Etiquetas + filtro (#2) — 10 colores Material Design, máx 10 por tablero, botón ✕ para borrar
- **Nuevas estadísticas admin**: uso/actividad con gráfico visual, archivos (cantidad + tamaño MB), Top 10 usuarios activos
- **Backlog**: Agregado #7 Lead time y tasa de completitud (por usuario, en criollo)
- **Tests**: 38 unitarios + 6 E2E ✅ Todos pasan

## 🎯 Objetivo inmediato

**✅ COMPLETADO ESTA SESIÓN**: Feature #2 Etiquetas + filtro (organización)
- Migración 0007_labels.sql
- Backend routes/labels.js con validación de paleta de 20 colores
- Frontend: renderCard con pastillas, gestión inline, filtro OR (atajos 0-9), F1 ayuda
- Tests: unitarios + E2E ✅ Todos pasan

**⏭️ PRÓXIMO**: Feature #3 Checklists / subtareas (MEDIA priority, organización)
Tabla `checklist_items`, UI para agregar/editar/tachar items, progreso visual.

Alternativas:
- #6 Modo oscuro/claro (BAJA priority, UX)
- #8 Mejoras adjuntos (BAJA priority, UX — drag & drop, paste, reorder)

Ver `docs/STATUS.md` para saber qué está hecho.
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
- `src/index.js`: Worker completo — API REST (Hono), OAuth Google, middlewares de auth y admin
- `public/index.html`: frontend completo — UI Kanban, modales, drag & drop, atajos de teclado
- `migrations/`: esquema D1 incremental (0001 init → 0004 admin)
- `wrangler.jsonc`: configuración de Workers, D1 y R2
- `.dev.vars`: variables locales (no commiteado — ver README para el formato)
- `docs/STATUS.md`: **[IMPORTANTE]** estado de cada feature (qué está hecho, qué falta, tests)
- `docs/backlog.txt`: backlog priorizado
- `docs/ideas.txt`: ideas extendidas y contexto de decisiones de producto

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
npm install                        # instalar dependencias
npm run dev                        # servidor local → http://localhost:8787
npm run db:migrate:local           # aplicar migraciones en D1 local
npm run db:migrate:remote          # aplicar migraciones en D1 producción
npm run deploy                     # build + deploy a Cloudflare Workers
npx wrangler secret put <NOMBRE>   # cargar un secret en producción
npx wrangler d1 execute tas-king --remote --command "SELECT ..."  # consulta SQL en prod
```

Hay tests unitarios y de API con Vitest ejecutándose en Workerd con D1/R2 emulados, más tests
E2E con Playwright. `npm run test:all` ejecuta la suite completa. La estrategia y el checklist
manual complementario para IAs y personas están en `TESTING.md`.

## Estado de features del backlog

Para saber si un feature existe, está completo, o qué le falta:

| Item | Estado | Notas |
|---|---|---|
| #0 🔗 Deep-link | Implementado, tests E2E ✅ | Acciones: `checkDeepLink()` en el frontend, GET `/api/cards/:id` en backend. Los 4 casos de test están cubiertos (válida, inexistente, archivada, sin acceso manual). |
| ⚡ Polling tiempo real | Implementado, tests manual ✅ | Endpoint `/api/boards/:id/version` + cliente cada 5s. No tiene tests E2E, pero se verifica manualmente. |
| 🎉 Celebración | Implementado, tests manual ✅ | Confeti + animación de tarjeta. Funciona para arrastres locales y vía polling. Sin test E2E (difícil de verificar en Playwright). |
| #1 📜 Historial | Implementado, tests manuales ✅ | `audit_log` en D1, `logEvent()` en 8 eventos, panel en modal de tarjeta, pestaña Actividad en Admin con filtros. |
| #2 🏷️ Etiquetas | No existe | Requiere: tabla `labels`, `card_labels` join, UI de creación/edición, filtro, página de AYUDA. |
| #3 ✅ Checklists | No existe | Requiere: tabla `checklist_items`, UI en modal de tarjeta. |
| #4 🔐 Adjuntos | **Implementado ✅** | Validación de sesión/membresía en GET `/uploads`, límites de tamaño (20 MB), cantidad (10), MIME type (whitelist). |
| #5 🛡️ JWT Google | **Implementado ✅** | Validación de firma RSA + claims (exp, iss, aud, email_verified). Detecta tampering y tokens modificados. |
| #8 🖼️ Adjuntos mejorados | No existe (BAJA priority) | Drag & drop, paste images, reorder adjuntos. |
| #6 🌙 Modo oscuro | No existe | CSS variables ya están listos. Requiere: toggle en header, localStorage, media query fallback. |

## Pendientes
Ver `docs/backlog.txt` para la lista priorizada. En orden:
- [x] #0 🔗 Deep-link a una tarjeta (abrir app en tarjeta puntual vía URL)
- [x] ⚡ Polling de cambios en tiempo real (cada 5s, pausa en segundo plano)
- [x] 🎉 Celebración al terminar (confeti + tarjeta titilante)
- [x] #1 📜 Historial de actividad (dentro de la tarjeta + panel lateral por tablero)
- [ ] #2 🏷️ Etiquetas de colores + filtro + página de AYUDA (F1) con todos los atajos
- [ ] #3 ✅ Checklists / subtareas dentro de una tarjeta
- [x] #4 🔐 Proteger adjuntos (validación de sesión/membresía, límites de tamaño/cantidad/MIME)
- [x] #5 🛡️ Validar JWT de Google con rigor (hardening del login — firma RSA + claims)
- [ ] #6 🌙 Modo oscuro/claro
- [ ] #8 🖼️ Mejores adjuntos (drag & drop, paste images, reorder) — BAJA PRIORIDAD
- [ ] #9 💾 Respaldo automático programado del tablero

## No hacer
- No usar Cloudflare Access (no funciona en `*.workers.dev` sin dominio propio)
- No introducir un framework JS ni paso de build en el frontend (decisión de producto)
- No reemplazar datos al importar (import siempre agrega)
- No hardcodear emails de usuarios/admins en el código fuente
- No commitear `.dev.vars` (está en `.gitignore` — contiene credenciales)
- No borrar el tablero personal de un usuario (`is_personal=1`)

## Último handoff (2026-06-24, Refactor modular + optimización doc — Claude Haiku 4.5)

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
