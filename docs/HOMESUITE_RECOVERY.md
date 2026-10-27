# HomeSuite: backup y recuperación

**Estado:** staging comprobado; respaldo y restauración de producción vacía acreditados

**Fecha:** 2026-10-27

## Capas de recuperación

1. D1 Time Travel ofrece el punto de recuperación inmediato mediante bookmark.
2. Antes de migrar staging se guarda un export SQL local con checksum.
3. Cada export se importa en una D1 local aislada antes de considerarlo válido.
4. Producción guarda una copia en R2 privado, con retención de 90 días.

Los artefactos viven bajo `backups/homesuite-app/`, están ignorados por Git y no
se consideran una copia externa.

## Crear y comprobar un backup

```bash
npm run db:backup:homesuite-app:staging
npm run db:restore-drill:homesuite-app -- backups/homesuite-app/staging/<timestamp>/database.sql
```

El backup falla cerrado si no obtiene bookmark, SQL o un archivo no vacío. El
manifiesto registra ambiente, base, hora UTC y SHA-256. El restore drill usa un
directorio temporal nuevo, nunca `--remote`, y verifica:

- `PRAGMA quick_check` con resultado `ok`;
- ninguna fila en `PRAGMA foreign_key_check`;
- presencia de `users`, `groups`, `memberships`, `invitations` y `sessions`.

D1 no autoriza `PRAGMA integrity_check`; `quick_check` es la comprobación de
integridad compatible usada deliberadamente.

El 2026-10-20 el deploy exportó staging antes de la migración `0003`. El backup
UTC `20261020T053821Z` produjo un SQL de 3210 bytes con SHA-256
`bcce634f4274528b9a94b12381181c955da71d7a204a6731cc0450ba8657061c`; el
restore drill terminó correctamente. La ruta local y el bookmark no se
versionan.

## Deploy de staging

```bash
npm run deploy:homesuite-app:staging
```

La cadena es obligatoria: **backup → migraciones → Worker**. Si falla el backup,
no comienza la migración; si falla la migración, no se publica el Worker.

La publicación futura de HomeSuite App usa
`npm run deploy:homesuite-app:production` desde el SHA integrado y aprobado.
Encadena respaldo externo con ensayo local, migraciones y Worker. La creación
inicial sin dominio realizada el 2026-10-27 fue sólo un bootstrap de
infraestructura, no ese despliegue público.

## Rollback

1. Detener nuevas escrituras si el incidente puede agravar datos.
2. Registrar Version ID, request IDs, migración aplicada y hora UTC aproximada.
3. Si sólo falló código compatible, volver a una versión anterior del Worker.
4. Si la base quedó dañada, elegir un bookmark anterior al incidente y revisar
   primero el export local correspondiente.
5. Ensayar la restauración sobre D1 local y verificar integridad, foreign keys y
   tablas esenciales.
6. Restaurar remotamente mediante Time Travel sólo con aprobación explícita para
   ese ambiente; el restore drill nunca ejecuta esta acción.
7. Verificar `/healthz`, autenticación, aislamiento, conteos y logs después del
   rollback. Documentar el RPO real y cualquier dato posterior perdido.

No se restaura staging o producción desde un archivo elegido sólo por fecha: se
comprueba su manifiesto y checksum. Un rollback de Worker no revierte D1.

## Producción: respaldo externo acreditado

- El bucket R2 privado `homesuite-app-backups` existe desde 2026-10-27, separado
  de D1 y de la máquina operadora. La regla `expire-production-90d` vence los
  objetos bajo `production/` a los 90 días.
- `npm run db:backup:homesuite-app:production` obtiene bookmark, exporta a un
  directorio temporal privado, restaura localmente y sube SQL, bookmark y
  manifiesto a R2. El archivo temporal se destruye al terminar. Wrangler
  generó una URL de exportación temporal en la primera ejecución; desde entonces
  la salida del comando de exportación se suprime para evitar registrarla.
- El respaldo `production/20261027T193248Z` se recuperó de R2 con
  `npm run db:verify-backup:homesuite-app -- production/20261027T193248Z`:
  SHA-256, `quick_check`, claves foráneas y tablas esenciales correctos.

La tarea diaria `.github/workflows/homesuite-production-backup.yml` está activa
a las 05:17 UTC, con restauración local antes de subir y verificación de descarga
desde R2 después. Usa el secreto de repositorio
`HOMESUITE_PROD_BACKUP_API_TOKEN` y la variable
`HOMESUITE_PROD_BACKUPS_ENABLED=true`. La credencial es un Account API token
personalizado de Cloudflare; el alcance exacto de su permiso D1 debe confirmarse
en el panel. R2 usa `Workers R2 Storage Bucket Item Write` limitado al bucket
de backups. No usar una clave global ni un token S3 exclusivo de R2.

**Consulta abierta (2026-10-27):** ¿el permiso `D1 Edit` concedido para que
`wrangler d1 export` funcione está restringido a `homesuite-app-db` o habilita
edición de todas las D1 de la cuenta, incluidas las de TasKing? La ejecución
exitosa sólo acredita que el token puede exportar HomeSuite; no permite inferir
su alcance. Revisar las políticas del token en Cloudflare, registrar el alcance
real y, si es global, decidir cómo reducir la exposición antes de considerar
cerrado el control de acceso mínimo. Seguimiento en el [backlog](PRODUCT_BACKLOG.md).

El primer ensayo del workflow falló al exportar D1: `D1 Read` permitió obtener
el bookmark, pero la exportación devolvió código 10000. Se desactivó la variable
y Pablo actualizó el token. El ensayo manual #40576626163 (2026-10-27) pasó:
exportó la D1, restauró localmente, subió a R2 y descargó/verificó el respaldo
`production/20261027T201717Z` con SHA-256 e integridad correctos. La variable
volvió a `true`. Esta prueba acredita una ejecución; comprobar la primera
ejecución programada y las notificaciones de fallo sigue pendiente.

Pendientes operativos: comprobar la primera ejecución programada y alerta por
fallos, acordar RPO/RTO y documentar exportación y eliminación de grupos.
