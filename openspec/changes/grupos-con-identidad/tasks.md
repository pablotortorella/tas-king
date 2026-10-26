## 1. Glosario y verificación primero

- [ ] 1.1 Escribir `docs/homesuite/GLOSARIO.md` con la tabla de conceptos (interfaz, código, URL y base) y enlazarlo desde `docs/homesuite/README.md`; verificar que el enlace resuelve y que `openspec validate grupos-con-identidad --strict` sigue pasando
- [ ] 1.2 Escribir la prueba del glosario (config de Node) que falla ante `space` o «espacio» en código, migraciones, pruebas, scripts, demo y documentación vigente, con excepciones `namespace`, `white-space`, `whitespace` y `openspec/changes/archive/`; verificar que hoy falla señalando archivo y línea, y que un fixture con `white-space` no se marca
- [ ] 1.3 Escribir la prueba de integración que recorre las pantallas de Cuentas Claras (listado, grupo, saldos, movimientos, personas, categorías, clasificar, importar, invitaciones, creación y demos) y falla ante «espacio» o «libro» en el texto visible; verificar que hoy falla

## 2. Renombre del esquema (sin cambio de comportamiento)

- [ ] 2.1 Reescribir `0001`–`0011` con `groups` y `group_id` (tablas, índices, claves, auditoría), renombrar `0006_space_slugs.sql` a `0006_group_slugs.sql`, y verificar que `e2e:setup` aplica las 11 migraciones desde una base vacía y que `grep -ri space apps/app/migrations` no devuelve nada
- [ ] 2.2 Renombrar `seed/demo.sql`, `apps/app/ops/`, `scripts/` y `wrangler.jsonc` donde corresponda y verificar que `db:seed:homesuite-demo` carga sin errores

## 3. Renombre del código (sin cambio de comportamiento)

- [ ] 3.1 Renombrar `spaces.js` a `groups.js` y sus funciones, parámetros y mensajes de error, y actualizar las importaciones; verificar con la suite de integración `spaces.integration` renombrada a `groups.integration`
- [ ] 3.2 Renombrar las rutas a `/groups…`, `/api/groups…`, `/local/groups…`, `/demo/crear-grupo` y `/demo/grupo`, los redirects, los enlaces generados (`spacePath` pasa a `groupPath`) y la cookie de OAuth si hiciera referencia; verificar que `/spaces/<id>` y `/api/spaces/<id>/members` responden 404
- [ ] 3.3 Reemplazar «espacio» y «libro» de los textos visibles por «grupo», «movimientos» o «saldos» según el sentido, con la concordancia revisada a mano («← Volver al grupo», «Categorías del grupo», «Secciones del grupo»); verificar con la prueba de 1.3 en verde
- [ ] 3.4 Renombrar las ~785 ocurrencias en pruebas unitarias e integración y las 32 de E2E; verificar que `test:homesuite-app`, `test:homesuite-app:integration` y el E2E completo en Chromium pasan sin más cambios que los nombres
- [ ] 3.5 Commits por capa (esquema, módulos, rutas y textos, pruebas) cada uno con sus suites en verde; verificar que la prueba de 1.2 pasa con todo el código y las migraciones

## 4. Identidad del grupo

- [ ] 4.1 Agregar `description`, `avatar_emoji` y `avatar_color` a `groups` (en `0001`) con la restricción de 500 caracteres; verificar con una prueba de integración que rechaza 501 caracteres y acepta nulos
- [ ] 4.2 Implementar `updateGroup` en `groups.js` (titular, nombre, descripción, emoji con `normalizeEmoji`, color de `AVATAR_COLORS`, evento `group_updated` en un `batch`) reemplazando `renameGroup`; verificar con pruebas de integración de permisos, emoji inválido, nombre vacío, descripción larga y auditoría
- [ ] 4.3 Hacer que `avatar()` acepte emoji y color con el contraste de `inkFor`, y usarlo en listado, encabezado y página del grupo; verificar con pruebas unitarias del marcado (emoji, inicial, color por defecto estable y escape de HTML)
- [ ] 4.4 Mostrar descripción como texto plano en el encabezado de la página del grupo y un extracto de hasta 150 caracteres en el listado; verificar con pruebas que `<script>` se ve literal y que 400 caracteres se cortan a 150 con «…»

## 5. Administrar grupo

- [ ] 5.1 Implementar `GET/POST /groups/:id/settings` con identidad arriba, agregar participante e invitar después, y archivar al final; verificar con pruebas de integración de vistas (orden de secciones, 403 para integrantes, avisos de guardado)
- [ ] 5.2 Quitar de la pantalla de Personas los formularios de agregar, invitar, renombrar grupo y archivar; verificar que un integrante y la persona titular ven Personas solo con lista, renombrar persona y unir
- [ ] 5.3 Agregar la ruedita al encabezado del grupo y «Administrar grupo» al menú, solo para la persona titular, con 44 px de área táctil y etiqueta accesible; verificar con E2E (titular llega por ambas vías, integrante no ve ninguna) en 390 px y escritorio
- [ ] 5.4 Verificar el recorrido completo del formulario en el navegador (cambiar nombre, descripción, emoji y color y verlos reflejados en listado y encabezado) en Chromium y Firefox, incluido modo oscuro y contraste

## 6. Último grupo y cambio de grupo

- [ ] 6.1 Crear `/groups` como listado siempre visible (sin redirección, con avatar, nombre, extracto y rol) y quitar `?todos=1`; verificar con una prueba de integración con uno y con varios grupos
- [ ] 6.2 Implementar la cookie `last_group` (escritura en las pantallas HTML del grupo, nunca en `/groups/new` ni en errores) y su lectura en `/cuentas-claras` y tras el inicio de sesión, con validación de membresía; verificar con pruebas de integración de los cinco escenarios (volver, cambiar, ya no es integrante, otra cuenta, sin recuerdo) y que la respuesta no distingue entre grupo inexistente y ajeno
- [ ] 6.3 Hacer que el nombre con avatar del grupo en el encabezado enlace a `/groups`, y que «Mis grupos» del menú también; verificar con E2E que se llega desde cualquier pantalla del grupo y que no existe un `<select>` de grupos
- [ ] 6.4 Recorrido E2E de dos grupos en un mismo navegador: entrar a uno, cerrar y volver a `/cuentas-claras`, cambiar de grupo y volver; verificar en Chromium y Firefox, y que una segunda cuenta en el mismo navegador no abre el grupo recordado

## 7. Ajustes visuales ya acordados

- [ ] 7.1 Verificar que el saldo grande y el panel de cambio masivo plegado (commit `df8d4cb`) siguen intactos tras el renombre, con su E2E en verde
- [ ] 7.2 Capturas de las pantallas nuevas y modificadas a 360 px y escritorio, claro y oscuro, sin desbordes horizontales ni controles menores a 44 px; verificar con las auditorías existentes (`lowContrast`, desbordes) extendidas a las pantallas nuevas

## 8. Documentación y OpenSpec

- [ ] 8.1 Renombrar en `docs/` (excepto `openspec/changes/archive/`), incluidos `docs/HOMESUITE_PROFILE_API.md`, las fichas de producto, STATUS y backlog; verificar con la prueba de 1.2 en verde sobre los documentos
- [ ] 8.2 Actualizar `openspec/changes/personas-del-grupo`, `importacion-como-movimientos` y los demás cambios activos al vocabulario nuevo, y verificar con `openspec validate --all --strict`
- [ ] 8.3 Documentar en `docs/productos/CUENTAS-CLARAS.md` las decisiones de pantalla (administración, cambio de grupo, cookie, «libro» no visible) y en `docs/homesuite/OPERACION.md` la regla sobre reescribir migraciones antes del primer dato real; verificar que los enlaces resuelven

## 9. Staging y cierre

- [ ] 9.1 Escribir el script de reinicio de la base remota de staging en `apps/app/ops/` y ensayarlo contra una base local descartable; verificar que tras el script y las migraciones el esquema queda idéntico al de una base nueva
- [ ] 9.2 Hacer el backup de staging, mostrar a Pablo el script y qué se pierde, y ejecutarlo solo con su confirmación; verificar que el backup existe y que la base queda vacía y migrada
- [ ] 9.3 Desplegar a staging, volver a entrar con Google, crear un grupo, probar identidad, Administrar grupo, cambio y último grupo con Pablo, y registrar el resultado en `docs/STATUS.md`; verificar con un recorrido en vivo y la prueba `/healthz`
- [ ] 9.4 Verificar que ningún cambio llega a producción ni se empuja a remoto sin pedido explícito, y archivar el cambio con `openspec archive` tras la aceptación
