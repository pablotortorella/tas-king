## Context

- `readLedger` carga todo el libro en memoria (movimientos, partes, asignaciones) y `searchLedger` filtra con JavaScript. Con el libro cargado se puede resolver «todos los resultados de una búsqueda» en el servidor con el mismo código que usa la lista.
- Cada movimiento corregido crea una revisión inmutable (`entry_revisions`, con triggers que impiden modificar o borrar) y sube `current_revision`. El libro tiene su propia `revision`, que sube con cada escritura.
- La ruta de movimientos usa `idempotency_keys` y `expectedRevision` por movimiento. El cuerpo de una mutación está limitado a 16 KiB.
- La CSP no admite scripts en línea: los atajos de teclado son un script servido por la propia aplicación.
- Con `categorias-del-libro` cada movimiento tiene `category_id` y su revisión guarda `categoryId`; con `importacion-como-movimientos` los importados son movimientos normales, así que no hay un caso especial.

Ver `proposal.md` y `specs/recategorizacion-de-movimientos/spec.md`. Decisión de origen: D12 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`.

## Goals / Non-Goals

**Goals:**

- Una sola operación de fondo que sirva a las dos pantallas y a futuros disparadores (asistente de consistencia, reglas).
- Auditoría completa por movimiento y deshacer seguro por lote.
- Que un error de selección se pueda revertir sin pedir ayuda.

**Non-Goals:**

- Cambiar otros campos en bloque.
- Aprendizaje automático o reglas persistentes.
- Procesamiento fuera de la petición.

## Decisions

### D1. Dos pasos: vista previa y confirmación, con el conjunto resuelto en el servidor

La vista previa recibe el criterio (ids explícitos, o la búsqueda y los filtros vigentes) y la categoría destino, resuelve el conjunto con el mismo código de búsqueda de la lista, y devuelve cantidad, muestra, omitidos (anulados y sin permiso) y la revisión actual del libro. La confirmación reenvía el criterio con esa revisión; si el libro cambió, responde con conflicto.

- **Por qué.** Mandar miles de identificadores desde el navegador excede el límite de 16 KiB y es frágil. Resolver en el servidor con el criterio permite «todos los resultados» sin límite de tamaño de la petición, y la revisión del libro evita que el conjunto confirmado difiera del que se vio.
- **Alternativa.** Un token firmado con los identificadores: descartada, porque con cientos de movimientos el token excede los límites razonables de un campo de formulario.

### D2. Tablas de lote y de elementos

`recategorization_batches(ledger_id, id, actor_user_id, kind, category_id, changed, skipped, created_at, undone_at, undo_of)` y `recategorization_items(ledger_id, batch_id, entry_id, revision, previous_category_id)`. `kind` es `bulk`, `quick` o `undo`.

- **Por qué.** Deshacer necesita la categoría anterior de cada movimiento. Guardarla en una tabla acotada por lote evita recorrer el JSON de todas las revisiones para encontrarla. La instantánea de la revisión conserva también el lote para que el historial lo muestre.

### D3. Escritura: tandas de 100 con tres sentencias sobre JSON

Para el conjunto resuelto, el servidor escribe por tandas de 100 movimientos, cada una en un `db.batch` con tres sentencias que leen un JSON con `json_each`: las revisiones (instantánea completa con la categoría nueva y el identificador de lote), un `UPDATE` por categoría de destino y los elementos del lote. Antes se inserta el lote, y al final se cierra con el evento del libro y la subida de su revisión. El límite de 1.000 movimientos mantiene el total en unas 35 sentencias (diez tandas).

- **Guardas.** La revisión solo se inserta si el movimiento sigue en la revisión que se vio, y el `UPDATE` solo toca los movimientos que ya tienen nuestra revisión como la siguiente, así que una corrección concurrente simplemente deja afuera a ese movimiento. El `UPDATE` busca por clave primaria (no recorre el JSON por cada fila del libro: así bajó de ~4 s a ~50 ms para 1.000).
- **Idempotencia.** La clave de la confirmación es el identificador del lote y el lote guarda una huella del criterio y la categoría: repetir la misma solicitud devuelve el lote (o lo completa si se cortó); la misma clave con otros datos se rechaza con 409.
- **Límites que no se verificaron:** tamaño de la sentencia con 100 movimientos (unos 68 KB) y cantidad de sentencias por lote. Las constantes son ajustables.

### D4. Deshacer solo lo que no se modificó después

Deshacer lee los elementos del lote y, para cada movimiento cuya revisión vigente sigue siendo la del lote, restaura `previous_category_id` con una revisión nueva y un lote de tipo `undo` que referencia al original. Los movimientos con revisiones posteriores quedan intactos y se informan. `undone_at` impide deshacer dos veces.

- **Por qué.** No pisar ediciones posteriores: una corrección de importe hecha después de recategorizar no debe perderse por deshacer.

### D5. Permisos

La persona titular puede recategorizar cualquier movimiento vigente; un integrante solo los suyos, coherente con corregir. El resto del conjunto se omite y se cuenta. Deshacer lo puede hacer quien aplicó el lote o la persona titular.

### D6. Selección en la lista

La lista suma casillas de verificación dentro de un formulario con CSRF, sin script obligatorio, y una acción «seleccionar todos los N resultados» que envía el criterio actual (búsqueda y filtros) en lugar de los identificadores. Con script, una barra fija muestra la cantidad seleccionada y el selector de categoría; sin script, el formulario sigue funcionando en una pantalla de confirmación.

### D7. Clasificar rápido

Una pantalla muestra el primer pendiente según un orden estable (fecha descendente), con su categoría sugerida, las categorías recientes y el selector completo. Cada asignación es una operación de un solo movimiento, de tipo `quick`, que se puede deshacer con el mismo mecanismo. «Saltar» guarda el identificador en la URL de la pantalla y no modifica nada, y los saltados vuelven al final. Los atajos son: un número para cada categoría mostrada, Enter para aceptar la sugerida, S para saltar y U para deshacer la última. El script se sirve como módulo propio.

### D8. La sugerencia es una función pura y conservadora

`suggestCategory(entry, categorized)` toma las palabras significativas de la descripción (sin conectores ni números), suma los votos de cada categoría entre los movimientos categorizados que comparten alguna, y sugiere solo si hay al menos dos votos y una categoría reúne el 70 % o más. En el export real de referencia, sobre filas ya categorizadas esa regla sugirió en el 55 % de los casos y acertó el 94 % de las veces que sugirió; sobre las filas con la categoría genérica solo pudo sugerir en el 22 %, porque suelen tener descripciones únicas. Se muestra la causa («aparece en 5 movimientos de Mascotas»).

- **Alternativas.** Un modelo de aprendizaje automático o de lenguaje: descartada, porque agrega dependencias, costos y opacidad, y la regla simple ya acierta casi siempre cuando opina. Sugerir siempre la categoría más votada: descartada, porque baja la precisión y entrena a la persona a aceptar sin mirar.

### D9. Qué se considera pendiente

Un movimiento sin categoría o con la categoría del grupo «Sin categoría». Los anulados no cuentan.

## Risks / Trade-offs

- **Una operación grande agota límites de D1** → Límite de 1.000 movimientos con mensaje claro; constantes ajustables; una prueba de escala con D1 local mide tiempo y sentencias.
- **Se recategoriza con un conjunto equivocado** → Vista previa con cantidad y muestra, confirmación, y deshacer por lote.
- **Dos personas operan al mismo tiempo** → La revisión del libro hace fallar la confirmación; la persona vuelve a previsualizar.
- **El deshacer pisa una corrección posterior** → Solo se restauran los movimientos cuya revisión vigente es la del lote.
- **La sugerencia induce errores** → Es conservadora, muestra su causa y nunca se aplica sola; el selector completo siempre está a un toque.
- **El historial de cada movimiento se llena de revisiones de categoría** → Es el costo de la auditoría por movimiento; el historial las rotula y las agrupa por lote.

## Migration Plan

La migración es aditiva (dos tablas nuevas). No toca datos. Se aplica con la cadena operativa (respaldo, migración, Worker). La reversión consiste en volver al código anterior: las tablas quedan sin uso. Las revisiones de categoría creadas son válidas para el código anterior, que las muestra como correcciones comunes.

## Open Questions

- La cantidad de categorías recientes que se muestran en el clasificador y sus atajos numéricos: se ajusta con el uso, sin cambiar los requisitos.
- Si la barra de selección va fija arriba o abajo en el teléfono: decisión visual.
