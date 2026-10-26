## Context

Ver `proposal.md` para el motivo. Estado actual, verificado en el código de la rama `feature/personas-menu-perfil`:

- El concepto «grupo» se llama `space` en la base (`spaces`, `space_id` en 17 sitios de las migraciones, índices `spaces_slug_unique`, `memberships_one_owner_per_space`, `invitations_one_pending_email_per_space`, `platform_audit_events_by_space`), en las rutas (`/spaces/:spaceId/…`, `/api/spaces/…`, `/local/spaces…`), en `spaces.js` y en unas 1.650 ocurrencias de unos 70 archivos. La interfaz mezcla «grupo», «libro» y «espacio».
- `expense_ledgers.space_id` es `UNIQUE`: hoy hay un libro por grupo. Las rutas de Cuentas Claras ya cuelgan de `/…/ledger/…`.
- El grupo tiene `name`; se edita con `renameSpace` desde un formulario al final de Personas. Las URLs aceptan id o `slug` (`canonicalSpacePath`).
- Los perfiles personales ya resuelven emoji y color: `normalizeEmoji`, `AVATAR_COLORS` y clases `.avatar-<token>` en `profiles.js` y `styles.js`.
- `/cuentas-claras` redirige al grupo solo si hay uno; con varios muestra la lista, y `?todos=1` fuerza la lista.
- La base de HomeSuite App solo existe en staging; los datos de staging son descartables (decisión de Pablo).

## Goals / Non-Goals

**Goals:**
- Un vocabulario único y verificable por una prueba, sin términos descartados ni alias.
- Identidad del grupo con las mismas reglas que el avatar personal, sin duplicar validación.
- Un historial de migraciones limpio, que nunca mencione el nombre anterior.

**Non-Goals:**
- Soportar varios libros por grupo (backlog).
- Compatibilidad hacia atrás con URLs, API o esquema anteriores.
- Persistir el último grupo fuera del navegador.

## Decisions

### D1. Glosario único, documentado y vigilado por una prueba

| Concepto | Interfaz | Código | URL / API | Base |
|---|---|---|---|---|
| Grupo | grupo | `group` | `/groups` | `groups`, `group_id` |
| Libro | (no visible mientras haya uno) | `ledger` | `/ledger/…` | `expense_ledgers`, `ledger_*` |
| Persona | persona | `participant` | `/people` | `ledger_participants` |
| Movimiento | movimiento | `entry` | `/ledger/entries` | `ledger_entries` |
| Titular / integrante | titular / integrante | `owner` / `member` | — | `memberships.role` |

Va en `docs/homesuite/GLOSARIO.md` y se enlaza desde la base común. Una prueba en el config de Node (`vitest.config.mjs`, `environment: "node"`) recorre el árbol y falla ante `space` o «espacio»; la lista de excepciones es corta y con motivo: `namespace`, `white-space`, `whitespace` y `openspec/changes/archive/` (registro histórico que OpenSpec no reescribe).

*Alternativa descartada:* fundir libro y grupo. Quedaría más uniforme, pero toca `expense_ledgers`, `ledger_*` y `/ledger/…` y mezcla un concepto de plataforma (quiénes) con uno de Cuentas Claras (qué se registra); complicaría que Compras o Tareas usen grupos.

### D2. Reescribir las migraciones en lugar de agregar una de renombre

El proyecto no está en uso real, la base de staging es descartable, y una migración `ALTER TABLE spaces RENAME TO groups` dejaría el nombre viejo escrito para siempre en el historial. Se editan `0001`–`0011` con los nombres nuevos; `0006_space_slugs.sql` pasa a `0006_group_slugs.sql`; la identidad entra directamente en el `CREATE TABLE groups` de `0001`.

*Consecuencia:* la tabla `d1_migrations` de staging ya registra los nombres anteriores, así que la base **no se puede migrar en el lugar**: se vacía y se reaplican todas las migraciones (D3). Las bases locales y E2E se recrean con `e2e:setup` / `db-reset-local.sh`, que ya parten de las migraciones.

*Alternativa descartada:* migración de renombre. Conservaría datos que no interesan a costa de dejar el término descartado en el esquema y de tener que reescribir triggers e índices con cuidado.

### D3. Recrear staging, con backup y aprobación en el momento

Un script de operación en `apps/app/ops/` borra todos los objetos de la base remota de staging (tablas, índices y `d1_migrations`) y luego se corre el despliegue normal (`deploy:homesuite-app:staging`), que aplica las migraciones por nombre. Se conserva el `database_id`. Orden: backup (`db:backup:homesuite-app:staging`), mostrar a Pablo el script y qué se pierde (usuarios, sesiones, perfiles, movimientos), ejecutar solo con su confirmación, desplegar y verificar. El script se prueba antes contra una base local descartable. La regla de `OPERACION.md` (cada reinicio tiene alcance explícito) se cumple con esa confirmación; nada toca producción.

*Alternativa descartada:* borrar y crear una base D1 nueva. Cambia el `database_id` y obliga a tocar `wrangler.jsonc` y los enlaces del entorno.

### D4. El renombre es mecánico, ordenado por capas y revisado

Un script de una sola vez (en el directorio temporal, no se commitea) aplica reemplazos con límites de palabra y una lista de formas: `spaceId`→`groupId`, `space_id`→`group_id`, `spaces`→`groups`, `Space`→`Group`, `SPACE_`→`GROUP_`, `/spaces`→`/groups`, «espacio»→«grupo» con concordancia revisada a mano, y «libro» en textos visibles→«grupo»/«movimientos» según el caso (revisado a mano, no mecánico). No toca `namespace`, `white-space` ni `whitespace`. Se commitea por capas, cada una con sus pruebas verdes: (1) migraciones y esquema, (2) módulos de `src`, (3) pruebas y E2E, (4) documentos. Después de cada paso corre la prueba del glosario con el área ya renombrada.

*Riesgo principal:* una sustitución parcial que compile pero rompa una consulta. Se cubre con las pruebas de integración D1 existentes (≈ 300) y con el recorrido E2E completo.

### D5. Identidad del grupo en la tabla `groups`

`groups` gana `description TEXT CHECK(description IS NULL OR length(description) <= 500)`, `avatar_emoji TEXT` y `avatar_color TEXT`, todos opcionales. La validación reutiliza `normalizeEmoji` y `AVATAR_COLORS`; el color por defecto se deriva del id del grupo con la misma función que usa el perfil. Un único `updateGroup` (reemplaza `renameSpace`) valida, exige titular, actualiza y registra el evento `group_updated` en `platform_audit_events` en un mismo `batch`. Sin emoji se muestra la inicial.

### D6. Un avatar de grupo con la misma presentación que el personal

`avatar()` de `ui-parts.js` aprende a recibir emoji y color (`avatar-<token>`) y se usa en el listado, el encabezado y la página del grupo. Contraste: se reutiliza `inkFor` que ya elige tinta clara u oscura por color.

### D6b. Extracto de la descripción

En el listado de grupos la descripción se muestra como extracto de hasta 150 caracteres (decisión de Pablo), cortado en el último límite de palabra y con «…» cuando se acorta; en el encabezado del grupo se muestra completa. El máximo al guardarla sigue siendo 500.

### D7. «Administrar grupo» como pantalla propia

`GET/POST /groups/:id/settings` para la persona titular, con tres secciones en orden: identidad (nombre, descripción, emoji+color), personas (agregar participante sin cuenta e invitar con vínculo opcional; los formularios que hoy viven en Personas y que mantienen sus rutas, renombradas a `/groups/:id/…`), y archivar. La pantalla de Personas queda de solo lectura más renombrar y unir. Acceso: ruedita en el encabezado del grupo (solo titular) e ítem del menú (solo titular). Un integrante que abre la URL recibe 403.

### D8. Último grupo en una cookie, validada en el servidor

Cookie `last_group` con el id del grupo, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` de un año, `Secure` cuando la conexión es https (como las demás cookies de `auth.js`). Se escribe cuando un integrante pide por GET una pantalla HTML de un grupo (en el middleware que ya canoniza `/groups/:id`), nunca en `/groups/new` ni en respuestas de error. Se lee en `/cuentas-claras` y en el redirect posterior al inicio de sesión: si el grupo corresponde a una membresía de la persona se abre; si no, se descarta sin respuesta distinta (no revela si existe) y rige la regla actual (un solo grupo → ese; varios → lista). `/groups` siempre muestra la lista. No guarda nada personal ni se firma: el valor solo se usa después de comprobar la membresía.

*Alternativa descartada:* `localStorage`. El servidor no lo ve, y la redirección tendría que ocurrir en el cliente con un salto visible.

### D9. Cambiar de grupo sin selector

El encabezado muestra el avatar y el nombre del grupo como enlace a `/groups`; el menú agrega «Mis grupos» (hoy apunta a `/cuentas-claras?todos=1`, que desaparece) y «Administrar grupo» para la persona titular. `/cuentas-claras` pasa a ser solo el punto de entrada con redirección.

### D10. Sin alias de rutas

Las rutas `/spaces`, `/api/spaces`, `/local/spaces` y `/demo/crear-espacio|espacio` se eliminan. Hono responde 404 por defecto. La API documentada en `docs/HOMESUITE_PROFILE_API.md` se renombra con ellas.

## Risks / Trade-offs

- [Un reemplazo mecánico rompe sentidos distintos de «space», como `white-space` o `namespace_id` de Cloudflare] → límites de palabra, lista de excepciones explícita y la prueba del glosario con ellas.
- [Editar migraciones ya aplicadas deja desfasada cualquier base existente] → solo existe staging; se recrea (D3). Un recordatorio en `OPERACION.md` indica que, mientras no haya datos reales, las migraciones del esquema inicial pueden reescribirse, y que dejan de poder reescribirse al primer dato real.
- [Cookie ajena en un navegador compartido] → solo se usa tras comprobar la membresía de la sesión actual y no se informa nada si no coincide.
- [Pérdida de datos de staging por error de alcance] → backup previo y confirmación explícita de Pablo sobre el script antes de ejecutarlo.
- [Texto con «libro» que se escapó] → la prueba del glosario cubre `space`, no «libro»; los textos visibles se verifican con una prueba de integración que recorre las pantallas y falla ante «libro» o «espacio», y con la revisión E2E.
- [Cambios largos y mecánicos mezclados con funcionalidad nueva] → el renombre va primero y sin cambios de comportamiento, verde y commiteado; la identidad, la administración y el último grupo van después sobre el vocabulario ya limpio.

## Migration Plan

1. Rama nueva desde `feature/personas-menu-perfil`, con el renombre mecánico por capas (D4) y las migraciones reescritas (D2). Todas las suites en verde.
2. Funcionalidad nueva (D5–D9) con sus pruebas.
3. Documentación y glosario; actualizar `personas-del-grupo` al vocabulario nuevo.
4. Staging: backup, mostrar y confirmar el script, recrear, desplegar, recorrer en vivo con Pablo.
5. Reversión: antes de tocar staging, volver atrás es descartar la rama. Después, la base de staging se vuelve a crear desde el backup o desde las migraciones previas del commit anterior (los datos de staging se consideran descartables).
