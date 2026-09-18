## Context

`public/index.html` son 4.545 líneas: markup, un `<style>` de 810 líneas (20-830), un script anti-flash de tema (8-19) y un `<script>` de 3.215 líneas (1328-4543) con todo el frontend adentro de un único IIFE `"use strict"`. Ese IIFE declara **34 variables de estado** en su tope (`COLUMNS`, `state`, `me`, `currentBoardId`, `editingId`, `draftAttachments`, `draftChecklists`, `draftGoals`, los filtros, los contadores de revisión de mutaciones…) que ~180 funciones leen y escriben por closure. No hay un solo punto donde se pueda ver quién muta qué.

El código ya viene bien preparado para salir:

- **Cero handlers inline** (`onclick=`, `onchange=`): el binding es programático. Es la parte más cara de este tipo de extracción y ya está hecha.
- **29 secciones marcadas** con comentarios (`// ---------- Modal ----------`) que corresponden casi uno a uno con los módulos destino.
- **Precedente**: `public/tips.js` ya se sirve como archivo externo.
- **Sin build step**, y los módulos ES nativos no requieren ninguno.

Cuatro funciones se exponen en `window` como hooks de test —`runWipPulseSequence` (137), `maybeBlinkTip` (262), `pollTick` (425), `launchConfetti` (2359)— y los E2E dependen de ellas (`e2e/drag-no-duplicate.spec.js`, `e2e/wip-pulse.spec.js`, `e2e/access-revoked.spec.js`, `e2e/tip-diario.spec.js`). No son accidentes: son la costura de testing del frontend actual.

**El hallazgo que motiva la otra mitad del change**: las cabeceras de seguridad no llegan al documento. `wrangler.jsonc` declara `assets.directory: "./public"` sin `run_worker_first`, de modo que el Asset Worker de Cloudflare responde antes de que corra el User Worker, y `createCorsMiddleware()` nunca toca esas respuestas. Verificado contra `wrangler dev`:

```
GET /                                 GET /api/me
  Content-Type: text/html               Content-Security-Policy: default-src 'self'; ...
  Cache-Control: ...                    X-Frame-Options: DENY
  ETag: ...                             X-Content-Type-Options: nosniff
  CF-Cache-Status: HIT                  Referrer-Policy: no-referrer
  (ninguna cabecera de seguridad)       Permissions-Policy: ...
```

El Worker no tiene ninguna ruta para `/` (las rutas registradas son `/auth/*`, `/api/*` y `/uploads/:key`), así que hoy el documento se sirve íntegramente por fuera de él.

## Goals / Non-Goals

**Goals:**

- Que las cabeceras de seguridad lleguen al documento que el navegador ejecuta, y que eso quede cubierto por un test que consulte la respuesta HTTP servida.
- Que `script-src` pueda declararse `'self'` sin `'unsafe-inline'`, lo que exige que no quede JavaScript inline en ninguna página de la app principal.
- Que el frontend quede en módulos con una dirección de dependencia explícita y un único dueño del estado compartido.
- Que el comportamiento observable no cambie: es un refactor en el sentido estricto: reestructuración interna sin alteración de conducta externa, con los tests existentes como criterio.
- Que cada paso sea desplegable y reversible por sí mismo.

**Non-Goals:**

- `style-src 'unsafe-inline'` y los 148 atributos `style=` del markup (ver `proposal.md`).
- Refactorizar `landing.html`, `releases.html`, `revoked.html`, `terminos.html`: reciben las cabeceras nuevas pero conservan su JS y CSS inline.
- Render incremental, agrupación de requests, o cualquier cambio de performance del frontend.
- Reescribir lógica de negocio. Si aparece un bug durante la extracción se anota y se trata aparte: mezclarlo haría imposible afirmar que el refactor no cambió comportamiento.

## Decisions

### D1. Las cabeceras se entregan con `run_worker_first` acotado a documentos

El User Worker debe ver las respuestas de documentos para poder decorarlas. Alternativas:

| Opción | Qué implica | Veredicto |
|---|---|---|
| `run_worker_first: true` | Todo request —JS, CSS, íconos, imágenes— pasa por el Worker. | **Descartada**: paga una invocación de Worker por cada asset estático, en costo y en latencia, para decorar respuestas que no lo necesitan (el CSP aplica al documento, no a los archivos que carga). |
| `run_worker_first: ["/", "/*.html"]` | Solo los documentos pasan por el Worker; JS, CSS e imágenes los sigue sirviendo el Asset Worker desde el borde. | **Elegida** |
| Servir el HTML desde Hono leyendo `env.ASSETS` sin tocar `run_worker_first` | El Asset Worker igual responde primero para rutas que existen en `public/`; la ruta de Hono nunca se alcanzaría. | **Descartada**: no resuelve el problema. |

El schema de `wrangler@4.104` confirma que `run_worker_first` acepta un array de patrones con reglas negativas, además del booleano (`node_modules/wrangler/config-schema.json`, `definitions/Assets/properties/run_worker_first`).

El Worker gana un handler de documentos que hace `env.ASSETS.fetch(request)`, copia la respuesta y le agrega las cabeceras. Debe **preservar** `Content-Type`, `Cache-Control` y `ETag` tal como los emite el Asset Worker, y propagar los 304 de requests condicionales sin convertirlos en 200: romper eso degradaría el cacheo de un HTML de 208 KB.

Ese handler **no** pasa por `createAuthMiddleware()`. Hoy el documento se sirve sin autenticar —la app pide `/api/me` y decide desde el cliente— y cambiarlo sería alterar comportamiento.

**Trampa conocida y documentada en el propio repo**: `npm run deploy` corre `wrangler deploy` *sin* `--env production`, así que la configuración que aplica es la de nivel raíz. El comentario en `wrangler.jsonc` deja constancia de que los cron triggers ya se perdieron una vez por ponerlos bajo `env.production`. `run_worker_first` va al **nivel raíz**, y hay que verificarlo también en `env.staging`.

### D2. Módulos ES nativos, sin build step

`<script type="module" src="/js/app.js">` con `import`/`export` estándar. Sin bundler, sin transpilación: el proyecto no tiene build step y ésta es una de sus decisiones de diseño, no una carencia.

Consecuencia que hay que respetar: **los módulos se ejecutan diferidos**, después del parseo del documento. El código de arranque que hoy corre durante el parseo pasa a correr después. Por eso el script anti-flash del tema **no puede ser un módulo**: su razón de existir es correr antes del primer pintado. Sale a `public/js/theme-boot.js` y se carga como script clásico bloqueante en el `<head>`.

`tips.js` declara `const DAILY_TIPS` en el scope global y `e2e/tip-diario.spec.js` lo lee como `window.DAILY_TIPS`. Se mantiene como script clásico para no romper ese contrato; convertirlo a módulo exigiría tocar el test, que es justamente la red de seguridad.

### D3. Tres capas con dirección de dependencia única

**Corregido durante la implementación (2026-09-17).** La primera versión de esta
decisión decía que los módulos de feature nunca se importan entre sí y que toda
arista de vuelta pasa por `bus.js`. **Era incorrecta**, y recién se vio al tener el
núcleo extraído y medir el código real:

- 18 secciones distintas llaman a `render()`, `loadCards()` o `loadBoard()`: 66 sitios.
- **44 de esas llamadas son `await`**, y al menos una usa el valor de retorno
  (`if (!(await loadCards())) return;`).

`emit()` devuelve `undefined` y además atrapa las excepciones de sus oyentes. No
puede reemplazar a una llamada que se espera y cuyo resultado se usa. El bus sirve
para avisos sin respuesta, no para eso.

La corrección es agregar una capa en vez de forzar el bus:

```
   +---------------------------------------------------------------+
   |  app.js  -- composition root: arranca, cablea, registra hooks  |
   +---------------------------------------------------------------+
                               |
                               v
   +---------------------------------------------------------------+
   |  FEATURES                                                      |
   |  card-modal  checklists  goals  metrics  labels  columns       |
   |  boards  io  admin  keyboard  drag  theme  feedback            |
   +---------------------------------------------------------------+
                               |
                               v
   +---------------------------------------------------------------+
   |  TABLERO:  board.js                                            |
   |  render()  renderCard()  loadBoard()  loadCards()  loadGoals() |
   |  withCardMutation()  y los filtros de visibilidad              |
   +---------------------------------------------------------------+
                               |
                               v
   +---------------------------------------------------------------+
   |  NUCLEO:  state.js   api.js   dom.js   bus.js                  |
   +---------------------------------------------------------------+

   Las flechas siguen yendo solo hacia abajo. Lo que cambia es que
   ahora hay tres niveles y no dos, y que `await loadCards()` sigue
   escribiendose `await loadCards()` en los 66 sitios.
```

**La regla que queda**: una feature puede importar del tablero y del núcleo, nunca
de otra feature. El tablero puede importar del núcleo, nunca de una feature. Cuando
el tablero necesita avisar algo hacia arriba —y no esperar respuesta— usa `bus.js`.

**Por qué no inyección de dependencias por `init()`**: mantendría las features
aisladas entre sí, pero cada módulo necesitaría su propia plomería y las llamadas
dejarían de leerse como llamadas. Más ceremonia para la misma dirección de
dependencias que ya da la capa.

**Por qué no un framework ni un store con reactividad**: sería reemplazar un problema
de organización por una dependencia nueva y un modelo mental nuevo, en un producto
que hoy anda. La meta es que el código diga la verdad sobre sus dependencias.

### D4. `state.js` es el único dueño del estado compartido

Las 34 variables del tope del IIFE se mudan a `state.js`, que las expone por función y no como binding mutable exportado. Es *Encapsulate Variable* de Fowler aplicado 34 veces: el punto no es esconderlas sino que exista **un lugar** donde se pueda leer qué muta cada una.

El estado que hoy es local a una sección se queda con su módulo —`labelPickerVisible` con `labels.js`, `cardDrag` con `drag.js`, `pendingImport` con `io.js`, `pollTimer`/`pollInFlight` con `polling.js`— porque nunca fue compartido: estaba en el closure por falta de frontera, no por necesidad.

Los contadores de concurrencia (`pendingCardMutations`, `cardMutationRevision`, `boardLoadRevision`, `boardRefreshPending`, `lastKnownVersion`) se mudan **juntos y sin tocar su lógica**. Son la protección contra polling pisando mutaciones en vuelo, ganada en los changes de performance y de sincronización de tablero; separarlos o "limpiarlos" acá reintroduciría bugs ya resueltos.

### D5. Descomposición propuesta

Un módulo por sección ya marcada en el código. Cuentas aproximadas sobre el bloque actual:

| Módulo | Cubre | ~Líneas |
|---|---|---|
| `core/state.js` | las 34 variables compartidas + accessors | ~120 |
| `core/api.js` | `api()`, manejo de errores de red | ~60 |
| `core/dom.js` | `escapeHtml`, `uid`, `fmtDate`, `relativeTime`, `isOverdue`, `isUrgent`, `avatarHtml`, `defaultColor` | ~120 |
| `core/bus.js` | `on`/`emit` | ~25 |
| `theme.js` | tema claro/oscuro, paleta por tablero, prompt de bienvenida | ~140 |
| `board.js` | `loadBoard`, `loadCards`, `render`, `renderCard`, filtros de búsqueda/responsable/etiqueta | ~300 |
| `polling.js` | `pollTick`, `startPolling`, refresco de checklists sincronizadas | ~110 |
| `drag.js` | arrastre de tarjetas (Pointer Events) + paneo del tablero | ~180 |
| `card-modal.js` | apertura/cierre, comentarios, historial, adjuntos | ~330 |
| `checklists.js` | checklists y sus ítems | ~280 |
| `goals.js` | vista de objetivos, panel lateral, objetivos dentro del modal | ~340 |
| `metrics.js` | burn-up, WIP, «¡Pilas con esto!», quietas y por vencer | ~230 |
| `labels.js` | etiquetas en tarjeta + administrador de etiquetas del tablero | ~310 |
| `columns.js` | crear/renombrar/mover/eliminar columnas | ~90 |
| `boards.js` | selector de tablero, miembros, tabs de configuración, perfil, renombrar/borrar | ~300 |
| `io.js` | exportar/importar JSON y CSV, vista previa de importación | ~200 |
| `admin.js` | panel de administración, stats, actividad, pendientes | ~240 |
| `keyboard.js` | atajos, cadena de Escape, modal de ayuda, deep-link | ~130 |
| `feedback.js` | pulso WIP, confeti, tip diario | ~200 |
| `app.js` | arranque, cableado, registro de hooks | ~80 |

Veinte archivos. `CLAUDE.md` pide 100-150 líneas en `src/`; varios de estos quedan por encima porque concentran render con template literals largos. **El objetivo acá es la frontera correcta, no el número.** Partir `goals.js` o `card-modal.js` solo para bajar el conteo produciría módulos que no se explican solos. Si al terminar alguno sigue incómodo, es material para un segundo pase con los tests ya cubriendo el comportamiento, no para forzarlo en éste.

### D6. Los hooks de `window` se vuelven explícitos

Hoy están desperdigados como asignaciones sueltas en medio del código. Pasan a un punto único en `app.js`, con un comentario que diga qué test depende de cada uno:

```js
// Hooks para E2E. Cada uno tiene un test que lo usa; si sacás uno, mirá cuál.
window.pollTick = pollTick;                       // drag-no-duplicate, access-revoked
window.runWipPulseSequence = runWipPulseSequence; // wip-pulse
window.maybeBlinkTip = maybeBlinkTip;             // tip-diario
window.launchConfetti = launchConfetti;           // hook manual
```

Alternativa considerada: eliminarlos y reescribir los E2E contra la UI. Descartada para este change. Esos tests son la red de seguridad del refactor; tocarlos en el mismo movimiento sería serruchar la rama.

### D7. Orden de trabajo: valor primero, riesgo después

El orden no es el del diagrama de arquitectura sino el de riesgo creciente, y la fase que más valor entrega es la más barata:

```
  F1  Entrega de cabeceras            <- arregla clickjacking HOY. No toca index.html.
      (run_worker_first + handler          Desplegable y valiosa por si sola.
       + test sobre la respuesta)          Politica sin cambios: sigue con 'unsafe-inline'.
        |
  F2  CSS -> app.css                  <- movimiento mecanico, verificable por diff
      anti-flash -> theme-boot.js
        |
  F3  JS -> app.js (script clasico)   <- movimiento mecanico, cuerpo identico
        |
  F4  app.js -> type="module"         <- CAMBIO SEMANTICO: ejecucion diferida.
        |                                  Aislado en su propio commit a proposito.
  F5  Extraer nucleo, luego features  <- un modulo por commit, suite verde entre cada uno
        |
  F6  Sacar 'unsafe-inline'           <- recien acá, cuando no queda script inline
      de script-src
```

**F1 antes que todo lo demás** porque el agujero de clickjacking está abierto hoy y no depende del refactor. **F4 en su propio commit** porque es el único paso que cambia cuándo corre el código: si algo se rompe ahí, el `git bisect` tiene que dar un commit que diga exactamente eso. **F6 al final** porque endurecer `script-src` antes de que el último inline haya salido rompe la app.

Es el paso corto de Beck: suite verde entre commits, y si un paso se pone difícil, el problema es el tamaño del paso.

### D8. La red de seguridad se verifica antes de empezar

Antes de F3 hay que saber qué secciones están a ciegas. Los 18 archivos E2E cubren tablero, modal, checklists, objetivos, métricas, etiquetas, columnas, temas, drag, historial, tip diario, revocación y adjuntos.

**Inventario corregido durante la implementación (2026-09-16).** La primera versión de este documento daba por no cubiertos varios flujos que sí lo están. El inventario real, hecho grepeando los ids de la UI contra `e2e/*.spec.js`:

| Flujo | Estado |
|---|---|
| Importar CSV | cubierto — `critical-flows.spec.js:38` |
| Admin: lista de acceso y tab Actividad | cubierto — `critical-flows.spec.js:56` |
| Deep-link a tarjeta | cubierto — `critical-flows.spec.js:75` |
| Exportar JSON y CSV, menú IO (`#ioBtn`) | **sin cobertura** |
| Admin: tabs Stats y Solicitudes | **sin cobertura** |
| Modal de perfil (`#profileBtn`) | **sin cobertura** |
| Modal de ayuda (F1) | **sin cobertura** |
| Paneo del tablero arrastrando el fondo | **sin cobertura** |

Esos cinco son los módulos donde una extracción puede romper algo en silencio. Van tests de caracterización —en el sentido de Feathers: tests que documentan lo que el código hace hoy, sin juzgar si está bien— **antes** de tocarlos.

## Risks / Trade-offs

**`run_worker_first` bajo `env.production` en vez de nivel raíz** → El repo ya se quemó con esto: los cron triggers no se registraron por el mismo motivo, y está documentado en `wrangler.jsonc`. Va al nivel raíz, y la verificación en staging tiene que confirmar la cabecera sobre la URL real, no solo en local.

**Latencia y costo por invocación de Worker en cada documento** → Acotar el patrón a documentos deja JS, CSS e imágenes en el Asset Worker. Medir el tiempo de `GET /` antes y después contra los presupuestos de `docs/PERFORMANCE-PRACTICES.md`; si el costo aparece, evaluar `not_found_handling` o mover la decoración a una capa más barata.

**Perder ETag, `Cache-Control` o los 304 al reconstruir la respuesta** → Un HTML de 208 KB que deja de cachearse es una regresión de performance disfrazada de mejora de seguridad. El handler copia la respuesta del Asset Worker en vez de construir una nueva, y hay test de request condicional.

**Ejecución diferida de módulos rompe algo de arranque** → F4 aislado en su propio commit, con la suite completa antes y después. El anti-flash del tema explícitamente fuera del grafo de módulos.

**Dependencias circulares entre módulos de feature** → Capas con dirección única y `bus.js` para las vueltas. Un ciclo que el bus no resuelve se lee como frontera mal trazada, no como problema del cargador.

**Romper el estado compartido reintroduce bugs de concurrencia ya resueltos** → Los contadores de revisión se mudan juntos, sin cambios de lógica. `e2e/drag-no-duplicate.spec.js`, `e2e/board-sync.spec.js` y `e2e/card-mutation-performance.spec.js` son el control.

**Los E2E dependen de selectores que el markup reacomodado puede mover** → El markup no se reescribe en este change; solo se le quitan `<script>` y `<style>`. Cualquier cambio de selector es señal de que alguien salió del alcance.

**El change es grande y puede quedar a medio camino** → Cada fase es desplegable y reversible sola. Si se abandona después de F1, el clickjacking igual quedó cerrado. Si se abandona después de F3, `index.html` ya bajó a markup. No hay estado intermedio que deje el producto peor que hoy.

## Migration Plan

Sin migración de datos ni de esquema: no se toca la DB. La secuencia de despliegue sigue el flujo obligatorio de `CLAUDE.md` (local → staging de la rama → integración a `main` → staging de `main` → producción con aprobación explícita).

**Despliegue por fases.** F1 puede integrarse y desplegarse sola, antes de que exista una línea del refactor. F2-F5 pueden viajar juntas. F6 es un commit chico que conviene desplegar solo, para que si aparece una violación de CSP en producción el revert sea de una línea.

**Verificación en staging** (no solo tests locales, porque el ruteo de assets se comporta distinto contra Cloudflare real):

```
curl -sI https://<staging>/ | grep -i 'content-security\|x-frame\|x-content-type\|referrer'
curl -sI https://<staging>/landing.html | grep -i 'content-security'
curl -sI -H 'If-None-Match: <etag>' https://<staging>/    # debe seguir dando 304
```

Y en el navegador: abrir el tablero con la consola abierta y confirmar cero violaciones de CSP en un recorrido de tablero, modal, checklists, objetivos, métricas, importación y admin.

**Rollback**: `git revert` de la fase + `npm run deploy`. F1 revierte a una configuración de assets sin `run_worker_first` y el producto vuelve exactamente al estado de hoy. F6 revierte devolviendo `'unsafe-inline'` a `script-src` sin tocar nada más.

## Open Questions

1. **¿`frame-ancestors 'none'` además de `X-Frame-Options`?** `X-Frame-Options` es lo legado y `frame-ancestors` lo que los navegadores modernos respetan. Poner los dos es la práctica habitual, pero suma una directiva a una política que también gobierna las páginas públicas. A decidir al escribir F1.
2. **¿Los 304 sobreviven al pasar por el Worker?** La respuesta condicional la produce el Asset Worker; hay que confirmar contra staging que sigue llegando 304 y no un 200 completo. Si no sobrevive, cambia el diseño del handler.
3. **¿`landing.html` y compañía aguantan `script-src 'self'`?** Tienen scripts inline propios (3, 2, 1 y 2 etiquetas `<script>` respectivamente) y la política es global. O se extraen también en F6, o la política se diferencia por ruta. Lo segundo agrega complejidad; lo primero agranda el alcance. **Hay que decidirlo antes de F6, no durante.**
4. **¿Queda `tips.js` como script clásico para siempre?** Funciona y el test depende de él. Anotado como deuda consciente, no como pendiente de este change.
