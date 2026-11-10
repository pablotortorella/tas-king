## Purpose

Definir el acceso de cuentas de HomeSuite a TasKing, recuperando sus tableros previos y conservando la autorización propia de cada tablero.

## ADDED Requirements

### Requirement: Acceso con la cuenta de HomeSuite

TasKing integrado SHALL aceptar la sesión vigente de HomeSuite sin un segundo login, sin autorización global adicional y sin exigir crear o integrar un grupo. Sin sesión SHALL solicitar el acceso de HomeSuite con retorno seguro a `/tareas`.

#### Scenario: Cuenta sin autorización global ni grupos
- **WHEN** una cuenta válida de HomeSuite que no figura en la antigua lista de TasKing entra a `/tareas` sin pertenecer a grupos
- **THEN** puede usar TasKing y acceder a su tablero personal

#### Scenario: Entrada sin sesión
- **WHEN** una persona abre `/tareas` sin sesión de HomeSuite
- **THEN** inicia el acceso de HomeSuite y vuelve a Tareas al completarlo, sin usar la cookie heredada

### Requirement: Recuperación de tableros existentes con la misma cuenta

El sistema SHALL recuperar el tablero personal y todas las membresías vigentes de TasKing al autenticar la misma cuenta de Google. SHALL admitir cuentas de HomeSuite creadas antes o después del traslado. Para el primer vínculo heredado SHALL usar exclusivamente la identidad y el email verificado obtenidos de Google por el servidor, nunca un email declarado por el cliente. Una vez vinculado SHALL conservar el acceso mediante la identidad estable de HomeSuite aunque Google cambie el email de contacto. SHALL impedir vincular una identidad heredada ya reclamada a otra cuenta; los conflictos SHALL conservar datos y permisos sin conceder acceso ni fusionar identidades automáticamente.

#### Scenario: Cuenta de HomeSuite ya existente
- **WHEN** una persona con cuenta en ambas aplicaciones entra a TasKing integrado autenticada con la misma cuenta de Google y el email verificado coincide con el registro heredado
- **THEN** ve su tablero personal existente y sus tableros compartidos con los mismos roles

#### Scenario: Alta de HomeSuite posterior al traslado
- **WHEN** alguien cuyos datos de TasKing fueron trasladados crea después su cuenta de HomeSuite con la misma cuenta de Google
- **THEN** recupera su tablero personal y sus membresías conservadas aunque aún no tenía usuario de HomeSuite al trasladarlas

#### Scenario: Suplantación de email
- **WHEN** una sesión envía el email de otra persona en el cuerpo, parámetros o cabeceras de una petición de Tareas
- **THEN** ese dato no vincula la cuenta ni concede acceso a tableros ajenos

#### Scenario: Cambio de email después de la vinculación
- **WHEN** Google devuelve el mismo `sub` con otro email verificado para una cuenta ya vinculada
- **THEN** conserva los mismos tableros y roles sin reclamar los datos heredados de otra identidad por el email nuevo

#### Scenario: Identidad heredada ya vinculada
- **WHEN** otra identidad de HomeSuite intenta reclamar un registro heredado ya vinculado
- **THEN** se rechaza el vínculo, se informa el conflicto sin revelar tableros y se preserva la relación existente

### Requirement: Tablero personal único y persistente

Cada persona que entra a TasKing SHALL disponer de un único tablero personal no eliminable. El sistema SHALL recuperar primero el existente y crear uno con las columnas predeterminadas actuales sólo si no existe, de forma atómica e idempotente ante concurrencia o reintentos. La importación incompleta o un conflicto SHALL impedir crear un sustituto que oculte un tablero previo.

#### Scenario: Persona nueva
- **WHEN** una cuenta sin datos previos entra por primera vez a TasKing ya habilitado
- **THEN** obtiene un tablero personal vacío con las columnas predeterminadas actuales

#### Scenario: Primer acceso concurrente
- **WHEN** dos pestañas de la misma cuenta entran por primera vez a TasKing simultáneamente
- **THEN** ambas recuperan el mismo tablero personal con una sola membresía de titular y sin columnas duplicadas

#### Scenario: Persona que regresa
- **WHEN** alguien con tablero personal trasladado vuelve a entrar o reintenta una petición
- **THEN** conserva ese tablero, su contenido y su identificador, sin un personal adicional

#### Scenario: Eliminación del personal
- **WHEN** su titular intenta eliminar el tablero personal
- **THEN** el servidor rechaza la operación y conserva el tablero

### Requirement: Colaboración exclusiva por tablero

TasKing SHALL autorizar en servidor mediante membresías `owner`/`member` del tablero, independientes de grupos. SHALL conservar las facultades actuales de ambos roles: quien es titular administra el tablero y sus integrantes; un integrante conserva la colaboración existente sin obtener facultades de titular. Invitar SHALL mantener el flujo actual de incorporación por email, sin introducir aceptación de invitaciones de grupo. SHALL conservar acceso pendiente para emails de personas sin cuenta HomeSuite, sin fabricarles cuentas autenticadas. Quitar una membresía SHALL revocar los siguientes accesos al tablero y sus archivos aunque la sesión de HomeSuite continúe vigente.

#### Scenario: Invitación a persona sin cuenta
- **WHEN** el titular agrega un email a un tablero y esa persona aún no tiene cuenta HomeSuite
- **THEN** queda registrado el acceso del tablero y la persona lo obtiene al autenticarse posteriormente con esa cuenta de Google, sin aceptar una invitación de grupo

#### Scenario: Grupos y tableros con personas diferentes
- **WHEN** dos personas comparten un grupo de Cuentas Claras pero sólo una tiene membresía en un tablero
- **THEN** sólo esa persona accede al tablero; alguien con membresía del tablero y sin grupo compartido también accede

#### Scenario: Integrante intenta administrar
- **WHEN** un integrante intenta invitar o quitar personas, cambiar opciones reservadas al titular o eliminar el tablero
- **THEN** el servidor rechaza la operación conforme a los permisos actuales

#### Scenario: Revocación con sesión activa
- **WHEN** el titular quita a un integrante que mantiene abierta una sesión HomeSuite
- **THEN** sus siguientes lecturas y escrituras, exportaciones y descargas del tablero son denegadas

#### Scenario: Recurso relacionado de otro tablero
- **WHEN** una petición autorizada para un tablero usa una tarjeta, columna, etiqueta, objetivo, checklist o adjunto de otro tablero sin acceso
- **THEN** el servidor rechaza la operación sin leer ni modificar el recurso ajeno
