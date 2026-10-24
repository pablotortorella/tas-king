## ADDED Requirements

### Requirement: El libro se puede exportar completo

Cualquier miembro SHALL poder exportar la información que ve del libro. La
exportación JSON SHALL conservar entidades, ids, monedas, revisiones, comentarios y
la auditoría necesaria, con un esquema versionado. La exportación CSV SHALL
priorizar la lectura y usar archivos separados para movimientos, aportes o recibos
y repartos. Los datos exportados SHALL reproducir los saldos del libro.

#### Scenario: Exportar y recalcular

- **WHEN** se exporta un libro y se recalculan saldos desde los movimientos vigentes exportados
- **THEN** los saldos por persona y moneda coinciden con los del libro

#### Scenario: Persona ajena

- **WHEN** una persona sin membresía pide la exportación
- **THEN** el servidor deniega sin datos

### Requirement: Archivar vuelve el grupo de sólo lectura

El propietario SHALL poder archivar el grupo y restaurarlo. Un libro archivado SHALL
rechazar toda escritura monetaria y de personas con un error explícito, y SHALL
seguir permitiendo lectura y exportación. Archivar y restaurar SHALL quedar
auditados. El flujo habitual NO SHALL ofrecer eliminar un libro con historia.

#### Scenario: Escribir en un libro archivado

- **WHEN** un miembro intenta agregar un gasto a un libro archivado
- **THEN** el servidor lo rechaza explicando que el grupo está archivado

#### Scenario: Restaurar

- **WHEN** el propietario restaura el grupo
- **THEN** vuelve a aceptar escrituras y conserva toda su historia
