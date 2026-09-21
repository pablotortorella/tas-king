## Why

La herramienta financiera de HomeSuite se llama Cuentas Claras: abarca gastos,
ingresos, transferencias y saldo neto, mientras que «Gastos» describe sólo una
parte del producto. Como la landing es nueva y aún no tiene enlaces externos que
preservar, el nombre y su URL deben cambiar ahora, sin compatibilidad heredada.

## What Changes

- La landing pública pasa de `/gastos` a `/cuentas-claras` y usa Cuentas Claras
  como nombre de producto en título, navegación, metadatos y contenido visible.
- La portada y los enlaces cruzados de las otras landings apuntan a la nueva ruta.
- El asset `gastos.html` se elimina; `/gastos` no redirige y deja de ser ruta
  pública del producto.
- Las pruebas, la spec de la landing y la documentación de navegación adoptan el
  nombre y la ruta nuevos.

### Non-goals

- Implementar la aplicación autenticada, OAuth, sesiones o Cuentas Claras como
  producto funcional.
- Redirigir o mantener `/gastos`: no existen personas usuarias ni enlaces que
  requieran compatibilidad.
- Reescribir todavía los nombres históricos de archivos de exploración financiera;
  se actualizarán de manera coherente junto con el change de plataforma o una
  limpieza documental posterior.

## Capabilities

### Modified Capabilities

- `landing-publica-homesuite`: Cuentas Claras reemplaza a Gastos como producto
  financiero público y su landing canónica usa `/cuentas-claras`.

## Impact

Cambian sólo `apps/site/public/`, pruebas de `apps/site`, el contrato OpenSpec y
documentación de navegación. El Worker público sigue sin datos, sesión, OAuth ni
APIs, y no se modifica TasKing.
