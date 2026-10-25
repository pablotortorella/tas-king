## Purpose

Define la lista de categorías de cada libro de Cuentas Claras: cómo se nombra y se normaliza, cómo se asigna a los movimientos, cómo se gestiona y dónde se ve, se busca y se exporta.

## ADDED Requirements

### Requirement: Cada libro tiene su propia lista de categorías

Cada libro SHALL tener una lista de categorías propia, con nombre, grupo, ícono y estado. Al crear un libro, la aplicación SHALL copiarle una lista inicial. Un libro existente sin lista SHALL recibirla en su primer acceso, sin alterar sus movimientos. Las categorías de un libro NO SHALL ser visibles ni sugeridas en otro libro.

#### Scenario: Libro nuevo

- **WHEN** una persona crea un libro
- **THEN** el libro tiene la lista inicial de categorías, agrupada, y sin ninguna categoría de otros libros

#### Scenario: Libro anterior sin lista

- **WHEN** se abre por primera vez un libro creado antes de este cambio
- **THEN** recibe la lista inicial y sus movimientos conservan su estado, sin categoría

#### Scenario: Aislamiento entre libros

- **WHEN** un libro crea una categoría nueva
- **THEN** esa categoría no aparece en el selector de ningún otro libro

### Requirement: Los nombres de categoría se normalizan para evitar duplicados

El nombre de una categoría SHALL compararse ignorando mayúsculas, acentos, espacios sobrantes y puntuación. Un libro NO SHALL tener dos categorías cuyo nombre normalizado coincida. La interfaz SHALL mostrar el nombre tal como se escribió al crearla.

#### Scenario: Variantes del mismo nombre

- **WHEN** existe «Alimentos» y se intenta crear «alimentos », «Álimentos» o «ALIMENTOS»
- **THEN** no se crea una categoría nueva y se ofrece la existente

#### Scenario: Se conserva el nombre original

- **WHEN** se crea «Café  y  Panadería» con espacios de más
- **THEN** la categoría se muestra con el nombre ingresado y se compara por su forma normalizada

#### Scenario: Renombrar a un nombre ya usado

- **WHEN** la persona titular renombra una categoría a un nombre que, normalizado, ya pertenece a otra
- **THEN** el servidor rechaza el cambio e indica que ya existe

### Requirement: Un movimiento puede llevar una categoría

Un gasto, un ingreso o una transferencia propios SHALL poder llevar una categoría del libro o ninguna. La categoría SHALL elegirse en un selector agrupado por grupo y SHALL poder crearse desde el mismo selector. Cambiar la categoría de un movimiento SHALL ser una corrección que crea una revisión. Un movimiento SHALL aceptar solo categorías de su propio libro y NO SHALL aceptar una archivada para altas nuevas.

#### Scenario: Elegir una categoría al cargar

- **WHEN** una persona carga un gasto y elige «Restaurantes»
- **THEN** el movimiento se guarda con esa categoría y la muestra

#### Scenario: Crear una categoría desde el selector

- **WHEN** la persona escribe un nombre que no existe y lo confirma
- **THEN** se crea la categoría en el libro y queda asignada al movimiento

#### Scenario: Una categoría de otro libro

- **WHEN** una escritura referencia una categoría que pertenece a otro libro
- **THEN** el servidor la rechaza y no guarda nada

#### Scenario: Cambiar la categoría deja historial

- **WHEN** se corrige la categoría de un movimiento
- **THEN** la nueva revisión indica que cambió la categoría

### Requirement: La categoría se ve, se busca y se filtra

La lista y el detalle de movimientos SHALL mostrar la categoría. La búsqueda SHALL coincidir con el nombre de la categoría y explicar la coincidencia. La lista SHALL poder filtrarse por categoría o grupo de categorías, y quitar el filtro SHALL devolver el historial completo.

#### Scenario: Buscar por categoría

- **WHEN** la persona busca «restaurantes»
- **THEN** aparecen los movimientos de esa categoría y cada resultado indica que coincide por categoría

#### Scenario: Filtrar por grupo

- **WHEN** la persona elige el grupo «Casa»
- **THEN** la lista muestra solo los movimientos de las categorías de ese grupo

#### Scenario: Sin categoría

- **WHEN** un movimiento no tiene categoría
- **THEN** se muestra como «Sin categoría» y puede filtrarse con ese valor

### Requirement: La persona titular gestiona las categorías

La persona titular SHALL poder renombrar, reagrupar, cambiar el ícono, archivar y fusionar categorías. Un integrante NO SHALL gestionarlas pero SHALL poder elegirlas y crearlas desde el selector. Archivar SHALL ocultar la categoría de los selectores para altas nuevas sin alterar los movimientos que ya la usan. Fusionar una categoría en otra SHALL hacer que sus movimientos pasen a mostrarse con la categoría destino sin reescribir cada movimiento.

#### Scenario: Renombrar

- **WHEN** la persona titular renombra «Alimentos» a «Supermercado»
- **THEN** todos los movimientos de esa categoría pasan a mostrar «Supermercado» sin que se modifique ninguno

#### Scenario: Fusionar

- **WHEN** la persona titular fusiona «Utilidades - Otro» en «Suscripciones»
- **THEN** los movimientos de la primera se muestran con «Suscripciones» y la fusionada deja de ofrecerse en los selectores

#### Scenario: Archivar

- **WHEN** la persona titular archiva una categoría
- **THEN** no se ofrece para movimientos nuevos y los existentes siguen mostrándola

#### Scenario: Un integrante intenta gestionar

- **WHEN** un integrante intenta renombrar, fusionar o archivar una categoría
- **THEN** el servidor lo rechaza y la categoría no cambia

### Requirement: Los movimientos importados reconocen la categoría del libro

Mientras los movimientos importados conserven su categoría de origen como texto, la aplicación SHALL mostrarla tal cual y, si su nombre normalizado coincide con el de una categoría del libro, SHALL mostrarla con el grupo y el ícono de esa categoría. Una categoría de origen sin coincidencia SHALL mostrarse como texto sin grupo.

#### Scenario: Coincidencia por nombre normalizado

- **WHEN** un movimiento importado tiene la categoría de origen «restaurantes» y el libro tiene «Restaurantes»
- **THEN** se muestra con el grupo y el ícono de «Restaurantes»

#### Scenario: Sin coincidencia

- **WHEN** la categoría de origen no coincide con ninguna del libro
- **THEN** se muestra como texto, sin grupo ni ícono

### Requirement: Las categorías forman parte de la exportación

La exportación JSON del libro SHALL incluir la lista de categorías con su estado y sus fusiones, y cada movimiento SHALL referenciar su categoría. La exportación CSV SHALL incluir una columna con el nombre de la categoría de cada movimiento.

#### Scenario: Exportar con categorías

- **WHEN** una persona integrante exporta el libro
- **THEN** el JSON incluye las categorías y los movimientos las referencian, y el CSV muestra el nombre de la categoría de cada fila
