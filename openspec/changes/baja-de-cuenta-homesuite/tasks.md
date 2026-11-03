## 1. Esquema y triggers

- [ ] 1.1 Escribir la migración nueva (la siguiente libre): `users.deleted_at`, tabla `account_erasures` y reemplazo de `ledger_events_no_update` y `entry_revisions_no_update` con la excepción acotada (baja en curso, fila relacionada, ninguna otra columna cambia); verificar actualizando desde el esquema anterior **con datos**
- [ ] 1.2 Auditar qué campos de nombre contienen `ledger_events.metadata_json` y `entry_revisions.snapshot_json` (renombres, `creatorName` de anulaciones, cualquier otro) y fijar la lista exacta que la excepción permite reescribir; verificar leyendo todos los productores de esos JSON en `apps/app/src/`
- [ ] 1.3 Probar los triggers: el `UPDATE` del JSON procede con baja en curso y fila relacionada; aborta sin baja en curso, con baja de otra cuenta, o si cambia cualquier otra columna (importe, fecha, actor); los `DELETE` siguen igual; verificar con pruebas de integración
- [ ] 1.4 Ejecutar el restore drill con un export que incluya los triggers nuevos y verificar que cargan y que `foreign_key_check` queda limpio

## 2. Núcleo de la baja

- [ ] 2.1 Implementar `eraseAccount` por fases idempotentes: fase 1 (sesiones, anonimización de `users` y `user_profiles`, `account_erasures`, `account_deletion_requested`), fase 2 por grupo (reescritura del JSON, renombre numerado y desvinculación, `removeMembership` con motivo `account_deleted`), fase 3 (invitaciones y `account_deleted`); verificar con pruebas de integración cada fase y la repetición de una fase ya hecha
- [ ] 2.2 Rechazar la baja si la cuenta es titular de un grupo vivo (los grupos en ventana cuentan como resueltos); verificar con pruebas de permisos y que la baja nunca transfiere ni elimina por su cuenta
- [ ] 2.3 Rechazar toda sesión de una cuenta con `deleted_at` y verificar que el reingreso con el mismo Google crea una cuenta nueva sin relación con la anterior
- [ ] 2.4 Verificar la invariancia: los saldos por persona y moneda de cada grupo afectado son idénticos antes y después, y la exportación posterior no contiene el email ni el nombre (prueba con un grupo con renombres y anulaciones de la cuenta)
- [ ] 2.5 Probar la corrida interrumpida entre fases y la retoma por `runMaintenance` (completar las bajas `in_progress`); verificar que no duplica eventos
- [ ] 2.6 Escribir la prueba que enumera desde `sqlite_master` las columnas que referencian `users` y exige cobertura de cada una; verificar que falla con una tabla de ejemplo sin contemplar
- [ ] 2.7 Verificar que Remanso y Jardín Zen no guardan datos por persona en el servidor y que ninguna otra tabla guarda email o nombre de la cuenta; registrar el resultado

## 3. Pantallas

- [ ] 3.1 Agregar el enlace «Eliminar mi cuenta» como último elemento de «Mi perfil» y crear `GET/POST /perfil/eliminar-cuenta` con las consecuencias, la lista de grupos con sus acciones (transferir o eliminar para los propios; salida automática para los demás), las exportaciones, el aviso sobre TasKing y la frase de confirmación; verificar con pruebas de vistas y CSRF
- [ ] 3.2 Exigir sesión de menos de 10 minutos: comprobar si `auth.js` admite `prompt=login` o `max_age=0` para una reautenticación real; si no, aceptar el nuevo inicio de sesión y anotar el límite; verificar el redireccionamiento de ida y vuelta
- [ ] 3.3 Crear la página final sin sesión («Tu cuenta fue eliminada») y verificar que no contiene datos de la cuenta
- [ ] 3.4 Aplicar el limitador de mutaciones a la baja y verificar el 429

## 4. Móvil y accesibilidad

- [ ] 4.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) «Mi perfil» y la pantalla de baja: una columna, controles de al menos 44 px, botón de baja apartado de cancelar, campo de la frase con `autocomplete="off"` y `autocapitalize="off"`, sin desborde horizontal; extender las auditorías de contraste y desborde
- [ ] 4.2 Probar a mano el recorrido en un teléfono real y registrar modelo y navegador

## 5. Recuperación

- [ ] 5.1 Documentar en `docs/HOMESUITE_RECOVERY.md` el paso posterior a una restauración (reaplicar `account_erasures`) y escribir el script que lo hace sobre una base local de ensayo
- [ ] 5.2 Incluir la reaplicación de bajas en el ensayo de recuperación de `eliminacion-de-grupos`, registrar en STATUS fecha, SHA y resultado, y verificar que la cuenta restaurada queda anonimizada y fuera de sus grupos
- [ ] 5.3 Registrar en `account_erasures` las bajas pedidas por correo antes de este cambio, si las hubo

## 6. Recorrido con dos cuentas

- [ ] 6.1 Escribir un E2E con identidades de desarrollo: A (titular de un grupo con B y de uno sin nadie más) y B; B da de baja su cuenta y A ve «Persona eliminada» con los saldos intactos; A intenta la baja, ve los grupos pendientes, elimina uno, transfiere el otro y completa la baja; verificar en Chromium y Firefox
- [ ] 6.2 Registrar en STATUS que el recorrido con dos cuentas reales de Google en staging y producción sigue siendo manual y pendiente

## 7. Excepción, glosario y documentación

- [ ] 7.1 Registrar en `docs/homesuite/README.md` (Registro de excepciones) la excepción de `UPDATE` sobre historia inmutable: regla, alcance, necesidad, alternativas (enmascarar al leer), riesgos, mitigación, prueba, responsable y fecha de revisión, marcada **propuesta pendiente de aprobación de Pablo**
- [ ] 7.2 Actualizar `docs/HOMESUITE_DATA_LIFECYCLE.md` (punto 4: política de eliminación de cuenta, clases de datos, bloqueos de producción), `docs/HOMESUITE_PROFILE_API.md`, `docs/productos/CUENTAS-CLARAS.md` y `PLATAFORMA.md`, el glosario, STATUS y el backlog; verificar con la prueba del glosario

## 8. Alcance de TasKing

- [ ] 8.1 Dejar constancia en la ficha de TasKing y en `docs/productos/PLATAFORMA.md` de que su cuenta es independiente y no entra en la baja de HomeSuite, y de cómo se atiende hoy esa baja (por correo)

## 9. Textos legales (texto legal que revisa Pablo)

- [ ] 9.1 Redactar para `apps/site/public/privacidad.html` la baja autoservicio: qué se borra (email, identificador de Google, nombre, foto, perfil y sesiones), qué queda (aportes seudonimizados como «Persona eliminada» en los grupos de otras personas, porque integran sus cuentas), la persistencia en copias de seguridad hasta 90 días, el correo para TasKing y casos no cubiertos, y reemplazar «La eliminación autónoma de un grupo o cuenta todavía no está disponible»; actualizar «Última actualización». **Texto legal que revisa Pablo**
- [ ] 9.2 Redactar para `apps/site/public/terminos.html` las condiciones de la baja (transferir o eliminar los grupos propios, irreversible, una cuenta nueva es otra cuenta, efecto en los grupos de otras personas). **Texto legal que revisa Pablo**
- [ ] 9.3 Agregar una prueba del sitio que falle si `privacidad.html` conserva la frase «todavía no está disponible» sobre cuentas y si no menciona la baja desde «Mi perfil»; verificar con `npm run test:homesuite-site`

## 10. Cierre

- [ ] 10.1 Validar con `openspec validate baja-de-cuenta-homesuite --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration` y el E2E afectado, hacer el respaldo previo al despliegue y abrir el PR sin mergear
