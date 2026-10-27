## Purpose

Define cómo se ven, se renombran y se unen las personas de un grupo de Cuentas Claras, el menú de la aplicación con acceso al perfil propio y cómo la importación pregunta a quién corresponde cada columna del archivo.

## ADDED Requirements

### Requirement: El menú lleva a las secciones del grupo y al perfil propio

Cada pantalla SHALL mostrar un menú. Dentro de un grupo, el menú SHALL ofrecer Saldos, Movimientos, Personas, Categorías, Clasificar rápido e Importar; en cualquier pantalla SHALL ofrecer Inicio y Mis grupos. Con sesión iniciada, el menú SHALL ofrecer «Ver mi perfil» y «Cerrar sesión», y el encabezado SHALL mostrar el avatar y el nombre de la persona, que llevan al perfil. El menú SHALL cerrarse con Escape, al tocar fuera de él y al elegir una opción que solo cambia de lugar dentro de la misma página, y todas sus opciones SHALL medir al menos 44 px de alto.

#### Scenario: Llegar a Personas sin bajar hasta el final

- **WHEN** la persona abre el menú desde el libro y elige «Personas»
- **THEN** llega a la pantalla de personas del grupo

#### Scenario: Ver el perfil propio

- **WHEN** la persona abre el menú y elige «Ver mi perfil»
- **THEN** llega a su perfil

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión abre una pantalla pública
- **THEN** el menú ofrece Inicio y Mis grupos y no muestra cuenta, perfil ni «Cerrar sesión»

### Requirement: Existe una pantalla con las personas del grupo

El sistema SHALL ofrecer una pantalla de personas del grupo accesible a todos los integrantes, con cada persona vigente, su estado (con cuenta, sin cuenta o con invitación pendiente), si es quien mira, y su saldo por moneda. SHALL listar aparte las personas que fueron unidas a otra, indicando a cuál. Solo la persona titular SHALL ver las herramientas de administración (agregar, invitar, renombrar a una persona, unir, renombrar el grupo, archivar); los demás integrantes SHALL ver la lista en modo lectura.

#### Scenario: Un integrante ve las personas sin herramientas de administración

- **WHEN** un integrante abre la pantalla de personas
- **THEN** ve la lista y los saldos, y no ve formularios de agregar, renombrar ni unir

#### Scenario: Personas unidas

- **WHEN** hubo una unión de «Pablo» a «Pablo T»
- **THEN** la pantalla muestra a «Pablo T» entre las personas vigentes y a «Pablo» como «unida a Pablo T» en el historial

### Requirement: La titular puede renombrar a una persona

La persona titular SHALL poder cambiar el nombre de una persona vigente. El nombre SHALL tener entre 1 y 120 caracteres y SHALL ser distinto, sin distinguir mayúsculas ni tildes, del de cualquier otra persona vigente del grupo. Renombrar SHALL registrar un evento del libro y SHALL rechazarse en un grupo archivado.

#### Scenario: Renombrar

- **WHEN** la titular cambia «yo» por «Pablo»
- **THEN** los saldos y los movimientos muestran «Pablo» y el evento queda registrado

#### Scenario: Nombre repetido

- **WHEN** la titular intenta llamar «ana» a una persona cuando ya existe «Ana»
- **THEN** se rechaza con un mensaje que explica que ya hay una persona con ese nombre

#### Scenario: Integrante sin permiso

- **WHEN** un integrante que no es titular intenta renombrar a una persona
- **THEN** se rechaza y nada cambia

### Requirement: Unir dos personas mueve todos sus movimientos a la destinataria elegida

La persona titular SHALL poder unir una persona (la unida) a otra (la destinataria), elegida en el momento de avanzar con la acción. Ambas SHALL ser personas vigentes y distintas del mismo grupo. Antes de aplicar, el sistema SHALL mostrar cuántos movimientos cambian, cuántos se anulan (ver más abajo), cómo quedan los saldos y qué ocurre con la cuenta y las invitaciones, y SHALL exigir una confirmación. Al confirmar, todos los movimientos vigentes de la unida SHALL pasar a la destinataria: quién pagó y la parte de cada uno SHALL sumarse por persona, de modo que el saldo de la destinataria pasa a ser la suma de ambos saldos y el saldo total del grupo no cambia. Cada movimiento afectado SHALL recibir una revisión nueva («Cambió: unión de personas») con el identificador de la unión, y la unión SHALL quedar registrada con quién la hizo, cuándo y entre qué personas.

#### Scenario: Unir dos personas que son la misma

- **WHEN** la titular une «yo» a «Pablo» y confirma
- **THEN** todos los movimientos de «yo» pasan a «Pablo», el saldo de «Pablo» es la suma de los dos saldos anteriores y «yo» deja de aparecer en repartos y saldos

#### Scenario: Ambas personas participaban del mismo movimiento

- **WHEN** un gasto de 100 lo pagó «yo» (60) y «Pablo» (40) y se repartió 50 y 50 entre ambos, y la titular las une
- **THEN** el movimiento queda con un pagador «Pablo» por 100 y una parte de «Pablo» por 100, y su revisión nueva figura como unión de personas

#### Scenario: Un reparto por método se reabre con importes exactos

- **WHEN** un gasto repartido «Igual» entre «yo», «Pablo» y «Caro» se une a «yo» con «Pablo»
- **THEN** al corregirlo se muestra con importes exactos (100 para la destinataria y el resto para Caro), sin recalcular el reparto

#### Scenario: Una transferencia entre las dos personas

- **WHEN** existe una transferencia de «yo» a «Pablo» y se las une
- **THEN** la transferencia se anula con el motivo «unión de personas», no cambia ningún saldo y la vista previa informó que se anularía

#### Scenario: Vista previa sin escribir

- **WHEN** la titular abre la vista previa de una unión
- **THEN** ve las cantidades y los saldos resultantes y no se escribe nada hasta confirmar

#### Scenario: Cancelar

- **WHEN** la titular cancela en la pantalla de confirmación
- **THEN** ningún movimiento ni persona cambia

#### Scenario: Elegir la misma persona o una ya unida

- **WHEN** se intenta unir una persona consigo misma, o con una persona que ya fue unida a otra
- **THEN** se rechaza con un mensaje que explica el motivo

### Requirement: La unión respeta las cuentas y las invitaciones

Si solo una de las dos personas tiene cuenta, la persona resultante (la destinataria) SHALL conservar esa cuenta: si la tenía la unida, la cuenta pasa a la destinataria. Si ambas tienen cuenta, la unión SHALL rechazarse. Una invitación pendiente dirigida a la persona unida SHALL pasar a la destinataria cuando esta no tiene cuenta ni otra invitación pendiente; en cualquier otro caso SHALL cancelarse, y la vista previa SHALL informarlo.

#### Scenario: La cuenta pasa a la destinataria

- **WHEN** la titular une una persona con cuenta a otra sin cuenta, eligiendo como destinataria a la que no tiene cuenta
- **THEN** la destinataria queda vinculada a esa cuenta y la persona unida queda sin cuenta

#### Scenario: Dos cuentas distintas

- **WHEN** las dos personas tienen cuenta
- **THEN** la unión se rechaza y se explica que son dos cuentas distintas

#### Scenario: Invitación pendiente

- **WHEN** la persona unida tenía una invitación pendiente y la destinataria no tiene cuenta ni invitación
- **THEN** la invitación pasa a la destinataria

### Requirement: La unión es segura ante repeticiones, cortes y cambios simultáneos

Confirmar SHALL ser idempotente: repetir la confirmación, o enviarla desde dos pestañas, SHALL producir una única unión y una única revisión por movimiento. Si la operación se interrumpe a la mitad, repetir la confirmación SHALL completarla sin duplicar nada y, mientras tanto, el libro SHALL seguir siendo consistente (cada movimiento referencia solo personas vigentes o la persona aún no unida). Un movimiento corregido por otra persona entre la vista previa y la confirmación SHALL conservar su corrección y SHALL unirse en su revisión vigente. Un grupo archivado SHALL rechazar la unión.

#### Scenario: Doble clic en confirmar

- **WHEN** la titular confirma dos veces la misma unión
- **THEN** existe una sola unión y cada movimiento tiene una sola revisión de unión

#### Scenario: Corte a la mitad

- **WHEN** la operación se interrumpe tras unir una parte de los movimientos y la titular repite la confirmación
- **THEN** se completan los movimientos restantes y ninguno queda duplicado

### Requirement: La importación pregunta quién es cada columna, empezando por «yo»

En el paso de correspondencia, cada columna de persona del archivo SHALL preguntar «¿Quién es “X” en este grupo?» y ofrecer, en este orden, «Soy yo (nombre)» cuando quien importa tiene una persona en el grupo, las demás personas vigentes y «Una persona nueva». SHALL preseleccionarse la persona con el mismo nombre (sin distinguir mayúsculas ni tildes) cuando existe, y «Una persona nueva» en otro caso. La pantalla de revisión SHALL avisar cuando dos columnas se corresponden con la misma persona y cuando ninguna columna corresponde a quien importa; ninguno de los dos avisos SHALL impedir continuar salvo que la correspondencia sea inválida.

#### Scenario: Elegir «Soy yo»

- **WHEN** quien importa elige «Soy yo (Pablo)» para la columna «Pablo T»
- **THEN** los movimientos de esa columna se cargan a su persona del grupo y no se crea una persona nueva

#### Scenario: Preselección por nombre

- **WHEN** una columna se llama «caro» y el grupo tiene a «Caro»
- **THEN** la opción preseleccionada de esa columna es «Caro»

#### Scenario: Ninguna columna es quien importa

- **WHEN** ninguna columna se corresponde con la persona de quien importa
- **THEN** la revisión lo avisa, indicando que quien importa quedará fuera de esos movimientos, y permite continuar
