## Context

La plataforma separa tres cosas: usuario (identidad Google), membresía (acceso a
un grupo) e invitación (promesa de acceso a un email). El libro agrega una
cuarta: el participante, que puede o no tener usuario. El MVP exige que aceptar una
invitación «nunca traslade balances entre dos participantes distintos de forma
implícita».

## Goals / Non-Goals

**Goals:** que acceso y participación se puedan combinar sin ambigüedad; que
cualquier vínculo sea explícito y auditable; que salir del producto sea posible.

**Non-goals:** los de `proposal.md`.

## Decisions

### D1. La invitación apunta a un participante

`invitations.participant_id` (nulo si invita sin asociar). Al crear una invitación
desde la pantalla de personas se elige o crea el participante. Al aceptarla, en una
misma transacción: se crea la membresía `member`, se vincula `participant.user_id`
y se audita. Si el usuario ya tiene otro participante en ese libro, la aceptación
se detiene y pide una decisión explícita; no se fusionan participantes.

### D2. Vincular después

Un participante sin cuenta puede asociarse a una invitación posterior. El historial
y los saldos permanecen en el mismo participante: lo que cambia es `user_id`.

### D3. Permisos centralizados

Una función `can(user, action, ledger, entry?)` decide: propietario puede todo;
miembro crea movimientos y corrige o anula los suyos; ambos leen y comentan.
Toda ruta la usa. La ventana de edición de un miembro sobre lo propio queda abierta
(Open Questions).

### D4. Comentarios como lista breve, de sólo agregar

`entry_comments(id, entry_id, author_user_id, body, created_at)`. Sin edición ni
hilos anidados. Límite de longitud en servidor. Un comentario nunca altera saldos
ni crea revisión del movimiento.

### D5. Exportación

JSON: libro, participantes, movimientos con sus revisiones, partes, efectos,
comentarios y eventos de auditoría, con ids y monedas, en un esquema versionado.
CSV: archivos separados (movimientos, aportes/recibos, repartos) con una columna
`revision` y sólo la versión vigente; la historia completa va en el JSON. Se
genera por demanda, en streaming si el tamaño lo exige, y se autoriza como lectura
del libro.

### D6. Archivo

`expense_ledgers.status` pasa a `archived`: todas las escrituras monetarias y de
personas responden con un error explícito; las lecturas y la exportación siguen
funcionando. Restaurar lo devuelve a `active`. Archivar y restaurar quedan
auditados y sólo los hace el propietario.

## Risks / Trade-offs

- Asociar invitación y participante agrega un caso de error (usuario con dos
  participantes); se prefiere detener la aceptación antes que fusionar en silencio.
- Un CSV sólo con la versión vigente pierde la historia de revisiones; para eso
  está el JSON.
- Sin ventana de edición definida, un miembro podría corregir indefinidamente lo
  propio; la revisión deja rastro.

## Migration Plan

Aditivo: una columna nula en invitaciones, una tabla nueva y la columna de estado
del libro con valor `active`. No hay datos que migrar.

## Open Questions

1. **Ventana de edición** de un miembro sobre sus movimientos (sección 17 del MVP).
2. **Comentarios**: ¿lista de sólo agregar o una única nota editable?
3. **Qué incluye cada CSV** y cómo representar una revisión.
4. **Política de retención y eliminación** que se ofrecerá más adelante.
5. **Correo opcional del participante**: si se guarda sin invitar, ¿es un dato personal
   a minimizar o a descartar?
6. **Archivo vs. cierre**: el lienzo no distingue «archivar» de «cerrar un período»;
   el Story Map reserva el cierre con saldos visibles para el corte C.
