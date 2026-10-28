## Context

El sitio y la app son Workers distintos que se publican por separado; nada garantizaba que contaran lo mismo. Los enlaces a las
apps existían sólo en staging, inyectados por el worker del sitio en un marcador.

## Decisions

1. **Producción es el HTML.** Los enlaces reales de producción viven en el HTML; el worker de staging reescribe los hosts
   (mismo patrón que ya usaba para TasKing). Alternativa descartada: marcador que sólo staging reemplaza (en producción habría
   que inventar otra inyección y el repositorio no mostraría lo que se publica).
2. **Orden de publicación en producción: primero la app, después el sitio**, y recién entonces correr
   `verify:coherence:production`. Si el sitio saliera antes, la portada enlazaría a una app que aún no responde.
3. **Lista única de herramientas en la app** (`tools.js`): el inicio la dibuja con el mismo HTML de antes (snapshots intactos) y
   la coherencia la compara con el sitio. Compras sigue en la lista con `publica: false` (la app la muestra «en preparación»).
4. **TasKing por host, sin tocar la configuración.** `taskingUrl(host)` elige producción sólo desde `app.homesuite.info`; cualquier
   otro host (staging, local) lleva al TasKing de staging. No se agregó una variable a `wrangler.jsonc` para no tocar
   `env.production`, que prepara Pablo en paralelo.
5. **Coherencia en dos capas.** Lógica pura probada en CI (incluye los cinco desvíos que debe detectar) y un comando que la
   corre contra lo publicado, que además sondea que cada enlace responda. Se usa también en staging desde ahora.
6. **Términos:** la frase sobre versiones beta es una propuesta de redacción; es texto legal de Pablo y queda marcada para su revisión.

## Risks

- `verify:coherence:production` fallará mientras la app no esté publicada (no responde `app.homesuite.info`): es lo esperado antes del deploy.
- La sonda a `/cuentas-claras` acepta redirecciones (sin sesión redirige al acceso); no prueba el inicio de sesión con Google.
- La coherencia compara nombres, rutas y estados, no el significado de los textos: una promesa nueva en una landing no la detecta.
