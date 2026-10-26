## Why

Al probar en staging la importación real, Pablo encontró tres problemas en cómo se presenta y se administra el lugar donde se comparten las cuentas:

- **Se llama de tres maneras.** La interfaz dice «grupo» en los títulos, «libro» en «Volver al libro» y en la barra inferior, y «espacio» en «Crear espacio» y en las URLs `/spaces/…`; el código y la base lo llaman `space`. Una sola cosa con tres nombres confunde a quien usa la aplicación y a quien la mantiene.
- **El grupo no tiene identidad.** Solo tiene nombre, y el nombre se edita al final de la pantalla de Personas, debajo de invitar. No hay descripción, emoji ni color, a diferencia de los perfiles personales, y el listado de grupos no distingue unos de otros.
- **Entrar siempre muestra lo mismo.** Con un solo grupo se entra directo; con varios, la lista. Quien está de viaje carga gastos durante semanas en ese grupo y tiene que elegirlo cada vez. Cambiar de grupo tampoco es evidente.

Decisiones de Pablo en la conversación de exploración: «espacio» desaparece **de todos lados** (UI, URLs, código, base de datos, documentos), con «grupo» y `group` como palabra única; «libro» (`ledger`) se **conserva** como concepto distinto, porque un grupo podría tener más de un libro en el futuro; el último grupo se recuerda **en el navegador**, sin tocar la base; no hay selector desplegable de grupos; no se dejan redirecciones de URLs viejas; y los datos de staging no importan, así que se prioriza lo más limpio.

## What Changes

- **Lenguaje único** con un glosario (grupo/`group`, libro/`ledger`, persona/`participant`, movimiento/`entry`, titular/`owner`, integrante/`member`): una palabra por concepto en la interfaz, las URLs, el código, la base y los documentos. Una prueba que recorre el árbol falla si reaparece «espacio» o `space`.
- **BREAKING (URLs y API):** `/spaces/…` pasa a `/groups/…`, `/api/spaces/…` a `/api/groups/…`, `/local/spaces` a `/local/groups`, y `/demo/crear-espacio` y `/demo/espacio` a `/demo/crear-grupo` y `/demo/grupo`. Las URLs viejas dejan de existir (404), sin redirecciones.
- **BREAKING (base de datos):** la tabla `spaces` pasa a `groups`, y `space_id` a `group_id` en todas las tablas, índices y registros de auditoría. Se **reescriben las migraciones `0001`–`0011`** con los nombres nuevos (y `0006_space_slugs` pasa a `0006_group_slugs`) y la base de staging se recrea desde cero, con backup previo.
- **Identidad del grupo:** nombre, descripción larga (hasta 500 caracteres, texto plano), emoji y color de fondo, con el mismo selector y las mismas reglas que el avatar de los perfiles personales. Se ven en el listado de grupos, en el encabezado y en la página del grupo.
- **Administrar grupo** (solo la persona titular): pantalla propia en `/groups/:id/settings`, a la que se llega por una ruedita en la página del grupo y por un ítem «Administrar grupo» del menú. Arriba van nombre, descripción y emoji+color; debajo, agregar participantes e invitar por email; al final, archivar. Esas funciones salen de la pantalla de Personas, que queda para ver, renombrar y unir personas.
- **Entrar al último grupo:** una cookie del navegador recuerda el último grupo visitado; al entrar a Cuentas Claras se abre ese grupo. Si la persona ya no es integrante, la cookie se ignora y se muestra la lista.
- **Cambiar de grupo:** el nombre del grupo (con su emoji) en el encabezado enlaza a la lista `/groups`, y «Mis grupos» queda en el menú. Sin selector desplegable.
- **Vocabulario de la interfaz:** «libro» desaparece de los textos visibles mientras haya un solo libro por grupo («Volver al grupo», «Categorías del grupo», barra inferior «Secciones del grupo»).

### Non-goals

- Más de un libro por grupo: el concepto se conserva y la capacidad queda en el backlog (`docs/PRODUCT_BACKLOG.md`).
- Recordar el último grupo en la base o entre dispositivos.
- Selector desplegable de grupos o buscador de grupos.
- Redirecciones o alias para URLs, tablas o nombres anteriores.
- Conservar datos de staging.
- Renombrar `ledger`, `participant` o `entry`, o los textos de `openspec/changes/archive/` (registro histórico).

## Capabilities

### New Capabilities

- `identidad-del-grupo`: nombre, descripción, emoji y color del grupo; pantalla «Administrar grupo»; listado de grupos; entrar al último grupo y cambiar de grupo.
- `lenguaje-del-dominio`: glosario único y reglas observables del vocabulario en interfaz, URLs y API, sin términos anteriores ni redirecciones.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ solo contiene landing-publica-homesuite, recorrido-staging-suite y tip-diario, y sus requisitos no cambian. -->

## Impact

- `apps/app/migrations/`: reescritura de `0001`–`0011` (tabla `groups` con `description`, `avatar_emoji`, `avatar_color`; `group_id` en todas las tablas) y renombre de `0006`.
- `apps/app/src/`: `spaces.js` pasa a `groups.js` (con actualización de la identidad), `index.js` (rutas, cookie del último grupo, listado), `routes/*`, `ui-parts.js` (avatar con emoji y color, encabezado y menú), `overview-ui.js`, `people-ui.js`, `styles.js`, y renombre mecánico de `space*` en casi todos los módulos, pruebas y E2E (~1.650 ocurrencias en ~70 archivos).
- `apps/app/seed/demo.sql`, `apps/app/ops/`, `scripts/` y `wrangler.jsonc` si hacen referencia al concepto.
- Documentación: `docs/HOMESUITE_PROFILE_API.md`, fichas de producto, STATUS, backlog y las especificaciones y cambios activos de OpenSpec, más un glosario nuevo.
- Operación: recrear la base D1 de staging; requiere el backup previo y la aprobación explícita de Pablo en el momento del despliegue. Nada va a producción.
- Depende de `personas-del-grupo` (pantalla de Personas y menú) y debe aplicarse sobre su rama; ese cambio queda con sus textos actualizados al vocabulario nuevo.
