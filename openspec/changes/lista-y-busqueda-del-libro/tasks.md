## 1. Búsqueda más rápida y equivalente

- [x] 1.1 Conservar la implementación actual de `searchLedger` como referencia solo en las pruebas y verificar que las pruebas existentes de búsqueda siguen pasando contra ella.
- [x] 1.2 Reescribir `searchLedger` con el índice por petición (textos normalizados una vez, importes solo con términos numéricos) y verificar con una prueba de propiedades que devuelve los mismos movimientos y motivos que la referencia sobre miles de libros y consultas generados, con acentos, separadores, decimales, notas y anulados.
- [x] 1.3 Agregar la prueba de rendimiento con libros sintéticos de 2.500 y 5.000 movimientos y verificar que una palabra se resuelve en menos de 100 ms con 5.000 y que el costo crece de forma lineal.

## 2. Criterios por persona

- [x] 2.1 Derivar «Pagó», «Recibió», «Participa», «Entregó» y «Recibió» con la marca de inferido a partir de pagadores, asignaciones y transferencias, reemplazando «Participante» y «Efecto de», y verificar con pruebas unitarias de los escenarios del spec.
- [ ] 2.2 Ofrecer los filtros rápidos «Pagó X (N)» y «Participa X (M)» cuando un término coincide con una persona, codificados en la URL, y verificar con una prueba de la vista y una E2E de filtrar y quitar el filtro con dos personas.
- [ ] 2.3 Verificar con una prueba que en un libro de dos personas el filtro «Pagó X» reduce los resultados y que con tres personas los filtros siguen siendo coherentes.

## 3. Lista

- [ ] 3.1 Ordenar por fecha descendente y fecha de carga descendente, y verificar con una prueba que dos movimientos del mismo día quedan con el último cargado primero y que los saldos no cambian.
- [ ] 3.2 Verificar con pruebas de la vista que «Ver más», el contador «N de M» y los anulados rotulados conservan el comportamiento actual con el índice nuevo.

## 4. Regreso a la lista

- [ ] 4.1 Redirigir tras guardar, corregir y anular a la lista con el aviso y el identificador del movimiento, y hacer que el guardado optimista de `client.js` navegue a esa ubicación, y verificar con pruebas de integración de las redirecciones y de que la respuesta JSON devuelve la lista.
- [ ] 4.2 Mostrar la franja transitoria con el movimiento afectado, su enlace al detalle y el mensaje, validar que el identificador pertenezca al libro y omitir la franja sin el parámetro, y verificar con pruebas de la vista y de integración con un identificador ajeno.
- [ ] 4.3 Actualizar las dos pruebas E2E que esperaban el detalle tras guardar (registrar, corregir y anular, y la de diseño) y agregar una E2E que guarda un movimiento con fecha antigua y comprueba la franja arriba y el movimiento en su lugar por fecha.
- [ ] 4.4 Verificar con una prueba E2E a 390 px, en claro y oscuro, que la lista, los filtros y la franja no desbordan, los controles miden al menos 44 px y el contraste del texto cumple.

## 5. Mediciones y cierre

- [ ] 5.1 Registrar un evento estructurado cuando abrir el libro supera 300 ms, sin datos personales, y verificar con una prueba que se emite con un libro grande sintético y no con uno chico.
- [ ] 5.2 Documentar los disparadores de SQL (5.000 movimientos o 300 ms medidos) en `docs/diseno/cuentas-claras/CASO-REAL-INTERNO.md` y eliminar el borrador `busqueda-movimientos-unificada`, y verificar con `openspec validate lista-y-busqueda-del-libro --strict` y `openspec list`.
- [ ] 5.3 Ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app` y `npm run test:all` y verificar que pasan completos.
