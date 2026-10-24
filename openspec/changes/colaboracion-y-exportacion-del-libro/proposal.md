## Why

Un libro sólo es útil si las personas correctas pueden usarlo y si su historia no
queda atrapada. Faltan cuatro cosas que el MVP exige para el reemplazo familiar
usable (corte B): gestionar a quienes participan con y sin cuenta, comentar un
movimiento, exportar los datos y archivar el grupo. La plataforma ya invita por
email; falta conectar esa invitación con un participante del libro sin trasladar
saldos de forma implícita.

Referencia visual (en `docs/diseno/cuentas-claras/`): lienzo «Cuentas Claras» de Claude Design, pantalla 10
(«Personas y acceso»), el bloque de comentarios de la pantalla 7 y el botón
«Exportar» de la pantalla 9.

## What Changes

- Pantalla de personas: lista del grupo con rol (propietario, miembro) y estado
  (con cuenta, invitación pendiente, sin cuenta); agregar a alguien por nombre con
  correo opcional; reenviar o cancelar una invitación pendiente.
- Invitación asociada a un participante: al aceptarla, la cuenta se vincula a ese
  participante. Aceptar nunca mueve saldos entre participantes distintos.
- Vincular después a un participante sin cuenta con una cuenta, conservando su
  historial y saldos.
- Permisos del libro: el propietario administra todo; un miembro crea movimientos
  y corrige o anula los propios.
- Comentarios en un movimiento, con autor y fecha.
- Exportación: JSON completo (entidades, ids, monedas, revisiones, auditoría) y CSV
  legible para análisis.
- Archivar el grupo (solo lectura, restaurable). No hay eliminación definitiva con
  historia desde el flujo habitual.

### Non-goals

- Revocar miembros, transferir la propiedad y más roles (siguen fuera, como en
  `plataforma-homesuite-minima`).
- Enlaces de invitación, correo transaccional, notificaciones y feed de actividad
  del grupo.
- Adjuntos y comprobantes.
- Restauración de un libro desde JSON y backups: operación, no interfaz.
- Perfil de HomeSuite (HP-01, HP-02): los avatares son iniciales provisorias.

## Capabilities

### Added Capabilities

- `participantes-y-acceso-del-libro`: personas con y sin cuenta, invitación
  asociada, vinculación y permisos por rol.
- `comentarios-de-movimientos`: conversación breve sobre un movimiento.
- `exportacion-y-archivo-del-libro`: exportar JSON/CSV, archivar y restaurar.

## Impact

- `apps/app/`: columna `participant_id` en invitaciones (extiende el esquema de la
  plataforma), tabla de comentarios, rutas de exportación y archivo, pantalla
  de personas.
- Depende de `libro-y-saldos-cuentas-claras` y de las invitaciones de
  `plataforma-homesuite-minima`.
- Pruebas de permisos por rol, aislamiento entre libros y fidelidad de exportación.
