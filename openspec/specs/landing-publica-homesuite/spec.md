# landing-publica-homesuite Specification

## Purpose
Definir la portada pública de HomeSuite, el acceso a Fun TasKing y la presentación
honesta de los próximos productos, sin identidad, sesiones ni datos de aplicación.

## Requirements
### Requirement: La portada presenta HomeSuite

La portada pública SHALL identificar el sitio como HomeSuite y SHALL explicar en
lenguaje breve que reúne herramientas para organizar la vida compartida. El
contenido SHALL poder leerse y navegarse sin JavaScript, autenticación ni cookies.

#### Scenario: Primera visita al dominio

- **WHEN** una persona abre la portada de HomeSuite
- **THEN** ve el nombre HomeSuite, un mensaje de bienvenida y una explicación breve de la suite

#### Scenario: JavaScript no está disponible

- **WHEN** el navegador no ejecuta JavaScript
- **THEN** todo el contenido y todos los enlaces de la portada siguen disponibles

### Requirement: Fun TasKing está disponible desde la portada

La portada SHALL mostrar Fun TasKing como herramienta disponible y SHALL ofrecer
un enlace con nombre accesible hacia
`https://tas-king.pablotortorella.workers.dev`.

#### Scenario: Entrar a Fun TasKing

- **WHEN** una persona activa el enlace “Abrir Fun TasKing”
- **THEN** el navegador navega a la URL productiva actual de Fun TasKing

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL presentar Gastos y Compras como herramientas en preparación.
Esos elementos SHALL NOT usar enlaces, botones ni controles deshabilitados que
sugieran una acción disponible.

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** distingue Fun TasKing como disponible y Gastos y Compras como próximas

### Requirement: La portada se adapta al dispositivo

La portada SHALL conservar jerarquía, legibilidad y acceso al CTA en pantallas de
360 píxeles de ancho o mayores, sin overflow horizontal. SHALL respetar la
preferencia de esquema claro u oscuro del sistema.

#### Scenario: Abrir desde un teléfono

- **WHEN** la portada se abre en un viewport de 360 píxeles
- **THEN** el contenido cabe horizontalmente, el CTA es visible y los textos no se recortan

#### Scenario: Preferencia de color oscura

- **WHEN** el sistema de la persona prefiere un esquema oscuro
- **THEN** la portada usa la variante oscura manteniendo contraste y legibilidad

### Requirement: El dominio canónico es el apex

El Worker SHALL redirigir toda solicitud a `www.homesuite.info` hacia el mismo
path y query string en `https://homesuite.info` con estado permanente 308.

#### Scenario: Visita mediante www

- **WHEN** una persona solicita `https://www.homesuite.info/ruta?origen=www`
- **THEN** recibe una redirección 308 a `https://homesuite.info/ruta?origen=www`

### Requirement: La superficie pública es mínima y endurecida

El Worker SHALL aceptar únicamente `GET` y `HEAD`, SHALL servir assets sin D1,
R2, OAuth ni secretos y SHALL incluir cabeceras que impidan framing, sniffing de
contenido y acceso a capacidades innecesarias del navegador.

#### Scenario: Servir la portada

- **WHEN** un cliente solicita la portada con `GET` o `HEAD`
- **THEN** el Worker delega el contenido al asset server y agrega las cabeceras de seguridad

#### Scenario: Método no permitido

- **WHEN** un cliente envía `POST`, `PUT`, `PATCH` o `DELETE`
- **THEN** recibe estado 405 y una cabecera `Allow` limitada a `GET, HEAD`
