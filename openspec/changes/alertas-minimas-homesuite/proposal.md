## Why

Antes de aceptar datos financieros reales, HomeSuite necesita enterarse solo cuando algo se rompe. Hoy nadie mira: el respaldo diario de producción falló el 30/10, 31/10, 01/11 y 02/11 (subida a R2 con `403`) y la falla se detectó a mano, no por un aviso. Se arregló el 2026-11-02 (corrida 41545757501, permiso de R2 del token), pero nada garantiza que la próxima falla no pase igual de inadvertida.

Los logs del Worker (`unhandled_error`, `slow_book_open`, `rate_limited`, `maintenance_completed`) existen, pero Workers Logs retiene pocos días (3 en el plan gratuito, 7 en el pago, según la documentación consultada el 2026-11-02) y no hay alertas sobre ellos. `docs/HOMESUITE_DATA_LIFECYCLE.md` lista «monitoreo, alertas y revisión de logs» entre los bloqueos para abrir producción a datos reales.

Decisión de Pablo (2026-11-02): alertas mínimas con **GitHub y Cloudflare**, sin servicios de terceros. Un issue o correo de GitHub cuando falla el respaldo, un chequeo periódico de `/healthz` desde Actions y un control de antigüedad del último respaldo; más las notificaciones del panel de Cloudflare que el plan permita. `slow_book_open` y los 5xx se revisan cada semana, no con alerta.

## What Changes

- **Aviso de respaldo fallido:** el workflow `homesuite-production-backup.yml` suma un job que, si el respaldo falla, abre (o comenta, sin duplicar) un issue de GitHub asignado a Pablo con el enlace a la corrida.
- **Chequeo de salud:** un workflow programado consulta `https://app.homesuite.info/healthz` cada 30 minutos, reintenta antes de dar la alerta, abre un issue si no responde 200 con el cuerpo esperado y lo cierra solo cuando se recupera.
- **Control de antigüedad del respaldo:** un workflow diario verifica que exista una corrida exitosa del respaldo con menos de 26 horas. Cubre el caso en que el respaldo ni siquiera corrió (workflow desactivado, variable `HOMESUITE_PROD_BACKUPS_ENABLED` distinta de `true`, retraso extremo de GitHub).
- **Revisión semanal:** un workflow semanal abre un issue con la lista de cosas a mirar (`slow_book_open`, 5xx, `maintenance_completed`, respaldos, incidentes de Cloudflare, workflows activos). Es el recordatorio de la cita semanal que decidió Pablo.
- **Notificaciones de Cloudflare:** configurar a mano en el panel las que el plan permita (incidentes y mantenimientos de Cloudflare, ataque DDoS HTTP, certificado Universal SSL) y dejar registrado qué se encontró y qué no.
- **Documento de vigilancia:** `docs/HOMESUITE_VIGILANCIA.md` con qué se vigila, con qué señal, quién se entera, cada cuánto se revisa, qué hacer ante cada aviso y los límites conocidos. Enlazado desde operación y recuperación.

### Non-goals

- Servicios de terceros para `/healthz` o latido del cron (por ejemplo UptimeRobot). Se evalúan solo si esta primera capa resulta insuficiente.
- Alertas sobre `slow_book_open` (es una señal de producto, no un incidente) y sobre 5xx de personas usuarias reales: van a la revisión semanal.
- Latido del cron de mantenimiento: no hay aviso por ausencia de `maintenance_completed`; se mira en la revisión semanal.
- Cambios en el Worker de la app, en el esquema o en TasKing.
- Correo transaccional propio de HomeSuite.
- Definir RPO y RTO definitivos: se propone un valor por defecto en `design.md` y lo confirma Pablo.

## Capabilities

### New Capabilities

- `alertas-operativas-homesuite`: avisos de respaldo fallido, de caída de `/healthz` y de respaldo desactualizado; revisión semanal; notificaciones de Cloudflare; documento de vigilancia con sus límites.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no tiene capacidades de operación. -->

## Impact

- `.github/workflows/homesuite-production-backup.yml` (job de aviso) y tres workflows nuevos en `.github/workflows/` (salud, antigüedad, revisión semanal). Solo usan `GITHUB_TOKEN` con permisos mínimos por job; no usan el token de Cloudflare.
- `docs/HOMESUITE_VIGILANCIA.md` (nuevo), `docs/homesuite/OPERACION.md`, `docs/HOMESUITE_RECOVERY.md`, `docs/HOMESUITE_DATA_LIFECYCLE.md`, `docs/STATUS.md` y `docs/PRODUCT_BACKLOG.md`.
- Configuración manual en el panel de Cloudflare (no versionable): requiere a Pablo.
- Sin código de aplicación, migraciones ni cambios de datos. El repositorio es **público**: los issues también lo son, así que no pueden llevar logs, emails ni nombres de grupos.

## Dependencias y orden

Orden de los cinco cambios de esta serie:

1. **`alertas-minimas-homesuite`** (este). No depende de ningún otro. Va primero y en paralelo con `exportacion-completa-del-grupo`.
2. `exportacion-completa-del-grupo`. Independiente.
3. `salir-y-quitar-integrantes`. Conviene después de la exportación (la pantalla de salida la ofrece).
4. `eliminacion-de-grupos`. Depende de 2 y 3.
5. `baja-de-cuenta-homesuite`. Depende de 3 y 4.

Prerrequisito cumplido: el respaldo diario funciona desde el 2026-11-02; sin eso toda alerta habría nacido en rojo. Este cambio no necesita que existan los demás, pero su revisión semanal y su documento deben actualizarse cuando 4 agregue la purga al cron y 5 la baja de cuenta.

## Relación con los respaldos de 90 días

Las alertas vigilan que el respaldo exista y sea reciente; no cambian la retención (R2 expira `production/` a los 90 días). El control de antigüedad mide la última corrida exitosa, y esa corrida ya incluye la descarga y verificación del objeto desde R2 (`db:verify-backup`), de modo que un éxito reciente implica un respaldo recuperable. Un respaldo desactualizado es el riesgo contrario al de eliminación de grupos: ahí la copia de seguridad conserva lo borrado hasta 90 días.

## Auditoría

El historial de alertas es el de GitHub (issues y corridas de Actions), no la base de datos. No se escribe nada en `platform_audit_events` ni en `ledger_events`. Cada issue conserva fecha, workflow y enlace a la corrida.

## Permisos de titular y de integrante

No hay superficie para personas usuarias de Cuentas Claras: el cambio es operativo. El único destinatario es Pablo como operador. No se expone ninguna pantalla ni dato a titulares o integrantes.

## Móvil

Los avisos deben leerse en el teléfono: el título del issue dice qué falló en una línea y el cuerpo empieza con el enlace a la corrida y la acción sugerida, sin tablas ni logs. Verificar que la notificación de GitHub (correo y aplicación móvil) llega y se entiende en pantalla chica.

## Páginas legales

Sin cambios previstos en `privacidad.html` ni `terminos.html`: el chequeo de salud no envía ni lee datos personales y la política ya cubre los registros técnicos. La tarea 5.1 deja constancia de esa revisión; cualquier texto que resulte necesario es **texto legal que revisa Pablo**.
