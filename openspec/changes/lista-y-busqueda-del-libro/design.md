## Context

- `searchLedger` (`ledger-ui.js`) recorre todos los movimientos en cada petición y, por cada uno, normaliza descripción, categoría y nota, y formatea el importe total y el de cada persona aunque la consulta no sea numérica. Con las 2.485 filas de un export real, una búsqueda cuesta entre 90 y 390 ms de CPU (Node, sin red); una de dos palabras es la más cara porque primero prueba la frase completa y luego cada término.
- `renderLedgerOverview` (`overview-ui.js`) construye la lista, el contador y «Ver más»; tras guardar, corregir o anular, `index.js` redirige al detalle del movimiento con `?aviso=` y `client.js` navega a la ubicación que devuelve el guardado.
- Para cada persona, la búsqueda actual solo mira los efectos: con dos personas siempre coincide. El pagador existe como `cashParties` en los movimientos propios y, con `importacion-como-movimientos`, también en los importados con la marca de inferido.
- `searchLedger` se ejecuta sobre el libro ya cargado, y el orden del libro es fecha descendente con desempate por identificador (aleatorio).

Ver `proposal.md` y los specs `busqueda-movimientos` y `lista-de-movimientos`. Decisiones de origen: D8, D9 y D10 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`.

## Goals / Non-Goals

**Goals:**

- Bajar el costo de la búsqueda unas 100 veces sin cambiar qué encuentra.
- Que buscar por persona sirva con dos personas y con más.
- Que guardar, corregir y anular devuelvan a la lista con confirmación visible.
- Dejar medido cuándo hará falta SQL.

**Non-Goals:**

- SQL, cursores o saldos agregados.
- Nuevos tipos de filtro o de orden.

## Decisions

### D1. Índice por petición y equivalencia verificada

`searchLedger` construye, una sola vez por petición y por movimiento, un registro con los campos ya normalizados (texto de descripción, nota y categoría; nombres de las personas del movimiento) y deja los importes para cuando haya un término numérico. La consulta se normaliza una vez y sus términos también. La frase completa se prueba primero y, si falla, cada término.

- **Por qué.** El costo actual es de normalizar y formatear en cada coincidencia fallida. Un prototipo medido sobre datos sintéticos bajó de 860 ms a 6 ms con 5.000 movimientos; con reglas simplificadas, por lo que el cambio real exige una prueba de equivalencia, no solo el número.
- **Equivalencia.** La implementación actual se conserva como referencia dentro de las pruebas. Una prueba de propiedades compara ambas sobre miles de consultas y libros generados (acentos, importes con separadores, decimales, notas, anulados) y exige los mismos movimientos con los mismos motivos.
- **Alternativa.** Guardar un texto normalizado en la base (`search_text`) como proponía el borrador: descartada por ahora, porque exige una migración y mantener el índice al corregir; queda como camino de SQL si se cumple un disparador.

### D2. Criterios por persona

Se deriva por movimiento: `Pagó X` desde los pagadores (en un gasto, los que aportan el dinero; en un ingreso, los que lo reciben, que se rotula «Recibió»); `Participa X` desde las personas con asignación; en transferencias, `Entregó X` y `Recibió X` desde origen y destino. Los importados con pagador inferido muestran `· inferido`. Las coincidencias por persona reemplazan el actual «Participante: X» y «Efecto de X», que dejan de ser criterios.

- **Alternativa.** Ignorar a los participantes si coinciden con todos los movimientos: descartada, porque con tres o más personas deja de ser cierto y vuelve inconsistente la búsqueda.

### D3. Filtros rápidos por persona

Si algún término de la consulta coincide con el nombre de una persona, la barra de resultados ofrece dos filtros con su cantidad, «Pagó X (N)» y «Participa X (M)». El filtro se codifica en la URL y se aplica sobre el conjunto ya encontrado, con el mismo mecanismo que usará el filtro de categorías de `categorias-del-libro`. Con una consulta de varias personas se ofrecen los filtros de cada una.

### D4. Orden por fecha y por carga

El orden pasa a fecha descendente y `created_at` descendente, con identificador solo como último desempate. El primer movimiento cargado de un día queda abajo y el último arriba, que es lo que se espera al ver «lo último que cargué».

### D5. Regreso a la lista y franja transitoria

Tras guardar, corregir o anular, el servidor redirige a la lista con `?aviso=guardado|corregido|anulado&nuevo=<id>`; el guardado optimista de `client.js` navega a esa ubicación. La lista valida que `nuevo` pertenezca al libro y muestra encima una franja con ese movimiento (con enlace al detalle) y el mensaje. La franja existe solo con el parámetro: abrir la lista sin él no la muestra, y un identificador ajeno o inexistente se ignora. No se agrega ningún estado en el servidor ni cookies.

- **Por qué.** Resuelve la fecha antigua (el movimiento nuevo puede no estar entre los 40 primeros) sin cambiar el orden de la lista.
- **Alternativa.** Una cookie de un solo uso: descartada, porque agrega estado y la franja desaparecería al recargar pero reaparecería al duplicar la pestaña de forma impredecible. Con el parámetro, recargar la pantalla vuelve a mostrarla, lo que se considera aceptable.

### D6. Mediciones y disparadores

Una prueba de rendimiento con libros sintéticos de 2.500 y 5.000 movimientos fija el presupuesto de la búsqueda (menos de 100 ms de CPU para una palabra con 5.000). En el servidor, abrir el libro registra un evento estructurado cuando supera 300 ms de tiempo transcurrido, con cantidades pero sin datos personales, para decidir con uso real. Los disparadores para pasar a SQL (5.000 movimientos o 300 ms medidos) quedan documentados.

## Risks / Trade-offs

- **El índice cambia lo que se encuentra** → Prueba de equivalencia contra la implementación de referencia con miles de casos; los motivos de persona son la única diferencia intencional y tienen sus propias pruebas.
- **La franja reaparece al recargar** → Se acepta; es un parámetro de la dirección y la franja no cambia datos.
- **El tiempo transcurrido no es CPU** → El aviso mide tiempo transcurrido como indicio y la prueba de rendimiento mide CPU en Node; ambos se leen juntos.
- **Cambia el orden dentro de un mismo día para los movimientos existentes** → Es un cambio de presentación que afecta solo los empates; no altera saldos ni exportaciones.
- **Dos E2E existentes fijan la página de detalle tras guardar** → Se actualizan junto con el cambio.

## Migration Plan

No hay migración ni cambios de esquema. Se despliega con el código. Revertir devuelve el comportamiento anterior: los parámetros nuevos de la dirección se ignoran.

## Open Questions

- El texto exacto de los mensajes de éxito y el diseño visual de la franja y de los filtros rápidos.
- Si los filtros por persona se muestran en una sola fila con desplazamiento horizontal en el teléfono.
