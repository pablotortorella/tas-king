## ADDED Requirements

### Requirement: Saldo neto por participante y moneda

El libro SHALL exponer, por cada moneda, el saldo neto de cada participante como
la suma de los efectos de sus movimientos vigentes. Un saldo positivo significa
que a la persona le corresponde recibir; uno negativo, que debe aportar. Para cada
moneda la suma de los saldos de todos los participantes SHALL ser cero. El saldo
SHALL derivarse de movimientos y NO SHALL poder editarse directamente.

#### Scenario: Suma cero

- **WHEN** el libro tiene gastos, un ingreso y una transferencia vigentes en COP
- **THEN** los saldos COP de los cuatro participantes suman $0

#### Scenario: Monedas separadas

- **WHEN** el libro tiene movimientos en COP y en USD
- **THEN** cada participante tiene un saldo en COP y otro en USD, y ninguna vista
  los suma ni convierte

### Requirement: Todo saldo se explica desde sus movimientos

Para un participante y una moneda, el sistema SHALL listar los movimientos vigentes
que componen su saldo, cada uno con su efecto y el acumulado, y SHALL mostrar la
comprobación de que la suma coincide con el saldo.

#### Scenario: Ver por qué te deben

- **WHEN** Pablo abre la explicación de su saldo COP de +$1.748.350
- **THEN** ve cada movimiento con su efecto, un acumulado que termina en
  $1.748.350 y la ecuación de suma que lo confirma

#### Scenario: Movimiento anulado

- **WHEN** un movimiento se anula
- **THEN** desaparece de la explicación y del acumulado

### Requirement: Las sugerencias de transferencia se derivan y no se guardan

El sistema SHALL ofrecer, por moneda, transferencias sugeridas calculadas con una
regla determinista a partir de los saldos. Una sugerencia NO SHALL persistirse
como obligación entre dos personas. Registrar una sugerencia SHALL abrir una
transferencia prellenada que sigue las reglas de cualquier otra.

#### Scenario: Mismos saldos, mismas sugerencias

- **WHEN** se piden las sugerencias dos veces sin movimientos intermedios
- **THEN** el resultado es idéntico

#### Scenario: Quedar a mano

- **WHEN** se registran todas las transferencias sugeridas de una moneda
- **THEN** todos los saldos de esa moneda quedan en cero

#### Scenario: Pagar de otra forma

- **WHEN** alguien registra una transferencia distinta de la sugerida
- **THEN** es válida y las sugerencias se recalculan desde los nuevos saldos
