## ADDED Requirements

### Requirement: Los miembros pueden comentar un movimiento

Cualquier miembro del libro SHALL poder agregar comentarios a un movimiento. Cada
comentario SHALL conservar autor y fecha, y SHALL ser de sólo agregar. Comentar NO
SHALL crear una revisión del movimiento ni alterar saldos.

#### Scenario: Ana comenta

- **WHEN** Ana comenta un ingreso
- **THEN** el comentario aparece con su nombre y fecha, y la revisión del
  movimiento no cambia

#### Scenario: Comentario demasiado largo

- **WHEN** el texto supera el límite del servidor
- **THEN** se rechaza con el motivo y no se guarda nada
