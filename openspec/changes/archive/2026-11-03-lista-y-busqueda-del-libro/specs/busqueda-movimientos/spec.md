## Purpose

Define el campo de búsqueda único del historial de un libro: qué campos recorre, cómo normaliza, cómo combina términos, cómo trata los nombres de personas y qué costo puede tener, para encontrar cualquier movimiento sin importar su origen.

## ADDED Requirements

### Requirement: Una sola búsqueda recorre todo el historial

El historial SHALL ofrecer un único campo de búsqueda que recorra los movimientos de cualquier origen en una misma lista. Sin texto, el historial SHALL mostrarse completo. Cuando hay texto, SHALL mostrarse «N de M movimientos» y cada resultado SHALL explicar por qué coincide.

#### Scenario: Buscar un nombre

- **WHEN** la persona escribe «Laura»
- **THEN** ve en una sola lista los movimientos propios e importados que coinciden, con el motivo de cada coincidencia y el conteo «N de M movimientos»

#### Scenario: Borrar la búsqueda

- **WHEN** la persona quita el texto
- **THEN** vuelve a ver todo el historial sin filtros residuales

### Requirement: La consulta se normaliza y cubre textos, nota, categoría y montos

La búsqueda SHALL ignorar mayúsculas, acentos y puntuación y SHALL buscar en la descripción, la nota, la categoría, el nombre de las personas y los importes (total y efecto de cada persona). Un término numérico SHALL ignorar los separadores de miles. Cada resultado SHALL indicar el campo que coincidió.

#### Scenario: Acentos y mayúsculas

- **WHEN** la persona escribe «cuenta de gas» y existe un movimiento «Gás natural»
- **THEN** el movimiento aparece

#### Scenario: Buscar por importe con separadores

- **WHEN** la persona escribe «1.000»
- **THEN** aparecen los movimientos cuyo importe entero contiene 1000, sin distinguir cómo se escribió el separador

#### Scenario: Buscar en la nota

- **WHEN** la persona escribe una palabra que solo está en la nota de un movimiento
- **THEN** el movimiento aparece y su motivo es la nota

### Requirement: Los términos de una consulta se combinan con Y

Cuando una frase completa no coincide, la búsqueda SHALL exigir que cada término de la consulta coincida en algún campo del movimiento, y SHALL listar en el motivo los campos que coincidieron.

#### Scenario: Dos términos

- **WHEN** la persona escribe «gas laura»
- **THEN** solo aparecen los movimientos que coinciden con ambos términos y el motivo indica cada uno

#### Scenario: Una frase que coincide completa

- **WHEN** la frase completa coincide en un campo
- **THEN** el movimiento aparece con un único motivo

### Requirement: Buscar por persona distingue quién pagó de quién participa

Cuando la consulta coincide con el nombre de una persona, el resultado SHALL indicar «Pagó X» si la persona pagó (o recibió, en un ingreso), «Participa X» si está en el reparto y, en una transferencia, «Entregó X» o «Recibió X». Cuando el pagador se dedujo en una importación, el motivo SHALL indicar que es inferido. La búsqueda SHALL ofrecer dos filtros rápidos con su cantidad, «Pagó X» y «Participa X», que restrinjan los resultados al criterio elegido.

#### Scenario: Dos personas

- **WHEN** en un libro de dos personas se busca el nombre de una de ellas
- **THEN** los resultados indican «Pagó» o «Participa» y se ofrecen los filtros «Pagó X (N)» y «Participa X (M)»

#### Scenario: Filtrar por quien pagó

- **WHEN** la persona elige el filtro «Pagó X»
- **THEN** la lista muestra solo los movimientos que pagó esa persona

#### Scenario: Pagador inferido

- **WHEN** un movimiento importado tiene el pagador inferido y se busca a esa persona
- **THEN** el motivo es «Pagó X · inferido»

#### Scenario: Transferencia

- **WHEN** se busca a la persona que entregó dinero en una transferencia
- **THEN** el motivo es «Entregó X»

### Requirement: La búsqueda aparece con los movimientos anulados rotulados

Los movimientos anulados SHALL aparecer en los resultados rotulados como anulados, y SHALL conservar su motivo de coincidencia.

#### Scenario: Movimiento anulado

- **WHEN** un movimiento anulado coincide con la consulta
- **THEN** aparece tachado y rotulado como anulado

### Requirement: La búsqueda se mantiene rápida con libros grandes

El costo de una búsqueda SHALL crecer de forma lineal con el número de movimientos y NO SHALL formatear importes cuando los términos no son numéricos. Una búsqueda de una palabra sobre un libro de 5.000 movimientos SHALL resolverse en menos de 100 ms de CPU en la prueba de rendimiento.

#### Scenario: Libro de 5.000 movimientos

- **WHEN** se busca una palabra sobre un libro sintético de 5.000 movimientos
- **THEN** la búsqueda se resuelve en menos de 100 ms medidos sin red

#### Scenario: Resultado idéntico al anterior

- **WHEN** se compara la búsqueda con la implementación de referencia sobre miles de consultas generadas
- **THEN** devuelve los mismos movimientos con los mismos motivos
