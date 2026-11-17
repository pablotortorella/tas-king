# Estado de HomeSuite — publicaciones y verificaciones

Este archivo registra **sólo publicaciones y verificaciones**
([qué va en STATUS](homesuite/METODO.md#qué-va-en-status)). El estado de los PRs se
mira en GitHub. Lo que está en `main` sin publicar no se anota: se calcula con el
SHA publicado de cada unidad. Los pendientes viven en el
[backlog](PRODUCT_BACKLOG.md#-verificaciones-manuales-pendientes-de-changes-archivados)
y en las tareas de cada change de OpenSpec. El registro anterior al 2026-11-17 está
en el [historial](STATUS_HISTORIAL.md).

## Publicado hoy

Comprobado el 2026-11-17 con `npx wrangler deployments list` (con el `--config` y
el `--env` de cada unidad) y git. Al publicar, actualizar la fila de la unidad y
agregar la entrada al registro de abajo.

| Unidad | Entorno | Versión | Publicada (UTC) | SHA de `main` | Verificación |
|---|---|---|---|---|---|
| HomeSuite App (`app.homesuite.info`) | Producción | `f1e79b44` | 2026-11-10 23:21 | `74c614c` (inferido¹) | Smoke de la PWA el 2026-11-11 (service worker, manifiesto, íconos, páginas sin conexión: 200). Pablo: «Sí, todo funciona», sin navegador ni dispositivo informados. |
| HomeSuite App (`staging.homesuite.info`) | Staging | `4be48cd6` | 2026-11-10 23:20 | `74c614c` (inferido¹) | Coherencia 29/29; dos cuentas Google confirmadas por Pablo. |
| Sitio (`homesuite.info`) | Producción | `d268396c` | 2026-11-10 23:24 | `74c614c` (inferido¹) | Coherencia 30/30. |
| Sitio | Staging | `203b9118` | 2026-11-10 23:20 | `74c614c` (inferido¹) | Coherencia 29/29. |
| Puente de TasKing (worker `tas-king`) | Producción | `06338b44` | 2026-11-10 23:28 | `74c614c` (inferido¹) | Sondas: 404 en URLs históricas, 200 con aviso, 302 a Google en tarjetas y adjuntos; coherencia 30/30. |
| Puente de TasKing | Staging | `5bd7074e` | 2026-11-10 23:28 | `74c614c` (inferido¹) | Coherencia 29/29. |

¹ Estas versiones se publicaron sin mensaje de versión. El SHA se deduce porque
#145 se mergeó como `74c614c` a las 23:20:15 UTC y las seis publicaciones son de
los ocho minutos siguientes. El historial dice que el SHA validado en staging fue
el candidato `b5383a4`, que tiene el mismo árbol.

Remanso, Jardín Zen, Cuentas Claras, Tareas y la PWA no tienen unidad propia:
viajan con la HomeSuite App.

**Qué hay en `main` sin publicar** (se calcula; no se anota):

```
git fetch origin
git diff --stat <SHA publicado> origin/main -- . ':!docs' ':!*.md' ':!openspec'
```

## Registro de publicaciones

Lo más nuevo arriba. Cada entrada lleva: fecha, entorno, unidad, SHA de `main`, ID
de versión, migraciones aplicadas, smoke y quién verificó qué. Una verificación
posterior (por ejemplo, una prueba en un dispositivo real) se agrega como entrada
propia, con su fecha.

### 2026-11-10 — producción y staging: TasKing en HomeSuite y PWA

App, sitio y puente de TasKing en producción y staging, con los SHA y versiones de
la tabla de arriba. Detalle del corte, del lote migrado y de las copias en el
[historial](STATUS_HISTORIAL.md#tasking-en-homesuite--publicado-en-producción--2026-11-10).
