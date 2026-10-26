## 1. Menú y cuenta en el encabezado (integración con el perfil)

- [x] 1.1 Traer el perfil compartido de `main` y mostrar la cuenta (avatar y nombre hacia `/perfil`) y un menú con las secciones del grupo, Inicio, Mis grupos, «Ver mi perfil» y «Cerrar sesión», y verificar con pruebas de integración de las pantallas de la suite y con E2E del menú en 390 px y escritorio (llegar a cada sección, cierre con Escape y al tocar afuera, perfil propio).
- [x] 1.2 Mantener el encabezado sin desborde a 320 px y con letra legible en cada color de avatar, y verificar con las pruebas E2E existentes de desborde, 44 px y contraste.

## 2. Modelo de datos

- [ ] 2.1 Crear `0011_person_merge.sql` con `ledger_participants.merged_into_id` y `person_merges`, y verificar con una prueba de integración que se aplica sobre todas las migraciones y que no se puede registrar dos veces la unión de la misma persona.
- [ ] 2.2 Excluir a las personas unidas de `participantsFor` y verificar con una prueba de integración que `saveEntry` rechaza una persona unida y que la lectura del libro no la lista.

## 3. Renombrar

- [ ] 3.1 Implementar renombrar con unicidad entre vigentes (sin distinguir mayúsculas ni tildes), evento del libro, permiso de titular y rechazo en grupo archivado, y verificar con pruebas de integración de los escenarios del spec.

## 4. Unir personas

- [ ] 4.1 Implementar las reglas puras de la unión (suma por persona de partes y asignaciones, descarte de `split`, detección de transferencias entre ambas) y verificar con pruebas unitarias, incluidos pagadores y partes de ambas personas en el mismo movimiento.
- [ ] 4.2 Implementar la vista previa (movimientos que cambian, transferencias que se anulan, saldos antes y después, cuenta e invitaciones) sin escribir, y verificar con pruebas de integración que no modifica nada y que rechaza personas iguales, ya unidas, no vigentes, de otro grupo, dos cuentas y libro archivado.
- [ ] 4.3 Implementar la aplicación por tandas con revisión por movimiento (`personMerge`), transferencias anuladas, traslado de la cuenta, resolución de invitaciones y cierre con evento y revisión del libro, y verificar con pruebas de integración de los saldos (suma exacta, total del grupo sin cambio), de la auditoría y de la cuenta y las invitaciones.
- [ ] 4.4 Hacerla idempotente y reanudable, y verificar con pruebas de integración de doble confirmación en simultáneo, de un corte a mitad (libro legible en cada paso y completado al repetir), de un movimiento corregido a mitad de camino y de una clave reutilizada con otras personas.
- [ ] 4.5 Medir con D1 local la unión de una persona con 2.500 movimientos (tiempo, sentencias, tamaño) y dejar los números en `docs/diseno/cuentas-claras/CASO-REAL-INTERNO.md` sin datos personales.

## 5. Pantalla de personas

- [ ] 5.1 Crear `/spaces/:id/people` con la lista (estado, saldo, quién es la persona que mira), las personas unidas aparte, las herramientas de administración y los formularios de renombrar y unir en dos pasos, y verificar con pruebas de integración de permisos (integrante en solo lectura) y de que el libro ya no repite esas secciones.
- [ ] 5.2 Mostrar «Cambió: unión de personas» en el historial y que un movimiento unido se reabra con importes exactos, y verificar con una prueba de integración y una E2E.
- [ ] 5.3 Verificar con E2E en 390 px y escritorio (Chromium y Firefox) el recorrido completo: renombrar, unir con vista previa, confirmar, doble clic, volver atrás, sin desborde, 44 px y contraste, y un recorrido solo con el teclado.

## 6. Importación: «Soy yo»

- [ ] 6.1 Implementar `mappingChoices` (opciones, orden y preselección) y el cálculo de avisos de la revisión, y verificar con pruebas unitarias.
- [ ] 6.2 Usarlas en el paso de correspondencia y en la revisión, y verificar con pruebas de integración de las pantallas y con E2E de «Soy yo», la preselección por nombre, los dos avisos y que no bloquean.

## 7. Cierre

- [ ] 7.1 Actualizar `docs/productos/CUENTAS-CLARAS.md`, `docs/STATUS.md` y el backlog, con las decisiones de esta propuesta y las medidas.
- [ ] 7.2 Correr todas las suites (unitarias, integración, E2E en Chromium y Firefox y `test:all`) y dejar la evidencia en `docs/STATUS.md`.
- [ ] 7.3 Probar en staging (sin tocar producción) la unión de las dos personas duplicadas del caso real y registrar el resultado.
