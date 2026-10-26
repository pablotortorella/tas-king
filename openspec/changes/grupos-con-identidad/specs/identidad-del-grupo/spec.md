## Purpose

Define la identidad visible de un grupo de Cuentas Claras (nombre, descripción, emoji y color), la pantalla donde la persona titular la administra, el listado de grupos y cómo la aplicación abre el último grupo en el que se trabajó.

## ADDED Requirements

### Requirement: Un grupo tiene nombre, descripción, emoji y color

Cada grupo SHALL tener un nombre de 1 a 120 caracteres, una descripción opcional de hasta 500 caracteres de texto plano, un emoji opcional y un color de fondo opcional. El emoji SHALL cumplir las mismas reglas que el emoji de un perfil personal (un único emoji completo). El color SHALL ser uno de los colores del avatar de los perfiles personales; si no se eligió, SHALL asignarse uno estable a partir del grupo. Sin emoji, el avatar del grupo SHALL mostrar la inicial del nombre. La descripción SHALL mostrarse como texto, sin interpretar marcado.

#### Scenario: Grupo sin identidad elegida

- **WHEN** un grupo recién creado se muestra en cualquier pantalla
- **THEN** su avatar usa la inicial del nombre sobre un color estable y no muestra descripción

#### Scenario: Emoji inválido

- **WHEN** la persona titular guarda «hola» o dos emojis como emoji del grupo
- **THEN** el cambio se rechaza con «Elegí un único emoji completo.» y no se guarda nada

#### Scenario: Descripción con marcado

- **WHEN** la descripción contiene `<script>` o `<b>`
- **THEN** se muestra literalmente como texto

#### Scenario: Descripción demasiado larga

- **WHEN** la persona titular guarda una descripción de más de 500 caracteres
- **THEN** se rechaza con un mensaje que indica el límite y el grupo no cambia

### Requirement: Solo la persona titular administra el grupo

El sistema SHALL ofrecer una pantalla «Administrar grupo» en `/groups/:id/settings`. Solo la persona titular SHALL poder abrirla y guardar cambios; un integrante SHALL recibir un rechazo de permiso. La pantalla SHALL tener, en este orden: nombre, descripción y emoji con color; agregar participantes sin cuenta e invitar por email (con la opción de vincular a una persona existente); y archivar el grupo. Guardar la identidad SHALL registrar un evento de auditoría de la plataforma.

#### Scenario: La persona titular edita la identidad

- **WHEN** la persona titular cambia nombre, descripción, emoji y color y guarda
- **THEN** los cuatro valores se ven en el listado de grupos, en el encabezado y en la página del grupo, y queda registrado un evento de auditoría

#### Scenario: Un integrante intenta administrar

- **WHEN** un integrante abre `/groups/:id/settings` o envía el formulario de identidad
- **THEN** recibe un rechazo de permiso y nada cambia

#### Scenario: Nombre vacío

- **WHEN** la persona titular guarda el nombre en blanco
- **THEN** se rechaza y se conserva el nombre anterior

#### Scenario: Orden de la pantalla

- **WHEN** la persona titular abre «Administrar grupo»
- **THEN** el nombre es la primera sección, seguido por descripción y emoji con color, y recién después aparecen agregar participantes e invitar

#### Scenario: Lo de administración sale de Personas

- **WHEN** cualquier integrante abre la pantalla de Personas
- **THEN** no ve formularios de agregar participantes, invitar, renombrar el grupo ni archivar

### Requirement: La administración se alcanza desde el grupo y desde el menú

Dentro de un grupo, la persona titular SHALL ver una ruedita de configuración en el encabezado de la página del grupo y un ítem «Administrar grupo» en el menú, ambos hacia la pantalla de administración. Los integrantes SHALL NO ver ninguno de los dos.

#### Scenario: La persona titular llega por la ruedita

- **WHEN** la persona titular toca la ruedita en la página del grupo
- **THEN** llega a «Administrar grupo»

#### Scenario: La persona titular llega por el menú

- **WHEN** la persona titular abre el menú dentro del grupo y elige «Administrar grupo»
- **THEN** llega a la misma pantalla

#### Scenario: Un integrante no ve la administración

- **WHEN** un integrante abre el menú dentro del grupo
- **THEN** no aparece «Administrar grupo» y la página del grupo no muestra la ruedita

### Requirement: El listado de grupos muestra la identidad de cada grupo

`/groups` SHALL listar todos los grupos de la persona con su avatar (emoji y color), nombre, un extracto de la descripción y su rol (titular o integrante), con enlace a cada grupo, acciones para crear un grupo y ver invitaciones, y sin importar cuántos grupos tenga. La página del grupo SHALL mostrar el avatar, el nombre y la descripción en el encabezado.

#### Scenario: Varios grupos distinguibles

- **WHEN** una persona con dos grupos de distinta identidad abre `/groups`
- **THEN** cada fila muestra su emoji, su color, su nombre y el extracto de su descripción

#### Scenario: Un solo grupo también tiene lista

- **WHEN** una persona con un único grupo abre `/groups`
- **THEN** ve la lista con ese grupo, sin redirección

### Requirement: Entrar a Cuentas Claras abre el último grupo visitado

La aplicación SHALL recordar en el navegador el último grupo al que la persona entró, sin guardarlo en la base de datos. Al abrir `/cuentas-claras` (también después de iniciar sesión), SHALL abrir ese grupo si la persona sigue siendo integrante; si no hay grupo recordado o ya no es integrante, SHALL abrir el único grupo que tenga, y con varios SHALL mostrar la lista. Un valor recordado que no corresponda a un grupo de la persona SHALL ignorarse sin revelar si ese grupo existe.

#### Scenario: Volver al grupo de trabajo

- **WHEN** una persona con dos grupos entra al grupo «Viaje» y más tarde abre `/cuentas-claras`
- **THEN** llega directo al grupo «Viaje»

#### Scenario: Cambiar de grupo cambia el recuerdo

- **WHEN** esa persona abre `/groups`, entra a «Casa» y más tarde abre `/cuentas-claras`
- **THEN** llega directo a «Casa»

#### Scenario: Ya no es integrante

- **WHEN** el grupo recordado dejó de ser del usuario o de la cuenta que inició sesión
- **THEN** se ignora el recuerdo y se muestra la lista (o el único grupo)

#### Scenario: Otra cuenta en el mismo navegador

- **WHEN** una segunda cuenta inicia sesión en un navegador que recuerda un grupo de la primera
- **THEN** no se abre ese grupo ni se informa que existe

#### Scenario: Sin recuerdo

- **WHEN** una persona sin grupo recordado y con varios grupos abre `/cuentas-claras`
- **THEN** ve la lista de grupos

### Requirement: Cambiar de grupo es evidente y no usa selector desplegable

En todas las pantallas de un grupo, el encabezado SHALL mostrar el avatar y el nombre del grupo como enlace a `/groups`, y el menú SHALL ofrecer «Mis grupos» hacia la misma lista. SHALL NO existir un selector desplegable de grupos.

#### Scenario: Volver a la lista desde cualquier pantalla del grupo

- **WHEN** la persona toca el nombre del grupo en el encabezado
- **THEN** llega a `/groups`

#### Scenario: Mis grupos en el menú

- **WHEN** la persona abre el menú y elige «Mis grupos»
- **THEN** llega a `/groups`, incluso si solo tiene un grupo
