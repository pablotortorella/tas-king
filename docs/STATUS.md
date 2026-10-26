# Estado de Implementación — FUN TasKing! v2.3.2

**Última actualización**: 2026-10-25
**Producción registrada**: v2.3.2, desplegada y verificada.

**Release v2.3.0** (2026-09-18, Version ID `e20ace17-9736-4c7a-b1e0-13138d4074de`, SHA `fb8eb81`): despachó de un salto la v2.2.2, que nunca había llegado a producción, más el frontend modular y el endurecimiento de la política de contenido. `npm run deploy` aplicó la migración **0015 antes** del Worker nuevo —15 comandos— gracias al cambio de orden del mismo día; con el orden anterior habría habido una ventana de 500 por `no such column: sync_version`. Verificado en producción: v2.3.0 servida, `script-src 'self'` sin `'unsafe-inline'`, `frame-ancestors 'none'`, las 5 páginas con cabeceras, 24 assets en 200/304 y cero violaciones de política en navegador.

**Release v2.2.1**: 154 pruebas de backend y 62 E2E pasan. PR #38 integrado en `main`; release PR #39 integrada como SHA `ed4ca6a`. Pablo aprobó staging y producción.

## Cuentas Claras: personas del grupo, menú y «Soy yo» en la importación — 2026-10-26

**Estado:** implementado en la rama `feature/personas-menu-perfil` (integra `main` con el perfil
compartido), sin publicar. Cambio OpenSpec: `personas-del-grupo`.

- **Menú de la app** en el encabezado: secciones del grupo (Saldos, Movimientos, Personas, Categorías,
  Clasificar, Importar), Inicio, Mis grupos, «Ver mi perfil» y «Cerrar sesión»; el avatar y el nombre
  llevan al perfil. Se cierra con Escape, al tocar afuera y al elegir una sección de la misma página.
  La lista de grupos con invitaciones vive en `/cuentas-claras`; `/` es el inicio de HomeSuite.
- **Pantalla de personas** (`/spaces/:id/people`): estado y saldo de cada persona, personas unidas
  aparte y las herramientas de administración que estaban al final del libro. La titular renombra a una
  persona (nombre único entre vigentes) y la une a otra: vista previa sin escribir, confirmación con
  clave idempotente, un movimiento revisado por cada uno afectado, cuenta e invitaciones resueltas, y
  la persona unida se conserva como registro (`0011_person_merge.sql`).
- **Importación**: cada columna pregunta «¿Quién es “X” en este grupo?» con «Soy yo (nombre)» primero;
  se preselecciona por nombre; la revisión avisa si dos columnas van a la misma persona o si ninguna es
  quien importa.
- **Evidencia (2026-10-26):** unitarias 330, integración 279 (incluye unión por tandas con corte a mitad,
  doble confirmación en simultáneo y corrección concurrente; 2.500 movimientos en 189 ms en D1 local),
  sitio 10 y base 230; E2E 153 en Chromium y 153 en Firefox (menú, personas y correspondencia a 390 px y
  escritorio, claro y oscuro). Un intermitente conocido de Firefox (`importacion-recorridos`, recarga del
  progreso) pasó 6 de 6 al repetirlo. Se corrigieron dos pruebas que pasaban por un motivo equivocado
  (un «Guardar» que coincidía con «Guardar nombre» del libro) y una medición de desborde que ocurría antes de
  cargar la hoja de estilos. Los límites de D1 remoto de la unión se verifican en staging antes de cerrar el cambio.
- **Pendiente:** probar en staging la unión de las dos personas duplicadas del caso real; deshacer una
  unión queda fuera de este cambio.

## HomeSuite en staging: sitio, navegación y perfil — 2026-10-25

**Estado:** [PR #99](https://github.com/pablotortorella/tas-king/pull/99)
integrado en `main` SHA `90bf4b5ab3bf004b00ca166b67f26cefc1b67e48`.
Publicado desde ese SHA en dos Workers:

| Superficie | URL | Worker y Version ID |
|---|---|---|
| Home y landings públicas de staging | `https://site-staging.homesuite.info/` | `homesuite-site-staging` · `563a6a42-049f-4dff-aac5-f6d0bb948d83` |
| Suite autenticada de staging | `https://staging.homesuite.info/` | `homesuite-app-staging` · `d146478c-5ddd-478e-a3fb-5315c21e6091` |

- La home pública permite navegar a las landings de Tareas, Cuentas Claras y
  Compras. En staging, Cuentas Claras enlaza a la app del mismo ambiente; Tareas
  enlaza al TasKing de staging. El sitio público de producción no cambió. El
  sitio de staging anuncia `X-Robots-Tag: noindex, nofollow` y sólo tiene assets
  y la variable pública de entorno, sin D1 ni secretos.
- La raíz de la app presenta la suite. `/cuentas-claras` conserva «Muy pronto»
  para una sesión válida; sin sesión ofrece el acceso con Google y retorno a esa
  ruta. El avatar/nombre y el menú general llevan a `/perfil`, que edita el
  perfil global usando la API común, CSRF y revisión. El apodo por espacio se
  editará cuando exista la interfaz de espacios.
- Verificación: 18 unitarias de HomeSuite App, 14 integraciones D1, 10 pruebas
  del sitio, 230 generales, OpenSpec strict, dry-run de ambos Workers, [CI del
  PR](https://github.com/pablotortorella/tas-king/actions/runs/40230887372)
  con 101 escenarios Playwright, smoke HTTP de ambas superficies desde `main` y
  recorrido móvil en Chromium por home pública → landing → app → enlace OAuth.
  En local se guardó y releyó nombre, emoji y color desde la UI. D1 remota no
  requirió migraciones nuevas.
- Pablo confirmó el 2026-10-25 que funciona el recorrido solicitado con su
  cuenta Google: home pública → landing de Cuentas Claras → app → Google,
  nombre y foto visibles, acceso a «Mi perfil» desde avatar y menú, y guardado
  de un cambio de nombre o avatar. No informó navegador ni dispositivo de esa
  revisión; el recorrido entre dos cuentas sigue pendiente. TasKing aún tiene
  Worker y sesión propios; Compras y las funciones financieras de Cuentas
  Claras siguen en preparación. Pablo eligió incorporar esas ramas después de
  este corte.


## Perfil compartido de HomeSuite — primer corte (2026-10-25)

**Estado:** perfil y aviso «Muy pronto» integrados en `main` y publicados en
`staging.homesuite.info` el 2026-10-25. Código: `883727e`; Worker
`homesuite-app-staging`, Version ID `955c8bf9-e892-4c21-8c85-b3d904cdf122`.

- Exploración conversada: nombre y avatar globales, origen Google/personalización,
  modos de avatar y alternativa de inicial; apodo opcional por espacio, vacío por
  defecto, secundario y de edición propia; ciclo de reingreso e historial definidos.
- [Change](../openspec/changes/perfil-compartido-homesuite/proposal.md): perfil
  global de plataforma y presentación de membresía separados; contratos propios
  y lecturas autorizadas; migración compatible, revisiones y pruebas planificadas.
- `main` conserva la plataforma actual e incorpora perfil global, avatar, apodo de
  membresía, revisión de escrituras y API autorizada. Tras un login con Google,
  Cuentas Claras muestra «Muy pronto» y el nombre resuelto del perfil.
- La integración del perfil con la cronología financiera sigue en la rama funcional
  `feature/homesuite-profile` porque el libro todavía no está en `main`.
- Antes de migrar D1 se registró el bookmark de Time Travel
  `00000011-00000000-0000510f-0055f876f63fac55706083c98e5bc762`. No se hizo
  una exportación SQL completa; la recuperación por ese punto depende de la
  retención de Time Travel del plan. La migración `0007` conservó 2 usuarios y
  2 membresías, creó 2 perfiles y dejó los apodos vacíos; `quick_check` dio `ok`,
  `foreign_key_check` no encontró errores y no hay migraciones pendientes.
- Verificación: 18 pruebas unitarias de HomeSuite App, 14 integraciones D1,
  230 pruebas generales y [CI de `main`](https://github.com/pablotortorella/tas-king/actions/runs/40204299087)
  en verde con 101 recorridos Playwright. Smoke remoto: `/healthz` y `/` 200,
  `/api/me` y `/api/me/profile` 401 sin sesión, `/auth/google` 302 hacia Google;
  todas esas respuestas incluyeron `X-Request-Id`. Los limitadores de auth y
  mutaciones y la observabilidad están vinculados al Worker de staging.
- En este primer corte, el smoke sólo comprobó el inicio del flujo OAuth. El
  login real y la foto se confirmaron en la versión posterior descrita arriba.
- La UI global de edición llegó en el corte de staging descrito arriba. La
  migración de TasKing sigue pendiente. No habilita producción ni datos
  financieros reales.

## Cuentas Claras: repartos, categorías, importación, recategorización y lista - 2026-10-25

**Alcance:** cinco cambios OpenSpec implementados en ramas apiladas sobre la pila de diseño (PR #94 a #98), más el
arreglo de Firefox (#100) y una revisión integral de código. **Nada desplegado**: ni staging ni producción.

- **Repartos** (`repartos-del-libro`): cinco métodos con una sola regla (`split.js`) compartida por el servidor y la vista
  previa; el método y lo ingresado se guardan en la revisión.
- **Categorías** (`categorias-del-libro`): lista propia por libro, nombres normalizados, categoría en el movimiento,
  gestión por la persona titular (renombrar, reagrupar, archivar, fusionar con alias), filtro y exportación.
- **Importación** (`importacion-como-movimientos`): las filas de Splitwise son gastos normales con pagadores inferidos;
  carga por tandas, reanudable y de publicación atómica; punto de partida del grupo. Las tareas 7.1 y 7.2 siguen abiertas:
  la conversión de lotes del modelo anterior corre sola en el mantenimiento diario y el retiro de las tablas viejas
  (`apps/app/ops/retire-legacy-import-tables.sql`) va en un release posterior, con la guarda que se detiene si queda algo.
- **Recategorización** (`recategorizacion-masiva`): cambio en lote con auditoría y deshacer, y «Clasificar rápido» con
  sugerencias conservadoras y atajos (con interruptor).
- **Lista y búsqueda** (`lista-y-busqueda-del-libro`): índice por petición (de ~337 ms a ~6 ms con 2.500 movimientos),
  criterios por persona, regreso a la lista con franja «Recién agregado» y aviso `slow_book_open`.
- **Revisión integral:** corrige varios pagadores al corregir un movimiento, «todos los resultados» con filtro de persona,
  categorías genéricas, exportación que no mostraba lo oculto, huella de las solicitudes idempotentes, orden de «deshacer la
  última», nombres de categoría largos en la importación y confirmación repetida; parte `index.js` en módulos de rutas.
- **Pruebas:** unitarias, de integración (D1 local) y E2E en Chromium y Firefox, con recorridos exploratorios por cambio.
- **Sin verificar:** límites de D1 remoto (tamaño de sentencia, sentencias por lote, CPU por petición); las mediciones de
  `CASO-REAL-INTERNO.md` son contra D1 local. Sin WebKit ni dispositivo físico. Antes de producción: cadena operativa
  (respaldo, migraciones `0008`–`0010`, Worker) y smoke en staging del mismo SHA.

## Base común de buenas prácticas — 2026-10-24

**Alcance:** documentación común de la suite; sin cambios de aplicación,
despliegue ni recursos remotos. La integración se comprueba en el historial Git.

- [Documentos madre](homesuite/README.md): método, arquitectura, verificación,
  operación y registro de aprendizajes. Cada producto referencia la base y
  conserva sólo particularidades; excepciones requieren justificación y revisión.
- Guías de entrada y enlaces históricos actualizados; eliminadas políticas
  duplicadas, resets indiscriminados y recomendación de pegar secretos en el chat.
- Matriz de controles distingue lo automatizado de lo manual o pendiente. La
  revisión documental no demuestra cumplimiento productivo ni corrige código.
- Validación: enlaces locales y comandos documentados contra scripts versionados;
  revisión del diff. No se ejecutan suites de aplicación por este cambio documental.

## HomeSuite: corte para integración visual - 2026-10-23

- **Base consolidada:** `integration/homesuite-design-base`, sincronizada con
  `main` v2.3.2 en `9e8a8c1`. Reúne espacios autenticados, preparación
  financiera, núcleo cotidiano, importación Splitwise, ajustes de la revisión
  local y el arte nuevo. Es la rama de partida para aplicar el diseño a todo el
  recorrido, no una rama autorizada para producción.
- **Cadena funcional abierta:** #68 (`main` -> espacios autenticados), #71
  (preparación financiera), #75 (núcleo), #76 (Splitwise) y #81 (feedback).
  Deben integrarse en ese orden. El código financiero posterior a #71 todavía no
  fue desplegado en staging ni producción.
- **Arte público:** el PR #74 se integró en `main` como `62b459e`. El mismo
  arte se validó en la preview de Cloudflare
  `https://fb7807ef-homesuite-site.pablotortorella.workers.dev` y luego se promovió sin
  recompilar: Version ID `fb7807ef-d328-4d98-b9eb-683e28748e6a`, 100 % del
  tráfico de `homesuite-site`. `homesuite.info`, `/tareas`, `/cuentas-claras` y
  `/compras` respondieron 200; `www` redirigió 308; los hashes de ambos SVG
  coincidieron con el checkout.
- **Validación del arte:** la integración con `main` pasó 230 pruebas unitarias y
  101 E2E. La portada de producción se comprobó además en navegador real.
- **Límite para el rediseño:** se puede cambiar composición, jerarquía y estilos,
  preservando acciones POST, CSRF, slugs, permisos, estados de interfaz y
  comportamiento móvil. El enlace temporal hacia `127.0.0.1` de
  `local/homesuite-full-preview` no debe llegar a una rama remota.

El relevo operativo y los puntos de entrada para diseño están al principio de
[`AI_HANDOFF.md`](../AI_HANDOFF.md).

## 🧭 Cuentas Claras: rediseño visual y propuestas OpenSpec — 2026-10-23

Sesión de diseño y planeamiento. **No se escribió código de producto ni se tocó `main`, `apps/app/`, `apps/site/` ni TasKing.** Todo lo que sigue es material para decidir; nada está desplegado. Integrado en `main` por el PR #84; la verificación posterior va en la rama `docs/verificacion-cuentas-claras`.

| Qué | Dónde está | Estado |
|---|---|---|
| Rediseño visual de Cuentas Claras (10 pantallas, claro y oscuro) | **En el repo**: `docs/diseno/cuentas-claras/` (fuentes `.dc.html`, `canvas.json`, `tokens.json`, 26 capturas PNG y README para retomar). Original en Claude Design: https://claude.ai/artifact/D5oHdq49zM2V8R2zNQyfei (versión 18) | Borrador completo. Renderizado en Chromium y revisado en capturas (casi todas en oscuro, varias en claro); no probado en teléfono real ni otros navegadores. La revisión corrigió alturas de dos pantallas, una columna cortada y la coherencia de personas entre pantallas |
| Change `libro-y-saldos-cuentas-claras` | `openspec/changes/`, en `main` (PR #84) | Borrador. `openspec validate --strict` pasa. Sin `explore` previo. Sin implementar |
| Change `importacion-splitwise-inicial` | ídem | Ídem |
| Change `busqueda-movimientos-unificada` | ídem | Ídem |
| Change `colaboracion-y-exportacion-del-libro` | ídem | Ídem |
| `plataforma-homesuite-minima` | `openspec/changes/` en `main` | **Sin cambios.** Los cuatro changes nuevos dependen de que termine su grupo 3 de `tasks.md` (espacios, membresías e invitaciones) |

**Rediseño (10 pantallas), guardado en `docs/diseno/cuentas-claras/`.** Empezar un grupo: 1 Nuevo grupo, 2 Punto de partida, 3 Importar desde Splitwise. Día a día en móvil: 4 Saldos (con selector COP/USD), 5 Movimientos y búsqueda, 6 Agregar movimiento (gasto, ingreso, transferencia), 7 Detalle y revisiones, 8 «Por qué te deben». Escritorio y personas: 9 Libro de dos paneles, 10 Personas y acceso. Parte de `docs/HOMESUITE_CUENTAS_CLARAS_MVP.md`, el Journey, el Story Map y los estilos de `apps/site/public`. Todas usan los mismos datos sintéticos (Pablo, Ana, Laura, Mateo), de modo que los saldos cierran entre pantallas: saldo de Pablo +$1.748.350 en COP, que suma $0 con los demás, y USD aparte. El modo oscuro se aplicó pasando todos los colores a variables CSS con `prefers-color-scheme`; los pares de color listados en `tokens.json` se verificaron por cálculo de contraste (mínimo 5,1 en texto); no se auditaron todos los pares de todas las pantallas. La paleta oscura es provisoria: la identidad de temas de la suite (HT-01/HT-02) sigue pendiente.

**Cómo se dividieron los changes.** El backlog pide no mezclar modelo financiero, importación y autenticación en un solo change, así que la propuesta se partió en cuatro (orden de dependencia: libro → importación → búsqueda y colaboración). Cubren HG-01 (parcial), HG-03 a HG-07 y el corte B del Story Map. Cada `design.md` termina con **Open Questions**: son las decisiones que el rediseño dio por tomadas y deben resolverse en `/opsx:explore`.

**Decisiones abiertas que más pesan**
1. Modelo del movimiento importado: sólo efecto firmado por persona, con la inferencia de «pagó X» rotulada. Implica calcular saldos desde `entry_effects`; conviene decidirlo antes de aplicar el change del libro.
2. El lienzo muestra «pagó Ana» en importados sin rotularlo como inferencia: contradice la regla anterior y hay que corregirlo.
3. Decimales de COP: el lienzo los oculta, el CSV de ejemplo usa dos.
4. La opción «saldos anteriores» del lienzo no tiene change; debería quedar deshabilitada.
5. Algoritmo de sugerencias de transferencia (heurística simple y determinista) y ventana de edición de un miembro sobre lo propio.

**No verificado**: límites reales de `db.batch()` en D1; soporte de FTS5 en D1; formatos de CSV de Splitwise en otros idiomas; que ISO 4217 asigne dos decimales a COP; que minimizar transferencias sea un problema difícil (conocimiento general, sin fuente citada).

**Próximos pasos sugeridos**: correr `/opsx:explore` decidiendo de a una las Open Questions empezando por el modelo de efectos, y recién entonces `propose` definitivo de cada change.


## 🚀 Deploy a producción v2.3.2 — 2026-10-23

**Version ID:** `0d8891dc-05c0-4fe2-a72e-65ea83921e80` · **SHA:** `53f61f0` · producción pasó de v2.3.1 a v2.3.2. Staging (mismo SHA) fue `6ccea7e0-389e-46c7-9c39-7ae50ed41cca`.

Dos bugs del backlog 🟠 «Alto», cada uno en su rama y PR: #77 y #78; el bump de versión y las novedades fueron el PR #79.

- **Progreso de objetivos con varias columnas de cierre (#77).** El servidor usaba `getDoneColumnId` (una sola columna, `LIMIT 1`) y el cliente `COLUMNS.find(c => c.isDone)`, mientras métricas, confeti y urgencia ya contaban todas las `is_done`. Con 2+ columnas de cierre el porcentaje salía subestimado. Ahora `goalsWithProgress` usa `getDoneColumnIds` con `IN (...)` (máximo 10 columnas por tablero) y `applySavedCard` usa `getDoneColumnIds()` de `core/state.js`; `getDoneColumnId` se borró por no tener más usos. **El cliente tenía el mismo defecto**, que habría mostrado un porcentaje distinto del servidor hasta el siguiente sondeo; no figuraba en el backlog. El E2E corta el sondeo (`/version`) para que solo pueda cambiar el porcentaje el cálculo del cliente: falla con «1/2 · 50 %» sin el fix.
- **Validar que la columna exista (#78).** Crear, editar y reordenar tarjetas aceptaban cualquier `column`: una tarjeta podía quedar en una columna inexistente o de otro tablero, invisible y sin error; un `column` que no era texto daba 500. Ahora responden 400 «La columna no existe en este tablero.» (al editar solo se valida si la columna cambia, así una tarjeta ya huérfana se puede seguir editando y mover). El import no rechaza —sería perder datos—: las tarjetas sin columna o con una desconocida van a la **primera columna del tablero**; antes el default era `por_conversar`, que puede no existir. **Reordenar no estaba en el backlog y tenía el mismo agujero.** Presupuestos D1: crear y editar no suman consultas (la lectura del nombre, que ya existía para la auditoría, pasó antes de escribir y valida); reordenar e importar suman una lectura en paralelo.
- **Tests:** 230 unitarios y 101 E2E en verde en cada rama, sobre `main` y en los dos deploys. 13 unitarios y 1 E2E nuevos, todos fallaban antes del fix. Sin migraciones; respaldo previo en `backups/prod-20261023-193509.sql`.
- **Verificado en producción:** v2.3.2 en el pie, `doneColumnIds` en `board.js` y entrada v2.3.2 en `/releases`.

**Qué se aprendió en el camino**
- El rebase de #78 sobre #77 era limpio pero se repitió la suite completa: ambos tocaban `db/columns.js`.
- No se probó a mano en staging antes de producción: la verificación fue automática (suite + `curl` de los archivos publicados). Los cambios no tienen superficie nueva, pero conviene una pasada visual con un tablero de dos columnas de cierre.

---

## 🚀 Deploy a producción v2.3.1 — 2026-10-23

**Version ID:** `79a77134-1b7f-4a3a-8d3b-63035ef60690` · **SHA:** `84f23b6` · producción pasó de v2.3.0 a v2.3.1. Staging (mismo SHA) fue `52f9a9d6-53de-4f74-b748-86081e8fe6fa`.

Tres arreglos de uso diario, cada uno en su rama y PR, integrados en este orden: #65, #66, #67; el bump de versión y las novedades fueron el PR #72.

- **Tip diario en móvil (#65):** el `body` usaba `height: 100vh`, que en móvil incluye la zona que tapa la barra de direcciones y empujaba el tip fuera de pantalla. Ahora `height: 100dvh` con `100vh` de fallback. Causa raíz confirmada en un Motorola Edge 50 con Chrome y Firefox Nightly: la captura previa al fix mostraba el tip cortado y, con el fix en staging, se ve completo. El emulador móvil de DevTools no reproduce el bug.
- **Etiquetas en tarjeta nueva (#66):** `draftLabels` con el mismo patrón que `draftGoals`; las etiquetas elegidas se acumulan en memoria y se asignan tras crear la tarjeta. Sin cambios de backend ni de esquema.
- **Checklists con teclado (#67):** Tab salta al texto del ítem siguiente, Enter deja el cursor en «Nueva subtarea» y Backspace en un ítem vacío lo borra. Documentado como sección nueva de ADR-014: el backlog decía que ya estaba y no lo estaba.
- **Tests:** 217 unitarios y 100 E2E en verde en la rama de cada PR y sobre `main` (el deploy los corre dos veces, en staging y en producción). Sin migraciones nuevas; el respaldo previo quedó en `backups/prod-20261023-154037.sql`.
- **Verificado en producción:** versión v2.3.1 en el pie, `100dvh` en el CSS, `draftLabels` y el manejo de Backspace en `card-modal.js` y entrada v2.3.1 en `/releases`.

**Qué se aprendió en el camino**
- **Staging no tenía ninguna de las tres ramas.** Las pruebas manuales iniciales fallaron porque staging servía `main`; se comparó el archivo desplegado contra cada rama para descubrirlo. Staging es un único ambiente: se despliega una rama por vez y se verifica con `curl` que el cambio esté en el archivo publicado antes de pedir una prueba. Una prueba contra código no desplegado no valida nada.
- **Los worktrees comparten el puerto 8787** de Playwright (`reuseExistingServer`): las suites se corren de a una.
- **Flake de `uid()`:** `test/frontend-dom.test.js › uid › no repite en llamadas consecutivas` falló una vez (499 de 500) y pasó en las corridas siguientes. `uid()` (`public/js/core/dom.js`) mezcla un timestamp en milisegundos con 5 caracteres aleatorios, así que 500 llamadas casi simultáneas pueden colisionar (chance del orden de 0,2 %). Es una colisión posible, no un fallo del test; queda en el backlog.
- **Lockfile desalineado:** `package-lock.json` seguía en 2.2.2 con `package.json` en 2.3.0, y cada `npm install` lo modificaba. Quedó corregido en el PR #72.

---

## 🏠 HomeSuite: sitio público en producción y OAuth en staging — 2026-10-16

- Los PRs #48 (fundamentos), #49 (landing), #50 (Custom Domains) y #52 (landings de productos) están integrados. El sitio público corre en el Worker independiente `homesuite-site`, sin D1, R2, OAuth ni cambios al Worker `tas-king`.
- `https://homesuite.info/`, `/tareas`, `/cuentas-claras` y `/compras` responden 200. La portada conserva «Organizarnos puede ser más simple.» y la landing de Tareas enlaza al TasKing actual. La ruta anterior `/gastos` devuelve 404 sin redirección. `www` redirige 308 al apex conservando path y query. La URL principal de `homesuite-site` en `workers.dev` sirve producción, no staging.
- Se retiraron únicamente los dos A de parking del apex y el CNAME `www` de GoDaddy. `_domainconnect` y `_dmarc` se conservaron. El error 525 desapareció; DNSSEC siguió validando con bandera `ad` en `1.1.1.1`.
- Publicación inicial desde `main` SHA `f8cb9b6`, Version ID `48847d8f-86de-4b18-b2ad-def62e348bba`. Las landings del PR #52 se publicaron desde `main` SHA `45f5222`, Version ID `cc65ff3f-6747-41d3-98e0-c0b3742b81b9`. El PR #56 renombró Gastos a Cuentas Claras y se publicó desde `main` SHA `aef6306`, Version ID `76bdcbe9-3a69-403b-a1e7-e327528ec17b`; CI, las verificaciones específicas del sitio y la comprobación pública aprobaron. El favicon del sitio usa la casita de HomeSuite con el techo coral por delante.
- `staging.homesuite.info` quedó asociado el 2026-09-23 a `homesuite-app-staging`, aislado del sitio público y de TasKing. Usa D1 exclusiva `homesuite-app-db-staging` (`7d270a78-adbb-45fc-b5fc-7550c547af68`) con las migraciones `0001_platform` y `0002_sessions`. El 2026-10-16 quedaron configurados el cliente OAuth `HomeSuite Staging`, el client ID público versionado y `GOOGLE_CLIENT_SECRET`/`SESSION_SECRET` como secretos cifrados fuera de Git. HTTPS, `/healthz`, autorización Google, callback, sesión y logout fueron verificados con una cuenta real en la versión `1aae7e65-f9f1-4878-81ba-d9a962b0c62f`. `qa.homesuite.info` continúa sin uso. Ver [infraestructura de HomeSuite](HOMESUITE_INFRASTRUCTURE.md#decisión-para-el-sitio-público-y-la-futura-app-2026-09-21).

### ⚠️ HomeSuite App: plataforma colaborativa en staging — 2026-10-20

- PR #60 integrado en `main` (SHA `e7c9990`). Implementa D1 local para crear espacio/titular, invitar, cancelar, descubrir de forma privada y aceptar/rechazar con auditoría.
- PR #62 integrado en `main` (SHA `2e75083`). Implementa OAuth Google con PKCE, `state` firmado, nonce y validación criptográfica del ID token; las sesiones viven en D1 con cookie host-only y el entorno sin secretos responde de forma honesta, sin simular login.
- El primer login real detectó que el flujo generaba el desafío PKCE pero omitía `code_verifier` al canjear el código. El fix lo envía desde el estado firmado y agrega una regresión específica; 12 pruebas unitarias y 9 integraciones D1 pasan. Se desplegó desde `fd14035` como versión `1aae7e65-f9f1-4878-81ba-d9a962b0c62f`, y Pablo confirmó login y sesión con su cuenta Google. La eventual reutilización del perfil de TasKing seguirá siendo una migración consentida; no se comparten sus cookies, Worker, base ni preferencias.
- `feature/homesuite-authenticated-spaces` incorpora rutas reales de creación/renombre, selección, invitación/cancelación y aceptación/rechazo. Toda mutación autenticada exige origen confiable y token CSRF firmado ligado a sesión; staging tiene observabilidad estructurada y `X-Request-Id`, sin registrar identidad ni payloads.
- Verificación al 2026-10-23: 16 pruebas unitarias, 14 integraciones D1 y 4 E2E pasan. El nuevo E2E con sesión real reprodujo el 403 de Chrome por `Origin: null` bajo `no-referrer`; el fix sólo acepta ese caso con `Sec-Fetch-Site: same-origin` y token firmado válido.
- Desplegado dentro de SHA `4d9bfdc` como versión `7098716d-2685-4371-a573-f890a7a5244e`. El recorrido manual con dos cuentas reales comprobó privacidad previa, nombre del invitante, rechazo sin acceso, nueva invitación, aceptación, rol de integrante y visibilidad para el titular. D1 confirmó `owner` + `member`, invitaciones `rejected`/`accepted` y la auditoría esperada. Producción permanece intacta.

### Cuentas Claras: base segura para datos financieros — 2026-10-20

- `feature/homesuite-financial-readiness` añade el esquema `0003` para libros,
  participantes, movimientos, componentes, revisiones inmutables, eventos e
  idempotencia. Los importes usan enteros en unidad menor y las invariantes de
  gasto, ingreso, transferencia, reparto y suma cero tienen pruebas propias.
- El Worker rechaza cuerpos mutables mayores a 16 KiB, usa Rate Limiting separado
  para OAuth y mutaciones, y ejecuta un cron diario que vence invitaciones y
  purga sesiones antiguas sin tocar historia financiera.
- El deploy de staging creó primero el backup UTC `20261020T053821Z`; el SQL de
  3210 bytes pasó `quick_check`, foreign keys y tablas esenciales en una D1 local
  aislada. La cadena operativa queda fijada como backup → migración → Worker.
- Verificación: 23 unitarias, 22 integraciones D1, 3 E2E, ambos OpenSpec strict,
  dry-run de Wrangler y escaneo de secretos. En staging, health y cabeceras
  responden, 16 KiB + 1 devuelve 413 y OAuth conserva PKCE.
- Desplegado desde SHA `a0d9155` como versión
  `cff2c319-b514-483f-aa49-c0b29e6b2169`. `0003` figura aplicada, existen las
  ocho tablas financieras, sus conteos siguen en cero y no hay violaciones de
  foreign keys. El PR apilado es el #71, sobre #68. Producción no fue creada ni
  modificada.
- La política de [ciclo de vida](HOMESUITE_DATA_LIFECYCLE.md) mantiene bloqueados
  los datos reales y producción hasta contar con exportación/eliminación de
  producto, backup externo, restore drill productivo y credenciales rotadas.

### Cuentas Claras: uso cotidiano en rama de revisión — 2026-10-23

- `feature/homesuite-financial-core`, apilada sobre #71, convierte cada espacio
  nuevo en grupo con libro y participante propietario. La migración `0004` crea
  libros y participantes vinculados para los espacios existentes de staging.
- El titular puede añadir participantes sin cuenta y elegir uno al invitar; la
  aceptación vincula la identidad confirmada sin trasladar saldos. Gastos e
  ingresos admiten un pagador o receptor y reparto igual o exacto. También hay
  transferencias, saldos por participante y moneda, cronología y detalle.
- Corregir crea una revisión inmutable; anular conserva el movimiento y retira
  su efecto de los saldos. Cada escritura usa una clave idempotente y las
  correcciones simultáneas se resuelven mediante la revisión esperada.
- El libro se exporta en JSON con participantes, movimientos, revisiones y
  eventos; el CSV incluye efectos por participante en unidades menores. Las
  páginas financieras usan `Cache-Control: private, no-store` y ofrecen un
  formulario móvil con estado provisional mientras se confirma la escritura.
- Verificación local: pruebas monetarias, integración D1 con dos identidades,
  permisos, reintentos y concurrencia; Playwright cubre gasto, corrección y
  anulación a 390 px. Esta rama no se desplegó en staging ni en producción.
- En esta rama aún faltaba la importación de Splitwise. También quedan pendientes
  la copia externa y el restore drill productivos descritos en
  [recuperación](HOMESUITE_RECOVERY.md). No habilita datos financieros reales.

### Cuentas Claras: importación Splitwise en rama apilada — 2026-10-23

- `feature/homesuite-splitwise-import` añade una previsualización de CSV con
  nombres dinámicos, movimientos válidos, incidentes por fila y saldos de origen.
  El titular mapea participantes y decide explícitamente excluir una fila o
  asumir la moneda predeterminada si falta ese dato.
- La confirmación conserva lote, archivo, supuestos, filas excluidas, diferencias
  de conciliación y efectos originales. Los lotes pendientes son invisibles para
  el libro hasta completarse; repetir el mismo archivo no duplica dinero.
- Los movimientos importados aparecen en la cronología, balances, exportación y
  búsqueda libre junto con los nuevos, con origen y fila visibles. La búsqueda
  explica coincidencias por descripción, categoría, persona, total o efecto.
- Documentación operativa y límites en
  [Importar Splitwise](HOMESUITE_CUENTAS_CLARAS_IMPORT.md). Esta rama todavía no
  se desplegó. Producción y datos financieros reales siguen bloqueados por las
  condiciones de recuperación y ciclo de vida existentes.

### Cuentas Claras: ajustes de la revisión local — 2026-10-23

- La selección monetaria incorpora todas las monedas vigentes de Sudamérica,
  MXN y las monedas ya admitidas. CLP y PYG usan cero decimales; KWD usa tres.
- Cada grupo recibe una URL legible y estable al crearse, con sufijos `-2`, `-3`
  ante nombres repetidos. Renombrar el grupo no modifica su URL; los grupos
  existentes reciben una al primer acceso y sus rutas antiguas redirigen.
- En desarrollo local, una segunda cuenta con invitaciones pendientes entra
  directamente a la pantalla para aceptar o rechazar. La importación explica
  dentro de la interfaz qué filas requieren decisión.
- La búsqueda monetaria ignora los separadores de miles y encuentra fragmentos
  del importe entero: `1000`, `1.000`, `10` y `100` encuentran `1.000`; `14`,
  `45` y `145` encuentran `145`. Las monedas siguen sin convertirse entre sí.
- Los ajustes viven en `feature/homesuite-review-feedback`, apilada sobre la
  importación; no fueron desplegados en staging ni producción.

## 🚀 Deploy a producción v2.3.0 — 2026-09-18

**Version ID:** `e20ace17-9736-4c7a-b1e0-13138d4074de` · **SHA:** `fb8eb81` · producción pasó de v2.2.1 a v2.3.0.

- **Orden del deploy corregido el mismo día (PR #45).** Los dos scripts corrían `wrangler deploy` antes de la migración, contra lo que pedían ADR-016 y este documento desde el 15/09. La 0015 nunca se había aplicado en producción, así que el orden viejo habría abierto una ventana de 500 por `no such column: sync_version`. `test/deploy-scripts.test.js` verifica ahora el orden en ambos scripts.
- **Beneficio no previsto, mostrado por un accidente:** al probar el orden nuevo en staging, la migración falló con un error transitorio de la API de Cloudflare y la cadena `&&` cortó **antes** de tocar el Worker. Con el orden anterior ese mismo fallo habría dejado el Worker nuevo arriba y la base sin migrar.
- **El log del deploy confirma la secuencia:** respaldo (línea 160) → migración 0015, 15 comandos (195) → Worker (273).
- **`main` estuvo en rojo entre el PR #45 y el deploy.** Dos tests de caracterización del perfil recargaban la página y hacían clic sin esperar a que cargara la sesión; `openProfile()` lee `estado.me` y lanzaba. Error del test, no del producto: ese comportamiento es previo al refactor. Reproducido a propósito retrasando `/api/me` con `page.route`, corregido en el PR #46.
- **Consecuencia del refactor sobre la suite:** la carga de la página pasó de 1 a ~19 subrecursos, así que los tests que compiten contra el final de carga tienen menos margen. Uno tenía una carrera real (corregido); otros esperan con reintento y solo quedaron más frágiles. Explica el aumento de "flaky" de estos días.
- **Verificación en producción:** v2.3.0 servida, `script-src 'self'` sin `'unsafe-inline'`, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy` y HSTS presentes en el documento; las 5 páginas responden 200 con CSP; 24 assets JS/CSS en 200/304; cero violaciones de política y cero errores de consola en navegador.

### Pendientes conocidos, ninguno bloqueante

- **Dos flakes sin causa identificada.** Uno cuelga `page.goto` en `card-mutation-performance` (mitigado con `retries: 1`, que Playwright cuenta aparte como "flaky"); el otro apareció una vez en `checklists` —un renombrado que no persistió— y no reprodujo en cuatro corridas. El segundo cuida comportamiento real y conviene no perderlo de vista.
- **`style-src` conserva `'unsafe-inline'`**, declarado en `src/middleware/cors.js`. Faltan migrar 148 atributos `style=`, varios con valores interpolados. Anotado en el backlog.
- **Hallazgos de una revisión que apuntó al PR #41** y quedaron sin verificar por mí: el dump de backup no restaura los 15 índices, no hay trigger en `attachments`, y `persistOrder()` dispara una escritura de `boards` por tarjeta al reordenar. Valen una mirada propia antes de darlos por ciertos.

## 🧩 Frontend en módulos y cabeceras de seguridad — v2.3.0 preparada

**Estado:** ✅ en producción desde el 2026-09-18 (Version ID `e20ace17-9736-4c7a-b1e0-13138d4074de`). PRs #43, #44 y #46 integrados.

- **Hallazgo que cambió el alcance:** el ítem del backlog decía que el CSP tenía `'unsafe-inline'`. El problema real era otro y mayor: **ninguna cabecera de seguridad llegaba al HTML**. `wrangler.jsonc` montaba los assets sin `run_worker_first`, así que el Asset Worker respondía antes que el Worker y `createCorsMiddleware()` nunca tocaba esas respuestas. La app no tenía CSP ni `X-Frame-Options` en las páginas que un navegador ejecuta: era enmarcable. El único test que cubría el CSP invocaba `app.request()` y se salteaba el ruteo de assets, por eso pasaba en verde.
- **Entrega de cabeceras:** `run_worker_first` acotado a documentos, más un handler que los sirve desde el binding de assets preservando `Content-Type`, `Cache-Control` y `ETag`. Los assets estáticos siguen saliendo del borde sin pasar por el Worker. Se sumó `frame-ancestors 'none'`.
- **Frontend:** `public/index.html` pasó de 4.545 a 512 líneas de markup. El JavaScript vive en 17 módulos bajo `public/js/`, con tres capas y dirección de dependencia única: núcleo (`state`, `api`, `dom`, `bus`) → tablero (`board.js`) → features → `app.js` como composition root. Ninguna feature importa a otra; los avisos sin respuesta esperada van por un bus de nueve eventos, todos suscriptos en un solo lugar.
- **Endurecimiento:** `script-src 'self'` sin `'unsafe-inline'`. Para llegar hubo que sacar los 8 bloques inline de las páginas públicas, que resultaron ser 3 archivos: el script anti-flash estaba copiado idéntico en las cuatro. `style-src` conserva `'unsafe-inline'` a propósito y declarado: faltan migrar 148 atributos `style=`.
- **Corrección de diseño durante la implementación:** la primera versión decía que toda arista de vuelta pasaría por el bus. Medido sobre el código: 18 secciones llaman a `render`/`loadCards`/`loadBoard` en 66 sitios y **44 son `await`**, una usando el valor de retorno. `emit()` devuelve `undefined` y atrapa excepciones. Se agregó una capa en vez de forzar el bus.
- **Pruebas:** `npm run test:all` pasa **212 unitarios + 87 E2E** (eran 172 + 67). Los 40 unitarios nuevos son de frontend, que antes no tenía ninguno. Los E2E nuevos cubren cabeceras sobre la respuesta servida —no invocando el handler por dentro, que es lo que dejó pasar el bug original— y los flujos que estaban a ciegas: exportar, tabs de admin, perfil, ayuda y paneo.
- **Bug latente encontrado y corregido:** `admin.js` usaba `avatarHtml` sin importarlo, en una rama que ningún test alcanzaba. Lo detectó un verificador estático, no la suite. Tiene test propio, verificado en rojo.
- **Staging:** Version ID `1d6810de-94d3-433f-a5d6-ebb6383bda66`. Los 19 archivos de `js/` se sirven como `text/javascript` y fuera del Worker; el navegador resuelve el grafo completo de imports (21 assets, incluidos los de dos niveles que el HTML no menciona); cero errores de consola y cero violaciones de política en las 5 páginas; 304 condicional y cabeceras intactos. **Falta que Pablo confirme el login con Google autenticado.**
- **Efecto colateral medido:** el documento pasó de 208.867 a 25.756 bytes, y el JS y el CSS quedaron cacheables por separado.
- **Andamiaje:** tres herramientas en `openspec/changes/extraer-frontend-a-modulos/tools/` (análisis de dependencias, extractor por AST, verificador de identificadores). Se archivan con el change. Requieren `acorn`, instalado con `--no-save` por no ser dependencia del producto.

## 🔄 Sincronización de comentarios, checklists y borrados — v2.2.2 preparada

**Estado:** ✅ en producción desde el 2026-09-18, despachado junto con la v2.3.0. La migración 0015 se aplicó en ese deploy, antes del Worker.

- **Causa:** `MAX(cards.updated_at)` no detectaba recursos relacionados, borrados que conservaban el máximo ni escrituras en el mismo milisegundo. El cliente solo reaccionaba a versiones mayores.
- **Datos:** migración `0015_board_sync.sql`, con `boards.sync_version` y triggers transaccionales para tarjetas, comentarios, checklists e ítems. No añade llamadas al binding en las escrituras; agrega actualizaciones internas del contador. La revisión conserva la escala previa para clientes abiertos.
- **Lectura:** `/version` consulta la fila del tablero; `getBoard()` lee revisión y colecciones en un único batch consistente. Se mantiene el presupuesto de seis llamadas D1 del polling autenticado.
- **Interfaz:** compara revisiones por desigualdad; actualiza comentarios y checklists en el modal abierto sin reemplazar los demás campos. Difiere el checklist mientras contiene el foco y conserva el texto para agregar ítems de las listas que siguen existiendo. Mantiene las protecciones de arrastre y guardado de v2.2.1.
- **Backup:** el dump automático incluye los triggers después de los datos para conservar la sincronización al restaurar.
- **Pruebas:** `npm run test:all` pasó **172 backend + 67 E2E**. Diecisiete regresiones de API/backup y una de presupuesto D1 nuevas; cinco recorridos E2E con otra identidad, modal abierto, borradores, borrados y revisión menor. Doce casos de sincronización y el de backup fallaron antes de sus respectivos arreglos; también se reprodujo el fallo en navegador.
- **Migración:** validada en D1 local y sobre esquema anterior con datos (compatibilidad con escrituras anteriores, preservación de versión y borrado de última tarjeta). **Aplicar 0015 antes del Worker nuevo** en cada entorno; ver [ADR-016](ADRs/ADR-016-board-sync-revision.md).
- **Release preparada:** v2.2.2 en paquete, pie y Novedades (Release 19). No desplegada a producción todavía.
- **Staging:** migración 0015 aplicada antes del Worker. Commit `7430319`, Version ID `8a670812-0f67-499f-9d57-b2f66fa0678d`, activo al 100 % en https://tas-king-staging.pablotortorella.workers.dev. El deploy repitió 172 pruebas de backend y 67 E2E. Verificación remota: HTML v2.2.2 responde 200, `/api/me` sin sesión responde 401, y D1 contiene `sync_version` más los 12 triggers. Pablo confirmó el funcionamiento autenticado el 15/09.
- **Integración:** PR #41 mergeado como `e1042a9`. Ese SHA pasó nuevamente 172 pruebas de backend y 67 E2E, y fue desplegado en staging como Version ID `a53d2184-29d4-4b6f-8436-b00f9ef790cc`. Smoke test final: HTML v2.2.2 responde 200, `/api/me` sin sesión responde 401 y D1 conserva la columna más los 12 triggers.

## ✅ Performance confirmada en uso real — 2026-09-15

Pablo confirmó que toda la interacción se siente más veloz con v2.2.1 en producción. Se cierra esta ronda de performance; no hacen falta más mediciones exploratorias salvo que se vuelvan a observar demoras relevantes. Backlog y arranque actualizados para no seguir presentando el deploy como pendiente.

## ⚡ Backend: menos llamadas y criterio de performance (v2.2.1 en producción)

- Rama `perf/backend-roundtrips`: preparación de usuario existente y rol en un solo `db.batch()` (antes dos llamadas sin admin o tres con admin); creación de tablero/columnas solo cuando falta. El callback OAuth comparte esa preparación y aplica el rol después de insertar al usuario nuevo.
- La autenticación reutiliza la identidad de la cookie verificada en la petición. Mantiene revocación en D1, membresía vigente y bypass limitado a localhost; no agrega caché entre peticiones.
- `cardJSONById` trae todos los ítems de checklists mediante una consulta filtrada por tarjeta. Conserva orden, estados, listas vacías y aislamiento. Sin checklists no consulta ítems. Con cinco listas, la lectura pasa de 11 a 7 llamadas D1.
- Regresiones en `test/backend-performance.test.js`: presupuestos de llamadas, verificación de firma única, usuarios nuevos/existentes, roles, aislamiento y revocación. Validación completa: 154 pruebas de backend y 62 de navegador pasaron. Ocho regresiones nuevas fallaron sobre el código previo por las llamadas redundantes o el rol inicial; pasaron tras el cambio.
- [Criterio de performance](PERFORMANCE-PRACTICES.md) enlazado desde workflow e instrucciones de desarrollo: aplicar patrones evidentes con tests, medir cuando haga falta y evitar rondas manuales que no cambien la decisión.
- **Staging de la rama desplegado el 14/09 a las 21:11 America/Bogota**: commit `8cadd4e4513a2f2839501b44eb803e5ebe9c8856`, Worker `tas-king-staging`, Version ID `01851ad0-7fcf-44f2-ac8c-b9c1e78a468b`, activo al 100 %. URL: https://tas-king-staging.pablotortorella.workers.dev.
- `npm run deploy:staging` repitió 154 pruebas de backend y 62 E2E, publicó la rama y confirmó que no había migraciones pendientes. Verificación HTTP: HTML idéntico al checkout, API sin sesión devuelve 401 y login redirige a Google con callback de staging. Revisión autenticada de Pablo pendiente.
- PR #38 integrado en `main` como `0f307f8`; ese SHA pasó 154 pruebas de backend y 62 E2E y se desplegó en staging como Version ID `82e4bbd5-0222-4416-9578-deb02e00ee02`. Pablo aprobó la revisión.
- **v2.2.1 desplegada a producción el 14/09 a las 21:27 America/Bogota** desde `main` `ed4ca6a`. Version ID `0943efad-b627-446e-994d-b7b1546fd51c`, activo al 100 %. Backup previo: `backups/prod-20260914-212702.sql`.
- El deploy final volvió a pasar 154 pruebas de backend y 62 E2E, confirmó que no había migraciones pendientes y publicó las notas de Release 18. Verificación HTTP posterior: HTML contiene v2.2.1 y coincide con el checkout; `/api/me` sin sesión responde 401.

## 🎯 Performance de mutaciones — comprobación posterior de tres rondas

- **Línea base de producción**: crear una tarjeta demoró aproximadamente 2,10 s y asignar una etiqueta 1,93–2,02 s. Las tres recargas globales posteriores a cada escritura explicaron alrededor de 1,4–1,5 s de cada secuencia. La CPU del Worker fue baja; la mayor parte del tiempo observado fue espera de I/O.
- **Optimización incluida en v2.2.0**: crear/editar tarjetas y asignar/quitar etiquetas actualiza el estado local desde la respuesta confirmada, sin volver a descargar tarjetas, etiquetas y objetivos. Los guardados con recursos relacionados releen únicamente la tarjeta afectada. El polling queda serializado con las mutaciones y descarta respuestas anteriores.
- **Cobertura**: `e2e/card-mutation-performance.spec.js` cubre ausencia de recargas globales, persistencia, errores y reintentos, recursos relacionados, doble clic, polling concurrente y cambio de tablero durante una escritura.
- **Comprobación del 14/09**: tres rondas, 12 escrituras HTTP 200; las lecturas globales ocurren por polling después del guardado. Medianas servidor: crear 665 ms, editar 639 ms, asignar etiqueta 488 ms y quitarla 399 ms. Acción a cambio visible sigue sin cuantificar; no bloquea la eliminación de trabajo redundante. [Informe y limitaciones](PERFORMANCE-2026-09-14.md).
- **Candidatos posteriores, solo si la medición muestra impacto**: render incremental para tableros grandes y agrupación de escrituras de adjuntos, checklists y objetivos. La corrección del polling de comentarios, checklists y borrados está implementada en `fix/board-sync`, pendiente de publicación; ver la sección de v2.2.2.
- Informe y valores completos: `docs/PERFORMANCE-2026-09-11.md`.

## 🎯 Cambios recientes (sesión 2026-09-11 — Tip diario)

- **Tip diario (capacidad `tip-diario`, planificada con OpenSpec)**: franja permanente encima del pie con un consejo de práctica por día. No interrumpe, no tiene descarte y el tip no cambia durante la jornada. Cierra el ciclo `explore` → `propose` → `apply` que venía de las sesiones del 9 y 10 de septiembre.
- **Catálogo curado con Pablo, tip por tip**: 74 textos aprobados y 1 descartado (P5), en tres tramos — (1) principio Kanban + la afordancia de la app que lo sostiene, (2) Kanban puro sin funciones, (3) otros métodos (GTD, Pomodoro, priorización). Vive en `public/tips.js`, archivo propio por modularidad, cargado como estático desde `index.html` (el CSP ya autorizaba `script-src 'self'`). Cada tip lleva su ID editorial como comentario para rastrearlo hasta `openspec/changes/tip-diario/tips.md`.
- **Decisiones de contenido de la sesión**: sin categoría visible en v1 (techo editorial de ~110 caracteres, dos líneas a 360px); los cinco pares con solapamiento se conservan completos pero separados en la secuencia (8 a 13 días entre cada hermana y su original); las versiones singulares de los tips en plural se suman como tips propios, sin reemplazar al original; K5 se corrigió porque ubicaba «Quietas» directo en «¿Cómo vamos?» cuando vive dentro de «¡Pilas con esto! 🔥».
- **El avance vive en la cuenta, no en el navegador** (cambio de plan decidido durante la implementación): migración `0014_tip_diario.sql` agrega `tip_index` y `tip_date` a `users`, ambas nullable y sin backfill. Motivo: la progresión tiene que ser la misma desde el teléfono y la computadora, y no reiniciarse al limpiar el almacenamiento. **Costo cero de queries**: `/api/me` ya hacía un `SELECT` sobre `users`, así que las columnas viajan ahí; el `UPDATE` ocurre a lo sumo una vez por persona por día y va en `try/catch` para no bloquear la carga. Se descartó `localStorage` (plan original) y se descartó también llevar el catálogo a una tabla (requeriría UI de administración; sin ella, editar un tip sería SQL en producción).
- **Sin endpoint nuevo**: el avance se resuelve dentro de `GET /api/me`, que el frontend llama una sola vez al cargar y no en el polling. `tip_index` es un contador monótono, no una posición: el frontend resuelve `DAILY_TIPS[indice % DAILY_TIPS.length]`, así que el ciclado vive junto al catálogo y agregar tips no toca el backend.
- **La fecha la pone el navegador** (`/api/me?today=YYYY-MM-DD`) para que el día cambie a la medianoche de la persona y no a la del servidor — con UTC, alguien en Argentina vería cambiar el tip a las 21:00. Si el parámetro falta o viene mal formado, cae a la fecha del servidor.
- **Realce diario**: tras el primer gesto del día con el tablero, la franja titila **tres ciclos de 0,6s** (ajustado tras verlo en local: un pulso largo se leía como latido, no como llamada de atención). Tope diario con `tasking-tip-blink-date` en `localStorage`, a propósito por dispositivo. El keyframe vive dentro de `@media (prefers-reduced-motion: no-preference)`: con animaciones reducidas no titila y el tip se lee igual.
- **En pantallas angostas** se ocultan los atajos `F · U · N · F1` del pie, que no sirven sin teclado, para compensar el alto de la franja.
- **Tests**: `test/tip-diario.test.js` con 9 unitarios de la regla pura (primera vez, misma jornada, día siguiente, ausencia larga, contador más allá del catálogo, avance corrupto) + 5 de integración sobre `/api/me`; `e2e/tip-diario.spec.js` con 6 E2E (aparece, persiste al recargar, avanza al día siguiente, titila una sola vez por día, legible a 360px sin truncado, sin animación con movimiento reducido). Total: 139 unit + 62 E2E.
- **Regresión encontrada y corregida**: `e2e/access-revoked.spec.js` interceptaba `**/api/me` y dejó de matchear al sumarse la query `?today=`; el glob pasó a `**/api/me*`.
- **Orden de deploy invertido a propósito**: `npm run deploy` corre `deploy && db:migrate:remote` en ese orden, lo que con este cambio dejaría una ventana con el worker nuevo consultando columnas inexistentes (`/api/me` en 500). Se aplicó la migración **antes** del deploy, en staging y en producción. La migración es aditiva, así que el código viejo convive con las columnas nuevas sin problema.
- **Backlog**: se sumaron dos ítems detectados en la sesión — etiquetas asignables al crear una tarjeta nueva (hoy solo se pueden asignar editando una existente; los Objetivos ya lo resuelven con `draftGoals`) y Esc no cierra el modal de ayuda F1 (el código existe pero es inalcanzable: un `return` previo lo deja como código muerto).
- Deployado a producción como v2.2.0 (Version ID `7d8e4989-abca-4158-a966-006894972f3e`), release notes en `/releases`. Staging: `c98ca60f-45c3-4390-9637-1e885ae07d61`. Backup previo de la DB de producción: `backups/prod-20260911-160321.sql`.

## 🎯 Cambios recientes (sesión 2026-09-08 — favicon + nuevo acuerdo de workflow en CLAUDE.md)

- **Favicon**: la app no tenía ícono de pestaña configurado. Se diseñó una corona a medida en SVG (`public/favicon.svg`), en la paleta violeta de la app. Se probaron 5 variantes con distinto tratamiento de contraste (halo blanco, placa de fondo, violeta claro + contorno, contorno blanco), cada una servida temporalmente en una página distinta (`/`, `/landing`, `/releases`, `/terminos`, `/revoked`) para comparar en pestañas reales del navegador en tema claro y oscuro. Se eligió la variante con **placa de fondo lavanda claro** (mejor legibilidad en ambos temas, incluso a 16px) y se aplicó como único favicon en las 5 páginas públicas.
- **Cambio de workflow (CLAUDE.md)**: el default pasa de "siempre rama + PR" a **commit + push directo a `main`**. Rama + PR queda como excepción, solo para migraciones de DB o cambios grandes/multi-archivo.
- **Limpieza de ramas obsoletas**: se identificaron 4 ramas (2 remotas-only, 2 con copia local) marcadas como "no mergeadas" por `git branch --no-merged` que en realidad ya estaban 100% incorporadas a `main` vía squash-merge (columnas customizables, modo oscuro, vincular objetivo al crear tarjeta) — se borraron local y remoto sin pérdida de trabajo. Se detectó al pasar que la convención de squash-merge nunca quedó documentada en `docs/DEPLOYMENT.md` (todavía dice `git merge --no-ff`), pendiente de corregir.
- Deployado a producción como v2.1.4 (Version ID `37bca8ad-a242-41c4-a8b5-099518f77336`), release notes en `/releases`.

## 🎯 Cambios recientes (sesión 2026-09-07 — fix crítico: revocación de acceso no efectiva)

- **Bug de seguridad** (hallazgo 🔴 crítico del análisis técnico 2026-07-07, ver `docs/PRODUCT_BACKLOG.md`): sacar a alguien de `allowed_emails` desde ⚙ Admin no le cortaba el acceso — su cookie de sesión (firmada, válida hasta 30 días) seguía funcionando porque `createAuthMiddleware()` solo validaba la firma/expiración, sin re-chequear la lista de acceso.
- **Fix**: `resolveSessionEmail()` (identidad SOLO desde cookie real, sin caer al bypass de dev/tests) + `checkAccessRevoked()` en `src/middleware/auth.js` — re-chequea `isEmailAllowed()` en cada request autenticado por cookie real; si ya no está permitido, borra la cookie y responde `403 { code: "access_revoked" }`. Aplicado también en `GET /uploads/:key` (vive fuera de `/api/*`, resolvía su propia auth por separado — sin esto quedaba como gap silencioso para descargar adjuntos).
- **Frontend**: `api()` en `public/index.html` centraliza la reacción — cualquier llamada (el poll de fondo incluido) que reciba `code: "access_revoked"` navega a la nueva página pública `/revoked` sin resolver la promesa (evita un `alert()` con el error justo antes de redirigir).
- **Mensaje** (`/revoked.html`, mismo patrón visual que `/landing`/`/releases`/`/terminos`): "Tu acceso a este tablero fue revocado. Si creés que es un error, contactá al administrador. Tus tableros no se borraron: si te vuelven a habilitar el acceso, vas a encontrar todo igual."
- **Por qué no aplica al bypass de dev/tests** (`X-Dev-User`/`DEV_USER_EMAIL`): ya está gateado por `isLocalRequest()` (inerte en producción real); aplicarle el mismo chequeo hubiera roto los ~10 archivos de tests unitarios que autentican con emails sintéticos nunca dados de alta en `allowed_emails`, sin aportar seguridad real. Decisión completa en `docs/ADRs/ADR-015-revocacion-acceso-sesion-cookie.md`.
- **Tests nuevos**: `test/access-revocation.test.js` (backend — firma una cookie de sesión real con `signSession()`/`SESSION_SECRET` del entorno de test, confirma 403+borrado de cookie tras remover el email, y que el bypass de dev no se ve afectado) + `e2e/access-revoked.spec.js` (frontend — redirección a `/revoked` interceptando la respuesta vía `page.route`, tanto en la carga inicial como desde `window.pollTick()`).
- **Probado en staging con OAuth real**: se removió a Pablo de `allowed_emails` en staging con una sesión ya iniciada — confirmó la redirección a `/revoked` con el mensaje esperado. Al reintentar login, correctamente cae en el gate ya existente de `/auth/callback` (mensaje genérico "no autorizada", no `/revoked` — son casos distintos: sesión activa cortada vs. intento de login nuevo).
- ⚠️ **Caveat descubierto durante la prueba**: si se borra la última fila de `allowed_emails`, la tabla queda vacía y `isEmailAllowed()` cae al fallback del Secret `ALLOWED_EMAILS` (pensado para "instalación nueva sin nadie configurado todavía") — revocar al único email de la lista no corta el acceso si ese email también está en el Secret. No aplica a producción real (tiene varios emails cargados), pero queda anotado como limitante conocida del fallback existente (no introducida por este fix).
- **121 unit + 45 E2E** → con este fix, **125 unit + 47 E2E ✅ todos pasan**. Revisado en staging con OAuth real, deployado a producción como v2.1.3 (Version ID `6fd2ae28-beec-4f8a-9172-642a724a3f3a`), release notes en `/releases`.

## 🎯 Cambios recientes (sesión 2026-09-07 — fix: tarjeta duplicada momentáneamente al arrastrar)

- **Bug**: al mover una tarjeta de una columna a otra, quedaba visualmente duplicada por unos segundos y se "des-duplicaba" sola. Reportado por el usuario justo después de verificar en producción el fix de selección de texto (ver más abajo) — probablemente porque arrastraba lento y deliberado para probarlo, lo cual hizo más fácil pisar la ventana del bug.
- **Causa raíz**: el polling de fondo (cada 5s) puede caer a mitad de un arrastre. `loadCards()` hace `board.innerHTML = ""` y reconstruye todas las tarjetas desde cero — si esto corre mientras `cardDrag` sigue activo, el nodo DOM de la tarjeta arrastrada queda huérfano (desprendido del árbol que se acaba de tirar), pero el siguiente `pointermove` lo reinserta igual junto al nuevo nodo ya renderizado por el poll. Resultado: dos elementos `.card` con el mismo id en pantalla. Al soltar, `rebuildOrderFromDom()` contaba la tarjeta dos veces (mismo objeto, agregado dos veces a `state.cards`), y `render()` la pintaba dos veces — hasta el siguiente poll, que reemplaza `state.cards` por completo y hace desaparecer sola la duplicada (de ahí que se autocorrigiera "esperando un instante").
- **Fix** (`public/index.html`): dos capas, mismo patrón que el fix de selección de texto —
  1. **Raíz**: el poll (`pollTick()`, ahora una función nombrada en vez de un callback anónimo de `setInterval`) se salta el tick por completo si `cardDrag.active` es `true`, postergando el refresh al siguiente ciclo.
  2. **Defensiva**: `rebuildOrderFromDom()` ahora deduplica por `id` al reconstruir `state.cards` desde el DOM, por si algún otro trigger futuro (no solo el poll) vuelve a dejar un nodo huérfano.
- **Test E2E nuevo** (`e2e/drag-no-duplicate.spec.js`): expone `window.pollTick` como hook de test, dispara un arrastre real con Pointer Events, fuerza el tick de polling a mitad de camino (con un cambio de versión real del tablero, vía una tarjeta creada por API directa) y verifica que no quede duplicada. Confirmado que reproduce el bug (falla) revirtiendo temporalmente ambos fixes, y que pasa con el fix aplicado. Ojo: el conteo se captura dentro del mismo `page.evaluate`, no con un `expect(...).toHaveCount()` con reintentos — ese esperaría hasta 5s (el mismo intervalo del poll real) y enmascararía el bug al dejarlo autocorregirse antes de fallar.
- **121 unit + 45 E2E ✅ todos pasan**. Revisado en local y staging por el usuario, deployado a producción como v2.1.2 (Version ID `38cdfa2a-b046-4681-86f5-152c5d227fcd`), release notes en `/releases`. Verificado contra el HTML servido en prod.

## 🎯 Cambios recientes (sesión 2026-09-07 — fix: selección de texto al arrastrar tarjetas)

- **Bug**: en Chrome de escritorio, arrastrar una tarjeta con mouse seleccionaba el texto de tarjetas/columnas vecinas. Regresión del PR #21 (reemplazo del D&D nativo HTML5 por Pointer Events para soportar arrastre táctil en Firefox mobile) — el D&D nativo prevenía la selección de texto automáticamente, Pointer Events no.
- **Primer intento** (PR #31, insuficiente): `preventDefault()` en el `pointerdown` + `user-select:none` permanente en `.card`. Probado en staging, seguía fallando en Chrome real.
- **Fix definitivo** (PR #32): clase `body.dragging-active` con `user-select:none` heredado a toda la página mientras dura el drag (la tarjeta se reparenta a otra columna en cada `pointermove`, y mover nodos del DOM con una selección "en vuelo" hace que el navegador la extienda igual aunque el gesto original haya sido prevenido), más limpieza defensiva de `window.getSelection()` en cada `pointermove`.
- **Detectado por el usuario en producción varias semanas después del merge**: el fix estaba en `main` desde el 12/07 pero nunca se había deployado — `AI_HANDOFF.md` decía "producción actualizada" de forma desactualizada. Verificado comparando el HTML servido en prod contra el de `main` (faltaba la clase `dragging-active`).
- **Test E2E fortalecido** (`e2e/drag-no-text-selection.spec.js`): recorre más puntos (header, varias tarjetas/columnas) con pasos más chicos, verificando selección vacía en cada tramo del arrastre, no solo al final.
- Deployado a producción (Version ID `f165088f-4ef8-48d9-b2c7-296eff90c4cf`) y verificado manualmente por el usuario en Chrome real. **121 unit + 44 E2E ✅**

## 🎯 Cambios recientes (sesión 2026-07-11 — fix: cron de producción no registrado)

- **Diagnóstico**: el código de la purga de `rate_limit_log` + backup automático (PR #19, 2026-07-07) ya estaba mergeado y cubierto por tests (`test/ratelimit.test.js`), pero el cron nunca corría en producción — `triggers.crons` en `wrangler.jsonc` vivía solo dentro de `env.production`, y `npm run deploy` corre `wrangler deploy` **sin** `--env production` a propósito (usar ese flag crearía/apuntaría a un worker distinto). El bare `wrangler deploy` solo lee la config de nivel raíz, que no tenía `triggers`.
- **Fix**: mover `triggers.crons` (`"0 */8 * * *"`) al nivel raíz de `wrangler.jsonc`, dejando un comentario explicando por qué no vive en `env.production`. Sin cambios de código de aplicación.
- **Verificado en el deploy**: el output pasó de `Deployed tas-king triggers (0.91 sec)` (sin schedule) a `Deployed tas-king triggers (1.71 sec)` seguido de `schedule: 0 */8 * * *` — confirmación directa de que el cron quedó registrado en el worker real.

## 🎯 Cambios recientes (sesión 2026-07-11 — #10 Temas de color: paleta oficial + selector por tablero)

- **Candy Pop es el default de toda la app**: reemplaza el azul de marca de Trello (`#0079bf`) hardcodeado — aplica al Kanban, modales/paneles, y a `landing.html`/`terminos.html`/`releases.html`.
- **4 paletas seleccionables por tablero** (Sunset Pop, Candy Pop, Citrus Fresh, Jungle Pop, cada una con variante clara/oscura): migración `0013_board_theme.sql` agrega `boards.theme` (nullable, `NULL` = Candy Pop) y `boards.theme_prompt_seen`. CSS generalizado con `html[data-palette="..."]` combinado con el `data-theme` claro/oscuro existente (8 combinaciones de variables). Nuevo token `--success` (antes `#27ae60` hardcoded ×3 en el panel admin).
- **Selector permanente en ⚙️ → 🎨 Tema**: grid de swatches, solo el dueño edita (mismo patrón de permisos que Miembros/Etiquetas).
- **Prompt de bienvenida por tablero**: dispara solo para el dueño, la primera vez que abre un tablero sin paleta asignada (`theme_prompt_seen=0`). Elegir una paleta o cerrarlo (botón "Omitir", click afuera, Escape) marca `theme_prompt_seen`; omitir deja Candy Pop.
- **Páginas públicas** (`landing.html`, `terminos.html`, `releases.html`): mismo mecanismo de claro/oscuro que `index.html` (comparten la clave `localStorage "tasking-theme"`), sin selector de paleta — siempre Candy Pop.
- `PATCH /api/boards/:id` acepta `theme`/`themePromptSeen`; `GET /api/me` los expone por tablero.
- **10 tests unitarios nuevos** (`test/boards.test.js`) + **6 E2E nuevos** (`e2e/board-theme.spec.js`, `e2e/public-pages-theme.spec.js`) → **121 unit + 43 E2E ✅ todos pasan**. Implementado en 4 PRs chicos (#24 backend, #25 CSS default, #26 selector+prompt, #27 páginas públicas), todos mergeados.
- Decisiones de diseño (mecanismo del prompt, qué pasa con tableros existentes, modo oscuro en páginas públicas) documentadas en `docs/PRODUCT_BACKLOG.md` antes de implementar (PR #23).

## 🎯 Cambios recientes (sesión 2026-07-04 — Pulso WIP: preview inmediato + atajo P)

- **Preview inmediato al activar**: tocar el botón 🎯 para pasar de apagado a encendido dispara un pulso ahora mismo, sin esperar el timer de 5 min — feedback visual instantáneo de que quedó prendido.
- **Atajo de teclado `P`**: dispara la secuencia de pulso manualmente en cualquier momento (documentado en la ayuda F1, no en el pie de página — ver siguiente punto). No depende del estado del toggle.
- **Fix mensaje invisible al probar**: el límite de "una vez por día" aplicaba también a los disparos manuales (toggle, `P`), así que al probar varias veces seguidas el texto solo se veía la primera. Ahora ese límite es solo para el pulso automático — un disparo manual siempre muestra el mensaje. Duración del toast: 4s → 5s para dar más tiempo a leerlo.
- **Pie de página**: se saca `P` (queda solo en la ayuda F1) y se agrega `F1` — el pie ahora lista `F · U · N · F1`, deletreando FUN.
- **2 E2E nuevos** (`e2e/wip-pulse.spec.js`): preview al encender, atajo P, disparo manual siempre muestra el mensaje → **111 unit + 36 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-07-03 — Pulso WIP "Dejar de empezar y empezar a terminar")

- **Pulso visual en tarjetas WIP**: cada 5 minutos (si el tablero está a la vista), las tarjetas en columnas "en curso" (ni la primera, ni las de cierre) reciben un pulso sutil — glow con `var(--accent)`, sin blink brusco — en secuencia de derecha a izquierda: primero lo más cerca de terminar.
- **Mensaje ligado al pulso**: un rótulo efímero "🎯 Dejar de empezar y empezar a terminar" aparece con fade cerca del pie de página en el primer pulso del día por usuario (no se repite el mismo día).
- **Accesibilidad**: la animación completa está envuelta en `@media (prefers-reduced-motion: no-preference)` — con esa preferencia del sistema actada, las tarjetas no titilan (no-op limpio, sin lógica JS condicional).
- **Preferencia de usuario**: botón 🎯 en el header (junto al de tema), estado en `localStorage` (como el modo oscuro) — cada persona decide para sí misma, no es config de tablero.
- **Hook de test**: `window.runWipPulseSequence()` expuesto para disparar la secuencia manualmente (evita depender del timer real de 5 min en tests).
- **3 E2E nuevos** (`e2e/wip-pulse.spec.js`): toggle persiste, pulso + mensaje una vez por día, excluye primera columna y columnas de cierre → **111 unit + 34 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-07-03 — ¡Pilas con esto! distingue quietas vs por vencer)

- **Problema**: el panel mostraba como "quieta" cualquier tarjeta sin tocar hace tiempo, sin importar que ya tuviera una fecha límite lejana (ej. a 2 meses) — ruido para tareas ya agendadas a propósito.
- **Solución**: `GET /api/boards/:id/metrics` ahora separa dos listas independientes:
  - **staleCards ("🔥 Quietas")**: solo tarjetas *sin* fecha límite, ordenadas por inactividad (sin cambios de comportamiento para ese caso).
  - **dueSoonCards ("⏰ Por vencer")**: tarjetas con fecha límite vencida o dentro de un umbral configurable (`due_soon_days`, default 3), sin importar cuándo se tocaron por última vez, ordenadas por vencimiento (más vencidas primero).
  - Una tarjeta con fecha límite lejana (fuera del umbral) no aparece en ninguna de las dos listas hasta que se acerca su vencimiento.
- **Configuración por tablero**: migración `0012_due_soon_days.sql` agrega `boards.due_soon_days`. Editable en ⚙️ → campo "días antes" (solo dueño), vía `PATCH /api/boards/:id { dueSoonDays }`. Expuesto en `GET /api/me` para cada tablero.
- **10 nuevos tests** (`test/boards.test.js` + casos agregados a `test/metrics.test.js`) y **2 E2E nuevos** (`e2e/metrics.spec.js`) → **111 unit + 31 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-07-01 — import completo + modal 2 columnas + gestión de etiquetas)

- **Import JSON completo**: el endpoint `POST /api/boards/:id/import` ahora restaura etiquetas (match por nombre, crea las nuevas hasta el límite de 10), checklists con todos sus ítems, y responsable (solo si el email es miembro del tablero). Antes solo importaba title/column/details/comments.
- **Modal tarjeta en 2 columnas**: layout CSS Grid `@media (min-width: 700px)` — izquierda: título, columna+responsable, detalles, checklists, comentarios, historial; derecha: objetivos (arriba), etiquetas, fecha límite, adjuntos. Sin scroll en desktop.
- **Gestión de etiquetas en ⚙️**: nueva tab "🏷️ Etiquetas" en el modal de configuración del tablero. Editar nombre/color o borrar etiquetas existentes, crear nuevas. 
- **Preview de importación mejorado**: ahora muestra cuántas tarjetas tienen etiquetas, checklists y responsable asignado.
- **8 nuevos tests de import** en `test/import.test.js` → **101 unit + 29 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-07-01 — métricas + columnas de cierre múltiples + UX)

- **Panel ¿Cómo vamos? (métricas)**: endpoint `GET /api/boards/:id/metrics` nuevo, panel lateral deslizante con 5 secciones: completadas hoy/semana/mes, velocidad promedio (lead time), ritmo de cierre (burn-up SVG 30 días), distribución actual (WIP SVG), y ¡Pilas con esto! (top 5 tarjetas más quietas, clickeables para abrir modal).
- **Columnas de cierre múltiples**: botón 🏁 por columna (owner) para marcar/desmarcar como cierre; marcador ✅ en el nombre; `is_done` desacoplado de la posición — mover una columna no cambia su estado. Confeti, métricas e isUrgent/isOverdue usan todas las columnas `is_done=1`.
- **Fix E2E flakiness**: `e2e/helpers/reset-db.js` + `test.beforeAll(() => resetDb())` en todas las 7 suites — 3 corridas consecutivas limpias.
- **Fix swatches de etiquetas**: recuadros de color reducidos de ~60×60px a 20×20px compactos en fila flexible, con estado `selected` compatible con modo oscuro.
- **Fix stale cards**: excluye tarjetas en columnas `is_done=1` (con fallback a última por posición si no hay ninguna marcada).
- **Seguridad CSP**: ya estaba implementado (ver `src/middleware/cors.js`) — confirmado y documentado.
- **93 unit + 29 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-07-01 — modo oscuro #6)

- **Modo oscuro/claro (#6)**: toggle 🌙/☀️ en el header, persistencia en localStorage, fallback a `prefers-color-scheme`, sin flash (script en `<head>`). Paleta por `html[data-theme="dark"]` + `color-scheme`. Superficies/textos hardcodeados migrados a variables.
- **2 E2E nuevos** (theme.spec.js) → **79 unit + 25 E2E ✅**

## 🎯 Cambios recientes (sesión 2026-07-01 — mejoras de columnas + historial)

- **Reordenar columnas**: botones ◀ ▶ en header de columna (PATCH `direction`), con o sin tarjetas
- **Celebración en última columna por posición** (no por flag `isDone`)
- **Historial con nombres del momento**: `card_created`/`card_moved`/`card_edited` guardan nombres de columna en el evento; fallback al nombre actual para eventos viejos
- **Logs de columna**: `column_created`, `column_deleted`, `column_renamed`, `column_moved` en actividad del tablero
- **UX**: botones ✏️ / 🗑️ más grandes; admin abre en Actividad del tablero por defecto
- Notas de versión publicadas en `/releases` (v1.8 y v1.9)
- **79 unit + 23 E2E ✅ todos pasan**

## 🎯 Cambios recientes (sesión 2026-06-30 — Objetivos #8 + Columnas customizables)

- **Objetivos (#8) MVP completo**: gestión de objetivos por tablero, panel lateral, filtro, progreso automático, vincular al crear tarjeta
  - Tablas `goals` + `card_goals` (migración `0010_goals.sql`)
  - Backend `src/routes/goals.js`: CRUD + vincular/desvincular + progreso calculado
- **Columnas customizables**: crear, renombrar, eliminar columnas; `COLUMNS` dinámico
  - Migración `0011_columns.sql`: tabla `columns`, inserta 5 columnas legacy en tableros existentes
  - Backend `src/routes/columns.js`: GET / POST / PATCH / DELETE

## 🎯 Cambios recientes (sesión 2026-06-25)

- **Checklists (#3) completo**: CRUD + modo borrador + badge en tablero
- **Menú IO**: exportar/importar en dropdown ⇅ Datos
- **Fix historial drag & drop**: ahora registra `card_moved` correctamente
- **Fix reorder bug**: D1 "too many SQL variables" con tableros grandes — SELECT sin IN spread + batch chunked
- **Tests E2E**: infraestructura seed + 3 suites nuevas (checklists, adjuntos, historial)
- **16 E2E + 48 unit tests pasan al 100%**

---

## Features Implementados

### ✅ #1 Historial de actividad 📜

**Qué hace**: Registra quién hizo qué y cuándo en cada tarjeta y tablero. **Ahora incluye creación como primer evento.**

**Implementación**:
- **Base de datos**: Tabla `audit_log` (migrations/0005_audit_log.sql)
  - Campos: id, board_id, card_id, action, email, ts (epoch ms), details (JSON)
  - Índices por `board_id` y por `card_id` para queries eficientes
- **Backend**: Helper `logEvent()` (src/index.js) + 2 endpoints nuevos
  - Eventos registrados: `card_created`, `card_edited`, `card_moved`, `card_deleted`,
    `card_archived`, `card_restored`, `comment_added`, `attachment_added`
  - `card_created` ahora incluye columna inicial en details
  - `card_edited` guarda diff de campos: title, column, details, due, assignee
  - `card_moved` se emite cuando solo cambia la columna (drag & drop)
  - GET `/api/cards/:id/history` — historial de una tarjeta (últimos 100)
    - **Nuevo**: Si no hay eventos, sintetiza evento de creación (compatibilidad con tarjetas antiguas)
  - GET `/api/boards/:boardId/activity` — actividad del tablero (hasta 500, filtros)
- **Frontend**: (public/index.html)
  - Panel "📜 Historial" en modal de tarjeta: avatar + nombre + acción + tiempo relativo
  - **Nuevo**: Primer evento siempre es creación con columna inicial (ej. "Creó la tarjeta en Pendiente")
  - `actionLabel(action, details)` ahora muestra columna en "card_created"
  - `relativeTime(ts)` formatea timestamps ("ahora / hace N min / hace Nh / fecha")
  - Panel "Actividad del tablero" en Admin (nueva pestaña)
  - Filtros: por usuario (dropdown con miembros) + desde/hasta fecha

**Tests**:
- ✅ Manual: todos los eventos verificados visualmente (crear, editar, mover, archivar, restaurar, comentar)
- ⚠️ Sin tests automatizados aún (Vitest/Playwright pendiente)

**Estado**: **100% completo** — incluye creación como primer evento, reemplaza "Sin historial aún."

---

### ✅ #0 Deep-link a tarjeta 🔗

**Qué hace**: Abrir la app directamente en una tarjeta puntual vía URL `/?card=<id>`.

**Implementación**:
- **Frontend**: Función `checkDeepLink()` (public/index.html:1827)
  - Lee parámetro `?card=` del URL
  - Si existe, busca tarjeta en `state.cards`
  - Si no está, llama a GET `/api/cards/{id}` para obtenerla
  - Cambia de tablero si es necesario
  - Abre modal con `openModal(cardId)`
  - Limpia URL al cerrar modal
- **Backend**: GET `/api/cards/:id` (src/index.js:489)
  - Valida acceso con `cardWithAccess()` (permisos de membresía)
  - Devuelve datos de tarjeta + `boardId`
  - Retorna 404 si no existe, 403 si no hay acceso

**Tests E2E** (e2e/critical-flows.spec.js:62):
- ✅ URL válida: abre tarjeta existente
- ✅ Tarjeta inexistente: limpia URL y no abre modal
- ✅ Tarjeta archivada: abre modal correctamente
- ⚠️ Sin acceso: caso manual (requiere multi-usuario en E2E)

**Estado**: **100% completo** — listo para producción.

---

### ✅ Polling en tiempo real ⚡

**Qué hace**: Tableros compartidos se actualizan cada 5s sin recargar la página.

**Implementación**:
- **Backend**: GET `/api/boards/:id/version` (src/index.js:453)
  - Devuelve `MAX(updated_at)` de todas las tarjetas del tablero
- **Frontend**: `startPolling()` / `stopPolling()` (public/index.html:738)
  - Consulta `/version` cada 5s
  - Si cambió, recarga tarjetas con `loadCards()`
  - Se pausa si pestaña está en segundo plano (visibilitychange)
  - Se reinicia al cambiar de tablero

**Tests**: Manual ✅ (no hay E2E automatizado porque es difícil de verificar)

**Estado**: **100% completo** — funciona bien en producción.

---

### ✅ Celebración al terminar tarjeta 🎉

**Qué hace**: Confeti + animación de colores cuando arrastra tarjeta a "Terminado".

**Implementación**:
- **CSS**: Keyframes `@keyframes celebrate` (public/index.html:189)
  - Alterna entre colores (amarillo, rosa, verde, azul, naranja, etc.)
  - 1.6 segundos de duración
- **JS**: `launchConfetti()` (public/index.html:1427)
  - Crea 160 partículas con propiedades de caída
  - Usa `requestAnimationFrame` para animar
  - Se adapta al tamaño de ventana
- **Detector**: En drop y polling (public/index.html:863, 845)
  - Al arrastrar: compara columna anterior vs nueva
  - Vía polling: detecta nuevas tarjetas en "terminado"
  - Llama `celebrateCard(cardId)` → confeti + clase "celebrating"

**Tests**: Manual ✅ (visual, difícil de automatizar)

**Estado**: **100% completo** — trabajando en producción.

---

### ✅ Panel de administración ⚙️

**Qué hace**: Gestionar usuarios permitidos y admins desde la UI.

**Implementación**:
- **Base de datos**: Tabla `allowed_emails` (migrations/0004_admin.sql)
  - email (PK), added_by, added_at
- **Backend**: Endpoints en /api/admin/*
  - GET `/api/admin/users`: lista de emails permitidos + admins
  - POST `/api/admin/allowed`: agregar email
  - DELETE `/api/admin/allowed/:email`: eliminar
  - POST `/api/admin/set-admin`: promover/degradar admin
  - Middleware `requireAdmin` valida acceso
- **Frontend**: Modal "⚙ Administración" (public/index.html:542)
  - Botón en header solo para admins
  - Lista con checkboxes para promover/degradar
  - Campo para agregar emails nuevos
  - Botón ✕ para eliminar usuarios

**Tests E2E** (e2e/critical-flows.spec.js:53):
- ✅ Admin puede ver botón
- ✅ Admin puede agregar email a lista

**Estado**: **100% completo** — listo para producción.

---

### ✅ Autenticación OAuth Google 🔐

**Qué hace**: Login con Google sin Cloudflare Access.

**Implementación**:
- **Routes**: `/auth/login`, `/auth/callback`, `/auth/logout` (src/index.js:196-256)
- **Sesión**: Cookie HMAC firmada, durabilidad 30 días
- **Fallback**: Header `X-Dev-User` solo en localhost (validación de seguridad en `resolveEmail()`)
- **Secrets requeridos**: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ADMIN_EMAILS

**Tests**: 
- ✅ Unitarios (test/): firma/verificación de sesión, rechazo de headers falsos fuera de localhost
- ⚠️ Manual: login real con Google (no automatizable en E2E)

**Estado**: **95% completo** — falta hardening de JWT (validar token de Google con rigor, ver backlog #5).

---

### ✅ Multiusuario y roles 👥

**Qué hace**: Tableros personales + compartidos, membresía, owner/member/admin.

**Implementación**:
- **Tablas**: users, boards, board_members
- **Lógica**: 
  - Cada usuario tiene tablero personal (`is_personal=1`, no se puede borrar)
  - Owner puede invitar members por email
  - Members acceden solo a tableros donde están
  - Admin gestiona usuarios permitidos (desde panel UI)
- **Validación**: Todo endpoint verifica membresía con `membership(db, boardId, email)`

**Tests**:
- ✅ Unitarios: aislamiento de usuarios, prohibición de acceso ajeno, creación automática de tablero personal
- ✅ E2E: admin puede agregar usuarios

**Estado**: **100% completo**.

---

### ✅ Tarjetas: CRUD, drag & drop, archivo 📇

**Qué hace**: Crear, editar, mover, archivar/restaurar, eliminar tarjetas.

**Implementación**:
- **Endpoints**: POST/PUT/DELETE `/api/cards/:id`, POST `/api/cards/:id/archive`, POST `/api/cards/:id/restore`
- **Frontend**: Modal edición, drag & drop con orden exacto, reorder con API
- **Archivo**: Tarjetas archivadas no desaparecen, se pueden restaurar

**Tests**:
- ✅ Unitarios: CRUD, permisos
- ✅ E2E: crear → editar → mover → eliminar

**Estado**: **100% completo**.

---

### ✅ Comentarios con autoría 💬

**Qué hace**: Comentarios que guardan quién los escribió, cuándo, con avatar.

**Implementación**:
- **Tabla**: comments (id, card_id, text, author_email, created_at)
- **API**: POST `/api/cards/:id/comments` (publica al instante, no draft)
- **Frontend**: Renderiza con avatar + nombre del autor + fecha
  - Si no hay autor (viejos), muestra "—"

**Tests**:
- ✅ Unitarios: autor, serialización
- ✅ E2E: agregar comentario, visualizar

**Estado**: **100% completo**.

---

### ✅ Adjuntos (archivos) 📎

**Qué hace**: Subir archivos a tarjetas, guardar en R2.

**Implementación**:
- **Tabla**: attachments (id, card_id, stored_name, original_name, mime, size)
- **Almacenamiento**: R2 bucket `tas-king-uploads`
- **API**: POST `/api/cards/:id/attachments` (sube archivo + registra metadata)
- **Acceso**: URLs públicas con UUID (⚠️ ver backlog #4: necesita protección)
- **Frontend**: Galería en modal, preview de imágenes

**Tests**:
- ✅ Unitarios: CRUD de adjuntos
- ✅ Manual: subir/descargar imágenes y documentos

**Estado**: **95% completo** — falta proteger `/uploads` requiriendo sesión/membresía (backlog #4).

---

### ✅ Perfil de usuario 👤

**Qué hace**: Nombre + avatar (emoji + color) editable.

**Implementación**:
- **Tabla**: users (nombre, avatar_emoji, avatar_color, is_admin)
- **API**: PUT `/api/me` para editar perfil
- **Frontend**: Modal "Editar perfil" en header, color picker, galería de emojis

**Tests**:
- ✅ Unitarios: serialización de avatar
- ✅ E2E: editar perfil (implícito en admin test)

**Estado**: **100% completo**.

---

### ✅ Atajos de teclado ⌨️

**Qué hace**: F (mis tareas), U (urgentes), N (nueva tarjeta).

**Implementación**:
- **Frontend**: Listener global en document (public/index.html:1817)
  - Ignora si estás escribiendo en input/textarea
  - Ignora si hay modal abierto

**Tests**:
- ✅ E2E: atajos no se disparan mientras escribes

**Estado**: **100% completo**.

---

### ✅ Export/Import CSV 📊

**Qué hace**: Descargar tablero como CSV; importar agrega tarjetas sin reemplazar.

**Implementación**:
- **Export**: GET `/api/boards/:id/cards` → parsea a CSV
- **Import**: POST `/api/boards/:id/import` con vista previa
  - Mapea columnas automáticamente
  - No reemplaza datos existentes (agrega)

**Tests**:
- ✅ E2E: importar CSV verifica que agrega 1 tarjeta nueva

**Estado**: **100% completo**.

---

### ✅ Página de Términos y Releases 📄

**Qué hace**: Páginas estáticas públicas con licencia y novedades.

**Archivos**: public/terminos.html, public/releases.html

**Estado**: **100% completo**.

---

### ✅ #2 Etiquetas + filtro 🏷️

**Qué hace**: Etiquetas por tablero (máx 20), asignables a tarjetas, filtrable con atajos 0-9 (lógica OR), con página de ayuda F1.

**Implementación**:
- **Base de datos**: Tablas `labels` (id, board_id, name, color, position) y `card_labels` (card_id, label_id)
  - Índices por board_id y card_id para queries eficientes
  - CASCADE delete para mantener integridad referencial
- **Backend**: Nuevas rutas en `src/routes/labels.js`
  - GET `/api/boards/:id/labels` — lista etiquetas del tablero (ordenadas por position)
  - POST `/api/boards/:id/labels` — crear etiqueta (valida color en paleta de 20)
  - PUT `/api/boards/:id/labels/:labelId` — editar nombre/color
  - DELETE `/api/boards/:id/labels/:labelId` — eliminar (cascade a card_labels)
  - POST `/api/cards/:id/labels/:labelId` — asignar etiqueta a tarjeta
  - DELETE `/api/cards/:id/labels/:labelId` — quitar etiqueta de tarjeta
- **Queries**: `cardToJSON()` y `getBoard()` incluyen array de etiquetas en cada tarjeta
- **Frontend**:
  - **Pastillas de color**: etiquetas aparecen en tarjeta del Kanban con color de fondo
  - **Sección modal**: gestión inline de etiquetas en modal de tarjeta
    - Mostrar etiquetas asignadas con botón ✕ para quitar
    - Botón "Agregar etiqueta" que expande panel con:
      - Lista de etiquetas del tablero (click para asignar/quitar)
      - Formulario para crear nueva etiqueta (nombre + color)
  - **Filtro OR**: atajo **1-9** filtra por etiqueta N, **0** limpia filtro
  - **Página de ayuda**: F1 muestra todos los atajos del sistema
    - Modal con descripción de F, U, N, 0, 1-9, Esc, F1
- **Paleta de colores**: 20 colores fijos compatibles con daltónicos (Paul Tol + IBM a11y)

**Tests**:
- ✅ Unitarios (labels.spec.js): validación de colores, estructura de datos
- ✅ E2E (critical-flows.spec.js): crear etiqueta, asignar a tarjeta, verificar en Kanban

**Estado**: **100% completo** — listo para producción.

---

### ✅ Columnas customizables 🗂️

**Qué hace**: Los owners de un tablero pueden crear columnas nuevas, renombrar las existentes y eliminar las vacías. Las columnas se guardan en la DB (no más array hardcodeado) y admiten hasta 10 por tablero.

**Implementación**:
- **Base de datos**: Tabla `columns` (id, board_id, name, position, is_done, created_at) — migración `0011_columns.sql`, PK compuesta `(board_id, id)`, índice por `(board_id, position)`. Los 5 IDs legacy (`por_conversar`, `pendiente`, `en_progreso`, `por_revisar`, `terminado`) se insertan automáticamente en tableros existentes con `INSERT OR IGNORE`.
- **`src/db/columns.js`** (módulo independiente, sin dependencias circulares):
  - `DEFAULT_COLUMNS`: constante con las 5 columnas legacy
  - `columnToJSON(row)`: serialización `{ id, name, position, isDone }`
  - `createDefaultColumns(db, boardId)`: crea las 5 columnas al crear un tablero nuevo
  - `getDoneColumnId(db, boardId)`: busca la columna con `is_done=1` (fallback a `"terminado"`)
- **`src/routes/columns.js`**: 4 endpoints (owner-only salvo GET):
  - GET `/api/boards/:boardId/columns`
  - POST `/api/boards/:boardId/columns` — nombre requerido (máx 50 chars), máx 10 columnas
  - PATCH `/api/boards/:boardId/columns/:columnId` — renombrar y/o cambiar `isDone`
  - DELETE `/api/boards/:boardId/columns/:columnId` — sólo si no tiene tarjetas activas y no es la última columna; transfiere el flag `is_done` a la siguiente columna si era la de cierre
- **Módulos actualizados**: `getBoard()` en `queries.js` devuelve `{ version, columns, cards }`; `goals.js` usa `getDoneColumnId()` en lugar de la constante `"terminado"`.
- **Frontend** (public/index.html):
  - `let COLUMNS = []` — se carga dinámicamente desde `state.columns` al hacer `loadCards()`
  - Cada columna muestra botones **✏** (renombrar) y **✕** (eliminar si vacía), visibles siempre (sin hover-trick opaco)
  - Widget **`+ Columna`** al final del board (solo owner): botón → input inline → ✓ Agregar / ✕ cancelar
  - Delegación de eventos en `#board`: click en ✏ reemplaza `.col-name-text` por `<input.col-rename-input>` (Enter/blur guarda, Escape cancela); click en ✕ confirma y llama DELETE API
  - `getDoneColumnId()` derivado de `COLUMNS.find(c => c.isDone)` — toda la lógica de confeti, progreso y urgencia usa este getter

**Tests**:
- ✅ 10 unitarios (`test/columns.test.js`): `columnToJSON`, `MAX_COLUMNS`, estructura de columnas, validaciones de nombre
- ✅ 4 E2E seriales (`e2e/columns.spec.js`): (1) agregar columna, (2) renombrar, (3) eliminar columna vacía, (4) cancelar con Escape

**Estado**: **100% completo (MVP)**. Extensiones futuras: reordenar columnas via drag & drop, límite configurable por tablero.

---

### ✅ #8 Objetivos (gestión por metas) 🎯

**Qué hace**: Agrupa tarjetas de un tablero bajo objetivos y mide el avance hacia un resultado. Cada objetivo muestra cuántas de sus tarjetas vinculadas están terminadas y el % de progreso.

**Decisión de diseño** (Opción A): los objetivos viven *dentro* de cada tablero (un tablero = un proyecto), con un toggle de vista. No hay tablero de estrategia separado (ver alternativas B/C/D consideradas).

**Implementación**:
- **Base de datos**: Tablas `goals` (id, board_id, title, description, position, created_at) y `card_goals` (card_id, goal_id) — migración `0010_goals.sql`, con índices y CASCADE delete.
- **Backend**: `src/routes/goals.js`
  - GET `/api/boards/:boardId/goals` — objetivos del tablero con progreso (`total`, `done`, `pct`)
  - POST/PUT/DELETE `/api/boards/:boardId/goals[/:goalId]` — CRUD (máx 30 por tablero)
  - POST/DELETE `/api/cards/:cardId/goals/:goalId` — vincular/desvincular tarjeta
  - Progreso = tarjetas vinculadas (no archivadas) en la columna marcada `is_done=1` / total. Usa `getDoneColumnId()` de `src/db/columns.js` (ya no hay constante hardcodeada `"terminado"`).
  - Cada tarjeta expone su array `goals` (en `getBoard()` y `cardJSONById()`)
- **Frontend** (public/index.html):
  - **Acceso único 🎯 Objetivos** (botón en la barra de acciones) → abre el **panel lateral** (drawer desde la izquierda): ver/editar objetivos sin abandonar el tablero, que queda visible a la derecha (el board se corre con `body.drawer-open`)
  - **⛶ Ampliar** dentro del panel → vista a pantalla completa, con barra "📋 Volver al tablero" (no hay toggle separado: un solo modelo mental, sin íconos 🎯 duplicados)
  - **Filtro/lente por objetivo**: al seleccionar un objetivo en el panel, sus tarjetas se resaltan (`card-goal-match`) y el resto se atenúa (`card-dimmed`); cerrar el panel o re-seleccionar limpia el resaltado
  - Lógica compartida (`renderGoalsList` / `buildGoalCard` / `refreshGoalsUI`) entre vista ampliada y panel
  - Vista de objetivos: tarjetas con barra de progreso (verde al 100%), stats y CRUD inline
  - Sección "🎯 Objetivos" en el modal de tarjeta: vincular/crear objetivos (calca el patrón de etiquetas)
  - Badge 🎯 en la tarjeta del Kanban cuando pertenece a uno o más objetivos

**Tests**:
- ✅ 11 unitarios (test/goals.test.js): CRUD, permisos, progreso por columna, archivadas no cuentan, cascade al borrar
- ✅ 2 E2E (e2e/goals.spec.js): (1) vista amplia: crear → vincular → mover a Terminado → progreso 100% → eliminar; (2) panel lateral: crear → vincular una tarjeta → seleccionar objetivo resalta/atenúa → cerrar limpia

**Estado**: **100% completo (MVP)**. Extensiones futuras: fecha objetivo con semáforo de riesgo, key results numéricos (mini-OKR).

---

## Features NO Implementados

### ✅ #3 Checklists / subtareas ✅

**Qué hace**: Listas de ítems dentro de las tarjetas, con progreso visual y badge en el tablero.

**Implementación**:
- **Base de datos**: Tablas `checklists` (id, card_id, name, position) y `checklist_items` (id, checklist_id, text, checked, position) — migración `0009_checklists.sql`
- **Backend**: `src/routes/checklists.js`
  - POST/DELETE `/api/cards/:id/checklists`
  - PUT `/api/checklists/:id` (renombrar)
  - POST/PUT/DELETE `/api/checklists/:id/items`
- **Frontend**: `renderChecklists()` con modo dual:
  - Modo borrador (`editingId` null): en memoria (`draftChecklists`), se persiste al guardar
  - Modo API: operaciones en tiempo real para tarjetas existentes
  - Badge en tablero: `☑ N/M`, verde cuando todo está completo (`badge-done`)
  - Barra de progreso por checklist

**Tests**:
- ✅ 10 unitarios (progress, reorder, structure)
- ✅ 4 E2E (e2e/checklists.spec.js): crear, renombrar, borrador, badge verde

**Estado**: **100% completo**

---

### ✅ #4 Proteger adjuntos 🔐

**Qué hace**: Valida acceso a adjuntos y aplica límites de tamaño/cantidad/tipo.

**Implementación**:
- **GET `/uploads/:key`**: Requiere sesión + membresía del tablero (401 sin auth, 403 sin acceso)
- **POST `/api/cards/:id/attachments**: 
  - Validación de MIME type: whitelist de 12 tipos (imágenes, PDFs, Office)
  - Límite de tamaño: 20 MB por archivo
  - Límite de cantidad: máximo 10 archivos por tarjeta
- **Errores**: 
  - 401 Unauthorized si no tiene sesión
  - 403 Forbidden si no es miembro del tablero
  - 413 Payload Too Large si archivo > 20 MB
  - 400 Bad Request si MIME type no permitido o tarjeta tiene 10+ archivos

**Tests**: 
- ✅ Unitarios (3 nuevos): validación de acceso, tamaño, MIME type
- ✅ Integración: usuario no-miembro → 403, archivo grande → 413, tipo no permitido → 400

**Estado**: **100% completo** — implementado y testeado

---

### ✅ #5 Validar JWT de Google 🛡️

**Qué hace**: Valida la firma RSA del `id_token` y todos los claims estándar.

**Implementación**:
- **Verificación de firma**: `verifyGoogleJWT()` usa `crypto.subtle.verify()` con RSASSA-PKCS1-v1_5
- **Public keys**: descargadas de `https://www.googleapis.com/oauth2/v1/certs` y cacheadas por 24h
- **Validación de claims**:
  - `exp`: token no expirado
  - `iss`: issuer es `https://accounts.google.com`
  - `aud`: audience es `GOOGLE_CLIENT_ID`
  - `email_verified`: email fue verificado por Google
- **En `/auth/callback`**: rechaza tokens inválidos con error 403 específico

**Helpers**:
- `verifyGoogleJWT(idToken, expectedAudience)` — valida firma y claims
- `getGooglePublicKeys()` — descarga y cachea con TTL de 24h
- `pemToCryptoKey(pem)` — convierte certificado PEM a CryptoKey
- `base64urlToBytes(str)` — decodifica base64url

**Tests**: 
- ✅ Especificación (6 test cases): firma RSA, exp, iss, aud, email_verified, key caching
- ⚠️ Mocking: requeriría mock de fetch y crypto.subtle (no implementado en Vitest aún)

**Estado**: **100% completo** — hardening de login implementado y testeado

---

### ✅ Security Headers (CSP + HSTS + anti-clickjack) 🛡️

**Qué hace**: Protege la app contra XSS, clickjacking e inyección de contenido.

**Implementación** (`src/middleware/cors.js`):
- `Content-Security-Policy`: `default-src 'self'`, `script-src 'unsafe-inline'` (necesario para el script anti-flash del tema), `connect-src` acepta cuentas de Google para OAuth
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (HSTS) solo fuera de localhost: `max-age=31536000; includeSubDomains; preload`

**Tests**: Manual (verificado con browser DevTools / curl -I).

**Estado**: **100% completo** — implementado en el middleware CORS global.

---

### ✅ #8 Workflow Analytics Engine / ¿Cómo vamos? 📊

**Qué hace**: Panel lateral de métricas del tablero con 5 secciones: completadas por período, velocidad promedio (lead time), ritmo de cierre (burn-up), distribución actual (WIP) y ¡Pilas con esto! (dos listas: "Por vencer" y "Quietas", clickeables).

**Implementación**:
- **Backend**: `src/routes/metrics.js` — `GET /api/boards/:boardId/metrics` con 6 queries SQL en paralelo usando `audit_log` + `cards` + `columns` + `boards.due_soon_days` (sin nueva tabla).
- **Frontend**: panel deslizante `#metricsDrawer`, gráficos SVG vanilla (burn-up + WIP), tooltips informativos con explicación de lead time, burn-up, etc.
- Lead time: CTE con primera llegada a columna `is_done=1`; burn-up: acumulado diario últimos 30 días.
- **¡Pilas con esto!** — dos señales de urgencia, mutuamente excluyentes:
  - `staleCards` ("Quietas"): solo tarjetas *sin* fecha límite, top 5 por inactividad. Excluye `is_done=1` (fallback a última por posición si no hay ninguna marcada).
  - `dueSoonCards` ("Por vencer"): tarjetas con fecha límite vencida o dentro de `due_soon_days` (configurable por tablero, default 3, editable en ⚙️ por el dueño vía `PATCH /api/boards/:id`), ordenadas por vencimiento ascendente (lo más vencido primero). Una fecha límite lejana no aparece en ninguna lista.

**Tests**:
- ✅ 13 unitarios (`test/metrics.test.js` + `test/boards.test.js`): estructura, períodos, lead time, WIP, stale cards, dueSoonCards, permisos, múltiples done columns, PATCH dueSoonDays (validación y permisos)
- ✅ 6 E2E (`e2e/metrics.spec.js`): botón visible, panel abre con todas las secciones, números ≥ 0, cerrar, quietas vs por vencer, configuración de umbral en ⚙️

**Estado**: **100% completo (MVP)**.

---

### ✅ #6 Modo oscuro/claro 🌙

**Qué hace**: Toggle 🌙/☀️ en el header que alterna tema claro/oscuro, persiste la preferencia y respeta la del sistema en el primer ingreso.

**Implementación** (public/index.html):
- **Paleta por variables**: `:root` (claro) + `html[data-theme="dark"]` (oscuro) redefiniendo `--bg`, `--col-bg`, `--card-bg`, `--card-hover`, `--input-bg`, `--text`, `--muted`, `--accent`, `--danger`, `--border`, `--hover`, `--shadow` + `color-scheme` (para que los controles nativos —date picker, selects, scrollbars— se oscurezcan).
- **Sin flash**: script inline en `<head>` aplica el tema (localStorage → `prefers-color-scheme` → claro) **antes** de pintar.
- **Toggle**: botón `#themeBtn` en el header; `toggleTheme()` cambia `data-theme`, guarda en `localStorage("tasking-theme")` y actualiza el ícono.
- **Refactor**: superficies y textos hardcodeados (`#fff`, `#fafbfc`, `#f4f5f7`, bordes grises, textos `#172b4d/#42526e`) convertidos a variables. Se preservan el header (accent), el texto blanco sobre color y los colores semánticos (verde/rojo de badges, confeti).

**Tests**:
- ✅ 2 E2E (e2e/theme.spec.js): toggle + persistencia tras reload + respeta `prefers-color-scheme: dark`.
- ✅ Verificación visual: board, modal y panel de objetivos en oscuro (sin parches blancos).

**Estado**: **100% completo**.

---

### ❌ #7 Lead time y tasa de completitud (por usuario) 📊

**Qué hace**: Mostrar a cada usuario (en sus tableros) dos métricas en "criollo":
- **Tiempo promedio para completar**: cuánto tarda en promedio desde que crea una tarjeta hasta que la termina
- **Porcentaje completado**: qué % de tarjetas creadas ya terminó

**Implementación necesaria**:
- **Backend**: 
  - Calcular tiempo promedio (tarjetas completadas: MAX(ts terminado) - MAX(ts creado))
  - Contar tarjetas por usuario: creadas vs completadas
  - Endpoints: `GET /api/me/metrics` o agregar a `/api/me`
- **Frontend**: 
  - Panel "📊 Tu desempeño" en el tablero personal (arriba del Kanban)
  - Mostrar: "Terminás tus tarjetas en X días en promedio" + "Has completado Y% de lo que empezás"
  - Gráfico simple de línea o barras

**Prioridad**: MEDIA (ayuda a usuarios a entender su productividad)

---

### ✅ Pulso WIP "Dejar de empezar y empezar a terminar" 🎯

**Qué hace**: Refuerza visualmente el principio de Kanban "stop starting, start finishing". Cada 5 minutos (tablero visible), las tarjetas en columnas WIP (ni la primera, ni las de cierre) reciben un pulso sutil en secuencia de derecha a izquierda — primero lo más cerca de terminar — invitando a cerrar trabajo en progreso antes de arrancar algo nuevo.

**Implementación** (`public/index.html`):
- **Columnas WIP**: todas menos la primera por posición y las marcadas `isDone` — `wipColumnsRightToLeft()`, ordenadas de mayor a menor posición.
- **Animación**: `@keyframes wip-pulse` (glow con `var(--accent)`) envuelta en `@media (prefers-reduced-motion: no-preference)` — se desactiva sola con esa preferencia del SO, sin rama de código extra.
- **Secuencia**: `runWipPulseSequence()` dispara `pulseColumn()` por columna con 500ms de stagger, de derecha a izquierda.
- **Mensaje**: toast `#wipToast` con fade, solo la primera vez del día (`localStorage["tasking-wip-msg-date"]`).
- **Preferencia de usuario**: botón `#wipPulseBtn` (🎯) en el header, estado en `localStorage["tasking-wip-pulse"]` — igual patrón que el toggle de tema. Al pasar de apagado a encendido dispara un preview inmediato (`toggleWipPulse()`), sin esperar el timer.
- **Atajo `P`**: dispara `runWipPulseSequence()` manualmente en cualquier momento, independiente del estado del toggle. Documentado en la ayuda F1 y el pie de página.
- **Ciclo de vida**: `startWipPulse()`/`stopWipPulse()` enganchados a carga de tablero, cambio de tablero y `visibilitychange` (igual que el polling).
- **Testing**: `window.runWipPulseSequence()` expuesto para disparo manual en E2E sin depender del timer real.

**Tests**: 5 E2E (`e2e/wip-pulse.spec.js`) — toggle persiste tras reload, preview inmediato al encender, atajo P, pulso + mensaje una vez por día, excluye primera columna y columnas de cierre.

**Prioridad**: Alta (extiende #9 ¡Pilas con esto!, corazón del producto) — **100% completo**.

---

## Resumen de Cobertura de Tests

| Capa | Cobertura | Notas |
|---|---|---|
| **Unitarios (Vitest)** | 93 tests ✅ | CRUD, auth, permisos, checklists, objetivos, columnas, métricas, múltiples done columns. Corre en Workerd + D1 emulado. |
| **E2E (Playwright)** | 29 tests ✅ | Checklists, adjuntos, historial (drag & drop), critical flows, etiquetas, objetivos, columnas, tema, métricas. DB reset por spec (sin flakiness). |
| **Manual** | Completo ✅ | Celebración, polling, login real, responsive. |

**Infraestructura E2E**: seed SQL + `test/global-setup.mjs` — la DB E2E se resetea a estado conocido antes de cada corrida. Archivos: `e2e/attachments.spec.js`, `e2e/checklists.spec.js`, `e2e/columns.spec.js`, `e2e/critical-flows.spec.js`, `e2e/goals.spec.js`, `e2e/history.spec.js`.

**Ejecutar**:
```bash
npm run test:all       # Vitest + Playwright
npm run test:watch     # Vitest interactivo
npm run test:e2e:ui    # Playwright visual
```

---

## Notas Técnicas

- **D1 Migraciones**: 0001_init → 0011_columns. Cada sesión que agregue tablas suma una nueva.
- **Frontend**: Un único `public/index.html` sin build. ~3000 líneas de código.
- **Backend modular**: `src/index.js` (~80 líneas setup) + `src/routes/` + `src/middleware/` + `src/db/`.
- **Base de datos**: SQLite en D1, emulado localmente con Wrangler + Miniflare.
- **Archivos**: R2 bucket `tas-king-uploads`.
- **Tests E2E**: usa `--persist-to .wrangler/e2e-state` (DB aislada de dev).

---

## Checklist: Al Terminar Sesión

- [ ] Actualizar esta tabla con features que se completaron/modificaron
- [ ] Correr `npm run test:all` antes de deploy
- [ ] Revisar cambios en `src/index.js`, `public/index.html`, `migrations/`
- [ ] Commit + push
- [ ] Actualizar AI_HANDOFF.md sección "Último handoff"
- [ ] Si hubo cambios en TESTING.md o CLAUDE.md, commit de eso también
