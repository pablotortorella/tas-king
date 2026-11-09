HomeSuite App instalable, con Jardín Zen y Remanso sin conexión. Decisiones en [design.md](design.md);
comportamiento en [la spec](specs/pwa-homesuite-app/spec.md). **Propuesto, sin implementar.**
Trabajar en una rama propia (worktree propio si hay tareas en paralelo); no confirmar en `main`.
Cada grupo lleva sus pruebas en el mismo commit y las pruebas se escriben antes que el código.
Comandos: `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`,
`npm run test:e2e:homesuite-app` y `npm run test:e2e:remanso`.

## 0. Prerrequisitos

- [x] 0.1 Partir de `main` actualizado; `git status -sb` y `git worktree list` sin pisar otras ramas. Revisar si `remanso-sonidos-naturales` ya se integró: si sí, su audio y sus módulos están en `public/remanso/` y aplica la coordinación de D9 desde el principio.
- [x] 0.2 (línea base: `test:homesuite-app` = 40 archivos / 545 pruebas y `test:homesuite-app:integration` = 26 / 331 en verde sobre la base; las E2E no se corrieron en la base 9a55db4 porque ninguna falló después: con la implementación, `test:e2e:homesuite-app` = 189 pruebas previas en verde, más las 9 de `pwa.spec.js`, y `test:e2e:remanso` = 37 en verde; no hay fallas previas que distinguir) Instalar dependencias con `npm ci` si faltan y correr las cuatro suites de arriba en la base, para tener la referencia (registrar resultados y fallas previas).
- [x] 0.3 (confirmado con `@playwright/test` del lockfile y Chromium 1243: `setOffline(true)` hace fallar los `fetch` del service worker; sin `context.route`; ver design.md, Notas de implementación) Sonda E2E (descartable, no se versiona): con la versión de `@playwright/test` del lockfile, confirmar que `context.setOffline(true)` hace fallar los `fetch` del service worker (en la sesión de diseño se confirmó con Playwright 1.63 y Chromium 153). Si no, usar `context.route` para abortar y anotarlo en design.md.

## 1. Reglas del service worker (lógica pura)

- [x] 1.1 Pruebas primero en `apps/app/test/pwa-reglas.test.js`: tabla de `decidirPedido({ metodo, modo, mismoOrigen, ruta, busqueda, conRange }, precarga)` → `red` | `navegacion` | `precarga`, con cada fila de D2 (POST, otro origen, `/auth/google`, `/auth/callback`, `/api/me`, `Range`, `/remanso/audio/lluvia.v1.opus`, `/sw.js`, navegación a `/`, a `/groups/x`, a `/auth/google` como navegación, `GET /app.css`, `GET /app.css?x=1`, `GET /profile.js`); `paginaSinConexion(ruta)` (`/jardin-zen`, `/remanso`, `/remanso/`, `/cuentas-claras`, `/`); `cachesABorrar(nombres, actual)` (borra solo `homesuite-pwa-*` distintas de la actual).
- [x] 1.2 Implementar esas funciones en `apps/app/src/pwa.js` sin dependencias externas, de modo que su texto (`Function.prototype.toString`) se pueda incrustar en `/sw.js`. Comentario que recuerde `minify: false` (`served-modules-config.test.js`).

## 2. Lista de precarga y versión

- [x] 2.1 Pruebas primero en `apps/app/test/pwa-precarga.test.js`: `apps/app/src/pwa-precache.js` coincide con el disco (rutas y SHA-256 de `public/jardin-zen/**` y `public/remanso/**`, sin `remanso/audio/**`, más `icons/homesuite-favicon.v1.svg`); falla si sobra o falta un archivo; ninguna ruta bajo `/remanso/audio/`; la lista completa (D3) incluye `/sin-conexion*`, `/app.css`, `/ledger-ui.js`, `/split.js`, `/text.js`, `/shell.js`, `/pwa.js` y `/manifest.webmanifest`, y excluye `/`, `/remanso`, `/jardin-zen`, `/perfil`, `/profile.js`, `/classify.js` e `/import-progress.js`.
- [x] 2.2 Script `scripts/homesuite-app-pwa-precache.mjs` y `npm run pwa:precache:homesuite-app` en `package.json`; generar `apps/app/src/pwa-precache.js` (cabecera «generado, no editar»).
- [x] 2.3 Pruebas de versión en `pwa-reglas.test.js`: cambia si cambia una huella de `public/`, una cadena del Worker precargada, una página sin conexión o el texto del service worker; no cambia si no cambia nada; 12 hex.
- [x] 2.4 Implementar `versionPwa(env)` en `pwa.js` (SHA-256 con `crypto.subtle`, memoizada por *isolate* y por si el acceso con Google está configurado).

## 3. Páginas sin conexión

- [x] 3.1 Pruebas primero en `apps/app/test/pwa-paginas.test.js` (unitarias de render): `renderPage(…, { cuenta: false })` no incluye `<!--account-->`, `<!--account-menu-->`, `<!--group-->` ni `<!--group-menu-->`; sin `<script>` sin `src`, sin `<style>` ni atributos `style`/`on*`; la genérica tiene «Reintentar» con `href=""` y enlaces a `/jardin-zen` y `/remanso`; la de Remanso sale con el nivel sin cuenta y el aviso.
- [x] 3.2 Pruebas de integración en `apps/app/test/pwa.integration.test.js` (D1 real): las tres rutas con cookie de sesión válida no contienen nombre, email, avatar ni `_csrf`, no traen `Set-Cookie`, llevan `Cache-Control: no-cache` y la CSP vigente, y no consultan D1 (contador sobre `prepare`); lo mismo con `DEV_LOCAL_MODE` y `DEV_LOCAL_EMAIL`.
- [x] 3.3 Implementar la opción `cuenta: false` en `renderPage` (`apps/app/src/ui-parts.js`), `/sin-conexion` (nueva, en `pwa.js`), `/sin-conexion/jardin-zen` (en `jardin-zen.js`, reutilizando `renderJardinZen`) y `/sin-conexion/remanso` (en `remanso.js`, con `renderRemanso({ nombre: null, … })`, sin `currentProfile`). Registrar las rutas en `index.js`. Textos provisorios de D14 marcados para revisión de Pablo.

## 4. Manifiesto, íconos y cabeza común

- [x] 4.1 Pruebas primero en `apps/app/test/pwa-manifiesto.test.js`: campos de D8; nombre «HomeSuite» con host `app.homesuite.info` y de staging con `staging.homesuite.info` y `localhost`; ninguna URL absoluta; colores iguales a `LIGHT.bg`; `Content-Type: application/manifest+json`; cada ícono declarado existe en `public/icons/`, es PNG (firma) y su IHDR mide lo declarado; `apple-touch-icon` de 180 opaco.
- [x] 4.2 (PNG generados y revisados a ojo; falta adjuntar la vista previa en el PR) Script `scripts/homesuite-app-iconos.mjs` (`npm run pwa:iconos:homesuite-app`): copia `apps/site/public/HomeSuite-favicon-simplificado.svg` a `apps/app/public/icons/homesuite-favicon.v1.svg` y rasteriza con Chromium de Playwright las cinco variantes de D10. Generar y versionar los PNG; adjuntar vista previa en el PR.
- [x] 4.3 Ampliar `apps/app/test/remanso-assets.test.js`: `public/` sin `sw.js`, `pwa.js` ni `manifest.webmanifest` (además de sin HTML ni mapas); `_headers` con `/icons/*`: `nosniff`, HSTS sin `preload` y `Cache-Control: public, max-age=31536000, immutable`. Agregar la regla a `apps/app/public/_headers`.
- [x] 4.4 Ruta `/manifest.webmanifest` en `pwa.js` (`Cache-Control: public, max-age=3600`).
- [x] 4.5 Cabeza común: en `renderPage` sumar `<link rel="manifest">`, `<link rel="icon" type="image/svg+xml">`, `<link rel="apple-touch-icon" sizes="180x180">` y `<script src="/pwa.js" defer>`. Actualizar a conciencia los snapshots de `apps/app/test/shell-characterization.test.js` (solo esas líneas deben cambiar) y las pruebas que comparan la cabeza.

## 5. Service worker, registro y apagado

- [x] 5.1 Pruebas primero en `pwa-reglas.test.js`: `/sw.js` responde JavaScript con `Cache-Control: no-cache`, `ETag` igual a la versión y `304` con `If-None-Match`; contiene la versión, la lista y el texto de `decidirPedido`; con `PWA_SW=off` responde `200` con el service worker de apagado (sin manejador `fetch`, con `unregister`, sin `navigate`); `/pwa.js` registra con `scope: '/'` y `updateViaCache: 'none'` en modo normal y desregistra en modo apagado, `Cache-Control: public, max-age=3600`.
- [x] 5.2 Implementar en `pwa.js`: texto del service worker (install con precarga sin credenciales y rechazo de no-`200`, no-`basic`, `private`/`no-store`; activate sin *navigation preload* (lo deshabilita; ver «Notas de implementación»), `cachesABorrar`, `clients.claim()`; fetch según `decidirPedido`), service worker de apagado, `/pwa.js` y las rutas `/sw.js` y `/pwa.js` en `index.js`.
- [x] 5.3 Caracterización: `SECURITY_HEADERS` idéntico al de la base y `apps/app/wrangler.jsonc` sin cambios (prueba que compare con el valor registrado); `HSTS` también en `/sw.js` y `/manifest.webmanifest` (ampliar `hsts.integration.test.js`).
- [x] 5.4 Prueba de costo: `/sw.js`, `/pwa.js`, `/manifest.webmanifest` y `/sin-conexion*` con y sin cookie no consultan D1.

## 6. Pruebas en navegador (Playwright sobre `wrangler dev`)

- [x] 6.1 `apps/app/playwright.config.mjs` y `apps/app/playwright.remanso.config.mjs`: `serviceWorkers: process.env.E2E_SERVICE_WORKERS ?? 'block'`, para que las suites existentes no cambien. (Además, `E2E_CHROMIUM_PATH` opcional para el ejecutable de Chromium.)
- [x] 6.2 `apps/app/e2e/pwa.spec.js` con `test.use({ serviceWorkers: 'allow' })`: registro con alcance `/`; caché `homesuite-pwa-<versión>` con exactamente la lista de D3 tras recorrer `/`, `/perfil`, `/cuentas-claras`, `/remanso` y `/jardin-zen`; ninguna entrada contiene `zelda-e2e` (usuario local del E2E) ni `_csrf`; cabeceras servidas de `/sw.js`, `/manifest.webmanifest`, un ícono y `/sin-conexion*`; sin violaciones de CSP.
- [x] 6.3 En el mismo archivo, sin conexión (`context.setOffline(true)`): `/jardin-zen` dibuja y rastrilla; `/remanso` muestra el nivel libre con aviso y una sesión de 1 minuto arranca (sin esperar el final); `/cuentas-claras` y `/groups/x` muestran «Sin conexión»; ningún pedido de la lista falla; al volver la conexión, «Reintentar» lleva a la página real.
- [x] 6.4 Formularios y API con el service worker activo: `POST /auth/logout` con token cierra la sesión y la siguiente navegación ya no la tiene; `/api/me` no aparece en la caché; un 404 del servidor se muestra tal cual.
- [x] 6.5 (estable: 3 corridas seguidas en verde, ~11 s; levanta su propio `wrangler dev` en el puerto `E2E_PWA_OFF_PORT`, por defecto 8796) Apagado en dos fases con perfil persistente (`launchPersistentContext` en un directorio temporal): fase 1 instala; fase 2 con el servidor en `--var PWA_SW:off` comprueba que tras una navegación no queda registro ni cachés `homesuite-pwa-*` y que la página no se recargó. Si no es estable, quitarla y dejar la verificación manual de staging (sección 8) documentada como límite.
- [ ] 6.6 (N/A: `remanso-sonidos-naturales` no está integrado; no existe `public/remanso/audio/`; la regla del audio la cubren `pwa-reglas.test.js` y `pwa-precarga.test.js`) Si `remanso-sonidos-naturales` ya está integrado: con el service worker activo, el pedido con `Range` de `/remanso/audio/lluvia.v1.opus` llega a la red (206) y no aparece en la caché; sin conexión y sin el archivo en caché HTTP, Remanso usa el sintetizado.
- [x] 6.7 (con `E2E_SERVICE_WORKERS=allow`: remanso 37/37; homesuite-app 197 de 198, la única falla fue `personas.spec.js` «dark … miden 44 px», que no se reproduce: pasa 2/2 con `allow` y 1/1 con `block` en corridas aisladas del archivo; sin hallazgo atribuible al service worker) Sonda de regresión: correr una vez `E2E_SERVICE_WORKERS=allow npm run test:e2e:homesuite-app` y `… test:e2e:remanso`; registrar el resultado (no queda como paso de CI salvo decisión).
- [ ] 6.8 (LÍMITE: el Firefox y el WebKit de Playwright no están instalados en esta máquina (solo Chromium 1243) y no se corre `playwright install`; sin resultado) Firefox opcional (`REMANSO_E2E_FIREFOX=1` o la config de Firefox) para registro y modo sin conexión; registrar resultado o límite. WebKit de Playwright como sonda informativa: no acredita iOS.

## 7. Revisión y verificación local

- [x] 7.1 (2026-11-09: `test:homesuite-app` 45 archivos / 711 pruebas; `…:integration` 27 / 352; `test:e2e:homesuite-app` 198; `test:e2e:remanso` 37; `test:homesuite-site` 2 / 44; todo en verde) Las cuatro suites en verde; `npm run test:homesuite-site` sin cambios.
- [x] 7.2 (2026-11-09: sin errores ni advertencias nuevas; 17 archivos, 544 KiB) `wrangler deploy --dry-run --env staging --config apps/app/wrangler.jsonc` sin advertencias nuevas.
- [x] 7.3 (2026-11-09, Pablo: Manifest sin errores, solo avisos opcionales de capturas; service worker activo con alcance /; caché con 18 entradas públicas; Jardín Zen y Remanso andan sin conexión, Remanso con el sintetizado) Revisión manual en Chrome de escritorio local: DevTools → Application → Manifest sin errores de instalabilidad; Service Workers y Cache Storage con lo esperado; Lighthouse no aplica (retiró la categoría PWA).
- [x] 7.4 (2026-11-09: válido) `openspec validate pwa-instalable --strict`.

## 8. Staging y verificación manual (pendiente de Pablo)

- [x] 8.1 (2026-11-09, con orden de Pablo: versión `7daec2bc`, SHA 6afbb87, respaldo `20261109T203120Z`, sin migraciones; smoke de siete rutas en 200 con las cabeceras esperadas; Pablo entró y salió con su cuenta de Google en staging) Con confirmación de Pablo: `wrangler deployments list --env staging` (la versión activa es la propia o está coordinado), publicar con `--message` (SHA y rama). Smoke del mismo SHA: cabeceras de `/sw.js`, `/manifest.webmanifest`, `/icons/*`, `/sin-conexion*` con `curl -I`; entrar y salir con una cuenta real.
- [ ] 8.2 (parcial, 2026-11-09: Pablo instaló en Android, usó la app y entró con Google; falta confirmar modo avión y el resto de la lista; observó que el acceso directo se llamaba «HS staging» y se cambió a «HomeSuite staging», sin publicar) **Pendiente de Pablo — Android + Chrome:** lista de design.md («Verificación manual pendiente de Pablo»).
- [ ] 8.3 **Pendiente de Pablo — iPhone + Safari:** ídem, incluido el acceso con Google dentro de la app (y habiendo entrado antes en Safari). Si falla, registrar el hallazgo y responder la pregunta abierta 1 antes de producción.
- [ ] 8.4 (parcial, 2026-11-09: Pablo instaló en escritorio, la usó y entró con Google en staging) **Pendiente de Pablo — escritorio (Chrome o Edge).**
- [ ] 8.5 Apagado en staging: publicar con `PWA_SW=off`, comprobar en DevTools y volver a publicar normal.
- [ ] 8.6 Revisión visual de Pablo de los íconos (incluida la máscara redonda de Android y el ícono de iPhone) y de los textos sin conexión.

## 9. Documentación (al final)

- [x] 9.1 `docs/productos/PLATAFORMA.md`: sección breve «App instalable» (qué se guarda y qué nunca, rutas nuevas, apagado con `PWA_SW=off`, scripts de íconos y precarga, enlace a este change). Mencionar en `docs/productos/REMANSO.md` y `JARDIN-ZEN.md` solo el comportamiento sin conexión (una línea cada una).
- [x] 9.2 (borrador, revisión de Pablo pendiente) `apps/site/public/privacidad.html`: ítem en «Cookies y almacenamiento local» sobre la copia local de archivos públicos (texto legal que revisa Pablo; se publica con el sitio, después de la app).
- [x] 9.3 (2026-11-09: bloque en rama, sin publicar; sin SHA porque no hay commit) `docs/STATUS.md`: hecho fechado con SHA, pruebas, staging y resultados de la verificación manual (o pendientes).
- [ ] 9.4 Si se integró después de `remanso-sonidos-naturales` (o antes, y aquel se integra después): actualizar su frase «Sin Service Worker» según «Cambios sugeridos a otros documentos» del design.
- [ ] 9.5 Producción solo con aprobación explícita de Pablo; primero la app, después el sitio; `npm run verify:coherence:production`.
