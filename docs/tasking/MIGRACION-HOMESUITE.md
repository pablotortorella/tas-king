# Traslado de TasKing a HomeSuite

Implementación: change [migrar-tasking-homesuite](../../openspec/changes/migrar-tasking-homesuite/proposal.md).
Estado y evidencia: [verificación](VERIFICACION.md). Este runbook prepara el corte;
no acredita publicación ni sustituye la aprobación de producción de [Operación](../homesuite/OPERACION.md).
Responsable: Pablo. No requiere contactar, preparar ni aprobar a cada usuario.

## Contratos conservados

`/tareas` conserva tableros, columnas, tarjetas, etiquetas, comentarios, checklists,
objetivos, actividad, métricas, archivo e intercambio aditivo. `/api/tareas/*` es su
API; `/api/me` sigue siendo de plataforma. Los permisos owner/member son por tablero:
un grupo de Cuentas Claras no concede acceso. HomeSuite admite a cualquier cuenta;
TasKing crea un personal sólo si la identidad no tiene uno importado. El admin de
TasKing no es admin de finanzas ni de plataforma.

El vínculo conserva `user_id` y Google `sub`. Para recuperar una identidad pendiente
se usa la misma cuenta Google: Gmail o correo con autoridad Workspace validada en
el ID token. `email_verified` por sí solo no acredita correos externos. Un conflicto
falla sin dar datos y ofrece contactar a Pablitux. El camino normal crea la cuenta
HomeSuite y recupera los tableros automáticamente, aunque el alta sea posterior al
traslado. No se migra la cookie antigua ni se crean usuarios OAuth ficticios.

El perfil común prevalece al mostrar nombres y avatares; las autorías pendientes
conservan su presentación anterior. Se trasladan roles, avance del tip, paleta,
fechas y revisiones. Preferencias de `localStorage` del origen (tema, filtros,
pulso) no cruzan dominios: toman los valores predeterminados al entrar por primera
vez. El dock queda en backlog.

## Recursos explícitos

| Superficie | Staging | Producción |
|---|---|---|
| App | `homesuite-app-staging`, `staging.homesuite.info` | `homesuite-app`, `app.homesuite.info` |
| D1 destino | `homesuite-app-db-staging` | `homesuite-app-db` |
| R2 destino, binding `TASKING_BUCKET` | `homesuite-tasking-uploads-staging` | `homesuite-tasking-uploads` |
| Worker origen y D1 | `tas-king-staging` | `tas-king` |
| R2 origen | `tas-king-uploads-staging` | `tas-king-uploads` |
| Config app | `apps/app/wrangler.jsonc --env staging` | `apps/app/wrangler.jsonc --env production` |
| Config preparación origen | `wrangler.jsonc --env staging` | `wrangler.jsonc` **sin `--env production`** |
| Config aviso final | `wrangler.tasking-move.jsonc --env staging` | `wrangler.tasking-move.jsonc` |

Los buckets nuevos deben existir antes de desplegar la app. Sin dominio público,
regla de acceso anónimo, ni reutilización de `homesuite-app-backups`. El bucket viejo
contiene SQL de respaldos además de adjuntos: se copian **sólo** las claves referidas
en `attachments`, nunca un listado completo. El endpoint nuevo exige fila de
adjunto y membresía vigente. HTML y documentos activos se descargan con disposición
segura, `nosniff`, CSP sandbox y `private, no-store`.

## Preparación y aceptación en staging

1. Revisar SHA limpio, CI, cambios de configuración y versiones activas de app,
   sitio y origen. Staging es compartido; preservar la revisión que otra sesión
   esté probando. Respaldar D1 y los adjuntos de ambos extremos antes de migrar.
   No usar datos privados de producción. Registrar versiones y nombres de secretos,
   nunca sus valores.
2. Crear los buckets ausentes del ambiente y confirmar que el token del backup
   diario puede leer `TASKING_BUCKET` y escribir/verificar `homesuite-app-backups`.
   La comprobación del SQL solo ya no basta. Mantener los backups diarios con la
   frecuencia y retención del runbook HomeSuite; durante el corte conservar las
   copias finales SQL/R2 y manifiestos al menos 30 días, con acceso restringido,
   fuera de Dropbox. Objetivo de corte: RPO cero respecto del snapshot congelado.
   El tiempo sintético medido no es un RTO de producción; medir el lote de staging.
3. Aplicar `0013_tasking.sql` al destino mediante el script de migraciones del
   ambiente. Es aditiva: no reescribir migraciones ni resetear plataforma/finanzas.
   La fase inicial `pending` mantiene la API y aprovisionamiento cerrados.
4. Aplicar `0016_tasking_transition.sql` al origen, aún en `live`. Desplegar el
   código de preparación con `--var TASKING_TRANSITION_CONTROL:true` y
   `--var TASKING_DESTINATION:staging` (o `production` en el corte aprobado).
   Mantener los demás vars/secrets/bindings del origen. Confirmar en remoto que
   **todas** las rutas editables pasan por esa versión, incluidas aliases.
   No empezar el drenaje con versiones viejas todavía recibiendo tráfico.
5. Publicar el SHA revisado de app en staging. No activar el destino aún.
   Ensayar los pasos del corte y el aborto con datos del ambiente. Probar con dos
   cuentas Google reales: usuario existente, alta HomeSuite posterior, invitación,
   revocación, tablero/archivo ajenos, perfil, salida, favorito con `?card` y PWA
   instalada antes del traslado. Registrar resultado, versión y tiempo; las
   identidades locales y sesiones firmadas de test no sustituyen ese ensayo.

## Corte del ambiente aprobado

Todos los comandos de transferencia exigen ambiente explícito. Usar una carpeta
privada nueva, fuera del repo y de Dropbox; no imprimir su contenido. Ejemplo para
staging (en producción cambiar **ambiente**, recursos y aprobación aplicable):

```bash
export TASKING_TRANSFER_DIRECTORY=/ruta/privada/lote-nuevo
npm run tasking:transfer -- status staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- drain staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- freeze staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- extract staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- load staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- verify staging --directory "$TASKING_TRANSFER_DIRECTORY"
```

`drain` bloquea admisiones nuevas y espera leases de peticiones ya admitidas;
`freeze` sólo procede con cero leases y activa triggers persistentes de sólo lectura.
Un lease que quede tras un fallo detiene el corte: verificar la petición y su efecto,
no borrarlo ni expirar leases por reloj para avanzar. El cron también queda detenido.
Así no se pierde una subida ni un GET con efectos admitido antes del snapshot.

`extract` crea un manifiesto versionado de 14 tablas, cobertura de relaciones y
hashes de bytes. Rechaza identidades ambiguas, personales duplicados y referencias
inconsistentes. `load` guarda filas e indicadores de avance en lotes acotados;
se puede repetir **el mismo manifiesto**, incluso tras una interrupción. Una fila
sin journal sólo se adopta si es idéntica. Otro contenido o lote falla; no se borra
ni se corrige silenciosamente. La conciliación compara entidades completas,
revisiones, claves foráneas y cada archivo. `ready` sigue cerrado a usuarios.

Antes de activar: comprobar el snapshot/backup final, aviso final construido,
configuración sin D1/R2/ASSETS, destinos fijos y versiones/aliases inventariados.
El origen ya congelado muestra el aviso; sus APIs dan `410 tasking_migrated`.

```bash
npm run tasking:transfer -- activate staging --directory "$TASKING_TRANSFER_DIRECTORY"
npm run tasking:transfer -- mark-moved staging --directory "$TASKING_TRANSFER_DIRECTORY"
npx wrangler deploy --config wrangler.tasking-move.jsonc --env staging
npm run verify:coherence:staging
```

`activate` repite la conciliación y habilita HomeSuite como único escritor. Publicar
el puente al 100 %, sin reparto con la versión editable. Después, app primero y sitio
después cuando corresponda; el catálogo del sitio ya debe enlazar `/tareas`.
No publicar el catálogo antes de que el destino esté disponible. Registrar SHA,
versiones, lote/hash, duración y smoke real de entrar, editar, descargar y salir.

## Recuperación sin dos escritores

Antes de activar: `npm run tasking:transfer -- abort <ambiente> --directory <ruta>`
reabre el origen y deja el destino cerrado. La copia parcial permanece para
reanudar, sin activar ni borrar datos financieros. Si cambia el origen tras el
aborto, el manifiesto anterior ya no es válido: reconciliar/descartar explícitamente
**sólo el dominio de staging** con respaldo y destino confirmado antes de otro lote.
La herramienta rechaza mezclar lotes.

Después de activar: `abort` rechaza reabrir el origen, aunque no se haya observado
una escritura todavía. Mantenerlo cerrado; reparar el código/datos de Tareas en
HomeSuite conservando las escrituras nuevas. No volver a cargar el snapshot de
origen ni restaurar toda D1 sobre las finanzas actuales. Una recuperación de dominio
requiere comparar en un entorno aislado y revisar el delta antes de aplicarlo.
Si HomeSuite falla, el aviso sigue visible y permite reintentar/contactar a Pablitux;
no se reactiva la copia vieja.

El backup de HomeSuite exporta D1 y los bytes referidos por ese SQL; guarda
`tasking-files.json` con tamaños/MIME/SHA-256 y publica el manifiesto raíz al final.
Si falta un archivo, falla todo el backup. `db:verify-backup:homesuite-app` recupera
las piezas y ensaya integridad SQL más todos los archivos. Para un ensayo local:

```bash
npm run db:restore-drill:homesuite-app -- /ruta/privada/database.sql
node scripts/tasking/backup-assets.mjs restore staging /ruta/privada --local --state /tmp/estado-r2-aislado
```

La restauración R2 automatizada sólo admite destino local. Un restore remoto es una
operación distinta con destino/impacto revisados; no lo ejecutar por accidente con
el comando del ensayo. Mantener la frecuencia y los objetivos de recuperación de
[HomeSuite](../HOMESUITE_RECOVERY.md) y medir el restore con el volumen real.

## Matriz de cierre que debe acreditarse en remoto

| Entrada/recurso | Resultado requerido |
|---|---|
| Ambos `tas-king[-staging].pablotortorella.workers.dev` | Aviso correcto por ambiente; nunca 404 ni segunda app |
| Dominios personalizados, routes y aliases | Enumerarlos vía configuración remota; mover todos al puente |
| Despliegue y versiones | 100 % puente, `preview_urls:false`; confirmar que previews viejos no quedan editables |
| URL de versión vieja alcanzable | Deshabilitarla; el cerrojo D1 impide escritura, pero no certifica por sí solo privacidad de una versión vieja |
| Cron | Sin triggers en el puente; preparación comprueba fase antes de ejecutar |
| Secrets y bindings | Puente sin D1/R2/ASSETS/OAuth; eliminar secretos sobrantes tras aceptación, sólo por nombre confirmado |
| CI/publicación habitual | Guardia impide desplegar negocio si fase no es `live`; revisar workflows y permisos de deploy directo |
| Pestaña vieja | Polling/reintentos detenidos al recibir mantenimiento/mudanza; borrador conservado; ninguna confirmación falsa |
| Caché caliente, volver atrás | Respuestas nuevas `no-store`; assets retirados 410; revalidar CDN/aliases controlables y probar navegador |
| Descargas previas | Redirigen a autorización HomeSuite; un archivo ya descargado no se puede revocar |
| OAuth antiguo | Callback local limpia query y cookies `session`/`oauth_state`; no intercambia ni reenvía code/state |
| Logs y trazas | Sólo versión, ambiente, clase de ruta, método y estado. Logs de invocación/traces desactivados para no registrar callbacks completos |

La consulta remota inicial encontró los dos buckets originales y el de respaldos;
los buckets nuevos no existían. El staging de app estaba ocupado por PR #142
(SHA `9e4c4a4`, versión `1a2f3bfc`); se preservó. Esto es inventario parcial, **no**
acreditación de aliases, permisos ni del puente publicado. Completar esa matriz
antes de pedir aprobación de producción. Tras aceptar el corte, retirar la lista
global/solicitudes y configuración independiente sobrante; conservar el Worker de
aviso y los respaldos históricos, sin borrar infraestructura implícitamente.
