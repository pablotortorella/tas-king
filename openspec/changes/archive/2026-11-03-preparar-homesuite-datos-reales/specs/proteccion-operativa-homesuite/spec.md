## ADDED Requirements

### Requirement: HomeSuite limita cuerpos antes de procesarlos

HomeSuite App SHALL rechazar solicitudes mutables cuyo cuerpo declarado exceda el
límite operativo y SHALL mantener límites explícitos por campo después del parseo.

#### Scenario: Payload demasiado grande
- **WHEN** una mutación declara un cuerpo superior a 16 KiB
- **THEN** el Worker responde 413 antes de ejecutar lógica de producto o escribir D1

### Requirement: HomeSuite limita abuso por ruta y sujeto

Staging y producción SHALL aplicar rate limiting independiente al inicio OAuth y
a las mutaciones autenticadas. Excederlo SHALL responder 429 de forma observable
sin revelar identidad ni payload.

#### Scenario: Exceso de intentos OAuth
- **WHEN** una IP supera el límite configurado de inicio de sesión
- **THEN** el Worker responde 429 con `Retry-After` y un identificador de solicitud

#### Scenario: Exceso de mutaciones autenticadas
- **WHEN** una sesión supera el límite configurado de escrituras
- **THEN** HomeSuite rechaza la solicitud antes de modificar datos

### Requirement: Mantenimiento elimina sólo datos efímeros

HomeSuite SHALL ejecutar mantenimiento programado para purgar sesiones vencidas y
marcar invitaciones vencidas. SHALL conservar invitaciones resueltas, auditoría y
toda historia financiera.

#### Scenario: Sesión vencida antigua
- **WHEN** el cron encuentra una sesión cuya ventana de conservación terminó
- **THEN** elimina esa sesión sin modificar usuario, membresías ni grupos

#### Scenario: Invitación pendiente vencida
- **WHEN** el cron encuentra una invitación pendiente después de `expires_at`
- **THEN** la marca `expired` y registra el cambio sin crear membresía
