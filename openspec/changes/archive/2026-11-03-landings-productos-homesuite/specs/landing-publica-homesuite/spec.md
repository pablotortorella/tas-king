## MODIFIED Requirements

### Requirement: Fun TasKing está disponible desde la portada

La portada SHALL mostrar Fun TasKing como herramienta disponible y SHALL enlazar
a su landing pública en `/tareas`. Esa landing SHALL ofrecer un enlace con nombre
accesible hacia `https://tas-king.pablotortorella.workers.dev` y SHALL explicar
que la aplicación aún vive en su dirección actual.

#### Scenario: Conocer y abrir Fun TasKing

- **WHEN** una persona activa el enlace de Fun TasKing en la portada
- **THEN** llega a `/tareas` y encuentra un enlace a la URL productiva actual

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL presentar Gastos y Compras como herramientas en preparación y
SHALL enlazar a sus landings informativas en `/gastos` y `/compras`. Las tres
superficies SHALL distinguir enlaces para conocer una idea de acciones para usar
una aplicación. Las herramientas futuras SHALL NOT mostrar CTA de entrada,
formularios ni controles deshabilitados que sugieran una función disponible.

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** puede conocer cada producto sin confundir Gastos o Compras con apps listas

## ADDED Requirements

### Requirement: Cada producto tiene una landing pública canónica

El sitio SHALL servir páginas informativas en `/tareas`, `/gastos` y `/compras`
con un título propio, navegación de regreso a HomeSuite y contenido disponible
sin JavaScript, autenticación ni cookies. Las páginas SHALL conservar la
legibilidad y el acceso a sus enlaces en 360 píxeles y en esquemas claro y oscuro.

#### Scenario: Abrir directamente una landing

- **WHEN** una persona solicita cualquiera de las tres rutas públicas
- **THEN** recibe su página de producto por HTTPS y puede volver a la portada

#### Scenario: Visitar desde un teléfono

- **WHEN** una landing se abre con viewport de 360 píxeles
- **THEN** el contenido y sus enlaces caben sin overflow horizontal
