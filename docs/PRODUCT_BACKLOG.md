# 📋 PRODUCT BACKLOG — FUN TasKing!

**Última actualización**: 2026-07-08
**Reemplaza a**: `PROJECT_BACKLOG.md` (raíz) y `docs/backlog.txt` — unificados y borrados el 2026-07-04.

Este es el documento madre de prioridades del producto: qué falta, por qué importa, y con qué nivel de detalle ya está pensado. Para el historial de qué se implementó y cómo, ver [`docs/STATUS.md`](STATUS.md).

---

## 🔄 Cómo mantener este documento actualizado

- **Fuente única**: toda idea nueva, pedido de Pablo, o feature pendiente se agrega acá — no se crean archivos de backlog paralelos.
- **Al completar algo**: mover el ítem a "✅ Completado", con la fecha. El detalle técnico de la implementación va en `docs/STATUS.md`, no acá — acá solo queda la referencia.
- **Al surgir una idea nueva**: agregarla en la sección de prioridad que corresponda (🔴 Prioritario, 🟠 Alta, 🟡 Media, 🟢 Baja/futuro), con esfuerzo estimado si se conoce (🟢 chico · 🟡 medio · 🔴 grande).
- **Al re-priorizar**: mover el ítem entre secciones — no hace falta pedir permiso para reordenar, solo para decidir qué se hace *ahora*.
- **División de responsabilidades**:
  - `docs/PRODUCT_BACKLOG.md` (este archivo) → **qué falta y por qué** (prioridades, visión, ideas).
  - `docs/STATUS.md` → **qué existe y cómo** (implementación, tests, fecha de cada sesión).
  - `docs/ADRs.md` → **por qué se decidió así** (decisiones de arquitectura).

---

## ✅ Completado

| # | Feature | Notas |
|---|---|---|
| #0 | 🔗 Deep-link a tarjeta | |
| #1 | 📜 Historial de actividad | Por tarjeta + panel de actividad del tablero, filtros por usuario/fecha |
| #2 | 🏷️ Etiquetas + filtro | Atajos numéricos 0-9, hasta 10 por tablero |
| #3 | ✅ Checklists / subtareas | |
| #4 | 🔐 Proteger adjuntos | |
| #5 | 🛡️ Validar JWT de Google | Hardening del login |
| #6 | 🌙 Modo oscuro/claro | |
| #7 | 📊 Lead time (a nivel tablero) | Parte de #8 — falta la versión personal, ver Media prioridad |
| #8 | 📊 Workflow Analytics Engine / ¿Cómo vamos? | MVP completo: completadas por período, burn-up, WIP, ¡Pilas con esto! (Quietas + Por vencer + Pulso WIP) |
| — | Columnas personalizables (crear/editar/eliminar/reordenar) | |
| — | Columnas de cierre múltiples (`isDone` toggle) | Desacoplado de la posición |
| — | CSP + Security Headers | |
| — | Polling en tiempo real (5s) | Reemplaza la necesidad de WebSockets/Durable Objects para el caso de uso actual |
| — | 👤 Perfil de usuario (nombre + avatar emoji + color) | |
| — | 💬 Autoría en comentarios | Autor + avatar + fecha |
| — | ✏️ Renombrar tablero desde la UI | |
| — | 🗑️ Borrar tablero | Solo dueño, tablero no personal |
| — | 💾 Backup automático (Cron + R2) | ⚠️ Corregido 2026-07-07: NO estaba operativo en prod — cron sin aplicar al worker + bug `_cf_METADATA` rompía el dump. Ver hallazgos 🔴 abajo. Falta además el push a GitHub (secrets pendientes, ver Media prioridad) |
| — | Import/Export JSON + CSV completo | Incluye etiquetas, checklists, responsable |
| — | 🎯 Objetivos (gestión por metas) | |
| — | 🎯 Pulso WIP "Dejar de empezar y empezar a terminar" | 2026-07-04 — ver detalle en `docs/STATUS.md` |
| #10 | 🎨 Temas de color (paleta oficial + selector por tablero) | 2026-07-11 — Candy Pop es el default de toda la app (Kanban + páginas públicas); Sunset Pop/Citrus Fresh/Jungle Pop seleccionables por tablero desde ⚙️ → Tema; prompt de bienvenida para el dueño en tableros sin paleta. Ver detalle en `docs/STATUS.md` |

---

## 🔴 Prioritario — en foco

### #9 ¡Pilas con esto! como puerta de entrada inteligente

**Prioridad**: Alta — toca el corazón del producto.

**Visión**: hoy "¡Pilas con esto!" muestra las tareas más urgentes (por vencer) y más quietas. El siguiente paso es convertirla en la **recomendación activa** que abre la app: cuando el usuario llega, el sistema ya sabe qué debería hacer primero. La lógica de fondo siempre es la misma: **terminar algo que está empezado antes de empezar algo nuevo**.

Ideas de evolución, en orden de qué falta:

1. ✅ **Pulso periódico en tarjetas WIP** — completado 2026-07-04. Ver `docs/STATUS.md`.
2. **Panel de entrada** — al abrir FUN TasKing!, en vez de arrancar directo en el tablero, mostrar brevemente "¿Por dónde empezamos hoy?" con la lista ¡Pilas con esto! como punto de partida, y un botón "Ver tablero" para continuar.
3. **Configuración de N** — permitir al dueño del tablero configurar cuántas tareas muestra cada lista (default 5, máximo 10).
4. **Notificación silenciosa** — si una tarea lleva más de X días sin moverse, mostrar un badge o ícono especial en la tarjeta directamente en el tablero (sin tener que abrir el panel).

**Por qué es clave**: FUN TasKing! se posiciona como una herramienta que no solo organiza tareas sino que empuja a terminarlas. "¡Pilas con esto!" es la manifestación más directa de esa filosofía: no acumular, no olvidar, cerrar el loop.

> ⚠️ **Compiten en prioridad con #9**: los 3 hallazgos 🔴 del análisis técnico 2026-07-07 (backup no operativo, revocación de acceso, purga de `rate_limit_log`) — ver sección 🩺 más abajo. Los tres son de esfuerzo chico.

---

## 🟠 Alta prioridad

- **Tab/Enter estándar en toda la interfaz de tarjetas**: navegación por teclado en el modal — Tab entre campos, Enter confirma, Esc cierra. Incluye checklists (Tab entre ítems, Enter agrega el siguiente, Backspace en ítem vacío lo borra). Criterios ya documentados en ADR-014; falta auditar que se cumplan en todos los campos.
- **Onboarding para usuarios nuevos**: primer login → tablero vacío sin guía. Opciones: estado vacío con instrucciones ("Creá tu primera tarjeta con N"), tarjetas de ejemplo precargadas, o mini-tour de tooltips.

## 🟡 Media prioridad

- **Backup a GitHub**: falta crear repo `tas-king-backups` + PAT + `wrangler secret put` (`GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPO`). R2 ya funciona cada 8h — esto es la capa off-platform adicional.
- **Lead time y tasa de completitud personal** (#7 extendido): panel "📊 Tu desempeño" en el tablero personal — tiempo promedio para completar + % de tarjetas completadas, por usuario. Backend: `GET /api/me/metrics` o agregar a `/api/me`.
- **Rate limiting más granular**: hoy hay límite global por IP. Mejorar a límite por usuario autenticado + distinguir lectura vs escritura. Menos urgente que otras piezas de seguridad ya resueltas (CSP, adjuntos protegidos, JWT).
- **Mejores adjuntos** — 🟡 esfuerzo medio (3-4h), impacto bajo-medio:
  - *Drag & drop de archivos en el modal*: listener `dragover`/`drop` en `.attachments`, agrega a `draftAttachments`, feedback visual con clase `.dragover`.
  - *Pegar imágenes desde el portapapeles*: listener global `paste` dentro del modal, leer `e.clipboardData.items`, crear blobs y agregarlos a `draftAttachments`. Permitir pegar varias imágenes.
  - *Reordenar adjuntos (drag to reorder)*: requiere columna `position` en tabla `attachments`, drag handlers por adjunto, endpoint `PUT /api/attachments/reorder`.
- **Panel lateral de actividad del tablero**: el historial existe por tarjeta y en Admin — falta un feed lateral tipo "¿qué pasó hoy en el tablero?" sin ir al panel de administración (similar a Notion/Linear).
- **Notificaciones** (asignación de tarjeta, vencimiento próximo): badge en el tab del navegador, email, o Web Push. 🟡/🔴 esfuerzo.

## 🟢 Baja prioridad / ideas a futuro

- **Búsqueda avanzada full-text**: hoy busca solo por título. Extender a descripción, comentarios, etiquetas, responsable.
- **Vista calendario / ordenar por fecha**: alternativa al Kanban para ver tarjetas por fecha límite.
- **Vista lista**: tabla sortable con todas las tarjetas — útil cuando hay muchas en una columna.
- **Bulk actions**: seleccionar varias tarjetas → archivar/mover/etiquetar en lote.
- **Mover tarjetas entre tableros**: útil pero de mayor esfuerzo relativo.
- **Papelera (soft-delete)**: recuperar tarjetas borradas (distinto del archivo actual, que ya permite restaurar tarjetas archivadas — evaluar si esto ya cubre la necesidad antes de construir algo nuevo).
- **Rol "solo lectura"** en tableros compartidos.
- **PWA instalable** + mejoras de mobile.

---

## 🩺 Hallazgos del análisis técnico (2026-07-07)

Resultado del análisis funcional y técnico completo (código, seguridad, operación, docs). La criticidad pondera **riesgo × impacto**, no esfuerzo — casi todos los fixes son chicos (esfuerzo: 🟢 chico · 🟡 medio · 🔴 grande). Al resolver un ítem: moverlo a ✅ Completado con fecha; el detalle técnico va en `docs/STATUS.md`.

### 🔴 Crítico

- **Backup automático no operativo en producción** — 🟢 chico. Dos causas que se suman: (1) `npm run deploy` corre `wrangler deploy` sin `--env production`, y los `triggers.crons` están definidos solo dentro de ese env en `wrangler.jsonc` → el worker productivo no tiene el cron aplicado (verificado con `--dry-run`); (2) `generateSQLDump()` rompía con `SQLITE_AUTH` al leer la tabla interna protegida `_cf_METADATA` (el filtro excluía solo `_cf_KV` exacto) — fix ya incluido en PR #19. **Riesgo**: sin backups automáticos, ante corrupción o borrado accidental el único respaldo son los dumps manuales pre-deploy. **Acción**: mover `triggers` al nivel raíz de `wrangler.jsonc` (deployar con `--env production` cambiaría el nombre del worker), mergear PR #19 y verificar en los logs el primer ciclo del cron.
- **Revocación de acceso no efectiva** — 🟢 chico. El middleware de auth (`src/middleware/auth.js`) valida la cookie firmada (30 días) pero no re-chequea `allowed_emails`; `ensureUser` incluso recrea el usuario borrado. **Riesgo**: sacar a alguien desde el panel admin no le corta el acceso hasta que expire su sesión — hasta 30 días. Grave si la remoción es por un incidente. **Acción**: re-chequear `isEmailAllowed()` en el middleware (1 query extra por request; cacheable unos minutos si preocupa el costo).
- **Purga de `rate_limit_log`** — ✅ en curso: PR #19 (2026-07-07). La tabla recibía un INSERT por cada request API y nada la purgaba (el índice `rate_limit_cleanup` existía para eso): DB y dump de backup crecían sin límite. Falta: revisar, mergear y deployar con aprobación.

### 🟠 Alto — bugs funcionales visibles

- **El polling no sincroniza comentarios, checklists ni borrados** — 🟡 medio. `/api/boards/:id/version` devuelve `MAX(updated_at)` de las tarjetas: agregar/borrar comentarios y toda operación de checklist no tocan `updated_at`, y el frontend solo refresca si la versión *sube* (borrar una tarjeta la baja o la deja igual). **Impacto**: en tableros compartidos, los demás no ven comentarios/checklists nuevos ni tarjetas borradas hasta que otra cosa cambie — rompe la promesa multiusuario "en tiempo real". Etiquetas y objetivos sí lo hacen bien (bumpean `updated_at`). **Acción**: bumpear `updated_at` en esas operaciones + refrescar por *desigualdad* de versión.
- **Progreso de objetivos ignora columnas de cierre múltiples** — 🟢 chico. `goalsWithProgress` usa `getDoneColumnId` (una sola columna, `LIMIT 1`), mientras confeti/métricas/urgencia usan todas las `is_done=1` (`getDoneColumnIds`). **Impacto**: con 2+ columnas de cierre, el % de avance queda subestimado — el usuario ve datos incorrectos.
- **Nadie valida que la columna exista** al crear/editar/importar tarjetas — 🟢 chico. El import usa default `por_conversar`, que puede no existir en tableros con columnas custom. **Impacto**: tarjetas huérfanas en columnas inexistentes, invisibles en la UI y sin error — se percibe como pérdida de datos.
- **Docs de arranque desactualizadas** — 🟢 chico. `QUICK_START.md` (lectura obligatoria por sesión) congelado al 2026-06-30: menciona PRs "pendientes de merge" ya mergeados y deployados, y "69 unit + 22 E2E" (son 111+36). `STATUS.md`: la sección "Features NO Implementados" está llena de features implementadas, y dice "máx 20 etiquetas / paleta de 20 colores" cuando el código impone 10 y 10. **Impacto**: cada sesión (humana o IA) arranca con un mapa falso del proyecto.

### 🟡 Medio — endurecimiento y robustez

- **CSP con `'unsafe-inline'`** — 🟡 medio. La directiva anula gran parte de la protección XSS del CSP. La salida real: separar el JS de `index.html` (4.100 líneas) a un `app.js` estático — sin build step, se mantiene la filosofía — + hash/nonce para el mini-script anti-flash del tema. Bonus: mantenibilidad del frontend.
- **Sin límites de longitud en inputs** — 🟢 chico. Título, detalles, comentarios e ítems de checklist no tienen máximo server-side (columnas y perfil sí). **Riesgo**: payloads de MB guardados en D1 por cualquier miembro.
- **Rate limit de descargas de adjuntos demasiado bajo** — 🟢 chico. `GET /uploads/:key` usa 50 req/5 min **por IP**: una oficina con NAT compartido y un tablero con muchas imágenes rompe la carga de previews. Nota: el límite se llama `uploadAttachment` pero aplica a las descargas; el POST de subida usa el límite genérico de API.
- **MIME de uploads confía en el `Content-Type` del cliente** — 🟡 medio. La whitelist mitiga (y SVG está excluido, bien); validar magic bytes sería el paso siguiente.
- **Backups en el mismo bucket R2 que los uploads** (prefijo `backups/`) — 🟢 chico. Hoy no son alcanzables vía `/uploads/:key` (requiere match en `attachments`), pero un bucket dedicado elimina la clase de riesgo de exponer el dump completo de la DB.
- **Cualquier miembro puede borrar comentarios y adjuntos ajenos** — 🟢 chico. No hay check de autoría. Puede ser decisión válida para equipos chicos — decidirlo a propósito y registrarlo en `docs/ADRs.md` (o restringir a autor + owner).
- **Overhead D1 por request** — 🟡 medio. Cada request API paga ~4-5 queries antes del handler (COUNT + INSERT del rate limit, SELECT+INSERT de `ensureUser`, `seedAdminIfNeeded`), multiplicado por el polling de 5s de cada usuario = el grueso del consumo D1. `ensureUser` podría correr solo en login/`/api/me`. (Relacionado con "Rate limiting más granular", ya listado en Media.)
- **Export CSV sin protección contra formula injection** de Excel — 🟢 chico. Celdas que empiezan con `=`, `+`, `-`, `@` se ejecutan como fórmula al abrir el CSV.

### 🟢 Bajo — limpieza

- `deniedPage()` (`src/routes/auth.js`) interpola el email en HTML sin escapar — riesgo real bajísimo (viene verificado por Google), pero escapar cuesta una línea.
- `Logger("debug")` nunca funciona: `this.levels[level] || 1` — `debug` vale 0 (falsy) y cae a `info`.
- `DONE_COLUMN` en `src/constants.js` es código muerto desde que las columnas son dinámicas.
- `checklists.js` monkey-patchea `c.req.param` para reusar `cardWithAccess` — frágil; refactor honesto: `cardWithAccessById(db, cardId, email)`.
- Timestamps mixtos: epoch ms en casi todo, `datetime('now')` (string) en `allowed_emails`.
- `ALLOWED_ORIGINS` no incluye la URL de staging (irrelevante mientras todo sea same-origin; anotado por si algún día hay frontend separado).
- ~10 ramas locales ya mergeadas sin borrar (`feature/deep-link`, `feature/proteger-adjuntos`, …).

---

## 🗄️ Contexto histórico (decisiones ya resueltas, para no repreguntar)

- **Tiempo real vía WebSockets/Durable Objects**: evaluado y descartado por ahora — el polling cada 5s ya cubre el caso de uso de "ver cambios de otros sin recargar" con mucho menos esfuerzo/costo.
- **Epic "Workflow Analytics Engine" (ADR-013)**: era el foco de una sesión anterior a fines de completar KPIs de flujo de trabajo. Se completó como el punto #8 (¿Cómo vamos?) — la épica como tal ya no está "en curso", quedó absorbida en el backlog normal de #9 en adelante.
- **e) Múltiples tableros**: los miembros se agregan desde ⚙️ — no es un gap, ya existe.
- **c/d) Mobile IO y modal con checklists largos**: funcionan bien según feedback de Pablo, no requieren rediseño por ahora.
