## Purpose

Define cómo la persona titular elimina un grupo de Cuentas Claras, qué ve cada persona durante la ventana de 30 días y cómo se restaura.

## ADDED Requirements

### Requirement: Solo la persona titular elimina el grupo con una confirmación reforzada

La persona titular SHALL poder eliminar un grupo desde una pantalla propia que muestre cuántas personas perderán el acceso, que el grupo se puede recuperar durante 30 días, las descargas de exportación y el estado de la exportación. La eliminación SHALL requerir escribir el nombre exacto del grupo y SHALL rechazarse si el nombre no coincide. Un integrante SHALL NOT poder eliminar el grupo ni ver la opción. Eliminar SHALL estar permitido con el grupo archivado.

#### Scenario: Eliminar con el nombre correcto

- **WHEN** la persona titular escribe el nombre exacto del grupo y confirma
- **THEN** el grupo queda marcado como eliminado con la fecha y la persona que lo eliminó, y vuelve a su lista con el aviso y la fecha límite de recuperación

#### Scenario: Nombre equivocado

- **WHEN** la persona titular escribe un nombre distinto y confirma
- **THEN** el servidor rechaza la eliminación y el grupo no cambia

#### Scenario: Un integrante intenta eliminar

- **WHEN** un integrante que no es titular envía el formulario de eliminación
- **THEN** el servidor responde 403 y el grupo no cambia

#### Scenario: Doble envío

- **WHEN** el formulario de eliminación se envía una segunda vez
- **THEN** la persona vuelve a su lista con el aviso y no se registra un segundo evento

### Requirement: La aplicación ofrece exportar antes de eliminar y advierte si hay cambios sin exportar

La pantalla de eliminación SHALL ofrecer la exportación completa del grupo. SHALL indicar si existe una exportación JSON de la persona titular correspondiente a la revisión vigente del grupo; si no existe, SHALL mostrar una advertencia y SHALL exigir una confirmación adicional explícita. La exportación SHALL NOT ser obligatoria.

#### Scenario: Exportación al día

- **WHEN** la persona titular exportó el JSON y no hubo cambios posteriores
- **THEN** la pantalla muestra que la exportación está al día y no pide la confirmación adicional

#### Scenario: Cambios sin exportar

- **WHEN** hubo un movimiento nuevo después de la última exportación
- **THEN** la pantalla advierte que hay cambios sin exportar y exige marcar la confirmación adicional para eliminar

### Requirement: El grupo eliminado desaparece al instante para todas las personas

Desde el momento de la eliminación, el grupo SHALL dejar de aparecer en la lista de todas las personas, y toda pantalla, ruta de datos, exportación, invitación pendiente y cookie de último grupo que lo refiera SHALL comportarse como si no existiera (404 o invitación no encontrada), con dos excepciones para la persona titular dentro de la ventana: la pantalla de recuperación y la exportación. Ninguna escritura SHALL aceptarse sobre un grupo eliminado.

#### Scenario: Un integrante abre el grupo eliminado

- **WHEN** un integrante abre cualquier pantalla del grupo eliminado
- **THEN** recibe 404 y el grupo no figura en su lista de grupos

#### Scenario: Todas las rutas

- **WHEN** una prueba recorre todas las rutas de grupo con la persona titular y con un integrante después de eliminar
- **THEN** todas responden 404, salvo la pantalla de recuperación y la exportación de la persona titular

#### Scenario: Invitación pendiente

- **WHEN** alguien intenta aceptar una invitación pendiente de un grupo eliminado
- **THEN** la invitación no se encuentra y no se crea ninguna membresía

### Requirement: Las demás personas ven una nota con el nombre del grupo eliminado

Durante la ventana de 30 días, la lista de grupos de cada integrante que no es titular SHALL mostrar una nota con el nombre del grupo eliminado, sin enlace ni acceso a datos. Pasada la ventana, o al restaurarse el grupo, la nota SHALL desaparecer.

#### Scenario: Nota para un integrante

- **WHEN** un integrante abre su lista de grupos el día siguiente a la eliminación
- **THEN** ve «“X” fue eliminado por su titular» sin enlaces al grupo

### Requirement: La persona titular puede restaurar y exportar durante 30 días

Durante los 30 días posteriores a la eliminación, la persona titular SHALL ver el grupo en «Grupos eliminados» con los días restantes, SHALL poder restaurarlo y SHALL poder exportar su JSON y su CSV. Al restaurar, el grupo, sus integrantes, roles, movimientos, historial y saldos SHALL quedar exactamente como estaban. Pasados los 30 días, restaurar SHALL rechazarse. La restauración y la eliminación SHALL quedar auditadas.

#### Scenario: Restaurar

- **WHEN** la persona titular restaura un grupo eliminado hace 10 días
- **THEN** el grupo vuelve a aparecer para todos sus integrantes con los mismos saldos y se registra `group_restored`

#### Scenario: Exportar un grupo eliminado

- **WHEN** la persona titular exporta el JSON de un grupo eliminado dentro de la ventana
- **THEN** recibe el mismo archivo que antes de eliminar

#### Scenario: Fuera de la ventana

- **WHEN** la persona titular intenta restaurar un grupo eliminado hace 31 días
- **THEN** el servidor rechaza la restauración

#### Scenario: Un integrante intenta restaurar

- **WHEN** un integrante envía el formulario de restauración
- **THEN** el servidor responde 404

### Requirement: Eliminar y restaurar quedan auditados sin datos personales

Eliminar y restaurar SHALL registrar `group_deleted` y `group_restored` en la auditoría de la plataforma con la persona que actúa, el grupo, y en los metadatos si la exportación estaba al día y los conteos de integrantes y movimientos. Los eventos SHALL NOT contener nombres ni emails.

#### Scenario: Evento de eliminación

- **WHEN** la persona titular elimina un grupo con 3 integrantes y 120 movimientos
- **THEN** existe un evento `group_deleted` con esos conteos y sin nombres ni emails

### Requirement: La eliminación y la recuperación funcionan en el teléfono

La pantalla de eliminación y la sección «Grupos eliminados» SHALL usar una columna, controles de al menos 44 px y el botón de eliminar separado del de cancelar, sin desborde horizontal en 390 px de ancho.

#### Scenario: Eliminar desde el teléfono

- **WHEN** la persona titular abre la pantalla de eliminación en 390 px
- **THEN** ve las consecuencias, las exportaciones y el campo del nombre sin desplazarse horizontalmente y los botones miden al menos 44 px
