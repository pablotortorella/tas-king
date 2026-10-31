## ADDED Requirements

### Requirement: La pantalla de personas distingue acceso de participación

El libro SHALL listar a sus participantes con su rol (propietario o miembro) y su
estado (con cuenta, invitación pendiente o sin cuenta). Un participante sin cuenta
SHALL figurar en pagos, repartos y saldos aunque no tenga acceso.

#### Scenario: Ver el grupo

- **WHEN** el titular abre «Personas»
- **THEN** ve a Pablo como propietario, a Laura como miembro, a Ana con invitación
  pendiente y a Mateo sin cuenta

### Requirement: La invitación se asocia a un participante

El propietario SHALL poder invitar por correo asociando la invitación a un
participante existente o nuevo. Al aceptarla, la cuenta SHALL vincularse a ese
participante en la misma transacción que crea la membresía. La aceptación NO SHALL
trasladar saldos entre participantes distintos ni fusionarlos.

#### Scenario: Aceptar una invitación asociada

- **WHEN** Ana acepta la invitación asociada al participante «Ana»
- **THEN** su cuenta queda vinculada a ese participante y los saldos y el
  historial de Ana no cambian

#### Scenario: La cuenta ya tiene otro participante

- **WHEN** quien acepta ya está vinculado a otro participante del mismo libro
- **THEN** la aceptación se detiene y pide una decisión explícita, sin fusionar nada

### Requirement: Un participante sin cuenta puede vincularse después

El propietario SHALL poder asociar a un participante sin cuenta con una invitación
posterior. El participante conserva su historial y sus saldos.

#### Scenario: Vincular a Mateo

- **WHEN** el titular invita al correo de Mateo asociando al participante «Mateo» y
  la persona acepta
- **THEN** Mateo tiene acceso y su saldo anterior permanece intacto

### Requirement: Los permisos dependen del rol y se aplican en el servidor

El propietario SHALL poder administrar personas, archivar el grupo y corregir o
anular cualquier movimiento. Un miembro SHALL poder leer, comentar y crear
movimientos, y corregir o anular los propios. Un miembro NO SHALL administrar
personas ni invitaciones.

#### Scenario: Miembro intenta invitar

- **WHEN** un miembro intenta crear una invitación
- **THEN** el servidor la rechaza

#### Scenario: Miembro corrige un movimiento ajeno

- **WHEN** un miembro intenta corregir un movimiento que creó otra persona
- **THEN** el servidor la rechaza y el movimiento no cambia
