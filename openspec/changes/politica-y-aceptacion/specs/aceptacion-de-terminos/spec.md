## Purpose

Define cómo HomeSuite informa, obtiene y prueba la aceptación de los términos y de la política de privacidad, y qué ocurre cuando una de las dos cambia.

## ADDED Requirements

### Requirement: Toda pantalla de acceso muestra el aviso con ambos enlaces

Toda pantalla que ofrezca «Continuar con Google» SHALL mostrar, encima del botón, un aviso que diga que al continuar la persona acepta los Términos y condiciones y la Política de privacidad y confirma que tiene 18 años o más, con un enlace a cada texto. La aplicación SHALL mostrar además un pie con enlaces a ambos textos.

#### Scenario: Pantalla de inicio sin sesión

- **WHEN** una persona sin sesión abre `/`
- **THEN** ve el aviso con los enlaces a términos y a privacidad encima de «Continuar con Google»

#### Scenario: Otras pantallas con acceso

- **WHEN** se recorren `/cuentas-claras` sin sesión, la pantalla de invitación sin sesión y el acceso de Remanso
- **THEN** cada una que contiene un enlace a `/auth/google` contiene también el aviso y sus dos enlaces

#### Scenario: Enlaces correctos por ambiente

- **WHEN** la aplicación de staging muestra el aviso
- **THEN** los enlaces apuntan al sitio de staging y los de producción al sitio de producción

### Requirement: La aceptación se registra con la versión mostrada

Al completar un inicio de sesión que partió de una pantalla con el aviso, el sistema SHALL registrar para la persona, por cada documento (términos y privacidad), la versión que se mostró y la fecha. La versión registrada SHALL ser la que figuraba al iniciar el flujo, no la vigente al volver. Un inicio de sesión que no partió de una pantalla con el aviso SHALL NOT registrar aceptación.

#### Scenario: Primer ingreso

- **WHEN** una persona completa su primer inicio de sesión desde `/`
- **THEN** existen dos filas de aceptación (términos y privacidad) con la versión vigente y la fecha

#### Scenario: Cambio de versión durante el flujo

- **WHEN** la versión cambia mientras la persona estaba en la pantalla de Google
- **THEN** se registra la versión que veía al empezar y la puerta le pedirá la nueva

#### Scenario: Acceso sin aviso

- **WHEN** alguien llega por un enlace directo a `/auth/google` sin pasar por una pantalla con aviso
- **THEN** inicia sesión sin que se registre aceptación y la puerta le pide aceptar

### Requirement: Una versión nueva se acepta antes de seguir usando la aplicación

Cuando la versión vigente de alguno de los textos sea posterior a la que la persona aceptó, el sistema SHALL llevarla a una pantalla de aceptación que indique qué texto cambió, enlace a ambos y ofrezca aceptar y continuar o cerrar sesión. Mientras no acepte, el sistema SHALL rechazar el resto de las pantallas y mutaciones. Las excepciones SHALL ser cerrar sesión, la pantalla de aceptación, las páginas legales, la descarga de los datos propios y la baja de cuenta.

#### Scenario: Versión nueva

- **WHEN** una persona que aceptó la versión anterior abre cualquier pantalla del grupo después de que cambió la política
- **THEN** es llevada a la pantalla de aceptación y no ve el grupo hasta aceptar

#### Scenario: No acepta

- **WHEN** la persona elige cerrar sesión en la pantalla de aceptación
- **THEN** se cierra su sesión y no se registra aceptación

#### Scenario: Baja con versión sin aceptar

- **WHEN** una persona con una versión pendiente abre la pantalla de baja de cuenta
- **THEN** puede completarla sin aceptar la versión nueva

#### Scenario: Mutación con versión pendiente

- **WHEN** una persona con una versión pendiente envía un formulario que cambia datos
- **THEN** el servidor lo rechaza sin modificar nada

### Requirement: Los cambios sustanciales se anuncian antes de regir

Cuando exista una versión próxima con fecha de entrada en vigor, toda pantalla autenticada SHALL mostrar una franja con el enlace al texto nuevo y la fecha desde la que rige. La nueva aceptación SHALL exigirse recién desde esa fecha.

#### Scenario: Franja previa

- **WHEN** hay una versión que rige dentro de 10 días
- **THEN** las pantallas muestran la franja con la fecha y todavía no piden aceptar

### Requirement: La versión de cada texto coincide con la fecha publicada

La versión registrada de cada documento SHALL ser la fecha de «Última actualización» de su página. Una prueba SHALL fallar si la constante de versión de la aplicación no coincide con la fecha de la página legal correspondiente.

#### Scenario: Texto editado sin subir la versión

- **WHEN** se cambia la fecha de «Última actualización» de una página sin actualizar la constante
- **THEN** la prueba falla señalando el documento

### Requirement: El aviso y la aceptación funcionan en el teléfono

El aviso de acceso SHALL leerse en 390 px de ancho sin ampliar, con sus dos enlaces de al menos 44 px de alto, y la pantalla de aceptación SHALL usar una columna con botones de al menos 44 px, sin desborde horizontal.

#### Scenario: Acceso desde el teléfono

- **WHEN** se abre `/` sin sesión en 390 px
- **THEN** el aviso es visible junto al botón sin desplazarse horizontalmente y los enlaces miden al menos 44 px

### Requirement: El registro de aceptaciones se conserva con identificador opaco

El sistema SHALL conservar las aceptaciones con identificador opaco, versión y fecha, sin dirección IP ni agente de usuario, aun después de la baja de cuenta.

#### Scenario: Tras la baja

- **WHEN** una cuenta se da de baja
- **THEN** sus filas de aceptación permanecen y no contienen datos personales
