## Why

El historial de Cuentas Claras mezcla movimientos creados en HomeSuite y
movimientos importados de Splitwise. Encontrar uno viejo no debe exigir saber de
dónde viene ni en qué lista está (HG-07). El MVP exige una única búsqueda libre por
nombre, monto o palabra, con la coincidencia explicada y el origen visible.

Referencia visual: lienzo «Cuentas Claras» de Claude Design, pantalla 5
(«Movimientos y búsqueda») y el panel de movimientos de la pantalla 9.

## What Changes

- Un campo de búsqueda único sobre el historial del libro, sin separar por origen.
- La consulta se normaliza (mayúsculas, acentos, puntuación) y busca en
  descripción, nota, categoría de origen, participantes, monto total y efecto
  individual.
- Cada resultado explica por qué coincide («Participa Laura», «Pagó Laura», «Monto
  $286.400») y marca los movimientos importados con su fila de origen.
- El encabezado muestra «N de M movimientos · propios e importados» y el historial
  se pagina («Ver los N resultados anteriores»).
- Sin texto de búsqueda, el campo no filtra: se ve el historial completo por fecha.

### Non-goals

- Filtros avanzados, rangos de fechas, ordenamientos alternativos y búsqueda por
  categoría como filtro (corte C del Story Map).
- Búsqueda difusa o por similitud, sugerencias de autocompletado.
- Búsqueda entre libros distintos.

## Capabilities

### Added Capabilities

- `busqueda-movimientos`: búsqueda libre única, normalización, explicación de la
  coincidencia y origen visible.

## Impact

- `apps/app/`: columna de texto normalizado, índices, ruta de búsqueda y la
  lista de movimientos con campo de búsqueda.
- Depende de `libro-y-saldos-cuentas-claras`; la marca de origen y los efectos
  individuales de importados dependen de `importacion-splitwise-inicial`. Sin
  importaciones, la búsqueda funciona sobre movimientos propios.
