# 📋 PRODUCT BACKLOG — FUN TasKing!

**Última actualización**: 2026-07-04
**Reemplaza a**: `PROJECT_BACKLOG.md` (raíz) y `docs/backlog.txt` — unificados y borrados en esta fecha.

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
| — | 💾 Backup automático (Cron + R2) | Falta config de push a GitHub off-platform (secrets pendientes, ver Media prioridad) |
| — | Import/Export JSON + CSV completo | Incluye etiquetas, checklists, responsable |
| — | 🎯 Objetivos (gestión por metas) | |
| — | 🎯 Pulso WIP "Dejar de empezar y empezar a terminar" | 2026-07-04 — ver detalle en `docs/STATUS.md` |

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

## 🗄️ Contexto histórico (decisiones ya resueltas, para no repreguntar)

- **Tiempo real vía WebSockets/Durable Objects**: evaluado y descartado por ahora — el polling cada 5s ya cubre el caso de uso de "ver cambios de otros sin recargar" con mucho menos esfuerzo/costo.
- **Epic "Workflow Analytics Engine" (ADR-013)**: era el foco de una sesión anterior a fines de completar KPIs de flujo de trabajo. Se completó como el punto #8 (¿Cómo vamos?) — la épica como tal ya no está "en curso", quedó absorbida en el backlog normal de #9 en adelante.
- **e) Múltiples tableros**: los miembros se agregan desde ⚙️ — no es un gap, ya existe.
- **c/d) Mobile IO y modal con checklists largos**: funcionan bien según feedback de Pablo, no requieren rediseño por ahora.
