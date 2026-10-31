## Why

Hoy un movimiento importado de Splitwise es de segunda clase: se guarda como un efecto por persona, sin pagador ni reparto, no se puede corregir ni anular, no tiene revisiones ni categoría, y la importación completa se ejecuta en una sola petición con unos 230 lotes de escritura seguidos (para un archivo de unas 2.500 filas) que, si falla a mitad, depende de una limpieza posterior. Se decidió en el explore (D1, D2, D4 a D7 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`) que un movimiento importado sea **equivalente a uno cargado en la aplicación**, para poder corregirlo, anularlo y categorizarlo como cualquier otro, y que la importación sea por etapas, reanudable y de publicación atómica. Con un export real de referencia, las 2.485 filas se convierten en gastos normales con exactamente los mismos efectos.

Este cambio **reemplaza** el borrador `importacion-splitwise-inicial`, escrito antes de ver el código y cuyo principio («el efecto firmado es el único dato») queda sin efecto.

## What Changes

- **Cada fila válida del archivo se convierte en un gasto normal**: con pagadores, reparto, revisión inicial, anulación, corrección y categoría. Los pagadores y el reparto se **infieren** de los efectos, se marcan como **inferidos** y son editables. El efecto original queda exacto por construcción y la fila cruda se conserva como auditoría de origen.
- La importación pasa a ser **por etapas**: tras confirmar, se carga por tandas con progreso, se puede **reanudar** si se corta, los movimientos permanecen **ocultos** hasta una **publicación atómica** final, y cancelar o abandonar limpia lo cargado.
- La vista previa se guarda **por fila** y no como un único bloque, así que desaparece el techo de tamaño de la previsualización y la revisión puede paginar.
- La **fila de resumen** del export real (fecha en la primera celda) nunca se importa como movimiento y alimenta la conciliación. El arreglo del reconocimiento se entrega aparte (PR #92); este cambio lo vuelve requisito.
- El texto de **comentarios** que traiga un export se importa como **nota** del movimiento.
- **Punto de partida del grupo**: el formulario de creación incluye «Cómo querés empezar» (en cero, traer de Splitwise o, deshabilitado, saldos anteriores), y el libro vacío muestra un botón grande para el primer movimiento y la opción de traer el historial.
- **BREAKING** (interno): se retiran las tablas de importación `splitwise_import_entries` y `splitwise_import_effects` y la rama especial de movimientos importados en `readLedger` y en las vistas. Los lotes importados con el modelo anterior, que solo existen en entornos de desarrollo y staging, se convierten con la misma función de inferencia o se descartan.

### Non-goals

- Reimportación incremental de un export más nuevo del mismo grupo (se mantiene un lote confirmado por libro).
- Importar desde otras plataformas o por API.
- Clasificar filas como préstamo o pago a partir de su texto; la conversión en bloque de repartos al 100 % en transferencias es posterior.
- Saldos de apertura distintos de cero.
- Procesamiento en segundo plano fuera de la petición (colas o cron de carga).

## Capabilities

### New Capabilities

- `importacion-splitwise`: previsualización, mapeo de personas, conversión de filas en movimientos normales con campos inferidos, incidentes, conciliación, procedencia, carga por etapas con publicación atómica e idempotencia.
- `punto-de-partida-del-libro`: cómo elige su inicio un grupo nuevo y cómo se presenta un libro vacío.

### Modified Capabilities

<!-- Ninguna capability vigente cambia: openspec/specs/ solo contiene landing-publica-homesuite y tip-diario. -->

## Impact

- `apps/app/migrations/`: migraciones nuevas (columnas de procedencia e inferencia en los movimientos, tabla de filas crudas de origen, tabla de filas de la vista previa y retiro de las tablas de importación anteriores).
- `apps/app/src/`: `splitwise-import.js` (reescritura por etapas), módulo nuevo de inferencia, `ledger.js` (visibilidad por lote publicado y fin de la rama de importados), `ledger-ui.js`, `overview-ui.js`, `splitwise-ui.js` (pantalla de progreso), `index.js` (rutas de carga, publicación y cancelación; formulario de creación), `maintenance.js` (limpieza de lotes abandonados) y la exportación.
- Pruebas de propiedades de la inferencia, integración D1 de las etapas, la publicación atómica, la reanudación y el solapamiento, y E2E del recorrido completo con un CSV sintético de la forma real.
- Depende de `repartos-del-libro` (método y datos de reparto en la revisión) y de `categorias-del-libro` (categoría por identificador y categorías pendientes de publicar), y de la cadena #68 → #71 → #75 → #76 → #81 y los PR #88 → #89 → #90 y #92.
- Hay que **eliminar** el borrador `importacion-splitwise-inicial` cuando este cambio se apruebe.
