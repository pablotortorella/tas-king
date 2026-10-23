# HomeSuite: backup y recuperación

**Estado:** staging comprobado; producción bloqueada

**Fecha:** 2026-10-20

## Capas de recuperación

1. D1 Time Travel ofrece el punto de recuperación inmediato mediante bookmark.
2. Antes de migrar staging se guarda un export SQL local con checksum.
3. Cada export se importa en una D1 local aislada antes de considerarlo válido.
4. Producción requerirá además una copia externa con retención definida.

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
- presencia de `users`, `spaces`, `memberships`, `invitations` y `sessions`.

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

## Pendiente antes de producción

- bucket o proveedor externo separado para backups;
- cifrado, acceso mínimo y retención automática;
- restore drill de la D1 productiva vacía antes de aceptar usuarios;
- RPO/RTO acordados y alertas por backup o cron fallidos;
- procedimiento de exportación y eliminación de espacios.
