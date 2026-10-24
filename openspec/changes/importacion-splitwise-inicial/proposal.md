## Why

El objetivo de Cuentas Claras es que una persona deje Splitwise sin perder su
historia ni la confianza en sus saldos (`docs/HOMESUITE_CUENTAS_CLARAS_JOURNEY.md`).
Con `libro-y-saldos-cuentas-claras` el libro puede registrar movimientos nuevos,
pero un grupo real llega con años de historia. Este change cubre las historias
HG-03, HG-04 y HG-05 del backlog y la elección del punto de partida del libro.

Referencia visual: lienzo «Cuentas Claras» de Claude Design, pantallas 2
(punto de partida) y 3 (importar desde Splitwise).

## What Changes

- Al terminar de crear un grupo, la persona elige cómo empezar: traer movimientos
  de Splitwise o empezar en cero (saldo 0 en cada moneda, sin asiento de apertura).
- Importar un CSV con el formato de exportación de Splitwise: primero una
  previsualización que no escribe nada (participantes, filas de movimiento, fila
  de resumen, conteos y saldos previstos por moneda).
- Mapeo explícito de las personas del archivo con participantes del libro.
- Cada incidente muestra el número de fila original y su motivo, y se resuelve
  cancelando, con un supuesto explícito o excluyendo la fila.
- Se incorporan todas las líneas válidas con su efecto exacto en el saldo. Dudas
  sobre quién pagó o cómo se repartió no son un incidente.
- Conciliación por persona y moneda contra los saldos del origen, sin asientos
  ocultos; una diferencia global sin fila atribuible se muestra tal cual.
- Procedencia visible por movimiento y por lote; reintentos y recargas del mismo
  archivo no duplican dinero.

### Non-goals

- Saldos de apertura distintos de cero y la fecha de corte para combinarlos con
  una importación parcial. La opción «saldos anteriores» del lienzo no se ofrece
  hasta su propio change.
- Importaciones incrementales o desde otras plataformas; conexión por API.
- Búsqueda del historial (`busqueda-movimientos-unificada`).
- Clasificar filas como préstamo, adelanto o pago a partir de su texto.
- Usar exports reales en el repositorio, fixtures, seeds o bases de desarrollo.

## Capabilities

### Added Capabilities

- `punto-de-partida-del-libro`: elegir cómo empieza un libro nuevo.
- `importacion-splitwise`: previsualización, mapeo, incidentes, conciliación,
  procedencia e idempotencia de la importación.

## Impact

- `apps/app/`: parser de CSV, tablas de lote y filas, rutas de importación,
  pantallas de punto de partida e importación.
- Depende de `libro-y-saldos-cuentas-claras`. Introduce un efecto por participante
  como fuente canónica de los movimientos importados y obliga a que los saldos de
  todo movimiento se calculen desde ese efecto (ver `design.md`, D2).
- Fixture sintético existente: `test/fixtures/splitwise-export-example.csv`.
- Sin cambios en TasKing ni `apps/site/`.
