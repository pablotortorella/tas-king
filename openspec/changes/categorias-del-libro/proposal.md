## Why

Hoy la categoría solo existe como texto en los movimientos importados: se busca, pero se ve únicamente en el detalle, no se puede filtrar, y los movimientos que se cargan en la aplicación no tienen categoría. En el export real de referencia hay 41 etiquetas distintas, un tercio de los movimientos cae en la genérica y las mismas suscripciones aparecen con tres o cuatro categorías según la fecha. La persona titular quiere ordenar su histórico, poder renombrar, fusionar y reagrupar categorías sin reescribir miles de filas, y que quien llegue desde Splitwise encuentre un vocabulario familiar. Se decidió en el explore (D11 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`) que cada grupo tenga su propia lista de categorías, con grupos e íconos, nombres normalizados y una lista inicial propia.

## What Changes

- Cada libro tiene una **lista de categorías propia**, con nombre, grupo (padre), ícono y estado, que se copia desde una **lista inicial** de la aplicación al crear el libro y se completa de forma diferida en los libros existentes.
- Los **nombres se normalizan** (mayúsculas, acentos, espacios y puntuación) para impedir duplicados evitables: se muestra el nombre tal como se escribió la primera vez.
- Los **movimientos propios** pueden llevar una categoría, que se elige en un selector agrupado y se puede crear desde el mismo selector.
- La categoría **se ve** en la lista y en el detalle, **se busca** y **se puede filtrar** en la lista.
- La persona titular puede **renombrar, reagrupar, cambiar el ícono, archivar y fusionar** categorías. Fusionar no reescribe los movimientos.
- Los **movimientos importados** con el modelo actual muestran la categoría original como hasta ahora y, si coincide por nombre normalizado con una categoría del libro, adoptan su grupo e ícono. El cambio que convierte la importación en movimientos normales los incorpora por completo.
- El **JSON del libro** incluye la lista de categorías y el CSV agrega una columna de categoría.

### Non-goals

- Reportes o totales por categoría.
- Categorización automática o por reglas, y la recategorización en bloque (cambio `recategorizacion-masiva`).
- Compartir categorías entre grupos o un catálogo global editable.
- Acoplar el producto a la lista de Splitwise: su vocabulario inspira la lista inicial pero no se importa como catálogo.
- Convertir los movimientos importados en normales (cambio `importacion-como-movimientos`).

## Capabilities

### New Capabilities

- `categorias-de-movimientos`: la lista de categorías de cada libro, su normalización, la categoría de los movimientos, su gestión y su presencia en la lista, la búsqueda y la exportación.

### Modified Capabilities

<!-- Ninguna capability vigente cambia: openspec/specs/ solo contiene landing-publica-homesuite y tip-diario. -->

## Impact

- `apps/app/migrations/`: una migración nueva (tabla de categorías y columna de categoría en los movimientos). Su numeración puede chocar con la de otras ramas.
- `apps/app/src/`: creación del libro (`groups.js`), lectura y escritura de movimientos (`ledger.js`), formulario y lista (`ledger-ui.js`, `overview-ui.js`), rutas de gestión de categorías (`index.js`), importación actual (reconocimiento por nombre normalizado) y exportación.
- Pruebas unitarias de la normalización, de integración D1 de la migración, la siembra, la fusión y los permisos, y E2E del selector, la gestión y los filtros.
- Depende de la cadena #68 → #71 → #75 → #76 → #81 y de los PR #88 → #89 → #90.
