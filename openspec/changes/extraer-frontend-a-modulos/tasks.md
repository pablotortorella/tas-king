## 1. F1 — Entrega de cabeceras al documento

Desplegable y valiosa por sí sola: cierra el clickjacking sin tocar `index.html`. La política sigue con `'unsafe-inline'` en esta fase.

- [x] 1.1 Decidir y registrar si el CSP suma `frame-ancestors 'none'` además de `X-Frame-Options` (pregunta abierta 1 de `design.md`); dejar la decisión escrita en el ADR de la tarea 7.1
- [x] 1.2 Agregar `run_worker_first` acotado a documentos en `wrangler.jsonc`, **a nivel raíz** (es la config que usa `wrangler deploy` sin `--env`) y verificar que `env.staging` quede coherente
- [x] 1.3 Agregar en el Worker un handler de documentos que haga `env.ASSETS.fetch(request)`, copie la respuesta y le agregue las cabeceras de seguridad, preservando `Content-Type`, `Cache-Control` y `ETag`
- [x] 1.4 Verificar que el handler de documentos NO pase por `createAuthMiddleware()`: el HTML hoy se sirve sin autenticar y eso no debe cambiar
- [x] 1.5 Test de integración que pida `/` como cliente externo y afirme `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` — sin invocar `app.fetch` por dentro
- [x] 1.6 Test que afirme las mismas cabeceras en `/landing.html`, `/releases.html`, `/revoked.html` y `/terminos.html`
- [x] 1.7 Test de request condicional: con `If-None-Match` sobre el ETag vigente, `/` sigue respondiendo 304 y no un 200 completo
- [x] 1.8 Test de que `/api/*` conserva el juego completo de cabeceras que ya tenía
- [x] 1.9 Verificar que `/uploads/:key`, `/favicon.svg` y los adjuntos siguen sirviéndose correctamente con el ruteo nuevo
- [x] 1.10 Medir `GET /` antes y después contra los presupuestos de `docs/PERFORMANCE-PRACTICES.md` y registrar el resultado
- [x] 1.11 `npm run test:all` en verde, desplegar a staging y verificar las cabeceras con `curl -sI` sobre la URL real (no solo local) — desplegado 2026-09-16, Version ID `f73d81aa-1e0e-4ffa-83ef-094efe4f16ff`; cabeceras verificadas en los 5 documentos, assets estáticos fuera del Worker, 304 condicional OK, cero violaciones de CSP en navegador real

## 2. F0 — Red de seguridad antes de tocar el frontend

Cubrir los módulos que hoy están a ciegas. Tests de caracterización: documentan lo que el código hace hoy, no lo que debería hacer.

- [x] 2.1 Inventariar qué secciones del bloque JS no tienen cobertura E2E y confirmar el hallazgo de `design.md` — **hecho, y corrigió el diagnóstico**: importar CSV, admin (lista + tab Actividad) y deep-link ya estaban cubiertos por `critical-flows.spec.js`. Los huecos reales son exportar/menú IO, admin (tabs Stats y Solicitudes), perfil, ayuda y paneo. Inventario corregido en `design.md`
- [x] 2.2 E2E de caracterización: menú IO, exportar a JSON y exportar a CSV (importar ya está cubierto)
- [x] 2.3 E2E de caracterización: panel de administración — tabs Stats y Solicitudes (lista de acceso y Actividad ya están cubiertas)
- [x] 2.4 E2E de caracterización: modal de perfil (nombre, avatar emoji, color) y su persistencia
- [x] 2.5 E2E de caracterización: modal de ayuda (F1) — abrir y cerrar (deep-link ya está cubierto)
- [x] 2.6 E2E de caracterización: paneo del tablero arrastrando el fondo
- [x] 2.7 `npm run test:all` en verde con los tests nuevos sobre el código actual, sin tocar `index.html`

## 3. F2 — Extracción de CSS y del script anti-flash

Movimientos mecánicos, verificables por diff.

- [x] 3.1 Mover el bloque `<style>` (líneas 20-830) a `public/css/app.css` y enlazarlo desde el `<head>`
- [x] 3.2 Mover el script anti-flash del tema (líneas 8-19) a `public/js/theme-boot.js` como script clásico **bloqueante** en el `<head>` — no `defer`, no `type="module"`
- [x] 3.3 Verificar a ojo que no hay parpadeo claro→oscuro al recargar en tema oscuro, y que `e2e/theme.spec.js` y `e2e/board-theme.spec.js` pasan
- [x] 3.4 `npm run test:all` en verde

## 4. F3/F4 — El JS sale del HTML

- [x] 4.1 Mover el bloque `<script>` (1328-4543) a `public/js/app.js` como script clásico, con el cuerpo idéntico; enlazarlo donde estaba
- [x] 4.2 `npm run test:all` en verde — el diff debe poder leerse como un movimiento, no como una edición
- [x] 4.3 **En un commit propio y aislado**: pasar `app.js` a `<script type="module">` y resolver lo que rompa la ejecución diferida
- [x] 4.4 `npm run test:all` en verde; si falla algo, que el commit culpable diga exactamente "cambio a módulo ES"
- [x] 4.5 Confirmar que `index.html` quedó en markup (~500 líneas) y que `tips.js` sigue siendo script clásico con `window.DAILY_TIPS` accesible

## 5. F5 — Modularización

- [x] 5.0 Alcance agregado y aprobado: hacer confiable la red de seguridad antes de extraer módulos. `resetDb` reintenta ante `SQLITE_BUSY`; queda documentada una segunda falla intermitente sin causa identificada (dos subrecursos que nunca completan en `page.goto`), mitigada con un reintento local que Playwright reporta como "flaky"

Un módulo por commit, con la suite en verde entre cada uno. El orden va de núcleo a features, y dentro de features de menos a más acoplado.

- [x] 5.1 `core/bus.js`: `on`/`emit`, con test unitario propio
- [x] 5.2 `core/dom.js`: `escapeHtml`, `uid`, `fmtDate`, `relativeTime`, `isOverdue`, `isUrgent`, `avatarHtml`, `defaultColor` — funciones puras, con tests unitarios
- [x] 5.3 `core/api.js`: `api()` y manejo de errores de red
- [x] 5.4 `core/state.js`: mudar las 34 variables compartidas del tope del IIFE, expuestas por función y no como binding mutable exportado
- [x] 5.5 Verificar que los contadores de concurrencia (`pendingCardMutations`, `cardMutationRevision`, `boardLoadRevision`, `boardRefreshPending`, `lastKnownVersion`) se mudaron juntos y **sin cambios de lógica**; `e2e/drag-no-duplicate.spec.js`, `e2e/board-sync.spec.js` y `e2e/card-mutation-performance.spec.js` en verde
- [x] 5.6 `theme.js`: tema claro/oscuro, paleta por tablero, prompt de bienvenida
- [x] 5.7 `feedback.js`: pulso WIP, confeti, tip diario
- [x] 5.A Verificación intermedia en staging del núcleo modular (2026-09-17, Version ID `27b02022-c022-4902-8a15-646cba5c2c3e`): los 9 archivos de `js/` y `css/` se sirven con el Content-Type correcto y fuera del Worker, la cadena de imports ES resuelve en el navegador (10 assets en 200, incluidos los transitivos), los 5 documentos conservan sus cabeceras y el camino de error de `api()` redirige al login ante un 401
- [x] 5.8 `polling.js`: `pollTick`, `startPolling`, refresco de checklists sincronizadas
- [x] 5.9 `board.js`: `loadBoard`, `loadCards`, `render`, `renderCard` y los filtros de búsqueda/responsable/etiqueta — 18 funciones, 8 exportadas. Antes hubo que romper cuatro acoplamientos: `fechaLocal` a `core/dom.js`, `memberByEmail` a `core/state.js`, `renderMe` pasa a atender `sesion:cargada`, y `saveBtn` sale de `withCardMutation` a los eventos `mutacion:inicio`/`mutacion:fin` que atiende el modal
- [x] 5.10 `drag.js`: arrastre de tarjetas con Pointer Events + paneo del tablero
- [x] 5.11 `card-modal.js`: apertura/cierre, comentarios, historial, adjuntos
- [x] 5.12 `checklists.js`
- [x] 5.13 `goals.js`: vista de objetivos, panel lateral y objetivos dentro del modal
- [x] 5.14 `metrics.js`: burn-up, WIP, «¡Pilas con esto!», quietas y por vencer
- [x] 5.15 `labels.js`: etiquetas en tarjeta + administrador de etiquetas del tablero
- [x] 5.16 `columns.js`: crear, renombrar, mover y eliminar columnas
- [x] 5.17 `boards.js`: selector de tablero, miembros, tabs de configuración, perfil, renombrar y borrar
- [x] 5.18 `io.js`: exportar/importar JSON y CSV, vista previa de importación
- [x] 5.19 `admin.js`: panel de administración, stats, actividad, pendientes
- [x] 5.20 `keyboard.js`: atajos, cadena de Escape, modal de ayuda, deep-link
- [x] 5.21 `app.js` queda como composition root: arranque, cableado y registro de los 4 hooks de `window` en un punto único, cada uno comentado con el test que lo usa
- [x] 5.22 Revisar que no quedó ningún import entre módulos de feature: las aristas de vuelta van por `bus.js`
- [x] 5.23 Verificación en staging de la modularización completa (2026-09-17, Version ID `1d6810de-94d3-433f-a5d6-ebb6383bda66`): los 19 archivos de `js/` se sirven como `text/javascript` y fuera del Worker; el navegador resuelve el grafo completo de imports (21 assets en 200, incluidos los de dos niveles de profundidad que el HTML no menciona); cero errores de consola y cero violaciones de CSP; los 5 documentos conservan cabeceras y el 304 condicional; el 401 sin sesión sigue redirigiendo a `/landing`

## 6. F6 — Endurecer `script-src`

- [x] 6.1 **Decidido: extraerlas.** Los 8 bloques resultaron ser 3 archivos — el script anti-flash estaba copiado idéntico en las 4 páginas (y era el mismo ya extraído), el toggle de tema repetido en 3, y landing tenía el suyo. Extraer salió más barato que diferenciar la política por ruta, y elimina un script que vivía en 5 copias. Decisión original: `landing.html`, `releases.html`, `revoked.html` y `terminos.html` tienen 8 bloques `<script>` inline entre las cuatro. O se extraen también, o la política se diferencia por ruta (pregunta abierta 3 de `design.md`)
- [x] 6.2 Ejecutar la decisión de 6.1
- [x] 6.3 Confirmar que no queda JavaScript inline en ninguna página alcanzada por la política
- [x] 6.4 Sacar `'unsafe-inline'` de `script-src` en `src/middleware/cors.js`, dejando `style-src` como está y conservando los orígenes de Google en `connect-src`
- [x] 6.5 Actualizar el test de CSP para afirmar que `script-src` no contiene `'unsafe-inline'` ni `'unsafe-eval'`
- [x] 6.6 Recorrer el producto completo con la consola abierta —tablero, modal, checklists, objetivos, métricas, etiquetas, columnas, importación, admin, perfil, tema— y confirmar cero violaciones de CSP
- [~] 6.7 Login con Google end-to-end: verificado que `/auth/login` responde 302 a `accounts.google.com` y que `connect-src` conserva los orígenes de Google. **El flujo completo (consentimiento → callback → sesión) no se puede probar sin una cuenta real: queda para que Pablo lo confirme en staging.** Nota: el login es una navegación, no un fetch, así que el CSP no la gobierna — `connect-src` solo aplicaría a llamadas XHR a Google, que el frontend no hace
- [x] 6.8 `npm run test:all` en verde

## 7. Documentación e integración

- [x] 7.1 ADR nuevo en `docs/ADRs/`: por qué módulos ES sin build step, por qué cambia el ruteo de assets, y la decisión sobre `frame-ancestors`
- [x] 7.2 Corregir en `docs/PRODUCT_BACKLOG.md` el diagnóstico del ítem «CSP con `'unsafe-inline'`»: la premisa era equivocada, el problema real era que las cabeceras no llegaban al documento
- [x] 7.3 Agregar al backlog el ítem separado de `style-src` y los 148 atributos `style=`
- [x] 7.4 Actualizar `docs/STATUS.md` con la sesión, la causa raíz del gap de cabeceras y los tests agregados
- [x] 7.5 Evaluar si corresponde entrada en `public/releases.html` y bump de versión: el refactor es interno, pero el endurecimiento de seguridad puede merecer mención
- [~] 7.6 Rebase contra `origin/main` (innecesario: la rama está al día), `npm run test:all` en verde (212 + 87) y diff revisado: 60 archivos, 40 nuevos. **Falta abrir el PR** — se decidió hacer dos, el refactor primero y el fix de Esc después, para no mezclar un cambio de comportamiento con un change que promete no cambiarlo
- [~] 7.7 Staging desplegado con el estado final (2026-09-17, Version ID `72182e18-2dc1-4ce1-86d6-7bfc7b5f2ef3`, v2.3.0): política endurecida verificada en el borde (`script-src 'self'` sin `'unsafe-inline'`, `frame-ancestors 'none'`), cero scripts inline en las 5 páginas, cero violaciones en navegador, y el toggle de tema de las públicas funciona desde su archivo nuevo. **Falta: que Pablo confirme el login autenticado con Google, y la integración a `main`**
- [ ] 7.8 Producción solo con aprobación explícita de Pablo; F6 conviene desplegarla sola para que un revert sea de una línea
