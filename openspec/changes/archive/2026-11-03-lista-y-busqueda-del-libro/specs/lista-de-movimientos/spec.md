## Purpose

Define cómo se ordena la lista de movimientos de un libro, cómo se pagina y qué ve la persona al volver a ella tras guardar, corregir o anular un movimiento.

## ADDED Requirements

### Requirement: La lista se ordena por fecha y por carga

La lista SHALL ordenar los movimientos por fecha descendente y, dentro de una misma fecha, el movimiento cargado más recientemente SHALL aparecer primero.

#### Scenario: Dos movimientos del mismo día

- **WHEN** se cargan dos movimientos con la misma fecha, uno después del otro
- **THEN** el segundo aparece antes que el primero en la lista

### Requirement: La lista se pagina con «Ver más»

La lista SHALL mostrar los primeros 40 resultados y ofrecer «Ver N movimientos más» para el siguiente tramo, conservando la búsqueda y los filtros. El conteo total SHALL mostrarse siempre.

#### Scenario: Más de 40 movimientos

- **WHEN** el libro tiene 95 movimientos
- **THEN** se muestran 40 con el conteo total y el botón «Ver 40 movimientos más»

#### Scenario: Conservar la búsqueda

- **WHEN** la persona pide ver más resultados de una búsqueda
- **THEN** se muestran los siguientes sin perder el texto buscado ni los filtros

### Requirement: Tras guardar, corregir o anular se vuelve a la lista

Después de guardar un movimiento nuevo, de corregirlo o de anularlo, el sistema SHALL volver a la lista del libro con un mensaje de éxito, en lugar de ir a la página del movimiento. Encima de la lista SHALL aparecer una franja transitoria «Recién agregado» (o «Recién corregido» o «Recién anulado») con el movimiento afectado, aunque su fecha sea antigua y no esté entre los primeros de la lista. La lista SHALL conservar su orden por fecha. La franja NO SHALL mostrarse al volver a abrir la lista más tarde.

#### Scenario: Guardar un movimiento de fecha antigua

- **WHEN** la persona guarda un movimiento con fecha de la semana pasada
- **THEN** vuelve a la lista con el mensaje y la franja «Recién agregado» arriba, y el movimiento también aparece en su lugar por fecha

#### Scenario: Corregir

- **WHEN** la persona corrige un movimiento
- **THEN** vuelve a la lista con el mensaje «Movimiento corregido» y la franja con el movimiento actualizado

#### Scenario: Anular

- **WHEN** la persona anula un movimiento
- **THEN** vuelve a la lista con el mensaje «Movimiento anulado» y la franja con el movimiento tachado

#### Scenario: Volver a abrir la lista

- **WHEN** la persona abre la lista otra vez sin haber hecho una acción reciente
- **THEN** no se muestra la franja ni el mensaje

#### Scenario: Identificador inválido

- **WHEN** la dirección trae el identificador de un movimiento que no pertenece al libro
- **THEN** la lista se muestra sin franja y sin error

### Requirement: El detalle sigue disponible desde la lista

La página de detalle de un movimiento SHALL seguir accesible desde la lista y desde la franja «Recién agregado».

#### Scenario: Abrir el movimiento recién agregado

- **WHEN** la persona toca el movimiento de la franja
- **THEN** se abre su página de detalle con su historial
