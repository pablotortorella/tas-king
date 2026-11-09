## Why

HomeSuite App (`app.homesuite.info` y `staging.homesuite.info`) hoy solo se abre como una
pestaña del navegador: no se puede instalar en la pantalla de inicio ni en el escritorio, y sin
conexión no abre nada, ni siquiera las dos herramientas que no necesitan servidor (Jardín Zen y
Remanso en su nivel libre, que dibujan y sintetizan todo en el dispositivo).

Pablo decidió el 2026-11-09 hacer instalable la HomeSuite App con dos alcances: **(1) instalable**
(manifiesto, íconos, service worker mínimo y una respuesta «sin conexión» para las navegaciones que
fallan) y **(2) arranque rápido** (guardar en el dispositivo los estáticos públicos para que Jardín
Zen y Remanso funcionen sin conexión una vez visitados). Dejó fuera las notificaciones push
(opción 3), Cuentas Claras y cualquier dato autenticado sin conexión (opción 4) y TasKing, que vive
en otro Worker y otro origen (ver [backlog](../../../docs/PRODUCT_BACKLOG.md)).

Un service worker con alcance `/` intercepta también las páginas autenticadas; por eso este cambio
fija, con pruebas, qué puede guardar y qué no: nada que dependa de la sesión, para no romper la
revocación inmediata ([ADR-015](../../../docs/ADRs/ADR-015-revocacion-acceso-sesion-cookie.md)).

## What Changes

- **Manifiesto web** servido por el Worker en `/manifest.webmanifest`, con URLs relativas
  (`id`, `start_url` y `scope` = `/`), `display: standalone`, colores de `theme.js` y un nombre
  distinto en staging, para que el mismo código sirva a los dos ambientes.
- **Íconos PNG** (192, 512, «maskable» 192 y 512, y `apple-touch-icon` de 180) derivados del favicon
  vigente de la suite (`HomeSuite-favicon-simplificado.svg`), sin cambiar logo ni paleta, generados
  por un script reproducible con Chromium de Playwright y versionados en
  `apps/app/public/icons/` con nombre `.v1` y caché inmutable por `_headers`.
- **Encabezado común** (`renderPage` en `ui-parts.js`): enlaces al manifiesto, al favicon y al
  `apple-touch-icon`, y el script de registro `/pwa.js` (archivo del mismo origen, sin código en
  línea).
- **Service worker** `/sw.js` generado por el Worker (`Cache-Control: no-cache`, cabeceras de
  seguridad, alcance `/`), con las reglas de intercepción en una función pura probada:
  - navegaciones: siempre a la red (con *navigation preload*); solo si la red falla, una página sin
    conexión **sin datos**;
  - estáticos de una **lista cerrada** (precarga): red primero y, si falla, la copia guardada;
  - nunca intercepta `/auth/*`, `/api/*`, métodos distintos de `GET`, otros orígenes, pedidos con
    `Range` ni `/remanso/audio/*`.
- **Páginas sin conexión** generadas por el Worker y públicas: `/sin-conexion` (genérica),
  `/sin-conexion/jardin-zen` y `/sin-conexion/remanso` (la versión sin cuenta). No leen sesión,
  cookies ni usuario local; el service worker las precarga sin credenciales.
- **Versionado** de la caché por el contenido de lo precargado (huellas SHA-256), instalación atómica
  y borrado de las versiones viejas al activar.
- **Apagado de emergencia**: con `PWA_SW=off` el Worker sirve un service worker que borra sus cachés
  y se desregistra, y `/pwa.js` deja de registrar.
- **Pruebas**: Vitest (reglas, manifiesto, rutas, ausencia de datos privados, huellas, `_headers`,
  íconos) y Playwright sobre `wrangler dev` (registro, instalación de la precarga, Jardín Zen y
  Remanso sin conexión, página genérica, nada autenticado en la caché, apagado).
- **Documentación**: ficha de plataforma, STATUS y el texto de privacidad del sitio (almacenamiento
  local), este último como texto legal que revisa Pablo.

## Capabilities

### New Capabilities

- `pwa-homesuite-app`: instalación de HomeSuite App (manifiesto, íconos, registro), service worker
  y sus reglas de intercepción, páginas sin conexión, qué se guarda en el dispositivo y qué nunca,
  versionado, apagado, convivencia con el audio de Remanso y acceso con Google en la app instalada.

### Modified Capabilities

Ninguna. `cabeceras-seguridad-http` describe TasKing (otro Worker) y no cambia; la política de
contenido de HomeSuite App tampoco. Los requisitos vigentes de Remanso y Jardín Zen se conservan
(`/remanso` sigue siendo privado y sin almacenamiento compartido); lo nuevo vive en la capacidad
nueva para no chocar con los deltas pendientes de `remanso-sonidos-naturales`.

## Impact

- `apps/app/src/`: módulo nuevo `pwa.js` (manifiesto, registro, service worker, reglas, versión),
  `pwa-precache.js` (generado: huellas de los estáticos de `public/`), rutas nuevas en `index.js`,
  `renderPage` con opción sin cuenta en `ui-parts.js`, versiones sin cuenta de las páginas en
  `jardin-zen.js` y `remanso.js`.
- `apps/app/public/`: `icons/*.v1.png` y `icons/homesuite-favicon.v1.svg`; `_headers` con la regla
  de `/icons/*`. Sigue sin HTML.
- `scripts/`: `homesuite-app-iconos.mjs` y `homesuite-app-pwa-precache.mjs`; dos scripts de
  `package.json`.
- Pruebas: Vitest en `apps/app/test/` y un E2E `apps/app/e2e/pwa.spec.js`; las suites E2E
  existentes bloquean service workers salvo que se pida lo contrario.
- Sin cambios en `SECURITY_HEADERS`, en `wrangler.jsonc`, en D1 ni en migraciones. Cero consultas
  a D1 en las rutas nuevas.
- Documentación: `docs/productos/PLATAFORMA.md`, `docs/STATUS.md` y `apps/site/public/privacidad.html`
  (despliegue del sitio aparte, después de la app).
- Coordinación con `remanso-sonidos-naturales` (sin implementar): el service worker no toca
  `/remanso/audio/*`; si aquel cambio se integra antes o después, la lista de precarga se regenera
  (ver design.md, D9).

## Non-goals

- **Notificaciones push (opción 3)**: quedan en el backlog; requieren su propia exploración.
- **Cuentas Claras o cualquier dato autenticado sin conexión (opción 4)**: no se guarda ninguna
  respuesta que dependa de la sesión; quedan en el backlog.
- **TasKing**: otro Worker y otro origen; se reconsidera tras migrarlo a `/tareas`. El enlace
  «Abrir Fun TasKing» sigue llevando a su origen, fuera de la app instalada.
- Sitio público (`homesuite.info`) instalable o con service worker.
- Botón propio «Instalar» o instrucciones de instalación dentro de la app (se usa la interfaz del
  navegador); ver preguntas abiertas.
- Audio de Remanso guardado para usar sin conexión (los fondos naturales los gestiona su propio
  change y la caché HTTP).
- Cambios de logo, favicon, paleta o textos de producto fuera de las páginas sin conexión.
- Publicar en producción sin la aprobación explícita de Pablo.
