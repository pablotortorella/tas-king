# 📋 PRODUCT BACKLOG — FUN TasKing!

**Última actualización**: 2026-09-19
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

## 🏠 Horizonte de producto: HomeSuite

**Estado:** visión y MVP documentados; landing pública en producción desde el
2026-09-21 en `https://homesuite.info/`, con `www` redirigido al apex. La suite
autenticada, Cuentas Claras y Compras aún no están implementados. Esto no reemplaza
automáticamente el foco vigente de TasKing.

HomeSuite será la marca paraguas en `homesuite.info` para herramientas de vida
compartida. La dirección acordada es reutilizar Cloudflare, autenticación y
operación mediante un monorepo. El sitio público tendrá un Worker sin datos ni
sesión; la aplicación autenticada será un monolito modular con staging aislado,
manteniendo separados los dominios de Tareas, Cuentas Claras y Compras.

Orden estratégico inicial:

1. plataforma mínima: identidad estable, sesión, espacios e invitaciones;
2. **Cuentas Claras**, con el objetivo concreto de reemplazar Splitwise;
3. migración gradual de TasKing a `/tareas`, sin big bang;
4. **HomeSuite Compras**, reutilizando la plataforma colaborativa.

Los ingresos compartidos que afectan el saldo neto sí forman parte del MVP.
Presupuesto, análisis global de ingresos del hogar y flujo de caja son una evolución
prevista, no parte del primer producto financiero. Antes de implementar cada etapa
se seguirá el ciclo OpenSpec completo y se incorporarán sus tareas concretas a las
prioridades de este backlog.

Documentación fuente:

- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [Infraestructura, dominios y repositorio](HOMESUITE_INFRASTRUCTURE.md)
- [MVP de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_MVP.md)
- [Brief de exploración de Cuentas Claras y referencia de Tricount](HOMESUITE_CUENTAS_CLARAS_EXPLORACION.md)
- [User Journey de entrada y migración de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_JOURNEY.md)
- [User Story Map de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md)
- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)

### Próximo corte: validar la migración de Cuentas Claras (A)

Estas son User Stories candidatas. Están ordenadas por dependencia de producto,
no son tareas técnicas ni un change OpenSpec activo. Cada propuesta se dividirá
en un change pequeño al llegar a `propose`.

| Orden | Historia | Resultado observable |
|---|---|---|
| HG-01 | Como titular, quiero iniciar sesión y crear un espacio con mi libro de Cuentas Claras para tener una frontera privada y un punto de partida propio. | El titular ve únicamente su espacio y su libro nuevo. |
| HG-02 | Como titular, quiero invitar a una persona por email para que ambos veamos el mismo libro sin compartir una cuenta. | La invitación se acepta una vez; ambas personas acceden al mismo grupo y no a grupos ajenos. |
| HG-03 | Como titular, quiero previsualizar un CSV de exportación de Splitwise y mapear sus participantes para saber qué se importará antes de guardar. | Se distinguen participantes, movimientos y fila de resumen; se muestran conteos y saldos previstos por moneda. |
| HG-04 | Como titular, quiero decidir qué hacer ante cada incidente de importación para no perder control sobre mi historia. | Cada incidente muestra fila y motivo; puedo cancelar, aplicar un supuesto explícito o importar el subconjunto seguro. |
| HG-05 | Como titular, quiero confirmar una importación idempotente y ver su conciliación para confiar en los saldos migrados. | El lote registra origen, supuestos y filas no importadas; compara saldos; un reintento no duplica dinero. |
| HG-06 | Como integrante, quiero registrar un gasto compartido simple después de importar para continuar mi uso cotidiano. | Un pagador, dos participantes y división igual actualizan el saldo y la cronología de ambos. |
| HG-07 | Como integrante, quiero buscar libremente por texto, participante o monto para encontrar movimientos propios e importados en una sola lista. | La búsqueda normaliza texto, incluye total y efecto individual, explica la coincidencia y marca el origen importado. |

**Siguiente propuesta OpenSpec:** `plataforma-homesuite-minima`, que cubre HG-01
y HG-02. Después, `importacion-splitwise-inicial` cubre HG-03 a HG-05; no se
mezclarán autenticación, modelo financiero y parser de importación en un solo
change.

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
| — | 🧹 Purga de `rate_limit_log` + backup automático operativo | 2026-07-11 — código de PR #19 (2026-07-07) ya estaba mergeado y testeado; el gap real era que el cron nunca se registraba en el worker de producción (`triggers.crons` vivía solo en `env.production`, no en el nivel raíz que usa `npm run deploy`). Fix + verificado en el log del deploy (`schedule: 0 */8 * * *`) |
| — | 🔒 Revocación de acceso efectiva | 2026-09-07 — re-chequeo de `allowed_emails` en cada request autenticado por cookie real (no en el bypass de dev/tests) + página pública `/revoked` con mensaje diferencial. Ver `docs/ADRs/ADR-015-revocacion-acceso-sesion-cookie.md` y `docs/STATUS.md` |
| — | ⚡ Mutaciones de tarjetas y etiquetas sin recargas globales | 2026-09-11 — incluida en v2.2.0. Crear/editar y asignar/quitar etiquetas actualiza el estado desde la respuesta confirmada; evita el tramo de tres lecturas que sumaba ~1,4–1,5 s en la línea base. Comprobación del 14/09 documentada; Pablo confirmó el 15/09 que toda la interacción se siente más veloz. |
| — | ⚡ Menos llamadas de backend (v2.2.1) | Producción 2026-09-14; mejora percibida confirmada por Pablo el 15/09. Ronda de performance cerrada; nuevas optimizaciones solo ante demoras observadas. |
| — | 🔒 Cabeceras de seguridad en el documento | 2026-09-17 — el diagnóstico del backlog estaba equivocado: no era que el CSP tuviera `'unsafe-inline'`, era que **ninguna cabecera de seguridad llegaba al HTML**. El Asset Worker respondía antes que el Worker, así que la app no tenía CSP ni `X-Frame-Options` (era enmarcable). El único test que lo cubría invocaba `app.request()` y se salteaba el ruteo. Ver ADR-017 |
| — | 🧩 Frontend en módulos ES | 2026-09-17 — `index.html` pasó de 4.545 a 512 líneas de markup; el JS vive en 17 módulos bajo `public/js/` con tres capas y dirección de dependencia única. Habilitó `script-src 'self'` sin `'unsafe-inline'`. Ver ADR-017 |
| — | ⌨️ Esc cierra la ayuda (F1) | 2026-09-17 — el impacto era mayor que el reportado: con la ayuda abierta el guard `.overlay.open` mataba **todos** los atajos, y como Esc no cerraba, no había salida por teclado. Se sumó a la cadena de Escape (un solo lugar decide qué cierra Esc) y se borró el código muerto. 5 tests E2E nuevos |
| — | 🔄 Sincronización de comentarios, checklists y borrados | 2026-09-15 implementada (ADR-016, migración 0015); llegó a producción el 2026-09-18 junto con la v2.3.0 |
| — | 🚦 Migrar antes de desplegar el Worker | 2026-09-18 — los scripts desplegaban antes de migrar, contra lo que pedía la documentación desde el 15/09. Con la 0015 sin aplicar en producción eso abría una ventana de 500. `test/deploy-scripts.test.js` verifica el orden |

---

## 🛠️ Implementado, pendiente de publicar

_Sin ítems pendientes — todo lo implementado está en producción desde el deploy v2.3.0 del 2026-09-18._

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

> ✅ Los 3 hallazgos 🔴 del análisis técnico 2026-07-07 que competían en prioridad con #9 (backup no operativo, revocación de acceso, purga de `rate_limit_log`) ya están resueltos — ver ✅ Completado arriba. Quedan los hallazgos 🟠/🟡/🟢 de la sección 🩺 más abajo, ninguno crítico.

---

## 🟠 Alta prioridad

- **Tip diario se recorta en móvil** (pedido de Pablo, 2026-09-22) — al usar TasKing en pantalla móvil, la franja fija del tip puede quedar por debajo del viewport y su texto no llega a leerse. Reproducir en viewport móvil real, revisar la relación entre contenedor principal, altura dinámica del navegador y `tip-daily`/footer; corregir sin truncar el consejo ni ocultar contenido accesible.
- **Etiquetas en tarjetas nuevas** (pedido de Pablo, 2026-09-11) — 🟢 esfuerzo chico. Hoy las etiquetas solo se pueden asignar reabriendo una tarjeta ya creada: el selector de etiquetas del modal hace `POST /api/cards/:id/labels/:labelId` al instante, y en una tarjeta nueva todavía no hay `:id`. Los objetivos ya resolvieron este mismo problema con un borrador en memoria (`draftGoals` en `public/js/card-modal.js`): se acumulan los ids elegidos mientras se redacta y se vinculan después de crear la tarjeta (paso 5 del guardado). La salida esperada es la simétrica — un `draftLabels` con el mismo patrón, más el picker de etiquetas visible en modo borrador (hoy `renderCardLabels`/el picker asumen `editingId`). Sin cambios de backend ni de esquema.
- **Tab/Enter estándar en toda la interfaz de tarjetas**: navegación por teclado en el modal — Tab entre campos, Enter confirma, Esc cierra. Incluye checklists (Tab entre ítems, Enter agrega el siguiente, Backspace en ítem vacío lo borra). Criterios ya documentados en ADR-014; falta auditar que se cumplan en todos los campos.
- **Onboarding para usuarios nuevos**: primer login → tablero vacío sin guía. Opciones: estado vacío con instrucciones ("Creá tu primera tarjeta con N"), tarjetas de ejemplo precargadas, o mini-tour de tooltips.

## 🟡 Media prioridad

- **Performance: localizar latencia residual del backend** — 🟡 esfuerzo medio. Después de aplicar y comprobar el set de mejoras estructurales, instrumentar etapas si la latencia sigue alta: rate limiting, autenticación/revocación, preparación de usuario y handler. Distinguir ejecución SQL de espera Worker-D1. Preservar revocación inmediata. Evaluar junto con “Rate limiting más granular” y el hallazgo técnico de overhead D1.
- **Performance frontend en tableros grandes** — 🟡 esfuerzo por determinar. La primera mejora todavía llama a `render()` completo después de una mutación. Capturar tiempo de clic a actualización, tareas largas, tamaño de respuesta y costo de render con un tablero representativo antes de diseñar un render incremental.
- **Guardados con recursos relacionados** — 🟡 esfuerzo medio, condicionado por medición. Adjuntos, checklists y objetivos conservan varias escrituras y una relectura de la tarjeta afectada. Medir esos flujos por separado; agrupar operaciones o respuestas solo si aparecen como parte relevante de la latencia.
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
- **Tips a medida basados en comportamiento** (explorado 2026-09-09, pensado junto con el tip diario de onboarding pero implementable por separado):
  - *Enfoque decidido*: mirada **sistémica** (el estado del flujo del tablero) mostrando además **cómo el comportamiento concreto de la persona contribuye a ese estado**. Ni acusación individual ("moviste 6 tarjetas y no terminaste ninguna") ni estadística abstracta que no le habla a nadie. Fundamento Lean: el problema es el proceso, no la persona; la persona necesita ver su aporte al flujo, no ser juzgada.
  - *Hallazgo técnico*: no requiere instrumentar nada nuevo. `audit_log` (migración 0005) ya registra `board_id | card_id | action | email | ts | details(JSON)` con 10 acciones (`card_created/moved/edited/archived/restored/deleted`, `column_created/renamed/moved/deleted`). Es un lector sobre un stream de eventos existente, no un feature de captura de datos.
  - *Riesgo principal*: molestar o sonar vigilante. Necesita control de frecuencia explícito y un espacio de UI propio, distinto del tip diario.

---

## 🩺 Hallazgos del análisis técnico (2026-07-07)

Resultado del análisis funcional y técnico completo (código, seguridad, operación, docs). La criticidad pondera **riesgo × impacto**, no esfuerzo — casi todos los fixes son chicos (esfuerzo: 🟢 chico · 🟡 medio · 🔴 grande). Al resolver un ítem: moverlo a ✅ Completado con fecha; el detalle técnico va en `docs/STATUS.md`.

### 🔴 Crítico

_Sin ítems pendientes — ver ✅ Completado._

### 🟠 Alto — bugs funcionales visibles

- **Progreso de objetivos ignora columnas de cierre múltiples** — 🟢 chico. `goalsWithProgress` usa `getDoneColumnId` (una sola columna, `LIMIT 1`), mientras confeti/métricas/urgencia usan todas las `is_done=1` (`getDoneColumnIds`). **Impacto**: con 2+ columnas de cierre, el % de avance queda subestimado — el usuario ve datos incorrectos.
- **Nadie valida que la columna exista** al crear/editar/importar tarjetas — 🟢 chico. El import usa default `por_conversar`, que puede no existir en tableros con columnas custom. **Impacto**: tarjetas huérfanas en columnas inexistentes, invisibles en la UI y sin error — se percibe como pérdida de datos.
- **Docs de arranque desactualizadas** — 🟢 chico. `QUICK_START.md` (lectura obligatoria por sesión) congelado al 2026-06-30: menciona PRs "pendientes de merge" ya mergeados y deployados, y "69 unit + 22 E2E" (son 111+36). `STATUS.md`: la sección "Features NO Implementados" está llena de features implementadas, y dice "máx 20 etiquetas / paleta de 20 colores" cuando el código impone 10 y 10. **Impacto**: cada sesión (humana o IA) arranca con un mapa falso del proyecto.

### 🟡 Medio — endurecimiento y robustez

- **`style-src` con `'unsafe-inline'`** — 🟡 medio. Lo que quedó pendiente después de ADR-017: hay 148 atributos `style=` en el markup, y varios se generan con valores interpolados (anchos de barras de progreso, swatches de color). Los estáticos pasan a clases; los dinámicos hay que moverlos a CSSOM (`el.style.width = ...`), que el CSP sí permite. Hasta entonces `style-src` conserva `'unsafe-inline'`, declarado a propósito en `src/middleware/cors.js`. Ojo: `script-src` ya **no** lo tiene, así que el riesgo de XSS ejecutable está cerrado; esto es endurecimiento adicional.
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
