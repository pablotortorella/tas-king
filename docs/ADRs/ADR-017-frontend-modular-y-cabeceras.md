# ADR-017: cabeceras de seguridad en el documento y frontend en módulos ES

**Fecha:** 2026-09-16. **Estado:** en implementación en `refactor/frontend-modulos`.

## Problema

Dos problemas que se habilitan mutuamente.

**1. Las cabeceras de seguridad no llegaban al documento.** `createCorsMiddleware()`
emite `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` y `Permissions-Policy`, pero `wrangler.jsonc` monta
`assets.directory: "./public"` sin `run_worker_first`. El Asset Worker de Cloudflare
responde `/` antes de que corra el User Worker, así que el middleware nunca tocaba esas
respuestas. Verificado contra `wrangler dev`: `GET /` devolvía solo `Content-Type`,
`Cache-Control`, `ETag` y `CF-Cache-Status`; `GET /api/me` traía el juego completo.

Consecuencias: la app no tenía CSP en las páginas que un navegador ejecuta, y tampoco
`X-Frame-Options`, de modo que era enmarcable (clickjacking). El único test de CSP
(`test/api.test.js`) invocaba `app.request(...)` directo, saltándose el ruteo de assets,
y por eso pasaba en verde sin detectar nada.

**2. Todo el frontend vivía inline.** `public/index.html` eran 4.545 líneas: markup,
810 de CSS y 3.215 de JavaScript en un único IIFE con 34 variables compartidas por
closure. Mientras hubiera script inline, `script-src` no podía soltar `'unsafe-inline'`.

## Decisión

### Entrega de cabeceras

- `run_worker_first` acotado a documentos, **a nivel raíz** de `wrangler.jsonc`.
  No `true`: eso haría pasar por el Worker cada JS, CSS e imagen, pagando una
  invocación por asset para decorar respuestas que no lo necesitan — el CSP gobierna
  el documento, no los archivos que éste carga.
- Un handler de documentos en el Worker (`src/routes/documents.js`) que hace
  `env.ASSETS.fetch()`, reconstruye la respuesta con cabeceras mutables y deja que el
  middleware existente agregue las de seguridad. Preserva `Content-Type`,
  `Cache-Control` y `ETag`, y propaga los 304 sin cuerpo: un HTML de 208 KB que deja
  de cachearse sería una regresión de performance disfrazada de mejora de seguridad.
- El handler **no** pasa por `createAuthMiddleware()`. Hoy el documento se sirve sin
  autenticar y la app decide desde el cliente tras llamar a `/api/me`; autenticarlo
  sería cambiar comportamiento en un refactor.

### `frame-ancestors 'none'` además de `X-Frame-Options: DENY`

Se declaran **los dos**.

`X-Frame-Options` es el mecanismo legado y `frame-ancestors` el que la especificación
de CSP define; cuando ambos están presentes los navegadores modernos hacen caso al
segundo. Mantener solo el primero deja la protección atada a un encabezado en retirada;
poner solo el segundo desprotege clientes viejos. El costo de tener los dos es una
directiva más en una política que ya se emite.

Ninguna página del producto está pensada para ser embebida —ni el tablero ni
`landing`, `releases`, `terminos` o `revoked`—, así que `'none'` no le quita nada a
nadie. Si en algún momento hiciera falta embeber una página pública, la decisión se
revisa acotándola a esa ruta, no relajando la política global.

## Alternativas

- **`run_worker_first: true`**: descartada por costo y latencia en cada asset estático.
- **Servir el HTML desde una ruta de Hono sin tocar `run_worker_first`**: no funciona.
  El Asset Worker responde primero para rutas que existen en `public/`, así que la ruta
  de Hono nunca se alcanzaría.
- **Solo `X-Frame-Options`**: ver arriba.
- **Dejar el CSP como estaba**: el ítem del backlog proponía sacar `'unsafe-inline'`,
  pero sobre un encabezado que no llegaba al documento eso no compraba nada.

## Notas de operación

`npm run deploy` corre `wrangler deploy` **sin** `--env production`, así que la
configuración que aplica es la de nivel raíz. El repo ya se quemó con esto una vez:
los cron triggers no se registraban por estar bajo `env.production`. Por eso
`run_worker_first` va al nivel raíz, y hay que verificar la cabecera sobre la URL de
staging, no solo en local.

## Costo medido de enrutar los documentos por el Worker

`docs/PERFORMANCE-PRACTICES.md` fija presupuestos **estructurales** (llamadas D1),
no milisegundos. Con ese criterio:

- **Llamadas D1 por documento: cero, antes y después.** El rate limiting vive dentro
  de `createAuthMiddleware()`, que solo se aplica a `/api/*`, y el logger escribe a
  consola, no a la base. Servir el HTML no toca D1 en ninguno de los dos caminos.
- **Assets estáticos: sin cambios.** `run_worker_first` está acotado a documentos, así
  que JS, CSS e imágenes siguen saliendo del Asset Worker sin pasar por el User Worker.
- **Costo nuevo**: una invocación de Worker por documento. No por asset.

Medición local con `wrangler dev`, 30 muestras por caso tras calentar (no es la nube,
pero sirve como control de que no aparece un costo grueso):

| Caso | p50 | p90 |
|---|---|---|
| `GET /` sin `run_worker_first` | 4 ms | 6 ms |
| `GET /` con `run_worker_first` | 4 ms | 5 ms |
| `GET /tips.js` sin | 4 ms | 4 ms |
| `GET /tips.js` con | 3 ms | 5 ms |

Sin diferencia apreciable. La medición que decide es la de staging contra Cloudflare
real, no ésta.
