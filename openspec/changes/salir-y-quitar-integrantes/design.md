## Context

Ver `proposal.md` para el motivo. Estado verificado en `main` (1553229):

- `memberships(group_id, user_id, role, joined_at, nickname, presentation_revision, membership_generation, …)` con clave `(group_id, user_id)`. Índice único parcial `memberships_one_owner_per_group` sobre `group_id WHERE role = 'owner'`. No hay `ON DELETE CASCADE`.
- Cada pedido a una pantalla o a una ruta de grupo consulta `memberships` (`getLedgerAccess`, las rutas de `groups`), de modo que borrar la fila corta el acceso de forma inmediata, sin invalidar sesiones.
- `ledger_participants.linked_user_id` (índice único `(ledger_id, linked_user_id)`) vincula a la persona del libro con la cuenta. `resolveInvitation` ya sabe vincular una invitación a una persona existente solo si `linked_user_id IS NULL AND active = 1`.
- `updateGroup`, `cancelInvitation` y `resolveInvitation` escriben su evento en `platform_audit_events` en el mismo `db.batch`; `recordLedgerChange` agrega un evento al libro y sube su revisión.
- La cookie `last_group` solo se usa después de comprobar la membresía.
- `ledger_entries.created_by_user_id` y las revisiones apuntan a `users`: el nombre de quien cargó un movimiento seguirá visible tras salir.

## Goals / Non-Goals

**Goals:**
- Salir y quitar integrantes sin tocar saldos ni historia.
- Que nunca exista un grupo sin titular.
- Que cada operación sea atómica, auditada y verificable.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. La persona del libro se conserva y queda «sin cuenta»

Al salir o ser quitada, la fila de `ledger_participants` no se toca salvo `linked_user_id = NULL`. Conserva `display_name`, `active` y todo su historial: borrarla rompería saldos y movimientos, y la regla del producto es que una persona con historial no se borra. Efectos: queda como las personas «sin cuenta» ya existentes, se puede volver a invitar vinculándola (el flujo actual de `target_participant_id`) y la restricción única de vínculo deja de impedirlo.

*Alternativa descartada:* dejar el vínculo con una cuenta sin membresía. Produce un estado incoherente («integrante» que no integra) y bloquearía volver a vincular.

### D2. Una única operación de baja de membresía, tres puntos de entrada

`removeMembership(db, { groupId, actorUserId, targetUserId, reason })` con `reason` en `left` o `removed` hace en un `db.batch`: borra la fila de `memberships` solo si `role = 'member'`; desvincula la persona; escribe `member_left` o `member_removed` en `platform_audit_events` y `participant_unlinked` en `ledger_events` (sube la revisión). Las sentencias de auditoría y de desvinculación se condicionan al estado leído antes (el rol que se esperaba) para que una carrera —por ejemplo, transferirle la titularidad a quien está saliendo— no deje una auditoría sin cambio ni un cambio sin auditoría. Esa misma función la reutilizan la salida, la remoción y, más adelante, `baja-de-cuenta-homesuite` y la salida de grupos en la baja.

### D3. Transferir la titularidad es inmediato y entre integrantes

`transferOwnership(db, { groupId, actorUserId, newOwnerUserId })` solo si quien actúa es titular y el destino es integrante. En un `db.batch`: primero baja a quien cede a `member` y después asciende a quien recibe (el índice único parcial se evalúa por sentencia, por lo que el orden importa y el grupo queda sin titular solo dentro de la transacción); escribe `ownership_transferred` con ambos ids. La transferencia **no** exige aceptación de quien la recibe.

*Alternativa considerada:* dos pasos (oferta y aceptación, con vencimiento). Evita transferir a quien no la quiere, pero agrega un estado, vencimientos y una pantalla más. Como quien recibe puede volver a transferir (o, si es titular y quiere irse, eliminar el grupo), se elige el inmediato por simplicidad. Es una propuesta por decidir (Open Questions 1).

### D4. Quién puede qué

La persona titular no puede salir ni ser quitada: el servidor lo rechaza con un mensaje que explica el camino (transferir; o, cuando exista, eliminar el grupo). Un integrante no puede quitar a nadie. Nadie puede dejar sin titular a un grupo, ni siquiera con dos pedidos concurrentes (el índice único y la condición `role = 'member'` del borrado lo garantizan). Un grupo con un único integrante, su titular, no admite salir: se archiva o, con `eliminacion-de-grupos`, se elimina.

### D5. Saldos: informar, no bloquear

La pantalla de confirmación muestra el saldo de la persona por moneda («Tu saldo: …» o «El saldo de Ana: …»). No bloquea porque obligar a saldar atraparía a quien necesita irse y la plataforma no mueve dinero. Un saldo distinto de cero queda a nombre de la persona sin cuenta, visible para el resto. Se avisa a la persona titular al quitar. Propuesta por decidir (Open Questions 2).

### D6. Aviso a quien sale, derivado de la auditoría

No hay correo. Para que la salida no sea silenciosa, `GET /groups` muestra durante 30 días una nota por cada evento `member_left` o `member_removed` propio («Ya no sos integrante de “X”»), leída de `platform_audit_events` unida a `groups`; sin tabla nueva y sin guardar quién la quitó. No hay descarte persistido: la nota desaparece sola. Si el grupo se purga (`eliminacion-de-grupos`), sus eventos se van con él y la nota también. Propuesta por decidir (Open Questions 3).

### D7. Pantallas y rutas

- `GET/POST /groups/:groupId/leave` (integrante).
- `GET/POST /groups/:groupId/members/:userId/remove` (persona titular).
- `GET/POST /groups/:groupId/ownership` (persona titular).

Cada `GET` es una confirmación con el resumen (saldo, qué se conserva, enlace a exportar) y cada `POST` lleva el token CSRF y pasa por el limitador de mutaciones. Un segundo envío tras la salida redirige a la lista de grupos con la nota (la membresía ya no existe), no a un error. Las cabeceras y el patrón de errores reutilizan `formError`.

### D8. Qué vuelve a aparecer si se restaura un respaldo

Una restauración de D1 a un punto anterior trae de vuelta las membresías. El runbook agrega una consulta de solo lectura a `platform_audit_events` (`member_left`, `member_removed`, `ownership_transferred` posteriores al punto restaurado) y la regla de reaplicarlas antes de reabrir. No se construye un script automático en este cambio (Open Questions 5).

### D9. Vocabulario

El glosario suma las acciones: «Salir del grupo», «Quitar del grupo» y «Transferir titularidad» (interfaz); `leave`, `remove` y `transferOwnership` (código); `/leave`, `/members/:userId/remove`, `/ownership` (URL); `member_left`, `member_removed`, `ownership_transferred` (auditoría). «Persona sin cuenta» sigue siendo la persona con `linked_user_id` nulo.

## Risks / Trade-offs

- [Una carrera entre salir y recibir la titularidad deja un grupo sin titular o una auditoría falsa] → sentencias condicionadas al estado leído, índice único y prueba de concurrencia con dos pedidos simultáneos.
- [Quitar a alguien con saldo pendiente crea una persona con deuda sin cuenta] → se informa, la persona titular decide; el saldo sigue visible y se puede invitar de nuevo.
- [La persona que se fue sigue apareciendo con su nombre en movimientos y revisiones] → es historia compartida de las demás personas; la baja de cuenta cubre la seudonimización.
- [Transferencia inmediata a quien no la quiere] → reversible por quien la recibe; ver Open Questions 1.
- [Una restauración resucita membresías] → runbook y consulta documentada (D8).

## Migration Plan

Sin migración. Despliegue aditivo: rutas y pantallas nuevas, sin cambios en las existentes salvo el ítem del menú y el botón en Personas. Reversión: volver al Worker anterior; los eventos de auditoría escritos quedan inofensivos. Sin datos que preservar más allá de los eventos nuevos.

## Open Questions

Propuestas por decidir (valor por defecto entre paréntesis, que Pablo debe confirmar):

1. **Transferencia de titularidad:** inmediata, sin aceptación de quien la recibe. Alternativa: oferta con aceptación y vencimiento.
2. **Saldo distinto de cero al salir o ser quitada:** se informa y no se bloquea.
3. **Aviso a quien salió o fue quitada:** una nota de 30 días en la lista de grupos, derivada de la auditoría, sin decir quién la quitó. Alternativa: sin aviso.
4. **Volver a entrar:** se puede volver a invitar a la misma persona vinculando su persona anterior, sin plazo de espera.
5. **Reaplicar salidas tras restaurar un respaldo:** consulta y regla documentadas; un script queda para cuando exista un ensayo de restauración con datos reales.
6. **Borrar una persona con historial:** fuera de alcance; sigue como pendiente en el backlog.
