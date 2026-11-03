## Why

Hoy un grupo no se puede eliminar. La única «baja» es archivar, que es reversible y deja todos los datos. La política de ciclo de vida (`docs/HOMESUITE_DATA_LIFECYCLE.md`, puntos 2 y 3) y el backlog bloquean abrir producción a datos reales hasta que exista una eliminación administrada del grupo completo, con confirmación reforzada, autorización exclusiva de quien corresponda, exportación previa y comprobación de que no quedan filas huérfanas. Las páginas legales, además, reconocen derechos de supresión y dicen que «la eliminación autónoma de un grupo o cuenta todavía no está disponible».

Un borrado físico choca con el diseño: `entry_revisions` y `ledger_events` no admiten `UPDATE` ni `DELETE` (triggers de `0003_financial_foundations.sql`; `0008` solo afloja el `DELETE` de revisiones de lotes sin publicar), no hay `ON DELETE CASCADE` en ningún lado y `platform_audit_events.group_id` es clave foránea a `groups`. Hacerlo a mano con SQL pelea con los triggers.

Decisión de Pablo (2026-11-02): **la persona titular elimina el grupo; es un borrado lógico con ventana de 30 días.** Desaparece para todas las personas al instante, se puede recuperar durante 30 días y después el cron diario lo purga físicamente. La purga necesita una excepción controlada a los triggers de inmutabilidad. Antes de eliminar, la aplicación ofrece exportar. Salir del grupo y quitar integrantes (con transferencia de titularidad) se construye antes.

## What Changes

- **Eliminar grupo (persona titular):** una zona de peligro en Administrar grupo lleva a una pantalla de confirmación reforzada: consecuencias, oferta de exportación, estado de la exportación («ya exportaste esta versión» o «hay cambios sin exportar») y confirmación escribiendo el nombre exacto. Al confirmar, el grupo queda marcado como eliminado (`groups.deleted_at`) y **desaparece al instante** para todas las personas: lista, pantallas, exportaciones, invitaciones pendientes y cookie del último grupo.
- **Ventana de 30 días:** la persona titular ve una sección «Grupos eliminados» en su lista, con los días que quedan, y puede **restaurar** el grupo (todo vuelve como estaba) o **exportarlo** mientras dure la ventana. Las demás personas no tienen acceso, pero ven una nota con el nombre del grupo que fue eliminado.
- **Purga física por el cron diario:** pasados los 30 días, `runMaintenance` borra el grupo y todo lo que cuelga de él, en lotes retomables, y deja una fila mínima sin contenido (`group_deletion_log`: identificador opaco, fechas, titular, conteos).
- **Excepción controlada a la inmutabilidad:** una migración reemplaza los triggers de borrado de `entry_revisions` y `ledger_events` para permitir el `DELETE` solo cuando el grupo del libro lleva eliminado 30 días o más. Los `UPDATE` siguen prohibidos. Se registra como excepción en la base común.
- **Ensayo de recuperación:** un ensayo «exportar, eliminar, purgar y restaurar un respaldo» sobre una base descartable, y un paso de runbook para reaplicar las purgas después de restaurar un respaldo anterior.
- **Textos legales y ciclo de vida** actualizados (ver más abajo).

### Non-goals

- Borrado físico inmediato o botón «eliminar ahora» durante la ventana: un adelanto de la purga por pedido de privacidad se atiende por correo (propuesta por decidir).
- Exigir el acuerdo de las demás personas o darles un plazo para exportar: desaparece al instante para todas, por decisión de Pablo.
- Eliminar la cuenta de la persona (`baja-de-cuenta-homesuite`) ni salir/quitar integrantes (`salir-y-quitar-integrantes`).
- Reducir la retención de los respaldos (90 días) o purgar objetos de R2.
- Correo o notificaciones fuera de la aplicación.
- Restauración automática de un grupo desde su exportación.

## Capabilities

### New Capabilities

- `eliminacion-de-grupos`: eliminar con confirmación reforzada, desaparición inmediata, ventana de 30 días, restauración, exportación durante la ventana y avisos.
- `purga-de-grupos`: purga física a los 30 días por el cron, excepción controlada a los triggers, rastro mínimo, ausencia de filas huérfanas y recuperación tras restaurar un respaldo.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no contiene capacidades de plataforma ni de Cuentas Claras. -->

## Impact

- `apps/app/migrations/`: una migración nueva (la siguiente libre; hoy `0013`): `groups.deleted_at` y `deleted_by_user_id`, tabla `group_deletion_log`, y reemplazo de los triggers `entry_revisions_no_delete` y `ledger_events_no_delete`. Aditiva, sin reescribir migraciones (la excepción de OPERACION.md caducó con los primeros datos reales).
- `apps/app/src/`: `groups.js` (eliminar, restaurar, listar), todos los accesos que consultan `groups` o `memberships` (`ledger.js`, `profiles.js`, `index.js`, `routes/*`), un módulo de purga, `maintenance.js`, `group-ui.js` y `routes/group-settings.js` (pantallas), `index.js` (lista y notas).
- `docs/HOMESUITE_DATA_LIFECYCLE.md`, `docs/HOMESUITE_RECOVERY.md`, `docs/homesuite/README.md` (registro de excepciones), `docs/homesuite/GLOSARIO.md`, `docs/productos/CUENTAS-CLARAS.md`, STATUS, backlog y la revisión semanal de `HOMESUITE_VIGILANCIA.md` (purgas vencidas sin ejecutar).
- `apps/site/public/privacidad.html` y `terminos.html`.
- Pruebas: integración D1 de los triggers, de la visibilidad en todas las rutas y de la purga; ensayo de recuperación; E2E en 390 px y escritorio.
- Operación: despliegue con respaldo previo y migración verificada con datos (producción ya tiene datos).

## Dependencias y orden

Orden de los cinco cambios de esta serie:

1. `alertas-minimas-homesuite`. Independiente; deja la vigilancia que debe cubrir la purga.
2. `exportacion-completa-del-grupo`. **Dependencia dura:** la oferta de exportar, el estado «exportación a la revisión vigente» y la exportación durante la ventana la usan.
3. `salir-y-quitar-integrantes`. **Dependencia dura:** no existe grupo sin titular y la titularidad se transfiere o el grupo se elimina; la purga se apoya en la misma noción de membresía.
4. **`eliminacion-de-grupos`** (este).
5. `baja-de-cuenta-homesuite`. **Depende de este cambio:** la persona titular debe transferir o eliminar sus grupos antes de dar de baja la cuenta.

Un recorrido final con dos cuentas reales en producción (guion de la exploración) cierra la serie y queda fuera de estos cinco cambios; su último paso es el ensayo real de eliminación.

## Relación con los respaldos de 90 días

Es el punto más delicado del cambio. Los respaldos diarios en R2 conservan el grupo mientras esté vivo, durante la ventana y hasta que cada respaldo expire a los 90 días. Cronología: eliminar (día 0), invisible desde ese instante; purga física en la base a partir del día 30; el último respaldo que lo contiene se tomó, como mucho, el día de la purga y expira a los 90 días, es decir, **hasta unos 120 días después de eliminar** el grupo todavía existe en copias de seguridad. Eso es coherente con la política publicada («una eliminación en el servicio puede persistir en esas copias hasta su vencimiento») pero hay que decirlo con esos números en la política.

Además, **restaurar un respaldo anterior a una purga resucitaría el grupo**. Por eso `group_deletion_log` conserva el identificador opaco del grupo purgado y el runbook obliga, tras cualquier restauración, a reaplicar las purgas conocidas (marcar los grupos como eliminados hace más de 30 días y dejar que el cron los purgue) antes de reabrir el servicio. Se ensaya. Bajar la retención de 90 días no se propone (decisión de Pablo pendiente solo si una solicitud legal lo exigiera).

## Auditoría

- Mientras el grupo existe (incluida la ventana): `group_deleted` y `group_restored` en `platform_audit_events`, con la persona que actúa, el grupo y en `metadata_json` si la exportación estaba al día y los conteos de integrantes y movimientos. Sin nombres ni emails.
- Al purgar, la auditoría del grupo se va con él (`platform_audit_events.group_id` es clave foránea y los eventos del libro son del libro). Queda una fila en `group_deletion_log` con identificador opaco, fecha de eliminación y de purga, titular y conteos, sin nombre ni contenido, y un registro estructurado `group_purged` en los logs del Worker.
- Un `DELETE` sobre las tablas inmutables fuera de la ventana sigue abortando: la base misma lo impide, no solo la aplicación.

## Permisos de titular y de integrante

| Operación | Persona titular | Integrante |
|---|---|---|
| Eliminar el grupo | Sí | No (403; ni siquiera ve la opción) |
| Restaurar durante la ventana | Sí | No (404: el grupo no existe para ella) |
| Exportar durante la ventana | Sí | No (404) |
| Ver el grupo eliminado | Solo la pantalla de recuperación | Solo una nota con el nombre |

Quien no integra el grupo recibe 404, igual que antes. Las operaciones valen con el grupo archivado.

## Móvil

La confirmación es una pantalla propia (no un diálogo), en una columna: consecuencias en lista corta, botones de exportación de al menos 44 px, campo para escribir el nombre (`autocomplete="off"`, `autocapitalize="off"`) y el botón de eliminar separado y apartado de «Cancelar». «Grupos eliminados» en la lista de grupos se muestra como tarjetas con los días restantes y los botones «Restaurar» y «Exportar». Se verifica en 390 px y escritorio, claro y oscuro, sin desborde horizontal.

## Páginas legales

Tareas descritas en el punto 8 de `tasks.md`, todas **texto legal que revisa Pablo**:

- `privacidad.html`: reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible» por la descripción del flujo (la persona titular elimina; desaparece al instante; recuperable 30 días; luego purga; las copias de seguridad la conservan hasta 90 días más, unos 120 días en total; queda un registro sin contenido); ajustar la frase sobre las copias de seguridad y los derechos de supresión; actualizar la fecha.
- `terminos.html`: quién puede eliminar un grupo, que las demás personas dejan de verlo de inmediato, la recomendación de exportar antes y el plazo de recuperación.
