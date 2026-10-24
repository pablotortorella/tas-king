# Cuentas Claras: rediseño visual (octubre de 2026)

Diseño de las pantallas de Cuentas Claras, el producto financiero de HomeSuite. Es **material de diseño, no código de producto**: nada de esto está implementado en `apps/app/`. Sirve de referencia visual para los changes de OpenSpec que lo implementan y para retomar el trabajo de diseño.

- **Estado**: borrador completo de 10 pantallas, en claro y oscuro, con datos de demostración sintéticos.
- **Origen**: se hizo en Claude Design a partir de `docs/HOMESUITE_CUENTAS_CLARAS_MVP.md`, el Journey, el Story Map y los estilos de `apps/site/public`.
- **Artefacto original** (privado, versión 16 al 2026-10-23): https://claude.ai/artifact/D5oHdq49zM2V8R2zNQyfei
- **Propuestas OpenSpec que lo usan**: `openspec/changes/libro-y-saldos-cuentas-claras`, `importacion-splitwise-inicial`, `busqueda-movimientos-unificada` y `colaboracion-y-exportacion-del-libro`.

## Qué hay en esta carpeta

| Ruta | Contenido |
|---|---|
| `capturas/claro/`, `capturas/oscuro/` | 13 PNG por modo (las 10 pantallas más 3 estados alternativos). Es lo más rápido para entender el diseño |
| `project/*.dc.html` | Fuente de cada pantalla: HTML con estilos en línea y variables CSS. Se leen como texto |
| `project/canvas.json` | Índice del lienzo: posición, tamaño y título de cada pantalla, y los rótulos de cada fila |
| `tokens.json` | Colores claro y oscuro con su rol, valores fijos, tipografía y tabla de contraste calculada |
| `herramientas/capturar.js` | Script de Playwright que regenera las capturas |

`project/` replica la estructura del artefacto, de modo que esa carpeta se puede volver a publicar tal cual.

## Las pantallas

| N.º | Archivo | Qué muestra | Change de OpenSpec |
|---|---|---|---|
| 1 | `NuevoGrupo` | Nombre, propósito, moneda y participantes | `libro-y-saldos-cuentas-claras` |
| 2 | `PuntoDePartida` | Importar de Splitwise, empezar en cero o con saldos anteriores | `importacion-splitwise-inicial` |
| 3 | `Importar` | Revisión antes de guardar: personas, incidentes por fila, conciliación, confirmar | `importacion-splitwise-inicial` |
| 4 | `Main` | Saldos con selector COP/USD y sugerencias para quedar a mano. Interactiva (`04b` es el estado USD) | `libro-y-saldos-cuentas-claras` |
| 5 | `Movimientos` | Historial con búsqueda única, motivo de coincidencia y marca de origen | `busqueda-movimientos-unificada` |
| 6 | `Agregar` | Gasto, ingreso y transferencia (`06b` y `06c` son los otros tipos). Interactiva | `libro-y-saldos-cuentas-claras` |
| 7 | `Detalle` | Reparto, historial de revisiones, comentarios, editar y anular | `libro-y-saldos-cuentas-claras`, `colaboracion-y-exportacion-del-libro` |
| 8 | `SaldoDe` | «Por qué te deben $1.748.350»: movimiento por movimiento con acumulado | `libro-y-saldos-cuentas-claras` |
| 9 | `Escritorio` | Libro de dos paneles: saldos, sugerencias y movimientos | los cuatro |
| 10 | `Personas` | Roles, invitación pendiente, participante sin cuenta, exportar y archivar | `colaboracion-y-exportacion-del-libro` |

## Datos de demostración

Todas las pantallas comparten el mismo conjunto, para que los números cierren entre sí. Son inventados, salvo el correo del titular en la pantalla 10.

- **Personas**: Pablo (titular), Laura (miembro con cuenta), Ana (invitación pendiente), Mateo (sin cuenta).
- **COP**: saldo de Pablo +$1.748.350; Mateo −$122.050; Laura −$389.050; Ana −$1.237.250 (suman $0). USD aparte: Laura +US$80, Mateo 0, Ana −US$40, Pablo −US$40.
- **Movimientos nuevos**: supermercado 22 oct ($286.400, pagó Pablo, igual entre 4); alquiler 20 oct ($1.800.000, recibió Ana, 50/50 con Pablo); adelanto 18 oct ($150.000, Pablo a Laura).
- **Importados** (36 válidos, 2 con incidente, 1 fila de resumen): 35 en COP y 1 en USD. Incidentes: fila 12 (falta el efecto de Mateo) y fila 27 (moneda «COL»). El saldo de Pablo se explica así: 483.550 + 150.000 + 900.000 + 214.800 = 1.748.350.

## Cómo retomar el trabajo

**Opción A: seguir en Claude Design.** Abrir el artefacto de arriba (hay que tener acceso: es privado hasta que su dueño lo comparta). Si no está disponible, crear un lienzo nuevo con el tipo Design y publicar el contenido de `project/` tal cual (`project/canvas.json` más los `.dc.html`).

**Opción B: tomarlo como especificación visual.** Las capturas y los `.dc.html` alcanzan para implementar. Los colores están en `tokens.json`; el modo oscuro se activa con `prefers-color-scheme` o con `data-theme="dark"` en `<html>`.

**Regenerar las capturas.** Cada `.dc.html` carga `./support.js`, que es el runtime del editor de Claude Design y **no se versiona acá**. Se obtiene del artefacto (`artifact-type/dc-runtime.js`).

1. Copiar `project/*.dc.html` a una carpeta temporal y poner ahí el runtime con el nombre `support.js`.
2. En esa carpeta: `python3 -m http.server 8899 --bind 127.0.0.1`.
3. Desde `herramientas/`: `NODE_PATH=$(npm root -g) node capturar.js ../capturas` (requiere Playwright).

Las capturas del repo se generaron con Chromium, a doble resolución y cuantizadas a 256 colores para ocupar ~2,3 MB en total.

## Decisiones y pendientes

Las decisiones de producto pendientes están en las **Open Questions** de cada `design.md` de OpenSpec. Lo que concierne a estas pantallas:

- Las tarjetas de importados dicen «pagó Ana» sin aclarar que es una inferencia. Debe rotularse como tal o quitarse (change `importacion-splitwise-inicial`, D2).
- La opción «Empezar con saldos anteriores» (pantalla 2) no tiene change que la implemente; debería mostrarse deshabilitada.
- COP se muestra sin decimales; el CSV de ejemplo trae dos.
- El control segmentado COP/USD en oscuro tiene la opción activa más oscura que el resto del control. Revisar si se invierte.
- La paleta oscura es provisoria: la identidad de temas de la suite (HT-01, HT-02 del backlog) sigue sin definirse.

## Verificación y límites

- El contraste de los pares listados en `tokens.json` se calculó (todos ≥ 5,1 en las comprobaciones de texto). No se auditaron todos los pares de todas las pantallas.
- Las pantallas se renderizaron en Chromium y se miraron en las capturas de esta carpeta: casi todas en modo oscuro y varias en claro, no todas. No se probaron en un teléfono ni en otros navegadores.
- En una revisión visual se corrigieron tres cosas: las alturas de Importar (1512 px) y Escritorio (1108 px) en el lienzo, una columna de la tabla de conciliación que quedaba cortada y la coherencia de las personas entre las pantallas 3 y 10.
- La tipografía Inter se carga desde Google Fonts; sin conexión se usa la del sistema.
