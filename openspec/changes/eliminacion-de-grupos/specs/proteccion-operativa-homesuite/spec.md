## MODIFIED Requirements

### Requirement: Mantenimiento elimina sólo datos efímeros

HomeSuite SHALL ejecutar mantenimiento programado para purgar sesiones vencidas y
marcar invitaciones vencidas. SHALL conservar invitaciones resueltas, auditoría y
toda historia financiera, con una única excepción: SHALL purgar físicamente, junto
con su historia, los grupos cuya eliminación tenga 30 días o más.

#### Scenario: Sesión vencida antigua
- **WHEN** el cron encuentra una sesión cuya ventana de conservación terminó
- **THEN** elimina esa sesión sin modificar usuario, membresías ni grupos

#### Scenario: Invitación pendiente vencida
- **WHEN** el cron encuentra una invitación pendiente después de `expires_at`
- **THEN** la marca `expired` y registra el cambio sin crear membresía

#### Scenario: Grupo eliminado hace 30 días
- **WHEN** el cron encuentra un grupo eliminado hace 30 días o más
- **THEN** lo purga por completo y deja solo un registro mínimo sin contenido

#### Scenario: Grupo vivo o dentro de la ventana
- **WHEN** el cron corre con un grupo vivo o eliminado hace menos de 30 días
- **THEN** no modifica ninguna de sus filas
