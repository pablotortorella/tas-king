# Disaster Recovery — FUN TasKing!

Este runbook de TasKing hereda [Operación de HomeSuite](homesuite/OPERACION.md). Sus instrucciones de restauración son operaciones de impacto: confirmar destino, respaldo y autorización aplicable. La existencia de estos comandos no certifica un simulacro completo; verificar índices, triggers y archivos además de datos antes de declarar recuperación.

## Estrategia de backups

### Automáticos (Cloudflare Cron Trigger — cada 8 horas)
El Worker corre un handler `scheduled` que:
1. Genera un dump SQL completo de la DB de producción desde el binding D1
2. Lo sube a **R2** como `backups/2026-06-26T03-00-00Z.sql` (retención: 30 días)
3. Lo pushea a un **repo privado de GitHub** via PAT de mínimos permisos

Cron configurado en `wrangler.jsonc` → env production → `"0 */8 * * *"`.
Logs visibles en Cloudflare Dashboard → Workers → tas-king → Logs.

### Manuales (antes de deploys o cambios riesgosos)
```bash
npm run db:backup:prod
# Guarda en ~/dev/tas-king-backups/prod-YYYYMMDD-HHMMSS.sql (fuera del repo
# y de Dropbox; carpeta con permisos 700). Otro destino: BACKUP_DIR=<ruta> npm run db:backup:prod
```

No guardar estos dumps en carpetas sincronizadas (Dropbox, Drive, etc.): contienen datos
reales de usuarios y la sincronización los replica en la nube y en cada equipo enlazado.
La copia fuera del equipo hoy es R2 (cada 8 h); el repo privado de GitHub es opcional y todavía no está configurado (ver backlog).

---

## Setup inicial (una sola vez)

### 1. Crear repo privado de GitHub para backups
En GitHub: New repository → `tas-king-backups` → Private → sin README.

### 2. Crear Personal Access Token con permisos mínimos
En GitHub → Settings → Developer settings → Fine-grained tokens:
- Repository access: solo `tas-king-backups`
- Permissions: Contents → Read and write

### 3. Cargar secrets en Cloudflare
```bash
npx wrangler secret put GITHUB_BACKUP_TOKEN --env production
# Pegá el token cuando lo pida

npx wrangler secret put GITHUB_BACKUP_REPO --env production
# Valor: pablotortorella/tas-king-backups
```

### 4. Verificar que el backup funcione
Desde Cloudflare Dashboard → Workers → tas-king → Triggers → Cron, podés disparar el cron manualmente para verificar.

---

## Restauración

### Escenario A: Corrupción de datos (DB en mal estado)

**¿Cuál backup usar?**
- Los backups automáticos están en R2 (`backups/`) y en el repo `tas-king-backups`
- Usar el backup más reciente **anterior** al momento del problema

**Bajar backup de R2:**
```bash
npx wrangler r2 object get tas-king-uploads backups/2026-06-26T03-00-00Z.sql \
  --file restore.sql
```

**Bajar backup de GitHub (si R2 no está disponible):**
```bash
# En el repo tas-king-backups, descargar el archivo deseado
# o clonar el repo y copiar el archivo
```

**Restaurar:**
```bash
# Probar primero en local:
npm run db:restore -- restore.sql local

# Luego en staging para validar:
npm run db:restore -- restore.sql staging

# Recién después en producción (triple confirmación):
npm run db:restore -- restore.sql prod
```

---

### Escenario B: Deploy roto (código que rompe la app)

Cloudflare guarda las versiones anteriores del Worker.

```bash
# Ver versiones disponibles
npx wrangler deployments list

# Hacer rollback a la versión anterior
npx wrangler rollback
# o a una versión específica:
npx wrangler rollback <deployment-id>
```

El rollback de código **no revierte** cambios de DB. Si hubo una migración problemática, evaluar compatibilidad y pérdida de datos antes de decidir restaurar. No restaurar automáticamente por revertir código.

---

### Escenario C: Pérdida de acceso a Cloudflare

Si la cuenta de Cloudflare está comprometida o inaccesible:

1. Los backups en GitHub (`tas-king-backups`) son independientes de Cloudflare
2. Crear nueva cuenta Cloudflare / recuperar acceso
3. Recrear los recursos:
   ```bash
   npx wrangler d1 create tas-king
   npx wrangler r2 bucket create tas-king-uploads
   # Actualizar database_id en wrangler.jsonc
   npm run db:migrate:remote
   npm run db:restore -- <backup-de-github>.sql prod
   npm run deploy
   ```
4. Recargar los secrets (ver README sección "Secrets"):
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put ADMIN_EMAILS
   npx wrangler secret put GITHUB_BACKUP_TOKEN
   npx wrangler secret put GITHUB_BACKUP_REPO
   ```

---

### Escenario D: Pérdida de secrets

Si los secrets de Cloudflare (Google OAuth, SESSION_SECRET) se pierden o comprometen:

1. **Google OAuth**: ir a Google Cloud Console → regenerar Client Secret → `wrangler secret put GOOGLE_CLIENT_SECRET`
2. **SESSION_SECRET**: generar nuevo valor aleatorio → `wrangler secret put SESSION_SECRET` → todas las sesiones existentes se invalidan (usuarios deben hacer login de nuevo)
3. **GITHUB_BACKUP_TOKEN**: revocar PAT en GitHub → crear nuevo → `wrangler secret put GITHUB_BACKUP_TOKEN`

---

## Preparación de un despliegue

La secuencia común y su aprobación se mantienen en [Operación](homesuite/OPERACION.md).
Los comandos de publicación y respaldo de TasKing están en [Deployment](DEPLOYMENT.md).
No interpretar tamaño razonable del archivo como prueba de restaurabilidad.

## Límite conocido del script de restauración local

Inspección 2026-10-24: `scripts/db-restore.sh` elimina `.wrangler/state` al usar
`local`. Puede destruir también estado emulado ajeno a la base que se quiere
ensayar. No usarlo sobre el entorno de desarrollo como prueba rutinaria de
restauración. Preparar un entorno aislado descartable e inspeccionar el dump y el
script; la corrección del aislamiento queda registrada en el backlog.

## Objetivos históricos de recuperación — sin simulacro completo acreditado

| Métrica | Valor | Notas |
|---|---|---|
| RPO objetivo (pérdida tolerable) | 8 horas | Derivado del cron; requiere confirmar ejecución exitosa y recuperación |
| RTO estimado, no medido | 15-30 min | Estimación histórica; validar con simulacro completo |
| Retención de backups | 30 días | En R2 (limpieza automática) + histórico en GitHub |

Para reducir el RPO: cambiar el cron en `wrangler.jsonc` a `"0 */4 * * *"` (cada 4 horas).
