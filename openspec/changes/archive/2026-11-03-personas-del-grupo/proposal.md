## Why

Al importar su historial real en staging, la persona titular no logró indicar cuál de las columnas del archivo era ella misma: el paso de correspondencia ofrece «Crear participante nuevo» por defecto y nada explica que existe la opción de elegir a alguien del grupo, de modo que el libro quedó con dos personas que son la misma. Además, hoy no hay dónde ver ni corregir quiénes forman el grupo: la lista de personas está al final de la pantalla del libro, debajo de los movimientos, sin poder renombrar a nadie ni juntar dos personas duplicadas. Y las secciones del libro (personas, categorías, importar, clasificar) quedaron «MUY abajo», sin un menú que lleve a ellas.

Decisiones tomadas por Pablo en la conversación de exploración: la persona **destinataria de una unión se elige en el momento de avanzar con la acción** y **todos los movimientos pasan a esa persona**; el acceso a las secciones es un **menú**, y ese menú integra la gestión del perfil propio («Ver perfil»), desarrollada en una rama aparte.

## What Changes

- **Menú de la aplicación**: en el encabezado de cada pantalla, con las secciones del grupo (Saldos, Movimientos, Personas, Categorías, Clasificar, Importar), Inicio, Mis grupos, «Ver mi perfil» y «Cerrar sesión». El encabezado muestra además la cuenta (avatar y nombre) que lleva al perfil. *(Ya integrado con la gestión del perfil de `main`.)*
- **Pantalla de personas** (`/groups/:id/people`): lista de quienes forman el grupo con su estado (con cuenta, sin cuenta, invitación pendiente, unida a otra), saldos resumidos, renombrar y unir. Las herramientas de administración que estaban al final del libro (agregar, invitar, renombrar el grupo, archivar) pasaron a «Administrar grupo» en el cambio `grupos-con-identidad`.
- **Renombrar una persona** (solo la titular): nombre único entre las personas vigentes del grupo.
- **Unir dos personas** (solo la titular): se elige primero qué persona se une y después **a quién se une** (la destinataria); una vista previa muestra cuántos movimientos cambian y cómo queda el saldo; al confirmar, todos los movimientos de la persona unida pasan a la destinataria, con auditoría. La persona unida queda en el historial como «unida a …» y deja de aparecer en repartos y saldos.
- **Importación, paso de correspondencia**: cada columna del archivo pregunta «¿Quién es “X” en este grupo?» con «Soy yo (nombre)» como primera opción, luego las demás personas y al final «Una persona nueva»; se preselecciona por nombre; la revisión avisa si dos columnas apuntan a la misma persona o si ninguna es quien importa.

### Non-goals

- Deshacer una unión: la persona unida se conserva como registro y cada revisión afectada lleva el identificador de la unión, para que un deshacer futuro sea posible, pero no se construye aquí.
- Separar una persona en dos, o mover solo algunos movimientos entre personas.
- Cambiar el vínculo de una cuenta con su persona fuera de una unión.
- Unir personas de grupos distintos.
- Sincronizar el nombre de una persona con el perfil de su cuenta.

## Capabilities

### New Capabilities

- `personas-del-grupo`: ver, renombrar y unir las personas de un grupo; el menú de la aplicación con acceso al perfil; la correspondencia de columnas de la importación con «Soy yo».

### Modified Capabilities

<!-- Ninguna: openspec/specs/ solo contiene landing-publica-homesuite, recorrido-staging-suite y tip-diario. -->

## Impact

- `apps/app/migrations/`: `0011_person_merge.sql` (columna `merged_into_id` en `ledger_participants` y tabla `person_merges`).
- `apps/app/src/`: módulo `people.js` (renombrar, vista previa y aplicación de la unión), `people-ui.js` y rutas de personas, ajustes en `ledger.js`/`overview-ui.js` (la sección de personas deja el libro), `splitwise-ui.js` y `splitwise-import.js` (correspondencia con «Soy yo»), y el menú y la cuenta del encabezado (`ui-parts.js`, `account-ui.js`, `routes/shell.js`, `styles.js`).
- Pruebas unitarias de las reglas de unión, integración D1 (unión, idempotencia, cuentas, invitaciones, transferencias entre las dos personas, permisos) y E2E del menú, de la pantalla de personas y de la correspondencia de la importación en 390 px y escritorio, Chromium y Firefox.
- Depende de `importacion-como-movimientos` (los importados son movimientos corregibles) y de `perfil-compartido-homesuite` (perfil y cuenta del encabezado).
