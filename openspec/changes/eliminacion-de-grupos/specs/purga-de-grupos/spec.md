## Purpose

Define la purga física de los grupos eliminados al vencer la ventana de 30 días, la excepción controlada a la inmutabilidad del historial, el rastro mínimo que queda y la recuperación tras restaurar un respaldo.

## ADDED Requirements

### Requirement: El mantenimiento diario purga los grupos eliminados hace 30 días o más

El mantenimiento diario SHALL borrar físicamente cada grupo cuya eliminación tenga 30 días o más, junto con todo lo que depende de él: integrantes, invitaciones, libro, personas, movimientos con sus partes, repartos y revisiones, eventos del libro, categorías, recategorizaciones, uniones de personas, lotes de importación y filas de origen, claves de idempotencia y auditoría de la plataforma del grupo. La purga SHALL ser idempotente y reanudable: si una corrida no termina, la siguiente SHALL continuar. La purga SHALL NOT tocar grupos vivos ni grupos eliminados hace menos de 30 días.

#### Scenario: Purga al vencer la ventana

- **WHEN** corre el mantenimiento y un grupo lleva 30 días eliminado
- **THEN** no queda ninguna fila de ese grupo en ninguna tabla

#### Scenario: Dentro de la ventana

- **WHEN** corre el mantenimiento y un grupo lleva 29 días eliminado
- **THEN** el grupo conserva todas sus filas y puede restaurarse

#### Scenario: Grupo vivo

- **WHEN** corre el mantenimiento con un grupo no eliminado
- **THEN** el grupo no cambia

#### Scenario: Corrida interrumpida

- **WHEN** una purga se interrumpe antes de borrar todo y corre el mantenimiento siguiente
- **THEN** la purga continúa y termina sin errores ni duplicados

### Requirement: La base impide borrar historia fuera de la ventana

La base de datos SHALL permitir el borrado de filas de `entry_revisions` y `ledger_events` únicamente cuando el grupo de su libro esté marcado como eliminado desde hace 30 días o más (además del descarte de lotes sin publicar que ya existe). Cualquier `UPDATE` sobre esas tablas SHALL seguir abortando siempre. Cualquier otro `DELETE` sobre ellas SHALL abortar.

#### Scenario: Borrar historia de un grupo vivo

- **WHEN** se intenta borrar una revisión de un movimiento de un grupo vivo
- **THEN** la base aborta la operación y la revisión sigue existiendo

#### Scenario: Borrar historia dentro de la ventana

- **WHEN** se intenta borrar un evento del libro de un grupo eliminado hace 10 días
- **THEN** la base aborta la operación

#### Scenario: Borrar historia vencida la ventana

- **WHEN** se borra una revisión de un grupo eliminado hace 30 días
- **THEN** la operación procede, y solo afecta a ese libro

#### Scenario: Modificar historia

- **WHEN** se intenta actualizar una revisión o un evento, también en un grupo vencido
- **THEN** la base aborta la operación

#### Scenario: Ventana consistente

- **WHEN** una prueba compara la constante de ventana del código con el SQL de los triggers
- **THEN** ambos valen 30 días

### Requirement: Tras la purga no quedan filas huérfanas, incluso con tablas futuras

Una prueba SHALL enumerar desde el esquema todas las tablas con columna `group_id` o `ledger_id` y comprobar que, después de purgar, ninguna conserva filas del grupo. Agregar una tabla con esas columnas sin incluirla en la purga SHALL hacer fallar la prueba.

#### Scenario: Tabla nueva sin purga

- **WHEN** se agrega una tabla con `ledger_id` y la purga no la contempla
- **THEN** la prueba falla señalando la tabla

### Requirement: Solo queda un registro mínimo y sin contenido

Al purgar, el sistema SHALL conservar únicamente una fila en `group_deletion_log` con un identificador opaco del grupo, las fechas de eliminación y de purga, la persona que lo eliminó y los conteos de integrantes, personas y movimientos. La fila SHALL NOT contener el nombre, la descripción, emails ni importes. La purga SHALL emitir un registro estructurado sin nombres ni emails.

#### Scenario: Registro tras la purga

- **WHEN** se purga un grupo llamado «Casa de playa» con 2 integrantes y 40 movimientos
- **THEN** existe una fila de registro con el identificador opaco, las fechas y los conteos, y ninguna columna contiene «Casa de playa»

### Requirement: Restaurar un respaldo nunca revive lo suprimido

Después de restaurar un respaldo, y antes de reabrir el servicio, el procedimiento de recuperación SHALL reaplicar la lista de supresiones: los grupos purgados registrados en `group_deletion_log` y en el registro externo de supresiones en R2 que reaparezcan en la base restaurada SHALL marcarse como eliminados hace más de 30 días para que el mantenimiento los purgue, y SHALL NOT ser visibles para nadie en ningún momento. La purga SHALL registrar el identificador opaco del grupo en la lista, incluido el registro externo (que SHALL contener solo identificador opaco, tipo y fecha), antes de borrarlo. El procedimiento SHALL ensayarse sobre una base descartable con un ciclo completo de exportar, eliminar, purgar, restaurar un respaldo anterior y reaplicar.

#### Scenario: Ensayo de recuperación

- **WHEN** se restaura un respaldo tomado antes de la purga de un grupo y se reaplica la lista de supresiones
- **THEN** el grupo no es visible para nadie y el mantenimiento siguiente lo purga por completo

#### Scenario: Supresión posterior al respaldo

- **WHEN** un grupo se purgó después del respaldo restaurado y el registro externo lo contiene
- **THEN** la reaplicación lo encuentra aunque no figure en las tablas de la base restaurada

#### Scenario: Purga que no pudo registrarse

- **WHEN** el registro externo no acepta la escritura
- **THEN** la purga de ese grupo se pospone y se reintenta sin borrar nada

### Requirement: Los respaldos y la política dicen cuánto persiste un grupo eliminado

La documentación y los textos legales SHALL declarar que el grupo eliminado es recuperable durante 30 días, que se purga de la base después y que puede persistir en copias de seguridad hasta 90 días más, es decir, hasta unos 120 días desde que se eliminó.

#### Scenario: Texto de privacidad

- **WHEN** se lee la sección de conservación de la política de privacidad
- **THEN** menciona la ventana de 30 días, la purga y la persistencia de hasta 90 días en las copias
