## Context

Estado actual, leído en `splitwise-import.js`, `ledger.js`, `maintenance.js` y la migración `0005`:

- La vista previa guarda todo el CSV parseado en una sola fila (`splitwise_import_previews.parsed_json`, con vencimiento a la hora). Un export real de unas 2.500 filas pesa unos 650 KB parseado.
- `commitImportPreview` escribe todo en una petición: un `db.batch` de configuración, luego tandas de unas 60 sentencias seguidas y un lote final. Para ese archivo son unas 7.500 sentencias hoy y serían unas 14.000 con el modelo nuevo.
- Los importados viven en `splitwise_import_entries` (con `category` en texto) y `splitwise_import_effects`; `readLedger` los une en memoria con una rama especial (`imported: true`) que las vistas y la búsqueda tratan aparte. No tienen revisiones, no se corrigen ni se anulan.
- Hay un índice único que admite un solo lote publicado por libro, una huella única por (libro, archivo), personas nuevas ocultas con `pending_import_batch_id` y limpieza de lotes abandonados en el cron diario (`runMaintenance`).
- `assertNoOverlap` rechaza archivos con fechas desde el primer movimiento propio.

Ver `proposal.md` para el motivo y los specs `importacion-splitwise` y `punto-de-partida-del-libro` para el comportamiento exigido.

## Goals / Non-Goals

**Goals:**

- Un solo camino de datos: lo importado es lo mismo que lo cargado, salvo su procedencia.
- Una importación que no dependa de una petición larga, que se pueda reanudar y que el libro nunca vea a medias.
- Conservar la exactitud de los efectos y poder demostrarlo con pruebas.

**Non-Goals:**

- Procesamiento fuera de la petición (colas, Durable Objects o cron de carga).
- Reimportación incremental y otras fuentes.
- Rediseñar el formulario de movimientos (lo hacen `repartos-del-libro` y `categorias-del-libro`).

## Decisions

### D1. La inferencia es una función pura y verificada

`inferComponents({ totalMinor, effects })` devuelve `{ cashParties, allocations }` para un gasto, o un motivo de rechazo. Regla: pagan quienes tienen efecto positivo; cada pagador paga su efecto más su parte propia, y las partes propias suman el total menos la suma de los efectos positivos (en proporción al efecto, con el residuo en el último); quienes quedan en contra deben su efecto; sin efecto en nadie, paga y consume una misma persona. Si la suma de los efectos positivos supera el total, la fila no es representable.

- **Por qué.** Con un export real todas las filas se convierten sin pérdida, comprobado con el validador de la aplicación. La función pura permite una prueba de propiedades: para cualquier vector de efectos válido, los efectos que resultan de la descomposición son idénticos a los del archivo.
- **Alternativa.** Importar solo el efecto y mostrar el pagador como inferencia (el modelo anterior): descartada, porque deja a los importados sin corrección ni anulación y obliga a mantener dos caminos.

### D2. Columnas de procedencia en `ledger_entries` y visibilidad por lote publicado

`ledger_entries` suma `import_batch_id` (nulo para los propios), `source_row_number` e `inferred` (0 o 1). `readLedger` y toda consulta de movimientos incluyen solo los movimientos propios o los de lotes publicados (`import_batch_id IS NULL OR` el lote está publicado). Un índice por `(ledger_id, import_batch_id)` acota la unión.

- **Por qué.** Ocultar con una condición de lectura permite cargar con calma y publicar con una sola escritura. La alternativa de agregar un estado `pending` al movimiento exige reconstruir la tabla porque SQLite no permite modificar una restricción `CHECK`.
- **Riesgo.** Hay que garantizar que ninguna consulta se olvide de la condición. Una prueba de integración recorre libro, saldos, búsqueda, exportación y detalle con un lote pendiente y exige que no aparezca nada.

### D3. Vista previa por fila y estado de la importación en el lote

- `splitwise_import_previews` conserva los metadatos (huella, nombre, nombres de las personas, revisión) y deja de guardar `parsed_json`.
- Una tabla nueva de filas de la vista previa guarda, por fila, su tipo (movimiento, incidente o resumen) y su contenido, indexada por `(preview_id, line)`. La revisión pagina por rango de líneas.
- **Por qué.** Quita el techo de unas 7.600 filas de una fila única de D1 (límite recordado de 2 MB, no verificado) y permite revisar sin cargar todo.
- **Vencimiento.** La vista previa vence a la hora, como hoy; al confirmar, las filas de la vista previa quedan asociadas al lote hasta que se publica, y se borran con él.

### D4. Carga por tandas, dirigida por el cliente

Al confirmar se crea el lote en estado pendiente, con las personas y las categorías nuevas ocultas. Luego `POST` repetidos a una ruta de carga procesan cada uno una tanda de filas (del orden de 250, ajustable) y devuelven el progreso. La pantalla de progreso los encadena con un script y, sin script, ofrece un botón «Continuar» que hace lo mismo.

- **Por qué.** Acota cada petición (unas 20 a 30 llamadas a D1, bien por debajo de los límites de subconsultas que se recuerdan, no verificados), hace visible el avance y deja reanudar sin estado adicional: el lote sabe hasta qué fila llegó.
- **Alternativas.** Una sola petición como hoy: descartada por el tiempo y el riesgo de corte. Cola o Durable Object: descartada por el alcance (infraestructura nueva); queda abierta si una medición real lo exige.

### D5. Idempotencia por fila

Cada movimiento importado tiene un identificador derivado del lote y de la fila, y las inserciones usan `INSERT OR IGNORE`, además de la unicidad `(lote, número de fila)` de la tabla de filas de origen. Reintentar una tanda, o ejecutar dos al mismo tiempo, no duplica nada.

### D6. Publicación atómica y descarte

Terminada la última tanda, un único `db.batch` marca el lote como publicado, activa las personas y las categorías nuevas, registra el evento del libro y sube la revisión del libro. Cancelar, fallar sin remedio o superar un día sin avanzar borra el lote, sus movimientos, partes, revisiones, filas de origen, personas y categorías pendientes con la misma rutina, que usan el botón de cancelar y el cron diario (`runMaintenance`).

### D7. Procedencia y fila cruda

Una tabla de filas de origen `(ledger_id, entry_id, batch_id, source_row_number, raw_json)` conserva la fila cruda como auditoría. El movimiento guarda además `import_batch_id` y `source_row_number` para mostrar «Importado de Splitwise · fila N» sin unir esa tabla. El lote conserva supuestos, exclusiones y conciliación, como hoy.

### D8. Inferido: marca y ciclo de vida

`inferred = 1` en todo movimiento importado. Una corrección que cambia el pagador o el reparto lo pasa a 0. La marca se muestra en el detalle y como insignia en la coincidencia de búsqueda por pagador; no afecta a los saldos.

### D9. Categorías y personas nuevas, ocultas hasta publicar

Las categorías que el archivo traiga y no existan en el libro se crean con `pending_import_batch_id` (columna que agrega este cambio a `ledger_categories`) y se reconocen por nombre normalizado. Quedan ocultas hasta la publicación, igual que las personas nuevas.

### D10. Conciliación en el momento de importar

La conciliación sigue calculándose contra los efectos del archivo antes de confirmar y se guarda con el lote. No se recalcula tras correcciones posteriores: el historial de cada movimiento explica el cambio.

### D11. Solapamiento

`assertNoOverlap` se mantiene, pero considera movimientos propios solo los que tienen `import_batch_id` nulo. Así un libro con un lote publicado puede recibir movimientos nuevos, y el solapamiento se evalúa antes de empezar a cargar.

### D12. Punto de partida

El formulario de creación suma la elección con las tres opciones y una redirección condicional: la opción por defecto lleva al libro, como hoy, y «Traer de Splitwise» lleva a la importación. El libro vacío agrega el botón destacado y la opción de importar, que dejan de mostrarse al existir el primer movimiento. No hay pantalla intermedia, así que las pruebas actuales que crean un grupo siguen pasando.

### D13. Datos de importaciones anteriores

El retiro de `splitwise_import_entries` y `splitwise_import_effects` va en una migración posterior a una verificación: contar los lotes publicados del modelo anterior en desarrollo y staging. Si hay, se convierten con `inferComponents` mediante un script de una sola vez y se verifican saldos antes y después; si no hay, se retiran las tablas. Los datos financieros reales siguen bloqueados en producción, así que no hay historia real que migrar.

### D14. Exportación

La exportación JSON sube de versión de esquema: los movimientos importados son movimientos normales con su procedencia, y los lotes incluyen la conciliación y las filas de origen. El CSV marca el origen «Splitwise» por movimiento, como hoy.

## Risks / Trade-offs

- **Más escrituras por fila** (de unas 3 a unas 5 o 6) → La carga por tandas acota cada petición; el tiempo total se mide con un CSV sintético de 2.500 filas antes de aplicar.
- **Los límites de D1 y Workers (sentencias por lote, subconsultas, tamaño de fila) no están verificados** → Los tamaños de tanda y de lote son constantes; una prueba de escala mide con D1 local y deja registrados los números.
- **Una consulta olvida filtrar por lote publicado y muestra datos a medias** → La condición vive en un solo lugar de lectura y una prueba de integración recorre todas las vistas con un lote pendiente.
- **La inferencia decide mal un pagador** → Se marca como inferido y es corregible; el efecto original no cambia nunca, por construcción y por propiedad.
- **Tandas concurrentes (dos pestañas)** → Los identificadores determinísticos y `INSERT OR IGNORE` las vuelven seguras; el progreso se calcula desde lo cargado y no desde un contador.
- **Un lote abandonado bloquea al libro** → El cron lo descarta al día y la persona titular puede cancelarlo; no se admite otra importación mientras hay un lote pendiente propio.
- **Los lotes del modelo anterior** → Verificación previa y conversión o retiro (D13).

## Migration Plan

1. Respaldo del estado actual (cadena operativa ya fijada).
2. Migración aditiva: columnas de procedencia e inferencia, tabla de filas de origen, tabla de filas de la vista previa y columna de categorías pendientes. No toca datos.
3. Desplegar el código: la importación nueva escribe movimientos normales; la lectura sigue mostrando los lotes antiguos mientras existan.
4. Verificar y convertir o descartar los lotes antiguos; migración final que retira las tablas anteriores y la rama especial de lectura.
5. Reversión previa al paso 4: el código anterior ignora las columnas nuevas. Tras el paso 4 se revierte desde el respaldo.

## Notas de implementación

Ajustes que salieron al aplicar el cambio, sin cambiar los requisitos:

- La vista previa conserva `parsed_json`, pero ahora guarda solo metadatos (nombres, distribución de columnas, conteos); las filas viven en `splitwise_import_rows`, cuyo `owner_id` pasa de la vista previa al lote al confirmar con una sola sentencia.
- La carga escribe cinco sentencias por tanda (movimientos, revisiones, pagadores, reparto y filas de origen), cada una sobre un JSON con `json_each`, y publica con seis sentencias en un único lote. La publicación usa una marca (`publish_token`) para que, si dos peticiones llegan a la vez, solo la que cambió el estado escriba el evento y suba la revisión del libro.
- Las revisiones siguen siendo inmutables, salvo las de movimientos de un lote pendiente: el disparador que impedía borrarlas se recreó con esa excepción para poder descartar una carga cancelada o abandonada.
- Una fila sin efecto en nadie se guarda como gasto de la primera persona del archivo (determinista) y queda marcada como inferida.
- Si el archivo trae columnas de notas (`Notas`, `Comentarios`, `Notes`, `Comments`) después de las personas, su texto se importa como nota del movimiento; no cuentan como personas.
- El mantenimiento descarta una carga pendiente a partir del último movimiento cargado (o de la creación del lote si no cargó ninguno), no de la fecha de creación.
- `splitwise-legacy.js` convierte los lotes del modelo anterior y borra sus filas; la corre el mantenimiento diario mientras las tablas existan. El retiro de las tablas viejas **no** va como migración de este despliegue (la regla de expansión, transición y retiro lo prohíbe): queda en `apps/app/ops/retire-legacy-import-tables.sql`, con su guarda que se detiene si queda algún lote, para aplicarlo en un release posterior, ya verificado el Worker nuevo. Ese módulo, su prueba y el SQL se eliminan después.

## Open Questions

- El tamaño exacto de la tanda y el tamaño de cada lote de sentencias: se fijan midiendo con D1 local en la tarea de escala, sin cambiar el enfoque.
- Los textos de la pantalla de progreso y de los mensajes de cancelación.
