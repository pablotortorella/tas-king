## Purpose

Define cómo la persona titular cede la titularidad a otro integrante y las reglas que garantizan que un grupo siempre tenga exactamente una persona titular.

## ADDED Requirements

### Requirement: La persona titular puede ceder la titularidad a otro integrante

La persona titular SHALL poder transferir la titularidad a otro integrante con cuenta desde una pantalla de confirmación. Al confirmar, el sistema SHALL, en una sola operación atómica, convertir a quien cede en integrante y a quien recibe en titular, y registrar un evento `ownership_transferred`. La transferencia SHALL surtir efecto de inmediato, sin aceptación de quien la recibe.

#### Scenario: Transferir la titularidad

- **WHEN** la persona titular confirma ceder la titularidad a otro integrante
- **THEN** esa persona pasa a ser titular, quien cedía pasa a integrante y existe un evento de auditoría con ambos identificadores

#### Scenario: Destino que no integra el grupo

- **WHEN** se envía una transferencia a una cuenta que no es integrante del grupo
- **THEN** el servidor la rechaza y no cambia ningún rol

#### Scenario: Un integrante intenta transferir

- **WHEN** un integrante que no es titular envía una transferencia
- **THEN** el servidor responde 403 y no cambia nada

### Requirement: Un grupo siempre tiene exactamente una persona titular

El sistema SHALL garantizar en todo momento observable que cada grupo tiene una única persona titular, incluso con pedidos concurrentes. Una persona titular SHALL NOT poder salir del grupo ni ser quitada mientras sea titular. El rechazo SHALL explicar que debe transferir la titularidad primero.

#### Scenario: La titular intenta salir

- **WHEN** la persona titular intenta salir del grupo
- **THEN** el servidor la rechaza con un mensaje que la lleva a transferir la titularidad

#### Scenario: Transferencia y salida simultáneas

- **WHEN** la persona titular transfiere la titularidad a un integrante mientras ese integrante envía su salida
- **THEN** el grupo termina con exactamente una persona titular y la auditoría describe lo que realmente ocurrió

#### Scenario: Grupo con un solo integrante

- **WHEN** la persona titular es la única integrante y no hay a quién transferir
- **THEN** la pantalla de transferencia lo indica y ofrece archivar el grupo como único camino disponible

### Requirement: La transferencia conserva la persona del grupo y no toca los saldos

Quien cede la titularidad SHALL conservar su persona, su historial y su saldo en el grupo. La transferencia SHALL NOT modificar movimientos, revisiones ni saldos.

#### Scenario: Saldos intactos

- **WHEN** se transfiere la titularidad en un grupo con movimientos
- **THEN** los saldos por persona y moneda son los mismos y los permisos de edición cambian solo según el rol nuevo

### Requirement: Transferir la titularidad funciona en grupos archivados y en el teléfono

La transferencia SHALL estar disponible con el grupo archivado. Su pantalla SHALL listar a los integrantes elegibles en una columna con controles de al menos 44 px y SHALL advertir que solo quien recibe la titularidad puede devolverla.

#### Scenario: Pantalla de transferencia en el teléfono

- **WHEN** la persona titular abre la pantalla en 390 px con tres integrantes
- **THEN** los ve como opciones táctiles de al menos 44 px, sin desborde horizontal, y la advertencia es visible antes de confirmar
