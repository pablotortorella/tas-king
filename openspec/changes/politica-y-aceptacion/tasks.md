## 1. Versiones y registro de aceptación

- [ ] 1.1 Crear `apps/app/src/legal.js` con `LEGAL_DOCUMENTS` (versión por documento, ruta y `upcoming` opcional) y la función que construye los enlaces por ambiente con la misma regla que `tools.js`; verificar con pruebas unitarias de los enlaces de producción y de staging
- [ ] 1.2 Escribir la prueba que lee `apps/site/public/privacidad.html` y `terminos.html`, extrae la fecha de «Última actualización» y falla si difiere de la constante; verificar que falla al cambiar una sola de las dos
- [ ] 1.3 Escribir la migración nueva (la siguiente libre) con `legal_acceptances` (clave `(user_id, document, version)`, método `login` o `gate`); verificar actualizando desde el esquema anterior con datos

## 2. Aviso y enlaces en el acceso

- [ ] 2.1 Verificar y registrar en el PR la ausencia actual de enlaces a términos y privacidad (`grep` en `apps/app/src/` y las instantáneas de `apps/app/test/__snapshots__/shell/`) y comprobarla también en la pantalla de producción
- [ ] 2.2 Crear `renderSignInNotice()` con el texto del aviso (aceptación y 18 años) y los dos enlaces, y usarlo en `/`, `/cuentas-claras` sin sesión, la pantalla de invitación sin sesión y el acceso de Remanso; verificar con una prueba que recorre las pantallas públicas y falla si una contiene `/auth/google` sin el aviso y sus enlaces
- [ ] 2.3 Agregar el pie «Privacidad · Términos y condiciones» a la aplicación, con y sin sesión; actualizar las instantáneas de `apps/app/test/__snapshots__/shell/` y verificar que cada cambio es intencional
- [ ] 2.4 Guardar las versiones mostradas en la cookie firmada de estado de `/auth/google` y registrarlas en el retorno junto con `upsertGoogleUser`; verificar con pruebas de integración el primer ingreso, el cambio de versión durante el flujo y el acceso por enlace directo sin registro
- [ ] 2.5 Agregar la advertencia «No escribas datos sensibles (salud, religión, afiliaciones)» junto a los campos de texto libre (persona, descripción y nota del movimiento, nombre y descripción del grupo); verificar con pruebas de vistas

## 3. Puerta de nueva aceptación

- [ ] 3.1 Implementar el middleware de la puerta con la lista de rutas exentas (aceptar, cerrar sesión, `/healthz`, estáticos, páginas legales, descarga de los datos propios y baja de cuenta) y `GET/POST /aceptar`; verificar con pruebas de integración la redirección, el 403 de las mutaciones, el cierre de sesión sin aceptar y que la baja de cuenta funciona con una versión pendiente
- [ ] 3.2 Implementar la franja de aviso previo para `upcoming` y la exigencia desde `effectiveFrom`; verificar con pruebas con el reloj controlado
- [ ] 3.3 Aceptar automáticamente las versiones vigentes en modo de desarrollo local y en los E2E con identidades de desarrollo, salvo en las pruebas de la puerta; verificar que los E2E existentes pasan sin cambios
- [ ] 3.4 Dejar la puerta apagable por una variable de entorno para el despliegue y verificar el comportamiento apagado y encendido

## 4. Textos legales (texto legal que revisa Pablo)

Cada tarea redacta el texto propuesto en un commit aparte del código; ninguno se publica sin la lectura de Pablo, que queda registrada en el PR. Se recomienda que los lea además una persona abogada especialista en datos.

- [ ] 4.1 Redactar para `privacidad.html` el bloque **finalidades y autorización**: crear y mantener la cuenta, operar los grupos de Cuentas Claras, proteger el servicio y atender solicitudes; aceptación por conducta inequívoca al iniciar sesión; revocación con los límites descritos. **Texto legal que revisa Pablo**
- [ ] 4.2 Redactar el bloque **carácter facultativo, datos sensibles y edad mínima**: HomeSuite no pide datos sensibles, no los escribas, responder es voluntario y se puede pedir su supresión; edad mínima de 18 años. **Texto legal que revisa Pablo**
- [ ] 4.3 Redactar el bloque **encargados y transmisión internacional**: Cloudflare (alojamiento, base de datos y copias) y GitHub (ejecución transitoria de las copias) como encargados con contratos de tratamiento de datos; procesamiento en Estados Unidos y otros países; Estados Unidos entre los países con nivel adecuado según la SIC; Google como proveedor de identidad. No afirmar una ubicación garantizada de los datos. **Texto legal que revisa Pablo**
- [ ] 4.4 Redactar el bloque **derechos, plazos y procedimiento**: responsable y correo, consultas en 10 días hábiles (más 5), reclamos en 15 días hábiles (más 8), contenido del reclamo, subsanación en 5 días, acceso gratuito, mención de la Superintendencia de Industria y Comercio como autoridad tras agotar el trámite. **Texto legal que revisa Pablo**
- [ ] 4.5 Redactar el bloque **copias de seguridad y vigencia de la base**: la base se conserva mientras exista la cuenta o el grupo; las copias de seguridad vencen a los 90 días y lo suprimido no se restaura. Los textos de baja y eliminación los redactan sus changes. **Texto legal que revisa Pablo**
- [ ] 4.6 Redactar el bloque **personas sin cuenta**: quien registró a la persona aportó el dato; el canal para conocer, corregir o pedir la supresión. **Texto legal que revisa Pablo**
- [ ] 4.7 Redactar el bloque **cambios sustanciales**: se comunican antes de aplicarse (franja en la aplicación). **Texto legal que revisa Pablo**
- [ ] 4.8 Redactar para `terminos.html` la edad mínima de 18 años, que continuar implica aceptar términos y política, y la actualización de la fecha. **Texto legal que revisa Pablo**
- [ ] 4.9 Agregar la prueba del sitio que falla si `privacidad.html` carece de alguna de las secciones mínimas (responsable, finalidades, derechos, procedimiento, plazos, vigencia, mención de la SIC) o si `terminos.html` omite los 18 años; verificar con `npm run test:homesuite-site`
- [ ] 4.10 Pablo revisa los textos, decide si los lee una persona abogada, y registra la aprobación en el PR antes de integrar el cambio de las páginas

## 5. Solicitudes de datos

- [ ] 5.1 Escribir `docs/HOMESUITE_SOLICITUDES_DATOS.md`: tipos y plazos (consultas 10 días hábiles más 5; reclamos 15 más 8; leyenda «reclamo en trámite» en 2 días hábiles; subsanación en 5 días; desistimiento a los 2 meses; traslado en 2 días hábiles), columnas de la planilla privada, plantillas de acuse, subsanación, prórroga y respuesta de fondo, y el criterio «el plazo no espera a la purga física»; verificar los enlaces
- [ ] 5.2 Crear `scripts/solicitudes-plazos.mjs` y un archivo configurable de festivos de Colombia; verificar con pruebas unitarias casos con fines de semana, un festivo y las prórrogas; registrar la fuente de los festivos y marcar lo no verificado
- [ ] 5.3 Pablo crea la planilla privada con las columnas del documento y la prueba con una solicitud ficticia; registrar la fecha en STATUS sin incluir datos personales
- [ ] 5.4 Si `alertas-minimas-homesuite` ya existe, agregar a su revisión semanal «solicitudes abiertas con 5 días hábiles o menos y vencidas»

## 6. Encargados y transmisión internacional

- [ ] 6.1 Escribir `docs/HOMESUITE_ENCARGADOS.md`: proveedor, papel, país, datos tratados, versión del DPA, fecha de aceptación, enlace a su lista de subencargados y la base de la transmisión (Decreto 1074, art. 2.2.2.25.5.2), con la lista de lo no verificado (aplicabilidad a planes gratuitos, ubicación de D1 y R2, versión vigente de la lista de países de la SIC)
- [ ] 6.2 Pablo revisa y acepta los DPA de Cloudflare (v6.4) y GitHub (octubre de 2025) desde sus cuentas, anota fecha y versión en el documento y, si el proveedor lo permite, guarda una copia; consultar a cada proveedor si el DPA aplica al plan gratuito
- [ ] 6.3 Evaluar con una persona abogada si hace falta agregar las cláusulas modelo de la RIPD o una declaración propia que obligue a los encargados a aplicar la política del responsable; registrar la conclusión

## 7. Respaldo en GitHub

- [ ] 7.1 Verificar que `homesuite-production-backup.yml` no sube artefactos ni caché con datos, que no imprime contenido de la base y que el directorio temporal se destruye; registrar el resultado y documentar qué ve GitHub (runner transitorio con la base sin cifrar durante unos minutos)
- [ ] 7.2 Registrar en el documento de encargados la decisión de Pablo (2026-11-02) de no cifrar el respaldo antes de que salga del runner por ahora (motivo: se perdería la verificación automática de restauración y habría que custodiar una clave), con las condiciones para revisarla (el respaldo sale de Cloudflare o cambia el runner); no implementar el cifrado

## 8. Verificación

- [ ] 8.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) el aviso, el pie y la pantalla de aceptación: controles de al menos 44 px, sin desborde horizontal; extender las auditorías de contraste y desborde
- [ ] 8.2 Probar a mano en un teléfono real el acceso con el aviso y la nueva aceptación, y registrar modelo y navegador
- [ ] 8.3 Registrar en STATUS que las dos cuentas existentes pasan por la puerta en su primera visita y que el inicio de sesión real con Google sigue siendo una prueba manual

## 9. Cierre

- [ ] 9.1 Actualizar `docs/HOMESUITE_DATA_LIFECYCLE.md` (clases de datos: aceptaciones y solicitudes), la ficha de plataforma, STATUS y el backlog; verificar con la prueba del glosario
- [ ] 9.2 Validar con `openspec validate politica-y-aceptacion --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration`, `test:homesuite-site` y el E2E afectado, y abrir el PR sin mergear; los textos legales no se integran sin la aprobación de Pablo
