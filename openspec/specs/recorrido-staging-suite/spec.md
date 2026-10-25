# recorrido-staging-suite Specification

## Purpose

Definir el recorrido entre home pública, landings y app de staging, y el acceso
a la edición del perfil global desde la interfaz común de HomeSuite.

## Requirements

### Requirement: Navegación completa de staging

El sitio público de staging SHALL ofrecer home y landings de las tres
herramientas. La landing de Cuentas Claras SHALL llevar a la app del mismo
entorno. La app SHALL abrir en una entrada general de HomeSuite y mostrar el
aviso «Muy pronto» sólo en la ruta de Cuentas Claras para una sesión válida.

#### Scenario: Llegada desde la home pública

- **GIVEN** una persona visita el sitio público de staging
- **WHEN** navega a Cuentas Claras y elige entrar a la app
- **THEN** llega a `/cuentas-claras` en la app de staging y puede iniciar Google con retorno a esa ruta

#### Scenario: Sesión ya iniciada

- **GIVEN** una persona autenticada abre la raíz de la app
- **WHEN** elige Cuentas Claras
- **THEN** ve «Muy pronto» dentro del producto y puede volver a la suite

### Requirement: Edición propia de perfil global

La app SHALL enlazar `/perfil` desde avatar/nombre y menú general. La edición
SHALL usar la identidad de la sesión, CSRF y revisión del contrato común; una
persona sin sesión SHALL ser dirigida al acceso con retorno a `/perfil`.

#### Scenario: Guardar avatar y nombre propios

- **GIVEN** una persona autenticada con una revisión de perfil vigente
- **WHEN** elige nombre propio, emoji y color y guarda
- **THEN** la API actualiza su perfil y la interfaz muestra la elección persistida

#### Scenario: Revisión obsoleta

- **GIVEN** el perfil cambió en otra pestaña
- **WHEN** la persona intenta guardar con una revisión anterior
- **THEN** la interfaz muestra el conflicto sin sobrescribir el perfil nuevo
