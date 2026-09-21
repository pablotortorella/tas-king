## Context

El sitio público ya está en producción como `homesuite-site`, sin estado ni
autenticación. La visión documentada reserva `/tareas`, `/gastos` y `/compras`
para landings públicas, distintas de las rutas futuras de `app.homesuite.info`.

## Goals / Non-Goals

**Goals:** tres rutas comprensibles, continuidad visual con la portada,
navegación por enlaces normales y estado honesto de cada producto.

**Non-Goals:** shell autenticado, un diseño final de producto, JS de cliente,
formularios o una nueva unidad de despliegue.

## Decisions

### D1. HTML estático por producto

Se agregan `tareas.html`, `gastos.html` y `compras.html` en el mismo directorio de
assets. Cloudflare sirve los archivos `.html` mediante sus rutas limpias
`/tareas`, `/gastos` y `/compras`. No se agrega router ni renderizado dinámico.

### D2. CSS compartido y motivos decorativos propios

Las tres páginas reutilizan tipografía, colores, header, footer y botones de la
portada. Un pequeño conjunto de clases `product-*` crea diferenciación visual
sin imágenes externas, JavaScript ni copiar toda la hoja de estilos.

### D3. Navegación y disponibilidad explícitas

Cada tarjeta de la portada enlaza a su landing. Sólo la de TasKing ofrece desde
allí un CTA de entrada al producto en su dominio actual. Gastos y Compras
mantienen la etiqueta «En preparación» y un enlace para volver a la suite; no
simulan altas, compras, balances ni listas operativas.

### D4. Mismo Worker y mismas garantías

`apps/site/src/index.js` y `wrangler.jsonc` no necesitan cambiar: las páginas
son assets públicos y heredan redirección canónica, restricciones de métodos y
cabeceras de seguridad. Se prueban por HTTP real local, no sólo leyendo HTML.

## Risks / Trade-offs

Duplicar el shell en tres archivos HTML exige editar varias páginas si cambia la
marca. Para tres landings estáticas es más sencillo que introducir un build o
templating runtime. Si la suite crece, se evaluará una generación estática.

## Verification

- OpenSpec strict y pruebas unitarias/E2E de `apps/site`.
- Navegación desde la portada y acceso directo a cada URL limpia.
- CTA de TasKing, estados futuros, cabeceras y 360 px sin overflow.
- Suite completa de TasKing antes de integrar; preview remoto sólo con permiso.
