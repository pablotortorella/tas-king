## Why

Staging sólo tenía la app autenticada y abría directamente en Cuentas Claras.
Eso impedía revisar el recorrido que tendrá la suite en producción: home pública,
landings de producto, entrada a la app, elección de herramienta y perfil común.
La API de perfil ya existe, pero todavía no había una interfaz para editarla.

## What Changes

- Un Worker público de staging sirve la misma home y landings del sitio público,
  bajo `site-staging.homesuite.info`, sin sesiones ni bindings privados.
- Su landing de Cuentas Claras conduce a la app del mismo entorno. La de Tareas
  conduce al TasKing de staging. Producción conserva sus enlaces y estados.
- La raíz de `staging.homesuite.info` presenta HomeSuite y sus herramientas;
  `/cuentas-claras` muestra la landing del producto y, con sesión, «Muy pronto».
- El perfil global se edita en `/perfil` mediante la API existente. Avatar/nombre
  y menú general ofrecen dos entradas a la misma pantalla.

### Non-goals

- Migrar TasKing a la sesión de HomeSuite o crear funcionalidad financiera.
- Publicar producción, copiar datos de producción o añadir otra base D1.
- Editar el apodo por espacio antes de contar con la interfaz de espacios.
- Permitir subir fotos; se usa la referencia validada de Google.

## Capabilities

### New Capabilities

- `recorrido-staging-suite`: continuidad de navegación entre sitio público y app.
- `perfil-global-ui`: edición propia del perfil común desde la app.

## Impact

`apps/site/` añade un entorno de staging público; `apps/app/` modifica navegación
y añade UI de perfil sin migraciones. La URL OAuth y la D1 de la app permanecen en
`staging.homesuite.info`. Decisiones y evidencia en los documentos de plataforma,
infraestructura y STATUS.
