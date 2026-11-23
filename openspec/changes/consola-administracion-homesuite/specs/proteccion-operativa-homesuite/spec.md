## MODIFIED Requirements

### Requirement: Mantenimiento elimina sólo datos efímeros

HomeSuite SHALL ejecutar mantenimiento programado para purgar sesiones vencidas,
marcar invitaciones vencidas, borrar las marcas de personas distintas de los
períodos de calendario ya cerrados y guardar la foto diaria de uso de la suite.
SHALL conservar invitaciones resueltas, auditoría, toda historia financiera, los
contadores de uso, los contadores de personas por período y las fotos diarias.

#### Scenario: Sesión vencida antigua
- **WHEN** el cron encuentra una sesión cuya ventana de conservación terminó
- **THEN** elimina esa sesión sin modificar usuario, membresías ni grupos

#### Scenario: Invitación pendiente vencida
- **WHEN** el cron encuentra una invitación pendiente después de `expires_at`
- **THEN** la marca `expired` y registra el cambio sin crear membresía

#### Scenario: Marcas de un período cerrado
- **WHEN** el cron corre después del fin de una semana, un mes, un trimestre o un año
- **THEN** borra las marcas de ese período y conserva su contador de personas

#### Scenario: Período en curso
- **WHEN** el cron corre a mitad de un trimestre
- **THEN** conserva las marcas del trimestre y del año en curso
