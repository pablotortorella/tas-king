# Medición de latencia en producción — 2026-09-11

Se midió el Worker `tas-king` mientras Pablo creó una tarjeta de prueba, asignó y quitó etiquetas tres veces y guardó la tarjeta nuevamente. La secuencia de creación tardó aproximadamente 2,10 s; las asignaciones, 1,93–2,02 s. Las tres recargas posteriores a cada escritura explican alrededor de 1,45–1,49 s de esas secuencias.

## Método y alcance

- Captura mediante `wrangler tail tas-king --format json`, con Wrangler 4.104.0, sin despliegues ni cambios de configuración.
- Ventana registrada: 08:32:05–08:33:35, America/Bogota (13:32:05–13:33:35 UTC).
- 50 peticiones registradas, todas HTTP 200. Campo `cf.colo`: MIA. Ese campo identifica el punto de entrada reportado por Cloudflare; no determina la ubicación de D1.
- `latency` es el tiempo medido por el middleware de logging: incluye autenticación y operaciones del endpoint. No incluye todo el recorrido navegador-servidor ni el renderizado del navegador.
- También se capturaron `cpuTime` y `wallTime` de los eventos de Cloudflare. Los valores de CPU de la tabla son medianas por endpoint y corresponden a la invocación del Worker.
- Se conservaron únicamente fecha, ruta, método, estado, tiempos y colo en el registro temporal; se descartaron cabeceras, cookies y datos de usuario de la salida de tail.
- Muestra exploratoria de una sesión y un tablero. No permite estimar un p95 representativo ni el comportamiento con otros tamaños de tablero o ubicaciones.

## Resultados por petición

| Operación | Muestras | Mediana servidor | Mín.–máx. servidor | Mediana CPU |
|---|---:|---:|---:|---:|
| Crear tarjeta | 1 | 614 ms | 614 ms | 8 ms |
| Guardar tarjeta existente | 1 | 509 ms | 509 ms | 5 ms |
| Asignar etiqueta | 3 | 479 ms | 472–569 ms | 4 ms |
| Quitar etiqueta | 3 | 383 ms | 380–390 ms | 3 ms |
| Recargar tarjetas | 8 | 374,5 ms | 362–419 ms | 5 ms |
| Recargar catálogo de etiquetas | 8 | 357 ms | 353–365 ms | 3 ms |
| Recargar objetivos | 8 | 444 ms | 440–453 ms | 4 ms |
| Consultar versión del tablero | 19 | 360 ms | 353–421 ms | 3 ms |
| Consultar historial de tarjeta | 1 | 412 ms | 412 ms | 4 ms |

## Secuencias de escritura y recarga

Cada escritura de esta tabla fue seguida por GET de tarjetas, GET de etiquetas y GET de objetivos, en ese orden. La asociación se reconstruyó por orden temporal, endpoint y flujo del código; no existe un identificador de interacción compartido entre peticiones.

La duración de secuencia se calcula como `timestamp del último log − timestamp del log de escritura + latency de escritura`. Abarca desde el inicio del middleware de la escritura hasta el log final de objetivos, incluyendo los intervalos entre peticiones. Excluye el viaje inicial desde el navegador, la entrega de la última respuesta y el renderizado final; no equivale a una medición de clic a pantalla actualizada.

| Acción | Escritura en servidor | Suma servidor de las tres recargas | Secuencia observada |
|---|---:|---:|---:|
| Crear tarjeta | 614 ms | 1173 ms | 2099 ms |
| Asignar etiqueta 1 | 472 ms | 1219 ms | 1966 ms |
| Quitar etiqueta 1 | 390 ms | 1184 ms | 1878 ms |
| Asignar etiqueta 2 | 479 ms | 1175 ms | 1929 ms |
| Quitar etiqueta 2 | 383 ms | 1169 ms | 1812 ms |
| Asignar etiqueta 3 | 569 ms | 1173 ms | 2021 ms |
| Quitar etiqueta 3 | 380 ms | 1176 ms | 1826 ms |

## Interpretación y prioridades

1. **Eliminar recargas completas tras mutaciones pequeñas.** La escritura finaliza mucho antes que la secuencia. Las recargas posteriores consumen 1429–1494 ms adicionales en esta muestra. Actualizar el estado local con la respuesta del servidor evitaría ese tramo obligatorio; la mejora exacta debe validarse después del cambio. El catálogo de etiquetas y los objetivos no necesitan recargarse al asignar una etiqueta existente.
2. **Reducir trabajo repetido del middleware.** Incluso consultar la versión cuesta una mediana de 360 ms con 3 ms de CPU. La diferencia apunta a esperas de I/O; el código hace varias operaciones D1 consecutivas por petición. Sin trazas por consulta no se puede separar ejecución SQL, viajes Worker-D1 y otras esperas. Revisar inicialización de usuario y rol en cada petición, preservando permisos y revocación inmediata.
3. **Coordinar la sincronización con las mutaciones.** Se observaron consultas de versión intercaladas con las recargas de las acciones. No se observó una recarga completa duplicada atribuible al polling en esta muestra. Evitar solapamientos sigue siendo una mejora preventiva, no una causa demostrada aquí.
4. **Medir el navegador en la validación posterior.** Registrar desde el clic hasta la actualización visible, además de los tiempos del Worker. Para discriminar el coste de D1, añadir mediciones por etapa y por consulta en un cambio separado.

La CPU del Worker fue baja. Esta captura no mide CPU del navegador, tamaño de respuestas autenticadas ni renderizado, y por eso no descarta problemas de frontend en tableros grandes.

## Referencias

- Frontend: `public/index.html`, funciones `loadCards`, `assignLabel`, `removeLabel` y manejador de `saveBtn`.
- Backend: `src/middleware/auth.js`, `src/middleware/logging.js`, `src/db/helpers.js`, `src/db/queries.js`.
- [Cloudflare: logs en tiempo real](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/).
- [Cloudflare: comando tail](https://developers.cloudflare.com/workers/wrangler/commands/workers/#tail).

La captura se cerró al terminar. No se modificó código de producto ni se desplegaron cambios.

## Primera mejora implementada y desplegada

Después de la medición se modificó el frontend para quitar las recargas de tarjetas, etiquetas y objetivos del flujo de guardado:

- Crear o editar una tarjeta sin cambios en adjuntos, checklists u objetivos usa únicamente la petición de escritura y su respuesta.
- Asignar o quitar una etiqueta existente usa únicamente la petición de escritura. El estado local cambia después de la confirmación; ante un error se conserva la selección anterior.
- Crear una etiqueta desde una tarjeta actualiza también el catálogo local, de modo que se puede reutilizar sin descargarlo otra vez.
- Si el guardado agrega o elimina recursos relacionados, se relee únicamente esa tarjeta al terminar. Se mantienen las peticiones de escritura existentes de esos recursos; agrupar checklists queda para otra mejora.
- El progreso de objetivos se recalcula desde las tarjetas cargadas con el mismo criterio de columna de cierre que el endpoint actual.
- El polling no se solapa consigo mismo ni con las escrituras de estos flujos. Las respuestas anteriores a una mutación se descartan y una carga solicitada durante la escritura se atiende al finalizar.
- Se conserva la versión de la última lectura del tablero completo: el siguiente poll puede reconciliar en segundo plano los cambios propios y los de otras personas. La reducción de cuatro peticiones a una corresponde al flujo inmediato, no a todo el tráfico posterior de sincronización.
- El renderizado del tablero sigue usando `render()`; esta fase reduce peticiones y modifica el estado de la tarjeta afectada, sin introducir un renderizador incremental.

Las pruebas de regresión están en `e2e/card-mutation-performance.spec.js`: verifican ausencia de recargas globales, persistencia, errores y reintentos, recursos relacionados, progreso, respuestas antiguas, doble clic, polling y cambio de tablero durante una escritura. La primera prueba falló antes del cambio al detectar las seis lecturas extra de crear y editar.

La mejora se incluyó en v2.2.0 y está desplegada en producción. Por construcción elimina el tramo de tres lecturas que sumaba aproximadamente 1,4–1,5 s en la medición original, pero todavía falta medir el tiempo real posterior al cambio.

Validación previa al deploy: `npm run test:all` pasó con 125 pruebas de backend y 56 de navegador, incluidas nueve pruebas nuevas de regresión. La versión final v2.2.0 pasó 139 pruebas de backend y 62 de navegador y fue desplegada y verificada.

## Seguimiento del 14 de septiembre

Se completaron tres rondas en producción y se confirmó que las lecturas globales se ejecutan
por polling fuera del guardado inmediato. Ver [resultados y limitaciones](PERFORMANCE-2026-09-14.md).
La medición de clic a pantalla quedó pendiente. Se acordó aplicar primero patrones redundantes
demostrados en código, con regresiones automáticas; no exigir más rondas para iniciar ese trabajo.

## Pendientes registrados originalmente para el siguiente ciclo

1. Repetir la secuencia en producción con al menos cinco muestras por acción y confirmar que crear/editar tarjetas y asignar/quitar etiquetas ya no disparan las tres lecturas globales.
2. Medir desde el clic hasta la actualización visible en el navegador. La captura original no incluyó red del cliente, CPU del navegador ni renderizado.
3. Si las escrituras continúan alrededor de 400–600 ms, agregar tiempos por etapa para rate limiting, autenticación/revocación, `ensureUser`, `seedAdminIfNeeded` y handler. Optimizar solo después de localizar la espera D1.
4. Medir tableros grandes antes de reemplazar el `render()` completo por actualizaciones incrementales.
5. Medir por separado guardados con adjuntos, checklists y objetivos antes de agrupar sus escrituras o eliminar la relectura puntual de la tarjeta.

El backlog canónico y la prioridad de estos pasos viven en `docs/PRODUCT_BACKLOG.md`.
