## Why

Una persona que se registró con Google no tiene forma de borrar su cuenta de HomeSuite: no hay ninguna ruta de baja (búsqueda en `apps/app/src/`: cero resultados) y la política de privacidad dice que «la eliminación autónoma de un grupo o cuenta todavía no está disponible». Mientras tanto reconoce derechos de supresión y se compromete a atender solicitudes por correo. Con datos reales eso significa que cada pedido de baja sería una operación manual con SQL contra triggers de inmutabilidad y claves foráneas obligatorias hacia `users` desde movimientos, revisiones, eventos, lotes y sesiones.

La identidad no se puede borrar sin romper el historial de grupos ajenos (`users` es referenciada por `ledger_entries.created_by_user_id`, `entry_revisions.actor_user_id`, `ledger_events`, `invitations`, `splitwise_import_*`, `person_merges` y más). `users.email` y `google_sub` son únicos, de modo que anonimizar tiene que dejar valores inertes y únicos.

Decisión de Pablo (2026-11-02): la **baja de cuenta es autoservicio ya**, desde «Mi perfil», con confirmación. Hay que definir qué pasa con los grupos donde la persona es titular (exigir transferir o eliminar antes) y con su rastro en el historial de los grupos de otras personas (seudonimizar el nombre, sin romper saldos). TasKing tiene sesión y cuenta propias y queda fuera de alcance.

## What Changes

- **Eliminar mi cuenta, desde «Mi perfil»** (`/perfil`): sección de baja al final y pantalla de confirmación. Antes de ejecutar:
  - **Grupos donde la persona es titular:** la baja se rechaza hasta que cada uno se **transfiera** (`salir-y-quitar-integrantes`) o se **elimine** (`eliminacion-de-grupos`). La pantalla los lista con enlaces a cada acción. Un grupo que ya está en la ventana de 30 días cuenta como resuelto, con una advertencia: nadie podrá restaurarlo.
  - **Grupos donde es integrante:** sale de todos automáticamente, con la operación de `salir-y-quitar-integrantes`.
  - **Exportación:** la pantalla ofrece exportar cada grupo y descargar «mis datos» (`exportacion-completa-del-grupo`).
  - **Elección del nombre en los grupos de otras personas (decisión de Pablo):** la persona **elige**, sin ninguna opción marcada de antemano, entre «Conservar mi nombre para mostrar con la marca “(cuenta eliminada)”» y «Quitar mi nombre», que lo seudonimiza como «Persona eliminada», numerada si hay varias en el grupo. Si no elige, o si pide la baja por correo, se seudonimiza. La elección queda registrada.
  - **Confirmación:** escribir «eliminar mi cuenta» y **reconfirmar con Google si la sesión tiene más de 10 minutos** (decisión de Pablo).
- **Anonimización de la identidad:** `users` y `user_profiles` pasan a valores inertes (`google_sub`, `email`, foto, emoji y color sin dato personal; el nombre según la elección), se borran todas las sesiones y se marca `users.deleted_at`. La cuenta deja de poder entrar al instante. Quien vuelva a entrar con el mismo Google crea una cuenta nueva y vacía.
- **Seudonimización en grupos ajenos, sin romper saldos:**
  - «Quitar mi nombre»: la persona del grupo vinculada a la cuenta se renombra «Persona eliminada», se desvincula y conserva sus saldos; el nombre de quien cargó o revisó cada movimiento, que sale de `users`, pasa a «Persona eliminada»; y los nombres embebidos en historia inmutable (**revisiones** y **eventos**) se reescriben mediante la **segunda excepción controlada, aprobada por Pablo el 2026-11-02** y ya registrada como tal.
  - «Conservar mi nombre»: la persona del grupo queda sin cuenta con su nombre y la marca «(cuenta eliminada)»; los nombres de autoría salen de `users` con la misma marca. No se reescribe historia inmutable.
  - **Reasociación:** esa persona del grupo se puede volver a asociar a una cuenta nueva con una invitación ligada a ella (`target_participant_id`), como cualquier otra persona sin cuenta. Si conservó el nombre, la marca desaparece al reasociarla.
- **Limpieza de correos:** las invitaciones enviadas por la persona se cancelan y los emails de las invitaciones que recibió se reemplazan por un valor inerte.
- **Pedidos por correo:** quien no puede usar la pantalla (o una persona que figura en un grupo sin tener cuenta) pide la baja o la supresión por correo; se registra y mide según `politica-y-aceptacion` (reclamos 15 días hábiles, más 8; leyenda «reclamo en trámite» dentro de 2 días hábiles) y Pablo la ejecuta con herramientas de operación que aplican siempre la seudonimización.
- **Operación resumible** en fases (la primera, acceso y anonimización, es inmediata) y **lista de supresiones**: `account_erasures` más el registro externo de `eliminacion-de-grupos`, que se reaplica tras cualquier restauración de respaldo.
- **Textos legales** actualizados (ver más abajo).

### Non-goals

- **TasKing queda fuera de alcance**: tiene sesión y cuenta propias (su propia aplicación y condiciones). La pantalla de baja lo dice, y las páginas legales indican cómo pedir esa baja (por correo) mientras no se integre.
- Recuperación de la cuenta después de la baja.
- Seudonimizar nombres escritos a mano por otras personas del grupo (descripciones y notas de movimientos, por ejemplo «cena con Ana») ni las filas crudas de importaciones: no se pueden limpiar automáticamente; la política lo dice y la persona puede pedir su revisión por correo.
- Una espera de gracia antes de ejecutar la baja.
- Eliminar los respaldos o reducir su retención.
- Datos de Remanso y Jardín Zen: no se guardan en el servidor por persona (se verifica en las tareas).

## Capabilities

### New Capabilities

- `baja-de-cuenta`: precondiciones, confirmación, anonimización de la identidad, salida de grupos, seudonimización en grupos ajenos, excepción controlada de reescritura y registro mínimo.

### Modified Capabilities

- `nucleo-financiero-cuentas-claras`: «Historia e idempotencia inmutables» suma la excepción de reescritura de nombres durante una baja (se apoya en la excepción de borrado que agrega `eliminacion-de-grupos`; al archivar, este requisito se rebasa sobre el texto vigente).

## Impact

- `apps/app/migrations/`: una migración nueva (la siguiente libre): `users.deleted_at`, `ledger_participants.account_deleted_at` (marca «(cuenta eliminada)»), tablas `account_erasures` (con la elección de nombre) y `person_erasures`, y reemplazo de los triggers `ledger_events_no_update` y `entry_revisions_no_update` con una excepción acotada.
- `apps/app/src/`: módulo nuevo de baja (`account-erasure.js`), `profile-routes.js` y `profile-ui.js` o `routes/shell.js` (sección en «Mi perfil» y pantallas), `auth.js` y `sessions.js` (comprobación de sesión reciente y rechazo de cuentas dadas de baja), `maintenance.js` (completar bajas interrumpidas), reutiliza `removeMembership`.
- `docs/HOMESUITE_PROFILE_API.md`, `docs/HOMESUITE_DATA_LIFECYCLE.md` (punto 4), `docs/HOMESUITE_RECOVERY.md`, `docs/homesuite/README.md` (excepciones), glosario, `docs/productos/CUENTAS-CLARAS.md` y `PLATAFORMA.md`, STATUS y backlog.
- `apps/site/public/privacidad.html` y `terminos.html`.
- Pruebas: integración D1 (precondiciones, anonimización, seudonimización, triggers, resumibilidad, inventario de claves hacia `users`), E2E en 390 px y escritorio, y el ensayo de reaplicar bajas tras una restauración.

## Dependencias y orden

Orden de los seis changes de esta serie (decisión de Pablo, 2026-11-02):

1. `politica-y-aceptacion`. Primero; sin dependencias.
2. `alertas-minimas-homesuite`. Independiente; en paralelo con `exportacion-completa-del-grupo`.
   `exportacion-completa-del-grupo`. Independiente; en paralelo con `alertas-minimas-homesuite`.
3. `salir-y-quitar-integrantes`.
4. `eliminacion-de-grupos`.
5. `baja-de-cuenta-homesuite` (este).

- **Dependencias duras:** `salir-y-quitar-integrantes` (transferir la titularidad y `removeMembership`) y `eliminacion-de-grupos` (eliminar los grupos propios es una de las dos salidas de una persona titular; su registro de supresiones y su ventana definen qué es «resuelto»).
- `politica-y-aceptacion` aporta la política, el procedimiento de solicitudes y la puerta de aceptación, que deja pasar la baja aun con una versión sin aceptar.
- `exportacion-completa-del-grupo` aporta las exportaciones que la pantalla de baja ofrece.

## Relación con los respaldos de 90 días

La identidad anonimizada **persiste en los respaldos hasta 90 días**: un respaldo anterior a la baja contiene el email, el identificador de Google y el nombre. La política ya dice que una eliminación puede persistir en las copias hasta su vencimiento; este cambio agrega una consecuencia práctica: **restaurar un respaldo anterior resucitaría la cuenta**. Por eso `account_erasures` guarda el identificador opaco de cada cuenta dada de baja (y, si Pablo lo confirma, el registro externo de `eliminacion-de-grupos` también) y el runbook de recuperación obliga a reaplicar la lista de supresiones (la misma función, idempotente) antes de reabrir el servicio: restaurar un respaldo nunca revive lo suprimido. Se ensaya junto con el ensayo de `eliminacion-de-grupos`. Las bajas pedidas por correo antes de este cambio se registran en el mismo mecanismo.

## Auditoría

- `account_deletion_requested` y `account_deleted` en `platform_audit_events` (sin grupo, con la cuenta como actor) con conteos de grupos abandonados y personas seudonimizadas, sin emails ni nombres.
- Por cada grupo abandonado: `member_left` con motivo `account_deleted` y `participant_unlinked` en el libro (que sube su revisión para invalidar vistas previas), igual que una salida.
- `account_erasures`: una fila por baja (identificador de usuario opaco, elección de nombre, estado `in_progress` o `completed`, fechas y conteos). `person_erasures` hace lo mismo para una persona sin cuenta suprimida por correo.
- Las solicitudes por correo se registran en la planilla privada de `politica-y-aceptacion`, con el identificador `SOL-…` en los metadatos del evento.
- Los eventos de auditoría que apuntan a la cuenta conservan su referencia, ya anonimizada.

## Permisos de titular y de integrante

La baja la pide únicamente la propia persona, autenticada y con sesión reciente (reconfirmada con Google si pasaron más de 10 minutos); nadie puede darla de baja a otra. Las solicitudes por correo las ejecuta únicamente Pablo, tras verificar la identidad. Una persona titular de uno o más grupos no puede completarla hasta transferirlos o eliminarlos. Un integrante la completa sin intervención de ninguna persona titular. Las demás personas de los grupos afectados no pueden impedirlo ni son consultadas; ven la persona «Persona eliminada».

## Móvil

«Eliminar mi cuenta» es el último enlace de «Mi perfil» (no un botón), y lleva a una pantalla de confirmación en una columna: qué pasará, la lista de grupos con sus acciones (controles de al menos 44 px), la exportación, el campo de confirmación (`autocomplete="off"`, `autocapitalize="off"`) y el botón de baja apartado de «Cancelar». Sin ventanas modales. Se verifica en 390 px y escritorio, claro y oscuro, sin desborde horizontal.

## Páginas legales

Tareas descritas en el punto 9 de `tasks.md`, todas **texto legal que revisa Pablo**:

- `privacidad.html`: describir la baja autoservicio (qué se borra: email, identificador de Google, foto, perfil y sesiones; la **elección** entre conservar el nombre con la marca «(cuenta eliminada)» o quitarlo, y que sin elección se quita; qué queda: los movimientos en los grupos de otras personas, porque forman parte de sus cuentas, y las descripciones que otras personas hayan escrito; la persona del grupo se puede reasociar a una cuenta nueva; las copias de seguridad hasta 90 días; los plazos de respuesta); reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible»; conservar el correo para TasKing y casos que la baja no cubre; aclarar que TasKing tiene su propia cuenta; actualizar la fecha.
- `terminos.html`: condiciones de la baja (transferir o eliminar los grupos propios, irreversible, una cuenta nueva es otra cuenta) y su efecto en los grupos de otras personas.
