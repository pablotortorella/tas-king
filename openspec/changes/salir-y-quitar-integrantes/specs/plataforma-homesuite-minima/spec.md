## MODIFIED Requirements

### Requirement: Roles iniciales preservan una titularidad transferible

Cada membresía SHALL ser `owner` o `member`. Sólo el titular puede administrar
el grupo e invitaciones; integrantes pueden acceder al grupo cuando su membresía
está vigente. La titularidad SHALL poder transferirse a otro integrante con cuenta
sin reescribir datos de Cuentas Claras: la persona titular cede la titularidad en
una operación atómica, auditada y sin aceptación de quien la recibe, y el grupo
SHALL tener siempre exactamente una persona titular.

#### Scenario: El titular renombra el grupo

- **WHEN** el titular actualiza el nombre de su grupo
- **THEN** el cambio queda disponible para sus integrantes y la acción queda
  auditada

#### Scenario: Un integrante intenta renombrar el grupo

- **WHEN** un integrante intenta cambiar el nombre del grupo
- **THEN** el servidor rechaza la operación y conserva el nombre anterior

#### Scenario: La titularidad se transfiere

- **WHEN** el titular cede la titularidad a otro integrante con cuenta
- **THEN** ese integrante pasa a titular, quien cedía pasa a integrante, el grupo conserva una única persona titular y la acción queda auditada
