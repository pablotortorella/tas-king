## Purpose

Define la forma de pago de un gasto o ingreso de Cuentas Claras: una lista fija y corta, opcional, que queda en el historial y en la exportación.

## ADDED Requirements

### Requirement: Un movimiento puede indicar con qué se pagó

Un gasto o ingreso SHALL poder llevar una forma de pago de una lista fija: Efectivo, Débito, Crédito, Transferencia o Billetera virtual. La forma de pago SHALL ser opcional y un movimiento sin ella SHALL mostrarse sin etiqueta. Una transferencia entre personas NO SHALL llevar forma de pago.

#### Scenario: Elegir al agregar

- **WHEN** una persona agrega un gasto y elige «Crédito»
- **THEN** el movimiento queda con esa forma de pago y su detalle muestra «Crédito»

#### Scenario: Sin indicar

- **WHEN** una persona agrega un movimiento sin elegir forma de pago
- **THEN** el movimiento queda sin forma de pago y no muestra etiqueta

#### Scenario: Movimientos anteriores

- **WHEN** se abre un movimiento creado antes de este cambio
- **THEN** figura sin forma de pago y corregirlo sin tocar ese campo lo deja así

#### Scenario: Una transferencia no la lleva

- **WHEN** llega una transferencia con una forma de pago
- **THEN** la transferencia se guarda sin forma de pago y su formulario no ofrece el selector

#### Scenario: Valor fuera de la lista

- **WHEN** llega una forma de pago que no está en la lista
- **THEN** el movimiento no se guarda y se informa que debe elegirse una forma de la lista

### Requirement: La forma de pago se corrige y queda en el historial

Corregir un movimiento SHALL poder cambiar o quitar su forma de pago. Cada cambio SHALL crear una revisión que la incluya en su instantánea y el historial SHALL indicar «forma de pago» cuando cambie. Una solicitud sin el campo SHALL conservar la forma de pago vigente, y cambiar la categoría en bloque o unir personas SHALL conservarla.

#### Scenario: Cambiar y quitar

- **WHEN** se corrige un movimiento de «Crédito» a «Billetera virtual» y luego a «Sin indicar»
- **THEN** cada corrección es una revisión nueva y el historial dice «Cambió: forma de pago» en ambas

#### Scenario: Corregir otra cosa

- **WHEN** se corrige solo la descripción mediante una solicitud sin el campo de forma de pago
- **THEN** la forma de pago queda igual

### Requirement: La forma de pago se exporta

La exportación CSV SHALL agregar al final la columna `forma_pago` con el nombre de la forma de pago, vacía si no se indicó, sin cambiar la posición de las columnas anteriores. La exportación JSON SHALL incluir `paymentMethod` en cada movimiento.

#### Scenario: CSV

- **WHEN** se exporta un libro con un movimiento pagado en efectivo y otro sin forma de pago
- **THEN** la última columna dice «Efectivo» en el primero y está vacía en el segundo
