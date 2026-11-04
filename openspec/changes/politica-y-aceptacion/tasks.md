## 1. Versiones y registro de aceptación

- [x] 1.1 Crear `apps/app/src/legal.js` con `LEGAL_DOCUMENTS` (versión por documento, ruta y `upcoming` opcional) y la función que construye los enlaces por ambiente con la misma regla que `tools.js`; verificar con pruebas unitarias de los enlaces de producción y de staging
  - Hecho 2026-11-04: `apps/app/src/legal.js` y `legal-ui.js`; `apps/app/test/legal.test.js` (enlaces de producción y de staging, versión próxima con reloj controlado, puerta y rutas exentas).
- [x] 1.2 Escribir la prueba que lee `apps/site/public/privacidad.html` y `terminos.html`, extrae la fecha de «Última actualización» y falla si difiere de la constante; verificar que falla al cambiar una sola de las dos
  - Hecho: `apps/app/test/legal-versions.test.js`. Si hay una versión próxima anunciada, la página debe mostrar la nueva. Falla al cambiar solo la página o solo la constante (comprobado a mano y con un caso en la prueba).
- [x] 1.3 Escribir la migración nueva (la siguiente libre) con `legal_acceptances` (clave `(user_id, document, version)`, método `login` o `gate`); verificar actualizando desde el esquema anterior con datos
  - Hecho: `apps/app/migrations/0013_legal_acceptances.sql` (aditiva, compatible con el código anterior) y `apps/app/test/legal-migration.test.js` (aplica 0001 a 0012 con datos, luego 0013, y comprueba que lo previo queda intacto y las restricciones).

## 2. Aviso y enlaces en el acceso

- [x] 2.1 Verificar y registrar en el PR la ausencia actual de enlaces a términos y privacidad (`grep` en `apps/app/src/` y las instantáneas de `apps/app/test/__snapshots__/shell/`) y comprobarla también en la pantalla de producción
  - Hecho 2026-11-04, sin PR (no se abrió): la búsqueda de «privacidad», «terminos» y «términos» sobre `main` (`3fe9cd6`) en `apps/app/src` y `apps/app/test/__snapshots__` devuelve 0 archivos. Producción (GET de solo lectura): `https://app.homesuite.info/` responde 200 y contiene «Continuar con Google» sin ninguna mención a privacidad ni a términos; `/cuentas-claras` responde 303 directo a `/auth/google?returnTo=%2Fcuentas-claras`.
- [x] 2.2 Crear `renderSignInNotice()` con el texto del aviso (aceptación y 18 años) y los dos enlaces, y usarlo en `/`, `/cuentas-claras` sin sesión, la pantalla de invitación sin sesión y el acceso de Remanso; verificar con una prueba que recorre las pantallas públicas y falla si una contiene `/auth/google` sin el aviso y sus enlaces
  - Hecho con una discrepancia: solo `/` y el acceso de Remanso muestran una pantalla con «Continuar con Google»; `/cuentas-claras`, `/invitations`, `/perfil` y `/groups` sin sesión **redirigen directo a Google** (no hay pantalla de invitación sin sesión). Esas rutas no llevan aviso: la persona vuelve sin aceptación registrada y la puerta se la pide en `/aceptar`. No se cambió ese comportamiento (decisión de producto; ver el reporte). Prueba: `apps/app/test/legal-notice.test.js`.
- [x] 2.3 Agregar el pie «Privacidad · Términos y condiciones» a la aplicación, con y sin sesión; actualizar las instantáneas de `apps/app/test/__snapshots__/shell/` y verificar que cada cambio es intencional
  - Hecho: pie en `renderPage` (marca completada por el servidor según el ambiente); las 4 instantáneas de `apps/app/test/__snapshots__/shell/` cambian solo por el pie.
  - Excepción: la pantalla de Remanso no lleva el pie (ver 8.1).
- [x] 2.4 Guardar las versiones mostradas en la cookie firmada de estado de `/auth/google` y registrarlas en el retorno junto con `upsertGoogleUser`; verificar con pruebas de integración el primer ingreso, el cambio de versión durante el flujo y el acceso por enlace directo sin registro
  - Hecho: `/auth/google?acepta=1` guarda las versiones en la cookie firmada de estado; el retorno las registra (`apps/app/test/legal.integration.test.js`: primer ingreso, cambio de versión durante el flujo, enlace directo sin registro). El inicio de sesión con Google se simula con un ID token firmado localmente; el login real sigue siendo una prueba manual.
- [x] 2.5 Agregar la advertencia «No escribas datos sensibles (salud, religión, afiliaciones)» junto a los campos de texto libre (persona, descripción y nota del movimiento, nombre y descripción del grupo); verificar con pruebas de vistas
  - Hecho: `SENSITIVE_HINT` junto a descripción y nota del movimiento, nombre de persona (agregar y renombrar), nombre y descripción del grupo (crear y administrar). Pruebas: `apps/app/test/sensitive-hint.test.js` y E2E.

## 3. Puerta de nueva aceptación

- [ ] 3.1 Implementar el middleware de la puerta con la lista de rutas exentas (aceptar, cerrar sesión, `/healthz`, estáticos, páginas legales, descarga de los datos propios y baja de cuenta) y `GET/POST /aceptar`; verificar con pruebas de integración la redirección, el 403 de las mutaciones, el cierre de sesión sin aceptar y que la baja de cuenta funciona con una versión pendiente
  - Hecho 2026-11-04 salvo un punto: puerta en `index.js`, rutas exentas en `GATE_EXEMPT` (`legal.js`), `GET/POST /aceptar`, pruebas de integración de la redirección, el 403 de las mutaciones y la API, el cierre de sesión sin aceptar y la descarga de datos. **Falta** verificar que la baja de cuenta funciona con una versión pendiente: esa ruta todavía no existe. El change `baja-de-cuenta-homesuite` debe sumar su ruta a `GATE_EXEMPT` y probarlo (requisito del spec «Baja con versión sin aceptar»).
- [x] 3.2 Implementar la franja de aviso previo para `upcoming` y la exigencia desde `effectiveFrom`; verificar con pruebas con el reloj controlado
  - Hecho: `upcoming` en `LEGAL_DOCUMENTS`, franja `legal-band` solo con sesión y exigencia desde `effectiveFrom` (hora de Colombia); pruebas unitarias con reloj controlado y de integración.
- [x] 3.3 Aceptar automáticamente las versiones vigentes en modo de desarrollo local y en los E2E con identidades de desarrollo, salvo en las pruebas de la puerta; verificar que los E2E existentes pasan sin cambios
  - Hecho: `/api/local/session` acepta las versiones vigentes (`sin_aceptar=1` lo evita, solo para probar la puerta). `dev:e2e:homesuite-app` y `dev:homesuite-app` corren con `LEGAL_GATE:on`; los E2E existentes pasan sin cambios.
- [x] 3.4 Dejar la puerta apagable por una variable de entorno para el despliegue y verificar el comportamiento apagado y encendido
  - Hecho: `LEGAL_GATE=on` la enciende; sin la variable queda apagada. `wrangler.jsonc`: staging `on`, producción `off` (se enciende después de publicar los textos).

## 4. Textos legales (texto legal que revisa Pablo)

Cada tarea redacta el texto propuesto en un commit aparte del código; ninguno se publica sin la lectura de Pablo, que queda registrada en el PR. Se recomienda que los lea además una persona abogada especialista en datos.

- [x] 4.1 Redactar para `privacidad.html` el bloque **finalidades y autorización**: crear y mantener la cuenta, operar los grupos de Cuentas Claras, proteger el servicio y atender solicitudes; aceptación por conducta inequívoca al iniciar sesión; revocación con los límites descritos. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.2 Redactar el bloque **carácter facultativo, datos sensibles y edad mínima**: HomeSuite no pide datos sensibles, no los escribas, responder es voluntario y se puede pedir su supresión; edad mínima de 18 años. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.3 Redactar el bloque **encargados y transmisión internacional**: Cloudflare (alojamiento, base de datos y copias) y GitHub (ejecución transitoria de las copias) como encargados con contratos de tratamiento de datos; procesamiento en Estados Unidos y otros países; Estados Unidos entre los países con nivel adecuado según la SIC; Google como proveedor de identidad. No afirmar una ubicación garantizada de los datos. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.4 Redactar el bloque **derechos, plazos y procedimiento**: responsable y correo, consultas en 10 días hábiles (más 5), reclamos en 15 días hábiles (más 8), contenido del reclamo, subsanación en 5 días, acceso gratuito, mención de la Superintendencia de Industria y Comercio como autoridad tras agotar el trámite. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.5 Redactar el bloque **copias de seguridad y vigencia de la base**: la base se conserva mientras exista la cuenta o el grupo; las copias de seguridad vencen a los 90 días y lo suprimido no se restaura. Los textos de baja y eliminación los redactan sus changes. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.6 Redactar el bloque **personas sin cuenta**: quien registró a la persona aportó el dato; el canal para conocer, corregir o pedir la supresión. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.7 Redactar el bloque **cambios sustanciales**: se comunican antes de aplicarse (franja en la aplicación). **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.8 Redactar para `terminos.html` la edad mínima de 18 años, que continuar implica aceptar términos y política, y la actualización de la fecha. **Texto legal que revisa Pablo**
  - BORRADOR redactado el 2026-11-04 (comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en el HTML); **no aprobado**, ver 4.10.
- [x] 4.9 Agregar la prueba del sitio que falla si `privacidad.html` carece de alguna de las secciones mínimas (responsable, finalidades, derechos, procedimiento, plazos, vigencia, mención de la SIC) o si `terminos.html` omite los 18 años; verificar con `npm run test:homesuite-site`
  - Hecho: `apps/site/test/legal.test.js`; `npm run test:homesuite-site` pasa.
- [ ] 4.10 Pablo revisa los textos, decide si los lee una persona abogada, y registra la aprobación en el PR antes de integrar el cambio de las páginas
  - **Espera a Pablo.** Lista de los bloques de borrador: cada comentario «BORRADOR PENDIENTE DE REVISIÓN DE PABLO» en `apps/site/public/privacidad.html` (tareas 4.1 a 4.7) y `terminos.html` (4.8). Al aprobar: quitar esos comentarios, y si cambia la fecha de «Última actualización», actualizar las dos páginas, la frase «entra en vigor el …» y la constante de `apps/app/src/legal.js`.

## 5. Solicitudes de datos

- [x] 5.1 Escribir `docs/HOMESUITE_SOLICITUDES_DATOS.md`: tipos y plazos (consultas 10 días hábiles más 5; reclamos 15 más 8; leyenda «reclamo en trámite» en 2 días hábiles; subsanación en 5 días; desistimiento a los 2 meses; traslado en 2 días hábiles), columnas de la planilla privada, plantillas de acuse, subsanación, prórroga y respuesta de fondo, y el criterio «el plazo no espera a la purga física»; verificar los enlaces
  - Hecho: `docs/HOMESUITE_SOLICITUDES_DATOS.md`; enlaces verificados. Es una propuesta que Pablo debe adoptar.
- [x] 5.2 Crear `scripts/solicitudes-plazos.mjs` y un archivo configurable de festivos de Colombia; verificar con pruebas unitarias casos con fines de semana, un festivo y las prórrogas; registrar la fuente de los festivos y marcar lo no verificado
  - Hecho: `scripts/solicitudes-plazos.mjs`, `scripts/festivos-colombia.json` y `apps/app/test/solicitudes-plazos.test.js`. Fuente de los festivos: regla de la Ley 51 de 1983 y fecha de Pascua, **calculada y NO verificada** contra el calendario oficial (`verificado: false`; el script avisa en cada corrida). Lo no verificado queda para Pablo.
- [ ] 5.3 Pablo crea la planilla privada con las columnas del documento y la prueba con una solicitud ficticia; registrar la fecha en STATUS sin incluir datos personales
  - **Espera a Pablo.**
- [ ] 5.4 Si `alertas-minimas-homesuite` ya existe, agregar a su revisión semanal «solicitudes abiertas con 5 días hábiles o menos y vencidas»
  - No se hizo para no tocar los archivos de `alertas-minimas-homesuite`, que otro trabajo modifica en paralelo. Mientras tanto, `docs/HOMESUITE_SOLICITUDES_DATOS.md` («Revisión semanal») indica correr `node scripts/solicitudes-plazos.mjs` a mano cada semana. Queda para cuando ese change se integre.

## 6. Encargados y transmisión internacional

- [x] 6.1 Escribir `docs/HOMESUITE_ENCARGADOS.md`: proveedor, papel, país, datos tratados, versión del DPA, fecha de aceptación, enlace a su lista de subencargados y la base de la transmisión (Decreto 1074, art. 2.2.2.25.5.2), con la lista de lo no verificado (aplicabilidad a planes gratuitos, ubicación de D1 y R2, versión vigente de la lista de países de la SIC)
  - Hecho: `docs/HOMESUITE_ENCARGADOS.md`, con la lista de lo no verificado. Las fechas de aceptación de los DPA quedan como **PENDIENTE** (6.2).
- [ ] 6.2 Pablo revisa y acepta los DPA de Cloudflare (v6.4) y GitHub (octubre de 2025) desde sus cuentas, anota fecha y versión en el documento y, si el proveedor lo permite, guarda una copia; consultar a cada proveedor si el DPA aplica al plan gratuito
  - **Espera a Pablo.** Los campos «PENDIENTE» están en `docs/HOMESUITE_ENCARGADOS.md`.
- [ ] 6.3 Evaluar con una persona abogada si hace falta agregar las cláusulas modelo de la RIPD o una declaración propia que obligue a los encargados a aplicar la política del responsable; registrar la conclusión
  - **Espera a Pablo** (con una persona abogada).

## 7. Respaldo en GitHub

- [x] 7.1 Verificar que `homesuite-production-backup.yml` no sube artefactos ni caché con datos, que no imprime contenido de la base y que el directorio temporal se destruye; registrar el resultado y documentar qué ve GitHub (runner transitorio con la base sin cifrar durante unos minutos)
  - Hecho 2026-11-04 por lectura del flujo y los scripts (no se corrió el respaldo): sin `upload-artifact` ni caché de datos, sin salida de contenido y con directorios temporales destruidos por `trap`. Detalle y límites en `docs/HOMESUITE_ENCARGADOS.md`, «Respaldo en GitHub».
- [x] 7.2 Registrar en el documento de encargados la decisión de Pablo (2026-11-02) de no cifrar el respaldo antes de que salga del runner por ahora (motivo: se perdería la verificación automática de restauración y habría que custodiar una clave), con las condiciones para revisarla (el respaldo sale de Cloudflare o cambia el runner); no implementar el cifrado
  - Hecho: decisión de no cifrar registrada con sus condiciones de revisión en `docs/HOMESUITE_ENCARGADOS.md`; no se implementó el cifrado.

## 8. Verificación

- [x] 8.1 Verificar con E2E en 390 px y escritorio (claro y oscuro) el aviso, el pie y la pantalla de aceptación: controles de al menos 44 px, sin desborde horizontal; extender las auditorías de contraste y desborde
  - Hecho 2026-11-04: `apps/app/e2e/legal.spec.js` (aviso, pie y `/aceptar` en 390 px y escritorio, claro y oscuro: enlaces y botones de al menos 44 px, sin desborde horizontal, contraste) y una prueba nueva en `apps/app/e2e-remanso/remanso.spec.js` para el aviso de Remanso. Las auditorías de contraste y desborde existentes de `design.spec.js` recorren ahora también el pie. **Excepción:** Remanso no lleva el pie (su inicio y su cierre se diseñaron para verse completos sin desplazarse y el pie no entra); allí los enlaces aparecen junto al botón de acceso. Pablo decide si prefiere relajar ese límite.
- [ ] 8.2 Probar a mano en un teléfono real el acceso con el aviso y la nueva aceptación, y registrar modelo y navegador
  - **Espera a Pablo** (teléfono real).
- [x] 8.3 Registrar en STATUS que las dos cuentas existentes pasan por la puerta en su primera visita y que el inicio de sesión real con Google sigue siendo una prueba manual
  - Hecho: bloque del 2026-11-04 en `docs/STATUS.md` (las dos cuentas pasarán por la puerta en su primera visita; no verificado en producción; el login real con Google sigue siendo manual).

## 9. Cierre

- [x] 9.1 Actualizar `docs/HOMESUITE_DATA_LIFECYCLE.md` (clases de datos: aceptaciones y solicitudes), la ficha de plataforma, STATUS y el backlog; verificar con la prueba del glosario
  - Hecho: `docs/HOMESUITE_DATA_LIFECYCLE.md` (clases «Aceptaciones» y «Solicitudes de datos»), `docs/homesuite/GLOSARIO.md` (nuevo concepto), `docs/productos/PLATAFORMA.md`, STATUS y backlog; la prueba del glosario pasa.
- [ ] 9.2 Validar con `openspec validate politica-y-aceptacion --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration`, `test:homesuite-site` y el E2E afectado, y abrir el PR sin mergear; los textos legales no se integran sin la aprobación de Pablo
  - Hecho: `openspec validate politica-y-aceptacion --strict` y las suites listadas pasan (resultados en el reporte). **Falta:** abrir el PR (no se abrió: la rama es local y no se hizo push) y la aprobación de Pablo de los textos legales antes de integrarlos.
