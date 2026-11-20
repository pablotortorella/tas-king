# proteccion-operativa-homesuite Specification

## Purpose
Protecciones operativas de HomeSuite App: límites de tamaño de las solicitudes antes de procesarlas, límites de abuso por ruta y por sujeto, y un mantenimiento programado que sólo elimina o vence datos efímeros, sin tocar la historia financiera ni los datos de las personas.
## Requirements
### Requirement: HomeSuite limita cuerpos antes de procesarlos

HomeSuite App SHALL mantener un límite general de 16 KiB para mutaciones y límites explícitos por campo después del parseo. SHALL rechazar cuerpos declarados superiores al límite antes de ejecutar lógica de producto o escribir datos y SHALL comprobar también el límite efectivo al leer solicitudes sin tamaño declarado o con tamaño engañoso. Sólo las rutas de importación y subida que lo necesiten SHALL tener presupuestos específicos documentados y acotados: conservar el presupuesto vigente del import financiero y los límites funcionales de archivos de TasKing, con topes de cantidad y procesamiento por solicitud. Esas excepciones SHALL NOT ampliar el límite de otras rutas ni omitir autenticación, autorización, CSRF o rate limiting.

#### Scenario: Payload demasiado grande
- **WHEN** una mutación sin excepción declarada por ruta contiene o declara un cuerpo superior a 16 KiB
- **THEN** el Worker responde 413 antes de ejecutar lógica de producto o escribir datos

#### Scenario: Import financiero existente
- **WHEN** el preview de importación financiera recibe un cuerpo dentro de su presupuesto específico vigente, superior al límite general
- **THEN** conserva su comportamiento y controles actuales sin que el resto de rutas financieras acepte cuerpos más grandes

#### Scenario: Subida de Tareas válida
- **WHEN** una cuenta autorizada envía una subida dentro del presupuesto de su ruta y de los límites de TasKing de 20 MiB por archivo y 10 adjuntos por tarjeta
- **THEN** la petición protegida puede completarse sin ser rechazada sólo por superar 16 KiB

#### Scenario: Solicitud de excepción que excede el presupuesto
- **WHEN** una subida o importación excede el presupuesto específico o sus límites efectivos aunque no declare correctamente el tamaño
- **THEN** se rechaza de forma acotada sin procesar ilimitadamente el cuerpo ni confirmar efectos parciales como éxito

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
