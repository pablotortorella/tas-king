## Purpose

Define cómo se cambia la categoría de muchos movimientos de un libro a la vez, cómo se audita y se deshace, y las dos formas de hacerlo: seleccionando sobre una búsqueda y clasificando de a uno con sugerencias.

## ADDED Requirements

### Requirement: Se puede aplicar una categoría a un conjunto de movimientos

El sistema SHALL permitir aplicar una categoría del libro a un conjunto de movimientos elegido de forma explícita o como todos los resultados de la búsqueda o el filtro vigentes. Antes de aplicar, SHALL mostrar cuántos movimientos cambiarían y una muestra de ellos, y SHALL exigir una confirmación. Una operación SHALL afectar como máximo 1.000 movimientos; si el conjunto es mayor, SHALL informar el límite y cuántos quedan.

#### Scenario: Aplicar a los resultados de una búsqueda

- **WHEN** la persona busca «Carulla», selecciona todos los resultados y elige «Alimentos»
- **THEN** ve que cambiarán 40 movimientos con una muestra, y tras confirmar todos pasan a «Alimentos»

#### Scenario: Seleccionar más de lo que muestra la pantalla

- **WHEN** la lista muestra 40 de 160 resultados y la persona selecciona todos los resultados
- **THEN** la operación incluye los 160 y no solo los 40 visibles

#### Scenario: Conjunto mayor que el límite

- **WHEN** el conjunto supera 1.000 movimientos
- **THEN** se rechaza con un mensaje que indica el límite por operación y cuántos movimientos quedan para repetirla

#### Scenario: Cancelar antes de confirmar

- **WHEN** la persona cancela en la pantalla de confirmación
- **THEN** ningún movimiento cambia

### Requirement: La operación respeta permisos, anulados y el estado del libro

La persona titular SHALL poder recategorizar cualquier movimiento vigente. Un integrante SHALL poder recategorizar solo los movimientos que creó; los demás del conjunto SHALL quedar fuera y SHALL informarse. Los movimientos anulados NO SHALL recategorizarse. Un libro archivado SHALL rechazar la operación.

#### Scenario: Un integrante con resultados de otras personas

- **WHEN** un integrante aplica una categoría a resultados que incluyen movimientos de otra persona
- **THEN** cambian solo los suyos y se informa cuántos quedaron fuera

#### Scenario: Movimientos anulados

- **WHEN** el conjunto incluye movimientos anulados
- **THEN** no cambian y se informa cuántos se omitieron

#### Scenario: Libro archivado

- **WHEN** se intenta recategorizar en un libro archivado
- **THEN** el servidor lo rechaza con un error explícito

### Requirement: La operación detecta que el libro cambió

Entre la vista previa y la confirmación, si el libro recibió otras escrituras, el sistema SHALL rechazar la confirmación y pedir que se vuelva a previsualizar, sin aplicar cambios parciales.

#### Scenario: Otro integrante carga un movimiento

- **WHEN** entre la vista previa y la confirmación otra persona agrega un movimiento
- **THEN** la confirmación se rechaza con un conflicto y no cambia ningún movimiento

### Requirement: Cada recategorización queda auditada

Cada movimiento cuya categoría cambia SHALL recibir una revisión que indique que cambió la categoría. La operación SHALL registrarse con su autor, fecha, categoría destino, cantidad de movimientos cambiados y omitidos, y un identificador de lote. Aplicar dos veces la misma confirmación SHALL producir un único cambio.

#### Scenario: Historial de un movimiento

- **WHEN** se abre un movimiento recategorizado
- **THEN** su historial muestra una revisión «Cambió: categoría» con su autor y su fecha

#### Scenario: Registro de la operación

- **WHEN** termina una recategorización
- **THEN** queda registrada con autor, fecha, categoría destino, cantidad cambiada y omitida y su identificador de lote

#### Scenario: Confirmación repetida

- **WHEN** la misma confirmación se envía dos veces por una falla de conexión
- **THEN** los movimientos cambian una sola vez y existe un único lote

### Requirement: Un lote se puede deshacer completo

La persona que lo aplicó y la persona titular SHALL poder deshacer un lote: cada movimiento SHALL volver a la categoría que tenía antes, salvo los que se hayan modificado después del lote, que SHALL quedar intactos e informarse. Deshacer SHALL crear nuevas revisiones y registrarse como una operación propia, sin borrar el historial.

#### Scenario: Deshacer un lote sin cambios posteriores

- **WHEN** se deshace un lote de 300 movimientos que nadie volvió a tocar
- **THEN** los 300 vuelven a su categoría anterior y quedan revisiones nuevas que lo registran

#### Scenario: Movimientos modificados después

- **WHEN** 5 de los movimientos del lote se corrigieron después
- **THEN** se deshacen los demás, esos 5 quedan como están y se informa cuáles

#### Scenario: Deshacer dos veces

- **WHEN** se intenta deshacer un lote que ya se deshizo
- **THEN** el servidor lo rechaza e indica que ya estaba deshecho

### Requirement: Clasificar rápido recorre los movimientos pendientes

El sistema SHALL ofrecer una pantalla que muestre un movimiento pendiente por vez y permita asignarle una categoría con el teclado o con el toque, saltarlo, deshacer la última asignación y ver cuántos pendientes quedan. Un movimiento SHALL considerarse pendiente cuando no tiene categoría o tiene la del grupo «Sin categoría». La pantalla SHALL poder usarse con teclado y en el teléfono.

#### Scenario: Asignar y avanzar

- **WHEN** la persona asigna una categoría al movimiento que ve
- **THEN** se guarda, el contador de pendientes baja en uno y aparece el siguiente

#### Scenario: Saltar

- **WHEN** la persona salta un movimiento
- **THEN** no cambia y se muestra el siguiente, y el saltado vuelve a ofrecerse más adelante

#### Scenario: Deshacer lo último

- **WHEN** la persona deshace la última asignación
- **THEN** ese movimiento vuelve a su categoría anterior y se muestra de nuevo

#### Scenario: No quedan pendientes

- **WHEN** no quedan movimientos pendientes
- **THEN** la pantalla lo informa y ofrece volver al libro

### Requirement: Las sugerencias ayudan pero nunca se aplican solas

Cuando la descripción de un movimiento comparte palabras con movimientos ya categorizados y una categoría domina con claridad entre ellos, la pantalla de clasificar rápido SHALL mostrarla como sugerida junto con la causa. Una sugerencia SHALL requerir una acción de la persona para aplicarse. El sistema NO SHALL sugerir cuando no haya evidencia suficiente.

#### Scenario: Descripción conocida

- **WHEN** la descripción comparte una palabra con 5 movimientos de «Mascotas» y con ninguno de otra categoría
- **THEN** se muestra «Mascotas» como sugerida y se aplica solo si la persona la acepta

#### Scenario: Sin evidencia

- **WHEN** ninguna palabra de la descripción aparece en movimientos categorizados
- **THEN** no se muestra sugerencia y se ofrecen las categorías recientes y el selector completo

#### Scenario: Evidencia dividida

- **WHEN** las palabras de la descripción aparecen en movimientos de dos categorías sin que una domine
- **THEN** no se sugiere ninguna
