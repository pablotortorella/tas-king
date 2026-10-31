## ADDED Requirements

### Requirement: Cada grupo tiene un libro con participantes

Crear un grupo SHALL crear, en la misma transacción, su libro de Cuentas Claras
con una moneda predeterminada y un participante vinculado a la persona titular. La
moneda predeterminada SHALL ser un valor por defecto y no una restricción: cada
movimiento elige la suya y cambiar la predeterminada no convierte movimientos
anteriores.

#### Scenario: Crear un grupo nuevo

- **WHEN** una persona autenticada crea un grupo con nombre, moneda COP y tres
  nombres de participantes
- **THEN** existen el grupo, la membresía de titular, un libro en COP y cuatro
  participantes (la persona titular más los tres nombres), o ninguno de ellos si
  alguna escritura falla

#### Scenario: Cambiar la moneda predeterminada

- **WHEN** el titular cambia la predeterminada de COP a USD
- **THEN** los movimientos existentes conservan su moneda y sus importes, y los
  saldos no se recalculan ni se convierten

### Requirement: Un participante es una persona del libro, con o sin cuenta

El libro SHALL identificar a cada participante por un nombre visible único entre
los activos. Un participante MAY no tener cuenta de HomeSuite y aun así figurar en
pagos, repartos y saldos. Un participante que ya figura en algún movimiento SHALL
poder desactivarse pero NO eliminarse.

#### Scenario: Agregar a alguien sin cuenta

- **WHEN** el titular agrega «Mateo» sin correo
- **THEN** Mateo puede ser pagador o beneficiario y tiene saldo, pero no tiene
  acceso al libro

#### Scenario: Nombre repetido

- **WHEN** se intenta agregar un participante activo con el mismo nombre que otro
- **THEN** el servidor lo rechaza y no crea el participante

#### Scenario: Desactivar a alguien con historia

- **WHEN** el titular desactiva a un participante que figura en movimientos
- **THEN** sigue apareciendo en el historial y en los saldos, y no puede elegirse
  en movimientos nuevos

### Requirement: Un libro sólo es accesible para quienes son miembros de su grupo

El servidor SHALL autorizar cada operación sobre un libro por la membresía vigente
en su grupo. Una persona sin membresía SHALL recibir una respuesta que no revele
la existencia del libro, y ningún movimiento SHALL referenciar participantes de
otro libro.

#### Scenario: Persona ajena pide un libro

- **WHEN** una persona sin membresía consulta saldos o movimientos de un libro
- **THEN** el servidor deniega la respuesta sin datos del libro

#### Scenario: Participante de otro libro

- **WHEN** una escritura referencia el id de un participante que pertenece a otro
  libro
- **THEN** el servidor la rechaza y no persiste nada
