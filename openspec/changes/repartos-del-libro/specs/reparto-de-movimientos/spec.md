## Purpose

Define cómo se reparten los gastos e ingresos de un libro de Cuentas Claras entre sus personas: los métodos disponibles, sus validaciones, el criterio del residuo de centavos y la coincidencia entre lo que se ve antes de guardar y lo que se guarda.

## ADDED Requirements

### Requirement: Los gastos e ingresos admiten cinco métodos de reparto

El libro SHALL permitir repartir un gasto o un ingreso entre las personas elegidas con uno de estos métodos: **igual**, **importes exactos**, **porcentajes**, **partes** y **algunos fijos con el resto en partes iguales**. El reparto de una transferencia NO SHALL existir: una transferencia no se reparte.

#### Scenario: Reparto igual

- **WHEN** se carga un gasto de 100,00 entre tres personas con el método igual
- **THEN** las asignaciones son 33,34, 33,33 y 33,33, y suman 100,00

#### Scenario: Reparto por porcentajes

- **WHEN** se carga un gasto de 100,00 entre tres personas con 50 %, 30 % y 20 %
- **THEN** las asignaciones son 50,00, 30,00 y 20,00

#### Scenario: Reparto por partes

- **WHEN** se carga un gasto de 100,00 entre tres personas con 2, 1 y 1 partes
- **THEN** las asignaciones son 50,00, 25,00 y 25,00

#### Scenario: Una persona con cero partes queda fuera

- **WHEN** se carga un gasto de 100,00 entre tres personas con 1, 1 y 0 partes
- **THEN** la tercera persona no recibe asignación y las otras dos reciben 50,00 cada una

#### Scenario: Un ingreso se reparte con los mismos métodos

- **WHEN** se carga un ingreso de 1.800.000,00 recibido por una persona y repartido con 50 % y 50 % entre ella y otra
- **THEN** cada una recibe una asignación de 900.000,00

#### Scenario: Las transferencias no tienen reparto

- **WHEN** se carga una transferencia
- **THEN** el formulario no ofrece métodos de reparto y la transferencia se guarda sin asignaciones

### Requirement: La suma de las asignaciones es exactamente el total

En todos los métodos, la suma de los importes asignados SHALL ser exactamente el total del movimiento, expresado en la unidad menor de su moneda. El servidor SHALL calcular las asignaciones a partir del método y de los datos ingresados y NO SHALL confiar en importes calculados por el navegador. Una persona cuya asignación resulte cero NO SHALL guardarse con una asignación.

#### Scenario: El servidor recalcula

- **WHEN** el navegador envía un método y datos de entrada junto con importes calculados distintos
- **THEN** el movimiento se guarda con las asignaciones que resultan del método y de los datos ingresados

#### Scenario: Monedas con distintos decimales

- **WHEN** se reparte un importe en una moneda sin decimales y otro en una de tres decimales
- **THEN** en ambos casos las asignaciones suman exactamente el total en su unidad menor

### Requirement: El residuo de centavos se asigna por mayor resto y se muestra

Cuando un reparto no divide exactamente el total, el residuo SHALL asignarse de a una unidad menor, empezando por las personas con mayor resto fraccionario; los empates SHALL resolverse por el orden estable de las personas del grupo (el de su incorporación al libro). El resultado SHALL ser idéntico ante las mismas entradas. La vista previa SHALL indicar cuántas unidades menores sobraron y a quién se asignaron.

#### Scenario: Residuo en un reparto igual

- **WHEN** se reparte 100,01 por igual entre tres personas
- **THEN** las asignaciones son 33,34, 33,34 y 33,33, las dos primeras personas del orden del grupo reciben la unidad sobrante, y la vista previa lo informa

#### Scenario: Residuo en un reparto por porcentajes

- **WHEN** se reparte 10,00 con 33,33 %, 33,33 % y 33,34 %
- **THEN** las asignaciones suman exactamente 10,00 y la unidad menor sobrante va a quien tiene el mayor resto fraccionario

#### Scenario: El orden no depende del formulario

- **WHEN** el formulario muestra primero a la persona autenticada aunque no sea la primera del grupo
- **THEN** el residuo se asigna según el orden de las personas en el grupo y no según el orden en que aparecen en el formulario

### Requirement: Cada método valida sus datos y explica el rechazo

Cada método SHALL rechazar entradas inválidas con un mensaje que diga el motivo, sin guardar nada. Los importes, porcentajes y partes SHALL aceptar coma o punto como separador decimal y hasta dos decimales en porcentajes y partes.

#### Scenario: Porcentajes que no suman cien

- **WHEN** los porcentajes ingresados suman 99 %
- **THEN** el servidor rechaza el reparto e indica que deben sumar 100 %

#### Scenario: Importes exactos que no suman el total

- **WHEN** los importes exactos ingresados suman 99,00 para un total de 100,00
- **THEN** el servidor rechaza el reparto e indica la diferencia

#### Scenario: Valores negativos o vacíos

- **WHEN** una persona elegida tiene un valor negativo o ilegible en porcentajes, partes o importes
- **THEN** el servidor rechaza el reparto e indica a qué persona corresponde

#### Scenario: Todas las partes en cero

- **WHEN** todas las personas elegidas tienen cero partes
- **THEN** el servidor rechaza el reparto

#### Scenario: Sin beneficiarias

- **WHEN** no se elige a ninguna persona para el reparto
- **THEN** el servidor rechaza el reparto

### Requirement: Algunos fijos con el resto en partes iguales

Con este método, las personas con un importe fijo SHALL asumir solo ese importe y quedar fuera del reparto del resto. El resto, es decir el total menos la suma de los fijos, SHALL repartirse en partes iguales entre las demás personas elegidas. El servidor SHALL rechazar el reparto cuando los fijos superen el total, cuando no queden personas sin fijo y los fijos no sumen el total, y cuando queden personas sin fijo pero no quede resto por repartir.

#### Scenario: Un fijo y dos personas comparten el resto

- **WHEN** se carga un gasto de 100,00 con un fijo de 10,00 para Ana y sin fijo para Beto y Carla
- **THEN** las asignaciones son 10,00 para Ana, 45,00 para Beto y 45,00 para Carla

#### Scenario: Fijos que superan el total

- **WHEN** la suma de los fijos es mayor que el total
- **THEN** el servidor rechaza el reparto e indica que los fijos superan el total

#### Scenario: Todos con fijo que suman el total

- **WHEN** todas las personas elegidas tienen un fijo y la suma es igual al total
- **THEN** el reparto se guarda con esos importes

#### Scenario: Todos con fijo que no suman el total

- **WHEN** todas las personas elegidas tienen un fijo y la suma es menor que el total
- **THEN** el servidor rechaza el reparto e indica que falta repartir la diferencia

#### Scenario: Sin resto para repartir

- **WHEN** los fijos suman exactamente el total pero hay personas elegidas sin fijo
- **THEN** el servidor rechaza el reparto e indica que no queda resto para esas personas

#### Scenario: Sin fijos

- **WHEN** ninguna persona tiene fijo
- **THEN** el reparto es idéntico a un reparto igual

### Requirement: Atajo «lo debe todo una persona»

El formulario SHALL ofrecer un atajo que asigne el importe completo a una persona elegida, sin escribir importes. El atajo SHALL equivaler a un reparto igual cuya única beneficiaria es esa persona.

#### Scenario: Un gasto que debe una sola persona

- **WHEN** Ana paga 100,00 y se elige «lo debe todo Beto»
- **THEN** la asignación es 100,00 para Beto, el efecto de Ana es +100,00 y el de Beto es −100,00

### Requirement: La vista previa coincide con lo que se guarda

Antes de guardar, el formulario SHALL mostrar el efecto previsto de cada persona y el residuo, calculados con la misma regla que usa el servidor. Para el mismo método y los mismos datos, la vista previa y el movimiento guardado SHALL mostrar los mismos importes.

#### Scenario: Vista previa y guardado coinciden

- **WHEN** se completa el formulario con cualquiera de los cinco métodos, se mira la vista previa y se guarda
- **THEN** los importes asignados que muestra el movimiento guardado son los de la vista previa

#### Scenario: Datos incompletos

- **WHEN** faltan datos del método elegido
- **THEN** la vista previa indica qué falta y no muestra importes inventados

### Requirement: El método y sus datos se conservan y se reabren al corregir

Cada revisión de un movimiento SHALL conservar el método de reparto y los datos ingresados. Al corregir un movimiento, el formulario SHALL reabrirse con ese método y esos datos tal como se cargaron. Un movimiento que no conserva método, por haberse creado antes de este cambio o por haberse importado, SHALL reabrirse como reparto igual si sus asignaciones lo son y como importes exactos en caso contrario.

#### Scenario: Reabrir un reparto por porcentajes

- **WHEN** se corrige un movimiento cargado con 60 % y 40 %
- **THEN** el formulario muestra el método porcentajes con 60 y 40, no importes sueltos

#### Scenario: Reabrir un movimiento sin método

- **WHEN** se corrige un movimiento anterior cuyo reparto es parejo
- **THEN** el formulario muestra el método igual

#### Scenario: Reabrir un movimiento sin método con reparto desigual

- **WHEN** se corrige un movimiento anterior cuyo reparto no es parejo
- **THEN** el formulario muestra el método importes exactos con los importes asignados

### Requirement: El historial refleja el cambio de forma de reparto

Cuando una corrección cambia el método de reparto o sus datos, el historial de revisiones SHALL indicar que cambió la forma de reparto, aunque los importes asignados no cambien.

#### Scenario: Mismo resultado con otro método

- **WHEN** un reparto igual entre dos personas se corrige a 50 % y 50 %
- **THEN** la nueva revisión indica que cambió la forma de reparto
