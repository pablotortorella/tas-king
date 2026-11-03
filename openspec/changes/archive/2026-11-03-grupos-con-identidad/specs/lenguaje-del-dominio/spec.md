## Purpose

Fija un lenguaje único para HomeSuite: una palabra por concepto, igual en la interfaz, las URLs, la API, el código, la base de datos y los documentos, y la verificación automática de que no reaparecen los términos descartados.

## ADDED Requirements

### Requirement: «Grupo» es la única palabra para el lugar donde se comparten las cuentas

Toda la aplicación SHALL llamar «grupo» (en código, `group`) al conjunto de integrantes con un titular que comparten Cuentas Claras. El término anterior «espacio» (en código, `space`) SHALL NO aparecer en textos de interfaz, mensajes de error, URLs, rutas de API, nombres de tablas, columnas, índices, eventos de auditoría, cookies, identificadores del código, pruebas ni documentos vigentes. «Libro» (`ledger`) SHALL denominar solo los movimientos, categorías y saldos que Cuentas Claras guarda dentro de un grupo; mientras cada grupo tenga un único libro, la interfaz SHALL hablar de «grupo», «movimientos» y «saldos» y SHALL NO mostrar la palabra «libro».

#### Scenario: Ningún texto visible dice «espacio» ni «libro»

- **WHEN** se recorren las pantallas de Cuentas Claras (listado, grupo, movimientos, saldos, personas, categorías, clasificar, importar, administrar, invitaciones, creación de grupo y demos)
- **THEN** ningún texto visible, atributo accesible ni mensaje de error contiene «espacio» ni «libro»

#### Scenario: Volver desde una subpantalla

- **WHEN** la persona está en Categorías, Importar, Saldos o Clasificar
- **THEN** el enlace de regreso dice «← Volver al grupo»

#### Scenario: Los nombres técnicos coinciden con el glosario

- **WHEN** se revisan las tablas, columnas e índices de la base
- **THEN** el grupo es `groups`, su referencia es `group_id` en todas las tablas, y no existe ningún objeto con `space` en su nombre

### Requirement: Las URLs y la API usan `group` y no dejan alias

Las rutas de la aplicación SHALL usar `/groups` para el listado y la creación (`/groups/new`), `/groups/:id` para el grupo, y `/groups/:id/…` para sus secciones; la API SHALL usar `/api/groups/…`, y las rutas locales y de demostración `/local/groups…`, `/demo/crear-grupo` y `/demo/grupo`. Las rutas anteriores con `spaces` o «espacio» SHALL responder 404, sin redirecciones ni alias. La URL legible del grupo (`/groups/:slug`) SHALL seguir funcionando como hoy.

#### Scenario: URL anterior

- **WHEN** alguien pide `/spaces/<id>` o `/api/spaces/<id>/members`
- **THEN** recibe 404

#### Scenario: Ruta nueva

- **WHEN** un integrante pide `/groups/<slug>`
- **THEN** ve la página del grupo y los enlaces de esa página apuntan a `/groups/…`

### Requirement: Una prueba automática impide que reaparezcan los términos descartados

El repositorio SHALL incluir una prueba que recorra código, migraciones, pruebas, scripts, datos de demostración y documentación vigente, y falle si encuentra `space` o «espacio» como palabra del dominio. SHALL admitir solo una lista corta y explícita de excepciones (`namespace`, `white-space`, `whitespace` y `openspec/changes/archive/`), cada una con su motivo.

#### Scenario: Reaparece un término descartado

- **WHEN** un archivo vigente contiene `space_id` o «Crear espacio»
- **THEN** la prueba falla e indica el archivo y la línea

#### Scenario: Excepción legítima

- **WHEN** un archivo contiene `white-space: nowrap` o `namespace_id`
- **THEN** la prueba no lo marca

### Requirement: El glosario está documentado

El repositorio SHALL documentar en un glosario cada concepto con su nombre en la interfaz, en el código, en las URLs y en la base: grupo, libro, persona (`participant`), movimiento (`entry`), titular (`owner`), integrante (`member`) e invitación, junto con la regla de que «libro» no se muestra mientras haya uno solo por grupo.

#### Scenario: Un concepto nuevo

- **WHEN** se agrega un concepto de dominio a la aplicación
- **THEN** el glosario se actualiza en el mismo cambio, con sus cuatro nombres
