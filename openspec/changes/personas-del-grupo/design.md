## Context

- Las personas del grupo son `ledger_participants` (`ledger_id`, `id`, nombre, `linked_user_id` único por libro, `active`, `pending_import_batch_id`). Los movimientos las referencian en `entry_cash_parties` (quién pagó o cobró, clave `(entrada, persona, dirección)`) y `entry_allocations` (la parte de cada una, clave `(entrada, persona)`); las revisiones inmutables (`entry_revisions`, triggers que impiden editarlas) guardan en su instantánea los mismos datos y el método de reparto. `readLedger` valida cada movimiento contra las personas del libro, así que una referencia a una persona que no está en la lista rompe la lectura de todo el libro.
- La lista de personas y las herramientas de administración están hoy al final del libro (`renderPeople` en `overview-ui.js`); no hay renombrar ni unir. `saveEntry` valida las personas con `participantsFor`.
- `recategorizacion-masiva` ya resolvió el problema de una operación que revisa muchos movimientos: una revisión nueva por movimiento con la instantánea transformada en JavaScript, tandas de 100 con sentencias guardadas por la revisión vista, lote con clave de idempotencia, reanudable. La unión reutiliza ese patrón.
- El paso de correspondencia de la importación guarda `mapping[i]` = id de persona o `"new"`; `mergeEffects` ya suma varias columnas que apuntan a la misma persona.
- Ver `proposal.md` para el motivo y `specs/personas-del-grupo/spec.md` para los requisitos.

## Goals / Non-Goals

**Goals:**

- Que la titular pueda corregir quiénes forman el grupo sin tocar la base: ver, renombrar y unir.
- Que la unión conserve el historial completo y nunca deje el libro inconsistente, ni siquiera interrumpida a la mitad.
- Que el menú sea la forma de llegar a las secciones, integrado con el perfil.

**Non-Goals:**

- Deshacer una unión, separar personas o mover movimientos sueltos (ver Non-goals de la propuesta).
- Reglas nuevas de permisos más allá de «solo la titular administra personas».

## Decisions

### D1. La persona unida se conserva como registro, no se borra

`ledger_participants.merged_into_id` apunta a la destinataria y la persona unida queda con `active = 0`. Las instantáneas de revisiones anteriores siguen mostrando su id y su nombre se resuelve; nada del historial se reescribe. `participantsFor` (usada por la lectura del libro y por `saveEntry`) excluye a las unidas: así una pestaña vieja que intente cargar un movimiento a una persona ya unida recibe «El participante no pertenece al libro» en lugar de dejar una referencia que rompería la lectura. Una tabla `person_merges(ledger_id, id, source_id, target_id, actor_user_id, status, planned, changed, voided, created_at)` registra cada unión; `UNIQUE(ledger_id, source_id)` impide unir dos veces a la misma persona.

*Alternativa descartada:* borrar a la persona unida. Rompería las claves foráneas desde las revisiones, el historial de eventos y cualquier deshacer futuro.

### D2. Se reescriben las tablas vivas y cada movimiento recibe una revisión nueva

Para cada movimiento vigente que referencia a la unida: las partes de cada dirección y las asignaciones se suman por persona (la unida pasa a la destinataria), se escribe una revisión `revised` con la instantánea transformada y el campo `personMerge` (identificador de la unión), y sube `current_revision`. La instantánea **descarta `split`**: sumar partes de dos personas hace que el método («Igual», «Porcentajes»…) deje de describir el reparto, y reabrirlo recalcularía importes distintos. Sin `split`, el formulario de corrección muestra importes exactos, igual que un movimiento importado. El historial de revisiones muestra «Cambió: unión de personas» por el campo `personMerge`.

*Alternativa descartada:* dejar las instantáneas con el id viejo y resolverlo por alias al leer. Obligaría a que cada lector (historial, reabrir, exportar) conozca el alias y a duplicar la regla de suma.

### D3. Una transferencia entre las dos personas se anula

Unir las dos puntas de una transferencia la convertiría en una transferencia de una persona a sí misma, que `validateEntryDraft` rechaza (y rompería la lectura del libro). Su efecto neto es cero, así que se anula con una revisión `voided` y el motivo «unión de personas». La vista previa informa cuántas son. Es el único caso en que la unión cambia el estado de un movimiento.

### D4. Se aplica por tandas, reanudable, con el libro consistente en cada paso

La unión sigue el patrón de la recategorización: el identificador de la unión es `merge_<clave>` (la clave del formulario, de 16 a 120 caracteres), se registra con estado `applying` y se procesa de a 100 movimientos. Cada tanda es un `db.batch` de tres pasos guardados por «el movimiento sigue en la revisión que se vio» (insertar revisiones con `INSERT OR IGNORE`, subir `current_revision`, sumar las filas en la destinataria con `ON CONFLICT … DO UPDATE SET amount_minor = amount_minor + excluded.amount_minor` y borrar las de la unida, solo donde existe nuestra revisión como vigente). En cualquier momento cada movimiento referencia o bien a la unida (aún vigente) o bien a la destinataria, así que el libro se lee bien aunque la operación se corte. Al terminar se vuelve a consultar si quedan filas de la unida (un movimiento corregido a mitad de camino pudo volver a referenciarla) y se repite hasta vaciar; solo entonces, en una sentencia guardada por `NOT EXISTS` de referencias, se marca a la persona como unida, se traslada la cuenta, se resuelven las invitaciones y se escribe el evento y la revisión del libro, una sola vez (token de cierre, como `finish` de la recategorización). Repetir la confirmación con la misma clave devuelve la unión aplicada o la completa.

### D5. Cuenta, invitaciones y nombre

La destinataria conserva su nombre (ella es quien «sigue existiendo»). Si la unida tiene cuenta y la destinataria no, se limpia `linked_user_id` en la unida y se asigna a la destinataria en el mismo `db.batch` (el índice único por libro lo exige en ese orden). Dos cuentas distintas se rechazan antes de escribir. Una invitación pendiente dirigida a la unida se redirige a la destinataria si esta no tiene cuenta ni invitación pendiente (el índice `invitations_one_pending_target` lo impone); si no, se cancela. La vista previa lo dice con las dos situaciones en palabras.

### D6. Vista previa y confirmación en dos pantallas, con los números calculados de la lectura del libro

La vista previa usa `readLedger` (que ya trae movimientos, partes y saldos) y calcula: movimientos que cambian, transferencias que se anulan, saldo de cada persona antes y el de la destinataria después, cuenta e invitaciones. No escribe. La confirmación reenvía la unión con la revisión del libro vista; si el libro cambió se rechaza con «El libro cambió» y se vuelve a la vista previa (mismo comportamiento que la recategorización).

### D7. La pantalla de personas reemplaza las secciones del final del libro

`/spaces/:id/people` muestra `renderPeople` (personas, invitaciones, herramientas de administración) más renombrar y unir por persona, y las personas ya unidas. El libro deja de repetir esas secciones y conserva el aviso de invitaciones pendientes; la pestaña «Personas» del teléfono y el menú llevan a la pantalla nueva.

### D8. Solo la titular administra personas

Renombrar y unir exigen el rol de titular y un libro no archivado, igual que agregar participantes. Los formularios llevan el token CSRF existente.

### D9. Correspondencia de la importación

El texto y el orden de las opciones los decide una función pura (`mappingChoices`) que devuelve opciones y preselección a partir de las personas del grupo, la persona de quien importa y el nombre de la columna; la vista y las pruebas la comparten. La revisión calcula los dos avisos (columnas hacia la misma persona, ninguna hacia quien importa) con otra función pura. Ninguno bloquea; la validación del servidor no cambia.

### D10. El menú es un `<details>` con un guion mínimo

Sin scripts de terceros ni estilos en línea (CSP). El guion servido (`/shell.js`) cierra el menú con Escape, al tocar afuera y al elegir un ancla de la misma página, y quita la foto del avatar si no carga. Sin el guion el menú sigue abriéndose y cerrándose con el propio `<details>`. En 480 px o menos el encabezado muestra solo el avatar para no desbordar a 320 px.

## Risks / Trade-offs

- **Unión grande** (miles de movimientos) → procesa en tandas de 100 dentro de una sola petición; se mide con D1 local y se registra en `CASO-REAL-INTERNO.md`. Si una petición se corta, repetir la confirmación completa lo que falta.
- **No hay deshacer** → la vista previa y la confirmación explican que no se puede deshacer; el registro y el identificador en cada revisión dejan la puerta abierta.
- **Se pierde el método de reparto de los movimientos afectados** → está dicho en la vista previa y es la única forma de que el reparto siga siendo exacto.
- **Una persona con cuenta unida a una sin cuenta** → la destinataria hereda la cuenta; se muestra en la vista previa para que no sorprenda.

## Migration Plan

`0011_person_merge.sql` agrega la columna y la tabla sin tocar datos; aplica a staging con la misma secuencia que las migraciones anteriores (por nombre). No hay conversión de datos. La reversa es no usar la función: la columna queda nula.

## Open Questions

- ¿Hay que poder deshacer una unión? (Se difiere; ver D1 y Risks.)
- ¿Debe el nombre de una persona con cuenta sincronizarse con el apodo del perfil del grupo (`memberships.nickname`)? Hoy no.
