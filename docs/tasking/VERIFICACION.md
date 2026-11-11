# Evidencia de la migración de TasKing

Actualización: 2026-11-10. [PR #145](https://github.com/pablotortorella/tas-king/pull/145)
integrado en `main` y publicado en staging y producción, con el recorrido real de
producción aceptado por Pablo. El change conserva escenarios manuales pendientes;
**no está archivado**. Versiones, hashes,
copias y CI: [STATUS](../STATUS.md#tasking-en-homesuite--publicado-en-producción--2026-11-10).
[Runbook y recursos](MIGRACION-HOMESUITE.md).

## Comprobaciones locales

| Comando / ensayo | Resultado |
|---|---|
| `npm test` | 235 pruebas, incluidas admisión/drenaje de peticiones y bloqueo del origen congelado |
| `npm run test:homesuite-app` | 734 pruebas (733 unitarias y una de arquitectura del puente); instalación limpia y actualización con libro financiero poblado, unicidad y contratos de PWA |
| `npm run test:homesuite-app:integration` | 391 pruebas D1/R2; identidad, perfil/salida, CSRF, permisos/revocación, copia/reintento/conciliación, límites reales de archivo |
| `npm run test:homesuite-site` | 44 pruebas |
| `npm run test:e2e` | 101 recorridos originales más un caso dirigido de mudanza aprobados (102 casos cubiertos) |
| `npm run test:e2e:tasking` | 79 de 79 aprobados en corrida completa Chromium; incluye PWA instalada antes de entrar a Tareas y vuelta sin conexión |
| `TASKING_BROWSER=firefox npm run test:e2e:tasking` | 77 aprobados y 2 omisiones declaradas por límites de emulación del motor (tema oscuro con COOP y red del SW), sin fallos |
| `npm run test:e2e:remanso` | 37 recorridos aprobados; cabeceras de Tareas actualizadas al acceso autenticado |
| `npm run test:homesuite-site:e2e` | 20 recorridos aprobados con el enlace a `/tareas` |
| `npm run test:e2e:homesuite-app`, puerto 8799 / estado `tasking-platform-e2e` | 196 de 198 inicialmente; apagado PWA y teclado de clasificación aprobados en corrida dirigida aislada (198 casos cubiertos), ver abajo |
| `npm run verify:tasking-assets` | 28 assets inventariados; SVG de corona idéntico al original y al del puente |
| Builds `wrangler deploy --dry-run` app/puente staging | Correctos; puente con una única variable de destino y sin bindings de datos |
| `openspec validate migrar-tasking-homesuite --strict` | Válido; no archivado |

D1/R2 son recursos emulados propios. Los E2E de Tareas usan puertos 8816/8817 y
`.wrangler/tasking-e2e`; no comparten el puerto 8796 reservado por la prueba de
apagado de la PWA. Se verificaron teclado/foco, arrastre/táctil, cambios de columna,
comentarios/checklists entre dos contextos, borradores, filtros, adjuntos, paletas,
archivo, objetivos, métricas, tips, pantalla de 360 px y movimiento reducido.
La prueba CSP no registró violaciones ni errores de página; el payload HTML de
un título se mostró como texto. Las mutaciones mantienen el presupuesto de
recargas y el tablero conserva un batch consistente de nueve sentencias; la
lectura integrada con sesión existente está limitada a seis llamadas D1.

Subidas: 20 MiB aceptados; 20 MiB + 1 rechazados sin conservar el archivo parcial
anterior del mismo multipart. JSON sin `Content-Length` también queda acotado.
Cookies antiguas no autentican HomeSuite; revocar sesión/membresía corta el acceso
a archivos en la petición siguiente. Una cuenta externa sin autoridad Google no
reclama una identidad pendiente por coincidencia de email. Una sesión HomeSuite
previa sin prueba conservada vuelve a Google, conserva `?card` y recupera el
personal importado cuando Google acredita Workspace; un resultado negativo
muestra el contacto de Pablitux sin redirigir de nuevo.

## Ensayo operativo con datos sintéticos

Carpeta privada `/tmp/tasking-cli-complete-20261109`, fuera del repo/Dropbox.
CLI real de Wrangler sobre D1/R2 locales con migraciones originales 0001–0016 y
destino 0001–0013. Cobertura: las 14 tablas con filas, dos identidades (una invitada
sin HomeSuite), personal heredado, membresías, cinco columnas, tarjeta, comentario,
etiqueta, checklist/ítem marcado, objetivo, actividad y un archivo de 20 bytes.
Manifiesto SHA-256:
`39347a1f3e95f1b8d70a35b092c36082b4b99d9a00ccddb3d2a57dce27e5ff61`.

Se ejecutó drenaje → congelación → extracción → carga → verificación → segunda
carga del mismo lote → activación → marcado del origen. `abort` después de activar
fue rechazado. La prueba D1/R2 nativa también interrumpe una copia, la reanuda y
comprueba que bytes corruptos impiden activar. Se verifican además un aborto concurrente con activación y el rechazo de un
snapshot obsoleto después de reabrir/modificar el origen: nunca quedan dos
escritores. El cerrojo final se toma antes de habilitar destino.
El fixture con cuenta HomeSuite
creada después recupera el personal importado y su ID.

La versión instalada de Wrangler no acepta `--persist-to` en `d1 export --local`:
para el ensayo se exportó exclusivamente la SQLite sintética de ese directorio.
Se recopilaron los archivos contra ese SQL, se verificaron checksums y se restauró
SQL en otra SQLite y el archivo en otro R2 local (`restored-r2`). `cmp` confirmó
bytes idénticos. La fase de recuperación tardó **5 segundos**; entre el inicio de carga y la
activación transcurrieron **203 segundos** (timestamps persistidos del lote),
incluidos verificación y segundo intento, por el arranque de Wrangler por lote. No usar ese tiempo
como ventana ni RTO de producción: corresponde al fixture local, no al volumen real.

## Incidencias y límites

- CI detectó dos frases legítimas del tip y del historial:
  «espacio para imprevistos» y «espacio de almacenamiento». Se permiten
  esas frases concretas, con motivo y regresión, manteniendo prohibido el antiguo
  nombre del grupo. El scanner sólo ve archivos versionados; por eso apareció en
  CI después de incorporar las copias nuevas al commit.
- La suite de Remanso usaba la antigua pantalla pública `/tareas` como destino
  de salida. Ahora comprueba el redirect autenticado y cierra audio navegando al
  inicio público del mismo origen, sin seguir OAuth a Google ni consultar allí
  un `sessionStorage` distinto. Se conserva el comportamiento de Remanso.
- La primera corrida de regresión de backup esperaba 12 triggers. La migración
  agrega el cerrojo; ahora compara todos los triggers respaldables, preserva la
  aserción de 12 de sincronización y comprueba el de congelación.
- Firefox conservó caché pública sin Tareas privadas. Su `setOffline` dejó pasar
  los fetch del service worker en este entorno; la parte de navegación offline se
  declara omitida en ese motor. Chromium sí muestra «Sin conexión» sin tablero.
  La [documentación de emulación](https://playwright.dev/docs/emulation#offline)
  explica el alcance de la emulación; esto no acredita un ensayo de red física.
- La emulación oscura de Firefox 151 se pierde al navegar con COOP: un servidor
  con HTML vacío dio `matchMedia=true` sin COOP y `false` con la cabecera. Se omite
  sólo ese caso cuando el motor no emula la preferencia; no se modifica el tema
  del producto ni se relaja COOP. La preferencia oscura pasa en Chromium.
- El apagado PWA de la corrida amplia coincidió con el antiguo puerto de Tareas,
  8796. Se separaron puertos. La prueba de teclado de clasificación también falló
  en esa corrida; ambos casos pasaron después en ejecución dirigida aislada. No se tocó
  el comportamiento financiero para acomodar esta migración.
- Pablo confirmó dos cuentas Google reales en staging. Siguen pendientes los
  dispositivos físicos con PWA instalada, incluido iPhone/Safari, coordinados con
  Claude Code en el Handoff. La emulación automatizada no acredita esos dispositivos.

## Ensayo remoto en staging — 2026-11-10

Tras liberar Pablo el staging compartido se publicaron app, puente y sitio; los
buckets y migraciones necesarios del ambiente quedaron preparados. El inventario
inicial que preservó la revisión PWA es histórico y no representa el estado actual.

El origen quedó `moved`, el destino `active` y cero peticiones en vuelo. Se copiaron
y conciliaron 14 tablas, un tablero, 18 tarjetas y un archivo. Las 13 tablas
financieras conservaron su hash pre/post. Se restauraron SQL y bytes R2 desde el
backup y las copias finales quedaron en almacenamiento privado durable, fuera de
Dropbox. Los hashes y versiones exactos viven en [STATUS](../STATUS.md).

El CLI usa la API D1 con parámetros y batch para remoto: Wrangler 4.104 procesa
`d1 execute --file` como importación y no devuelve filas SELECT. Se probó rollback
transaccional real del batch. La suite unitaria incluye SELECT, parámetros en cuerpo,
fallos por sentencia, resolución inequívoca y errores sin contenido privado.

Comprobación remota del puente: 100 % de tráfico, sin D1/R2/ASSETS ni cron,
previews deshabilitados y dos URLs históricas en 404. Persisten cinco secretos
heredados. La API devuelve observabilidad `null`, Logpush deshabilitado y sin
consumidores tail tras desactivar logs y trazas. Callback sintético manual:
302 a `/#mudanza`, sin reenviar `code/state`. Coherencia: 29 comprobaciones aprobadas.
No se consultaron logs de usuarios para verificarlo.

Pablo confirmó el 2026-11-10 que el recorrido funciona con su cuenta Google:
entrada desde el aviso, tableros y salida/reingreso. Una consulta agregada confirmó
la identidad vinculada y el personal importado conservado sin duplicados.
CI completo aprobado sobre `b5383a4`. Pablo confirmó una segunda cuenta «OK en
staging» y autorizó producción con el candidato validado. No atribuir a esa segunda
confirmación pasos manuales específicos que no declaró. Invitación/revocación y
permisos cruzados tienen además cobertura D1/R2 y dos contextos de navegador.
El SHA final integrado, con árbol idéntico, fue publicado nuevamente en staging:
coherencia 29/29, sin volver a cargar ni reemplazar datos del ambiente.

## Corte de producción — 2026-11-10

Se respaldaron ambos extremos antes de migrar, restaurando SQL y adjuntos en
entornos aislados. Se aplicaron las migraciones aditivas, publicó la app con Tareas
cerrada y preparó el origen aún en `live`. Se deshabilitaron globalmente previews:
dos versiones históricas devolvieron 404 antes del drenaje. Drenaje y congelación
persistente precedieron al SQL final y snapshot; cero leases antes de copiar.

Las 14 tablas, 12 tableros, 101 tarjetas y cinco archivos fueron conciliados antes
de activar, con SHA-256 de cada archivo. Las 13 tablas financieras conservaron
exactamente su huella. `activate` cerró el origen en `moved`, comprobó de nuevo el
snapshot y activó sólo HomeSuite. La ventana hasta `active` duró 144 segundos.
Versiones, lote, hashes y copias durables: [STATUS](../STATUS.md).

El puente quedó al 100 %, sin bindings D1/R2/ASSETS, cron ni previews. Metadata y
probes sintéticos comprobaron aviso público firmado, botón único, API 410,
callback 302 local sin credenciales, favicon SVG idéntico y retorno a tarjeta/archivo
a través del login. La API remota reporta observabilidad `null`, Logpush apagado y
sin consumidores tail. No se consultaron logs de usuarios. SQL histórico y R2
original permanecen conservados, sin acceso desde el puente.

La primera coherencia inmediatamente posterior al deploy leyó la landing anterior
durante propagación del sitio; se comprobó el HTML actualizado antes de repetir.
El sitio y app pasaron **30/30** comprobaciones, incluidos enlaces sin staging.
El backup posterior se recuperó desde R2 y restauró con SQL y los cinco archivos.

Los cinco secretos heredados de cada puente se retiraron tras comprobar el inventario
y que el aviso no los usa; metadata/probes posteriores confirman puentes sin secretos
y sin reapertura de rutas. El backup diario de GitHub con su token real completó
exportación, lectura de los cinco archivos nuevos y restauración desde R2. Se ensayó
además la escritura/lectura de esos bytes en R2 exclusivamente local, hashes idénticos.

**Aceptación real de producción — 2026-11-10:** Pablo respondió «Sí, todo funciona»
a la comprobación solicitada del aviso antiguo, botón Ir a HomeSuite, Google habitual,
tableros, una edición, un adjunto y salida/reingreso. La confirmación corresponde a
las versiones de producción registradas en STATUS y completa el smoke real de 8.2.
No informó navegador ni dispositivo. Esta evidencia no acredita por sí sola pruebas
manuales de otras cuentas, invitación/revocación ni una instalación PWA física.
Las pruebas físicas PWA siguen en Handoff para Claude Code; el change no se archiva
mientras conserve los escenarios manuales abiertos.

## Continuidad y telemetría sintéticas posteriores al corte

Chromium aislado sobre producción comprobó aviso inicial, recarga con caché
caliente, expiración de cookies `session`/`oauth_state` sintéticas, navegación atrás
y recarga de un adjunto previamente visitado. Su botón conserva la descarga
protegida de HomeSuite. Al abortar en el navegador la navegación al destino,
el aviso del origen siguió disponible y su API rechazó una mutación con 410.
No se usaron cuentas ni archivos privados. Esto completa 6.10 junto con el ensayo
previo de pestaña antigua con borrador y parada de polling; no acredita un archivo
ya descargado (que no es revocable) ni un dispositivo físico.

Se abrió un tail temporal con filtro de cabecera única, exclusivamente para dos
peticiones propias sintéticas. Los mensajes de aplicación contenían sólo evento,
versión, ambiente, clase de ruta, método y estado: callback `oauth` 302 y `api` 410,
sin URL, query, credenciales o payload. El sobre de diagnóstico de Cloudflare sí
incluye URL y metadatos de la petición sintética: por eso se mantienen deshabilitados
logs/trazas persistentes, no se abre tail sin filtro y se cerró al terminar. No se
observó tráfico de usuarios. La simulación local de fallo de red al navegar a HomeSuite y la metadata remota
completan 6.11 sin reabrir el origen; no se provocó una caída del servicio remoto.

Las tareas 7.2–7.3 conservan los escenarios manuales no declarados en las
confirmaciones resumidas de staging, incluidos los de PWA física coordinados con
Claude. La autorización de producción aplicó a la evidencia disponible, sin
convertir esos límites en pruebas realizadas. El smoke real de producción está
confirmado; el change conserva esas tareas abiertas y no se archiva.
