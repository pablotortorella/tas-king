## Why

Pablo pidió (2026-10-28) preparar el sitio público y la app para el primer deploy a producción: Fun TasKing, Cuentas Claras
y Remanso estarán activos, los dos últimos en versión beta, y el sitio público debe quedar apuntando a la versión de cada
app de producción. Hoy los enlaces a las apps existen sólo en staging (los agrega el worker del sitio), la página
`/tareas` de la app abre el TasKing de staging aunque sea producción, y los textos todavía hablan de herramientas «que se
están creando». Además no hay forma de comprobar que sitio y app cuenten lo mismo.

## What Changes

- El HTML del sitio lleva los enlaces de **producción** (`app.homesuite.info`, TasKing de producción); el worker de staging
  los reescribe a los del staging. Se elimina el marcador `staging-app-entry`: lo que se lee en el repositorio es lo que se
  publica en producción.
- Cuentas Claras y Remanso muestran «Entrar a …» en su landing, y la portada ofrece «Probá Remanso». Textos en presente
  y en versión beta («Ya podés usarla; la seguimos mejorando»); la portada deja de decir que las próximas herramientas
  «llegarán». Los términos suman una frase sobre las versiones beta (propuesta para revisión de Pablo).
- La app tiene una lista única de herramientas (`apps/app/src/tools.js`) con nombre, ruta y estado, y la página `/tareas`
  abre el TasKing del ambiente de quien la pide (producción sólo desde `app.homesuite.info`).
- Verificación de coherencia sitio ↔ app: una prueba en CI contra el HTML del repositorio y un comando
  (`npm run verify:coherence:staging|production`) que la corre contra lo publicado.

## Out of scope

- Publicar nada en producción: el deploy lo ordena Pablo. Este change no toca `env.production` ni recursos de producción.
- Exportación y eliminación de un grupo (queda en el backlog con prioridad alta).
- Compras, que sigue oculto en el sitio público.
- Cambios en el audio de Remanso para iPhone.

## Capabilities

### Modified Capabilities

- `landing-publica-homesuite`: enlaces a la app de cada ambiente, textos del estado posterior al deploy y coherencia con la app.
