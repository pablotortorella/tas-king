## Context

Estado observado en la rama `ccr-a7efcef7-25zjqk` (base `1f962d5`, 2026-11-09):

- **Entrega** (ADR-019): `apps/app/wrangler.jsonc` monta `assets` (`./public`, binding `ASSETS`)
  **sin `run_worker_first`**: un archivo que existe en `public/` lo responde el almacén de assets sin
  pasar por el Worker; todo lo demás va al Worker (Hono). Por eso **nunca hay `.html` en `public/`**
  (`remanso-assets.test.js` lo impide) y todo documento lo genera el Worker con `renderPage`
  (`apps/app/src/ui-parts.js`).
- **Cabeceras** (`apps/app/src/index.js`): un middleware agrega `SECURITY_HEADERS` (CSP
  `default-src 'self'; … script-src 'self'; style-src 'self'; frame-ancestors 'none'; …`, COOP,
  `nosniff`, `X-Frame-Options: DENY`) y HSTS (salvo `localhost`) a **toda respuesta del Worker**, y
  `Cache-Control: private, no-store` a `/`, `/cuentas-claras`, `/tareas`, `/perfil`, `/remanso`,
  `/jardin-zen`, `/groups/*` y `/api/*`. Los estáticos de `public/` reciben `nosniff` y HSTS por
  `public/_headers`.
- **Personalización del HTML**: otro middleware reemplaza `<!--account-->` y `<!--account-menu-->`
  con el avatar, el menú y un **token CSRF** de la sesión; otro completa el grupo y fija la cookie del
  último grupo en `/groups/*`. Con `DEV_LOCAL_MODE` y `DEV_LOCAL_EMAIL` (así corre el E2E principal),
  `/remanso` y `/perfil` personalizan aunque no haya cookie.
- **Cabeza de cada página** (`renderPage`): `/app.css`, `/ledger-ui.js` (módulo que importa
  `/split.js` y `/text.js`), `/shell.js` (clásico, `defer`, `max-age=3600`) y los estilos y módulos
  propios de cada herramienta. Ya trae `theme-color` claro y oscuro desde `theme.js`. **No** tiene
  manifiesto, favicon ni `apple-touch-icon`.
- **Estáticos servidos por el Worker** (`routes/assets.js`, `routes/shell.js`): `/app.css`
  (34 KB), `/ledger-ui.js` (18 KB), `/split.js` (5 KB), `/text.js`, `/classify.js`,
  `/import-progress.js`, `/shell.js`, `/profile.js`. Son cadenas constantes, iguales para todos.
  `split.js` y `text.js` se sirven con el texto de sus funciones (`Function.prototype.toString`), y
  `served-modules-config.test.js` exige `minify: false`.
- **Estáticos de `public/`**: Jardín Zen (`jardin-zen.js`, `rake-motion.js`, `jardin-zen.css`,
  44 KB) y Remanso (`remanso.js`, `remanso-engine.js`, `remanso-gongs.js`, `remanso.css`, 59 KB).
  Nombres sin versión: el almacén responde `max-age=0, must-revalidate` con ETag.
- **Acceso**: `/auth/google` fija la cookie `homesuite_oauth` (sellada, `HttpOnly`, `SameSite=Lax`,
  10 min) y redirige a Google; `/auth/callback` la exige: si falta, responde 400 «No pudimos
  verificar el acceso». La sesión es otra cookie `HttpOnly` de 14 días, revocable en cada petición.
- **Identidad**: el sitio usa `HomeSuite-favicon-simplificado.svg` como favicon y su vista previa
  PNG como `apple-touch-icon`; el encabezado de la app dibuja `LOGO` (SVG en línea). La regla
  común: no cambiar logo, favicon ni paleta sin revisar la identidad vigente.
- **Change pendiente** `remanso-sonidos-naturales` (sin implementar): agregará
  `public/remanso/audio/<fondo>.v1.opus` (3,93 MiB), `remanso-fondos.js` y `remanso-sonidos.js`, con
  `Cache-Control: public, max-age=31536000, immutable`, carga por `fetch` (fondos en memoria) o por
  elemento `<audio>` con `Range` (la lluvia en flujo) y respaldo al sintetizado si la red falla. Su
  proposal lista «Modo sin conexión, Service Worker, PWA» como non-goal y su design dice «Sin
  Service Worker».

## Goals / Non-Goals

**Goals**

1. Que HomeSuite App se pueda instalar en Android (Chrome), en escritorio (Chrome y Edge) y en
   iPhone/iPad («Agregar a inicio» de Safari), en staging y en producción, con el mismo código.
2. Que, una vez visitados en ese dispositivo (y en esa instalación), Jardín Zen y Remanso (nivel sin
   cuenta) abran y funcionen sin conexión.
3. Que cualquier otra navegación sin conexión muestre una página propia y clara, sin datos.
4. No guardar en el dispositivo **nada** que dependa de la sesión, de una cookie o de un grupo.
5. Poder apagar el service worker en todos los dispositivos con un despliegue.

**Non-Goals**: los de la [proposal](proposal.md) (push, Cuentas Claras sin conexión, TasKing,
sitio público, botón propio de instalación, audio sin conexión, cambios de identidad).

## Decisions

### D1. Qué genera el Worker y qué es estático

| Recurso | Dónde | Por qué |
|---|---|---|
| `/sw.js` | Ruta del Worker | Lleva la versión calculada y el modo (normal o apagado); recibe CSP, `nosniff` y HSTS del middleware común; `Cache-Control: no-cache` explícito |
| `/manifest.webmanifest` | Ruta del Worker | El nombre depende del host (D8) y los colores salen de `theme.js` (una sola fuente) |
| `/pwa.js` | Ruta del Worker | Registra o desregistra según el modo; mismo criterio que `/shell.js` |
| `/sin-conexion`, `/sin-conexion/jardin-zen`, `/sin-conexion/remanso` | Rutas del Worker | Son HTML: no pueden ir en `public/` (capturarían la ruta sin cabeceras, ADR-019) |
| `icons/*.png`, `icons/homesuite-favicon.v1.svg` | `public/icons/` | Binarios fijos; el almacén los sirve sin invocar al Worker; `_headers` agrega `nosniff`, HSTS y caché inmutable |

*Alternativa descartada:* `sw.js` y `manifest.webmanifest` estáticos en `public/` con `_headers`.
El service worker se quedaría sin CSP propia (el almacén no aplica `SECURITY_HEADERS`), la versión
habría que escribirla a mano en el archivo y el apagado exigiría editar y desplegar código. Una
prueba exige que `public/` **no** contenga `sw.js`, `pwa.js` ni `manifest.webmanifest`: si
existieran, el almacén taparía la ruta del Worker.

No hace falta `Service-Worker-Allowed`: el script está en la raíz y el alcance pedido es `/`.
La política de contenido **no cambia**: sin `worker-src` ni `manifest-src`, ambas caen en
`default-src 'self'` (y `script-src 'self'` para el worker), que ya permiten el mismo origen.

### D2. Reglas de intercepción por tipo de pedido

Las reglas viven en una **función pura** (`decidirPedido`) de `apps/app/src/pwa.js`, probada con
unitarias y servida dentro de `/sw.js` con su propio texto (la misma técnica que `split.js`; por
eso importa que `minify` siga apagado). El orden de evaluación es el de la tabla:

| Pedido | Qué hace el service worker | Motivo |
|---|---|---|
| Método distinto de `GET` (formularios, `logout`, mutaciones) | **No intercepta** (`respondWith` no se llama) | Nunca reintentar ni guardar escrituras; CSRF y límites siguen iguales |
| Otro origen (fotos de Google, `accounts.google.com`, TasKing) | No intercepta | Fuera de alcance |
| `/auth/*` | No intercepta, ni siquiera como navegación | El flujo OAuth y sus cookies quedan exactamente como hoy (D11) |
| `/api/*` | No intercepta | Datos privados; la revocación (ADR-015) depende de llegar al servidor |
| Con cabecera `Range` | No intercepta | `Cache.put` rechaza respuestas 206 y el reproductor de medios necesita los 206 del servidor |
| `/remanso/audio/*` | No intercepta | Lo gestionan la caché HTTP inmutable y el respaldo de `remanso-sonidos-naturales` (D9) |
| `/sw.js` | No intercepta | El navegador lo actualiza por su cuenta |
| Navegación (`mode: navigate`) a cualquier otra ruta | **Solo red** (con *navigation preload* si está disponible). Si la red **falla** (error de red, no un 4xx/5xx): `/jardin-zen` → copia de `/sin-conexion/jardin-zen`, `/remanso` → copia de `/sin-conexion/remanso`, el resto → copia de `/sin-conexion` | La página real siempre viene del servidor, con su sesión vigente |
| `GET` de una ruta de la **lista de precarga** (D3), sin parámetros de búsqueda | **Red primero**; si la red falla, la copia de la versión instalada. No escribe en la caché | Siempre fresco con conexión; coherente sin ella (D5) |
| Cualquier otro `GET` del mismo origen | No intercepta | Lo que no está en la lista nunca se guarda |

La respuesta de red de una navegación se devuelve tal cual (incluidas redirecciones opacas): el
service worker no la lee, no la copia y no la guarda.

### D3. Qué se guarda: lista cerrada y por qué cada ítem es público

La caché `homesuite-pwa-<versión>` contiene **solo** estas rutas, precargadas al instalar con
`credentials: 'omit'` y `cache: 'no-cache'`:

| Ruta | Por qué es pública |
|---|---|
| `/sin-conexion`, `/sin-conexion/jardin-zen`, `/sin-conexion/remanso` | Las genera el Worker **sin** consultar sesión, cookies, usuario local ni D1 y **sin** las marcas de cuenta y de grupo; son iguales para cualquier persona del ambiente (D4) |
| `/app.css`, `/ledger-ui.js`, `/split.js`, `/text.js`, `/shell.js`, `/pwa.js` | Cadenas constantes del Worker; las cargan todas las páginas (`ledger-ui.js` importa `split.js` y `text.js`) |
| `/jardin-zen/jardin-zen.js`, `/jardin-zen/rake-motion.js`, `/jardin-zen/jardin-zen.css` | Archivos de `public/`, iguales para todos |
| `/remanso/*.js`, `/remanso/*.css` (hoy `remanso.js`, `remanso-engine.js`, `remanso-gongs.js`, `remanso.css`) | Archivos de `public/`, iguales para todos; **excluye** `/remanso/audio/` |
| `/manifest.webmanifest`, `/icons/homesuite-favicon.v1.svg` | Metadatos públicos; evitan pedidos fallidos al abrir sin conexión |

No entran: `/`, `/remanso`, `/jardin-zen` (tienen avatar, nombre o token CSRF), `/perfil`,
`/groups/*`, `/cuentas-claras`, `/tareas`, `/invitations`, `/auth/*`, `/api/*`, `/profile.js`,
`/classify.js`, `/import-progress.js` (son de Cuentas Claras y del perfil: públicos, pero inútiles
sin conexión), los PNG de íconos (los guarda el sistema al instalar) y el audio.

Defensas adicionales, cada una con prueba:

- La lista de `public/` se **genera** desde el disco (`scripts/homesuite-app-pwa-precache.mjs` →
  `apps/app/src/pwa-precache.js`, con la huella SHA-256 de cada archivo) incluyendo
  `jardin-zen/**` y `remanso/**` sin `remanso/audio/**`; una prueba falla si el archivo generado no
  coincide con el disco o si aparece un archivo nuevo sin regenerar.
- Al instalar, el service worker **rechaza** (y la instalación falla, conservando la versión
  anterior) cualquier respuesta que no sea `200`, `type: basic`, o que traiga `Cache-Control` con
  `private` o `no-store`. Si alguien vuelve personal una página sin conexión y el middleware le
  pone `private, no-store`, la instalación falla y el E2E lo detecta.
- Las páginas sin conexión no contienen `<!--account-->`, `<!--account-menu-->`, `<!--group-->`
  ni `<!--group-menu-->`, así que el middleware de cuenta no consulta la sesión; una prueba de
  integración con cookie de sesión válida (y otra con `DEV_LOCAL_EMAIL`) verifica que la respuesta
  no lleva nombre, email, avatar, `_csrf` ni `Set-Cookie`, y que no hubo consultas a D1.
- No hay escritura en tiempo de ejecución: lo único que entra en la caché es la precarga.

Consecuencia sobre la revocación (ADR-015): como ninguna respuesta autenticada se guarda y las
navegaciones van siempre a la red, revocar una sesión surte efecto en la siguiente navegación o
llamada, igual que hoy. Cerrar sesión no necesita borrar la caché: no hay nada de la cuenta en ella.

### D4. Páginas sin conexión

**Decisión:** tres rutas públicas generadas por el Worker:

- `/sin-conexion`: encabezado de la suite sin cuenta, título «Sin conexión», explicación breve,
  enlace «Reintentar» (`href=""`, vuelve a pedir la misma URL sin JavaScript) y enlaces a Jardín Zen
  y Remanso aclarando que funcionan sin conexión si ya se abrieron en este dispositivo.
- `/sin-conexion/jardin-zen`: el mismo contenido de `/jardin-zen`, sin cuenta.
- `/sin-conexion/remanso`: Remanso con el **nivel sin cuenta** (`renderRemanso` con `nombre: null`)
  y un aviso «Sin conexión: se muestran las opciones sin cuenta».

`renderPage` suma la opción `cuenta: false`, que omite las cuatro marcas. Las tres rutas responden
`Cache-Control: no-cache` (públicas, revalidables) y reciben las cabeceras de seguridad comunes.
Con conexión también se pueden abrir directamente; no se enlazan desde ningún lado.

*Alternativas descartadas:*

- **Solo la página genérica:** no cumple el objetivo 2 (Jardín Zen y Remanso sin conexión).
- **Guardar el HTML real de `/remanso` y `/jardin-zen` la última vez que se abrieron:** guarda
  nombre, avatar y token CSRF en el dispositivo y contradice `remanso-pantallas` («privada y no debe
  guardarse»). Descartada por el invariante.
- **Variante anónima de la misma URL** (`/remanso?sin-conexion`): mezcla en una ruta privada una
  respuesta pública; un error de rama personalizaría la copia. Una ruta propia se prueba sola.

Consecuencia: una persona con cuenta que abre Remanso sin conexión ve el nivel libre (1, 2 y 5 min;
silencio, agua y bosque; Gong brillante). Es el default conservador (ver preguntas abiertas). Los
enlaces «Entrar con Google» de esas copias llevan a `/auth/google`, que sin conexión muestra el
error propio del navegador (D2 no intercepta `/auth/*`).

### D5. Estrategia para los estáticos: red primero, sin escritura

Los estáticos **no tienen nombre versionado** (`/app.css`, `/remanso/remanso.js`, …) y el HTML
siempre viene de la red. Con «caché primero», después de un despliegue el HTML nuevo cargaría
JavaScript viejo de la caché hasta que el service worker se actualice (y los módulos se importan
entre sí con rutas relativas sin versión, así que tampoco alcanza con versionar las etiquetas del
HTML). Por eso:

- **Con conexión:** red primero. El comportamiento y la frescura son los de hoy (la caché HTTP
  sigue funcionando debajo).
- **Sin conexión:** la copia de la **misma versión** con la que se precargaron las páginas sin
  conexión: el conjunto HTML + JS + CSS es coherente porque se instala junto (D6) y nunca se
  escribe suelto.

Consecuencia honesta: «arranque rápido» en esta versión significa **abrir sin red** (la app
instalada y Jardín Zen/Remanso responden desde el dispositivo); con conexión no hay ganancia de
velocidad sobre la caché HTTP actual. «Caché primero» exige URLs con huella (por ejemplo
`/remanso/remanso.a1b2c3.js` e imports reescritos), un cambio de entrega aparte (pregunta abierta 5).
En «red lenta pero no caída» el pedido espera a la red; no se agrega un tiempo límite en esta versión
(ver riesgos).

### D6. Versión, instalación y limpieza

- **Versión** = primeros 12 hex de SHA-256 sobre: el texto de las reglas y del service worker, las
  huellas de `pwa-precache.js` (archivos de `public/`) y las huellas calculadas en el Worker de las
  cadenas precargadas (`/app.css`, `/ledger-ui.js`, …, y las tres páginas sin conexión, que dependen
  del ambiente porque Remanso muestra si el acceso con Google está configurado). Se calcula una vez
  por *isolate* (memoizada) y viaja dentro del texto de `/sw.js`, que además lleva `ETag` con ella.
  Cualquier cambio de contenido cambia los bytes de `/sw.js` y el navegador instala la versión nueva.
- **Instalación atómica:** `install` precarga toda la lista en `homesuite-pwa-<versión>`; si un
  solo pedido falla o se rechaza (D3), la instalación falla y sigue la versión anterior.
- **Activación:** `skipWaiting()` + `clients.claim()`, y borra toda caché cuyo nombre empiece con
  `homesuite-pwa-` y no sea la actual. No toca otras cachés. Tomar el control enseguida es seguro
  porque con conexión todo va a la red (D5): no hay mezcla de versiones en una página abierta.
- **Sin quedar viejo:** `/sw.js` con `Cache-Control: no-cache`, y el registro con
  `updateViaCache: 'none'`. El navegador busca actualización al navegar dentro del alcance.
- **Navigation preload** se habilita en `activate` cuando existe; si no, `fetch(request)`.

Alternativa descartada: usar el identificador del despliegue (`version_metadata`) como versión.
Es más simple pero cambia en cada despliegue (re-descarga ~200 KB por dispositivo aunque nada
cambie), exige tocar `wrangler.jsonc` y no se puede probar en Vitest sin simular el binding.

### D7. Apagado de emergencia

- **Variable** `PWA_SW` del Worker: ausente o `on` = normal; `off` = apagado. No se agrega a
  `wrangler.jsonc`: se pasa al desplegar (`wrangler deploy --env <ambiente> --var PWA_SW:off`) o
  desde el panel de Cloudflare (crea una versión nueva; el siguiente despliegue normal la vuelve a
  quitar, y eso es lo esperado una vez corregido el problema).
- **En modo apagado**, `/sw.js` sirve un service worker mínimo **sin manejador `fetch`** que en
  `install` llama `skipWaiting()` y en `activate` borra todas las cachés `homesuite-pwa-*` y se
  desregistra (`self.registration.unregister()`). **No** recarga las pestañas abiertas
  (`client.navigate`): cortaría una sesión de Remanso en curso; la próxima navegación ya va directo
  a la red. `/pwa.js` en modo apagado no registra y desregistra lo que encuentre.
- **Alcance en el tiempo:** el navegador busca actualización del service worker al navegar dentro
  del alcance (y, según la bibliografía, al menos cada 24 h ante eventos); un dispositivo que no
  vuelve a abrir la app conserva el service worker viejo, que de todos modos no guarda nada privado.
- **Nunca** quitar la ruta `/sw.js` para «apagar»: si el script responde 404 o error, el navegador
  conserva el service worker instalado. Para retirar la PWA definitivamente se deja el modo apagado
  publicado por meses.
- `Clear-Site-Data` queda como último recurso documentado, **no** implementado: su soporte varía
  y `"storage"` borraría también las preferencias locales de Remanso y Jardín Zen.

### D8. Manifiesto y ambientes

```json
{
  "id": "/", "start_url": "/", "scope": "/",
  "name": "HomeSuite", "short_name": "HomeSuite",
  "description": "Organizá, cuidá y disfrutá tu hogar.",
  "lang": "es", "dir": "ltr", "display": "standalone",
  "theme_color": "<LIGHT.bg>", "background_color": "<LIGHT.bg>",
  "icons": [
    { "src": "/icons/homesuite-192.v1.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/homesuite-512.v1.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/homesuite-maskable-192.v1.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/homesuite-maskable-512.v1.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- Todas las URLs son **relativas**: el mismo Worker sirve producción y staging sin URLs absolutas.
- El **nombre** se resuelve por host con `PRODUCTION_APP_HOST` (`tools.js`): en
  `app.homesuite.info`, «HomeSuite»; en cualquier otro host (staging, local), «HomeSuite (staging)»
  y `short_name` «HS staging», para distinguir las dos instalaciones en un mismo teléfono (son
  orígenes distintos, así que el sistema ya las trata como apps distintas).
- `theme_color` y `background_color` = `LIGHT.bg` (`#f7f2e8`), el mismo valor que la
  `theme-color` clara que ya emite `renderPage`. El manifiesto no admite variantes por esquema de
  color; en el navegador siguen mandando las `<meta name="theme-color">` con `media` de cada página.
- `Content-Type: application/manifest+json`, `Cache-Control: public, max-age=3600`.
- Se pide sin credenciales (comportamiento por defecto de `<link rel="manifest">`) y no las necesita.
- Sin `shortcuts`, `screenshots` ni `orientation`: decisiones de producto no tomadas (preguntas
  abiertas).

### D9. Convivencia con `remanso-sonidos-naturales`

- El service worker **no intercepta** `/remanso/audio/*` ni ningún pedido con `Range` (D2): la
  lluvia en flujo sigue recibiendo sus 206 del servidor y los fondos en memoria se piden como hoy.
  La caché HTTP inmutable de un año que define aquel change sigue valiendo: un fondo ya descargado y
  aún en caché puede sonar sin conexión, sin garantía (el navegador puede desalojarlo).
- Sin conexión y sin el archivo en caché, el `fetch` falla y aplica el **respaldo al sintetizado**
  que aquel change ya especifica («red caída»). No se agrega nada.
- Los módulos nuevos de aquel change (`remanso-fondos.js`, `remanso-sonidos.js`) entran solos en la
  precarga al regenerar `pwa-precache.js` (D3); la prueba de huellas falla hasta hacerlo.
- **Orden de integración indistinto.** Quien integre segundo: regenera `pwa-precache.js`, corre el
  E2E de PWA y el de Remanso, y actualiza la frase «Sin Service Worker» del design de
  `remanso-sonidos-naturales` (ver «Cambios sugeridos a otros documentos»). Este change **no edita**
  aquel.
- Se descarta guardar el audio para uso sin conexión: 3,93 MiB por dispositivo, 206 incompatibles
  con `Cache.put` y límites de almacenamiento de Safari. Si se quisiera, sería un cambio propio.

### D10. Íconos

- **Fuente:** `apps/site/public/HomeSuite-favicon-simplificado.svg` (el ícono que el sitio ya usa
  como favicon y, en PNG, como `apple-touch-icon`). Se copia tal cual a
  `apps/app/public/icons/homesuite-favicon.v1.svg` para el `<link rel="icon">` de la app.
  No se toca el SVG ni la paleta.
- **Salidas** (`apps/app/public/icons/`):
  - `homesuite-192.v1.png`, `homesuite-512.v1.png` (`any`): el favicon tal cual, fondo transparente.
  - `homesuite-maskable-192.v1.png`, `homesuite-maskable-512.v1.png` (`maskable`): cuadrado lleno
    con el degradado de fondo del propio SVG (`#3f6957` → `#193b2e`) y el favicon centrado al 80 %,
    para que la casa quede dentro de la zona segura (círculo del 80 %).
  - `homesuite-apple-touch-180.v1.png`: la misma composición, opaca (iOS rellena la transparencia
    y redondea las esquinas por su cuenta).
- **Generación reproducible:** `scripts/homesuite-app-iconos.mjs` (`npm run pwa:iconos:homesuite-app`)
  arma un SVG contenedor por variante y lo rasteriza con Chromium de Playwright
  (`page.setContent` + `screenshot({ omitBackground })`). Se verificó en esta sesión que funciona
  (192×192, PNG RGBA). Los PNG se **versionan en el repositorio**; la rasterización puede variar
  bytes entre versiones de Chromium, así que la prueba no compara huellas de PNG sino dimensiones,
  tipo y presencia de cada archivo referenciado.
- **Caché:** `_headers` agrega a `/icons/*` `X-Content-Type-Options: nosniff`, HSTS sin `preload` y
  `Cache-Control: public, max-age=31536000, immutable`. Un cambio de ícono crea `.v2` y actualiza
  el manifiesto.
- La composición «maskable» y el `apple-touch-icon` se adjuntan como vista previa en el PR para
  revisión visual de Pablo.

### D11. Acceso con Google en la app instalada

El service worker no participa (D2): el flujo, las cookies (`homesuite_oauth` y la sesión) y las
redirecciones son las de hoy. Lo que cambia es el contenedor:

- **Android (Chrome, app instalada):** la navegación a `accounts.google.com` sale del alcance;
  Chrome la muestra dentro de la ventana de la app con una barra de origen y, al volver a
  `/auth/callback` (dentro del alcance), sigue en modo app. Comparte cookies con Chrome. *Esperado:*
  el acceso se completa. **No verificado** con fuente primaria ni dispositivo.
- **Escritorio (Chrome/Edge):** comportamiento análogo dentro de la ventana de la app. *Esperado:*
  funciona. **No verificado.**
- **iPhone/iPad:** la app de inicio tiene **almacenamiento y cookies propios**, separados de Safari
  (WebKit; desde iOS 17.2, según fuentes secundarias, las cookies de Safari se **copian una sola
  vez** al agregar la app). Hay reportes contradictorios sobre qué pasa al salir del alcance hacia
  Google: en algunos el acceso termina en una vista de Safari con otro frasco de cookies y la
  devolución llega sin `homesuite_oauth`. *Comportamiento exigido* si eso ocurre: la app no queda
  trabada; `/auth/callback` responde la página «No pudimos verificar el acceso» con el encabezado
  (enlace a Inicio), no se crea sesión en un lugar equivocado sin que la persona lo vea, y Jardín Zen
  y Remanso siguen usables. *Verificación:* solo en dispositivo real (manual de Pablo). Si falla,
  la solución (por ejemplo un traspaso de sesión de un solo uso) es un cambio propio, registrado en
  el backlog; no se improvisa aquí.
- **Firefox:** escritorio no instala salvo en Windows desde Firefox 143 («web apps», sin soporte
  completo del estándar). No se hace nada específico; el service worker funciona igual en pestaña.

### D12. Costo

- **D1:** cero consultas en `/sw.js`, `/pwa.js`, `/manifest.webmanifest` y `/sin-conexion*`
  (prueba de presupuesto estructural con contador de `prepare`).
- **Worker:** `/sw.js` se consulta en cada navegación con `no-cache` (una invocación chica; `304`
  con `ETag` cuando no cambió). `/pwa.js` y el manifiesto con `max-age=3600` como `/shell.js`. Los
  íconos no invocan al Worker.
- **Navegación:** el service worker suma su arranque a cada navegación; *navigation preload* lo
  solapa con el pedido de red donde existe.
- **Dispositivo:** ~200 KB precargados por ambiente instalado.

### D13. Pruebas

| Riesgo | Evidencia |
|---|---|
| Reglas de intercepción (método, origen, `/auth`, `/api`, `Range`, audio, navegación, lista) | Vitest de `decidirPedido` con tabla de casos |
| Fallback por ruta de navegación | Vitest de `paginaSinConexion(pathname)` |
| Limpieza de cachés viejas | Vitest de `cachesABorrar(nombres, actual)` |
| Versión cambia con cualquier contenido precargado y solo con él | Vitest |
| Manifiesto: campos, URLs relativas, nombre por host, colores de `theme.js`, tipo | Vitest (handler) + Playwright (servido) |
| Páginas sin conexión sin datos privados, sin cookies, sin D1, con cabeceras | Integración Vitest (D1 real, cookie de sesión y usuario local) |
| `pwa-precache.js` al día con el disco; sin audio; sin huérfanos | Vitest |
| `public/` sin `sw.js`, `pwa.js`, manifiesto ni HTML; `_headers` de `/icons/*`; PNG con tamaños correctos | Vitest |
| `SECURITY_HEADERS` y `wrangler.jsonc` sin cambios | Vitest de caracterización |
| Registro, precarga instalada con la versión, nada fuera de la lista en la caché | Playwright sobre `wrangler dev` |
| Jardín Zen y Remanso sin conexión, página genérica, sin violaciones de CSP | Playwright con `context.setOffline(true)` |
| Las copias no contienen el usuario local del E2E | Playwright |
| Apagado | Playwright en dos fases con perfil persistente (o manual en staging si no es estable) |
| Instalación real, OAuth en app instalada, iOS | Manual de Pablo en dispositivo |

Se verificó en esta sesión (Playwright 1.63, Chromium 153) que `context.setOffline(true)` hace
fallar los `fetch` del propio service worker y que el respaldo de navegación se sirve: el E2E puede
probar el modo sin conexión de punta a punta en Chromium. Las suites E2E existentes pasan a
`serviceWorkers: 'block'` (configurable con `E2E_SERVICE_WORKERS=allow`) para que el service worker
no altere `page.route` ni la cuenta de pedidos; el E2E de PWA lo permite explícitamente, y una
corrida de la suite principal con `allow` se registra como sonda de regresión.

### D14. Textos

Textos nuevos (provisorios, en voseo, revisión de Pablo): página «Sin conexión», aviso de Remanso
sin conexión, `description` del manifiesto (toma el lema ya publicado en el inicio de la app).
El sitio público: `privacidad.html` suma en «Cookies y almacenamiento local» un ítem sobre la copia
de archivos públicos de la app que el navegador guarda para abrir sin conexión (sin datos de la
cuenta), **texto legal que revisa Pablo** y que se publica con el sitio, después de la app.

## Risks / Trade-offs

- [Un service worker defectuoso deja la app rota en dispositivos que no se pueden tocar] → reglas
  mínimas y probadas, nada de caché primero, apagado por variable (D7), staging antes que producción.
- [Se guarda algo privado por un cambio futuro] → lista cerrada generada, rechazo de
  `private`/`no-store` al instalar, páginas sin marcas de cuenta, pruebas de integración con cookie y
  usuario local (D3).
- [OAuth en iPhone instalado no completa el acceso] → sin cambios en el flujo, falla visible y
  recuperable, verificación manual; bloquea producción hasta que Pablo decida (pregunta 1).
- [Red lenta, no caída: la navegación espera] → igual que hoy sin service worker; un tiempo límite se
  evaluará con datos.
- [Safari desaloja la caché o el registro] → la app sigue funcionando en línea; sin conexión vuelve
  el error del navegador. Las apps de inicio de iOS tienen su propio contador de días de uso.
- [Versiones mezcladas con conexión] → evitado por red primero (D5).
- [Una persona con cuenta ve el nivel libre de Remanso sin conexión] → aviso explícito en la copia;
  default conservador (pregunta 3).
- [Las páginas `notFound` responden JSON] → en modo app (sin barra del navegador, sobre todo en iOS)
  una URL inexistente muestra JSON sin forma de volver. No lo introduce este cambio; se registra
  como hallazgo para el backlog.
- [Costo de una invocación de Worker por navegación para `/sw.js`] → pequeño, sin D1, con `304`.

## Migration Plan

1. Implementar en una rama propia con las pruebas primero (ver tasks.md). Sin migraciones ni datos.
2. Suites afectadas en verde (`test:homesuite-app`, `test:homesuite-app:integration`,
   `test:e2e:homesuite-app`, `test:e2e:remanso`) y `wrangler deploy --dry-run --env staging`.
3. Con confirmación de Pablo: staging (comprobar con `wrangler deployments list` que la versión
   activa es la propia y publicar con `--message`). Smoke: cabeceras de `/sw.js`, manifiesto,
   íconos y `/sin-conexion*`; DevTools → Application → Manifest sin errores de instalación;
   instalar; modo avión; entrar y salir con una cuenta real.
4. Verificación manual de Pablo en Android e iPhone (abajo).
5. Producción solo con aprobación explícita; primero la app, después el sitio (privacidad).
6. **Rollback:** desplegar con `PWA_SW=off` (D7); revertir el código **después**, manteniendo el
   modo apagado publicado el tiempo necesario. Revertir sin apagar deja service workers huérfanos
   que siguen interceptando navegaciones.

### Verificación manual pendiente de Pablo

| Dispositivo | Qué probar |
|---|---|
| Android + Chrome (staging) | Instalar desde el menú o el aviso; ícono «maskable» correcto; abrir desde el ícono en modo app; entrar con Google dentro de la app y volver; salir; modo avión: Jardín Zen y Remanso abren y suenan, otra ruta muestra «Sin conexión»; staging y producción instaladas a la vez con nombres distinguibles |
| iPhone + Safari (staging) | «Compartir → Agregar a inicio»; nombre e ícono (`apple-touch-icon`); abrir en modo app; entrar con Google dentro de la app (anotar si termina en Safari o en la app, y el mensaje); probar también habiendo entrado antes en Safari; modo avión: Jardín Zen y Remanso tras haberlos abierto **dentro** de la app; volver al inicio desde páginas de error sin botón atrás |
| Escritorio (Chrome o Edge) | Instalar; ventana propia; acceso con Google; modo sin conexión de DevTools |
| Apagado (staging) | Publicar con `PWA_SW=off`, navegar una vez y comprobar en DevTools que no queda service worker ni caché `homesuite-pwa-*`; volver a publicar normal |

Registrar modelo, versión del sistema y navegador, SHA y hallazgos en STATUS y en el backlog.

## Fuentes

Consultadas el **2026-11-09**. En esta sesión `web.dev` y `developer.chrome.com` no eran accesibles
por red: esas páginas se vieron **solo a través de los resúmenes del buscador**, no leídas
completas. Grado: **V** = verificado en la fuente primaria (resumen del buscador de la página
oficial, o prueba local); **S** = fuente secundaria o anecdótica; **N** = no verificado.

| Hecho | Grado | Fuente |
|---|---|---|
| Chrome/Edge instalan con HTTPS, manifiesto con `name` o `short_name`, íconos 192 y 512, `start_url`, `display` standalone (o fullscreen, minimal-ui, window-controls-overlay), app no instalada y uso mínimo (un clic o toque y 30 s, en cualquier momento) | V (resumen) | [web.dev, «What does it take to be installable?»](https://web.dev/articles/install-criteria) |
| El requisito de service worker con `fetch` se quitó para instalar desde el menú (Chrome 108 móvil, 112 escritorio); el aviso de instalación lo seguía pidiendo en esa publicación; manejadores vacíos se ignoran | V (resumen); vigencia actual N | [Chrome for Developers, «Revisiting Chrome's installability criteria»](https://developer.chrome.com/blog/update-install-criteria) |
| El manifiesto se pide sin credenciales salvo `crossorigin="use-credentials"`, aun del mismo origen | S | [MDN, atributo `crossorigin`](https://developer.mozilla.org/en/HTML/CORS_settings_attributes); [Bugzilla 1548424](https://bugzilla.mozilla.org/show_bug.cgi?id=1548424) |
| Las apps de inicio de iOS tienen almacenamiento separado de Safari | S | [WebKit bug 181849](https://bugs.webkit.org/show_bug.cgi?id=181849); [openpwa: Home Screen storage isolation](https://openpwa.net/reference/storage/home-screen-storage-isolation/) |
| Desde iOS 17.2 se copian las cookies de Safari al agregar la app (una vez) | S | [WWDC23 «What's new in web apps» (notas)](https://wwdcnotes.com/notes/wwdc23/10120); [iGen, 2023-12](https://www.igen.fr/ios/2023/12/ios-172-et-macos-142-ameliorent-leur-gestion-des-web-apps-141013) |
| OAuth desde una app de inicio de iOS puede terminar en Safari y perder la cookie de verificación; otros reportan que funciona | S, contradictorio | [bulwarkmail/webmail #1267](https://github.com/bulwarkmail/webmail/issues/1267); [Progressier: Google OAuth en iOS](https://intercom.help/progressier/en/articles/9519381-google-oauth2-is-not-working-in-my-pwa-on-ios-why); [Netguru](https://www.netguru.com/blog/how-to-share-session-cookie-or-state-between-pwa-in-standalone-mode-and-safari-on-ios) |
| Google bloquea OAuth en webviews embebidas (`disallowed_useragent`) | S | [cnr.sh, 2021-10-11](https://cnr.sh/posts/2021-10-11-google-oauth-wkwebview/) |
| Cuotas de almacenamiento de Safari 17+ (por origen y global; desalojo) y apps de inicio con el mismo cupo; tope de 7 días sin uso no aplica igual a apps de inicio | V/S | [WebKit, «Updates to Storage Policy»](https://webkit.org/?p=14403); [MDN, cuotas y desalojo](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) |
| Firefox 143: «web apps» solo en Windows, sin soporte completo del estándar; no en macOS/Linux todavía | V (resumen) | [Mozilla Support, «Use web apps in Firefox for Windows»](https://support.mozilla.org/kb/web-apps-firefox-windows) |
| `Cache.put` rechaza respuestas 206; con medios conviene dejar pasar los `Range` | V (resumen) | [web.dev, «Handle range requests in a service worker»](https://web.dev/articles/sw-range-requests); [WPT `cache-put`](https://searchfox.org/firefox-main/source/testing/web-platform/tests/service-workers/cache-storage/cache-put.https.any.js) |
| Patrón de apagado: service worker que se desregistra y borra cachés; quitar el script no lo desinstala | S | [NekR/self-destroying-sw](https://github.com/NekR/self-destroying-sw); [Vite PWA: unregister](https://vite-pwa-org.netlify.app/guide/unregister-service-worker); [MDN `unregister()`](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/unregister) |
| Búsqueda de actualización al navegar, tope de 24 h de caché HTTP del script, `updateViaCache` | N (conocimiento previo) | — |
| `Clear-Site-Data`: soporte desigual (Firefox retiró `"cache"`; Safari desde 16.4–17 según fuente) | S, contradictorio | [caniuse `"cache"`](https://caniuse.com/mdn-http_headers_clear-site-data_cache); [Mozilla intent to unship](https://groups.google.com/a/mozilla.org/g/dev-platform/c/I939w1yrTp4) |
| Navegación de Android/escritorio fuera del alcance dentro de la ventana de la app | N | — |
| iOS lee nombre e íconos del manifiesto (o solo `apple-touch-icon` y `<title>`) | N | — |
| Playwright 1.63 / Chromium 153: `setOffline` hace fallar los `fetch` del service worker y se sirve el respaldo de navegación | V (prueba local en esta sesión) | sonda en el directorio temporal de la sesión |
| Chromium de Playwright rasteriza el SVG del favicon a PNG 192×192 RGBA | V (prueba local) | ídem |

## Cambios sugeridos a otros documentos (no hechos)

- `openspec/changes/remanso-sonidos-naturales/design.md` (D8, «Sin Service Worker…») y su
  proposal (non-goal): cuando ambos estén integrados, cambiar a «El service worker de
  `pwa-instalable` no intercepta `/remanso/audio/*` ni pedidos con `Range`; sin conexión aplica el
  respaldo al sintetizado». No es imprescindible para implementar ninguno de los dos.
- Backlog (lo edita otro agente): si la prueba en iPhone falla, sumar «Acceso con Google en la app
  instalada de iOS» como ítem propio; y «Respuestas 404 de la app en HTML con enlace a Inicio» por
  el modo app sin barra.

## Open Questions

### Preguntas abiertas para Pablo

Ninguna bloquea la implementación. Las marcadas bloquean la **publicación en producción**.

1. **Si el acceso con Google no se completa dentro de la app instalada en iPhone**, ¿se publica
   igual en producción (con la limitación documentada: entrar desde Safari antes de agregar a inicio,
   o usar Cuentas Claras en Safari) o se espera a un cambio que lo resuelva? *Bloquea producción,
   solo si la prueba falla.* Default: no publicar en producción hasta decidirlo.
2. **Nombre de la instalación de staging:** «HomeSuite (staging)» / «HS staging». No bloquea.
3. **Remanso sin conexión para personas con cuenta:** se muestra el nivel libre con aviso. ¿Vale,
   o preferís que sin conexión diga solo «Remanso necesita conexión para las opciones con cuenta»?
   No bloquea.
4. **Favicon en la app:** se usa el mismo favicon simplificado del sitio (hoy la app no tiene). Y
   los íconos derivan de ese favicon, no del `LOGO` cuadrado del encabezado. ¿Confirmás? No bloquea
   la implementación; la revisión visual de los PNG sí antes de producción.
5. **Velocidad con conexión:** esta versión no acelera la carga en línea (D5). ¿Querés un cambio
   posterior con URLs con huella para «caché primero»? No bloquea.
6. **Invitar a instalar:** ¿botón «Instalar» propio o instrucciones para iPhone? Fuera de alcance
   por ahora; no bloquea.
7. **Accesos directos del manifiesto** (`shortcuts` a Remanso y Jardín Zen): no se incluyen. No
   bloquea.
8. **Texto de privacidad** del sitio sobre la copia local: lo redacta el implementador y lo revisás
   antes de publicar el sitio. Bloquea la publicación del sitio, no la de la app.
