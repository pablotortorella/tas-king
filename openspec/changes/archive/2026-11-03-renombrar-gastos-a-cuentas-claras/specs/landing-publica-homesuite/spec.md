## MODIFIED Requirements

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL presentar Cuentas Claras y Compras como herramientas en
preparación. Esos elementos SHALL enlazar a sus landings informativas canónicas,
`/cuentas-claras` y `/compras`, y SHALL NOT usar botones, formularios ni controles
deshabilitados que sugieran una función disponible. La landing de Cuentas Claras
SHALL usar ese nombre como producto y explicar que contempla gastos, ingresos y
transferencias compartidas.

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** distingue Fun TasKing como disponible y Cuentas Claras y Compras como
  próximas, con enlaces a sus landings correctas

### Requirement: Cada producto tiene una landing pública canónica

El sitio SHALL servir páginas informativas en `/tareas`, `/cuentas-claras` y
`/compras` con un título propio, navegación de regreso a HomeSuite y contenido
disponible sin JavaScript, autenticación ni cookies. Las páginas SHALL conservar
la legibilidad y el acceso a sus enlaces en 360 píxeles y en esquemas claro y
oscuro. `/gastos` SHALL NOT servir la landing de Cuentas Claras ni redirigir a
ella.

#### Scenario: Abrir directamente una landing

- **WHEN** una persona solicita cualquiera de las tres rutas públicas canónicas
- **THEN** recibe su página de producto por HTTPS y puede volver a la portada

#### Scenario: Visitar la ruta anterior

- **WHEN** una persona solicita `/gastos`
- **THEN** no recibe una redirección ni contenido de Cuentas Claras
