## Purpose

Define los avisos mínimos de operación de HomeSuite en producción (respaldo fallido, aplicación caída y respaldo desactualizado), la revisión semanal de señales que no alertan y las notificaciones de Cloudflare, con sus límites declarados.

## ADDED Requirements

### Requirement: Una falla del respaldo diario genera un aviso accionable

Cuando el workflow del respaldo diario de producción termine en fallo, el sistema SHALL abrir un issue de GitHub etiquetado `alerta-operativa` y asignado a la persona operadora, con el enlace a la corrida y la fecha UTC. Si ya hay un issue abierto con el mismo título, el sistema SHALL comentar en él en lugar de abrir otro. El aviso SHALL NOT incluir registros de la corrida, emails ni nombres de grupos, porque el repositorio es público.

#### Scenario: Falla el respaldo

- **WHEN** la corrida programada del respaldo termina con error
- **THEN** existe un issue abierto «Alerta: el respaldo diario de producción falló» asignado a la persona operadora, con el enlace a esa corrida y sin texto de logs

#### Scenario: Segunda falla sin atender la primera

- **WHEN** el respaldo vuelve a fallar con el issue anterior todavía abierto
- **THEN** se agrega un comentario con la nueva corrida y no se abre otro issue

#### Scenario: Respaldo exitoso

- **WHEN** el respaldo termina en éxito
- **THEN** no se crea ningún issue ni comentario

### Requirement: Una caída de la aplicación se detecta con un chequeo periódico de salud

El sistema SHALL consultar `/healthz` de la aplicación de producción al menos cada 30 minutos desde GitHub Actions. Un chequeo SHALL considerar fallida la consulta si, tras tres intentos separados, la respuesta no es 200 con el cuerpo esperado. Ante una falla SHALL abrir o comentar un issue `alerta-operativa`, y cuando la aplicación vuelva a responder SHALL comentar la recuperación y cerrar ese issue.

#### Scenario: La aplicación no responde

- **WHEN** los tres intentos de `/healthz` fallan por tiempo o por un código distinto de 200
- **THEN** se abre el issue «Alerta: /healthz de producción no responde» asignado a la persona operadora

#### Scenario: Un tropiezo de red aislado

- **WHEN** el primer intento falla pero el segundo responde 200 con el cuerpo esperado
- **THEN** no se crea ningún issue

#### Scenario: Recuperación

- **WHEN** hay un issue abierto de caída y `/healthz` vuelve a responder 200
- **THEN** el issue recibe un comentario de recuperación y se cierra

### Requirement: Se controla la antigüedad del último respaldo exitoso

El sistema SHALL verificar una vez por día que exista una corrida exitosa del respaldo de producción con menos de 26 horas de antigüedad. Si no existe o es más antigua, SHALL abrir o comentar un issue `alerta-operativa`. El control SHALL detectar tanto un respaldo que falló como uno que no corrió (workflow desactivado o variable de habilitación distinta de `true`).

#### Scenario: Respaldo al día

- **WHEN** la última corrida exitosa tiene 14 horas de antigüedad
- **THEN** el control termina sin abrir ningún issue

#### Scenario: Un día sin respaldo

- **WHEN** la última corrida exitosa tiene más de 26 horas
- **THEN** se abre o comenta el issue «Alerta: no hay un respaldo de producción reciente»

#### Scenario: El respaldo está deshabilitado

- **WHEN** la variable `HOMESUITE_PROD_BACKUPS_ENABLED` no vale `true` y por eso el job se omite durante más de 26 horas
- **THEN** el control abre el issue aunque no haya habido ninguna corrida fallida

### Requirement: Existe una cita semanal para las señales que no alertan

El sistema SHALL abrir cada semana un issue de revisión asignado a la persona operadora, con la lista de comprobación de `docs/HOMESUITE_VIGILANCIA.md`: eventos `slow_book_open`, `unhandled_error` y respuestas 5xx, presencia diaria de `maintenance_completed`, respaldos de la semana, incidentes de Cloudflare y workflows de vigilancia activos. Los eventos `slow_book_open` y los 5xx SHALL revisarse en esa cita y SHALL NOT generar alertas individuales.

#### Scenario: Llega el lunes

- **WHEN** se cumple el horario semanal
- **THEN** se abre un issue «Revisión semanal de operación» con las comprobaciones de la lista

#### Scenario: Un 5xx aislado

- **WHEN** un usuario recibe un error 500 en producción
- **THEN** no se abre ningún issue; el evento se revisa en la siguiente cita semanal

### Requirement: Las notificaciones de Cloudflare disponibles quedan configuradas y registradas

La persona operadora SHALL configurar en el panel de Cloudflare las notificaciones que el plan permita (al menos incidentes, mantenimientos, ataque DDoS HTTP y certificado Universal SSL) con destino a su correo, y SHALL registrar en `docs/HOMESUITE_VIGILANCIA.md` la fecha, lo activado, lo que el panel no ofreció y lo que no pudo verificarse. El documento SHALL NOT afirmar que existe una alerta de errores del Worker mientras no se haya comprobado en el panel.

#### Scenario: Registro de la configuración

- **WHEN** se termina la configuración de notificaciones
- **THEN** el documento lista cada notificación activada con su fecha y una sección de lo no verificado

#### Scenario: El panel no ofrece alertas de Workers

- **WHEN** el plan no ofrece notificaciones de errores de Workers o D1
- **THEN** el documento lo declara y deja esas señales en la revisión semanal

### Requirement: La vigilancia usa el mínimo privilegio y declara sus límites

Los workflows de vigilancia SHALL usar únicamente `GITHUB_TOKEN` con permisos declarados por job y SHALL NOT recibir el token de Cloudflare ni otros secretos. El documento de vigilancia SHALL declarar qué no se vigila: errores 5xx de personas usuarias, ausencia del cron de mantenimiento, `slow_book_open`, caída de GitHub Actions y desactivación de workflows programados por inactividad.

#### Scenario: Revisión de permisos

- **WHEN** una prueba lee los workflows de vigilancia
- **THEN** ninguno referencia secretos distintos de `GITHUB_TOKEN` y ningún job declara permisos fuera de `issues`, `actions` y `contents: read`

#### Scenario: Límites visibles

- **WHEN** se abre `docs/HOMESUITE_VIGILANCIA.md`
- **THEN** existe una sección «Qué no se vigila» con las señales listadas
