## Why

Con las categorías propias del libro (`categorias-del-libro`) y los movimientos importados como movimientos normales (`importacion-como-movimientos`), el histórico queda listo para ordenarse, pero hacerlo movimiento por movimiento no es viable: en el export real de referencia alrededor de un tercio de las filas tiene la categoría genérica y solo el 23 % de ellas comparte descripción con otra, de modo que unas 650 decisiones son individuales. Se decidió en el explore (D12 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`) construir una **operación de fondo** que aplica una categoría a un conjunto de movimientos con auditoría y deshacer por lote, y dos formas de dispararla: **seleccionar sobre una búsqueda** y **clasificar rápido**, uno por uno y con sugerencias. Para quien llega desde Splitwise, importar y ordenar el histórico en la misma herramienta es un diferencial.

## What Changes

- **Operación de recategorización**: aplica una categoría a un conjunto de movimientos, con una vista previa de cuántos se cambian, una confirmación y un límite por operación.
- **Seleccionar sobre una búsqueda**: la lista permite marcar movimientos o «seleccionar todos los resultados» de la búsqueda o el filtro actual (incluidos los que «Ver más» todavía no muestra) y asignarles una categoría.
- **Clasificar rápido**: una pantalla muestra un movimiento pendiente por vez, con una categoría sugerida cuando la hay, atajos de teclado, opción de saltar y de deshacer lo último, y un contador de pendientes.
- **Auditoría**: cada movimiento cambiado recibe una revisión («Cambió: categoría») y la operación queda registrada con su autor, fecha, categoría destino, cantidad y un identificador de lote.
- **Deshacer un lote completo**: devuelve cada movimiento a su categoría anterior, salvo los que se hayan modificado después, que se informan.
- **Sugerencias**: una regla simple sobre las palabras de la descripción propone una categoría; nunca se aplica sola.

### Non-goals

- Asistente de consistencia («la misma descripción tiene varias categorías»): segunda etapa.
- Reglas automáticas de categorización y sugerencias por modelos de lenguaje o aprendizaje automático.
- Cambiar en bloque otros campos (fecha, descripción, reparto) o convertir en bloque repartos al 100 % en transferencias.
- Procesar más de un lote por petición o en segundo plano.

## Capabilities

### New Capabilities

- `recategorizacion-de-movimientos`: aplicar una categoría a muchos movimientos, auditarlo y deshacerlo, la selección sobre búsqueda y la clasificación rápida con sugerencias.

### Modified Capabilities

<!-- Ninguna capability vigente cambia: openspec/specs/ solo contiene landing-publica-homesuite y tip-diario. -->

## Impact

- `apps/app/migrations/`: dos tablas pequeñas (lotes de recategorización y sus movimientos) con la categoría anterior de cada uno.
- `apps/app/src/`: módulo de la operación y del deshacer, función pura de sugerencia, rutas de vista previa, aplicación y deshacer, pantalla de clasificar rápido, casillas de selección en la lista (`overview-ui.js`) y el script del navegador para los atajos.
- Pruebas unitarias de la sugerencia, integración D1 de la operación, la auditoría, el deshacer y los permisos, y E2E de la selección y del clasificador a 390 px y en escritorio.
- Depende de `categorias-del-libro` y de `importacion-como-movimientos` (para que los importados sean movimientos corregibles).
