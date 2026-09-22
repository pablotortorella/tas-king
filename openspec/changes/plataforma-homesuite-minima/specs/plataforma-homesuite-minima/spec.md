## ADDED Requirements

### Requirement: HomeSuite mantiene identidad estable y sesión aislada

La aplicación SHALL autenticar inicialmente sólo con Google OAuth. SHALL vincular
la persona al claim `sub` validado del ID token y SHALL requerir que el email esté
verificado antes de usarlo para invitaciones. La sesión SHALL usar una cookie
`__Host-homesuite_session` exclusiva de `app.homesuite.info`, con `Secure`,
`HttpOnly`, `SameSite=Lax` y `Path=/`, sin atributo `Domain`.

#### Scenario: Una persona inicia sesión por primera vez

- **WHEN** completa OAuth con un ID token válido y email verificado
- **THEN** HomeSuite crea o recupera su usuario por `sub`, inicia una sesión
  host-only y no concede acceso a espacios ajenos

#### Scenario: El proveedor declara un email nuevo para el mismo sub

- **WHEN** la persona vuelve a iniciar sesión con el mismo `sub` y otro email
  verificado
- **THEN** HomeSuite conserva su usuario y membresías, y actualiza su dato de
  contacto sin crear otra identidad

#### Scenario: Un retorno OAuth intenta salir de la app

- **WHEN** el parámetro `returnTo` contiene una URL absoluta o un origen externo
- **THEN** HomeSuite lo rechaza y redirige sólo a una ruta interna segura

### Requirement: Una persona crea un espacio privado de Cuentas Claras

Una persona autenticada SHALL poder crear explícitamente un espacio con nombre
libre y SHALL quedar como su único titular inicial. Crear el espacio y su
membresía SHALL ser atómico. El espacio SHALL exponer Cuentas Claras como estado
vacío, sin inventar movimientos, saldos ni datos financieros.

#### Scenario: Primera persona sin espacios

- **WHEN** una persona autenticada no tiene espacios ni invitaciones pendientes
- **THEN** HomeSuite le solicita un nombre y puede crear un espacio de Cuentas
  Claras donde queda como titular

#### Scenario: Persona ajena consulta un espacio

- **WHEN** una persona sin membresía solicita un recurso de un espacio
- **THEN** el servidor deniega la respuesta sin revelar datos del espacio

### Requirement: El titular administra invitaciones dirigidas por email

El titular SHALL poder crear y cancelar una invitación pendiente para un email de
Google. La invitación SHALL ser específica de un espacio y dirección normalizada;
no habrá enlace, correo automático ni invitación reutilizable. Por cada espacio y
email SHALL existir como máximo una invitación pendiente. Crear, cancelar y sus
actores SHALL quedar auditados.

#### Scenario: Invitar a una persona sin cuenta HomeSuite

- **WHEN** el titular indica un email válido que aún no corresponde a un usuario
- **THEN** HomeSuite registra una invitación pendiente sin requerir alta previa ni
  enviar correo

#### Scenario: Corregir un email equivocado

- **WHEN** el titular cancela una invitación pendiente
- **THEN** esa dirección ya no puede aceptarla, la cancelación permanece trazable
  y el titular puede crear una invitación nueva para otra dirección

#### Scenario: Un integrante intenta administrar participantes

- **WHEN** una persona con rol integrante intenta crear o cancelar una invitación
- **THEN** el servidor rechaza la operación

### Requirement: La invitación se acepta de forma explícita y privada

HomeSuite SHALL presentar una invitación pendiente sólo a la persona cuyo email
verificado coincida, antes de otorgarle membresía. Antes de aceptar SHALL revelar
sólo el nombre del espacio, el nombre de quien invitó y que dará acceso a Cuentas
Claras. La persona SHALL poder aceptar o rechazar; la aceptación crea su
membresía y cambia el estado de la invitación atómicamente.

#### Scenario: Aceptar una invitación propia

- **WHEN** la persona invitada acepta una invitación pendiente vigente
- **THEN** obtiene rol integrante en ese espacio y puede entrar a Cuentas Claras

#### Scenario: Rechazar una invitación propia

- **WHEN** la persona invitada rechaza una invitación pendiente vigente
- **THEN** no se crea membresía y el rechazo queda trazable

#### Scenario: Una persona consulta una invitación de otro email

- **WHEN** una persona autenticada no coincide con el email verificado de una
  invitación pendiente
- **THEN** no ve la invitación ni información sobre su espacio o titular

### Requirement: Roles iniciales preservan una titularidad transferible

Cada membresía SHALL ser `owner` o `member`. Sólo el titular puede administrar
el espacio e invitaciones en este corte; integrantes pueden acceder al espacio
cuando su membresía está vigente. El modelo SHALL conservar la relación de rol de
forma que una futura operación de transferencia pueda reemplazar al titular sin
reescribir datos de Cuentas Claras, aunque dicha operación no forme parte de este
change.

#### Scenario: El titular renombra el espacio

- **WHEN** el titular actualiza el nombre de su espacio
- **THEN** el cambio queda disponible para sus integrantes y la acción queda
  auditada

#### Scenario: Un integrante intenta renombrar el espacio

- **WHEN** un integrante intenta cambiar el nombre del espacio
- **THEN** el servidor rechaza la operación y conserva el nombre anterior
