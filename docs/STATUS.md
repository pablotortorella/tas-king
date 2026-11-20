# Estado de HomeSuite — publicaciones y verificaciones

Este archivo registra **sólo publicaciones y verificaciones**
([qué va en STATUS](homesuite/METODO.md#qué-va-en-status)). El estado de los PRs se
mira en GitHub. Lo que está en `main` sin publicar no se anota: se calcula con el
SHA publicado de cada unidad. Los pendientes viven en el
[backlog](PRODUCT_BACKLOG.md#-verificaciones-manuales-pendientes-de-changes-archivados)
y en las tareas de cada change de OpenSpec. El registro anterior al 2026-11-17 está
en el [historial](STATUS_HISTORIAL.md).

## Publicado hoy

App y sitio comprobados el 2026-11-19, y el puente el 2026-11-17, con
`npx wrangler deployments list` (con el `--config` y el `--env` de cada unidad) y git. Al publicar, actualizar la fila de la unidad y
agregar la entrada al registro de abajo.

| Unidad | Entorno | Versión | Publicada (UTC) | SHA de `main` | Verificación |
|---|---|---|---|---|---|
| HomeSuite App (`app.homesuite.info`) | Producción | `5752e5a5` | 2026-11-19 23:36 | `36c2768` | Puerta legal encendida. Coherencia 30/30; `/healthz` 200; aviso de acceso servido. Pablo entró con Google y aceptó el 2026-11-20. |
| HomeSuite App (`staging.homesuite.info`) | Staging | `5bb8cbfa` | 2026-11-19 23:27 | `78e15d0` | Migración `0014`. Coherencia 29/29; aviso de acceso servido. Sin ingreso real con Google. |
| Sitio (`homesuite.info`) | Producción | `c3a0322e` | 2026-11-19 23:28 | `78e15d0` | Textos legales del 2026-11-19 servidos, sin borradores. Coherencia 30/30. |
| Sitio | Staging | `dd7d03da` | 2026-11-19 23:27 | `78e15d0` | Textos legales del 2026-11-19 servidos. Coherencia 29/29. |
| Puente de TasKing (worker `tas-king`) | Producción | `06338b44` | 2026-11-10 23:28 | `74c614c` (inferido¹) | Sondas: 404 en URLs históricas, 200 con aviso, 302 a Google en tarjetas y adjuntos; coherencia 30/30. |
| Puente de TasKing | Staging | `5bd7074e` | 2026-11-10 23:28 | `74c614c` (inferido¹) | Coherencia 29/29. |

¹ Las versiones del puente se publicaron sin mensaje de versión. El SHA se deduce porque
#145 se mergeó como `74c614c` a las 23:20:15 UTC y las seis publicaciones de ese día son de
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

### 2026-11-20 — producción: verificación de la aceptación legal

Pablo confirmó que entró a producción con Google y que funcionaron la aceptación de
los términos y condiciones y la declaración de mayoría de edad. No informó el
navegador, el dispositivo ni si probó las dos cuentas. La prueba en un teléfono real
(tarea 8.2 de `politica-y-aceptacion`) sigue pendiente.

### 2026-11-19 — producción y staging: textos legales y aceptación

Publicación del change `politica-y-aceptacion`, con orden explícita de Pablo
(«Publiquemos todo. Con merge y todo»). Textos aprobados por Pablo el mismo día (#159).

- **Staging:** respaldo `staging/20261119T232723Z` (local), migración
  `0014_legal_acceptances`, app `5bb8cbfa` y sitio `dd7d03da`, ambos `78e15d0`.
  Coherencia 29/29.
- **Producción, en este orden:**
  1. respaldo `production/20261119T232812Z` en R2 y migración `0014_legal_acceptances`;
  2. sitio `c3a0322e` (`78e15d0`);
  3. app `a8039392` (`78e15d0`) con `LEGAL_GATE` apagada; coherencia 30/30;
  4. app `5752e5a5` (`36c2768`, #160) con la puerta encendida; coherencia 30/30.
- **Smoke con curl:**
  - los dos textos muestran «Última actualización: 19 de noviembre de 2026» y el
    correo `pablotortorella+homesuite@gmail.com`, sin borradores;
  - la portada de la app muestra el aviso «Al continuar aceptás…» con enlaces a
    `homesuite.info`;
  - `/healthz` responde 200 y `/aceptar` sin sesión redirige a `/`.
- **No verificado:** el ingreso real con Google, ni el paso de las dos cuentas de
  producción por `/aceptar`. Queda para Pablo (ver el [handoff](../AI_HANDOFF.md)).

### 2026-11-10 — producción y staging: TasKing en HomeSuite y PWA

App, sitio y puente de TasKing en producción y staging, con los SHA y versiones de
la tabla de arriba. Detalle del corte, del lote migrado y de las copias en el
[historial](STATUS_HISTORIAL.md#tasking-en-homesuite--publicado-en-producción--2026-11-10).
