## Context

Ver `proposal.md` para el motivo. Estado verificado en `main` (1553229):

- `users(id, google_sub UNIQUE, email UNIQUE, display_name, …)` y `user_profiles(user_id PK, name_source, google_display_name, custom_display_name, google_picture_url, avatar_*, …)` con la restricción `name_source <> 'custom' OR custom_display_name IS NOT NULL`. `upsertGoogleUser` busca por `google_sub`; cambiar `google_sub` a un valor inerte hace que un nuevo ingreso con el mismo Google cree una cuenta nueva.
- Claves foráneas obligatorias hacia `users(id)`: `memberships`, `sessions`, `invitations.inviter_user_id`, `ledger_entries.created_by_user_id`, `entry_revisions.actor_user_id`, `ledger_events.actor_user_id`, `idempotency_keys`, lotes de importación, recategorizaciones, `person_merges`, `platform_audit_events.actor_user_id`, `user_profiles`, `ledger_participants.linked_user_id`.
- El nombre de quien cargó un movimiento sale de un `JOIN users` (`creator_name`) y el de quien revisó, de `actor_name`; la anulación guarda además `...entry` (con `creatorName`) dentro de `entry_revisions.snapshot_json`. El renombre de una persona escribe `{ from, to }` en `ledger_events.metadata_json`.
- Los triggers `entry_revisions_no_update`, `ledger_events_no_update` abortan siempre (`0003`). No hay `ON DELETE CASCADE`.
- Tras `salir-y-quitar-integrantes`, `removeMembership` y `transferOwnership` existen. Tras `eliminacion-de-grupos`, hay grupos eliminados con ventana de 30 días y una purga en el cron.
- No se guardan tokens de Google: solo `sub`, email, nombre y URL de foto. No hay nada que revocar del lado de Google.
- La política de privacidad dice que Remanso no guarda nada de la persona en el servidor; se verifica en las tareas.
- TasKing es una aplicación aparte con sesión y cuenta propias.

## Goals / Non-Goals

**Goals:**
- Baja autoservicio, segura contra errores y resumible ante fallos.
- Que los datos personales de la cuenta dejen de ser legibles en HomeSuite, sin alterar un solo importe ni saldo de otros grupos.
- Que una restauración de respaldo no resucite una cuenta dada de baja.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. Anonimizar en el lugar, no borrar la fila de `users`

Borrar `users` rompería las claves foráneas y los grupos de otras personas. Se reescriben los valores: `google_sub = 'deleted:' || id`, `email = 'deleted-' || id || '@deleted.invalid'` (único e inválido), `display_name = 'Persona eliminada'`, y en `user_profiles` `name_source = 'custom'`, `custom_display_name = 'Persona eliminada'`, `google_display_name`, `google_picture_url` y `avatar_emoji` en nulo, `avatar_mode = 'initial'`. Se agrega `users.deleted_at`. Una cuenta con `deleted_at` no puede iniciar sesión (su `google_sub` ya no coincide) y toda comprobación de sesión la rechaza.

*Alternativa descartada:* tabla de «lápidas» aparte con `users` intacta. Dejaría el dato personal en su lugar.

### D2. Fases, la primera inmediata

1. **Fase 1 (un `db.batch`):** registrar `account_erasures` en `in_progress`, borrar todas las sesiones, anonimizar `users` y `user_profiles`, escribir `account_deletion_requested`. Desde aquí la persona no puede entrar ni usar la cuenta.
2. **Fase 2 (por grupo, retomable):** para cada membresía, en un `db.batch` por grupo: reescribir los nombres embebidos (D4), renombrar y desvincular la persona (D3), borrar la membresía y escribir `member_left` (motivo `account_deleted`) y `participant_unlinked`.
3. **Fase 3:** cancelar las invitaciones pendientes que envió y reemplazar por un valor inerte los emails de invitaciones recibidas; marcar `completed_at` y escribir `account_deleted`.

El mismo pedido intenta completar todo; si se corta, `runMaintenance` retoma las bajas `in_progress`. Cada fase es idempotente. La pantalla final se muestra sin sesión (ya no existe) como página de confirmación genérica.

### D3. Seudonimizar la persona del grupo conservando saldos

En cada grupo: la fila de `ledger_participants` con `linked_user_id = <cuenta>` pasa a `display_name = 'Persona eliminada'` (con número si ya hay otra en el libro, para no violar la regla de nombres distintos) y `linked_user_id = NULL`. Sigue activa, con su historial y su saldo. Se sube la revisión del libro. La regla de salida es la misma que la de `removeMembership`; solo se agrega el renombre. Esto ocurre también en grupos que están en su ventana de eliminación.

El nombre que otra persona escribió a mano para alguien sin cuenta no se toca: no es dato de la cuenta (Non-goals).

### D4. Excepción controlada de **UPDATE** sobre historia inmutable

Dos lugares de historia inmutable contienen nombres: `ledger_events.metadata_json` (`participant_renamed`: `from` y `to`) y `entry_revisions.snapshot_json` (anulaciones con `creatorName`, y cualquier otro campo de nombre que la auditoría de implementación encuentre). Dejarlos haría que la exportación y la interfaz siguieran mostrando el nombre.

Se reemplazan los triggers `*_no_update` de esas dos tablas por una versión que permite el `UPDATE` únicamente si:

- hay una fila en `account_erasures` en estado `in_progress`,
- y la fila afectada se relaciona con esa cuenta (evento sobre una persona vinculada a la cuenta que se da de baja; revisión de un movimiento cargado por esa cuenta),
- y **ninguna otra columna** cambia (el trigger compara `NEW` con `OLD` en todas las columnas salvo el JSON afectado).

No hay otra puerta: ni importes, ni fechas, ni actores cambian. La excepción se registra en `docs/homesuite/README.md` como propuesta pendiente de aprobación de Pablo, junto con la de `eliminacion-de-grupos`. El orden de las fases (D2) lo exige: se reescribe el JSON **antes** de desvincular la persona, porque el trigger la identifica por el vínculo.

*Alternativa descartada:* enmascarar al leer (reemplazar el nombre al armar pantallas y exportaciones). Es más simple y no toca los triggers, pero deja el dato en la base y en cada exportación futura que alguien arme sin pasar por ese filtro. Queda como respaldo si Pablo rechaza la excepción (Open Questions 3).

### D5. Precondición: grupos propios resueltos

La baja se rechaza si la cuenta es titular de algún grupo vivo. «Resolver» es una de dos acciones, ambas ya existentes: transferir la titularidad a otro integrante, o eliminar el grupo. Un grupo en ventana de 30 días se considera resuelto, con una advertencia: la persona titular que da de baja su cuenta ya no podrá restaurarlo; se purgará a los 30 días como estaba previsto. La baja nunca transfiere ni elimina grupos por sí sola: el efecto lo decide la persona.

### D6. Confirmación: frase escrita y sesión reciente

La pantalla exige escribir «eliminar mi cuenta» (sin distinguir mayúsculas ni blancos repetidos) y que la sesión tenga menos de 10 minutos de antigüedad (`sessions.created_at`); si no, se redirige a un nuevo inicio de sesión con Google y se vuelve a la pantalla. Para que sea una reautenticación real y no un inicio silencioso, se verifica si el flujo admite `prompt=login` o `max_age=0`; si no, se acepta el inicio de sesión como reautenticación y se anota el límite. Es propuesta por decidir (Open Questions 2).

### D7. Exportar antes de salir

La pantalla lista cada grupo en el que es integrante con el enlace a su exportación (`exportacion-completa-del-grupo`). No es obligatoria. Descargar «mis datos» de la cuenta fuera de los grupos no entra (Open Questions 6).

### D8. Reaplicar bajas tras restaurar un respaldo

`account_erasures` guarda el `user_id` (opaco) de cada baja. El runbook agrega: tras restaurar, leer `account_erasures` del respaldo sano más reciente (o de la base viva) y volver a ejecutar la fase 1-3 para cada `user_id` que figure como activo (la función es idempotente y rehace sesiones, anonimización y seudonimización). Se ensaya junto con el de purgas de grupos.

### D9. Inventario de claves hacia `users` como prueba

Una prueba de integración enumera desde `sqlite_master` todas las columnas que referencian `users(id)` y exige que cada una esté cubierta por un caso: sigue siendo válida tras la baja (la fila de `users` existe) y no expone datos personales. Si alguien agrega una tabla con una referencia nueva a `users` y la baja no la contempla (por ejemplo, un nombre guardado en la tabla), la prueba falla.

### D10. Rutas, vocabulario y alcance de TasKing

`GET /perfil/eliminar-cuenta` y `POST /perfil/eliminar-cuenta`, enlazadas desde «Mi perfil». El glosario suma «Eliminar mi cuenta» (interfaz), `eraseAccount` (código), `/perfil/eliminar-cuenta` (URL), `account_erasures` y `users.deleted_at` (base). La pantalla dice que TasKing tiene cuenta propia y no se ve afectado; el modo de pedir esa baja es el correo de las páginas legales.

## Risks / Trade-offs

- [Baja a medias por un corte] → fases idempotentes, estado `in_progress` y retoma el cron; la fase 1 ya corta el acceso.
- [La excepción de UPDATE abre una puerta a reescribir historia] → condición doble (baja en curso y fila relacionada), comparación de todas las demás columnas, prueba que intenta cambiar un importe y falla, y registro en el documento de excepciones.
- [Nombres que quedan fuera (texto libre, filas crudas, personas sin cuenta con el mismo nombre)] → declarado en Non-goals y en la política; la persona puede escribir al correo.
- [Una restauración resucita la cuenta] → D8 y ensayo.
- [Quien da de baja su cuenta por error] → confirmación escrita, sesión reciente, y la baja no toca los grupos propios sin acción previa de la persona; no hay recuperación (Open Questions 1).
- [Seudonimizar nombres en grupos ajenos afecta a esas personas] → solo cambian rótulos; los saldos no se tocan; la persona queda visible como «Persona eliminada».
- [Cambio de `google_sub` y reingreso] → quien vuelva entra a una cuenta nueva y vacía; el texto de confirmación lo dice.

## Migration Plan

1. Respaldo previo y migración probada con datos (`users.deleted_at`, tabla nueva, reemplazo de dos triggers), actualizando desde el esquema anterior.
2. Despliegue del Worker con las pantallas desactivadas por defecto hasta verificar en staging con dos cuentas de prueba (una titular con un grupo y un integrante en otro grupo ajeno).
3. Activación en producción tras el recorrido y la revisión de los textos legales por Pablo.
4. Reversión: desactivar la ruta. Una cuenta ya dada de baja no se revierte (se recuperaría solo desde un respaldo, con las bajas reaplicadas). Los triggers no se revierten automáticamente.

## Open Questions

Propuestas por decidir (valor por defecto entre paréntesis, que Pablo debe confirmar):

1. **Recuperación o espera de gracia:** la baja es inmediata e irreversible. Alternativa: 30 días de gracia como los grupos, con la cuenta inaccesible pero recuperable.
2. **Reautenticación:** exigir sesión de menos de 10 minutos (con reingreso a Google) además de la frase. Alternativa: solo la frase.
3. **Reescritura de nombres en historia inmutable:** excepción de `UPDATE` acotada (D4). Alternativa: enmascarar al leer.
4. **Cómo se nombra a la persona seudonimizada:** «Persona eliminada», numerada si hay varias en el grupo.
5. **Grupos en ventana de eliminación:** no impiden la baja; se avisa que no podrán restaurarse.
6. **Descarga de «mis datos» de la cuenta** (perfil, membresías, auditoría propia): fuera de alcance; se evalúa si una solicitud legal lo exige.
7. **Bajas pedidas por correo antes de este cambio:** se atienden a mano con la misma función y se registran en `account_erasures`.
8. **Plazo legal para atender la supresión y suficiencia de la seudonimización:** no verificado ni asesoramiento legal; lo revisa Pablo.
