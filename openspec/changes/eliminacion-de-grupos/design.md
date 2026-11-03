## Context

Ver `proposal.md` para el motivo. Estado verificado en `main` (1553229):

- Triggers de `0003` (líneas 121-143): `entry_revisions_no_update|no_delete` y `ledger_events_no_update|no_delete` abortan siempre. `0008` reemplazó `entry_revisions_no_delete` con una condición `WHEN NOT EXISTS (… b.status = 'pending')` que permite descartar lotes sin publicar.
- No hay `ON DELETE CASCADE`. Las claves foráneas apuntan en cadena: `groups` ← `memberships`, `invitations`, `expense_ledgers`, `platform_audit_events`; `expense_ledgers` ← `ledger_participants`, `ledger_entries`, `ledger_events`, `idempotency_keys`, categorías, recategorizaciones, uniones, lotes de importación y filas de origen; `ledger_entries` ← partes de efectivo, repartos, revisiones.
- Precedente de borrado en lote atómico: `discardImportBatch` (`splitwise-import.js`) borra ocho tablas.
- `runMaintenance` (`maintenance.js`) vence invitaciones, depura sesiones y vistas previas, y descarta lotes pendientes viejos. Hoy no toca finanzas ya publicadas.
- Cada pedido consulta `memberships` (y `groups` para el `slug`); unas 26 ocurrencias de `memberships` en `groups.js`, `ledger.js`, `index.js`, `routes/group-settings.js`, `routes/people.js` y `profiles.js`.
- `groups.slug` tiene índice único parcial. `expense_ledgers.revision` sube con cada cambio del libro.
- La excepción de `OPERACION.md` (reescribir migraciones) caducó: producción tiene datos (2 usuarios, 2 grupos y 1 movimiento al 31/10). Toda migración es nueva y aditiva.

## Goals / Non-Goals

**Goals:**
- Que eliminar sea difícil de hacer por error, reversible durante 30 días y completo después.
- Que ningún camino de la aplicación ni de un respaldo restaurado vuelva a mostrar un grupo eliminado.
- Que la base misma impida borrar historia fuera de la ventana.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. Borrado lógico con ventana fija de 30 días (opción B de la exploración)

Se descartaron el borrado físico inmediato (A: irreversible por error humano, sin ventana de arrepentimiento ni de exportación) y la eliminación atendida a mano (C: depende de SQL contra los triggers y no cumple el bloqueo del ciclo de vida). La ventana la fijó Pablo en 30 días. La constante vive en el código (`GROUP_DELETION_WINDOW_DAYS = 30`) y se repite en el SQL de los triggers; una prueba falla si difieren.

### D2. Esquema: marca en `groups` y un registro mínimo

Migración nueva, aditiva:

- `groups.deleted_at TEXT` y `groups.deleted_by_user_id TEXT REFERENCES users(id)`; índice parcial `groups_deleted ON groups(deleted_at) WHERE deleted_at IS NOT NULL`. `deleted_at` usa el formato de `CURRENT_TIMESTAMP` para poder compararse con `datetime('now', '-30 days')`.
- `group_deletion_log(id, group_id UNIQUE NOT NULL, deleted_at, purged_at, deleted_by_user_id REFERENCES users(id), members_count, participants_count, entries_count)`. **`group_id` sin clave foránea**: el grupo ya no existirá. Es un identificador aleatorio opaco; no guarda nombre, descripción ni emails.

El `slug` del grupo eliminado se conserva en la ventana (el índice único lo reserva, aceptable por 30 días); al purgar se libera.

### D3. Visibilidad: un filtro central y una prueba que recorre todo

Un único criterio `groups.deleted_at IS NULL` entra en los puntos de acceso comunes —`resolveGroup`, `getLedgerAccess`, el listado de grupos, la canonización de rutas, el nombre contextual de `profiles.js`, la lista de invitaciones pendientes, `entryTarget`— en lugar de repartirlo por consulta. Dos pruebas aseguran que no quede nada: (1) una prueba estática falla si aparece una consulta nueva a `memberships` o `groups` sin el criterio, salvo una lista corta de excepciones con motivo; (2) una prueba de integración elimina un grupo y recorre **todas** las rutas de grupo con cada rol, esperando 404 (salvo las dos pantallas de recuperación de la persona titular). Escrituras en curso que pasaron la comprobación justo antes de eliminar son inofensivas: se purgan o se restauran junto con el resto.

Las invitaciones pendientes dejan de ser aceptables (la invitación «no se encuentra»); al restaurar siguen su vencimiento normal.

### D4. Eliminar: confirmación reforzada y exportación ofrecida, no impuesta (decisión de Pablo)

Pablo decidió que la aplicación **ofrece** exportar. La pantalla de eliminación muestra: cuántas personas pierden el acceso; que es recuperable 30 días; los botones de exportar; y el estado de la exportación, calculado con la auditoría de `exportacion-completa-del-grupo` (¿existe `ledger_exported` de formato JSON de esta persona con `ledgerRevision` igual a `expense_ledgers.revision`?). Si no la hay, aparece una advertencia visible y una casilla adicional («Entiendo que no exporté la versión actual»), no un bloqueo, porque la exportación sigue disponible durante la ventana (D5). La confirmación exige escribir el nombre exacto del grupo, comparado en el servidor sin distinguir mayúsculas ni blancos repetidos. El `POST` es idempotente: eliminar un grupo ya eliminado devuelve a la lista con el aviso.

*Decisión de Pablo (2026-11-02):* la exportación se **ofrece** y no es obligatoria. Por eso `HOMESUITE_DATA_LIFECYCLE.md` (que decía «exige exportación previa») se corrigió en este mismo PR: ahora dice «ofrecida antes de confirmar y disponible durante la ventana».

### D5. Quién ve qué durante la ventana

- **Persona titular:** «Grupos eliminados» en `/groups`, y `GET /groups/:id/deleted` con los días restantes, «Restaurar» y las descargas de exportación. Las rutas `ledger/export.json|csv` aceptan un grupo eliminado únicamente para su titular y dentro de la ventana.
- **Demás integrantes:** el grupo no existe para ellas (404 en todo). Una nota en `/groups`, durante 30 días, dice «“X” fue eliminado por su titular», derivada del propio registro del grupo, sin enlace. Como ya no pueden exportar, el texto de la pantalla de eliminación y de los términos lo advierte a la persona titular. Propuesta por decidir (Open Questions 2).
- **Restaurar** limpia `deleted_at` y `deleted_by_user_id` y escribe `group_restored`; la membresía nunca se tocó, así que todo vuelve igual. Después del día 30 restaurar se rechaza.

### D6. La excepción controlada a los triggers vive en la base

En la migración se reemplazan `entry_revisions_no_delete` y `ledger_events_no_delete`. La nueva condición de `WHEN` permite el borrado solo si:

```
EXISTS (SELECT 1 FROM expense_ledgers l JOIN groups g ON g.id = l.group_id
        WHERE l.id = OLD.ledger_id AND g.deleted_at IS NOT NULL
          AND g.deleted_at <= datetime('now', '-30 days'))
```

(para `entry_revisions` se mantiene además la condición de lotes sin publicar de `0008`). Los `UPDATE` siguen sin excepción. No hay tabla marcadora ni bandera que el código pueda activar: la única llave es que el grupo lleve 30 días marcado como eliminado, y la aplicación nunca escribe un `deleted_at` anterior a «ahora». Quien opera la base con SQL puede forzarlo, lo que equivale a la excepción controlada y queda registrado en el documento de excepciones. Pruebas: el `DELETE` aborta antes de los 30 días y en un grupo vivo; procede después de 30 días y solo para ese libro; los `UPDATE` abortan siempre.

*Alternativa descartada:* una tabla marcadora que el trigger consulta. Agrega un estado y un camino de código que puede quedar activo por error.

Este cambio relaja un invariante de la base común (historia inmutable). **Pablo aprobó la excepción el 2026-11-02** y quedó registrada como aprobada en el «Registro de excepciones» de `docs/homesuite/README.md`; queda pendiente de implementación y de las pruebas indicadas arriba, que son la evidencia de que funciona como se aprobó.

### D7. La purga corre en el cron diario, en lotes retomables

Un paso nuevo de `runMaintenance` selecciona los grupos con `deleted_at <= ahora - 30 días`, hasta un máximo por corrida, y para cada uno borra en este orden (cada paso un `DELETE … WHERE ledger_id = ?` o por lotes con `LIMIT` cuando son muchas filas): `idempotency_keys`; elementos y uniones de personas; elementos y lotes de recategorización; efectos, movimientos y filas de importación y sus lotes; partes de efectivo y repartos; `entry_revisions` y `ledger_events` (permitidos por los triggers); `ledger_entries`; categorías; `ledger_participants`; `expense_ledgers`; `invitations`; `platform_audit_events` del grupo; `memberships`; y al final `groups`, más la inserción en `group_deletion_log` dentro del mismo lote final. **Las filas inmutables se borran mientras la fila de `groups` y la de `expense_ledgers` todavía existen**, porque la condición del trigger las consulta. La purga es idempotente y reanudable: si una corrida se corta (límite de tiempo o de filas escritas), la siguiente continúa donde quedó, porque el grupo sigue marcado.

Los límites de D1 (filas escritas por día en el plan gratuito, tamaño de lote, tiempo del cron) **no están verificados**; por eso el diseño trocea y acota por corrida y registra `group_purge_progress`. Se mide con el caso real (~2.500 movimientos) en staging.

Una prueba de integración enumera desde `sqlite_master` todas las tablas con columna `group_id` o `ledger_id` y exige que, tras purgar, ninguna tenga filas del grupo: si alguien agrega una tabla nueva y no la incluye en la purga, la prueba falla (también cubre las tablas de lotes de importación, que cuelgan de `ledger_id`).

### D8. Rastro mínimo y errores observables

`group_deletion_log` guarda lo mínimo para dos fines: reaplicar purgas tras restaurar un respaldo (D9) y explicar a quién preguntó qué pasó con un grupo. Una purga que falla escribe `group_purge_failed` (solo nombre de error e identificador opaco) en los logs, y la revisión semanal de `alertas-minimas-homesuite` suma «grupos eliminados hace más de 32 días que siguen sin purgar».

### D9. Restaurar un respaldo nunca revive lo suprimido: lista de supresiones (decisión de Pablo)

Decisión de Pablo (2026-11-02): «restaurar un respaldo nunca revive lo suprimido: reaplica la lista de supresiones». La **lista de supresiones** reúne tres fuentes: (a) `group_deletion_log` (grupos purgados), (b) `account_erasures` (cuentas dadas de baja, de `baja-de-cuenta-homesuite`) y (c) un **registro externo** (D9b). Los grupos todavía dentro de la ventana ya están marcados en la propia base y no necesitan la lista.

Procedimiento tras cualquier restauración, antes de reabrir el servicio: ejecutar `scripts/homesuite-app-reapply-suppressions.sh`, que lee la lista y, para cada grupo que reaparezca, ejecuta `UPDATE groups SET deleted_at = '1970-01-01 00:00:00', deleted_by_user_id = NULL WHERE id IN (…)`; el cron los purga en la siguiente corrida (los triggers lo permiten porque la ventana está vencida). El script corre primero en seco, imprime el plan y solo escribe con confirmación; el ensayo lo ejecuta sobre una base descartable.

### D9b. Registro externo de supresiones

Las tablas de la base solo conocen las supresiones anteriores al punto restaurado: una supresión hecha **después** del respaldo restaurado se perdería con la base, y el grupo reaparecería. Para que la promesa de Pablo («nunca») sea verdadera, la purga escribe una línea (`{ id opaco, tipo: "group", fecha }`) en un objeto de R2 (`suppressions/AAAA-MM.jsonl`) del bucket de respaldos, **fuera del prefijo `production/`** que expira a los 90 días, mediante un binding R2 del Worker de producción. La línea se escribe **antes** del borrado final (idempotente por identificador); si falla, la purga de ese grupo se pospone y se reintenta. Contiene solo identificadores opacos y fechas. `baja-de-cuenta-homesuite` usa el mismo registro (`tipo: "account"`). Es una propuesta que agrega un binding y un permiso: Pablo debe confirmarla (Open Questions 1). Sin ella, la lista queda limitada a las tablas y a la planilla de solicitudes, y el límite se declara en el runbook.

### D10. Ensayo exigido por el backlog

Sobre una base descartable (la misma maquinaria de `homesuite-app-restore-drill.sh`, `node:sqlite`): crear un grupo con movimientos; exportar; eliminar; verificar invisibilidad; adelantar `deleted_at` para simular 30 días; correr la purga; comprobar que no quedan filas; restaurar el SQL de un respaldo previo; verificar que el grupo reaparece; reaplicar con el log; purgar y comprobar de nuevo. El resultado se registra en STATUS con fecha y SHA.

### D11. Interfaz y vocabulario

El glosario suma «Grupo eliminado», «Eliminar grupo» y «Restaurar grupo» (interfaz), `deleted_at` (base), `/groups/:id/delete`, `/groups/:id/restore`, `/groups/:id/deleted` (URLs) y distingue **archivar** (solo lectura, reversible, sigue visible para todos) de **eliminar** (invisible, recuperable 30 días, luego borrado). Estados vacíos y mensajes de error en voseo y sin género.

### D12. Plazos de la Ley 1581 aplicados a la eliminación de grupos

Eliminar desde la aplicación es inmediato y no genera un trámite. Si la persona titular lo pide por correo (por ejemplo, porque no puede entrar), se registra la solicitud según `politica-y-aceptacion` (reclamo de supresión: 15 días hábiles, prorrogables 8; leyenda «reclamo en trámite» dentro de 2 días hábiles; consultas: 10 días hábiles, más 5) y Pablo ejecuta la misma operación desde un script de operación con confirmación, que escribe `group_deleted` con la persona que actúa nula y el identificador de la solicitud en los metadatos. **No hay «eliminar ahora»** (decisión de Pablo): el grupo ya es invisible desde que se elimina, la ventana de 30 días es de arrepentimiento y los 90 días de respaldos son los publicados. La respuesta a un reclamo de supresión se envía dentro del plazo y dice qué quedó inaccesible ya y qué persiste hasta cuándo (ventana, base y copias); no espera a la purga. Es una interpretación que debe revisar una persona abogada (Open Questions 5).

### D13. Copias locales

Hay copias de datos fuera de Cloudflare: los respaldos previos al despliegue de staging en `~/dev/tas-king-backups/homesuite-app/staging/`, el estado local de desarrollo (`.wrangler/`) y los directorios temporales de los ensayos de restauración (se destruyen). TasKing, que es otro producto, tiene sus propios respaldos locales. Regla: **staging y las copias locales solo guardan datos sintéticos**; la exploración registró que el recorrido de importación se probó en staging con ~2.500 filas que podrían ser reales. Tareas: inventariar qué hay y de quién; si hay datos reales, decidir (Open Questions 3) entre borrarlos y tratarlos con el mismo procedimiento de supresión; limpiar los respaldos locales de staging con más de 90 días; y que el procedimiento de solicitudes incluya revisar estas copias.

### D14. Quien pide la supresión de sus datos sale del grupo; el grupo no se elimina

Una integrante que pide la supresión de sus datos no provoca la eliminación del grupo: sale (`salir-y-quitar-integrantes`) o da de baja su cuenta (`baja-de-cuenta-homesuite`). Eliminar un grupo es una decisión exclusiva de su persona titular. El procedimiento de solicitudes lo dice explícitamente.

## Risks / Trade-offs

- [Una consulta nueva olvida el filtro y muestra un grupo eliminado] → filtro central, prueba estática y prueba de recorrido de rutas (D3).
- [La purga corta a medias] → idempotente y reanudable; el grupo ya es invisible, así que un retraso no expone nada.
- [El cron pasa a borrar finanzas, algo que el diseño original prohibía] → solo grupos con 30 días de eliminados; trigger a nivel de base; prueba de que un grupo vivo o dentro de la ventana no puede perder filas.
- [Una restauración resucita grupos purgados] → D9, `group_deletion_log` y el ensayo.
- [Las demás personas pierden el acceso sin poder exportar] → decisión de Pablo; mitigada por la advertencia a la persona titular, la nota y la restauración.
- [La persona titular elimina por error] → confirmación escribiendo el nombre, 30 días para restaurar y exportación disponible.
- [Eliminar no es total: los respaldos conservan el grupo hasta ~120 días] → se dice con esos números en la política.
- [El `deleted_at` forzado a mano abre los triggers] → equivale a la excepción registrada; solo para quien opera la base.

## Migration Plan

1. Respaldo manual previo y migración verificada con datos (actualizar desde el esquema anterior con filas reales, como pide `OPERACION.md`; el restore drill de producción confirma triggers y claves).
2. Migración aditiva (`ALTER TABLE ADD COLUMN`, tabla nueva, reemplazo de dos triggers) y Worker compatible: el Worker anterior ignora las columnas nuevas, pero **no** filtraría grupos eliminados; por eso no se activa la ruta de eliminación hasta que el Worker nuevo esté desplegado (la migración precede al Worker y nadie puede eliminar nada con el código viejo).
3. Desplegar el Worker con el filtro de visibilidad, la pantalla y el paso de purga.
4. Reversión: volver al Worker anterior es seguro si no hay grupos eliminados; con grupos en ventana, restaurarlos antes (o aceptar que seguirían visibles con el código viejo). Los triggers nuevos no se revierten automáticamente (OPERACION.md: no borrar triggers aditivos).

## Decisions de Pablo (2026-11-02)

Definitivas; no se reabren en este change.

- **La exportación se ofrece antes de eliminar y no es obligatoria** (D4). `HOMESUITE_DATA_LIFECYCLE.md` ya no dice «exige».
- **No hay «eliminar ahora».** Quedan 30 días de ventana más 90 de respaldos (D12).
- **Restaurar un respaldo nunca revive lo suprimido:** se reaplica la lista de supresiones (D9).
- **La excepción al `DELETE` de los triggers está aprobada** y registrada (D6).
- **Plazos de la Ley 1581:** consultas 10 días hábiles (más 5), reclamos y supresión 15 días hábiles (más 8), leyenda «reclamo en trámite» dentro de 2 días hábiles (D12). Los pedidos por correo se registran y se miden como define `politica-y-aceptacion`.
- La ventana de 30 días, el borrado lógico y la eliminación exclusiva de la persona titular ya estaban decididos.

## Open Questions

Propuestas por decidir (valor por defecto entre paréntesis, que Pablo debe confirmar):

1. **Registro externo de supresiones en R2** (D9b): se propone construirlo, con un binding R2 del Worker y solo identificadores opacos, porque sin él «nunca» no puede cumplirse para supresiones posteriores al respaldo restaurado. Alternativa: limitarse a las tablas de la base y a la planilla de solicitudes, y declarar el límite.
2. **Nota para las demás personas:** durante 30 días ven el nombre del grupo eliminado, sin acceso. Alternativa: que desaparezca sin rastro.
3. **Datos reales en staging y copias locales** (D13): qué hacer con lo que haya hoy (borrar o tratar como real). Por defecto, no cargar datos reales a staging desde ahora.
4. **Eliminar un grupo archivado:** permitido.
5. **Plazo legal exacto y suficiencia de 30 + 90 días:** la investigación normativa del 2026-11-02 lo considera defendible si el acceso ya está bloqueado, los respaldos vencen solos, un restore no reintroduce lo suprimido y la respuesta informa qué persiste; no es asesoramiento legal y lo revisa Pablo (idealmente con una persona abogada).
6. **Quién puede restaurar si la persona titular dio de baja su cuenta:** nadie; el grupo se purga a los 30 días (ver `baja-de-cuenta-homesuite`).
