## 1. Modelo de datos

- [x] 1.1 Crear la migración con `ledger_categories` (clave única `(ledger_id, name_key)`, estados y `merged_into`) y la columna `category_id` en `ledger_entries`, y verificar con una prueba de integración que se aplica sobre una base con todas las migraciones y que la restricción única rechaza dos nombres normalizados iguales.
- [x] 1.2 Extraer la normalización de nombres de `ledger-ui.js` a un módulo compartido y verificar con pruebas unitarias que búsqueda y categorías producen la misma forma normalizada para mayúsculas, acentos, espacios y puntuación.
- [x] 1.3 Definir `DEFAULT_CATEGORIES` (grupo, nombre e ícono) con la lista propuesta y verificar con una prueba que no hay dos nombres con la misma forma normalizada.

## 2. Siembra

- [x] 2.1 Sembrar la lista inicial en `createGroupForUser` dentro del mismo `db.batch`, con una sola sentencia sobre un JSON, y verificar con una prueba de integración que un libro nuevo tiene todas las categorías activas.
- [x] 2.2 Sembrar de forma diferida y con `INSERT OR IGNORE` los libros que no tienen lista, y verificar con una prueba de integración que un libro anterior la recibe una sola vez, también con dos accesos simultáneos.
- [x] 2.3 Verificar con una prueba de integración el aislamiento: la lista y las categorías creadas en un libro no aparecen en otro.

## 3. Categoría en los movimientos

- [x] 3.1 Aceptar `category_id` al guardar un movimiento (alta y corrección), rechazar categorías de otro libro y categorías archivadas en altas nuevas, e incluir `categoryId` y `categoryName` en la instantánea de la revisión, y verificar con pruebas de integración de los escenarios del spec.
- [x] 3.2 Hacer que el historial indique «categoría» cuando cambia, y verificar con una prueba que el cambio de categoría crea una revisión y que renombrar la categoría no altera las revisiones pasadas.
- [x] 3.3 Resolver los alias de fusión al leer los movimientos y verificar con pruebas unitarias la cadena de uno y dos pasos, el rechazo de ciclos y que una categoría fusionada se muestra con la destino.

## 4. Selector y gestión

- [x] 4.1 Agregar el selector agrupado con búsqueda y alta en línea al formulario de movimiento, sin estilos en línea, y verificar con una prueba E2E que se elige una categoría, que escribir una variante normalizada ofrece la existente y que se puede crear una nueva.
- [x] 4.2 Crear la pantalla de gestión del libro con renombrar, reagrupar, cambiar ícono, archivar y fusionar, solo para la persona titular, y verificar con pruebas de integración de permisos (el integrante recibe un rechazo) y de los escenarios de renombrar, fusionar y archivar.
- [x] 4.3 Verificar con una prueba E2E a 390 px, en claro y oscuro, que el selector y la gestión no desbordan, los controles miden al menos 44 px y el contraste del texto cumple.

## 5. Lista, búsqueda y exportación

- [x] 5.1 Mostrar la categoría (con grupo e ícono) en la lista y el detalle y mostrar «Sin categoría» cuando falta, y verificar con una prueba de la vista general y una E2E.
- [x] 5.2 Sumar el nombre de la categoría a la búsqueda con el motivo «Categoría» y agregar el filtro por categoría o grupo codificado en la URL, y verificar con pruebas unitarias de `searchLedger` y una E2E de filtrar y quitar el filtro.
- [x] 5.3 Reconocer por nombre normalizado la categoría de origen de los importados actuales y verificar con una prueba de integración de la coincidencia y de la ausencia de coincidencia.
- [x] 5.4 Incluir las categorías en el JSON del libro y la columna `categoria` en el CSV, y verificar con pruebas de la exportación incluido el escape de fórmulas.

## 6. Cierre

- [x] 6.1 Verificar con `openspec validate categorias-del-libro --strict` y ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app` y `npm run test:all` hasta que pasen completos.
