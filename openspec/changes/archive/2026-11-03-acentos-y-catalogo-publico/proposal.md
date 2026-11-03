## Why

El marco de identidad pide explorar «colores de acento por producto sin fragmentar la marca» (§8). Pablo aprobó
el 2026-10-27 una paleta con los colores que la suite ya tiene (verde, terracota, ámbar, azul verdoso) y que se
use en rótulo, borde e ícono, sin tocar los botones. Además decidió mostrar en el sitio público sólo las tres
herramientas funcionales (Fun TasKing, Cuentas Claras y Remanso) y ocultar Compras hasta que exista.

## What Changes

- Acento por producto en el sitio (tarjetas de la portada, rótulos de las landings) y en las tarjetas de herramientas
  de la app: verde para Fun TasKing, terracota para Cuentas Claras, ámbar para Remanso. En Remanso, el rótulo
  («Remanso») de sus pantallas pasa del coral de la suite al ámbar. Botones y fondos con texto blanco no cambian.
- El terracota de las tarjetas del sitio pasa de `#97562f` a `#904f2a`: el original no llegaba a 4,5:1 sobre su fondo suave.
- La portada muestra tres tarjetas. La landing de Compras sale de `apps/site/public/` (y deja de publicarse) y espera
  en `apps/site/pendientes/compras.html`; ninguna página enlaza a ella.
- Pruebas: contraste de cada acento en claro y oscuro, que cada tarjeta y landing declare su producto, que la portada
  tenga tres tarjetas y que `/compras` responda 404.

## Out of scope

- El azul verdoso de Compras: queda definido en la paleta pero sin uso hasta que Compras vuelva.
- La app: la tarjeta de Compras («en preparación») sigue en el inicio de la app y su ruta `/compras`, porque la
  decisión fue sobre el sitio público.
- Logo, emblema y favicon.
- Pantallas internas de Fun TasKing y Cuentas Claras.

## Capabilities

### Modified Capabilities

- `landing-publica-homesuite`: catálogo público de tres herramientas y acento visible por producto.
