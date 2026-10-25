## 1. Modelo de datos

- [ ] 1.1 Crear la migración con `recategorization_batches` y `recategorization_items` y verificar con una prueba de integración que se aplica sobre una base con todas las migraciones y que un lote con sus elementos se guarda y se lee.

## 2. Operación de fondo

- [ ] 2.1 Implementar la resolución del conjunto en el servidor (ids explícitos o la búsqueda y los filtros vigentes) con el mismo código que la lista, y verificar con pruebas de integración que «todos los resultados» incluye los que «Ver más» no muestra.
- [ ] 2.2 Implementar la vista previa (cantidad, muestra, omitidos por anulado o por permiso, revisión del libro) y verificar con pruebas de los escenarios de permisos, anulados, libro archivado y conjunto mayor que 1.000.
- [ ] 2.3 Implementar la confirmación con revisión por movimiento, actualización por conjunto, lote, elementos, evento y revisión del libro en `db.batch` de hasta 60 sentencias, y verificar con pruebas de integración que cada movimiento queda con una revisión «Cambió: categoría» y que el lote registra autor, destino, cantidad y omitidos.
- [ ] 2.4 Rechazar la confirmación cuando el libro cambió desde la vista previa, y verificar con una prueba de integración que no cambia ningún movimiento.
- [ ] 2.5 Hacer idempotente la confirmación usando su clave como identificador del lote, y verificar con una prueba que enviarla dos veces, incluso en simultáneo, produce un único lote y un único cambio por movimiento.
- [ ] 2.6 Medir con D1 local una operación de 1.000 movimientos (tiempo total, sentencias, tamaño de la sentencia con los identificadores) y dejar los números registrados en `docs/diseno/cuentas-claras/CASO-REAL-INTERNO.md` sin datos personales.

## 3. Deshacer

- [ ] 3.1 Implementar deshacer un lote restaurando la categoría anterior solo de los movimientos cuya revisión vigente es la del lote, con revisiones nuevas y un lote de tipo `undo`, y verificar con pruebas de integración de los escenarios del spec.
- [ ] 3.2 Rechazar deshacer dos veces el mismo lote y restringir quién puede deshacerlo (quien lo aplicó o la persona titular), y verificar con pruebas de integración de ambos rechazos.

## 4. Selección sobre búsqueda

- [ ] 4.1 Agregar casillas de verificación y «seleccionar todos los N resultados» a la lista, con barra de selección y selector de categoría, sin estilos en línea, y verificar con una prueba E2E que se selecciona, se previsualiza, se confirma y se ve el cambio.
- [ ] 4.2 Garantizar el funcionamiento sin script (formulario con confirmación) y verificar con una prueba E2E con el script deshabilitado.
- [ ] 4.3 Agregar la pantalla de confirmación con la muestra y el botón de deshacer en el aviso posterior, y verificar con una prueba E2E del recorrido completo y del deshacer.

## 5. Clasificar rápido

- [ ] 5.1 Implementar `suggestCategory` como función pura con la regla del diseño y verificar con pruebas unitarias de los tres escenarios del spec (descripción conocida, sin evidencia y evidencia dividida) y con una prueba sobre un conjunto sintético que verifica que nunca sugiere con menos de dos votos o menos del 70 %.
- [ ] 5.2 Crear la pantalla de clasificar rápido (pendiente actual, contador, sugerencia con su causa, categorías recientes, selector completo, saltar y deshacer lo último), y verificar con pruebas de integración y una E2E que asignar baja el contador y muestra el siguiente.
- [ ] 5.3 Agregar los atajos de teclado (números, Enter para aceptar, S para saltar, U para deshacer) con un script propio compatible con la CSP, y verificar con una prueba E2E que se completa una secuencia de asignaciones solo con el teclado.
- [ ] 5.4 Verificar con una prueba E2E a 390 px, en claro y oscuro, que las pantallas de selección y de clasificar rápido no desbordan, los controles miden al menos 44 px y el contraste del texto cumple.

## 6. Cierre

- [ ] 6.1 Verificar con `openspec validate recategorizacion-masiva --strict` y ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app` y `npm run test:all` hasta que pasen completos.
