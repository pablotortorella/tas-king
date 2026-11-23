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
| Forma de pago | forma de pago | `paymentMethod` (`cash`, `debit`, `credit`, `transfer`, `wallet`) | campo `paymentMethod` del movimiento | `ledger_entries.payment_method` |
| Titular | titular | `owner` | — | `memberships.role = 'owner'` |
| Integrante | integrante | `member` | `/api/groups/:id/members` | `memberships` |
| Invitación | invitación | `invitation` | `/invitations` | `invitations` |
| Tablero de TasKing | tablero | `board` | `/api/tareas/boards` | `tasking_boards` |
| Integrante del tablero | integrante | `boardMember` | `/api/tareas/boards/:id/members` | `tasking_board_members`, `identity_id`, `role` |
| Identidad de TasKing, pendiente o vinculada | cuenta habitual | `identity` | resuelta desde sesión HomeSuite | `tasking_identities`, `user_id`, `verified_sub` |
| Tarjeta | tarjeta | `card` | `/api/tareas/cards/:id` | `tasking_cards` |
| Aceptación de los textos legales | aceptar los «Términos y condiciones» y la «Política de privacidad» | `legal` (`LEGAL_DOCUMENTS`, documentos `terms` y `privacy`) | `/aceptar`, `/auth/google?…&acepta=1` | `legal_acceptances` |
| Dueño de la suite | «acceso total» (la interfaz evita el sustantivo con género) | `owner` (`isOwner`, `ownerIds`) | `/consola`, todas las pestañas | ninguna: secreto `HOMESUITE_OWNER_USER_IDS` del Worker |
| Rol de herramienta | rol de Tareas, rol de Cuentas Claras | `scope` (`ROLE_SCOPES`: `tareas`, `cuentas-claras`) | `/consola/administradores/roles` | `platform_roles` |
| Consola | consola | `console` (`apps/app/src/console/`) | `/consola`, `/consola/:tab`, `/api/consola/:tab` | `platform_audit_events` (`console_opened`, `console_accounts_viewed`, `platform_role_*`) |
| Última actividad | — (no se muestra por persona) | `last_active_on`, `touchLastActive` | — | `users.last_active_on` |
| Entró | entraron | `level: "entro"` | — | `usage_period_people.level = 'entro'` |
| Hizo algo | hicieron algo | `level: "hizo"` | — | `usage_period_people.level = 'hizo'` |
| Período cerrado | semana, mes, trimestre, año | `PERIOD_TYPES`, `periodKey` (`usage-periods.js`) | `?periodo=semana\|mes\|trimestre\|anio&clave=…` | `usage_period_people`, `usage_period_markers` |

## Reglas

- **Grupo** es quiénes comparten y quién es titular. Es de la plataforma: lo usan
  Cuentas Claras y, más adelante, Compras. TasKing conserva permisos propios por
  tablero; un grupo no concede acceso a sus tareas. Lleva nombre, descripción,
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

- **Aceptación** es el registro de que una persona aceptó una versión de los
  Términos o de la Política de privacidad (la versión es la fecha de «Última
  actualización» de la página). Se registra al iniciar sesión desde una pantalla
  con el aviso (`login`) o en la pantalla de nueva aceptación (`gate`).

- **Consola** es la administración de HomeSuite (change
  `consola-administracion-homesuite`). La ve el **dueño de la suite**, definido
  por un secreto del Worker y nunca por la base, y quien tiene un **rol de
  herramienta**, que ve sólo la pestaña de esa herramienta. No confundir con
  **titular**, que es el rol de una persona dentro de un grupo.
- **Entró** y **hizo algo** son los dos niveles de uso de una herramienta:
  abrir un libro, un tablero o Remanso es «entró»; cargar, mover, comentar o
  terminar una sesión es «hizo algo», y cuenta también como «entró».
- Un **período cerrado** es un día, una semana ISO, un mes, un trimestre o un año
  de calendario de Colombia. Las personas distintas se cuentan sólo por período
  cerrado; las marcas que lo permiten se borran cuando el período termina.

## Pendiente de unificar

- **El término descartado en la voz de marca.** El documento de [identidad y visión](../HOMESUITE_IDENTIDAD_Y_VISION.md) y el lema del sitio usan la palabra que dejó de nombrar al grupo, pero en sentido figurado («tu hogar, tu ritmo, un lugar para respirar»). No es el concepto «grupo» y no se usa en la interfaz de Cuentas Claras, las URLs, el código ni la base. Si la voz de marca debe seguir llamando «compartido» a un grupo (la línea sobre privacidad de ese documento), es una decisión pendiente de Pablo.

- **Categoría y subcategoría.** Hoy la pantalla de Categorías llama «grupo» al
  agrupador de categorías («Casa» en «Casa - Otro»: campo «Grupo», columnas
  `group_name` y `group_key`, `category.group`), lo que choca con «grupo» como lugar
  compartido. Decisión de Pablo (2026-10-26): «Casa» será la **categoría** y «Otro»
  la **subcategoría**. Se hace en un cambio propio (ver backlog); hasta entonces ese
  uso interno de `group` en categorías es una excepción conocida.

