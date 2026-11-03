## Why

`public/index.html` mezcla en un solo archivo de 4.545 líneas el markup, 810 líneas de CSS y 3.215 líneas de JavaScript dentro de un único IIFE con 34 variables de estado compartidas por closure. Es el opuesto exacto del estándar que `CLAUDE.md` exige del backend (archivos de 100-150 líneas, un módulo por responsabilidad), y el costo ya se paga: cada cambio de frontend obliga a navegar un archivo de 208 KB, y ninguna parte de esa lógica puede probarse fuera del navegador.

Al medir el terreno apareció un segundo problema, más serio y de otra naturaleza: **las cabeceras de seguridad no llegan al documento HTML**. `createCorsMiddleware()` las emite, pero `wrangler.jsonc` monta `assets.directory: ./public` sin `run_worker_first`, así que el asset server de Cloudflare responde `/` antes de que el Worker corra. Verificado contra el server local: `GET /` devuelve solo `Content-Type`, `Cache-Control`, `ETag` y `CF-Cache-Status`; `GET /api/me` sí trae el juego completo. Es decir que hoy la app **no tiene CSP, ni `X-Frame-Options`, ni `X-Content-Type-Options`, ni `Referrer-Policy` en las páginas que un navegador realmente ejecuta**. La app es enmarcable (clickjacking) y nadie lo notó porque el único test de CSP (`test/api.test.js:105`) invoca `app.fetch` directo y se saltea el ruteo de assets.

Los dos problemas se resuelven juntos porque se habilitan mutuamente: sacar el JS a archivos externos es lo que permite un `script-src 'self'` sin `'unsafe-inline'`, y hacer que la cabecera llegue al documento es lo que convierte esa extracción en una mejora de seguridad verificable en vez de un movimiento cosmético de archivos.

## What Changes

**Entrega de cabeceras de seguridad**
- Los documentos HTML servidos desde `public/` pasan a recibir el juego completo de cabeceras de seguridad, igual que las respuestas de la API.
- `script-src` deja de incluir `'unsafe-inline'`. `style-src` lo conserva (ver Non-goals).
- Se agrega cobertura automática que verifica las cabeceras **sobre el documento HTML servido**, no sobre una llamada directa a `app.fetch`.

**Extracción del frontend**
- Las ~3.215 líneas de JS salen de `index.html` a módulos ES nativos bajo `public/js/`, un módulo por dominio (~10-14 archivos), cargados con `<script type="module">`. Sin build step: se mantiene la filosofía del proyecto.
- Las 34 variables que hoy viven en el closure del IIFE pasan a un módulo de estado explícito con acceso por función; deja de haber estado compartido implícito.
- Las ~810 líneas de CSS salen a `public/css/app.css`.
- El script anti-flash del tema (líneas 8-19) sigue siendo bloqueante en el `<head>`, pero como archivo externo: es lo que evita el parpadeo claro→oscuro antes del primer pintado.
- Los 4 hooks de test sobre `window` (`pollTick`, `runWipPulseSequence`, `maybeBlinkTip`, `launchConfetti`) se preservan de forma explícita y documentada: los E2E dependen de ellos.
- `public/tips.js` se alinea con la nueva estructura sin cambiar su contenido editorial ni los IDs de sus tips.

**Sin cambios de comportamiento.** Es un refactor en el sentido estricto de Fowler: la conducta observable del tablero queda idéntica, y la suite existente (18 archivos E2E + 18 de unitarios) es la red que lo demuestra.

### Non-goals

- **Los 148 atributos `style="..."` del markup y `'unsafe-inline'` en `style-src`.** Varios son dinámicos dentro de template literals (`style="width:${goal.pct}%"`) y exigen pasar a CSSOM; duplicaría el tamaño del change y toca render paths con cobertura despareja. Queda como ítem propio del backlog.
- **Las otras páginas públicas** (`landing.html`, `releases.html`, `revoked.html`, `terminos.html`) conservan su JS y CSS inline. Reciben las cabeceras nuevas, y por eso la política que se les aplique debe contemplarlas — pero no se refactorizan acá.
- **Optimización de render.** `render()` completo tras cada mutación sigue igual; está listado aparte en el backlog y mezclarlo impediría afirmar que este change no cambia comportamiento.
- **Reescribir lógica.** Ninguna función cambia de algoritmo. Si aparece un bug durante la extracción, se anota y se trata por separado.

## Capabilities

### New Capabilities
- `cabeceras-seguridad-http`: qué cabeceras de seguridad debe recibir el navegador, en qué respuestas, y qué debe permitir y prohibir la política de contenido. Cubre el hecho —hoy incumplido— de que la protección aplique al documento que ejecuta código, no solo a las respuestas JSON.

### Modified Capabilities
<!-- Ninguna. El refactor del frontend no altera requisitos observables; `tip-diario`, la única capability con spec vigente, conserva sus requisitos intactos. -->

## Impact

**Código**
- `public/index.html`: de 4.545 líneas a solo markup (~500 estimadas).
- Nuevos: `public/js/` (~10-14 módulos ES), `public/css/app.css`, script de arranque del tema.
- `src/middleware/cors.js`: la política CSP pierde `'unsafe-inline'` en `script-src`.
- `wrangler.jsonc`: configuración de ruteo de assets para que el Worker vea las respuestas de documentos.

**Tests**
- Nuevo test de integración sobre las cabeceras del documento HTML servido (el gap que dejó pasar este problema).
- Los E2E existentes son el contrato de no-regresión; se espera que pasen sin modificación, salvo ajustes de selector si el markup se reacomoda.

**Riesgos**
- Cambiar el ruteo de assets afecta cómo se sirve *toda* página estática: hay que verificar que `/`, las páginas públicas, `/favicon.svg` y los adjuntos bajo `/uploads/:key` sigan funcionando, y medir el efecto en cacheo y latencia (presupuestos de `docs/PERFORMANCE-PRACTICES.md`).
- Romper el closure del IIFE es el trabajo real de diseño: 34 variables compartidas y funciones que se llaman entre secciones. Un orden de extracción equivocado genera dependencias circulares entre módulos.
- Los módulos ES son diferidos por defecto: cualquier código que hoy asuma ejecución sincrónica durante el parseo debe revisarse.

**Documentación**
- ADR nuevo: por qué módulos ES sin build step, y por qué el ruteo de assets cambia.
- `docs/PRODUCT_BACKLOG.md`: corregir el diagnóstico del ítem «CSP con `'unsafe-inline'`», que parte de una premisa equivocada.
