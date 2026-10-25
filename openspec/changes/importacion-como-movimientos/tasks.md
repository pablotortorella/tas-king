## 1. Inferencia de pagadores y reparto

- [x] 1.1 Crear `inferComponents` como función pura con la regla del diseño y verificar con pruebas unitarias de los escenarios del spec: reparto parejo, todo a cargo de una persona, varias personas a favor, fila sin efecto y efecto mayor que el total.
- [x] 1.2 Agregar una prueba de propiedades (miles de vectores de efectos válidos, con 2 a 6 personas y centavos) y verificar que los efectos que resultan de la descomposición, calculados con el validador de la aplicación, son idénticos a los del archivo.
- [x] 1.3 Verificar con un CSV sintético de la forma de un export real (2.485 filas y dos personas, generado por script, sin datos reales) que todas las filas se convierten y que los saldos coinciden con la suma de los efectos.

## 2. Modelo de datos

- [x] 2.1 Crear la migración aditiva con `import_batch_id`, `source_row_number` e `inferred` en `ledger_entries`, la tabla de filas de origen, la tabla de filas de la vista previa y `pending_import_batch_id` en `ledger_categories`, y verificar con una prueba de integración que se aplica sobre una base con todas las migraciones.
- [x] 2.2 Hacer que `readLedger` y las demás consultas de movimientos incluyan solo movimientos propios o de lotes publicados, y verificar con una prueba de integración que un lote pendiente no aparece en el libro, los saldos, la búsqueda, el detalle ni la exportación.
- [x] 2.3 Retirar de `readLedger`, las vistas y la búsqueda la rama especial de movimientos importados (`imported`) conservando la procedencia visible, y verificar que las pruebas existentes de búsqueda, exportación y listas siguen pasando con movimientos importados nuevos.

## 3. Vista previa por fila

- [x] 3.1 Guardar la vista previa por fila (movimientos, incidentes y resúmenes), mantener el límite de 2 MiB con su mensaje y verificar con una prueba de integración que un archivo de 2.485 filas se previsualiza y que uno mayor al límite se rechaza antes de procesarse.
- [ ] 3.2 Paginar las secciones largas de la revisión (incidentes y saldos por persona) y verificar con una prueba E2E que se navega entre páginas sin perder las decisiones.
- [x] 3.3 Conservar el reconocimiento de la fila de resumen con fecha en la primera celda como requisito, y verificar con una prueba de integración sobre un archivo sintético de la forma real que el resumen no se importa como movimiento y concilia con diferencia cero.

## 4. Carga por etapas

- [x] 4.1 Crear el lote pendiente al confirmar, con las personas y las categorías nuevas ocultas, y verificar con una prueba de integración que el libro no cambia.
- [x] 4.2 Implementar la ruta de carga que procesa una tanda de filas, crea movimiento, revisión inicial, pagadores, reparto, fila de origen y categoría, con identificadores determinísticos e `INSERT OR IGNORE`, y verificar con pruebas de integración que repetir una tanda o ejecutar dos al mismo tiempo no duplica movimientos.
- [x] 4.3 Implementar la reanudación calculando el progreso desde lo cargado y verificar con una prueba que interrumpir tras una tanda y continuar termina con todos los movimientos una sola vez.
- [x] 4.4 Implementar la publicación atómica en un único lote de escrituras (publicar el lote, activar personas y categorías, evento del libro y revisión del libro) y verificar con una prueba que antes de ese paso no hay datos visibles y después están todos.
- [x] 4.5 Implementar cancelar y el descarte del lote abandonado (botón y cron diario) con una rutina única, y verificar con pruebas de integración que no quedan movimientos, partes, revisiones, filas de origen, personas ni categorías pendientes.
- [x] 4.6 Mantener el rechazo de un segundo lote publicado, el solapamiento solo con movimientos propios y el bloqueo de otra importación mientras haya una pendiente, y verificar con pruebas de integración de cada caso.

## 5. Interfaz de la importación

- [ ] 5.1 Crear la pantalla de progreso que encadena las tandas con un script y ofrece «Continuar» sin script, y verificar con una prueba E2E del recorrido completo (subir, revisar, confirmar, ver el avance y publicar) con un CSV sintético de la forma real.
- [ ] 5.2 Mostrar «Importado de Splitwise · fila N» y la marca de inferido en la lista, el detalle y la búsqueda por pagador, y verificar con pruebas de la vista y E2E de corregir el pagador (la marca desaparece) y de anular un importado.
- [x] 5.3 Importar el texto de comentario de una fila como nota y verificar con una prueba que la descripción no cambia.
- [ ] 5.4 Verificar con una prueba E2E a 390 px, en claro y oscuro, que las pantallas de revisión y progreso no desbordan, los controles miden al menos 44 px y el contraste del texto cumple.

## 6. Punto de partida

- [ ] 6.1 Agregar «Cómo querés empezar» al formulario de creación con las tres opciones y la redirección condicional, y verificar con pruebas E2E: por defecto va al libro (la prueba existente sigue pasando), «Traer de Splitwise» va a la importación y «Saldos anteriores» no se puede elegir.
- [ ] 6.2 Mostrar en el libro vacío el botón destacado y la opción de importar solo mientras no hay movimientos, y verificar con pruebas de la vista y E2E de que desaparecen con el primer movimiento.

## 7. Datos anteriores, exportación y cierre

- [ ] 7.1 Contar los lotes publicados del modelo anterior en desarrollo y staging, y convertirlos con `inferComponents` mediante un script de una sola vez cuando existan, verificando que los saldos por persona coinciden antes y después.
- [ ] 7.2 Retirar `splitwise_import_entries` y `splitwise_import_effects` con una migración posterior a esa verificación, y verificar que no quedan referencias en el código ni en las pruebas.
- [ ] 7.3 Subir la versión del esquema de la exportación JSON e incluir la procedencia, la conciliación y las filas de origen, y verificar con pruebas de la exportación.
- [ ] 7.4 Medir con D1 local la carga de 2.485 filas por etapas (tiempo total y por tanda, sentencias por lote) y dejar los números registrados en `docs/diseno/cuentas-claras/CASO-REAL-INTERNO.md` sin datos personales.
- [ ] 7.5 Eliminar el borrador `importacion-splitwise-inicial` y verificar con `openspec validate importacion-como-movimientos --strict` y `openspec list`.
- [ ] 7.6 Ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app` y `npm run test:all` y verificar que pasan completos.
