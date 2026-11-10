# Evidencia de la migración de TasKing

Fecha local: 2026-11-09. Rama `feature/migrar-tasking-homesuite`, worktree
`/tmp/tasking-homesuite-proposal`, sobre `65a1b53` (PWA integrada).
Implementación en revisión; **sin despliegue, traslado remoto ni aceptación**.
[Runbook y recursos](MIGRACION-HOMESUITE.md).

## Comprobaciones locales

| Comando / ensayo | Resultado |
|---|---|
| `npm test` | 235 pruebas, incluidas admisión/drenaje de peticiones y bloqueo del origen congelado |
| `npm run test:homesuite-app` | 722 pruebas; instalación limpia y actualización con libro financiero poblado, unicidad y contratos de PWA |
| `npm run test:homesuite-app:integration` | 389 pruebas D1/R2; identidad, perfil/salida, CSRF, permisos/revocación, copia/reintento/conciliación, límites reales de archivo |
| `npm run test:homesuite-site` | 44 pruebas |
| `npm run test:e2e` | 101 recorridos originales más un caso dirigido de mudanza aprobados (102 casos cubiertos) |
| `npm run test:e2e:tasking` | 79 de 79 aprobados en corrida completa Chromium; incluye PWA instalada antes de entrar a Tareas y vuelta sin conexión |
| `TASKING_BROWSER=firefox npm run test:e2e:tasking` | 77 aprobados y 2 omisiones declaradas por límites de emulación del motor (tema oscuro con COOP y red del SW), sin fallos |
| `npm run test:homesuite-site:e2e` | 20 recorridos aprobados con el enlace a `/tareas` |
| `npm run test:e2e:homesuite-app`, puerto 8799 / estado `tasking-platform-e2e` | 196 de 198 inicialmente; apagado PWA y teclado de clasificación aprobados en corrida dirigida aislada (198 casos cubiertos), ver abajo |
| `npm run verify:tasking-assets` | 28 assets inventariados; SVG de corona idéntico al original y al del puente |
| Builds `wrangler deploy --dry-run` app/puente staging | Correctos; app 684,60 KiB y puente 6,29 KiB; puente con una única variable de destino y sin bindings de datos |
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
comprueba que bytes corruptos impiden activar. El fixture con cuenta HomeSuite
creada después recupera el personal importado y su ID.

La versión instalada de Wrangler no acepta `--persist-to` en `d1 export --local`:
para el ensayo se exportó exclusivamente la SQLite sintética de ese directorio.
Se recopilaron los archivos contra ese SQL, se verificaron checksums y se restauró
SQL en otra SQLite y el archivo en otro R2 local (`restored-r2`). `cmp` confirmó
bytes idénticos. La fase de recuperación tardó **5 segundos**; entre el inicio de carga y la
activación transcurrieron **203 segundos** (timestamps persistidos del lote),
incluidos verificación y segundo intento, por el arranque de Wrangler por lote. No usar ese tiempo
como ventana ni RTO de producción: falta medir el volumen de staging.

## Incidencias y límites

- CI detectó dos frases legítimas del tip y del historial:
  «espacio para imprevistos» y «espacio de almacenamiento». Se permiten
  esas frases concretas, con motivo y regresión, manteniendo prohibido el antiguo
  nombre del grupo. El scanner sólo ve archivos versionados; por eso apareció en
  CI después de incorporar las copias nuevas al commit.
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
- No disponibles: dos sesiones Google reales, iPhone/Safari y dispositivo móvil
  físico. Las sesiones firmadas y autoridades sintéticas de test no los sustituyen.

## Preparación remota pendiente

Consulta de sólo lectura: app de staging en `9e4c4a4`, versión `1a2f3bfc`, ocupada
por revisión PWA. Origen de staging: versión `93d38468` (`69e220a`). Se preservaron.
Existen buckets `tas-king-uploads`, `tas-king-uploads-staging` y
`homesuite-app-backups`; no se crearon los nuevos. No se aplicaron migraciones remotas.

Pendientes antes de producción: coordinar staging; revisar SHA final integrado;
crear/verificar buckets y permiso del backup diario; ensayar Google con dos cuentas;
completar matriz remota de aliases/previews/versions/crons; desplegar puente y sitio
en el orden del runbook; obtener aprobación explícita de la publicación concreta.
No se han retirado datos/infraestructura antiguos ni se da por cerrada la migración.
