## Purpose

Define cómo una persona da de baja su cuenta de HomeSuite desde «Mi perfil», qué se exige antes, qué datos personales dejan de ser legibles, qué elige sobre su nombre en los grupos de otras personas, cómo se atienden los pedidos por correo y cómo se evita que una restauración de respaldo resucite la cuenta. TasKing queda fuera de alcance.

## ADDED Requirements

### Requirement: La baja de cuenta es de autoservicio, desde «Mi perfil», con confirmación

La persona autenticada SHALL poder dar de baja su propia cuenta desde una pantalla enlazada en «Mi perfil». La pantalla SHALL explicar qué ocurre, listar sus grupos, ofrecer la exportación de cada uno y de sus datos de cuenta, y exigir escribir «eliminar mi cuenta». Si la sesión tiene más de 10 minutos de antigüedad, el sistema SHALL pedir reconfirmar la identidad con Google antes de continuar. Nadie SHALL poder dar de baja la cuenta de otra persona desde la aplicación. El sistema SHALL NOT ofrecer recuperar la cuenta tras la baja. La pantalla SHALL estar disponible aunque haya una versión de términos sin aceptar.

#### Scenario: Baja con la frase correcta y sesión reciente

- **WHEN** una persona sin grupos como titular escribe la frase, tiene una sesión de menos de 10 minutos y confirma
- **THEN** la baja se ejecuta y la sesión deja de existir

#### Scenario: Frase incorrecta

- **WHEN** la persona escribe otra frase y confirma
- **THEN** el servidor rechaza la baja y la cuenta no cambia

#### Scenario: Sesión de más de 10 minutos

- **WHEN** la sesión tiene más de 10 minutos y la persona abre la pantalla de baja
- **THEN** se le pide reconfirmar con Google y vuelve a la pantalla de baja

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

### Requirement: La persona elige qué pasa con su nombre en los grupos de otras personas

La pantalla de baja SHALL ofrecer dos opciones sin ninguna marcada de antemano: conservar su nombre para mostrar con la marca «(cuenta eliminada)», o quitar su nombre, lo que lo reemplaza por «Persona eliminada» (numerada si ya existe otra en el grupo). Si la persona no elige, o si la baja se pide por correo, el sistema SHALL quitar el nombre. El sistema SHALL registrar la elección y su fecha. En ambos casos SHALL conservar la persona del grupo con su historial y su saldo, sin cuenta, y ningún importe, fecha ni saldo de ningún grupo SHALL cambiar.

#### Scenario: Conservar el nombre

- **WHEN** una integrante con saldo a favor de 50.000 COP elige conservar su nombre y confirma la baja
- **THEN** en cada grupo figura «Ana (cuenta eliminada)» sin cuenta con 50.000 COP, y los movimientos que cargó muestran «Ana (cuenta eliminada)» como autora

#### Scenario: Quitar el nombre

- **WHEN** la misma integrante elige quitar su nombre
- **THEN** figura «Persona eliminada» con 50.000 COP, y los movimientos que cargó muestran «Persona eliminada» como autora

#### Scenario: Sin elección

- **WHEN** la persona confirma la baja sin elegir ninguna opción
- **THEN** se quita su nombre y la elección registrada es «quitar»

#### Scenario: Dos personas eliminadas en el mismo grupo

- **WHEN** dos integrantes de un mismo grupo quitan su nombre al dar de baja sus cuentas
- **THEN** el grupo muestra «Persona eliminada» y «Persona eliminada 2» y ambos saldos se conservan

#### Scenario: Ninguna opción marcada

- **WHEN** se abre la pantalla de baja
- **THEN** ninguna de las dos opciones de nombre está seleccionada

### Requirement: La persona del grupo se puede reasociar a una cuenta nueva

La persona del grupo que quedó sin cuenta tras una baja SHALL poder vincularse a una cuenta nueva mediante una invitación ligada a ella, igual que cualquier persona sin cuenta. Si la persona conservó su nombre, la marca «(cuenta eliminada)» SHALL desaparecer al vincularla, y su historial y saldo SHALL permanecer.

#### Scenario: Reasociar tras conservar el nombre

- **WHEN** la persona titular invita a una cuenta nueva ligada a «Ana (cuenta eliminada)» y la invitación se acepta
- **THEN** la persona se muestra como «Ana», con su historial y su saldo, y sin la marca

#### Scenario: Reasociar tras quitar el nombre

- **WHEN** se acepta una invitación ligada a «Persona eliminada»
- **THEN** la cuenta nueva queda vinculada a esa persona, conserva su saldo y la persona titular puede renombrarla

### Requirement: La cuenta deja de ser legible y de poder entrar de inmediato

Al ejecutar la baja, el sistema SHALL borrar todas las sesiones de la cuenta y reemplazar su identificador de Google, su email, su foto, su emoji, su color y su perfil por valores inertes y únicos que no contengan datos personales, SHALL dejar el nombre según la elección y SHALL marcar la cuenta como dada de baja. Quien vuelva a entrar con el mismo Google SHALL crear una cuenta nueva sin relación con la anterior.

#### Scenario: Datos inertes

- **WHEN** termina la baja de una cuenta con email y foto
- **THEN** ni `users` ni `user_profiles` contienen ese email, ese identificador de Google ni esa foto, y el nombre es el elegido

#### Scenario: Volver a entrar

- **WHEN** la misma persona inicia sesión de nuevo con la misma cuenta de Google
- **THEN** se crea una cuenta nueva sin grupos ni relación con la anterior

### Requirement: Los nombres embebidos en historia inmutable se reescriben solo al quitar el nombre y sin cambiar nada más

Cuando la elección sea quitar el nombre, y durante la baja en curso, el sistema SHALL permitir reescribir únicamente el nombre de la cuenta contenido en los eventos del libro de renombre de su persona y en las instantáneas de revisión de movimientos que la cuenta cargó. Cuando la elección sea conservar el nombre, SHALL NOT reescribir historia inmutable. La base SHALL abortar cualquier otro `UPDATE` sobre `ledger_events` y `entry_revisions`, incluido uno que cambie cualquier columna distinta del JSON afectado, y cualquier `UPDATE` cuando no haya una baja en curso para la fila.

#### Scenario: Evento de renombre

- **WHEN** la baja con «quitar» procesa un evento de renombre de la persona de la cuenta
- **THEN** el JSON ya no contiene el nombre anterior ni el nuevo, y el resto de la fila es idéntico

#### Scenario: Revisión anulada

- **WHEN** la baja con «quitar» procesa la instantánea de una anulación de un movimiento que cargó la cuenta
- **THEN** la instantánea ya no contiene su nombre y el importe y las demás columnas son idénticos

#### Scenario: Intento de cambiar un importe

- **WHEN** durante una baja en curso se intenta actualizar el importe de una revisión
- **THEN** la base aborta la operación

#### Scenario: Sin baja en curso

- **WHEN** se intenta actualizar el JSON de un evento del libro sin que haya una baja en curso para su persona
- **THEN** la base aborta la operación

#### Scenario: Conservar no reescribe

- **WHEN** la baja es con «conservar»
- **THEN** ninguna fila de `ledger_events` ni de `entry_revisions` cambia

#### Scenario: Exportación posterior

- **WHEN** una persona de un grupo afectado exporta el grupo después de una baja con «quitar»
- **THEN** el JSON no contiene el nombre ni el email de la cuenta dada de baja

### Requirement: Las invitaciones asociadas se limpian

Al ejecutar la baja, el sistema SHALL cancelar las invitaciones pendientes que envió la cuenta y SHALL reemplazar por un valor inerte el email de las invitaciones dirigidas a la cuenta, de modo que el email no permanezca en la tabla.

#### Scenario: Invitación recibida

- **WHEN** la cuenta tenía una invitación pendiente a otro grupo y da de baja la cuenta
- **THEN** la invitación se cancela y su email ya no coincide con el de la cuenta

### Requirement: Los pedidos por correo se ejecutan con la seudonimización y se miden

Una baja o supresión pedida por correo SHALL registrarse según el procedimiento de solicitudes, ejecutarse mediante una herramienta de operación que aplique siempre la seudonimización «quitar», y quedar auditada con el identificador de la solicitud. Una persona que figura en un grupo sin tener cuenta SHALL poder pedir por correo conocer, corregir o suprimir ese dato, y la supresión SHALL renombrar a la persona «Persona eliminada» con la misma reescritura acotada. Los plazos SHALL ser los de la Ley 1581: consultas en 10 días hábiles (más 5), reclamos y supresión en 15 días hábiles (más 8), con la leyenda «reclamo en trámite» dentro de 2 días hábiles.

#### Scenario: Baja por correo

- **WHEN** Pablo recibe desde el email de una cuenta un pedido de baja
- **THEN** lo registra, ejecuta la baja con «quitar» y responde dentro de los 15 días hábiles diciendo qué se suprimió y qué persiste

#### Scenario: Persona sin cuenta pide suprimir su nombre

- **WHEN** una persona sin cuenta pide suprimir su dato y se verifica el pedido
- **THEN** la persona del grupo pasa a «Persona eliminada», conserva su saldo y queda un evento de auditoría con el identificador de la solicitud

#### Scenario: Herramienta en seco

- **WHEN** la herramienta de operación corre sin confirmación
- **THEN** imprime el plan y no modifica nada

### Requirement: La baja es resumible y deja un registro mínimo

La baja SHALL ejecutarse en fases idempotentes, de modo que una interrupción pueda retomarse sin duplicar ni omitir efectos, y el mantenimiento diario SHALL completar las bajas interrumpidas. El sistema SHALL conservar en `account_erasures` solo un identificador opaco de la cuenta, la elección de nombre, el estado, las fechas y los conteos, sin datos personales.

#### Scenario: Corte entre fases

- **WHEN** la baja se interrumpe después de anonimizar la cuenta y antes de salir de los grupos
- **THEN** la cuenta ya no puede entrar y el siguiente mantenimiento completa la salida de los grupos sin errores

#### Scenario: Registro sin datos personales

- **WHEN** termina una baja
- **THEN** `account_erasures` contiene el identificador, la elección, el estado, las fechas y los conteos y ningún email ni nombre

### Requirement: Cada baja queda auditada y restaurar un respaldo nunca la revive

El sistema SHALL registrar `account_deletion_requested` y `account_deleted` en la auditoría de la plataforma y, por cada grupo abandonado, `member_left` con motivo `account_deleted`, sin emails ni nombres. El procedimiento de recuperación SHALL reaplicar la lista de supresiones (las bajas registradas en `account_erasures` y en el registro externo, si existe), con la elección original de nombre, después de restaurar un respaldo anterior y antes de reabrir el servicio, y SHALL ensayarse.

#### Scenario: Reaplicar tras restaurar

- **WHEN** se restaura un respaldo tomado antes de una baja y se reaplica la lista de supresiones
- **THEN** la cuenta vuelve a estar anonimizada, sin sesiones y fuera de sus grupos, con la elección de nombre original

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
- **THEN** ve los grupos con sus acciones, las dos opciones de nombre y la confirmación sin desplazarse horizontalmente y los controles miden al menos 44 px
