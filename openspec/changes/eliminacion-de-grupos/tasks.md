## 1. Esquema y triggers

- [ ] 1.1 Escribir la migración nueva (la siguiente libre): `groups.deleted_at` y `deleted_by_user_id`, índice parcial, tabla `group_deletion_log` (`group_id` sin clave foránea) y reemplazo de `entry_revisions_no_delete` (conservando la condición de lotes sin publicar de `0008`) y `ledger_events_no_delete` con la condición de la ventana de 30 días; verificar actualizando desde el esquema anterior **con datos**, no solo en una base vacía
- [ ] 1.2 Probar los triggers: el `DELETE` aborta en un grupo vivo y dentro de la ventana, procede a los 30 días y solo para ese libro, y los `UPDATE` abortan siempre; verificar que el descarte de lotes sin publicar sigue funcionando
- [ ] 1.3 Agregar la constante `GROUP_DELETION_WINDOW_DAYS` y una prueba que falla si difiere del 30 del SQL de los triggers
- [ ] 1.4 Ejecutar el restore drill (`homesuite-app-restore-drill.sh`) con un export que incluya los triggers nuevos y verificar que cargan y que `foreign_key_check` queda limpio

## 2. Visibilidad

- [ ] 2.1 Aplicar `deleted_at IS NULL` en `resolveGroup`, `getLedgerAccess`, el listado de grupos, la canonización de rutas, `profiles.js`, la lista de invitaciones pendientes y `entryTarget`; inventariar a mano cada consulta a `groups` y `memberships` y verificar con pruebas de integración
- [ ] 2.2 Escribir la prueba estática que falla ante una consulta nueva a `memberships` o `groups` sin el criterio (con lista corta de excepciones y motivo); verificar que falla con una consulta de ejemplo sin criterio
- [ ] 2.3 Escribir la prueba que elimina un grupo y recorre todas las rutas de grupo con la persona titular y con un integrante, esperando 404 salvo la recuperación y la exportación de la persona titular
- [ ] 2.4 Rechazar escrituras y aceptación de invitaciones sobre grupos eliminados; verificar con pruebas que una invitación pendiente no se acepta y que la cookie `last_group` no abre el grupo

## 3. Eliminar, restaurar y exportar

- [ ] 3.1 Implementar `deleteGroup` (persona titular, nombre exacto, idempotente, `group_deleted` con conteos en un `db.batch`) y `restoreGroup` (persona titular, dentro de la ventana, `group_restored`); verificar permisos, nombre equivocado, doble envío, restauración fuera de ventana y que los saldos son idénticos tras restaurar
- [ ] 3.2 Crear `GET/POST /groups/:id/delete` con las consecuencias, las descargas, el estado de la exportación (comparando `ledger_exported` de `exportacion-completa-del-grupo` con `expense_ledgers.revision`) y la casilla adicional si hay cambios sin exportar; verificar los dos estados con pruebas de vistas
- [ ] 3.3 Crear `GET /groups/:id/deleted` y `POST /groups/:id/restore` y «Grupos eliminados» en `/groups`; permitir las rutas de exportación para el grupo eliminado solo a su persona titular dentro de la ventana; verificar que un integrante recibe 404
- [ ] 3.4 Mostrar en `/groups` la nota de 30 días para las demás personas; verificar que aparece, que no enlaza y que desaparece al restaurar o pasados 30 días
- [ ] 3.5 Agregar «Eliminar grupo» como última sección de Administrar grupo (zona de peligro, solo persona titular); verificar con integración que un integrante no la ve

## 4. Purga

- [ ] 4.1 Implementar `purgeDeletedGroups` en el orden de dependencias (inmutables primero, con el libro y el grupo todavía presentes), por lotes acotados, idempotente y reanudable, con el registro en `group_deletion_log` en el lote final; verificar con pruebas de integración la purga completa, la interrupción a mitad y la reanudación
- [ ] 4.2 Integrar el paso en `runMaintenance` con un máximo de grupos por corrida y el resultado en el registro `maintenance_completed`; verificar que un grupo vivo y uno de 29 días no se tocan
- [ ] 4.3 Escribir la prueba que enumera desde `sqlite_master` las tablas con `group_id` o `ledger_id` y exige cero filas tras la purga; verificar que falla con una tabla de ejemplo no incluida
- [ ] 4.4 Emitir el registro estructurado `group_purged` y `group_purge_failed` (sin nombres ni emails) y verificar que no contienen datos personales
- [ ] 4.5 Medir la purga del caso real (~2.500 movimientos) en staging: filas escritas, tiempo y límites de D1 y del cron (no verificados); ajustar el tamaño de lote y registrar el resultado

## 5. Recuperación y ensayo

- [ ] 5.1 Documentar en `docs/HOMESUITE_RECOVERY.md` el paso posterior a una restauración (reaplicar la lista de supresiones: `group_deletion_log`, `account_erasures` si existe y el registro externo) y escribir `scripts/homesuite-app-reapply-suppressions.sh`, en seco por defecto y con confirmación para escribir; verificar sobre una base local de ensayo
- [ ] 5.1b Registro externo de supresiones en R2 (decidido por Pablo, 2026-11-02): agregar el binding `SUPPRESSIONS` en `apps/app/wrangler.jsonc` para staging (bucket propio de staging, a crear) y producción (`homesuite-app-backups`, prefijo `suppressions/`), con prueba de que un Worker sin el binding falla de forma explícita; escribir la línea de supresión antes del borrado final de la purga (idempotente, con reintento) y verificar que un fallo de R2 pospone la purga sin borrar; verificar que la regla de expiración del bucket solo alcanza a `production/`, documentar el permiso y que el objeto queda fuera del prefijo que expira a los 90 días; cubrir con pruebas de integración (R2 simulado) la escritura previa al borrado, la idempotencia por identificador y el reintento, y que la línea solo contiene identificador opaco, tipo y fecha; antes de producción, ensayar la escritura real en staging
- [ ] 5.2 Ejecutar el ensayo «exportar, eliminar, purgar, restaurar un respaldo anterior y reaplicar la lista de supresiones» sobre una base descartable (la maquinaria del restore drill) y registrar en STATUS fecha, SHA y resultado; verificar que lo suprimido no reaparece en ningún momento, que el grupo no es visible tras reaplicar y que el siguiente mantenimiento lo purga

## 6. Móvil y accesibilidad

- [ ] 6.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) la pantalla de eliminación y «Grupos eliminados»: una columna, controles de al menos 44 px, botón de eliminar apartado de cancelar, campo del nombre con `autocomplete="off"` y `autocapitalize="off"`, sin desborde horizontal; extender las auditorías de contraste y desborde
- [ ] 6.2 Agregar un E2E con identidades de desarrollo: A crea el grupo e invita a B, B acepta, A exporta y elimina, B no ve el grupo y ve la nota, A restaura y B lo ve; verificar en Chromium y Firefox
- [ ] 6.3 Probar a mano en un teléfono real el recorrido de eliminar y restaurar y registrar modelo y navegador

## 7. Excepción, glosario y documentación

- [ ] 7.1 La excepción a la inmutabilidad del historial (`DELETE` solo a los 30 días) ya figura **aprobada por Pablo el 2026-11-02** en `docs/homesuite/README.md` (registrada en este PR); al implementar, completar el estado con la evidencia de las pruebas de la tarea 1.2 y de la purga
- [ ] 7.2 Completar `docs/HOMESUITE_DATA_LIFECYCLE.md` (la corrección «ofrece, no exige» ya está hecha; faltan las clases de datos, la ventana de 30 días, la lista de supresiones y los «Bloqueos de producción» con la evidencia), `docs/productos/CUENTAS-CLARAS.md`, el glosario (eliminar frente a archivar), STATUS y backlog; verificar con la prueba del glosario
- [ ] 7.3 Agregar a la revisión semanal de `docs/HOMESUITE_VIGILANCIA.md` la comprobación de grupos eliminados hace más de 32 días sin purgar, si `alertas-minimas-homesuite` ya existe

## 7b. Solicitudes, copias locales y operación

- [ ] 7b.1 Escribir el script de operación que elimina un grupo por pedido de su persona titular recibido por correo (en seco por defecto, confirmación, `group_deleted` con la persona que actúa nula y el identificador de la solicitud en los metadatos); verificar con una prueba de integración que escribe el mismo evento y deja el grupo en la ventana, sin atajos
- [ ] 7b.2 Agregar a `docs/HOMESUITE_SOLICITUDES_DATOS.md` (de `politica-y-aceptacion`) el caso «supresión de un grupo» con la plantilla de respuesta (inaccesible ya; purga a los 30 días; copias hasta 90 días) y el caso «una integrante pide suprimir sus datos: sale del grupo o da de baja su cuenta, el grupo no se elimina»
- [ ] 7b.3 Inventariar las copias locales (`~/dev/tas-king-backups/homesuite-app/staging/`, `.wrangler/`, directorios temporales de ensayos) y registrar en `docs/HOMESUITE_RECOVERY.md` qué hay, de qué datos y cada cuánto se limpia; confirmar si staging contiene datos reales de la importación de prueba y registrar la decisión de Pablo (Open Questions 3)
- [ ] 7b.4 Limpiar los respaldos locales de staging con más de 90 días y documentar la regla «staging y copias locales solo con datos sintéticos»; verificar con el inventario

## 8. Textos legales (texto legal que revisa Pablo)

- [ ] 8.1 Redactar para `apps/site/public/privacidad.html` el flujo de eliminación (la persona titular elimina; desaparece al instante; recuperable 30 días; luego purga; las copias de seguridad lo conservan hasta 90 días más, unos 120 días en total; no hay «eliminar ahora»; restaurar un respaldo no revive lo suprimido; queda un registro sin contenido; plazos de respuesta a un reclamo de supresión), reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible» en lo que corresponda al grupo, ajustar la frase de copias de seguridad y derechos de supresión, y actualizar «Última actualización». **Texto legal que revisa Pablo**
- [ ] 8.2 Redactar para `apps/site/public/terminos.html` quién puede eliminar un grupo, que las demás personas dejan de verlo de inmediato, la recomendación de exportar antes y el plazo de recuperación. **Texto legal que revisa Pablo**
- [ ] 8.3 Agregar una prueba del sitio que falle si `privacidad.html` conserva la frase «todavía no está disponible» sobre la eliminación de un grupo y si no menciona los 30 días; verificar con `npm run test:homesuite-site`

## 9. Cierre

- [ ] 9.1 Validar con `openspec validate eliminacion-de-grupos --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration` y el E2E afectado, hacer el respaldo previo al despliegue y abrir el PR sin mergear
