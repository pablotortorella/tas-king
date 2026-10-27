## ADDED Requirements

### Requirement: El apodo pertenece a la membresía y acompaña al nombre global

Cada membresía SHALL tener apodo opcional, inicialmente vacío. El contrato SHALL
entregar nombre global y apodo como campos separados; el apodo SHALL tener menor
jerarquía visual cuando una vista lo presente y SHALL NOT sustituir al nombre.
El avatar permanece global en este corte. No se fija layout ni se implementa UI nueva.

#### Scenario: Nueva membresía

- **WHEN** una persona crea un grupo o acepta su acceso
- **THEN** el apodo está vacío, sin copiar el nombre ni apodos de otros grupos

#### Scenario: Misma persona en dos grupos

- **WHEN** usa «Papá de Celes» en colegio y «Torto (9)» en fútbol
- **THEN** ambos contextos entregan el mismo nombre/avatar global y sólo el apodo propio de cada grupo

### Requirement: Sólo la persona puede gestionar su apodo con membresía vigente

La plataforma SHALL permitir editar o vaciar el apodo propio y SHALL rechazar
edición ajena aunque el actor sea titular. SHALL verificar contexto y membresía
en servidor. Fuera del grupo SHALL NOT exponer su apodo.

#### Scenario: Persona vacía el apodo

- **WHEN** confirma apodo vacío o compuesto sólo de espacios
- **THEN** el contrato contextual devuelve apodo ausente y conserva nombre/avatar global

#### Scenario: Titular intenta editar apodo ajeno

- **WHEN** solicita modificar el apodo de otro integrante
- **THEN** se rechaza sin alterar datos ni registrar éxito

#### Scenario: Persona ajena consulta o escribe un apodo

- **WHEN** no tiene acceso al grupo indicado
- **THEN** no obtiene apodos ni modifica membresías y la respuesta no revela existencia del grupo

### Requirement: Salida y reingreso reinician apodo y protegen peticiones viejas

Al perder membresía el apodo SHALL dejar de mostrarse. Al reingresar SHALL iniciar
vacío. La gestión SHALL detectar revisiones/generaciones viejas y SHALL NOT permitir
que una petición de la membresía anterior escriba sobre la nueva. No se requiere
una UI/API nueva de salida en este cambio.

#### Scenario: Reingreso con perfil global existente

- **WHEN** una persona vuelve al mismo grupo después de dejarlo
- **THEN** conserva perfil y autoría globales pero recibe apodo vacío

#### Scenario: Petición retenida antes de salir

- **WHEN** llega tras el reingreso con generación o revisión anteriores
- **THEN** recibe conflicto sin restaurar el apodo anterior ni registrar éxito

### Requirement: Actividad anterior usa presentación contextual vigente

Actividad autorizada SHALL usar perfil global y apodo actual del grupo. Un apodo
vacío o sin membresía vigente SHALL omitirse; la autoría SHALL conservarse por ID.
Este comportamiento SHALL NOT renombrar participantes ni reescribir datos financieros.

#### Scenario: Cambiar apodo y consultar actividad previa

- **WHEN** la persona actualiza su apodo y se lee actividad anterior del grupo
- **THEN** se obtiene su nombre global con el apodo vigente separado

#### Scenario: Autor sin membresía vigente

- **WHEN** un lector autorizado consulta su actividad histórica
- **THEN** recibe perfil global actual del autor sin apodo del grupo ni acceso a un directorio global

#### Scenario: Participante contable vinculado

- **WHEN** el usuario vinculado cambia nombre o apodo
- **THEN** la presentación de persona cambia pero el nombre contable, saldos y snapshots financieros permanecen intactos
