## ADDED Requirements

### Requirement: Toda migración remota parte de un punto recuperable

El despliegue de HomeSuite SHALL obtener un bookmark de D1 y exportar la base del
ambiente antes de aplicar migraciones. El respaldo SHALL quedar fuera de Git y no
contener secretos de configuración.

#### Scenario: Falla el respaldo previo
- **WHEN** bookmark o exportación fallan antes de una migración remota
- **THEN** el despliegue se detiene sin aplicar migraciones ni publicar Worker

### Requirement: Los respaldos se prueban sin tocar la base remota

HomeSuite SHALL ofrecer un ensayo que importe un dump en D1 local aislada y
compruebe esquema, integridad y conteos esenciales. El ensayo MUST NOT restaurar
sobre staging o producción.

#### Scenario: Dump restaurable
- **WHEN** el operador ejecuta el restore drill sobre una exportación válida
- **THEN** una D1 local nueva carga el dump y supera las comprobaciones de integridad

### Requirement: Ciclo de vida de datos explícito

La operación SHALL documentar finalidad, retención, exportación y eliminación por
clase de dato. Staging SHALL usar datos sintéticos y producción SHALL permanecer
bloqueada hasta tener backup externo y flujos de exportación/eliminación probados.

#### Scenario: Solicitud de usar datos reales en staging
- **WHEN** no existe autorización explícita ni procedimiento de eliminación
- **THEN** la política exige usar datos sintéticos y rechaza copiar producción

#### Scenario: Preparación de producción
- **WHEN** backup externo o restore drill del ambiente no están comprobados
- **THEN** HomeSuite no se declara lista para datos financieros reales
