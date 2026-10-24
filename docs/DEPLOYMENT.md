# Runbook de despliegue — TasKing

Hereda [Operación de HomeSuite](homesuite/OPERACION.md). Este runbook contiene sólo
recursos, comandos y límites de TasKing. Para app/sitio HomeSuite consultar
[su ficha](productos/PLATAFORMA.md) e [infraestructura](HOMESUITE_INFRASTRUCTURE.md).

## Destinos

| Entorno | URL | D1 | R2 |
|---|---|---|---|
| Local | `http://localhost:8787` | Emulada | Emulado |
| Staging | `https://tas-king-staging.pablotortorella.workers.dev` | `tas-king-staging` | `tas-king-uploads-staging` |
| Producción | `https://tas-king.pablotortorella.workers.dev` | `tas-king` | `tas-king-uploads` |

Confirmar bindings y ambientes en `wrangler.jsonc`; no recrear recursos porque un
comando falle. Staging es compartido; coordinar quién lo usa.

## Comandos actuales desde raíz

| Acción | Comando |
|---|---|
| Suite previa | `npm run test:all` |
| Identificar código | `git status -sb` y `git rev-parse HEAD` |
| Publicar staging | `npm run deploy:staging` |
| Respaldar producción | `npm run db:backup:prod` |
| Migrar staging | `npm run db:migrate:staging` |
| Migrar producción | `npm run db:migrate:remote` |
| Publicar producción, con aprobación aplicable | `npm run deploy` |

El script de staging encadena `verify-ready` → migración → Worker. Producción
encadena `verify-ready` → respaldo → migración → Worker. Las comprobaciones de
orden están en `test/deploy-scripts.test.js`; sólo sirve para migraciones
compatibles con el Worker anterior. El protocolo para cambios incompatibles vive
en operación común. La firma de aprobación y el SHA servido requieren revisión;
los scripts actuales no los garantizan automáticamente.

## Comprobación propia de TasKing

Antes de pedir revisión confirmar el SHA desplegado y que los assets contienen
el cambio. Registrar versión Cloudflare y evidencia. Smoke afectado: login real,
abrir tablero, crear/editar/mover tarjeta y revisar consola. Si hay cambios de
permisos o archivos, comprobar revocación y descarga con el rol correspondiente.
No pedir pruebas sobre una rama que aún no está en staging.

Al publicar cambios visibles actualizar `public/releases.html` y versión en
`package.json`, `package-lock.json` y pie de `public/index.html`; registrar operación
en STATUS. Fallos o regresiones siguen [recuperación](DISASTER_RECOVERY.md).

## Diagnóstico sin destruir datos

Ante un binding ausente revisar la configuración del entorno; ante migraciones
pendientes usar el comando del destino identificado. Para pruebas usar fixtures
sintéticos; no copiar producción a staging. No borrar una base ni `.wrangler`
para resolver un error genérico. Si falta autenticación remota, configurar el
secreto mediante un canal seguro del entorno o entregar el comando al operador;
no pedir tokens en el chat. El mecanismo no cambia la autorización de producción.
