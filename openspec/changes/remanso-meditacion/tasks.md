Primer corte de Remanso en staging. Decisiones y riesgos en [design.md](design.md);
comportamiento en las specs. Trabajar en `feature/remanso` (worktree
`.worktrees/remanso`); no confirmar en `main`. Cada grupo lleva sus pruebas en el
mismo commit.

## 1. Paquete y estructura

- [x] 1.1 Copiar `remanso-engine.js` desde `~/Descargas/remanso/` a `apps/app/public/remanso/` y verificar con `cmp` que es idéntico al original; registrar su SHA-256.
- [x] 1.2 Guardar `INTEGRACION.md` y `remanso.html` en `docs/diseno/remanso/` con un README que diga que son referencia de diseño (no código, no cumple la política) y verificar que el enlace desde la ficha resuelve.
- [x] 1.3 Agregar `assets` a `apps/app/wrangler.jsonc` (sin `run_worker_first`) y `apps/app/public/_headers` con `nosniff` para `/remanso/*`; verificar con `wrangler deploy --dry-run --config apps/app/wrangler.jsonc` y con `--env staging` que el binding aparece en ambos.
- [x] 1.4 Verificar con `wrangler dev` que `/remanso/remanso-engine.js` se sirve con `Content-Type` JavaScript y `nosniff`; si `_headers` no aplica, activar el plan B de D1(d) y documentarlo en design.md.

## 2. Motor: pruebas de reglas

- [x] 2.1 Test Vitest `apps/app/test/remanso-engine.test.js`: tabla de gongs de las seis duraciones según INTEGRACION.md, `DURATIONS`, `AMBIENTS`, y que `start()` rechaza duración y fondo inválidos sin crear audio; `npm run test:homesuite-app` pasa.
- [x] 2.2 Test de fidelidad: SHA-256 del motor servido igual a la huella registrada; fallar al modificar un byte (verificarlo una vez a mano).
- [x] 2.3 Test de higiene de `public/`: sin archivos `.html` ni `.map`; falla si se agrega uno.

## 3. Servidor: ruta, sesión y entrada en la suite

- [x] 3.1 Escribir primero las pruebas de caracterización de `/`, `/tareas`, `/cuentas-claras`, `/compras` y `/perfil` (HTML, cabeceras, no-store) y verificar que pasan antes de tocar `page()`.
- [x] 3.2 Extender `page()` con `{ styles, scripts, bodyClass }` opcional y verificar que las pruebas de 3.1 siguen en verde sin cambios.
- [x] 3.3 Crear `apps/app/src/remanso.js` con `registerRemansoRoutes`, la constante única de opciones libres/con cuenta (D8) y `GET /remanso` (con sesión → `data-acceso="cuenta"` y `data-nombre`; sin sesión → `libre` sin nombre; ambiente sin Google; usuario local sólo en `localhost`); agregar `/remanso` a las rutas `private, no-store`. Pruebas con `app.request`: 200 con y sin sesión, enlace `returnTo=%2Fremanso` presente sin sesión, nombre escapado (`<`, `&`, comillas) y ausente sin sesión, listas libres ⊂ opciones del motor, sin `Set-Cookie` ni lecturas de D1 sin sesión (espía del binding), `Cache-Control`, cabeceras de seguridad.
- [x] 3.4 Prueba de HTML limpio: ni `<script>` sin `src`, ni `<style>`, ni `style=` ni `on*=`, y todo `src`/`href` de `/remanso` es del mismo origen.
- [x] 3.5 Agregar la tarjeta de Remanso a las tres variantes de la home y el enlace al menú de escritorio y móvil (fragmento único); pruebas de que aparecen y de que las demás tarjetas no cambian.

## 4. Interfaz

- [x] 4.1 Armazón HTML de las tres pantallas en el servidor (`hidden`, etiquetas, `noscript`, `data-nombre`); verificar con las pruebas de 3.3 y 3.4.
- [x] 4.2 `remanso.css`: tokens claro, oscuro y noche con la paleta de la suite, Georgia/sans del sistema, tarjetas, chips, anillo, objetivos de 44 px, foco visible, `prefers-reduced-motion`, encabezado oscuro acotado a `body.remanso`; verificar a mano en 360 px y escritorio en ambos esquemas con capturas.
- [x] 4.3 Prueba de contraste que lee los tokens de `remanso.css` (pares texto/fondo ≥ 4.5:1, bordes de controles ≥ 3:1) para claro, oscuro y noche; ajustar tokens hasta que pase.
- [x] 4.4 `remanso.js`: inicio (duraciones, fondos, volumen, línea de gongs, «Probar gong», «Comenzar · N min»), valores iniciales 10 min/lluvia/55 con cuenta y 5 min/agua/55 sin cuenta, sin `innerHTML` con datos ni estilos por atributo; E2E del inicio en ambos niveles.
- [x] 4.4b Opciones con cuenta sin sesión: botones marcados «con cuenta» con `aria-disabled`, enfocables, que abren el aviso con «Continuar con Google» sin cambiar la selección ni llamar al motor; E2E: elegir 20 min o lluvia sin sesión muestra el aviso, no cambia nada y no inicia audio; con sesión todo es elegible.
- [x] 4.5 `remanso.js`: sesión (tiempo restante, anillo con marcas, «Próximo gong en»/«Gong final en», pausa/reanudar, silenciar fondo oculto en «silencio», terminar, encabezado oculto, `theme-color`, avisos `aria-live` acotados); E2E con Chromium.
- [x] 4.6 `remanso.js`: cierre (título por duración, saludo por nombre con `textContent` sólo con cuenta, sin ninguna invitación a crear cuenta sin sesión, estado de ánimo opcional sin persistir, «Volver al inicio», «Repetir sesión» con los mismos valores); E2E del cierre con y sin nombre.
- [x] 4.7 Ciclo de vida: `dispose()` en `pagehide`, regreso a inicio en `pageshow` persistido, inicio de audio sólo en `click`; E2E que navega fuera en medio de la sesión y comprueba que no queda sesión activa.
- [x] 4.8 Revisar el checklist de consistencia UI (tipografía de encabezados, teclado: Enter/Espacio/Escape, sin import/export) y registrar las decisiones de diseño en la ficha en el mismo commit.

## 5. E2E sobre servidor real y CI

- [x] 5.1 Crear `apps/app/playwright.config.mjs` y `apps/app/e2e/` (puerto propio, estado de D1 local descartable, migraciones aplicadas antes, `DEV_LOCAL_MODE` sin `DEV_LOCAL_EMAIL`; las pruebas con cuenta usan la cabecera `X-HomeSuite-Dev-Email`) y el script `test:e2e:remanso`; verificar que corre en limpio dos veces seguidas.
- [x] 5.2 E2E de cabeceras sobre `wrangler dev`: política, `X-Frame-Options` y `nosniff` en `/`, `/tareas`, `/cuentas-claras`, `/compras`, `/perfil`, `/remanso` y en los recursos de Remanso.
- [x] 5.3 E2E del recorrido, sin cuenta (inicio libre → sesión de 1 min → terminar antes → cierre sin nombre ni mención a la cuenta) y con cuenta (→ cierre con nombre), sin violaciones de política (`securitypolicyviolation`) ni errores de consola; teclado (Tab/Enter/Espacio), 360 px sin desborde y `colorScheme` claro/oscuro con `emulateMedia`.
- [x] 5.4 Intentar el mismo recorrido en Firefox o WebKit; registrar el resultado o el límite si no se pueden instalar.
- [x] 5.5 Agregar el script al workflow `.github/workflows/test.yml` y verificar el YAML; la ejecución en CI se confirma en el PR.

## 6. Documentación

- [x] 6.1 Crear `docs/productos/REMANSO.md` (ficha: alcance, niveles libre/con cuenta y su límite client-side, rutas, archivos, reglas, huella del motor, comandos, riesgos no verificados) y enlazarla desde `CLAUDE.md` y `QUICK_START.md`; verificar los enlaces locales.
- [x] 6.2 Backlog: historial y su alcance (persona u hogar, sin rachas), navegación y nombre de las mitades, landing pública, modo oscuro global, grabaciones vs. sintetizados, y los tres riesgos de dispositivo con la marca «investigar a fondo en internet antes de decidir».
- [x] 6.3 Registrar en STATUS el estado de la rama y, al publicar, el SHA, la versión, las pruebas y los límites. Actualizar APRENDIZAJES sólo si surge uno nuevo con evidencia.

## 7. Verificación local y publicación en staging

- [x] 7.1 Ejecutar `npm test`, `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:remanso`, `npm run test:homesuite-site` y `openspec validate remanso-meditacion --strict`; registrar comandos, SHA y resultados.
- [x] 7.2 Agregar el script `dev:homesuite-app:anonimo` (igual que `dev:homesuite-app` sin `DEV_LOCAL_EMAIL`), levantar el servidor local y ofrecer a Pablo `http://localhost:8787/remanso` en ambos modos con qué mirar (opciones libres y con cuenta, los seis fondos con cuenta, claro/oscuro, pausa, fin anticipado, nombre en el cierre) y esperar su OK.
- [x] 7.3 Con árbol limpio, correr `wrangler deploy --dry-run --env staging --config apps/app/wrangler.jsonc`, avisar que el despliegue reemplaza el SHA activo de staging y pedir confirmación inmediatamente antes de ejecutar `npm run deploy:homesuite-app:staging`.
- [x] 7.4 Smoke del mismo SHA en staging: `/healthz`, `/remanso` (200 con sesión o invitación sin ella), recursos 200 con tipo y `nosniff`, cabeceras de las demás rutas y `X-Request-Id`; registrar el resultado.
- [ ] 7.5 Entregar a Pablo la lista de prueba para su teléfono (sin cuenta y con cuenta, iPhone/Android, modo silencio, pantalla bloqueada, cambio de pestaña, claro/oscuro, los seis fondos seguidos) y registrar sus hallazgos en el backlog.
- [ ] 7.6 Abrir el PR con problema, resultado, validación y límites; archivar el change sólo cuando esté verificado e integrado, no por tener los documentos.

## 8. Ajustes tras la primera prueba local (2026-10-26)

- [x] 8.1 Quitar del cierre sin sesión la invitación a crear cuenta (código, estilos, especificación y pruebas); verificar con el E2E sin cuenta que el cierre no menciona la cuenta ni tiene enlaces, y con la prueba de ruta que el HTML no la contiene.
- [x] 8.2 Eliminar el «wa-wa» del gong con el cambio mínimo del desafinado (±0,4 → ±0,02 Hz); verificar con la medición sin conexión (~21 dB → ~0,7 dB), con el E2E que falla con el motor original, y con la prueba de fidelidad que la única diferencia con el paquete es esa línea.

## 9. Gongs elegibles (pedido de Pablo, 2026-10-26)

- [x] 9.1 Revertir `remanso-engine.js` al del paquete (huella original) y simplificar la prueba de fidelidad; verificar que la prueba pasa sin reemplazo de línea y que sigue fallando al cambiar un byte.
- [x] 9.2 Crear `remanso-gongs.js` con los tres sonidos y `SuiteEngine` (`setGong`, `gong()` sobrescrito); pruebas Vitest de ids, nombres, niveles, inicio/fin más agudo que intermedio en cada sonido, y de que `testGong` y `start` usan el sonido elegido (contexto simulado).
- [x] 9.3 Servidor: `REMANSO_ACCESO.gongs` e `inicial.gong`, atributos `data-libre-gongs`/`data-inicial-gong` y bloque «Sonido del gong» en el armazón; pruebas de ruta con y sin sesión.
- [x] 9.4 Interfaz: botones de gong con tratamiento «con cuenta», elección recordada en `localStorage` con try/catch y descartada si el nivel no la permite; «Probar gong» y sesiones usan el sonido elegido; E2E sin cuenta (sólo brillante, el resto explica), con cuenta (elige, persiste al recargar, cae al brillante sin sesión) y sin `localStorage`.
- [x] 9.5 Generalizar la prueba de «wa-wa» a los tres sonidos × inicio/fin e intermedio; verificar que falla con el desafinado original y que pasa con los tres.
- [x] 9.6 Capturas en 360 px (claro y oscuro) del nuevo bloque y revisión visual; actualizar ficha, STATUS y backlog.

## 10. Placa en el sitio público de staging (pedido de Pablo, 2026-10-26)

- [x] 10.1 Tarjeta de Remanso en `apps/site/public/index.html` y landing `remanso.html` con estilos en claro y oscuro; verificar sin JavaScript, sin `style=` y con las pruebas del sitio actualizadas (cuatro landings, cuatro páginas).
- [x] 10.2 Worker del sitio: reemplazar el marcador de `/remanso` sólo en staging por el enlace a la app y su aclaración; pruebas unitarias de staging vs. producción y de `noindex`.
- [x] 10.3 E2E del sitio: portada → landing de Remanso, sin enlace a la app ni controles en producción, 360 px, modo oscuro y cabeceras; el E2E del sitio entra al CI si falta.
- [x] 10.4 Despliegue del sitio de staging (`wrangler deploy --env staging --config apps/site/wrangler.jsonc`): `--dry-run` antes, confirmar que no toca producción, smoke del recorrido portada → landing → app y registro.

## 11. Ajustes tras probar staging (pedido de Pablo, 2026-10-27)

- [x] 11.1 Escribir las pruebas que fallan primero: E2E de «el inicio y el cierre caben en la ventana» (390 × 720 y 1280 × 680, con y sin cuenta), Vitest del nivel máximo de `windGust` en `SuiteEngine` y de la huella del motor intacta, y la prueba de ruta del volumen inicial 72.
- [x] 11.2 Que la pantalla entre sin scroll: el contenedor de la app dejaba `min-height: 100dvh` bajo el encabezado, así que siempre excedía la ventana; pasar a una columna de la altura de la ventana y compactar duración, línea de gongs, fondos, volumen y cierre; verificar con el E2E y con capturas a 390 y 1280 px, claro y oscuro.
- [x] 11.3 Volumen inicial del fondo 72 (un 30 % más que 55) en `REMANSO_ACCESO`, el atributo de datos y el cliente; verificar con las pruebas de ruta y de contraste.
- [x] 11.4 Bajar las ráfagas de viento del bosque reemplazando `windGust()` en `SuiteEngine` con una constante de nivel; verificar con la prueba Vitest y que la huella del motor no cambia.
- [ ] 11.5 Suites completas en Chromium y Firefox, levantar en local para que Pablo lo revise de oído y de vista, y recién después pasar a staging con su aprobación.
