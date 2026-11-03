## Why

La lista y la búsqueda de movimientos son lo que más se usa del libro, y con un historial real (unas 2.500 filas en 3,5 años, con ritmo creciente) muestran tres problemas medidos: cada búsqueda cuesta entre 90 y 390 ms de CPU porque normaliza todos los textos y formatea todos los importes en cada consulta; buscar el nombre de una persona devuelve todos los movimientos cuando hay dos personas, porque todos las involucran; y al guardar un movimiento se aterriza en la página de detalle en lugar de volver a la lista. Se decidió en el explore (D8, D9 y D10 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`) arreglar la búsqueda en JavaScript sin tocar la base, definir la búsqueda por persona con dos criterios y volver a la lista tras cada acción con un mensaje y una franja «Recién agregado».

Este cambio **reemplaza** el borrador `busqueda-movimientos-unificada`, escrito antes de ver el código y planteado sobre SQL e índices. Parte de su comportamiento (términos combinados, búsqueda en la nota y «Ver más») ya existe en el PR #90; aquí se formaliza y se completa.

## What Changes

- **Búsqueda más rápida sin cambiar su resultado**: se normalizan los textos una sola vez por petición y los importes solo se formatean cuando el término es numérico. El comportamiento actual de coincidencias se conserva y se protege con una prueba de equivalencia.
- **Buscar por persona con dos criterios**: «Pagó X» (con la marca de inferido cuando el pagador se dedujo en una importación) y «Participa X»; en transferencias, «Entregó X» y «Recibió X». Cuando la consulta coincide con el nombre de una persona se ofrecen dos filtros rápidos con su cantidad.
- **Términos combinados, búsqueda en la nota y «Ver más»** de a 40, con el contador «N de M».
- **Tras guardar, corregir o anular un movimiento** se vuelve a la lista con un mensaje y una franja transitoria «Recién agregado» arriba, que muestra el movimiento afectado aunque su fecha sea antigua.
- **Orden estable**: por fecha descendente y, dentro de una misma fecha, el cargado más recientemente primero.
- **Mediciones y disparadores**: una prueba de rendimiento con libros sintéticos y un aviso estructurado cuando abrir el libro supera 300 ms, que junto con el umbral de 5.000 movimientos decide cuándo pasar a SQL.

### Non-goals

- SQL, paginación por cursor o saldos agregados en la base: quedan diferidos hasta cumplirse un disparador medible.
- Filtros por fecha, por monto o por moneda, y ordenamientos alternativos.
- Búsqueda difusa o por similitud.
- Cambiar cómo se calculan los saldos.

## Capabilities

### New Capabilities

- `busqueda-movimientos`: el campo de búsqueda único, su normalización, los términos combinados, los criterios por persona y su rendimiento.
- `lista-de-movimientos`: el orden, «Ver más» y el regreso a la lista tras guardar, corregir o anular.

### Modified Capabilities

<!-- Ninguna capability vigente cambia: openspec/specs/ solo contiene landing-publica-homesuite y tip-diario. -->

## Impact

- `apps/app/src/`: `ledger-ui.js` (`searchLedger`), `overview-ui.js` (lista, filtros rápidos, franja), `index.js` (redirecciones tras guardar, corregir y anular, y el aviso de lentitud), `client.js` (la respuesta JSON del guardado optimista) y `ledger.js` (orden).
- Pruebas unitarias de equivalencia y de propiedades de la búsqueda, una prueba de rendimiento, pruebas de integración de las redirecciones y E2E del regreso a la lista. Cambia el comportamiento que fijan dos E2E existentes (registrar, corregir y anular, y la de diseño).
- Sin migraciones ni cambios de esquema.
- Depende de la cadena #68 → #71 → #75 → #76 → #81 y los PR #88 → #89 → #90, y se coordina con `importacion-como-movimientos` para la marca de inferido.
- Hay que **eliminar** el borrador `busqueda-movimientos-unificada` cuando este cambio se apruebe.
