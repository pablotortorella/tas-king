## MODIFIED Requirements

### Requirement: Sin datos ni esquema nuevos

Remanso SHALL NOT crear tablas, columnas ni migraciones propias, y SHALL NOT enviar al
servidor datos de la sesión de meditación (duración, fondo, gong, estado de ánimo).
Con sesión de HomeSuite, al terminar o abandonar una sesión de meditación, el navegador
SHALL enviar una única petición con solo el resultado («terminada» o «abandonada»), para la
estadística de uso de la suite; si esa petición falla, la experiencia SHALL NOT cambiar.
Las únicas lecturas del servidor SHALL ser la sesión y el nombre del perfil; una visita
sin sesión SHALL NOT requerir lecturas de base de datos ni crear cookies, y SHALL NOT
enviar ninguna petición con datos de la sesión.

#### Scenario: Sesión completa sin tráfico de datos

- **WHEN** se completa una sesión sin cuenta
- **THEN** el navegador no envía al servidor ninguna petición con datos de la sesión

#### Scenario: Sesión completa con cuenta

- **WHEN** una persona con sesión de HomeSuite termina una sesión de meditación
- **THEN** el navegador envía una sola petición con el resultado «terminada», sin duración, fondo, gong ni estado de ánimo

#### Scenario: Sesión abandonada con cuenta

- **WHEN** una persona con sesión termina antes de tiempo o cierra la sesión de meditación
- **THEN** el navegador envía una sola petición con el resultado «abandonada»

#### Scenario: Visita sin sesión

- **WHEN** una persona sin cookie de sesión abre y usa Remanso
- **THEN** el servidor no consulta la base de datos ni establece cookies

#### Scenario: Sin migraciones

- **WHEN** se prepara la publicación en staging
- **THEN** Remanso no agrega migraciones de D1 propias; la estadística de uso vive en las tablas de la suite
