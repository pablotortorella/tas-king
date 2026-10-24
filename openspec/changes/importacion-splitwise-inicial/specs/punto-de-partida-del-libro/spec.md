## ADDED Requirements

### Requirement: Un libro nuevo empieza con un punto de partida explícito

Al crear un grupo, la persona titular SHALL elegir entre traer movimientos de
Splitwise y empezar en cero. Mientras no exista su propio change, la interfaz NO
SHALL ofrecer el inicio con saldos anteriores. Elegir una opción SHALL ser
reversible antes de escribir cualquier dato.

#### Scenario: Empezar en cero

- **WHEN** el titular elige empezar en cero
- **THEN** todos los participantes tienen saldo $0 en cada moneda y no se crea
  ningún movimiento de apertura

#### Scenario: Elegir importar

- **WHEN** el titular elige traer movimientos de Splitwise
- **THEN** pasa a la previsualización de la importación sin que se escriba nada
  hasta confirmar
