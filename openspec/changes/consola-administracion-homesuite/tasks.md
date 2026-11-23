## 1. Preparación y migración

- [x] 1.1 Contar en producción, solo en lectura y sin correos, las identidades de Tareas con `is_admin = 1`, con cuenta HomeSuite (`user_id` no nulo) y sin ella. Registrar ambos números en el PR y en el design (D10); verificar que la consulta no devuelve columnas de correo.
- [x] 1.2 Mirar `main` y fijar el número de la migración nueva después de la última, incluida cualquier migración de Codex. Escribir la migración con `users.last_active_on`, las tablas `usage_daily_counts`, `usage_period_people`, `usage_period_markers`, `usage_suite_snapshots` y `platform_roles` (D3), y la copia de `is_admin` a `platform_roles` (D10). Verificar con una prueba `node:sqlite` que aplica todas las migraciones en orden, que la copia toma solo identidades con cuenta y que la migración es idempotente con `INSERT OR IGNORE`.
- [x] 1.3 Agregar los secretos `HOMESUITE_OWNER_USER_IDS` y `USAGE_MARKER_SECRET` a la configuración local de desarrollo y de E2E (no a `wrangler.jsonc`), y documentar su alta por ambiente en `docs/homesuite/OPERACION.md`. Verificar que `npm run dev:homesuite-app` arranca con y sin ellos.

## 2. Períodos y marcas

- [x] 2.1 Crear `usage-periods.js` (D6): claves de día, semana ISO, mes, trimestre y año en Colombia (UTC−5), fin de cada período, anterior y siguiente. Verificar con pruebas unitarias los bordes: medianoche de Colombia, fin de año, semana 53, el 1 de enero en la semana ISO del año anterior y años bisiestos.
- [x] 2.2 Crear el cálculo de marca HMAC (D4), con la clave de período dentro del mensaje. Verificar con pruebas que la misma cuenta da marcas distintas en períodos distintos, que la marca no contiene el id y que sin secreto no se mide (y se registra en el log).
- [x] 2.3 Implementar el conteo de D5 en un `db.batch`. Verificar con pruebas de integración que la misma persona en veinte días de un mes cuenta 1 en el mes y 20 en días, que «hizo algo» cuenta también «entró», y que dos peticiones simultáneas del mismo día no cuentan dos veces.

## 3. Medición en el Worker

- [x] 3.1 Crear `usage-catalog.js` con la tabla de rutas de Cuentas Claras y Tareas, con método, patrón, herramienta, nivel y acción, según el spec `estadisticas-de-uso-homesuite`. Verificar con una prueba que cada ruta del catálogo existe en la app y que ninguna ruta de Jardín Zen ni de páginas sin sesión figura en él.
- [x] 3.2 Agregar el middleware de D1 después de la puerta legal y del control de mutaciones, con `waitUntil`, que mide solo respuestas exitosas (2xx o la redirección de un formulario guardado) con sesión y saltea las rutas exentas de la puerta. Verificar con pruebas de integración:
  - un movimiento cargado suma la acción y los dos niveles;
  - una carga rechazada (validación, permiso o CSRF) no suma nada;
  - una visita sin sesión no lee ni escribe la base;
  - un fallo de escritura de la medición no cambia la respuesta y deja `usage_write_failed` en el log.
- [x] 3.3 Sumar `last_active_on` a la lectura de `currentSession` y escribirlo como mucho una vez por día (D2). Verificar con pruebas que tres peticiones del mismo día escriben una vez, que el cambio de día en Colombia la actualiza y que `/aceptar` no la escribe.

## 4. Remanso

- [x] 4.1 Crear `POST /api/uso/remanso` (D8), con sesión, CSRF y límite de mutaciones, que acepta solo `{ resultado }`. Verificar con pruebas que «terminada» cuenta «hizo algo» y la acción, que «abandonada» cuenta «entró» y su acción, y que un campo extra o un valor desconocido responde 400 sin escribir nada.
- [x] 4.2 Cambiar `public/remanso/remanso.js` para enviar el resultado una sola vez por sesión, y solo si la página se sirvió con sesión y token CSRF, con «abandonada» también en `pagehide`. Verificar con E2E de Remanso:
  - sin cuenta no sale ninguna petición que no sea GET (se mantiene la prueba existente);
  - con cuenta, al completar sale una sola petición «terminada»;
  - al terminar antes de tiempo sale una sola «abandonada»;
  - ninguna de esas peticiones lleva duración, fondo ni gong.

## 5. Mantenimiento

- [x] 5.1 Sumar a `runMaintenance` la purga de marcas de los períodos cerrados y la foto diaria (D7), y agregar `purgedUsageMarkers` y `usageSnapshotDay` a `maintenance_completed`. Verificar con pruebas de integración:
  - al pasar fin de mes se borran las marcas del mes, de sus días y de sus semanas cerradas, y quedan las del trimestre y del año;
  - el contador del mes queda;
  - dos corridas el mismo día dejan una sola foto;
  - la auditoría, los contadores y la historia financiera no cambian.

## 6. Acceso a la consola

- [x] 6.1 Implementar `consoleAccess` (D9) con el secreto de dueños y `platform_roles`, y una respuesta 404 idéntica a la de una ruta inexistente para `/consola*` y `/api/consola/*`. Verificar con pruebas de integración:
  - el dueño ve las cuatro pestañas;
  - con rol `tareas` se ve solo Tareas, y Suite o Administradores responden 404;
  - sin rol, sin sesión o sin secreto responde 404 y deja `console_denied` en el log sin la cuenta;
  - el cuerpo del 404 es igual al de una ruta inexistente.
- [x] 6.2 Implementar dar y quitar roles, solo para dueños, con CSRF y límite de mutaciones. Verificar con pruebas que un administrador de herramienta recibe 404, que sin CSRF se rechaza y que cada cambio deja `platform_role_granted` o `platform_role_revoked`.
- [x] 6.3 Mostrar el enlace «Consola» en el menú de la cuenta solo a quien tiene acceso. Verificar con pruebas de la interfaz que aparece para el dueño y para un rol, y no para una cuenta sin rol.

## 7. Pestañas

- [x] 7.1 Pestaña Suite (spec `consola-administracion-homesuite`), dibujada en el servidor:
  - selector de período por enlace;
  - cuentas y activas de 1, 7 y 30 días, con serie SVG y tabla equivalente;
  - la tabla por herramienta con entró, hizo algo, proporción y diferencia absoluta;
  - las acciones del período;
  - la serie de cada herramienta al elegirla;
  - el mensaje «sin datos» para períodos anteriores a la publicación.

  Verificar con pruebas de la interfaz sobre datos sembrados que los números y las diferencias coinciden y que no hay porcentajes de variación. Verificar con E2E en teléfono y escritorio, con teclado y lector de pantalla (texto alternativo de los SVG).
- [x] 7.2 Pestaña Tareas: totales y lista de cuentas con nombre y correo para dueño y rol `tareas`, y el ranking solo para el dueño. Verificar con pruebas que el rol no recibe el ranking (ni en el HTML ni en la API), que cada vista de la lista deja `console_accounts_viewed` y que la pestaña no muestra contenido de tableros.
- [x] 7.3 Pestaña Cuentas Claras: queda prevista con un texto que dice que no hay herramientas todavía, visible para el dueño y para el rol `cuentas-claras`. Verificar con una prueba de acceso.
- [x] 7.4 Pestaña Administradores: roles vigentes, dar y quitar, dueños del secreto marcados como tales y sin poder quitarse, historial de roles y últimas entradas a la consola. Verificar con E2E que se da y se quita un rol de Tareas y que el historial lo muestra.
- [x] 7.5 Auditoría de entrada (D11): `console_opened`, una por persona y por día, con la pestaña. Verificar con pruebas que dos entradas el mismo día dejan una sola fila y que ningún metadato de auditoría de la consola contiene un correo.

## 8. Tareas integrada

- [x] 8.1 Cambiar `/api/tareas/me` para calcular `isAdmin` como «dueño o rol `tareas`», sin leer `is_admin`. Retirar `/api/tareas/admin/set-admin` y mover `users` y `stats` a la consola (D10). Verificar con pruebas de integración que una identidad con `is_admin = 1` y sin rol ya no administra, y que el rol migrado sí.
- [x] 8.2 Reducir el panel de `public/tareas/js/admin.js` y de `document.js` a «Actividad del tablero» y sumar el enlace «Administración» a `/consola/tareas`. Verificar con la E2E `critical-flows` adaptada: el administrador ve la actividad y el enlace, y no ve controles de rol.

## 9. Textos legales y documentación

- [ ] 9.1 **Texto legal que revisa Pablo:** redactar la propuesta de `apps/site/public/privacidad.html`:
  - la última actividad;
  - la estadística agregada, incluido el resultado de Remanso con cuenta, con el ajuste de «no guardamos el historial de sesiones»;
  - que los roles de administración por herramienta ven las cuentas con sus correos;
  - que el ranking de Tareas lo ve solo el dueño.

  Entregarla a Pablo como diff y esperar su aprobación antes de cambiar «Última actualización», «entra en vigor» y la versión en `legal.js`. Ajustar las pruebas del sitio y de `legal.test.js` que citen las frases o la versión.
- [x] 9.2 Agregar al glosario (`docs/homesuite/GLOSARIO.md`) «dueño de la suite», «rol de herramienta», «entró», «hizo algo», «período cerrado» y «consola», y correr `apps/app/test/glossary.test.js`.
- [x] 9.3 Actualizar:
  - `docs/productos/PLATAFORMA.md`: consola, roles y medición;
  - `docs/productos/TASKING.md`: la administración pasa a la consola;
  - `docs/productos/REMANSO.md`: el resultado con cuenta;
  - `docs/HOMESUITE_DATA_LIFECYCLE.md`: `last_active_on`, las marcas y su purga, y los contadores sin borrado;
  - el ítem del backlog.

  Verificar los enlaces.
- [x] 9.4 Revisar todo texto nuevo de la interfaz: español rioplatense con voseo, lenguaje sin género y `glossary.test.js` en verde.

## 10. Verificación y publicación

- [ ] 10.1 Correr `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app`, `npm run test:e2e:remanso`, `npm run test:e2e:tasking`, `npm run test:homesuite-site` y `openspec validate consola-administracion-homesuite --strict`. Registrar comandos, SHA y resultados en el PR.
- [ ] 10.2 Levantar la versión local (`npm run dev`) con una cuenta dueña, otra con rol de Tareas y otra sin rol. Ofrecerle a Pablo la URL local con qué mirar (las cuatro pestañas, el 404 y la actividad de Tareas) y esperar su OK antes de proponer staging.
- [ ] 10.3 Staging, con orden de Pablo: configurar los secretos, publicar migración, sitio y app (D12), y hacer el smoke con las tres cuentas. Verificar también un día de medición real: al día siguiente, la foto y los contadores existen y las marcas del día anterior se purgaron.
- [ ] 10.4 Producción solo con orden explícita de Pablo, en el orden migración, sitio y app, y después `npm run verify:coherence:production`. Actualizar STATUS y el handoff en un PR de documentación aparte.
- [ ] 10.5 Archivar el change cuando esté verificado en producción, con el spec sincronizado.
