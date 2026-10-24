## ADDED Requirements

### Requirement: La importación se previsualiza antes de escribir

El sistema SHALL aceptar un CSV con el formato de exportación de Splitwise, de un
grupo o de una relación directa, y SHALL mostrar su previsualización sin crear
movimientos: participantes reconocidos, filas de movimiento, fila de resumen,
conteos y saldos previstos por moneda. La fila de resumen NO SHALL importarse
como movimiento.

#### Scenario: Previsualizar un archivo válido

- **WHEN** el titular sube un CSV con 36 movimientos y una fila de resumen
- **THEN** ve 36 filas válidas, 1 fila de resumen y los saldos previstos por
  persona y moneda, y el libro no cambió

#### Scenario: Cancelar

- **WHEN** el titular cancela durante la previsualización
- **THEN** no se persiste ningún movimiento y el lote queda descartado

### Requirement: Las personas del archivo se mapean de forma explícita

Cada participante del archivo SHALL asociarse a un participante existente del
libro o a uno nuevo antes de confirmar. El sistema NO SHALL asociar dos columnas
del archivo al mismo participante sin que la persona lo confirme.

#### Scenario: Nombre del archivo igual al de un participante

- **WHEN** el archivo trae la columna «Ana» y el libro tiene un participante Ana
- **THEN** el mapeo la propone y la persona la confirma o la cambia

### Requirement: Todas las líneas válidas se importan con su efecto exacto

Cada fila válida SHALL incorporarse conservando fecha, descripción, moneda y el
efecto firmado de cada participante. Si el pagador o el reparto originales no se
pueden inferir con certeza pero el efecto es válido, la fila NO SHALL ser un
incidente. El sistema NO SHALL clasificar una fila como préstamo, adelanto o pago
a partir de su texto.

#### Scenario: Fila cuyo pagador es ambiguo

- **WHEN** una fila tiene efectos que suman cero pero no identifican un único pagador
- **THEN** se importa con sus efectos exactos y el pagador no se presenta como
  dato de origen

### Requirement: Los incidentes indican fila, motivo y resolución

Una fila cuyo efecto no puede determinarse con certeza SHALL señalarse con su
número de fila original y su motivo. La persona SHALL poder cancelar la
importación, resolver la fila con un supuesto explícito o excluirla. Las filas
no afectadas SHALL poder importarse. Nada SHALL omitirse en silencio.

#### Scenario: Falta el efecto de un participante

- **WHEN** la fila 12 no trae el efecto de Mateo y la persona acepta completarlo
  para que la fila sume cero
- **THEN** la fila se importa con ese supuesto registrado y listado en el
  resumen del lote

#### Scenario: Moneda no reconocida

- **WHEN** la fila 27 declara la moneda «COL» y la persona la excluye
- **THEN** la fila no se importa, queda listada como no importada con su motivo
  y la conciliación atribuye la diferencia a esa fila

### Requirement: La conciliación compara saldos sin ajustes ocultos

Antes de confirmar, el sistema SHALL comparar por persona y moneda el saldo del
origen con el que resultaría de la importación y SHALL atribuir cada diferencia a
filas excluidas o supuestos. Una diferencia sin fila atribuible SHALL mostrarse
como tal. El sistema NO SHALL crear movimientos de ajuste para cerrarla.

#### Scenario: Diferencia por filas excluidas

- **WHEN** hay dos filas excluidas
- **THEN** la conciliación muestra la diferencia por persona y señala que
  proviene de esas filas

#### Scenario: Diferencia inexplicada

- **WHEN** una diferencia no se atribuye a ninguna fila
- **THEN** se muestra como «diferencia sin fila atribuible» y no se corrige

### Requirement: Cada movimiento importado conserva su procedencia

Los movimientos importados SHALL conservar lote y número de fila original y
SHALL mostrar «Importado de Splitwise» con ese número en cualquier lista o
detalle. El resumen del lote SHALL conservar supuestos y filas no importadas.

#### Scenario: Ver de dónde viene un movimiento

- **WHEN** la persona abre un movimiento importado
- **THEN** ve el origen, el número de fila y, si hubo, el supuesto aplicado

### Requirement: Importar dos veces el mismo archivo no duplica dinero

Un lote SHALL identificarse por libro y huella del archivo. Subir otra vez el
mismo archivo, o repetir la confirmación, SHALL producir un único conjunto de
movimientos y SHALL informar qué ya estaba presente.

#### Scenario: Reintento de confirmación

- **WHEN** la confirmación se envía dos veces por una falla de red
- **THEN** los movimientos existen una sola vez y los saldos no cambian la segunda vez

### Requirement: Las pruebas no usan datos reales

Fixtures, seeds y bases de desarrollo SHALL usar únicamente archivos sintéticos
con la estructura mínima necesaria.

#### Scenario: Nueva variante de formato

- **WHEN** aparece una variante de exportación
- **THEN** se agrega un archivo sintético mínimo que la represente y ningún export personal
