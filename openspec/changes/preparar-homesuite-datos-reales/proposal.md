## Why

HomeSuite ya puede autenticar y compartir grupos, pero todavía no debe recibir
datos financieros reales: carece de un esquema monetario físico, protección ante
reintentos y abuso, mantenimiento de datos efímeros y un procedimiento de backup
y restauración comprobado. Este cambio deja esas garantías operativas listas
antes de implementar el primer movimiento de Cuentas Claras.

## What Changes

- Se define y migra el núcleo físico de libros, participantes, movimientos,
  partes de efectivo, asignaciones, revisiones, eventos e idempotencia.
- Se representan importes exclusivamente como enteros en unidad menor y monedas
  ISO 4217 explícitas; se agregan validadores y repartos deterministas sin pérdida
  por redondeo.
- Se incorporan límites de payload y rate limiting específico para login y
  mutaciones autenticadas, con respuestas 413/429 y observabilidad segura.
- Se añade mantenimiento programado de sesiones e invitaciones vencidas, sin
  eliminar historia financiera ni auditoría.
- Se versionan comandos de exportación, bookmark y ensayo de restauración para D1,
  y el deploy de staging exige un respaldo antes de migrar.
- Se documentan retención, exportación, eliminación y condiciones que bloquean el
  uso de datos reales o la apertura de producción.
- No se agrega todavía una UI ni endpoints para registrar gastos, ingresos o
  transferencias.

## Capabilities

### New Capabilities

- `nucleo-financiero-cuentas-claras`: modelo monetario, invariantes, revisiones e idempotencia que sostendrán los movimientos.
- `proteccion-operativa-homesuite`: límites de solicitudes, rate limiting y mantenimiento de sesiones e invitaciones.
- `recuperacion-datos-homesuite`: respaldo, bookmark, restauración verificable y política de ciclo de vida de datos.

### Modified Capabilities

Ninguna capacidad canónica cambia; la plataforma mínima continúa siendo la base
de identidad y grupos sobre la que se agregan estas garantías.

## Impact

- Nuevas migraciones y módulos bajo `apps/app/`.
- Nuevos bindings de rate limiting y un cron exclusivo de staging.
- Nuevos scripts y artefactos locales ignorados para backup/restore de HomeSuite.
- Cambios en los scripts de despliegue de staging para respaldar antes de migrar.
- Documentación de privacidad, recuperación y operación; producción permanece
  sin crear y R2 se difiere hasta definir retención externa de largo plazo.
