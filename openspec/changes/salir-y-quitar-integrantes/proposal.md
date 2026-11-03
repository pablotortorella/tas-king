## Why

Hoy nadie puede salir de un grupo ni sacar a otra persona. La búsqueda en `apps/app/src/` no encuentra ninguna ruta de salida, de remoción ni de transferencia de titularidad, y la titularidad es única por índice (`memberships_one_owner_per_group`). El «salir» del guion de prueba con dos cuentas reales solo puede ser cerrar sesión, y el backlog ya registra el pedido de Pablo (2026-10-27): «Hoy no hay forma de quitar a nadie».

Esto bloquea tres cosas antes de aceptar datos reales: una persona que se equivocó de grupo o dejó de compartir no tiene cómo irse; la persona titular que invitó a quien no debía no puede corregirlo; y la eliminación de grupos y la baja de cuenta necesitan estas operaciones como base (una persona titular no puede irse sin dejar a alguien a cargo).

Decisión de Pablo (2026-11-02): salir del grupo y quitar integrante, con transferencia de titularidad, **se construye y va antes de la eliminación de grupos**.

## What Changes

- **Salir del grupo:** un integrante (que no es titular) abandona el grupo desde el menú del grupo. Pierde el acceso al instante, deja de verlo en su lista y su cookie del último grupo deja de servir. La persona del grupo vinculada a su cuenta **se conserva** con su nombre y su saldo, pero queda sin cuenta (`linked_user_id` en nulo), de modo que se puede volver a invitar vinculándola.
- **Quitar integrante:** la persona titular saca a un integrante con cuenta desde Personas, con una pantalla de confirmación. Mismos efectos que salir.
- **Transferir la titularidad (decisión de Pablo: inmediata, sin aceptación):** la persona titular elige a otro integrante con cuenta y le cede la titularidad en el acto; quien la cedía pasa a integrante. Requisito para que una persona titular pueda salir.
- **Reglas de borde:** la persona titular no puede salir ni ser quitada (debe transferir antes; hasta que exista la eliminación de grupos, un grupo con un solo integrante solo se puede archivar); nadie se quita a sí misma por «quitar»; no se puede transferir a alguien que no es integrante.
- **Informar, no bloquear, por saldo (decisión de Pablo):** la pantalla muestra el saldo de la persona que se va por moneda; no impide salir.
- **Aviso en la app** a quien salió o fue quitada: una nota en su lista de grupos durante 30 días, sin crear tablas nuevas (se deriva de la auditoría).
- **Auditoría** de cada operación en `platform_audit_events` y en la línea de tiempo del libro.
- **Textos legales** actualizados (ver más abajo).

### Non-goals

- Borrar personas que figuran en los movimientos (el pedido del backlog para «borrar una persona que participa»): una persona con historial no se borra; ese caso queda en el backlog.
- Roles nuevos, titulares múltiples o permisos finos.
- Correo o notificaciones fuera de la aplicación (no hay correo transaccional).
- Eliminar el grupo (`eliminacion-de-grupos`) ni la cuenta (`baja-de-cuenta-homesuite`).
- Seudonimizar el nombre de quien se va: sigue en el historial del grupo. Eso lo hace la baja de cuenta, no la salida.
- Aceptación de la titularidad por parte de quien la recibe en dos pasos (descartado por Pablo).

## Capabilities

### New Capabilities

- `salida-y-remocion-de-integrantes`: salir del grupo, quitar a un integrante, qué se conserva, avisos y auditoría.
- `transferencia-de-titularidad`: ceder la titularidad a otro integrante y las reglas que impiden dejar un grupo sin titular.

### Modified Capabilities

- `plataforma-homesuite-minima`: el requisito «Roles iniciales preservan una titularidad transferible» deja de decir que la transferencia no forma parte del corte; ahora existe.

## Impact

- `apps/app/src/groups.js` (operaciones nuevas) o un módulo `membership.js`, `routes/people.js` y `routes/group-settings.js` (rutas), `people-ui.js` y `group-ui.js` (pantallas y botones), `ui-parts.js` (ítem del menú del grupo), `index.js` (aviso en la lista de grupos).
- Sin migración de esquema: se usan `memberships`, `ledger_participants.linked_user_id`, `platform_audit_events` y `ledger_events`.
- `docs/homesuite/GLOSARIO.md` (acciones nuevas), `docs/HOMESUITE_RECOVERY.md` (reaplicar salidas tras una restauración), `docs/productos/CUENTAS-CLARAS.md`, STATUS y backlog (cierra el pendiente «borrar personas del grupo» en lo que corresponde).
- `apps/site/public/privacidad.html` y `terminos.html`.
- Pruebas: integración D1 de permisos, atomicidad y concurrencia; E2E de las pantallas en 390 px y escritorio.

## Dependencias y orden

Orden de los seis changes de esta serie (decisión de Pablo, 2026-11-02):

1. `politica-y-aceptacion`. Primero; sin dependencias.
2. `alertas-minimas-homesuite`. Independiente; en paralelo con `exportacion-completa-del-grupo`.
   `exportacion-completa-del-grupo`. Independiente; en paralelo con `alertas-minimas-homesuite`.
3. `salir-y-quitar-integrantes` (este).
4. `eliminacion-de-grupos`.
5. `baja-de-cuenta-homesuite`.

- Sin dependencias duras. Conviene después de `exportacion-completa-del-grupo`, porque la pantalla de salida la ofrece.
- `eliminacion-de-grupos` **depende de este change**: la titularidad se transfiere o el grupo se elimina; el estado «sin titular» no existe.
- `baja-de-cuenta-homesuite` **depende de este change** y del 4: exige transferir o eliminar los grupos que la persona titular tenga y sale de los demás con esta misma operación.

## Relación con los respaldos de 90 días

Salir o ser quitada borra una fila de `memberships`. Los respaldos diarios (retención de 90 días) conservan la membresía anterior. Restaurar un respaldo antiguo **resucitaría** el acceso de una persona que se fue. El runbook de recuperación pasa a incluir, después de cualquier restauración, listar los eventos `member_left` y `member_removed` posteriores al punto restaurado y reaplicarlos antes de reabrir el servicio. Las políticas legales ya dicen que una eliminación puede persistir en las copias hasta 90 días.

## Auditoría

Cada operación escribe en la misma tanda (`db.batch`) que el cambio:

- `platform_audit_events`: `member_left`, `member_removed` y `ownership_transferred`, con la persona que actúa, el grupo y, en `metadata_json`, solo identificadores (`userId`, `participantId`, `fromUserId`, `toUserId`). Nunca emails ni nombres.
- `ledger_events` (vía `recordLedgerChange`): `participant_unlinked` sobre la persona desvinculada, que además sube la revisión del libro para invalidar vistas previas abiertas.

## Permisos de titular y de integrante

| Operación | Persona titular | Integrante |
|---|---|---|
| Salir del grupo | No (debe transferir primero) | Sí |
| Quitar a un integrante | Sí, a cualquier integrante con cuenta que no sea ella | No (403) |
| Transferir la titularidad | Sí, a un integrante con cuenta | No (403) |
| Ver la pantalla de salida o transferencia | Su pantalla | La suya |

Quien no integra el grupo recibe 404 sin distinguir entre grupo inexistente y ajeno. Las tres operaciones valen también con el grupo archivado: no son escrituras monetarias.

## Móvil

Cada operación es una pantalla de confirmación propia, sin ventanas modales: una columna, botón de confirmación separado del de cancelar, controles de al menos 44 px. En Personas, «Quitar» abre esa pantalla; «Salir del grupo» está en el menú del grupo (integrantes) y «Transferir titularidad» en Administrar grupo (persona titular). Se verifica en 390 px y escritorio, claro y oscuro, sin desborde horizontal.

## Páginas legales

Tareas descritas en el punto 6 de `tasks.md`, todas **texto legal que revisa Pablo**:

- `privacidad.html`: qué pasa con tus datos cuando salís o te quitan (perdés el acceso; tu nombre y tus movimientos quedan en el historial del grupo porque forman parte de las cuentas de las demás personas; la baja de cuenta es el camino para seudonimizar tu nombre); ajustar la frase sobre derechos de supresión; actualizar la fecha.
- `terminos.html`: responsabilidades de la persona titular (administra el grupo, puede quitar integrantes y debe transferir la titularidad antes de irse) y que quien se va no se lleva el acceso pero puede pedir exportar antes.
