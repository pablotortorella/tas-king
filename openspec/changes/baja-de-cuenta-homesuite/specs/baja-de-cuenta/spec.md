## Purpose

Define cómo una persona da de baja su cuenta de HomeSuite desde «Mi perfil», qué se exige antes, qué datos personales dejan de ser legibles, qué ocurre en los grupos de otras personas y cómo se evita que una restauración de respaldo resucite la cuenta. TasKing queda fuera de alcance.

## ADDED Requirements

### Requirement: La baja de cuenta es de autoservicio, desde «Mi perfil», con confirmación

La persona autenticada SHALL poder dar de baja su propia cuenta desde una pantalla enlazada en «Mi perfil». La pantalla SHALL explicar qué ocurre, listar sus grupos, ofrecer la exportación de cada uno y exigir escribir «eliminar mi cuenta» y tener una sesión iniciada en los últimos 10 minutos; si la sesión es más antigua, SHALL pedir iniciar sesión de nuevo con Google antes de continuar. Nadie SHALL poder dar de baja la cuenta de otra persona. El sistema SHALL NOT ofrecer recuperar la cuenta tras la baja.

#### Scenario: Baja con la frase correcta

- **WHEN** una persona sin grupos como titular escribe la frase, tiene una sesión reciente y confirma
- **THEN** la baja se ejecuta y la sesión deja de existir

#### Scenario: Frase incorrecta

- **WHEN** la persona escribe otra frase y confirma
- **THEN** el servidor rechaza la baja y la cuenta no cambia

#### Scenario: Sesión antigua

- **WHEN** la sesión tiene más de 10 minutos y la persona abre la pantalla de baja
- **THEN** se le pide iniciar sesión de nuevo con Google y vuelve a la pantalla de baja

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión envía el formulario de baja
- **THEN** se le pide iniciar sesión y no cambia ninguna cuenta

### Requirement: Una persona titular debe transferir o eliminar sus grupos antes

La baja SHALL rechazarse mientras la cuenta sea titular de algún grupo vivo. La pantalla SHALL listar esos grupos con acciones para transferir la titularidad o eliminarlo. Un grupo en su ventana de 30 días de eliminación SHALL considerarse resuelto, con una advertencia de que nadie podrá restaurarlo. La baja SHALL NOT transferir ni eliminar grupos por su cuenta.

#### Scenario: Titular de un grupo

- **WHEN** una persona titular de un grupo intenta dar de baja su cuenta
- **THEN** el servidor la rechaza y la pantalla lista el grupo con las acciones transferir y eliminar

#### Scenario: Grupo ya eliminado

- **WHEN** la única titularidad que le quedaba está en un grupo eliminado hace 5 días
- **THEN** la baja puede continuar y la pantalla advierte que el grupo no podrá restaurarse y se purgará a los 30 días

#### Scenario: Grupo propio sin otras personas

- **WHEN** la persona es la única integrante de su grupo
- **THEN** la pantalla ofrece eliminarlo y no ofrece transferirlo

### Requirement: La cuenta deja de ser legible y de poder entrar de inmediato

Al ejecutar la baja, el sistema SHALL borrar todas las sesiones de la cuenta y reemplazar su identificador de Google, su email, su nombre, su foto y su perfil por valores inertes y únicos que no contengan datos personales, y SHALL marcar la cuenta como dada de baja. Quien vuelva a entrar con el mismo Google SHALL crear una cuenta nueva sin relación con la anterior.

#### Scenario: Datos inertes

- **WHEN** termina la baja de una cuenta con email y nombre
- **THEN** ni `users` ni `user_profiles` contienen ese email, ese nombre, ese identificador de Google ni esa foto

#### Scenario: Volver a entrar

- **WHEN** la misma persona inicia sesión de nuevo con la misma cuenta de Google
- **THEN** se crea una cuenta nueva sin grupos ni relación con la anterior

### Requirement: Los grupos ajenos conservan sus saldos y muestran a una «Persona eliminada»

Al ejecutar la baja, la cuenta SHALL salir de todos los grupos donde era integrante con la misma operación que «salir del grupo». La persona del grupo vinculada a la cuenta SHALL renombrarse «Persona eliminada» (con número si ya existe otra en el grupo), quedar sin cuenta y conservar su historial y su saldo. El nombre de quien cargó o revisó cada movimiento SHALL mostrarse como «Persona eliminada». Ningún importe, fecha ni saldo de ningún grupo SHALL cambiar.

#### Scenario: Saldos intactos en un grupo ajeno

- **WHEN** una integrante con saldo a favor de 50.000 COP da de baja su cuenta
- **THEN** en el grupo los saldos por persona y moneda son los mismos y figura «Persona eliminada» con 50.000 COP

#### Scenario: Dos personas eliminadas en el mismo grupo

- **WHEN** dos integrantes de un mismo grupo dan de baja sus cuentas
- **THEN** el grupo muestra «Persona eliminada» y «Persona eliminada 2» y ambos saldos se conservan

#### Scenario: Nombre en movimientos y revisiones

- **WHEN** se abre un movimiento que cargó la cuenta dada de baja
- **THEN** el detalle y el historial muestran «Persona eliminada» como autora

### Requirement: Los nombres embebidos en historia inmutable se reescriben solo durante una baja y sin cambiar nada más

Durante una baja en curso, el sistema SHALL permitir reescribir únicamente el nombre de la cuenta contenido en los eventos del libro de renombre de su persona y en las instantáneas de revisión de movimientos que la cuenta cargó. La base SHALL abortar cualquier otro `UPDATE` sobre `ledger_events` y `entry_revisions`, incluido uno que cambie cualquier columna distinta del JSON afectado, y cualquier `UPDATE` cuando no haya una baja en curso para la fila.

#### Scenario: Evento de renombre

- **WHEN** la baja procesa un evento de renombre de la persona de la cuenta
- **THEN** el JSON ya no contiene el nombre anterior ni el nuevo, y el resto de la fila es idéntico

#### Scenario: Intento de cambiar un importe

- **WHEN** durante una baja en curso se intenta actualizar el importe de una revisión
- **THEN** la base aborta la operación

#### Scenario: Sin baja en curso

- **WHEN** se intenta actualizar el JSON de un evento del libro sin que haya una baja en curso para su persona
- **THEN** la base aborta la operación

#### Scenario: Exportación posterior

- **WHEN** una persona de un grupo afectado exporta el grupo después de la baja
- **THEN** el JSON no contiene el nombre ni el email de la cuenta dada de baja

### Requirement: Las invitaciones asociadas se limpian

Al ejecutar la baja, el sistema SHALL cancelar las invitaciones pendientes que envió la cuenta y SHALL reemplazar por un valor inerte el email de las invitaciones dirigidas a la cuenta, de modo que el email no permanezca en la tabla.

#### Scenario: Invitación recibida

- **WHEN** la cuenta tenía una invitación pendiente a otro grupo y da de baja la cuenta
- **THEN** la invitación se cancela y su email ya no coincide con el de la cuenta

### Requirement: La baja es resumible y deja un registro mínimo

La baja SHALL ejecutarse en fases idempotentes, de modo que una interrupción pueda retomarse sin duplicar ni omitir efectos, y el mantenimiento diario SHALL completar las bajas interrumpidas. El sistema SHALL conservar en `account_erasures` solo un identificador opaco de la cuenta, el estado, las fechas y los conteos, sin datos personales.

#### Scenario: Corte entre fases

- **WHEN** la baja se interrumpe después de anonimizar la cuenta y antes de salir de los grupos
- **THEN** la cuenta ya no puede entrar y el siguiente mantenimiento completa la salida de los grupos sin errores

#### Scenario: Registro sin datos personales

- **WHEN** termina una baja
- **THEN** `account_erasures` contiene el identificador, el estado, las fechas y los conteos y ningún email ni nombre

### Requirement: Cada baja queda auditada y recuperable tras restaurar un respaldo

El sistema SHALL registrar `account_deletion_requested` y `account_deleted` en la auditoría de la plataforma y, por cada grupo abandonado, `member_left` con motivo `account_deleted`, sin emails ni nombres. El procedimiento de recuperación SHALL reaplicar las bajas registradas en `account_erasures` después de restaurar un respaldo anterior y antes de reabrir el servicio, y SHALL ensayarse.

#### Scenario: Reaplicar tras restaurar

- **WHEN** se restaura un respaldo tomado antes de una baja y se reaplican las bajas registradas
- **THEN** la cuenta vuelve a estar anonimizada, sin sesiones y fuera de sus grupos

### Requirement: Una prueba cubre todas las referencias a la cuenta

Una prueba SHALL enumerar desde el esquema todas las columnas que referencian a `users` y verificar que, tras la baja, cada una sigue siendo válida y no expone datos personales. Agregar una referencia nueva sin contemplarla en la baja SHALL hacer fallar la prueba.

#### Scenario: Tabla nueva con referencia a usuarios

- **WHEN** se agrega una tabla con una columna que referencia a `users` y la baja no la contempla
- **THEN** la prueba falla señalando la columna

### Requirement: TasKing y las herramientas sin datos por persona quedan fuera de la baja, y el texto lo dice

La pantalla de baja SHALL indicar que Fun TasKing tiene sesión y cuenta propias y que esta baja no las afecta, y SHALL indicar cómo pedir esa baja. La baja SHALL NOT modificar nada de TasKing.

#### Scenario: Aviso sobre TasKing

- **WHEN** la persona abre la pantalla de baja
- **THEN** ve que su cuenta de Fun TasKing no se elimina y cómo solicitarlo

### Requirement: La baja funciona en el teléfono

El enlace «Eliminar mi cuenta» SHALL ser el último de «Mi perfil» y la pantalla de baja SHALL usar una columna, controles de al menos 44 px y el botón de baja apartado del de cancelar, sin desborde horizontal en 390 px de ancho ni ventanas modales.

#### Scenario: Baja desde el teléfono

- **WHEN** una persona abre la pantalla de baja en 390 px con tres grupos
- **THEN** ve los grupos con sus acciones y la confirmación sin desplazarse horizontalmente y los controles miden al menos 44 px
