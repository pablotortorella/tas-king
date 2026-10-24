## ADDED Requirements

### Requirement: Una sola búsqueda recorre todo el historial del libro

El historial SHALL ofrecer un único campo de búsqueda libre que recorra los
movimientos propios y los importados en una misma lista. Sin texto, el historial
SHALL mostrarse completo ordenado por fecha descendente. El resultado SHALL
mostrar «N de M movimientos» y SHALL paginarse.

#### Scenario: Buscar un nombre

- **WHEN** la persona escribe «Laura»
- **THEN** ve en una sola lista movimientos creados en HomeSuite e importados en
  los que Laura pagó, recibió o participa, con el conteo «28 de 39»

#### Scenario: Borrar la búsqueda

- **WHEN** la persona borra el texto
- **THEN** vuelve a ver todo el historial, sin filtros residuales

### Requirement: La consulta se normaliza y cubre textos, participantes y montos

La búsqueda SHALL ignorar mayúsculas, acentos y puntuación. SHALL buscar en
descripción, nota y categoría de origen, en el nombre de los participantes y en el
monto total y el efecto individual de los participantes. Con varios términos, cada
uno SHALL coincidir en algún campo.

#### Scenario: Acentos y mayúsculas

- **WHEN** la persona escribe «cuenta de gas» y existe «Gás natural»
- **THEN** el movimiento aparece

#### Scenario: Buscar por monto

- **WHEN** la persona escribe «286.400»
- **THEN** aparecen los movimientos cuyo total o cuyo efecto individual sea $286.400

#### Scenario: Varios términos

- **WHEN** la persona escribe «gas laura»
- **THEN** sólo aparecen movimientos que coinciden con ambos términos

### Requirement: Cada resultado explica su coincidencia y su origen

Cada resultado SHALL indicar por qué coincide («Participa Laura», «Pagó Laura»,
«Monto») resaltando el término, y SHALL marcar los movimientos importados con
«Importado de Splitwise» y su fila de origen. La explicación SHALL calcularse en el
servidor.

#### Scenario: Resultado importado

- **WHEN** aparece «Internet Tigo», importado de la fila 33
- **THEN** la tarjeta muestra la marca de origen con «fila 33» y el motivo de la coincidencia

### Requirement: La búsqueda no multiplica las consultas por resultado

El número de llamadas a la base SHALL ser independiente del número de resultados de
una página. El acceso SHALL respetar el aislamiento por libro.

#### Scenario: Página grande

- **WHEN** una página devuelve 50 resultados
- **THEN** el conteo de llamadas D1 es el mismo que con 5

#### Scenario: Persona ajena

- **WHEN** una persona sin membresía consulta la búsqueda de un libro
- **THEN** el servidor deniega sin revelar resultados
