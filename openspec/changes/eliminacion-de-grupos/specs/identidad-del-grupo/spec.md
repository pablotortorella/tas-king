## MODIFIED Requirements

### Requirement: Solo la persona titular administra el grupo

El sistema SHALL ofrecer una pantalla «Administrar grupo» en `/groups/:id/settings`. Solo la persona titular SHALL poder abrirla y guardar cambios; un integrante SHALL recibir un rechazo de permiso. La pantalla SHALL tener, en este orden: nombre, descripción y emoji con color; un enlace a la pantalla de Personas; un enlace para exportar el grupo; la transferencia de la titularidad; archivar el grupo; y, al final y apartada como zona de peligro, eliminar el grupo. Agregar participantes e invitar SHALL hacerse en la pantalla de Personas, no en la administración. Guardar la identidad SHALL registrar un evento de auditoría de la plataforma.

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
- **THEN** el nombre es la primera sección, seguido por descripción y emoji con color, luego el enlace «Ir a Personas», el enlace a exportar, la transferencia de la titularidad, archivar y, al final y apartado, eliminar el grupo; no hay formularios de agregar participantes ni de invitar

#### Scenario: Sumar gente se hace en Personas

- **WHEN** la persona titular abre la pantalla de Personas de un grupo activo
- **THEN** ve los formularios de agregar un participante sin cuenta y de invitar por email (con la opción de vincular a una persona existente), y al usarlos vuelve a Personas con su aviso

#### Scenario: Un integrante no suma gente ni administra

- **WHEN** un integrante abre la pantalla de Personas
- **THEN** no ve formularios de agregar participantes, invitar, renombrar el grupo ni archivar

#### Scenario: Grupo archivado

- **WHEN** el grupo está archivado
- **THEN** la pantalla de Personas no ofrece sumar ni invitar
