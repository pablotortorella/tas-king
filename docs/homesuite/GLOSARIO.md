# Glosario de HomeSuite

Vigente desde 2026-10-26. Un concepto, una palabra: la misma en la interfaz, las
URLs, la API, el código, la base de datos y los documentos. Cada concepto nuevo se
agrega aquí en el mismo cambio que lo introduce, con sus cuatro nombres.

| Concepto | Interfaz | Código | URL / API | Base de datos |
|---|---|---|---|---|
| Grupo | grupo | `group` | `/groups`, `/api/groups` | `groups`, `group_id` |
| Libro | no se muestra mientras haya uno solo por grupo | `ledger` | `/groups/:id/ledger/…` | `expense_ledgers`, `ledger_*` |
| Persona | persona | `participant` | `/groups/:id/people` | `ledger_participants` |
| Movimiento | movimiento | `entry` | `/groups/:id/ledger/entries` | `ledger_entries` |
| Titular | titular | `owner` | — | `memberships.role = 'owner'` |
| Integrante | integrante | `member` | `/api/groups/:id/members` | `memberships` |
| Invitación | invitación | `invitation` | `/invitations` | `invitations` |

## Reglas

- **Grupo** es quiénes comparten y quién es titular. Es de la plataforma: lo usan
  Cuentas Claras y, más adelante, Compras y Tareas. Lleva nombre, descripción,
  emoji y color.
- **Libro** es lo que Cuentas Claras guarda dentro de un grupo: movimientos,
  categorías y saldos. Hoy hay un libro por grupo, así que la interfaz habla de
  «grupo», «movimientos» y «saldos» y no muestra la palabra «libro». El concepto
  se conserva porque un grupo podría tener más de uno (ver backlog).
- **Persona** es quien figura en los saldos de un grupo, tenga cuenta o no. Un
  **integrante** es una persona con cuenta que puede entrar al grupo.
- El término anterior para «grupo» fue eliminado de todo el repositorio, salvo del
  registro histórico de `openspec/changes/archive/`. La prueba
  `apps/app/test/glossary.test.js` falla si reaparece.

## Pendiente de unificar

- **El término descartado en la voz de marca.** El documento de [identidad y visión](../HOMESUITE_IDENTIDAD_Y_VISION.md) y el lema del sitio usan la palabra que dejó de nombrar al grupo, pero en sentido figurado («tu hogar, tu ritmo, un lugar para respirar»). No es el concepto «grupo» y no se usa en la interfaz de Cuentas Claras, las URLs, el código ni la base. Si la voz de marca debe seguir llamando «compartido» a un grupo (la línea sobre privacidad de ese documento), es una decisión pendiente de Pablo.

- **Categoría y subcategoría.** Hoy la pantalla de Categorías llama «grupo» al
  agrupador de categorías («Casa» en «Casa - Otro»: campo «Grupo», columnas
  `group_name` y `group_key`, `category.group`), lo que choca con «grupo» como lugar
  compartido. Decisión de Pablo (2026-10-26): «Casa» será la **categoría** y «Otro»
  la **subcategoría**. Se hace en un cambio propio (ver backlog); hasta entonces ese
  uso interno de `group` en categorías es una excepción conocida.

