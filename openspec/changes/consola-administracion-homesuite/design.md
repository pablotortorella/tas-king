## Context

Ver `proposal.md` (Why). Las decisiones de producto son de Pablo, tomadas en la exploración del 2026-11-22. Este documento explica cómo se cumplen los specs del change.

Estado actual que condiciona el diseño:

- **Sesión.** `currentSession` (`apps/app/src/sessions.js`) hace una lectura por petición con sesión: `sessions JOIN users`. La puerta legal (`index.js`) corre antes que las rutas, y sus rutas exentas viven en `legal.js`.
- **Cron.** Hay un solo cron diario, a las 04:23 UTC en producción (23:23 en Colombia) y a las 04:17 en staging. Llama a `runMaintenance` (`maintenance.js`).
- **Administración de Tareas.**
  - El rol es `tasking_identities.is_admin`, con las rutas `/api/tareas/admin/{users,set-admin,stats}`.
  - En el cliente, `public/tareas/js/admin.js` arma un panel con cuatro pestañas: Usuarios, Actividad, Estadísticas y Solicitudes (esta última vacía: `renderPending() {}`).
  - La API de Actividad (`/api/tareas/boards/:id/activity`) pide membresía del tablero, no el rol de administración: solo la interfaz la esconde detrás del botón «Admin».
  - Hay identidades de Tareas sin cuenta HomeSuite (`user_id` nulo).
- **Auditoría.** `platform_audit_events` tiene actor, grupo opcional, acción, entidad y `metadata_json`.
- **CSRF.** Las páginas reciben el token con `csrfInput` (`route-kit.js`) y el servidor acepta `X-CSRF-Token` o `_csrf`.
- **Trabajo en paralelo.** Codex trabaja en «Exportación de datos» y «Comentarios en movimientos», sobre las rutas de Cuentas Claras y quizás con migraciones propias.

## Goals / Non-Goals

**Goals:**
- Medir sin agregar trabajo visible a la persona: la escritura va fuera del camino de la respuesta.
- No tocar las rutas de cada herramienta para medir. Así este change no choca con lo que hace Codex, y una herramienta nueva se suma con una línea.
- Que la tabla de marcas no permita leer «quién usó qué» sin el secreto, y que lo olvide al cerrar el período.

**Non-Goals:**
- Gráficos con una biblioteca externa: alcanza con SVG generado en el servidor, compatible con la CSP vigente.
- Retirar la columna `tasking_identities.is_admin`: deja de leerse, y se borra en un change posterior una vez verificada la migración.
- Abrir la actividad del tablero a todos los integrantes: sigue visible solo para quien administra Tareas, como hoy.

## Decisions

### D1. Medición en un middleware con una tabla de rutas

Un único middleware de `index.js`, después de la puerta legal y del control de mutaciones, corre `await next()` y después mira la respuesta. Si hay sesión, la respuesta es exitosa (2xx, o la redirección 3xx con la que responden los formularios que guardaron bien, como la carga de un movimiento) y el par método/ruta figura en una tabla declarativa (`usage-catalog.js`), traduce la petición en `{ herramienta, nivel, acción? }`. La ruta que respondió se identifica con `matchedRoutes` de Hono (la primera ruta con método propio), así que `/groups/new` no se confunde con `/groups/:groupId`. El trabajo pesado va a `c.executionCtx.waitUntil(...)`, así que la respuesta sale sin esperar a la medición. Los errores se registran en el log como `usage_write_failed`, sin datos de la persona.

- **Alternativa descartada: llamar a la medición desde cada ruta.** Es más preciso, pero toca los archivos que Codex está modificando y dispersa el catálogo.
- **La tabla vive en un solo archivo** (ruta, método, herramienta, nivel y acción) y tiene una prueba que la recorre contra las rutas reales de la app.
- **El middleware no mide las rutas exentas de la puerta legal** (`/aceptar`, `/auth/*`, recursos), así que quien todavía no aceptó la versión nueva de la política no suma.
- **Remanso** se mide por su propia ruta nueva (D8).

Las cuentas de los dueños se miden como cualquier otra (decisión de Pablo, 2026-11-23): los números muestran el uso total de la suite, incluidas las pruebas del dueño.

### D2. Última actividad por persona

- **Esquema:** una columna `users.last_active_on TEXT` con la fecha `AAAA-MM-DD` de Colombia.
- **Lectura:** `currentSession` suma la columna a su `SELECT`, así que no hay lectura extra.
- **Escritura:** el middleware de D1 escribe `UPDATE users SET last_active_on = ? WHERE id = ? AND (last_active_on IS NULL OR last_active_on < ?)` solo si la fecha leída es distinta de la de hoy. Va en `waitUntil` y se aplica a toda ruta no exenta, sea o no de una herramienta. La condición del `UPDATE` evita que una carrera entre dos peticiones del mismo día escriba dos veces.

### D3. Tablas

- `usage_daily_counts(day, tool, action, count)`, con clave primaria `(day, tool, action)`. Una acción hace `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`.
- `usage_period_people(period_type, period_key, tool, level, people)`, con clave primaria `(period_type, period_key, tool, level)`. Los valores posibles son:
  - `period_type`: `day`, `week`, `month`, `quarter` o `year`;
  - `level`: `entro` o `hizo`.
- `usage_period_markers(period_type, period_key, tool, level, marker)`, con clave primaria de todas las columnas y un índice por `(period_type, period_key)` para la purga.
- `usage_suite_snapshots(day PRIMARY KEY, accounts, active_1d, active_7d, active_30d)`.
- `platform_roles(user_id, scope, granted_by, granted_at)`, con clave primaria `(user_id, scope)` y `scope` en `tareas` o `cuentas-claras`.

Las herramientas se guardan con ids estables (`expenses`, `tasks`, `calm`), los mismos de `HERRAMIENTAS` en `tools.js`.

### D4. Marcas que no guardan a la persona

`marker = HMAC-SHA256(USAGE_MARKER_SECRET, user_id | period_type | period_key | tool | level)`, en base64url. El secreto es propio de cada ambiente.

- **Por qué la clave entra en el HMAC:** las marcas de períodos distintos no se pueden relacionar entre sí, así que la marca de la semana no deja seguir a una persona a lo largo del año.
- **Alternativa descartada: guardar `user_id` en claro.** Es más simple, pero cualquier lectura de la base respondería «quién usó Remanso esta semana».
- **Límite aceptado:** quien tenga el secreto y la lista de cuentas puede probar si una cuenta usó una herramienta en un período abierto. Por eso el secreto vive solo en el Worker, y las marcas se borran al cerrar cada período.
- **Rotar el secreto en medio de un período** cuenta dos veces a quien vuelva en ese período. Se rota solo el 1 de enero; queda documentado en la operación.

### D5. Algoritmo de conteo

Para un uso `(tool, level)`, la primera vez del día:

1. `INSERT OR IGNORE` de la marca del día. Si no insertó nada, la persona ya contó hoy en ese nivel y se termina ahí. Las marcas de semana, mes, trimestre y año se escriben junto con la del día, así que si la del día existe, las demás también.
2. Si insertó, se hacen `INSERT OR IGNORE` de las marcas de semana, mes, trimestre y año, y se suma `people + 1` en cada período donde la marca era nueva.
3. Todo va en un `db.batch` (transaccional en D1). El contador de cada período se actualiza con `INSERT … SELECT … WHERE changes() …` o con dos sentencias por período dentro del mismo batch. La forma exacta se decide al implementar, con la prueba de no doble conteo como criterio.

«Hizo algo» dispara también el conteo de «entró» del mismo día. La acción suma su contador diario siempre, una vez por petición exitosa.

**Costo:** la primera vez del día en cada herramienta y nivel, como mucho 5 marcas y 5 contadores. Después, una sola sentencia por acción, más el intento de marca del día, que se ignora.

### D6. Tiempo: Colombia fija

El día es el de Colombia, UTC−5, sin horario de verano, igual que las fechas de los textos legales. Las claves de período se arman así:

| Período | Clave | Ejemplo |
|---|---|---|
| día | `AAAA-MM-DD` | `2026-11-22` |
| semana ISO | `AAAA-Www`, con el año ISO | el 2026-12-31 da `2026-W53` |
| mes | `AAAA-MM` | `2026-11` |
| trimestre | `AAAA-Qn` | `2026-Q4` |
| año | `AAAA` | `2026` |

Un módulo puro, `usage-periods.js`, calcula las claves, el fin de cada período y los períodos anterior y siguiente, con pruebas de bordes: fin de año, semana 53 y medianoche de Colombia.

### D7. Mantenimiento: purga y foto

`runMaintenance` suma dos pasos:

1. **Purga:** borra las marcas de todo período cuyo fin es anterior al día de hoy en Colombia. Usa una tabla de fines calculada en JS y un `DELETE` por tipo de período.
2. **Foto:** `INSERT OR REPLACE` en `usage_suite_snapshots` con el día de hoy en Colombia, el total de cuentas y los conteos de `last_active_on` dentro de 1, 7 y 30 días.

El cron de producción corre a las 23:23 de Colombia, así que la foto describe el día que termina. La marca del día en curso se purga en la corrida siguiente. El resultado de `maintenance_completed` suma `purgedUsageMarkers` y `usageSnapshotDay`.

### D8. Remanso informa solo el resultado

- **Ruta:** `POST /api/uso/remanso`, con el cuerpo `{ "resultado": "terminada" | "abandonada" }`. Pide sesión, CSRF y el límite de mutaciones, y responde 204. No acepta ningún otro campo (los extra se rechazan con 400).
- **Cliente:** `remanso.js` lo envía una sola vez por sesión de meditación y solo si la página se sirvió con sesión. Si la página no tiene token CSRF, no envía nada.
  - «terminada» sale al completarse el tiempo;
  - «abandonada» sale con «Terminar sesión» antes de tiempo, o al salir de la página con una sesión en curso (`pagehide`, con `fetch` y `keepalive`).
- **Medición:** «terminada» cuenta como «hizo algo» en Remanso y suma «sesiones terminadas». «abandonada» suma «sesiones abandonadas» y cuenta «entró», pero no «hizo algo».
- **Alternativa descartada: `sendBeacon`.** No permite la cabecera CSRF, y mandar el token en el cuerpo duplica una vía de validación.

### D9. Dueños, roles y la consola que no existe

- **Dueños:** el secreto `HOMESUITE_OWNER_USER_IDS` es una lista de ids de `users` separados por coma, y se lee una vez por petición a la consola.
- **Permisos:** `consoleAccess(c)` devuelve `{ owner, scopes }`. Si no hay ni dueño ni scopes, la ruta llama al mismo manejador de «no encontrado» que la app y registra `console_denied` en el log, con el id de la petición y sin la cuenta. Las pestañas y la API comparten la misma comprobación por pestaña.
- **Interfaz:** páginas del servidor con el `page()` común, `/consola/{suite,tareas,cuentas-claras,administradores}`, y `/consola` lleva a la primera pestaña permitida.
  - Los datos se dibujan en el servidor; los gráficos son SVG en línea con texto alternativo y una tabla equivalente.
  - El selector de período es un enlace con `?periodo=mes&clave=2026-11`, así que no necesita JS.
- **Enlace «Consola»:** aparece en el menú de la cuenta solo cuando `consoleAccess` da acceso. Para eso hace falta leer los roles en las páginas con sesión: una lectura por clave primaria, solo cuando el menú se dibuja.
- **Alternativa descartada: una SPA con API JSON para toda la consola.** Sería más trabajo, y el resto de HomeSuite se dibuja en el servidor.

### D10. Tareas se integra a la consola

- **Migración:** `INSERT OR IGNORE INTO platform_roles SELECT user_id, 'tareas', NULL, CURRENT_TIMESTAMP FROM tasking_identities WHERE is_admin = 1 AND user_id IS NOT NULL`. Las identidades con marca y sin cuenta HomeSuite no reciben rol: se cuentan antes de migrar y se registran (tarea 1.1). **Conteo en producción (2026-11-23, solo lectura, sin correos):** 1 identidad con `is_admin = 1` y cuenta HomeSuite, 0 sin cuenta; la migración no deja a nadie sin rol.
- **API:** `/api/tareas/me` calcula `isAdmin` como «dueño o rol `tareas`», sin leer `is_admin`. `/api/tareas/admin/users` y `/stats` pasan a la consola, con el ranking solo para el dueño. `/api/tareas/admin/set-admin` se retira, y los roles se dan en Administradores.
- **Cliente:** el panel de administración del tablero general conserva solo «Actividad», con el título «Actividad del tablero», y suma el enlace «Administración» a `/consola/tareas`. Se retiran las pestañas Usuarios, Estadísticas y Solicitudes.

### D11. Auditoría

Las acciones nuevas en `platform_audit_events` son:

| Acción | Entidad | Metadatos |
|---|---|---|
| `platform_role_granted` | `user` | `{ scope }` |
| `platform_role_revoked` | `user` | `{ scope }` |
| `console_opened` | `console` (el id es `AAAA-MM-DD`) | `{ tab }` |
| `console_accounts_viewed` | `console` | `{ tool }` |

- **Deduplicación:** `console_opened` usa un id determinista, `console_opened_<user>_<día>`, con `INSERT OR IGNORE`, así que queda una entrada por persona y por día.
- **Correos:** ningún metadato lleva correo; una prueba lo verifica.

### D12. Política de privacidad y orden de publicación

- **Texto:** la versión nueva de `privacidad.html` la redacta Claude como propuesta y la aprueba Pablo; es **texto legal que revisa Pablo**. Lleva una fecha nueva en «Última actualización» y en «entra en vigor», y la versión correspondiente en `legal.js`.
- **Orden de publicación:**
  1. la migración, con el respaldo previo del wrapper;
  2. el sitio con la política nueva;
  3. la app.

  Con la puerta encendida, la versión rige al publicarse, y cada persona pasa por `/aceptar` al volver. Como la medición no corre en rutas exentas, no se mide a nadie antes de que acepte.
- **Alternativa:** anunciarla con la franja de 15 días (`upcoming`). Se descartó por defecto porque la consola sirve recién con datos, pero Pablo puede elegirla al revisar el texto.

## Risks / Trade-offs

- **Con pocas personas, un conteo deja adivinar quién fue.** Por ejemplo, «Remanso: 1 sesión el martes». → La pestaña Suite la ve solo el dueño, y la política dice que la estadística es agregada.
- **La tabla de rutas se desactualiza** cuando una herramienta cambia una ruta, por ejemplo con lo que integre Codex. → Una prueba recorre el catálogo contra las rutas registradas en la app y falla si una ruta del catálogo no existe. La ficha de cada producto recuerda sumar acciones nuevas.
- **`waitUntil` puede perder escrituras** si el Worker termina antes. → Se acepta como error de medición y queda en el log. Los contadores son estadística, no contabilidad.
- **El secreto de marcas se pierde o se rota a mitad del año.** → Las personas de los períodos abiertos cuentan doble una vez. Se documenta, y se rota solo al empezar el año.
- **Las escrituras extra en D1** son 1 por persona y por día, más 10 la primera vez del día en cada herramienta, más 1 por acción. → A esta escala, está dentro del plan. Se miden en la verificación de staging.
- **El cron no corre un día.** → La foto de ese día falta (no se inventa), y la purga se pone al día en la corrida siguiente, porque borra todos los períodos vencidos.
- **Romper Tareas al retirar el rol heredado.** → La migración copia los roles antes de que el código deje de leer `is_admin`. La E2E `critical-flows` se adapta: el administrador de Tareas ve la consola, y el tablero ya no muestra el control de roles.
- **Choque de migraciones con Codex.** → El número de migración se fija al implementar, después de mirar `main`. La prueba de orden de migraciones lo detecta.

## Migration Plan

1. **Antes de migrar,** contar en producción, solo en lectura y sin correos, las identidades con `is_admin = 1`, con cuenta HomeSuite y sin ella. Registrar el resultado en el PR.
2. **Configurar los secretos** `HOMESUITE_OWNER_USER_IDS` y `USAGE_MARKER_SECRET` en staging y en producción, por orden de Pablo, con el identificador de su cuenta en cada ambiente.
3. **Staging:** respaldo, migración, sitio con la política y app; smoke de la consola con el dueño, con un rol de Tareas de prueba y con una cuenta sin rol (404).
4. **Producción:** los mismos pasos, solo con orden explícita de Pablo; después `npm run verify:coherence:production`.

**Reversión:**
- La app anterior ignora las tablas nuevas y la columna `last_active_on`.
- `is_admin` sigue intacto, así que una versión anterior recupera la administración de Tareas tal como estaba.
- La política no se revierte sin una versión nueva.

## Open Questions

- **El texto exacto de la política** se redacta en la tarea 9.1.
