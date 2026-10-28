## Context

Las tarjetas del sitio ya usaban un color por producto en el ícono (terracota, azul verdoso, ámbar); la app no. El
marco de identidad pide evolucionar la identidad actual, no reemplazarla, y no fijar una paleta nueva.

## Decisions

1. **Sólo colores que ya existen en la suite.** Verde (marca), coral/terracota (techo del emblema), ámbar (luz de las
   ventanas) y azul verdoso. Sin colores nuevos.
2. **Acento en rótulo, borde e ícono; botones sin cambios.** La terracota no cumple AA con texto blanco, así que
   los botones primarios siguen en el verde de la suite. Aprobado por Pablo.
3. **Terracota `#904f2a`**, no `#97562f`: el original daba 4,41:1 sobre `#f5dfc6` (ícono sobre su fondo suave); el
   nuevo da 4,87:1. Lo detectó la prueba de contraste.
4. **Tokens por producto en el CSS** (`--product-accent`, `--product-accent-soft` en el sitio; `tool-tasks`,
   `tool-expenses`, `tool-calm` en `theme.js` de la app, que es el único lugar de colores de la app). Cada
   producto se declara con una clase (`tool-card-<producto>`, `product-page-<producto>`).
5. **Remanso:** su rótulo pasa del coral de la suite al ámbar (claro `#7a5418`, oscuro `#d4ad58`); su prueba de
   contraste existente lo cubre. Sus botones siguen en el verde de la suite.
6. **Compras oculto, no borrado.** Su landing se mueve a `apps/site/pendientes/compras.html` (fuera de `public/`,
   por lo que no se publica) y se conserva su CSS. Volver a publicarla es moverla de nuevo y reponer la tarjeta y
   los enlaces. Una prueba exige que el archivo siga existiendo allí.
7. **Sin agrupar en «organizar» y «cuidar».** Pablo describió los tres productos como dos de organizar y uno de
   cuidar. Eso se comunica con el título y el texto del hero («organizar lo cotidiano y encontrar momentos de
   calma»), no con encabezados ni categorías de navegación: la decisión previa fue que los verbos son
   dimensiones de la marca (identidad §2) y no «mitades».

8. **Rótulo «Versión Beta»** (Pablo, 2026-10-27) para Cuentas Claras y Remanso, en lugar de «Próximamente»
   y «En preparación»: describe que funcionan y se están probando. Se aplicó también a las landings y a los
   enlaces «También en HomeSuite», para que ninguna página se contradiga. Fun TasKing sigue «Disponible».

## Risks

- **Coordinar con el entorno de producción de HomeSuite App** (a cargo de Pablo, en paralelo; este change no lo
  toca): el rótulo «Versión Beta» promete que se puede probar. Resuelto el 2026-10-28 en
  `textos-y-enlaces-de-produccion`: el HTML ya lleva los enlaces a `app.homesuite.info` y el sitio se publica
  después de la app.

- La tarjeta de Compras sigue visible en el inicio de la app: es coherente con la decisión (sólo sitio público) pero
  puede sorprender; ver «Out of scope».
- El texto «Las próximas herramientas llegarán sobre la misma base» de la portada ya no suena a lista larga con tres
  tarjetas; se mantiene hasta decidir el tono del sitio.
