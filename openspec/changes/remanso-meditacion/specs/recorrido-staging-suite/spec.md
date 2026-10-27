## MODIFIED Requirements

### Requirement: Navegación completa de staging

El sitio público de staging SHALL ofrecer home y landings de las cuatro
herramientas. Las landings de Cuentas Claras y Remanso SHALL llevar a la app del
mismo entorno. La app SHALL abrir en una entrada general de HomeSuite y mostrar el
aviso «Muy pronto» sólo en la ruta de Cuentas Claras para una sesión válida.

#### Scenario: Llegada desde la home pública

- **GIVEN** una persona visita el sitio público de staging
- **WHEN** navega a Cuentas Claras y elige entrar a la app
- **THEN** llega a `/cuentas-claras` en la app de staging y puede iniciar Google con retorno a esa ruta

#### Scenario: Sesión ya iniciada

- **GIVEN** una persona autenticada abre la raíz de la app
- **WHEN** elige Cuentas Claras
- **THEN** ve «Muy pronto» dentro del producto y puede volver a la suite

#### Scenario: Llegada a Remanso desde la home pública

- **GIVEN** una persona visita el sitio público de staging sin sesión
- **WHEN** elige Remanso en la portada y entra a la app
- **THEN** llega a `/remanso` en la app de staging y puede meditar con las opciones libres sin iniciar sesión

#### Scenario: Remanso fuera de staging

- **WHEN** se abre la landing de Remanso en el sitio público de producción
- **THEN** no contiene ningún enlace a la app de staging
