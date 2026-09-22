## Why

HomeSuite ya tiene una superficie pública, pero Cuentas Claras necesita una
frontera privada real antes de importar historia financiera. La autenticación de
TasKing no se puede reutilizar como plataforma: está ligada a otro Worker,
identifica sesiones por email y usa una lista global de acceso en lugar de
permisos por espacio.

El primer corte debe probar la colaboración de dos personas sin adelantar el
modelo de gastos. Una persona tiene que poder entrar con Google, nombrar su
espacio, invitar a otra por email y compartir sólo ese espacio cuando ambas lo
confirmen.

## What Changes

- Se crea `apps/app/` como Worker full-stack independiente para la aplicación
  autenticada de HomeSuite, con shell y API bajo el mismo origen.
- Google es el único proveedor inicial. La identidad se vincula al claim estable
  `sub`; el email verificado sirve para localizar invitaciones, no como identidad
  primaria.
- Se incorporan usuarios, espacios, membresías, invitaciones y auditoría mínima
  en una D1 propia de HomeSuite App.
- Una persona autenticada crea explícitamente un espacio con nombre libre y queda
  como titular; el espacio muestra un Cuentas Claras vacío, sin movimientos ni
  saldos todavía.
- El titular invita por email exacto, ve invitaciones pendientes y puede
  cancelarlas. La persona invitada inicia sesión con esa cuenta de Google, ve el
  espacio, el titular y Cuentas Claras, y acepta o rechaza antes de acceder.
- La aplicación se prueba localmente y se prepara para staging aislado en
  `staging.homesuite.info`; producción en `app.homesuite.info` queda sujeta a
  revisión y aprobación explícita.

### Non-goals

- CSV, transacciones, saldos, importación, búsqueda o cualquier regla financiera
  de Cuentas Claras.
- Correo transaccional, enlaces de invitación, invitaciones reutilizables o
  proveedores de identidad distintos de Google.
- Transferencia de titularidad, más roles, eliminación de miembros o varios
  administradores. El esquema queda preparado para que una transferencia futura
  sea posible.
- Migrar TasKing, compartir su cookie, modificar su Worker o sus recursos.
- Cambiar nuevamente la landing pública o reintroducir compatibilidad con
  `/gastos`: la migración a `/cuentas-claras` ya se completó, sin redirección,
  en el change separado `renombrar-gastos-a-cuentas-claras`.

## Capabilities

### Added Capabilities

- `plataforma-homesuite-minima`: identidad, sesiones, espacios privados,
  membresías e invitaciones dirigidas por email para la primera colaboración de
  Cuentas Claras.

## Impact

- Nueva aplicación y configuración bajo `apps/app/`, sin modificar `apps/site/`
  ni el Worker actual de TasKing.
- Nuevas migraciones, pruebas unitarias y E2E propias de HomeSuite App.
- Nuevos recursos Cloudflare y dos clientes OAuth de Google, uno por ambiente;
  su creación y secretos no se versionan.
- La exploración de producto queda en
  `docs/HOMESUITE_PLATAFORMA_EXPLORACION.md` como fuente de las decisiones.
