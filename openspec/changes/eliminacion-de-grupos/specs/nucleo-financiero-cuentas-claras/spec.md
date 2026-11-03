## MODIFIED Requirements

### Requirement: Historia e idempotencia inmutables

Toda creación, revisión o anulación futura SHALL conservar snapshot, actor,
instante y evento. Una clave idempotente repetida con la misma solicitud SHALL
producir un solo resultado; reutilizarla para otra solicitud SHALL ser conflicto.
Las revisiones y los eventos del libro SHALL NOT poder borrarse, salvo cuando el
grupo de su libro lleve 30 días o más marcado como eliminado (purga del grupo), y
SHALL NOT poder modificarse.

#### Scenario: Reintento idéntico
- **WHEN** el mismo actor repite una escritura con igual clave y contenido
- **THEN** recibe la respuesta confirmada original y no se duplica dinero

#### Scenario: Edición con revisión obsoleta
- **WHEN** una mutación declara una revisión anterior a la vigente del libro
- **THEN** el servidor devuelve conflicto y conserva todas las revisiones existentes

#### Scenario: Borrar historia de un grupo vivo
- **WHEN** se intenta borrar una revisión o un evento de un grupo no eliminado, o eliminado hace menos de 30 días
- **THEN** la base aborta la operación y la historia sigue intacta
