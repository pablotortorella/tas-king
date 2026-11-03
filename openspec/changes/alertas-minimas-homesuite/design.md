## Context

Ver `proposal.md` para el motivo. Estado verificado el 2026-11-02:

- `.github/workflows/homesuite-production-backup.yml` corre a las `17 5 * * *` (UTC), con `if: vars.HOMESUITE_PROD_BACKUPS_ENABLED == 'true'`, exporta la D1, restaura en local, sube a R2 y verifica la descarga. Si la variable no vale `true`, el job se **omite** sin error. Las corridas del 30/10 al 02/11 fallaron en la subida a R2 (403); la 41545757501 (manual, 2026-11-02) pasó.
- Las corridas programadas **no salen a la hora**: se observaron a las 10:54, 11:49 y 13:28 UTC en lugar de las 05:17. Cualquier umbral de antigüedad debe tolerar eso.
- `/healthz` responde `{"status":"ok","service":"homesuite-app"}` (`apps/app/src/index.js`). El Worker de producción tiene observabilidad activa con muestreo 100 % y el cron de mantenimiento `23 4 * * *`.
- El repositorio es **público** (comprobado con `gh repo view`). Los issues son públicos.
- Documentación de Cloudflare Notifications consultada el 2026-11-02 («Available alerts»): no lista ninguna notificación de Workers, D1, R2 ni Workers Builds. Sí figuran, para todos los planes: Incident Alerts, Maintenance Notification, HTTP DDoS Attack Alert, Universal SSL Alert, Security Insights y Weekly summary de Web Analytics. Health Checks exige plan Professional o superior; las alertas de tasa de error (Origin/Advanced Error Rate) son Enterprise. Una búsqueda en la documentación de Workers no encontró una regla de alerta nativa por tasa de error de un Worker; los errores solo se ven como métrica en el panel.

## Goals / Non-Goals

**Goals:**
- Que una falla del respaldo, una caída de la app o un respaldo ausente llegue a Pablo sin que nadie mire.
- Costo cero y sin cuentas nuevas: GitHub y el panel de Cloudflare.
- Un único documento que diga qué se vigila, qué no y cuándo se revisa a mano.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. El aviso es un issue de GitHub, deduplicado, no solo la notificación del workflow

GitHub notifica por correo la falla de un workflow programado a quien creó el workflow o editó por última vez la línea `cron`; si esa persona tiene desactivadas las notificaciones de Actions, no llega nada. No se sabe si llegó algún correo por las fallas del 30/10 al 02/11 (pregunta 12 de la exploración, sin respuesta). Por eso el aviso no depende de esa regla: un job `notify-failure` con `needs: backup` y `if: failure()` ejecuta `gh issue create` (o `gh issue comment` si ya hay uno abierto con la etiqueta `alerta-operativa` y el mismo título). El issue se asigna a `pablotortorella`, de modo que la notificación llega por el mecanismo de asignaciones, que es independiente del de Actions.

Permisos del job: `issues: write` y `contents: read`, nada más. Contenido: título fijo («Alerta: el respaldo diario de producción falló»), enlace a la corrida, fecha UTC y la acción sugerida («ver docs/HOMESUITE_VIGILANCIA.md»). **Nunca** logs, nombres de grupos ni emails: el repositorio es público.

*Alternativa descartada:* confiar solo en el correo del workflow fallido. No se pudo verificar que funcione.

### D2. Chequeo de salud: cada 30 minutos, con reintentos y cierre automático

`homesuite-production-health.yml`, `cron: '*/30 * * * *'` y `workflow_dispatch`. Hace hasta 3 intentos separados por 15 segundos, con `curl --max-time 10`, y exige código 200 y el cuerpo esperado. Si los tres fallan abre o comenta el issue «Alerta: /healthz de producción no responde»; si responde bien y hay un issue abierto, comenta «recuperado» y lo cierra. Los reintentos evitan avisar por un tropiezo de red del runner.

El intervalo de 30 minutos es un compromiso: GitHub retrasa los programados (ver Context) y el mínimo es 5 minutos; para un grupo familiar, enterarse en menos de una hora es suficiente. Es un valor por afinar en la revisión.

*Alternativa descartada:* chequeo desde un monitor externo gratuito; es una decisión de Pablo diferirlo.

### D3. Control de antigüedad con la API de Actions, a las 20:00 UTC, umbral de 26 horas

`homesuite-backup-freshness.yml` corre una vez por día a las 20:00 UTC y ejecuta `gh run list --workflow homesuite-production-backup.yml --status success --limit 1 --json createdAt`. Si no hay ninguna o su antigüedad supera 26 horas, abre o comenta el issue «Alerta: no hay un respaldo de producción reciente». Con la hora de salida observada (hasta ~13:30 UTC), el respaldo del día tiene a las 20:00 UTC como máximo unas 15 horas; un día salteado da más de 30. Si GitHub retrasara el respaldo más de 14 horas habría un falso aviso: se acepta.

No se consulta R2: una corrida exitosa ya descargó y verificó el objeto (`db:verify-backup`), así que el éxito reciente de la corrida es evidencia suficiente y no hace falta otro token. Verificar de forma independiente el contenido de R2 (listar objetos) queda como mejora posible; no se verificó que `wrangler r2 object` permita listar.

Este control también detecta el workflow desactivado y la variable `HOMESUITE_PROD_BACKUPS_ENABLED` mal puesta.

### D4. Revisión semanal como issue recordatorio

`homesuite-weekly-ops-review.yml`, lunes 12:00 UTC: abre un issue «Revisión semanal de operación AAAA-Sww» asignado a Pablo, con la lista de verificación del documento de vigilancia. Es una cita, no una alerta: si el issue anterior sigue abierto, el nuevo lo menciona. Lista mínima:

1. Workers Logs: contar `slow_book_open` (señal de producto: cuándo pasar a SQL) y revisar `unhandled_error`, `rate_limited` y `csrf_rejected`.
2. Panel de Workers: errores y respuestas 5xx de la semana.
3. `maintenance_completed` aparece a diario (no hay alerta por su ausencia).
4. Últimos 7 respaldos en verde; tamaño del respaldo y de la D1.
5. Correos de incidentes y mantenimientos de Cloudflare.
6. Los workflows de vigilancia siguen activos (no figuran como desactivados por inactividad).
7. Issues `alerta-operativa` abiertos.
8. Solicitudes de datos personales abiertas con 5 días hábiles o menos y vencidas (planilla y `scripts/solicitudes-plazos.mjs` de `politica-y-aceptacion`).
9. Cuando exista `eliminacion-de-grupos`: grupos eliminados hace más de 32 días que siguen sin purgar.

**Límite que Pablo debe conocer:** con retención de 3 días (plan gratuito) una revisión semanal solo ve las últimas 72 horas de logs; los 5xx anteriores se ven únicamente como métrica del panel (retención no verificada). Es la pregunta 13 de la exploración (plan de la cuenta) y queda en Open Questions.

### D5. Notificaciones de Cloudflare: configuración manual y registrada

No se pueden versionar. Tarea manual de Pablo en *Notifications*, con destino el correo del operador: Incident Alerts (todos los componentes que el filtro permita, al menos Workers, D1, R2, DNS y red), Maintenance Notification, HTTP DDoS Attack Alert y Universal SSL Alert. Se agrega todo lo que el panel muestre para Workers o D1 si el plan lo ofrece. El resultado se anota en `HOMESUITE_VIGILANCIA.md` con fecha: qué se activó, qué no existía y qué quedó sin verificar.

**No verificado:** si la cuenta tiene alguna notificación específica de Workers/D1/R2 (la documentación pública no la lista); el plan de la cuenta; si el filtro de Incident Alerts permite elegir esos componentes.

### D6. Mínimo privilegio y sin secretos nuevos

Los cuatro avisos usan solo `GITHUB_TOKEN` con permisos por job (`issues: write`, `actions: read` para consultar corridas). Ninguno recibe el token de Cloudflare. Una prueba estática lee los workflows y falla si alguno de vigilancia usa `secrets.` distintos de `GITHUB_TOKEN` o `permissions` más amplios que los declarados.

### D7. Un documento, enlazado, con los límites a la vista

`docs/HOMESUITE_VIGILANCIA.md`: tabla señal → mecanismo → quién se entera → cada cuánto → qué hacer, y una sección «Qué no se vigila» (5xx de personas, ausencia del cron, `slow_book_open`, caída del propio GitHub, workflows desactivados por inactividad). Se enlaza desde `OPERACION.md` (que hoy no menciona monitoreo) y desde el pendiente de `HOMESUITE_RECOVERY.md`, y actualiza la línea «monitoreo, alertas» de `HOMESUITE_DATA_LIFECYCLE.md`.

## Risks / Trade-offs

- [GitHub desactiva los workflows programados de un repositorio público tras 60 días sin actividad; eso apagaría también las alertas] → no verificado en la práctica; la revisión semanal incluye comprobarlo y el repositorio recibe cambios con frecuencia. Si ocurriera, el síntoma es el silencio: por eso existe la lista semanal.
- [Los programados se retrasan o se omiten bajo carga] → umbrales con holgura (26 h) y reintentos; se registra el retraso observado.
- [Un issue público filtra información] → plantilla fija sin logs; revisión del texto en la tarea 1.3.
- [Fatiga de alertas] → se alerta solo lo accionable (respaldo, caída, antigüedad); lo demás va a la cita semanal.
- [Caída de GitHub Actions] → sin aviso; límite aceptado y documentado.
- [Falsos avisos por el intervalo y el retraso] → se ajusta tras dos semanas con los datos reales de las corridas.

## Migration Plan

1. Agregar los workflows en una rama; probar cada camino con `workflow_dispatch` y una entrada `simulate` (forzar la falla) y comprobar que se abre, no se duplica y se cierra el issue.
2. Integrar a `main` (los programados solo corren desde la rama por defecto).
3. Configurar las notificaciones de Cloudflare y registrar el resultado.
4. Reversión: borrar o desactivar los workflows nuevos y quitar el job de aviso; no hay datos ni esquema.

## Open Questions

Propuestas por decidir (cada una con su valor por defecto, que Pablo debe confirmar):

1. **RPO/RTO:** se propone RPO ≤ 24 horas (respaldo diario; Time Travel de D1 permitiría menos, retención de Time Travel no verificada en este cambio) y RTO ≤ 1 día hábil, con restauración ensayada. Pregunta 15 de la exploración.
2. **Plan de Cloudflare de la cuenta** (gratuito o pago): define la retención de Workers Logs (3 u 7 días) y qué notificaciones existen. Por defecto se asume el gratuito y la revisión semanal se declara limitada a 3 días de logs.
3. **Frecuencia del chequeo de salud:** 30 minutos por defecto.
4. **Destino de los avisos:** el correo de GitHub de Pablo y la aplicación móvil de GitHub; no se agrega otro canal.
5. **Verificación independiente de R2** (listar el último objeto): fuera de alcance por defecto.
6. **Chequeo del sitio público** (`homesuite.info`) y de TasKing: fuera de alcance por defecto.
