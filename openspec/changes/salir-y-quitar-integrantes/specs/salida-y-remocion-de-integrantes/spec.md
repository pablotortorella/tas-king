## Purpose

Define cómo un integrante abandona un grupo o es quitado por la persona titular, qué se conserva en el grupo y cómo queda auditado.

## ADDED Requirements

### Requirement: Un integrante puede salir del grupo

Un integrante que no es titular SHALL poder salir de un grupo desde una pantalla de confirmación. Al confirmar, el sistema SHALL borrar su membresía y desvincular de su cuenta a la persona del grupo que la representaba, en una única operación atómica. La persona SHALL perder el acceso al grupo de inmediato: el grupo no aparece en su lista, sus pantallas responden 404 y la cookie del último grupo no se usa para abrirlo.

#### Scenario: Salir del grupo

- **WHEN** un integrante confirma que sale del grupo
- **THEN** su membresía deja de existir, el grupo desaparece de su lista y abrir cualquier pantalla del grupo responde 404

#### Scenario: Segundo envío del formulario

- **WHEN** el formulario de salida se envía una segunda vez después de salir
- **THEN** la persona vuelve a su lista de grupos con la nota de que ya no integra el grupo, sin un error

#### Scenario: Persona ajena

- **WHEN** alguien que no integra el grupo abre la pantalla de salida
- **THEN** recibe 404 sin distinguir entre grupo inexistente y ajeno

### Requirement: La persona titular puede quitar a un integrante

La persona titular SHALL poder quitar del grupo a un integrante con cuenta desde Personas, con una pantalla de confirmación, con los mismos efectos que salir. Un integrante SHALL NOT poder quitar a nadie. La persona titular SHALL NOT poder quitarse a sí misma con esta operación.

#### Scenario: Quitar a un integrante

- **WHEN** la persona titular confirma quitar a un integrante
- **THEN** el integrante pierde el acceso al instante y la persona del grupo que lo representaba queda sin cuenta

#### Scenario: Un integrante intenta quitar

- **WHEN** un integrante envía el formulario de remoción
- **THEN** el servidor responde 403 y no cambia nada

#### Scenario: La persona titular intenta quitarse

- **WHEN** la persona titular intenta quitarse a sí misma
- **THEN** el servidor la rechaza explicando que debe transferir la titularidad

### Requirement: Salir o ser quitada no altera la historia ni los saldos

Al salir o ser quitada una persona, el sistema SHALL conservar sin cambios su persona en el grupo (nombre, estado, movimientos, revisiones y saldo), SHALL dejarla como persona sin cuenta y SHALL conservar el nombre de quien cargó cada movimiento. Los saldos por persona y moneda SHALL ser idénticos antes y después. El sistema SHALL permitir volver a invitar a esa persona vinculándola a su persona anterior.

#### Scenario: Saldos intactos

- **WHEN** sale un integrante con saldo a favor en pesos
- **THEN** los saldos de todas las personas son los mismos y la persona figura como persona sin cuenta con el mismo saldo

#### Scenario: Volver a invitar

- **WHEN** la persona titular invita al mismo email vinculándolo a la persona que había salido y la invitación se acepta
- **THEN** la cuenta se vincula a esa persona y recupera su historial y su saldo

### Requirement: La confirmación informa lo que cambia sin bloquear por saldo

La pantalla de confirmación SHALL mostrar el saldo por moneda de la persona que se va, que su nombre y sus movimientos permanecen en el historial del grupo, y un enlace para exportar el grupo antes de salir. Un saldo distinto de cero SHALL NOT impedir salir ni quitar.

#### Scenario: Salir con saldo pendiente

- **WHEN** un integrante con saldo en contra abre la pantalla de salida y confirma
- **THEN** la pantalla mostró su saldo y que permanece en el historial, y la salida se completa

### Requirement: Quien salió o fue quitada recibe un aviso en la aplicación

Durante 30 días después de salir o de ser quitada, la lista de grupos de la persona SHALL mostrar una nota con el nombre del grupo indicando que ya no es integrante. La nota SHALL NOT indicar quién ejecutó la remoción ni permitir acceder al grupo.

#### Scenario: Nota tras ser quitado

- **WHEN** una persona quitada abre su lista de grupos
- **THEN** ve «Ya no sos integrante de “X”» sin el nombre de quien la quitó

#### Scenario: Pasados 30 días

- **WHEN** pasan más de 30 días desde la remoción
- **THEN** la nota ya no aparece

### Requirement: Cada salida y remoción queda auditada

Cada operación SHALL registrar en la misma operación atómica un evento `member_left` o `member_removed` en la auditoría de la plataforma, con la persona que actúa, el grupo y los identificadores involucrados, y un evento `participant_unlinked` en la línea de tiempo del libro que sube su revisión. Los eventos SHALL NOT contener emails ni nombres.

#### Scenario: Evento de remoción

- **WHEN** la persona titular quita a un integrante
- **THEN** existen un evento `member_removed` y un evento `participant_unlinked`, y la revisión del libro aumentó en uno

#### Scenario: Operación rechazada

- **WHEN** un integrante intenta quitar a otro y el servidor lo rechaza
- **THEN** no se escribe ningún evento ni cambia la revisión del libro

### Requirement: Salir y quitar funcionan en grupos archivados y en el teléfono

Las operaciones SHALL estar disponibles con el grupo archivado. Las pantallas SHALL usar una columna, controles de al menos 44 px y el botón de confirmación separado del de cancelar, sin desborde horizontal en 390 px.

#### Scenario: Grupo archivado

- **WHEN** un integrante sale de un grupo archivado
- **THEN** la salida se completa

#### Scenario: Teléfono

- **WHEN** se abre la pantalla de salida en 390 px
- **THEN** no hay desplazamiento horizontal y los botones miden al menos 44 px
