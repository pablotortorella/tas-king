## Context

El historial puede tener cientos de movimientos por libro. Hay dos orígenes (propio
e importado) que comparten tabla. La búsqueda debe ser inmediata en móvil y no
disparar consultas por resultado (`docs/PERFORMANCE-PRACTICES.md`).

## Goals / Non-Goals

**Goals:** un solo campo, resultado explicado, una o dos consultas por página,
mismo comportamiento para propios e importados.

**Non-goals:** los de `proposal.md`.

## Decisions

### D1. Texto normalizado escrito junto con el movimiento

`ledger_entries.search_text` guarda descripción, nota y categoría de origen sin
mayúsculas, acentos ni puntuación. Se escribe en el mismo `db.batch()` que el
movimiento y sus revisiones, y se recalcula al corregir. Los nombres de
participantes no se copian: se resuelven con un join para que renombrar a una
persona no obligue a reindexar movimientos.

### D2. Montos con índice propio

Un token numérico de la consulta se interpreta como importe y se busca por igualdad
con el total del movimiento y con el valor absoluto del efecto de cualquier
participante. Se normalizan separadores: punto como miles y coma como decimal
(convención de la persona usuaria actual); el comportamiento ante otras
convenciones queda en Open Questions.

### D3. Términos combinados con Y

Cada término de la consulta debe coincidir en algún campo; el resultado agrega una
explicación por término. La explicación se calcula en el servidor, no en el cliente.

### D4. Consulta y paginación

Una consulta devuelve una página ordenada por fecha descendente con cursor
`(fecha, id)`, más el conteo total filtrado. Índice
`(ledger_id, occurred_on DESC, id DESC)`. Un resultado no dispara consultas
adicionales: participantes y motivos vienen del mismo conjunto.

### D5. Texto: LIKE ahora, FTS si se mide necesario

Para los volúmenes esperados de un hogar se empieza con búsqueda por subcadena
sobre `search_text`. Si una medición muestra que no alcanza, se evalúa FTS5. Que D1
ofrezca FTS5 no se verificó en esta sesión.

## Risks / Trade-offs

- La subcadena sobre texto normalizado no ordena por relevancia; se acepta por
  predictibilidad.
- Un monto de pocos dígitos (por ejemplo «20») coincide con muchos efectos; la
  explicación de la coincidencia reduce la confusión.

## Migration Plan

Columna aditiva con relleno para los movimientos existentes (propios e
importados). Reversible dejando de usar la columna.

## Open Questions

1. ¿Los movimientos anulados aparecen en la búsqueda? Se propone mostrarlos,
   rotulados, sólo cuando la consulta no está vacía.
2. Convención numérica de entrada (punto/coma) y cómo interpretar «1.500».
3. ¿La categoría de origen se busca o se oculta hasta que HomeSuite tenga categorías?
4. Tamaño de página y política de «Ver los N resultados anteriores» en escritorio.
