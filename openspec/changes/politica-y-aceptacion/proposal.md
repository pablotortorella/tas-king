## Why

Antes de aceptar datos reales, HomeSuite tiene que poder demostrar que las personas supieron qué se hace con sus datos, que lo aceptaron y que existe un camino claro para ejercer sus derechos. La investigación normativa del 2026-11-02 (Ley 1581 de 2012 y Decreto 1074 de 2015; no es asesoramiento legal y no está versionada en el repositorio) encontró estas brechas, verificadas contra el código y las páginas actuales:

- **La política de privacidad no cumple los contenidos mínimos del Decreto 1074, art. 2.2.2.25.3.1.** Tiene responsable y contacto, tratamiento y finalidad y derechos, pero faltan los **plazos** de respuesta, el **procedimiento** para ejercer cada derecho, la **vigencia de la base de datos** y la mención de la **Superintendencia de Industria y Comercio** como autoridad ante la que quejarse.
- **No hay aviso ni registro de aceptación.** Un recorrido por `apps/app/src/` no encuentra ninguna referencia a `privacidad` ni a `terminos`; las pantallas sin sesión (`/` y `/cuentas-claras`, y sus instantáneas de prueba en `apps/app/test/__snapshots__/shell/`) no enlazan ninguno de los dos textos ni dicen que continuar implica aceptarlos. Tampoco hay en la base una tabla donde guardar qué versión aceptó cada persona y cuándo. La Ley 1581 (arts. 9 y 12) exige autorización previa e informada y poder probarla; el silencio nunca vale (Decreto 1074, art. 2.2.2.25.2.4).
- **No hay edad mínima.** La Ley 1581 (art. 7) proscribe tratar datos de menores salvo los públicos; ni los términos ni la política fijan una edad.
- **La transmisión internacional no está explicada.** La política dice que los proveedores «pueden tratar datos en otros países» sin nombrar a GitHub (que ejecuta el respaldo diario), sin decir que Cloudflare y GitHub son encargados y sin que exista constancia escrita de la aceptación de sus contratos de tratamiento de datos (DPA).
- **No hay procedimiento para atender solicitudes por correo ni forma de medir los plazos legales** (consultas 10 días hábiles, reclamos 15; arts. 14 y 15), aunque la política ya se compromete a atenderlas.

Decisión de Pablo (2026-11-02): este change va **primero** y no depende de ningún otro. Los textos legales los redacta este change como propuesta y **los revisa Pablo** (idealmente con una persona abogada especialista en datos); nada se publica por haberse escrito.

## What Changes

- **Política de tratamiento completa** en `apps/site/public/privacidad.html`, con los seis contenidos mínimos del Decreto 1074 y los bloques de la investigación (versionada en [`docs/HOMESUITE_NORMATIVA_DATOS.md`](../../../docs/HOMESUITE_NORMATIVA_DATOS.md)): finalidades y autorización; carácter facultativo, datos sensibles y edad mínima; encargados y transmisión internacional; derechos, plazos y procedimiento con la mención de la SIC; vigencia de la base y copias de seguridad; personas sin cuenta; aviso previo de cambios sustanciales. Los textos sobre baja de cuenta y eliminación de grupos los escriben `baja-de-cuenta-homesuite` y `eliminacion-de-grupos`.
- **Edad mínima de 18 años** en términos, política y aviso de acceso.
- **Registro de la aceptación**, por persona, de los términos y de la política, con versión y fecha. Cuando cambia la versión, la persona debe aceptar la nueva en su siguiente visita antes de seguir usando la aplicación (salvo para exportar sus datos, cerrar sesión o dar de baja la cuenta).
- **Aviso y enlaces en la pantalla de acceso:** «Al continuar aceptás los Términos y la Política de privacidad y confirmás que tenés 18 años o más», con ambos enlaces, en toda pantalla que ofrezca «Continuar con Google», y enlaces a ambos textos en el pie de la aplicación.
- **Transmisión internacional y encargados:** `docs/HOMESUITE_ENCARGADOS.md` con cada proveedor, su papel (Cloudflare y GitHub encargados; Google proveedor de identidad), el país, la versión del DPA aceptada y la fecha, y la tarea de documentar esa aceptación (la hace Pablo).
- **Atención de solicitudes de datos:** `docs/HOMESUITE_SOLICITUDES_DATOS.md` con el procedimiento por tipo (consulta, reclamo de corrección o supresión, revocación), el registro de cada solicitud (fechas de recibo, de la leyenda «reclamo en trámite» y de respuesta) y una calculadora de plazos en días hábiles de Colombia, y su inclusión en la revisión semanal de `alertas-minimas-homesuite`.
- **Medidas técnicas del respaldo en GitHub:** comprobar que el workflow no deja artefactos ni registros con datos y documentar qué ve GitHub. Decisión de Pablo (2026-11-02): el respaldo no se cifra antes de salir del runner por ahora (pierde la verificación automática de restauración y exige custodiar una clave); se revisa si el respaldo sale de Cloudflare o cambia el runner (ver `design.md`, D10).
- **Advertencia de datos sensibles** junto a los campos de texto libre (nombres, descripciones y notas): no escribas salud, religión ni afiliaciones.

### Non-goals

- Inscripción en el Registro Nacional de Bases de Datos: una persona natural no está obligada según el Decreto 1074 (art. 2.2.2.26.1.2, modificado por el Decreto 090 de 2018); se documenta y se revisa si HomeSuite se constituye como sociedad o entidad sin ánimo de lucro.
- Normas de otras jurisdicciones (RGPD, Ley 25.326 de Argentina): hoy no hay indicio de que apliquen; se dejan anotadas para revisar si cambia el público.
- Verificar la edad (es una declaración).
- Banner de cookies: las cookies que usa la aplicación son de sesión y de preferencia; no se evalúa aquí si exigen aviso.
- Los textos sobre baja de cuenta y eliminación de grupos (otros changes) y el procedimiento de baja.
- Cambiar el contenido funcional de la aplicación.

## Capabilities

### New Capabilities

- `politica-de-tratamiento-de-datos`: contenidos mínimos de la política, edad mínima, encargados y transmisión, plazos y procedimiento, advertencia de datos sensibles.
- `aceptacion-de-terminos`: aviso y enlaces en el acceso, registro versionado de la aceptación y nueva aceptación ante cambios.
- `atencion-de-solicitudes-de-datos`: registro y medición de los plazos legales de las solicitudes por correo.

### Modified Capabilities

<!-- Ninguna: openspec/specs/plataforma-homesuite-minima describe la sesión y el inicio de sesión con Google, pero este change agrega comportamiento nuevo sin cambiar sus requisitos. -->

## Impact

- `apps/site/public/privacidad.html` y `terminos.html` (textos legales que revisa Pablo).
- `apps/app/migrations/`: una migración nueva (la siguiente libre): tabla `legal_acceptances`. Aditiva.
- `apps/app/src/`: `routes/shell.js` (pantalla de acceso con aviso y enlaces, pie), `auth.js` (estado firmado con las versiones mostradas y registro en el retorno), `route-kit.js` o `index.js` (puerta de nueva aceptación), `remanso.js` (su propio enlace de acceso), un módulo `legal.js` con las versiones, y los campos de texto libre de `ledger-ui.js`, `people-ui.js` y `group-ui.js` (advertencia).
- `docs/HOMESUITE_ENCARGADOS.md` y `docs/HOMESUITE_SOLICITUDES_DATOS.md` (nuevos), `scripts/` (calculadora de plazos), `docs/HOMESUITE_DATA_LIFECYCLE.md`, STATUS y backlog.
- Pruebas: unitarias de versiones y de plazos hábiles, integración D1 del registro y de la puerta, E2E del acceso en 390 px y escritorio.

## Dependencias y orden

Orden de los seis changes de esta serie:

1. **`politica-y-aceptacion`** (este). Sin dependencias; va primero.
2. `alertas-minimas-homesuite` y `exportacion-completa-del-grupo`. Independientes entre sí.
3. `salir-y-quitar-integrantes`.
4. `eliminacion-de-grupos`.
5. `baja-de-cuenta-homesuite`.

Los changes 4 y 5 completan los textos de la política con lo que construyen. Este change deja la puerta de aceptación de modo que la baja de cuenta y la exportación de datos funcionen incluso con una versión sin aceptar.

## Relación con los respaldos de 90 días

La política y los términos deben decir, con los mismos números que la operación, que las copias de seguridad se conservan 90 días y que los datos suprimidos no se restauran (cada supresión se reaplica tras una restauración; ver `eliminacion-de-grupos` y `baja-de-cuenta-homesuite`). Este change fija la **vigencia de la base** que la política debe declarar: mientras exista la cuenta o el grupo y, en las copias, hasta 90 días más. Los registros de aceptación viajan en los respaldos como cualquier tabla; se conservan como prueba de la autorización con identificador opaco.

## Auditoría

- `legal_acceptances`: una fila por persona, documento y versión con la fecha y el medio (`login` o `puerta`). Es la prueba de la autorización.
- El registro de solicitudes por correo (fuera del repositorio, privado) deja constancia de recibo, leyenda «reclamo en trámite» y respuesta con sus fechas.
- Los cambios de versión de los textos legales quedan en el historial de Git y en la constante de versiones del código, que una prueba obliga a mantener alineada con la fecha de «Última actualización» de cada página.

## Permisos de titular y de integrante

La aceptación vale igual para toda persona con cuenta, sea titular o integrante: nadie usa la aplicación sin haber aceptado la versión vigente. Las personas que figuran en un grupo sin tener cuenta no aceptan nada (no hay autorización previa de su parte): la política les da un canal de contacto y dice que quien las registró es quien aportó el dato. El procedimiento de solicitudes lo opera únicamente Pablo.

## Móvil

El aviso de acceso se lee sin ampliar en 390 px y sus dos enlaces miden al menos 44 px de alto; el aviso aparece encima o junto al botón «Continuar con Google», no al final de la página. La pantalla de nueva aceptación es de una columna con dos botones de 44 px. Las páginas legales del sitio son legibles en teléfono (ya lo son; se verifica de nuevo).

## Páginas legales

Este change es el principal en textos legales. Todas las tareas de redacción están en el punto 4 de `tasks.md` y son **texto legal que revisa Pablo**: no se publica sin su lectura y, si Pablo lo decide, la de una persona abogada. Los textos propuestos parten de los ocho bloques de la investigación y se adaptan al lenguaje de las páginas actuales (voseo, lenguaje sin género).
