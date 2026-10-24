## 1. Datos y permisos

- [ ] 1.1 Migración: `invitations.participant_id`, `entry_comments`, `expense_ledgers.status`.
- [ ] 1.2 Función `can(...)` y su uso en todas las rutas de libro; pruebas por rol.

## 2. Personas y acceso

- [ ] 2.1 Agregar participante con correo opcional; crear invitación asociada; reenviar y cancelar.
- [ ] 2.2 Aceptar invitación vincula el participante en la misma transacción; conflicto si ya hay otro.
- [ ] 2.3 Vincular a posteriori a un participante sin cuenta, conservando historial y saldos.

## 3. Comentarios

- [ ] 3.1 API de comentarios con autoría, límite de longitud y autorización.
- [ ] 3.2 Bloque de comentarios en el detalle del movimiento.

## 4. Exportación y archivo

- [ ] 4.1 Exportación JSON versionada y CSV separados; prueba de fidelidad (movimientos vigentes, monedas, saldos recalculados iguales).
- [ ] 4.2 Archivar y restaurar con auditoría; bloqueo de escrituras.
- [ ] 4.3 Botones de exportar y archivar en la interfaz (móvil y escritorio).

## 5. Interfaz

- [ ] 5.1 Pantalla de personas: lista con rol y estado, agregar, invitación pendiente, vincular.
- [ ] 5.2 Estados vacíos y errores accesibles.

## 6. Verificación

- [ ] 6.1 E2E: titular invita, la persona acepta y ve el mismo libro; un miembro no administra personas.
- [ ] 6.2 E2E: exportar y comprobar que los datos reproducen los saldos; archivar bloquea escrituras.
- [ ] 6.3 Aislamiento entre dos grupos con identidades distintas.
- [ ] 6.4 Validar OpenSpec en modo estricto, correr pruebas y abrir PR.
