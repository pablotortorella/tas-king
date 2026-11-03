## 1. Operaciones del dominio

- [ ] 1.1 Implementar `removeMembership` (razón `left` o `removed`) en un único `db.batch`: borrar la membresía solo si `role = 'member'`, desvincular la persona, escribir `member_left` o `member_removed` en `platform_audit_events` y `participant_unlinked` en `ledger_events`; verificar con pruebas de integración D1 que los saldos son idénticos antes y después, que la persona queda sin cuenta con nombre y saldo intactos y que la revisión del libro sube en uno
- [ ] 1.2 Verificar el rechazo (sin escribir nada) para: persona titular que sale, persona titular quitada, integrante que quita, persona ajena (404) y objetivo que no integra el grupo; verificar con pruebas de permisos
- [ ] 1.3 Implementar `transferOwnership` con el orden «bajar a quien cede, subir a quien recibe» en un `db.batch` y el evento `ownership_transferred`; verificar con pruebas de integración que queda exactamente una persona titular y que los saldos no cambian
- [ ] 1.4 Probar la concurrencia: transferir a un integrante mientras ese integrante sale, y dos remociones simultáneas de la misma persona; verificar que el grupo termina con una sola persona titular y que la auditoría no registra algo que no ocurrió
- [ ] 1.5 Verificar que volver a invitar a la persona vinculándola a su persona anterior funciona tras salir o ser quitada, con una prueba de integración del flujo completo

## 2. Rutas y pantallas

- [ ] 2.1 Crear `GET/POST /groups/:groupId/leave` con la pantalla de confirmación (saldo por moneda, qué se conserva, enlace a exportar) y el redirect a `/groups` con la nota si ya no es integrante; verificar con integración de vistas, CSRF y el limitador de mutaciones
- [ ] 2.2 Crear `GET/POST /groups/:groupId/members/:userId/remove` desde Personas (solo persona titular, solo para integrantes con cuenta); verificar el 403 para integrantes y que la persona titular no ve «Quitar» en su propia fila
- [ ] 2.3 Crear `GET/POST /groups/:groupId/ownership` desde Administrar grupo, con la lista de integrantes elegibles, la advertencia de que solo quien recibe puede devolverla y el caso de un solo integrante; verificar con integración de vistas
- [ ] 2.4 Agregar «Salir del grupo» al menú del grupo (solo integrantes) y «Transferir titularidad» a Administrar grupo; verificar con integración que cada rol ve solo lo suyo
- [ ] 2.5 Mostrar en `GET /groups` la nota de 30 días derivada de `platform_audit_events` (sin quién la quitó); verificar con pruebas que aparece, que desaparece pasados 30 días y que no abre el grupo
- [ ] 2.6 Verificar que tras salir la cookie `last_group` no abre el grupo y que `/cuentas-claras` muestra la lista o el único grupo restante

## 3. Móvil y accesibilidad

- [ ] 3.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) las tres pantallas: una columna, controles de al menos 44 px, botón de confirmación separado de cancelar, sin desborde horizontal; extender las auditorías de contraste y desborde existentes
- [ ] 3.2 Verificar a mano en un teléfono real el recorrido salir y quitar, y registrar modelo y navegador

## 4. Recuperación y documentación

- [ ] 4.1 Agregar a `docs/HOMESUITE_RECOVERY.md` el paso posterior a una restauración (listar `member_left`, `member_removed` y `ownership_transferred` posteriores al punto restaurado y reaplicarlos) con la consulta de solo lectura; verificar la consulta contra una base local con eventos de prueba
- [ ] 4.2 Actualizar `docs/homesuite/GLOSARIO.md` (acciones nuevas en interfaz, código, URL y auditoría), `docs/productos/CUENTAS-CLARAS.md`, STATUS y el backlog (el pendiente «borrar personas del grupo» queda solo para el caso de personas con historial); verificar con la prueba del glosario

## 5. Pruebas de recorrido

- [ ] 5.1 Agregar un E2E con las identidades de desarrollo: A crea el grupo e invita a B, B acepta, B sale y deja de ver el grupo, A conserva el historial; A invita de nuevo a B vinculando su persona; A transfiere la titularidad a B y A sale; verificar en Chromium y Firefox
- [ ] 5.2 Registrar en `docs/STATUS.md` que el login real con dos cuentas de Google sigue pendiente para el recorrido final con dos cuentas reales

## 6. Textos legales (texto legal que revisa Pablo)

- [ ] 6.1 Redactar para `apps/site/public/privacidad.html` qué pasa con los datos al salir o ser quitada (pierde el acceso; su nombre y movimientos quedan en el historial del grupo porque integran las cuentas de las demás personas; la baja de cuenta es el camino para seudonimizar), ajustar la frase de derechos de supresión y actualizar «Última actualización». **Texto legal que revisa Pablo**
- [ ] 6.2 Redactar para `apps/site/public/terminos.html` las responsabilidades de la persona titular (administrar, quitar integrantes, transferir antes de irse) y la salida de integrantes. **Texto legal que revisa Pablo**
- [ ] 6.3 Agregar una prueba del sitio que verifique que ambas páginas mencionan la salida y la fecha de actualización cambió; verificar con `npm run test:homesuite-site`

## 7. Cierre

- [ ] 7.0 Al archivar, verificar que el requisito modificado de `plataforma-homesuite-minima` queda coherente con `identidad-del-grupo` (la pantalla Administrar grupo suma «Transferir titularidad»; el orden final de la pantalla lo fija `eliminacion-de-grupos`)

- [ ] 7.1 Validar con `openspec validate salir-y-quitar-integrantes --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration` y el E2E afectado, y abrir el PR sin mergear
