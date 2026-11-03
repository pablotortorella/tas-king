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
- La investigación normativa del 2026-11-02 (Ley 1581; no es asesoramiento legal) concluye que conservar el nombre por defecto es la opción más expuesta, que ninguna base legal sola sostiene mantenerlo contra la voluntad de la persona, y que Splitwise y Tricount quitan o seudonimizan el nombre. De ahí la elección explícita sin opción marcada.

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

1. **Fase 1 (un `db.batch`):** registrar `account_erasures` en `in_progress` con la elección de nombre, borrar todas las sesiones, anonimizar `users` y `user_profiles` (el nombre según la elección: D3), escribir `account_deletion_requested`. Desde aquí la persona no puede entrar ni usar la cuenta. Después se agrega su identificador al registro externo de supresiones (reintentado por el cron hasta lograrlo).
2. **Fase 2 (por grupo, retomable):** para cada membresía, en un `db.batch` por grupo: si la elección fue quitar el nombre, reescribir los nombres embebidos (D4) y renombrar la persona; si fue conservarlo, marcar la persona con `account_deleted_at`; en ambos casos desvincularla, borrar la membresía y escribir `member_left` (motivo `account_deleted`) y `participant_unlinked`.
3. **Fase 3:** cancelar las invitaciones pendientes que envió y reemplazar por un valor inerte los emails de invitaciones recibidas; marcar `completed_at` y escribir `account_deleted`.

El mismo pedido intenta completar todo; si se corta, `runMaintenance` retoma las bajas `in_progress`. Cada fase es idempotente. La pantalla final se muestra sin sesión (ya no existe) como página de confirmación genérica.

### D3. Elegir qué pasa con el nombre en los grupos ajenos (decisión de Pablo)

La pantalla ofrece dos opciones, **ninguna marcada de antemano**:

- **«Conservar mi nombre para mostrar con la marca “(cuenta eliminada)”».** `users.display_name` pasa a `<nombre para mostrar> (cuenta eliminada)` (el nombre visible de su perfil al momento de la baja, recortado si hace falta) y se guarda en `account_erasures.name_choice = 'keep'`. En cada grupo, la persona vinculada queda sin cuenta, conserva su nombre en el grupo y recibe `ledger_participants.account_deleted_at`; las pantallas, el CSV y el JSON la muestran como `<nombre> (cuenta eliminada)` mientras esa marca exista y no tenga cuenta. No se reescribe historia inmutable.
- **«Quitar mi nombre».** `users.display_name = 'Persona eliminada'`, `name_choice = 'remove'`; la persona del grupo se renombra «Persona eliminada» (con número si ya existe otra en el libro, para no violar la regla de nombres distintos), queda sin cuenta, y se reescriben los nombres embebidos (D4).

**Sin elección, o baja pedida por correo, se aplica «quitar»** (`name_choice = 'remove'`): el silencio nunca autoriza conservar el nombre (Decreto 1074, art. 2.2.2.25.2.4). La pantalla lo dice junto a las opciones. La elección y su fecha quedan en `account_erasures` como prueba.

**Reasociación.** La persona del grupo es una persona sin cuenta como cualquier otra: la titular puede invitar a una cuenta nueva ligando la invitación a ella (`target_participant_id`; el flujo actual de `resolveInvitation`). Al aceptar, `linked_user_id` se completa y `account_deleted_at` se limpia, de modo que la marca desaparece. El nombre de quien cargó movimientos antiguos sigue saliendo del usuario dado de baja (con su marca, si la hubo): es la cuenta anterior, no la nueva. Una persona «Persona eliminada» reasociada conserva ese nombre hasta que la titular la renombre.

El mismo criterio de nombre vale para los pedidos por correo (siempre «quitar»). Los nombres escritos a mano por otras personas (descripciones, notas, filas crudas de importación) no se tocan (Non-goals).

*Alternativas consideradas:* seudonimizar siempre (más protectora, pierde claridad en el grupo) y conservar por defecto con opción de quitar (la idea original; la más expuesta ante la autoridad). La elección explícita sin casilla marcada la decidió Pablo.

### D4. Excepción controlada de **UPDATE** sobre historia inmutable (aprobada por Pablo, 2026-11-02)

Solo la opción «quitar mi nombre» la necesita. Dos lugares de historia inmutable contienen nombres: `ledger_events.metadata_json` (`participant_renamed`: `from` y `to`) y `entry_revisions.snapshot_json` (anulaciones con `creatorName`, y cualquier otro campo de nombre que la auditoría de implementación encuentre). Dejarlos haría que la exportación y la interfaz siguieran mostrando el nombre. Esto cubre las **revisiones** y los **eventos** (autoría y contenido), no solo las filas de integrantes.

Se reemplazan los triggers `*_no_update` de esas dos tablas por una versión que permite el `UPDATE` únicamente si:

- hay una baja en curso: una fila de `account_erasures` en estado `in_progress` con `name_choice = 'remove'`, o de `person_erasures` en estado `in_progress`;
- la fila afectada se relaciona con esa baja (evento sobre una persona vinculada a la cuenta o la persona suprimida; revisión de un movimiento cargado por esa cuenta);
- **ninguna otra columna** cambia (el trigger compara `NEW` con `OLD` en todas las columnas salvo el JSON afectado).

No hay otra puerta: ni importes, ni fechas, ni actores cambian. La excepción figura como **aprobada por Pablo el 2026-11-02** en `docs/homesuite/README.md`, pendiente de implementación y de las pruebas. El orden de las fases (D2) lo exige: se reescribe el JSON **antes** de desvincular la persona, porque el trigger la identifica por el vínculo (o por `person_erasures`).

*Alternativa descartada:* enmascarar al leer. Deja el dato en la base y en cada exportación futura que no pase por el filtro.

### D5. Precondición: grupos propios resueltos

La baja se rechaza si la cuenta es titular de algún grupo vivo. «Resolver» es una de dos acciones, ambas ya existentes: transferir la titularidad a otro integrante, o eliminar el grupo. Un grupo en ventana de 30 días se considera resuelto, con una advertencia: la persona titular que da de baja su cuenta ya no podrá restaurarlo; se purgará a los 30 días como estaba previsto. La baja nunca transfiere ni elimina grupos por sí sola: el efecto lo decide la persona.

### D6. Confirmación: frase escrita y reconfirmación con Google (decisión de Pablo)

La pantalla exige escribir «eliminar mi cuenta» (sin distinguir mayúsculas ni blancos repetidos) y, si la sesión tiene más de 10 minutos (`sessions.created_at`), **reconfirmar con Google**: se redirige a un nuevo inicio de sesión y se vuelve a la pantalla. Para que sea una reautenticación real y no un inicio silencioso, se verifica si el flujo admite `prompt=login` o `max_age=0`; si no, se acepta el inicio de sesión y se anota el límite en el PR. La puerta de aceptación de `politica-y-aceptacion` deja pasar esta pantalla aunque haya una versión de términos sin aceptar.

### D7. Exportar antes de salir

La pantalla lista cada grupo en el que es integrante con el enlace a su exportación y ofrece «Descargar mis datos» (`exportacion-completa-del-grupo`). No son obligatorias.

### D8. Lista de supresiones: restaurar un respaldo nunca revive una cuenta dada de baja

`account_erasures` guarda el `user_id` (opaco) y, junto con el registro externo de supresiones de `eliminacion-de-grupos` (si Pablo lo confirma; `tipo: "account"`), forma la lista de supresiones. Tras restaurar, `scripts/homesuite-app-reapply-suppressions.sh` (compartido con la eliminación de grupos) vuelve a ejecutar las fases 1 a 3 para cada `user_id` que figure como activo en la base restaurada; la función es idempotente y rehace sesiones, anonimización y seudonimización con la **elección original** de nombre. Se ensaya en el mismo ensayo de `eliminacion-de-grupos`.

### D9. Inventario de claves hacia `users` como prueba

Una prueba de integración enumera desde `sqlite_master` todas las columnas que referencian `users(id)` y exige que cada una esté cubierta por un caso: sigue siendo válida tras la baja (la fila de `users` existe) y no expone datos personales. Si alguien agrega una tabla con una referencia nueva a `users` y la baja no la contempla (por ejemplo, un nombre guardado en la tabla), la prueba falla.

### D10. Rutas, vocabulario y alcance de TasKing

`GET /perfil/eliminar-cuenta` y `POST /perfil/eliminar-cuenta`, enlazadas desde «Mi perfil». El glosario suma «Eliminar mi cuenta» (interfaz), `eraseAccount` (código), `/perfil/eliminar-cuenta` (URL), `account_erasures` y `users.deleted_at` (base). La pantalla dice que TasKing tiene cuenta propia y no se ve afectado; el modo de pedir esa baja es el correo de las páginas legales.

### D11. Pedidos por correo: cuentas y personas sin cuenta

- **Cuenta:** el pedido llega al correo de contacto desde el email de la cuenta (así se verifica); se registra en la planilla de `politica-y-aceptacion`; Pablo ejecuta `eraseAccount` desde un script de operación (en seco por defecto, con confirmación, actor nulo y el identificador `SOL-…` en los metadatos) con `name_choice = 'remove'`. Si la cuenta es titular de grupos, el mismo requisito se aplica: la respuesta pide transferirlos o eliminarlos, o, si no puede entrar, Pablo los elimina a su pedido con el script de `eliminacion-de-grupos`.
- **Persona sin cuenta:** quien figura en un grupo sin haberse registrado puede pedir conocer, corregir o suprimir ese dato. Se registra igual. Pablo aplica a la persona del grupo la seudonimización «quitar» con un script (`person_erasures`, en seco por defecto) que renombra a «Persona eliminada», reescribe los eventos de renombre de esa persona bajo la misma excepción y deja `participant_pseudonymized` en la auditoría. Quien pide no tiene cuenta, así que no hay email con que verificarla (Open Questions 2).
- **Plazos** (Ley 1581, arts. 14 y 15; ver `politica-y-aceptacion`): consulta 10 días hábiles (más 5); reclamo y supresión 15 días hábiles (más 8); leyenda «reclamo en trámite» dentro de 2 días hábiles; si el reclamo está incompleto, subsanar dentro de 5 días; sin respuesta en 2 meses se entiende desistido. La baja por pantalla es inmediata y no genera trámite. La respuesta a una supresión dice qué quedó inaccesible y qué persiste hasta cuándo (copias hasta 90 días; descripciones de otras personas que la mencionen).
- **Copias locales:** el procedimiento incluye revisar el inventario de copias locales de `eliminacion-de-grupos` (D13).

### D12. Una persona que pide suprimir sus datos no elimina grupos ajenos

La baja saca a la persona de los grupos; no los elimina (Decisions de `eliminacion-de-grupos`, D14).

## Risks / Trade-offs

- [Baja a medias por un corte] → fases idempotentes, estado `in_progress` y retoma el cron; la fase 1 ya corta el acceso.
- [La excepción de UPDATE abre una puerta a reescribir historia] → condición doble (baja en curso y fila relacionada), comparación de todas las demás columnas, prueba que intenta cambiar un importe y falla, y registro en el documento de excepciones.
- [Nombres que quedan fuera (texto libre, filas crudas, personas sin cuenta con el mismo nombre)] → declarado en Non-goals y en la política; la persona puede escribir al correo.
- [Una restauración resucita la cuenta] → D8 y ensayo.
- [Quien da de baja su cuenta por error] → confirmación escrita, reconfirmación con Google si la sesión tiene más de 10 minutos, y la baja no toca los grupos propios sin acción previa de la persona; no hay recuperación (Open Questions 1).
- [Seudonimizar nombres en grupos ajenos afecta a esas personas] → solo cambian rótulos; los saldos no se tocan; la persona queda visible como «Persona eliminada».
- [Cambio de `google_sub` y reingreso] → quien vuelva entra a una cuenta nueva y vacía; el texto de confirmación lo dice.

## Migration Plan

1. Respaldo previo y migración probada con datos (`users.deleted_at`, tabla nueva, reemplazo de dos triggers), actualizando desde el esquema anterior.
2. Despliegue del Worker con las pantallas desactivadas por defecto hasta verificar en staging con dos cuentas de prueba (una titular con un grupo y un integrante en otro grupo ajeno).
3. Activación en producción tras el recorrido y la revisión de los textos legales por Pablo.
4. Reversión: desactivar la ruta. Una cuenta ya dada de baja no se revierte (se recuperaría solo desde un respaldo, con las bajas reaplicadas). Los triggers no se revierten automáticamente.

## Decisions de Pablo (2026-11-02)

Definitivas; no se reabren en este change.

- **Reconfirmar con Google si la sesión tiene más de 10 minutos** (D6).
- **Elección del nombre sin opción marcada de antemano**; sin elección o por correo se seudonimiza; la persona del grupo se puede reasociar y la marca desaparece (D3).
- **Las dos excepciones a los triggers están aprobadas** (esta, D4, y la de borrado de `eliminacion-de-grupos`).
- **Plazos de la Ley 1581:** consulta 10 días hábiles (más 5); reclamo y supresión 15 días hábiles (más 8); leyenda «reclamo en trámite» en 2 días hábiles (D11).
- **No hay «eliminar ahora»**; la baja de cuenta por pantalla es inmediata e irreversible; restaurar un respaldo nunca revive lo suprimido (D8).

## Open Questions

Propuestas por decidir (valor por defecto entre paréntesis, que Pablo debe confirmar):

1. **Espera de gracia o recuperación de la cuenta:** la baja es inmediata e irreversible, sin gracia (consistente con la investigación: la persona puede pedir la supresión sin demora). Alternativa: 30 días de gracia.
2. **Cómo verificar la identidad de una persona sin cuenta** que pide corregir o suprimir su dato: por defecto, pedirle que describa el grupo y su nombre en él y confirmar con la persona titular; si la titular no responde, aplicar la seudonimización de todos modos por tratarse de un pedido de supresión. Alternativa: exigir un documento (más intrusivo).
3. **Cómo se nombra a la persona seudonimizada:** «Persona eliminada», numerada si hay varias en el grupo.
4. **Grupos en ventana de eliminación:** no impiden la baja; se avisa que no podrán restaurarse.
5. **Bajas pedidas por correo antes de este cambio:** se atienden a mano con la misma función y se registran en `account_erasures`.
6. **Plazo legal exacto y suficiencia de la seudonimización** (la investigación normativa la considera defendible con elección explícita, pero no es asesoramiento legal): la revisa Pablo, idealmente con una persona abogada.
7. **Rebase del requisito modificado de `nucleo-financiero-cuentas-claras`:** al archivar este change, sobre el texto que deje `eliminacion-de-grupos`.
