## ADDED Requirements

### Requirement: Un gasto reparte lo que alguien pagó

El libro SHALL admitir gastos en los que uno o más pagadores aportan el importe y
éste se asigna entre beneficiarios. El servidor SHALL validar, sin confiar en el
cliente, que el importe sea un entero positivo en la unidad menor de una única
moneda y que la suma de aportes y la suma de asignaciones igualen el importe.

#### Scenario: Gasto igual entre cuatro

- **WHEN** Pablo registra un gasto de $286.400 que pagó él y se reparte por igual
  entre cuatro personas
- **THEN** el efecto es +$214.800 para Pablo y −$71.600 para cada una de las otras
  tres, y los cuatro efectos suman cero

#### Scenario: Pagadores que no suman el importe

- **WHEN** los aportes de los pagadores de un gasto no suman su importe
- **THEN** el servidor rechaza la escritura y no persiste nada

### Requirement: Un ingreso reparte lo que alguien recibió

El libro SHALL admitir ingresos en los que uno o más receptores reciben el importe
y su beneficio se asigna entre beneficiarios, con las mismas validaciones de
importe, moneda y sumas que un gasto. Un ingreso NO SHALL representarse como un
gasto con importe negativo.

#### Scenario: Ingreso compartido sin gasto negativo

- **WHEN** se registra un ingreso de $1.800.000 recibido por Ana y repartido por
  igual entre Ana y Pablo
- **THEN** Ana queda en −$900.000 y Pablo en +$900.000

### Requirement: Una transferencia entrega dinero entre dos participantes

El libro SHALL admitir transferencias con un origen y un destino distintos, ambos
del libro, y un importe positivo. La transferencia NO SHALL vincularse a un gasto,
ingreso, deuda ni préstamo. «Préstamo», «adelanto», «reintegro» y «pago parcial»
NO SHALL ser tipos: pueden escribirse en la descripción sin cambiar el cálculo.

#### Scenario: Transferencia que invierte un saldo

- **WHEN** Pablo transfiere $150.000 a Laura
- **THEN** el saldo de Pablo aumenta $150.000 y el de Laura disminuye $150.000,
  sea cual fuere el saldo previo y lo que diga la descripción

#### Scenario: Origen igual a destino

- **WHEN** una transferencia indica la misma persona como origen y destino
- **THEN** el servidor la rechaza

### Requirement: Repartos exactos con residuo determinista

El reparto de gastos e ingresos SHALL poder ser igual, exacto, porcentual o por
partes. En todos los métodos la suma de importes asignados SHALL ser exactamente
el total; los residuos de redondeo SHALL asignarse con una regla determinista y
SHALL mostrarse al usuario antes de confirmar. El resultado SHALL ser idéntico ante
las mismas entradas.

#### Scenario: Reparto que no divide exacto

- **WHEN** $100.001 se reparte por igual entre tres participantes
- **THEN** las asignaciones suman $100.001 y el residuo asignado se muestra
  indicando a quién

#### Scenario: Porcentajes que no suman 100

- **WHEN** los porcentajes ingresados suman 99 %
- **THEN** el servidor rechaza el reparto con el motivo

#### Scenario: Monedas con distintos decimales

- **WHEN** se reparte un importe en una moneda sin decimales y otro en una de tres
  decimales
- **THEN** ambos conservan exactamente su total en su unidad menor

### Requirement: Corregir un movimiento crea una revisión

Una corrección SHALL crear una nueva revisión inmutable con autor, instante y
estado anterior, validar nuevamente todas las invariantes y recalcular saldos
desde la versión vigente. La interfaz SHALL mostrar el historial de revisiones y
quién modificó por última vez. La historia NO SHALL sobrescribirse en silencio.

#### Scenario: Corregir un importe

- **WHEN** Pablo corrige el ingreso de $1.750.000 a $1.800.000
- **THEN** existen dos revisiones, la vigente muestra $1.800.000, el historial
  indica el cambio y los saldos reflejan sólo la versión vigente

#### Scenario: Edición sobre una versión desactualizada

- **WHEN** dos personas editan el mismo movimiento desde la misma revisión del
  libro y la segunda confirma después de la primera
- **THEN** la segunda recibe un conflicto con el estado vigente y su cambio no se
  aplica

### Requirement: Anular no borra

Anular un movimiento SHALL exigir confirmación, aceptar un motivo opcional y
dejarlo visible como anulado en historial y actividad. Un movimiento anulado NO
SHALL afectar saldos. Desde la interfaz normal NO SHALL existir borrado físico.

#### Scenario: Anular un gasto

- **WHEN** el titular anula «Cena de cumpleaños» de $120.000
- **THEN** el movimiento sigue listado como anulado, no cuenta en ningún saldo y
  la anulación queda registrada con su autor

### Requirement: Las escrituras monetarias son atómicas e idempotentes

Cada creación o edición de movimiento SHALL aceptar una clave de idempotencia y
persistir movimiento, partes, revisión, nueva revisión del libro y clave en una
única operación atómica. Repetir la misma clave con el mismo cuerpo SHALL devolver
la respuesta original sin duplicar dinero. Reutilizarla con otro cuerpo SHALL ser
un error.

#### Scenario: Reintento tras perder la conexión

- **WHEN** el cliente repite la creación de un gasto con la misma clave
- **THEN** existe un único movimiento y ambas respuestas son equivalentes

#### Scenario: Falla a mitad de escritura

- **WHEN** falla cualquiera de las escrituras de un movimiento
- **THEN** no queda ninguna parte, revisión ni incremento persistidos
