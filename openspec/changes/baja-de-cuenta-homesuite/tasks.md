## 1. Esquema y triggers

- [ ] 1.1 Escribir la migración nueva (la siguiente libre): `users.deleted_at`, `ledger_participants.account_deleted_at`, tablas `account_erasures` (con `name_choice`) y `person_erasures`, y reemplazo de `ledger_events_no_update` y `entry_revisions_no_update` con la excepción acotada (baja en curso con «quitar» o supresión de una persona, fila relacionada, ninguna otra columna cambia); verificar actualizando desde el esquema anterior **con datos**
- [ ] 1.2 Auditar qué campos de nombre contienen `ledger_events.metadata_json` y `entry_revisions.snapshot_json` (renombres, `creatorName` de anulaciones, cualquier otro) y fijar la lista exacta que la excepción permite reescribir; verificar leyendo todos los productores de esos JSON en `apps/app/src/`
- [ ] 1.3 Probar los triggers: el `UPDATE` del JSON procede con baja en curso y fila relacionada; aborta sin baja en curso, con baja de otra cuenta, con elección «conservar», o si cambia cualquier otra columna (importe, fecha, actor); los `DELETE` siguen igual; verificar con pruebas de integración
- [ ] 1.4 Ejecutar el restore drill con un export que incluya los triggers nuevos y verificar que cargan y que `foreign_key_check` queda limpio

## 2. Núcleo de la baja

- [ ] 2.1 Implementar `eraseAccount` por fases idempotentes: fase 1 (sesiones, anonimización de `users` y `user_profiles` según la elección, `account_erasures`, `account_deletion_requested`), fase 2 por grupo (reescritura del JSON si «quitar», renombre numerado o marca `account_deleted_at`, desvinculación, `removeMembership` con motivo `account_deleted`), fase 3 (invitaciones y `account_deleted`); verificar con pruebas de integración cada fase, ambas elecciones y la repetición de una fase ya hecha
- [ ] 2.2 Rechazar la baja si la cuenta es titular de un grupo vivo (los grupos en ventana cuentan como resueltos); verificar con pruebas de permisos y que la baja nunca transfiere ni elimina por su cuenta
- [ ] 2.3 Rechazar toda sesión de una cuenta con `deleted_at` y verificar que el reingreso con el mismo Google crea una cuenta nueva sin relación con la anterior
- [ ] 2.4 Verificar la invariancia: los saldos por persona y moneda de cada grupo afectado son idénticos antes y después con las dos elecciones, y la exportación posterior con «quitar» no contiene el email ni el nombre (prueba con un grupo con renombres y anulaciones de la cuenta); con «conservar» el nombre aparece con la marca
- [ ] 2.5 Mostrar `<nombre> (cuenta eliminada)` en una única función de presentación de personas usada por pantallas, CSV y JSON; verificar con una prueba que recorre esas salidas
- [ ] 2.6 Limpiar `account_deleted_at` al vincular una cuenta a la persona (`resolveInvitation` con `target_participant_id`); verificar con una prueba del flujo completo: baja con «conservar», invitación ligada, aceptación, la marca desaparece y el saldo se conserva; y el mismo flujo con «quitar»
- [ ] 2.7 Probar la corrida interrumpida entre fases y la retoma por `runMaintenance` (completar las bajas `in_progress`); verificar que no duplica eventos
- [ ] 2.8 Escribir la prueba que enumera desde `sqlite_master` las columnas que referencian `users` y exige cobertura de cada una; verificar que falla con una tabla de ejemplo sin contemplar
- [ ] 2.9 Verificar que Remanso y Jardín Zen no guardan datos por persona en el servidor y que ninguna otra tabla guarda email o nombre de la cuenta; registrar el resultado

## 3. Pantallas

- [ ] 3.1 Agregar el enlace «Eliminar mi cuenta» como último elemento de «Mi perfil» y crear `GET/POST /perfil/eliminar-cuenta` con las consecuencias, la lista de grupos con sus acciones (transferir o eliminar para los propios; salida automática para los demás), las exportaciones y «Descargar mis datos», el aviso sobre TasKing, las dos opciones de nombre **sin ninguna marcada** (y el texto que dice que sin elegir se quita) y la frase de confirmación; verificar con pruebas de vistas y CSRF
- [ ] 3.2 Reconfirmar con Google si la sesión tiene más de 10 minutos: comprobar si `auth.js` admite `prompt=login` o `max_age=0`; si no, aceptar el nuevo inicio de sesión y anotar el límite; verificar el redireccionamiento de ida y vuelta
- [ ] 3.3 Crear la página final sin sesión («Tu cuenta fue eliminada») y verificar que no contiene datos de la cuenta
- [ ] 3.4 Aplicar el limitador de mutaciones a la baja y verificar el 429

## 4. Pedidos por correo

- [ ] 4.1 Escribir el script de operación de baja por pedido por correo (`eraseAccount` con «quitar», en seco por defecto, confirmación, actor nulo y el identificador `SOL-…` en los metadatos); verificar con pruebas de integración que deja la misma auditoría y el mismo resultado que la baja por pantalla con «quitar»
- [ ] 4.2 Escribir el script para la persona sin cuenta (`person_erasures`: renombre «Persona eliminada», reescritura acotada de los eventos de renombre de esa persona, `participant_pseudonymized`), en seco por defecto; verificar con una prueba de integración y que no toca otras personas
- [ ] 4.3 Agregar a `docs/HOMESUITE_SOLICITUDES_DATOS.md` (de `politica-y-aceptacion`) los casos «baja de cuenta por correo» y «persona sin cuenta», con la verificación de identidad que decida Pablo (Open Questions 2), las plantillas de respuesta y los plazos (15 días hábiles más 8; leyenda en 2 días hábiles); verificar los enlaces
- [ ] 4.4 Registrar en la planilla de solicitudes los pedidos de baja recibidos antes de este change, si los hubo, y ejecutarlos con 4.1

## 5. Móvil y accesibilidad

- [ ] 5.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) «Mi perfil» y la pantalla de baja: una columna, controles de al menos 44 px, botón de baja apartado de cancelar, campo de la frase con `autocomplete="off"` y `autocapitalize="off"`, dos opciones de nombre táctiles y sin marcar, sin desborde horizontal; extender las auditorías de contraste y desborde
- [ ] 5.2 Probar a mano el recorrido en un teléfono real y registrar modelo y navegador

## 6. Recuperación

- [ ] 6.1 Extender `scripts/homesuite-app-reapply-suppressions.sh` (de `eliminacion-de-grupos`) para reaplicar las bajas de `account_erasures` y del registro externo con la elección original de nombre, y documentarlo en `docs/HOMESUITE_RECOVERY.md`
- [ ] 6.2 Incluir la reaplicación de bajas en el ensayo de `eliminacion-de-grupos`, registrar en STATUS fecha, SHA y resultado, y verificar que la cuenta restaurada queda anonimizada, fuera de sus grupos y con la elección registrada
- [ ] 6.3 Si Pablo confirmó el registro externo, escribir allí el identificador de la cuenta al terminar la fase 1 (con reintento del cron hasta lograrlo); verificar que un fallo de R2 no deshace la baja y se reintenta

## 7. Recorrido con dos cuentas

- [ ] 7.1 Escribir un E2E con identidades de desarrollo: A (titular de un grupo con B y de uno sin nadie más) y B; B da de baja su cuenta con cada elección y A ve «Ana (cuenta eliminada)» o «Persona eliminada» con los saldos intactos; A intenta la baja, ve los grupos pendientes, elimina uno, transfiere el otro y completa la baja; verificar en Chromium y Firefox
- [ ] 7.2 Registrar en STATUS que el recorrido con dos cuentas reales de Google en staging y producción sigue siendo manual y pendiente

## 8. Excepción, glosario y documentación

- [ ] 8.1 La excepción de `UPDATE` sobre historia inmutable ya figura **aprobada por Pablo el 2026-11-02** en `docs/homesuite/README.md` (registrada en este PR); al implementar, completar el estado con la evidencia de las pruebas de las tareas 1.2 y 1.3
- [ ] 8.2 Completar `docs/HOMESUITE_DATA_LIFECYCLE.md` (punto 4: política de eliminación de cuenta, clases de datos, bloqueos de producción), `docs/HOMESUITE_PROFILE_API.md`, `docs/productos/CUENTAS-CLARAS.md` y `PLATAFORMA.md`, el glosario («Eliminar mi cuenta», «Persona eliminada», «cuenta eliminada»), STATUS y el backlog; verificar con la prueba del glosario
- [ ] 8.3 Dejar constancia en la ficha de TasKing y en `docs/productos/PLATAFORMA.md` de que su cuenta es independiente y no entra en la baja de HomeSuite, y de cómo se atiende hoy esa baja (por correo)

## 9. Textos legales (texto legal que revisa Pablo)

- [ ] 9.1 Redactar para `apps/site/public/privacidad.html` la baja autoservicio: qué se borra (email, identificador de Google, foto, perfil y sesiones), la **elección** entre conservar el nombre con la marca «(cuenta eliminada)» o quitarlo, y que sin elegir o por correo se quita; que los movimientos permanecen en los grupos de otras personas porque forman parte de sus cuentas; que las descripciones escritas por otras personas pueden mencionarla y no se modifican automáticamente (puede pedir su revisión); que la persona del grupo se puede reasociar a una cuenta nueva y la marca desaparece; la persistencia en copias de seguridad hasta 90 días y que lo suprimido no se restaura; los plazos de respuesta; el correo para TasKing y casos no cubiertos; y reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible»; actualizar «Última actualización». **Texto legal que revisa Pablo**
- [ ] 9.2 Redactar para `apps/site/public/terminos.html` las condiciones de la baja (transferir o eliminar los grupos propios, irreversible, una cuenta nueva es otra cuenta, la elección sobre el nombre y su efecto en los grupos de otras personas). **Texto legal que revisa Pablo**
- [ ] 9.3 Agregar una prueba del sitio que falle si `privacidad.html` conserva la frase «todavía no está disponible» sobre cuentas y si no menciona la baja desde «Mi perfil» y la elección del nombre; verificar con `npm run test:homesuite-site`

## 10. Cierre

- [ ] 10.1 Validar con `openspec validate baja-de-cuenta-homesuite --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration` y el E2E afectado, hacer el respaldo previo al despliegue y abrir el PR sin mergear
