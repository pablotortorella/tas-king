# ADR-016: revisión persistente para sincronizar tarjetas y sus recursos

**Fecha:** 2026-09-15. **Estado:** implementado en `fix/board-sync`.

## Problema

El polling comparaba `MAX(cards.updated_at)` con `>`. Comentarios y checklists no
modificaban esa fecha; borrar una tarjeta antigua dejaba el máximo intacto y borrar
la más reciente podía reducirlo. Dos escrituras en el mismo milisegundo también
podían ser indistinguibles. Cambiar solamente `>` por `!==` no cubre esos casos.

## Decisión

- Agregar `boards.sync_version` con migración 0015. Es una revisión numérica opaca,
  no una fecha. Se inicializa con el máximo anterior por tablero. Los triggers de
  tarjetas incrementan la revisión y conservan al menos `NEW.updated_at`, para que
  clientes anteriores que comparan con `>` sigan detectando escrituras al desplegar.
- Triggers de INSERT/UPDATE/DELETE sobre `cards`, `comments`, `checklists` y
  `checklist_items` actualizan el tablero en la misma transacción. Las cascadas
  quedan cubiertas por el trigger del padre cuando el hijo ya no puede resolverlo.
  Un fallo revierte también la revisión. No se modifican las fechas de las tarjetas
  al comentar o marcar ítems, para no alterar las métricas existentes.
- `/version` consulta una fila por PK, conservando el presupuesto de seis llamadas
  D1 de la petición autenticada. No se añaden viajes de red a las mutaciones; sí una
  actualización interna del contador por fila afectada (más las cascadas).
- `getBoard()` obtiene revisión y sus ocho colecciones en un `db.batch()` de
  lectura: una llamada, nueve sentencias y una instantánea consistente. Leer la
  versión aparte podría asociar datos antiguos con una revisión nueva y ocultar cambios.
- El frontend reconcilia por desigualdad. Mantiene la pausa durante arrastres y
  guardados y el descarte de respuestas anteriores. En el modal actualiza comentarios
  y checklists sin reabrirlo ni reemplazar título, detalles o comentario en borrador.
  Si el foco está en un checklist, difiere su reconstrucción hasta otro poll;
  preserva los inputs para agregar ítems de las listas que siguen existiendo.
- El dump automático incluye los triggers después de insertar los datos. De otro
  modo, restaurar las tablas eliminaría las reglas de sincronización.

## Alternativas

- **Tocar `updated_at` y comparar por desigualdad:** no detecta todos los borrados,
  colisiones de reloj ni cambios en tarjetas con fechas inferiores al máximo.
- **Máximo más cantidad de tarjetas:** detecta más borrados, pero puede repetir el
  mismo valor con creaciones/borrados entre polls y mantiene los problemas del reloj.
- **Incrementar desde cada handler:** obliga a recordar cada ruta, importación y
  cascada; una escritura nueva podría persistir sin invalidar el tablero.
- **WebSockets/Durable Objects:** no hacen falta para corregir la señal de cambio.
  Se conserva el polling de cinco segundos.

## Límites y despliegue

El alcance es tarjetas, comentarios y checklists. Los recursos que ya tocan la
tarjeta (por ejemplo, asignar etiquetas) también disparan su trigger. No se amplía
la sincronización a perfiles, configuración de tablero o catálogos sin tarjetas.
Esta revisión no resuelve conflictos de edición simultánea del mismo campo.

Aplicar **0015 antes del Worker nuevo**, en staging y luego en producción aprobada.
Los scripts actuales despliegan antes de migrar: ejecutar primero el comando de
migración del entorno; después, el deploy habitual. La migración es aditiva y
compatible con el Worker anterior. Ante rollback del Worker, conservar la columna
y los triggers. No reconstruir ni borrar datos.

## Evidencia

- 16 regresiones iniciales: 12 fallaron sobre el código anterior; todas pasan con
  la corrección (incluyen contenido, borrados, reloj fijo, permisos y rollback).
- Regresión adicional del backup: falló al no exportar triggers; pasa al restaurar
  el trigger exportado y verificar una nueva escritura.
- Presupuestos de polling y lectura transaccional en `test/backend-performance.test.js`.
- Cinco recorridos de navegador en `e2e/board-sync.spec.js`, con escrituras bajo
  otra identidad y polling real de la app disparado explícitamente.
- Migración comprobada sobre esquema anterior con datos: conserva el máximo previo,
  acepta escrituras del Worker anterior y detecta el borrado de la última tarjeta.

Referencia: [transacciones y resultados de D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
