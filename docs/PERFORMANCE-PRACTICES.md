# Criterio de performance

La velocidad es parte de la calidad funcional de TasKing. Una operación simple que bloquea
la interfaz durante segundos requiere corrección, aunque responda HTTP 200 y pase sus tests.
Este criterio se aplica al diseñar, implementar y revisar cambios de frontend y backend.

## 1. Resolver primero el trabajo innecesario que muestra el código

No hace falta una campaña de medición para eliminar una validación duplicada, una descarga
innecesaria o una consulta por elemento de una colección. Para esos casos:

1. Identificar la operación repetida y sus dependencias.
2. Escribir una regresión que limite peticiones/llamadas o compruebe que el costo no crece
   con la colección; ejecutar SQL real en D1 local cuando corresponda.
3. Aplicar el cambio conservando resultados, errores, orden y permisos.
4. Correr los checks afectados y la suite completa antes de integrar.
5. Usar una comprobación breve posterior para cuantificar el efecto real en producción.

Instrumentar etapas cuando no esté claro dónde se pierde tiempo, existan alternativas con
costos distintos o una demora persista después de quitar trabajo evitable. No convertir
la medición manual repetida en requisito previo para aplicar un patrón demostrado en código.

## 2. Patrones que deben cumplir los cambios

### Backend y D1

- **Agrupar llamadas compatibles** con `db.batch()` cuando sus parámetros ya se conocen.
  D1 ejecuta las sentencias en orden dentro de una transacción; no es SQL paralelo. Revisar
  dependencias y el efecto del rollback antes de agrupar. Contar por separado llamadas al
  binding y sentencias SQL: una llamada batch puede contener varias sentencias.
- **Evitar consultas dentro de bucles de entidades (N+1)**. Consultar la colección necesaria
  mediante JOIN/subconsulta y agrupar por identificador en memoria. Restringir siempre por
  tarjeta/tablero autorizado y conservar orden y colecciones vacías. Evitar un `IN` con un
  parámetro por entidad cuando una subconsulta resuelve la relación.
- **Reutilizar resultados dentro de la misma petición**, incluida la identidad ya verificada.
  No volver a validar la cookie ni leer el mismo registro si el resultado sigue siendo válido
  y no hubo una escritura intermedia que lo invalide.
- **Separar el caso habitual de la inicialización**. Preparar un usuario existente debe tener
  un costo acotado; crear su tablero y columnas es trabajo condicional. La agrupación reduce
  viajes, pero no elimina por sí misma las sentencias de inicialización de cada petición.
- **Auditar dependencias de cada `await`**. Usar concurrencia solo para operaciones realmente
  independientes. No paralelizar comprobación de permisos y escrituras protegidas.
- **Acotar datos e índices**. Seleccionar filas del recurso solicitado; revisar filtros,
  JOIN y ORDER BY al introducir consultas nuevas. Usar EXPLAIN QUERY PLAN cuando haya dudas
  sobre un escaneo costoso. Agregar índices por necesidad demostrable, considerando escrituras.
- **Sacar del camino de respuesta solo trabajo no obligatorio**. Usar `waitUntil`/colas para
  tareas que toleren terminar después. La persistencia prometida al usuario, la auditoría
  requerida y los controles de acceso no se descartan para hacer bajar un número.

### Frontend y sincronización

- Una mutación pequeña debe actualizar la entidad afectada desde la respuesta confirmada;
  no recargar todo el tablero, el catálogo de etiquetas y los objetivos para poder terminar.
- Una respuesta suficiente evita lecturas posteriores. Si hay recursos relacionados escritos
  después, releer solo la entidad necesaria hasta que haya una alternativa consistente.
- Coordinar polling y escrituras: evitar ticks superpuestos, descartar respuestas viejas y
  conservar la reconciliación de cambios ajenos. Distinguir tráfico inmediato y de fondo.
- Mostrar estado de operación en curso y evitar doble envío. Conservar el borrador y permitir
  reintentos ante errores; una mejora de latencia no puede simular persistencia inexistente.
- No introducir render incremental, virtualización o cachés complejas sin evidencia del
  cuello de botella y pruebas de invalidación/consistencia.

### Permisos y consistencia

- La revocación y la membresía se comprueban contra estado vigente. No cachear permisos entre
  peticiones para ahorrar D1 sin un mecanismo explícito que mantenga su vigencia.
- El bypass de desarrollo sigue restringido a localhost. Una cookie revocada no puede caer al
  usuario de desarrollo para conseguir acceso.
- Mantener el comportamiento de roles configurados y de usuarios ya existentes, incluidos
  perfiles editados, invitaciones y cuentas todavía sin tablero personal.

## 3. Presupuestos comprobables de este proyecto

Estos son presupuestos estructurales, no promesas de milisegundos en producción.

| Flujo | Criterio de regresión |
|---|---|
| Preparar usuario existente, con o sin rol admin configurado | Una llamada D1 (`batch`) en `ensureUser`; no incluye rate limiting, revocación ni handler. |
| Autenticar una petición con cookie | Una verificación de firma; revocación vigente comprobada. |
| GET de versión con usuario/tablero existentes y cookie permitida | Seis llamadas D1 en total: límite, registro, revocación, preparación, membresía y versión. |
| Obtener tarjeta sin checklists | Ninguna consulta de ítems. |
| Obtener tarjeta con uno o varios checklists | Una consulta de ítems; llamadas independientes del número de checklists. |
| Crear/editar tarjeta simple y cambiar etiqueta existente | Una escritura en el flujo inmediato, sin las tres lecturas globales. |

Los tests de backend están en `test/backend-performance.test.js` y los del navegador en
`e2e/card-mutation-performance.spec.js`. Cambiar un presupuesto requiere explicar el costo
nuevo, su necesidad y cómo se verificó; no basta con aumentar el número esperado del test.

## 4. Objetivos de experiencia y medición proporcionada

Objetivos internos de diseño, no SLA ni métricas ya alcanzadas: feedback de operación en curso
inmediato; una acción simple debería verse confirmada en alrededor de un segundo o menos en
el entorno habitual. Esperas repetidas por encima de dos segundos merecen prioridad alta.
La red, el dispositivo y el tamaño del tablero deben acompañar cualquier resultado.

No confundir:

- **Servidor**: lo que mide el middleware; incluye esperas de I/O.
- **CPU**: trabajo de cómputo del Worker, no toda la duración de la petición.
- **Petición en navegador**: envío a final de respuesta; todavía falta aplicar/pintar el cambio.
- **Acción visible**: clic/Enter hasta la confirmación en pantalla. INP por sí solo no mide
  toda una operación asíncrona que espera red.

Para una comprobación exploratoria, unas pocas muestras por acción y el conteo de llamadas
pueden bastar para decidir. Agregar muestras solo si pueden cambiar la decisión. Una muestra
pequeña no permite afirmar p95 ni mejoras porcentuales generalizables. Registrar anomalías,
no descartarlas para embellecer el promedio. Automatizar repeticiones que no requieran juicio
humano. Guardar el informe y distinguir resultados medidos de ahorros esperados.

## 5. Revisión antes de integrar

- ¿Qué peticiones, llamadas D1 y sentencias necesita el caso habitual?
- ¿El costo crece con tarjetas/checklists/ítems? ¿Hay consultas evitables en bucles?
- ¿Qué trabajo bloquea la confirmación y qué corre después?
- ¿Se mantienen autorización, revocación, aislamiento, orden, errores y persistencia?
- ¿Existe una regresión para el costo estructural y para el resultado funcional?
- ¿Qué ahorro se demostró y qué latencia todavía falta medir?

Si aparece trabajo evitable sin resolver, corregirlo antes de integrar o documentar la razón
concreta de la excepción y su seguimiento. No aceptar solamente «HTTP 200» como evidencia de
una interacción satisfactoria.

## Referencias

- [D1 batch: viajes, orden y transacciones](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
- [CPU y tiempo de espera en Workers](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).
- [Línea base y primera mejora](PERFORMANCE-2026-09-11.md).
- [Comprobación posterior de tres rondas](PERFORMANCE-2026-09-14.md).
