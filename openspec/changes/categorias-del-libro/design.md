## Context

- El único dato de categoría que existe es `splitwise_import_entries.category`, un texto de hasta 120 caracteres que `readLedger` expone en los movimientos importados. `searchLedger` lo busca; `renderEntryDetail` lo muestra solo en el detalle de un importado.
- `ledger_entries` no tiene columna de categoría. La creación del libro es un único `db.batch` (`createSpaceForUser`), y la ruta de movimientos usa campos de formulario fijados por pruebas E2E.
- Las migraciones llegan a `0006_space_slugs.sql` en la rama de integración; otras ramas pueden agregar la siguiente.
- La CSP prohíbe estilos y scripts en línea, así que los íconos se dibujan con SVG insertado en el HTML.

Ver `proposal.md` para el motivo y `specs/categorias-de-movimientos/spec.md` para el comportamiento exigido. Las decisiones vienen de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md` (D11).

## Goals / Non-Goals

**Goals:**

- Una tabla de categorías por libro, con normalización de nombres y gestión por una sola fila.
- Que renombrar, reagrupar y fusionar no reescriba movimientos ni genere revisiones masivas.
- Que el cambio sea aditivo: no rompe movimientos existentes ni la importación actual.

**Non-Goals:**

- Reportes por categoría, reglas automáticas y recategorización en bloque.
- Rediseñar cómo se importan los movimientos.

## Decisions

### D1. Tabla `ledger_categories` y columna `category_id`

`ledger_categories(ledger_id, id, name, name_key, group_key, icon, status, merged_into, created_at, updated_at)` con clave primaria `(ledger_id, id)` y restricción única `(ledger_id, name_key)`. `ledger_entries` suma `category_id` nulo, con clave foránea compuesta `(ledger_id, category_id)`. `status` admite `active` y `archived`.

- **Por qué.** Cambiar un nombre, un grupo o un ícono es modificar una fila; los movimientos solo guardan un identificador. Es lo que permite la limpieza del histórico sin tocar miles de filas.
- **Alternativa.** Texto en cada movimiento con una lista de sugerencias: descartada, porque renombrar o fusionar exige reescribir cada movimiento y el grupo y el ícono solo existirían para los nombres que la aplicación reconociera.

### D2. Normalización: la de la búsqueda

`name_key` se calcula con la misma función de normalización que `searchLedger` (sin acentos, minúsculas, todo carácter no alfanumérico pasa a un espacio, espacios colapsados y recortados). Una sola implementación evita que «Casa - Otro» y «casa otro» se traten distinto en la búsqueda y en las categorías. La restricción única de la base impide la duplicación aunque dos personas creen la misma categoría a la vez.

### D3. Lista inicial: copia al crear y siembra diferida

La lista inicial es una constante de la aplicación (`DEFAULT_CATEGORIES`) con grupo, nombre e ícono. Al crear un libro se inserta con una sola sentencia que lee un JSON (`INSERT ... SELECT ... FROM json_each(?)`), dentro del mismo `db.batch`. Un libro anterior sin categorías se siembra la primera vez que se lee (`INSERT OR IGNORE` por la clave única), de modo que dos accesos simultáneos no duplican.

- **Por qué un JSON.** D1 limita los parámetros por sentencia; una fila por categoría con seis valores superaría ese límite con 40 filas.
- **Contenido propuesto para la primera versión** (a revisar con la persona titular antes de cerrar; el cambio no depende de la lista exacta): Casa (Alquiler, Electrónica, Hipoteca, Mantenimiento, Mascotas, Muebles, Servicio doméstico, Servicios, Suministros del hogar, Seguro del hogar, Otro), Comidas y bebidas (Alimentos, Licor, Restaurantes, Otro), Entretenimiento (Deportes, Juegos, Música, Películas, Suscripciones, Otro), Transporte (Autobús/tren, Bicicleta, Coche, Estacionamiento, Gasolina, Taxi, Otro), Utilidades (Agua, Basura, Calefacción, Electricidad, Limpieza, TV/teléfono/Internet, Otro), Vida (Formación, Gastos médicos, Guardería, Impuestos, Regalos, Ropa, Seguro, Otro), Viajes (Avión, Hotel, Paseos, Otro), Ingresos (Alquiler cobrado, Reintegros, Otro) y Sin categoría.
- Mejoras respecto de la lista de Splitwise que salen de los datos de referencia: Suscripciones, Servicio doméstico, un grupo de Viajes que reúne avión y hotel, un grupo de Ingresos y el seguro del hogar bajo Casa.

### D4. Fusionar con alias, sin reescribir movimientos

Fusionar la categoría A en B marca `A.status = archived` y `A.merged_into = B`. Al leer, el movimiento con `category_id = A` se muestra con la categoría B. La resolución de alias sigue la cadena hasta una categoría activa y una restricción impide ciclos y fusiones sobre sí misma.

- **Por qué.** La fusión de una categoría con miles de movimientos queda en una sola escritura y es reversible mientras no se reutilice el alias.
- **Alternativa.** Reasignar el `category_id` de cada movimiento: descartada, porque genera miles de escrituras, revisiones y ruido en el historial.

### D5. La revisión guarda el identificador y el nombre vigente al momento

La instantánea de la revisión incluye `categoryId` y `categoryName` tal como se veían. El historial dice «Cambió: categoría» al comparar identificadores. Renombrar una categoría no altera las revisiones pasadas: queda registrado cómo se llamaba cuando se cargó el movimiento.

### D6. Selector agrupado con alta en línea

El selector muestra los grupos con sus categorías activas y un campo de texto que filtra la lista. Si lo escrito coincide por nombre normalizado con una categoría, se ofrece esa; si no, se ofrece crear una nueva. Cualquier integrante puede crear; solo la persona titular renombra, reagrupa, archiva y fusiona. Los íconos son SVG de un conjunto cerrado de claves (`icon`) definidas en la aplicación, sin recursos externos por la CSP.

### D7. Filtro y búsqueda sobre la lista actual

El filtro por categoría o grupo se aplica sobre la lista que ya se carga en memoria, con el mismo mecanismo que la búsqueda por texto, y se codifica en la URL. La búsqueda por texto suma el nombre de la categoría con el motivo «Categoría». Cuando la búsqueda migre a SQL (disparadores de `DECISIONES-EXPLORE.md`), la categoría pasará a ser un filtro por identificador.

### D8. Importados actuales: reconocimiento por nombre normalizado

Mientras exista `splitwise_import_entries.category`, la lectura relaciona ese texto con `name_key` de las categorías del libro para mostrar grupo e ícono; sin coincidencia se muestra el texto. No se crean categorías automáticamente. Este puente desaparece cuando el cambio `importacion-como-movimientos` incorpore los importados como movimientos con `category_id` y cree las categorías que falten.

### D9. Exportación

El JSON del libro incorpora `categories` y cada movimiento su `categoryId`. El CSV agrega la columna `categoria` con el nombre vigente, escapando como el resto de las columnas de texto.

## Risks / Trade-offs

- **La migración choca en numeración con otra rama** → Usar el siguiente número libre al aplicar y ejecutar `db:migrate:homesuite-app:local` sobre una base con todas las migraciones antes de integrar.
- **Crear categorías abiertas a todos puede generar variantes** → La normalización impide duplicados triviales y la persona titular puede fusionar; si aun así prolifera, restringir el alta a la titular es un cambio chico.
- **La lista inicial queda desactualizada o no gusta** → Es una constante: se ajusta sin migrar, y solo se copia a libros nuevos y a libros sin lista; los libros ya sembrados conservan la suya.
- **Una cadena de fusiones se alarga** → La restricción de ciclos y una prueba de resolución de alias; en la práctica la cadena es de uno o dos pasos.
- **Dos accesos simultáneos siembran el mismo libro** → `INSERT OR IGNORE` sobre la clave única `(ledger_id, name_key)` hace la siembra idempotente.

## Migration Plan

1. Aplicar la migración: crea `ledger_categories` y agrega `category_id` (nulo) a `ledger_entries`. No toca datos existentes.
2. Desplegar el código: los libros nuevos se siembran al crearse y los anteriores en su primer acceso.
3. Reversión: el código anterior ignora la tabla y la columna nuevas. Si hace falta limpiar, la tabla se puede vaciar sin afectar movimientos.

El orden respeta la cadena operativa ya fijada: respaldo, migración y luego el Worker.

## Open Questions

- El contenido exacto y el orden de la lista inicial y de sus íconos: se cierra en una revisión con la persona titular sin cambiar el modelo.
- Si el filtro por categoría se ofrece como chips encima de la lista o como parte del buscador: decisión visual que no cambia los requisitos.
