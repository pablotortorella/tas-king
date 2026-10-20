## ADDED Requirements

### Requirement: Importes exactos y monedas explícitas

Cuentas Claras SHALL representar cada importe como entero en la unidad menor de
una moneda ISO 4217 soportada. SHALL conservar moneda por movimiento y SHALL
mantener balances separados sin conversión implícita.

#### Scenario: Moneda con tres decimales
- **WHEN** el dominio recibe un importe válido en una moneda soportada con exponente 3
- **THEN** conserva exactamente su entero en unidad menor sin redondearlo a dos decimales

#### Scenario: Moneda no soportada
- **WHEN** una escritura declara un código inexistente o no soportado
- **THEN** el dominio la rechaza antes de escribir D1

### Requirement: Reparto determinista conserva el total

El motor SHALL repartir importes enteros sin crear ni perder unidades menores y
SHALL asignar residuos mediante un orden estable y reproducible.

#### Scenario: División con residuo
- **WHEN** se reparten 100 unidades menores por igual entre tres participantes ordenados
- **THEN** las partes son 34, 33 y 33, y suman exactamente 100

### Requirement: Modelo financiero explicable y aislado

Cada libro SHALL pertenecer a un único espacio. Participantes y componentes de un
movimiento SHALL pertenecer al mismo libro. Gastos, ingresos y transferencias
SHALL satisfacer sus sumas y producir efectos netos cuya suma por moneda sea cero.

#### Scenario: Participante de otro libro
- **WHEN** un draft referencia un participante perteneciente a otro libro
- **THEN** el servidor rechaza la operación completa sin persistir filas parciales

#### Scenario: Gasto desequilibrado
- **WHEN** aportes o asignaciones no suman exactamente el total del gasto
- **THEN** el dominio rechaza el draft y no altera la revisión del libro

### Requirement: Historia e idempotencia inmutables

Toda creación, revisión o anulación futura SHALL conservar snapshot, actor,
instante y evento. Una clave idempotente repetida con la misma solicitud SHALL
producir un solo resultado; reutilizarla para otra solicitud SHALL ser conflicto.

#### Scenario: Reintento idéntico
- **WHEN** el mismo actor repite una escritura con igual clave y contenido
- **THEN** recibe la respuesta confirmada original y no se duplica dinero

#### Scenario: Edición con revisión obsoleta
- **WHEN** una mutación declara una revisión anterior a la vigente del libro
- **THEN** el servidor devuelve conflicto y conserva todas las revisiones existentes
