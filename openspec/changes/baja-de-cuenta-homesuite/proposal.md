## Why

Una persona que se registró con Google no tiene forma de borrar su cuenta de HomeSuite: no hay ninguna ruta de baja (búsqueda en `apps/app/src/`: cero resultados) y la política de privacidad dice que «la eliminación autónoma de un grupo o cuenta todavía no está disponible». Mientras tanto reconoce derechos de supresión y se compromete a atender solicitudes por correo. Con datos reales eso significa que cada pedido de baja sería una operación manual con SQL contra triggers de inmutabilidad y claves foráneas obligatorias hacia `users` desde movimientos, revisiones, eventos, lotes y sesiones.

La identidad no se puede borrar sin romper el historial de grupos ajenos (`users` es referenciada por `ledger_entries.created_by_user_id`, `entry_revisions.actor_user_id`, `ledger_events`, `invitations`, `splitwise_import_*`, `person_merges` y más). `users.email` y `google_sub` son únicos, de modo que anonimizar tiene que dejar valores inertes y únicos.

Decisión de Pablo (2026-11-02): la **baja de cuenta es autoservicio ya**, desde «Mi perfil», con confirmación. Hay que definir qué pasa con los grupos donde la persona es titular (exigir transferir o eliminar antes) y con su rastro en el historial de los grupos de otras personas (seudonimizar el nombre, sin romper saldos). TasKing tiene sesión y cuenta propias y queda fuera de alcance.

## What Changes

- **Eliminar mi cuenta, desde «Mi perfil»** (`/perfil`): sección de baja al final y pantalla de confirmación. Antes de ejecutar:
  - **Grupos donde la persona es titular:** la baja se rechaza hasta que cada uno se **transfiera** (`salir-y-quitar-integrantes`) o se **elimine** (`eliminacion-de-grupos`). La pantalla los lista con enlaces a cada acción. Un grupo que ya está en la ventana de 30 días cuenta como resuelto, con una advertencia: nadie podrá restaurarlo.
  - **Grupos donde es integrante:** sale de todos automáticamente, con la operación de `salir-y-quitar-integrantes`.
  - **Exportación:** la pantalla ofrece exportar cada grupo antes de salir.
  - **Confirmación:** escribir «eliminar mi cuenta» y haber iniciado sesión en los últimos 10 minutos (si no, se pide volver a entrar con Google).
- **Anonimización de la identidad:** `users` y `user_profiles` pasan a valores inertes (`google_sub`, `email` y nombre sin dato personal), se borran todas las sesiones y se marca `users.deleted_at`. La cuenta deja de poder entrar al instante. Quien vuelva a entrar con el mismo Google crea una cuenta nueva y vacía.
- **Seudonimización en grupos ajenos, sin romper saldos:** la persona del grupo vinculada a la cuenta se renombra «Persona eliminada» (numerada si ya hay otra), se desvincula y conserva sus saldos; el nombre de quien cargó cada movimiento, que sale de `users`, pasa a «Persona eliminada». Los nombres de la persona que están embebidos en historia inmutable (`ledger_events.metadata_json` de renombres y `entry_revisions.snapshot_json` de anulaciones) se reescriben mediante una **segunda excepción controlada**, acotada a la baja de cuenta.
- **Limpieza de correos:** las invitaciones enviadas por la persona se cancelan y los emails de las invitaciones que recibió se reemplazan por un valor inerte.
- **Operación resumible:** la baja se hace en fases; la primera (acceso y anonimización) es inmediata y las demás las completa el mismo pedido o el cron si se interrumpen.
- **Registro mínimo:** `account_erasures` con identificador opaco, fechas y conteos, sin datos personales, para reaplicar bajas tras restaurar un respaldo.
- **Textos legales** actualizados (ver más abajo).

### Non-goals

- **TasKing queda fuera de alcance**: tiene sesión y cuenta propias (su propia aplicación y condiciones). La pantalla de baja lo dice, y las páginas legales indican cómo pedir esa baja (por correo) mientras no se integre.
- Recuperación de la cuenta después de la baja.
- Seudonimizar nombres escritos a mano por otras personas del grupo (una persona sin cuenta con el mismo nombre; texto libre de descripciones y notas) ni las filas crudas de importaciones.
- Descargar «todos mis datos» de la cuenta fuera de los grupos.
- Una espera de gracia antes de ejecutar la baja (se evalúa en Open Questions).
- Eliminar los respaldos o reducir su retención.
- Datos de Remanso y Jardín Zen: no se guardan en el servidor por persona (se verifica en las tareas).

## Capabilities

### New Capabilities

- `baja-de-cuenta`: precondiciones, confirmación, anonimización de la identidad, salida de grupos, seudonimización en grupos ajenos, excepción controlada de reescritura y registro mínimo.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no contiene capacidades de plataforma ni de Cuentas Claras. -->

## Impact

- `apps/app/migrations/`: una migración nueva (la siguiente libre): `users.deleted_at`, tabla `account_erasures`, y reemplazo de los triggers `ledger_events_no_update` y `entry_revisions_no_update` con una excepción acotada.
- `apps/app/src/`: módulo nuevo de baja (`account-erasure.js`), `profile-routes.js` y `profile-ui.js` o `routes/shell.js` (sección en «Mi perfil» y pantallas), `auth.js` y `sessions.js` (comprobación de sesión reciente y rechazo de cuentas dadas de baja), `maintenance.js` (completar bajas interrumpidas), reutiliza `removeMembership`.
- `docs/HOMESUITE_PROFILE_API.md`, `docs/HOMESUITE_DATA_LIFECYCLE.md` (punto 4), `docs/HOMESUITE_RECOVERY.md`, `docs/homesuite/README.md` (excepciones), glosario, `docs/productos/CUENTAS-CLARAS.md` y `PLATAFORMA.md`, STATUS y backlog.
- `apps/site/public/privacidad.html` y `terminos.html`.
- Pruebas: integración D1 (precondiciones, anonimización, seudonimización, triggers, resumibilidad, inventario de claves hacia `users`), E2E en 390 px y escritorio, y el ensayo de reaplicar bajas tras una restauración.

## Dependencias y orden

Orden de los cinco cambios de esta serie:

1. `alertas-minimas-homesuite`. Independiente.
2. `exportacion-completa-del-grupo`. Independiente; la pantalla de baja la ofrece.
3. `salir-y-quitar-integrantes`. **Dependencia dura:** transferir la titularidad y `removeMembership`.
4. `eliminacion-de-grupos`. **Dependencia dura:** eliminar los grupos propios es una de las dos salidas de una persona titular, y su registro de purgas y su ventana de 30 días definen qué es «resuelto».
5. **`baja-de-cuenta-homesuite`** (este). Va último.

## Relación con los respaldos de 90 días

La identidad anonimizada **persiste en los respaldos hasta 90 días**: un respaldo anterior a la baja contiene el email, el identificador de Google y el nombre. La política ya dice que una eliminación puede persistir en las copias hasta su vencimiento; este cambio agrega una consecuencia práctica: **restaurar un respaldo anterior resucitaría la cuenta**. Por eso `account_erasures` guarda el identificador opaco de cada cuenta dada de baja y el runbook de recuperación obliga a reaplicar las bajas conocidas (la misma función, idempotente) antes de reabrir el servicio. Se ensaya junto con el ensayo de `eliminacion-de-grupos`. Las bajas pedidas por correo antes de este cambio se registran en el mismo mecanismo.

## Auditoría

- `account_deletion_requested` y `account_deleted` en `platform_audit_events` (sin grupo, con la cuenta como actor) con conteos de grupos abandonados y personas seudonimizadas, sin emails ni nombres.
- Por cada grupo abandonado: `member_left` con motivo `account_deleted` y `participant_unlinked` en el libro (que sube su revisión para invalidar vistas previas), igual que una salida.
- `account_erasures`: una fila por baja (identificador de usuario opaco, estado `in_progress` o `completed`, fechas y conteos).
- Los eventos de auditoría que apuntan a la cuenta conservan su referencia, ya anonimizada.

## Permisos de titular y de integrante

La baja la pide únicamente la propia persona, autenticada y con sesión reciente; nadie puede darla de baja a otra. Una persona titular de uno o más grupos no puede completarla hasta transferirlos o eliminarlos. Un integrante la completa sin intervención de ninguna persona titular. Las demás personas de los grupos afectados no pueden impedirlo ni son consultadas; ven la persona «Persona eliminada».

## Móvil

«Eliminar mi cuenta» es el último enlace de «Mi perfil» (no un botón), y lleva a una pantalla de confirmación en una columna: qué pasará, la lista de grupos con sus acciones (controles de al menos 44 px), la exportación, el campo de confirmación (`autocomplete="off"`, `autocapitalize="off"`) y el botón de baja apartado de «Cancelar». Sin ventanas modales. Se verifica en 390 px y escritorio, claro y oscuro, sin desborde horizontal.

## Páginas legales

Tareas descritas en el punto 9 de `tasks.md`, todas **texto legal que revisa Pablo**:

- `privacidad.html`: describir la baja autoservicio (qué se borra: email, identificador de Google, nombre, foto, perfil y sesiones; qué queda: los aportes seudonimizados en los grupos de otras personas, porque forman parte de sus cuentas; las copias de seguridad hasta 90 días); reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible»; conservar el correo para TasKing y casos que la baja no cubre; aclarar que TasKing tiene su propia cuenta; actualizar la fecha.
- `terminos.html`: condiciones de la baja (transferir o eliminar los grupos propios, irreversible, una cuenta nueva es otra cuenta) y su efecto en los grupos de otras personas.
