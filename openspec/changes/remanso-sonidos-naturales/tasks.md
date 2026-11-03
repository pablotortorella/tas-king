Fondos naturales de Remanso conviviendo con los sintetizados. Decisiones y números en
[design.md](design.md); comportamiento en las specs. **Propuesto, sin implementar.** Trabajar en
`feature/remanso-sonidos` (worktree propio); no confirmar en `main`. Cada grupo lleva sus pruebas en
el mismo commit y las pruebas se escriben antes que el código.

## 0. Prerrequisitos y orden

- [x] 0.1 `remanso-meditacion` ya está archivado y sus specs están en `openspec/specs/` (verificado al integrar `main`, 2026-11-02): los `MODIFIED` de `remanso-sesion`, `remanso-entrega` y `remanso-pantallas` tienen contra qué aplicarse. Volver a correr `openspec validate remanso-sonidos-naturales --strict` al implementar.
- [ ] 0.2 Implementar después de los changes de Cuentas Claras (acordado el 2026-11-02). Partir de `main` actualizado; confirmar con `git status` y `git worktree list` que no se pisan otras ramas; no copiar los audios al repositorio antes de este punto.
- [ ] 0.3 Verificar de nuevo la licencia de cada ficha de Freesound (título, autor, CC0) y guardar la fecha; los títulos de Freesound de agua y lluvia terminan en `.wav` (el kit usa «Arroyo tranquilo» para agua): los créditos usan el título de Freesound.

## 1. Archivos de audio y procedencia

- [ ] 1.1 Copiar el kit tal cual se recibió (`README.md` y `manifest.json`, sin los `.opus`) a `docs/diseno/remanso/audio/` con una nota de que es referencia de procedencia; no ejecutar nada del kit.
- [ ] 1.2 Verificar el SHA-256 de cada `.opus` contra `manifest.json` del kit y copiar solo `agua`, `lluvia` (la principal de 316 s, Snoopy20111), `bosque`, `fuego` y `noche` a `apps/app/public/remanso/audio/<fondo>.v1.opus`. **No** copiar `lluvia-alternativa` (87,6 s): queda fuera de la entrega. Total esperado: 4 123 752 B (3,93 MiB).
- [ ] 1.3 Crear `apps/app/public/remanso/remanso-sonidos.js` (manifiesto): `id`, `archivo`, `sha256`, `bytes`, `duracionSegundos`, `canales`, `modo` (`flujo` en lluvia, `buffer` en los demás), `cruceSegundos` (0 en agua, lluvia, bosque y fuego; 4 en noche), `capas` en bosque y fuego (`tasa` 0,94; `desfaseSegundos` 9,0 y 2,9; `relativo` 0,7; `paneo` 0,25), `nivel` (inicial por igualación de sonoridad al RMS objetivo de −32 dBFS del prototipo: bosque ≈ −10 dB, el resto sube), `habilitado` (true) y la procedencia; constantes `PRESUPUESTO_DECODIFICADO` (40 MB) y `FLUJO_EN_IOS` (true hasta la prueba en iPhone).
- [ ] 1.4 Pruebas Vitest de integridad (sin `ffmpeg`): SHA-256 y tamaño de cada archivo igual al manifiesto; duración y canales leídos de `OpusHead` y de la posición granular de la última página Ogg igual al manifiesto; decodificado estimado ≤ presupuesto en los `buffer` y `modo: "flujo"` si y solo si lo supera; `cruceSegundos > 0` y `capas` solo en `buffer`; carpeta y manifiesto sin huérfanos; nombres versionados; falla si se agrega un archivo sin manifiesto o se altera un byte (verificarlo una vez a mano).

## 2. Capa `remanso-fondos.js`

- [ ] 2.1 Pruebas primero (contexto simulado y motor real): elección natural/sintetizado; con natural, `super.start` recibe `silencio`; la fuente cuelga de `session.amb` por un nodo de nivel; con sintetizado o buffer ausente el comportamiento es el de `SuiteEngine` sin cambios (`session.ambient` igual al elegido); `fadeOutSession` detiene las fuentes; `dispose` suelta el buffer; importar la capa no modifica `RemansoEngine.prototype`.
- [ ] 2.2 Implementar `FondosEngine extends SuiteEngine`: `start()`, `fadeOutSession()` y el montaje de fuentes (D1). No tocar `remanso-engine.js` ni `remanso-gongs.js`; la prueba de huella sigue en verde.
- [ ] 2.3 Bucle nativo: una fuente con `loop`, `loopStart`/`loopEnd` y desplazamiento al azar; prueba de tiempos y de `stop` en `t0 + D + 6,1 s`.
- [ ] 2.3b Dos capas (bosque y fuego): dos fuentes del mismo buffer con `loop`; capa 1 a velocidad 1, paneo −0,25, ganancia 0,75; capa 2 a velocidad 0,94, paneo +0,25, ganancia 0,525, comenzando en `(o + desfaseSegundos) mod duración`; pruebas de tasas, desfase, paneo, ganancias, un solo buffer, `stop` y pausa sin desfase.
- [ ] 2.3c Flujo (lluvia): elemento nuevo por sesión con `src` al archivo, `loop`, sin `currentTime`, `createMediaElementSource` conectado por el nodo de nivel a `session.amb`; `pause()`/`resume()` sobre el elemento; liberación (`pause`, quitar `src`, desconectar) en `fadeOutSession` y `dispose`; `FLUJO_EN_IOS`; pruebas con elemento y contexto simulados, incluida la de que nunca se crea un `AudioBuffer` de la lluvia.
- [ ] 2.4 Cruce de potencia constante (noche, X = 4 s): instancias programadas al inicio con curvas `sin`/`cos` por `setValueCurveAtTime`; pruebas de la cantidad (11 para noche en 30 min), del paso `duración − X`, del desplazamiento inicial acotado (`0 ≤ o ≤ duración − 2X`), de que la suma de potencias es constante y de que pausar no las desfasa.
- [ ] 2.5 `nivel` por fondo en un `GainNode` propio; prueba de que el volumen del control llega igual a las dos versiones.

## 3. Carga, estado y respaldo

- [ ] 3.1 Pruebas primero con `fetch` y decodificador simulados: red caída, 404/500, tipo inesperado, bytes corruptos, `decodeAudioData` rechazado, tiempo agotado, sin `canPlayType('audio/ogg; codecs=opus')`, sin `OfflineAudioContext`; un fallo no es permanente (reintento al elegir otra vez); nunca mezcla versiones.
- [ ] 3.2 Implementar la carga: `fetch(url, { credentials: "omit" })` con `AbortController`, decodificación con `OfflineAudioContext(canales, 1, 48000)`, estados `ausente → cargando → listo | fallido`, un solo buffer decodificado, `ESPERA_MAXIMA_MS = 3000`.
- [ ] 3.3 Flujo del clic: desbloquear el audio dentro del gesto (`ensureCtx()` y `resume()`), «Preparando el sonido…», guardia contra doble toque, arranque natural o sintetizado según el estado; registrar la causa de un fallo en la consola.
- [ ] 3.3b Flujo de la lluvia en el clic: `play()` dentro del gesto, espera de `playing` hasta 3 s, `error`/`stalled`/rechazo de `play()` → sintetizado completo; el respaldo no decodifica el archivo.
- [ ] 3.4 Pruebas del flujo con tiempos simulados: listo → natural síncrono; cargando que llega a los 2 s → natural; cargando que no llega a los 3 s → sintetizado y la descarga sigue; fallido → sintetizado inmediato.

## 4. Interfaz

- [ ] 4.1 Preferencia «Natural / Sintetizado» (`aria-pressed`, `remanso:sonido`, `try/catch`, valor inválido = Natural) en la fila del rótulo «Fondo», sin una fila nueva; oculta si el navegador no reproduce Ogg Opus. Estilos en `remanso.css` con contraste AA medido por `remanso-contrast.test.js`.
- [ ] 4.2 «Fondo: lluvia · sintetizado» en la sesión cuando la preferencia era Natural y se usó el respaldo; el botón «Preparando el sonido…» y el estado `aria-live` sin alertas.
- [ ] 4.3 Precarga al abrir el inicio y al elegir fondo (solo con Natural, fondo con sonido y permitido por el nivel); `AbortController` al cambiar; enlace «Créditos de los sonidos».
- [ ] 4.4 Verificar con el E2E «caben en la ventana» (390 × 720 y 1280 × 680, con y sin cuenta, con la holgura de 20 px) y con capturas a 360 px en claro y oscuro; compactar la fila nueva si hace falta.

## 5. Servidor, créditos y entrega

- [ ] 5.1 Pruebas primero de `GET /remanso/creditos` con `app.request`: 200 sin sesión, cinco fondos con título, autor, licencia y enlace generados del manifiesto, escape, `rel="noopener noreferrer"`, sin recursos de otro origen, cabeceras de seguridad, sin `Set-Cookie` ni D1.
- [ ] 5.2 Ruta `/remanso/creditos` en `apps/app/src/remanso.js` con `page()` y `Cache-Control: private, no-store` como `/remanso`; enlace desde el inicio.
- [ ] 5.3 `public/_headers`: regla de `/remanso/audio/*` con `Cache-Control: public, max-age=31536000, immutable` y `nosniff`; ampliar la prueba que lee `_headers`.
- [ ] 5.4 Verificar sobre `wrangler dev` y staging el `Content-Type` real de `.opus` y que respondan `Accept-Ranges: bytes` y 206 a un `Range` (`curl -r 0-1023`); sin 206 el flujo de la lluvia no es viable (Open Question 1). Si no es `audio/ogg`, fijarlo en `_headers`; si `_headers` no puede, plan B acotado a `/remanso/audio/*` (`run_worker_first` + `ASSETS.fetch`) y documentarlo en design.md y en ADR-019.
- [ ] 5.4b Prueba de que el almacén de assets sirve `/remanso/audio/*` sin invocar al Worker (`wrangler.jsonc` sin `run_worker_first`) y sin `Set-Cookie`.
- [ ] 5.5 Prueba de caracterización de que `SECURITY_HEADERS` no cambia y de que `wrangler.jsonc` no cambia; confirmar con `wrangler deploy --dry-run --env staging --config apps/app/wrangler.jsonc`.

## 6. Pruebas de navegador (Chromium y Firefox)

- [ ] 6.1 Reescribir el escenario «sin descargar archivos de audio» y revisar el parche de `AudioContext` de `apps/app/e2e-remanso/remanso.spec.js` para que cuente fuentes y buffers.
- [ ] 6.2 E2E: el fondo natural suena (fuente con el buffer del fondo, duración y canales del manifiesto, conectada a `amb`; el archivo servido decodificado no es silencio) en cada fondo del nivel, sin violaciones de la política ni errores de consola.
- [ ] 6.3 E2E con `page.route`: abortar, 404, bytes corruptos y respuesta de más de 3 s → la sesión empieza sintetizada, muestra «sintetizado» y no hay errores.
- [ ] 6.4 E2E: solo se pide el archivo del fondo elegido; cambiar de fondo pide el nuevo (la lluvia, recién al comenzar); con Sintetizado o silencio no se pide ninguno; las solicitudes de los fondos en buffer no llevan cookie.
- [ ] 6.4b E2E de la lluvia en flujo (Chromium y Firefox): suena desde un elemento con `loop`, sin `AudioBuffer`, el volumen y el silencio del fondo actúan; medida del hueco del empalme (`currentTime = duración − 3`, silencio digital < 20 ms, sin salto de más de 6 dB); registrar el valor medido.
- [ ] 6.5 E2E: la preferencia se recuerda al recargar y funciona con `localStorage` bloqueado; el nivel libre sigue explicando las opciones con cuenta.
- [ ] 6.6 E2E sobre el servidor real: `Content-Type: audio/ogg`, `Cache-Control` inmutable y `nosniff` en cada `.opus`; huella SHA-256 del `remanso-engine.js` servido igual a la registrada.
- [ ] 6.7 Correr la suite en Firefox (`REMANSO_E2E_FIREFOX=1`) y probar WebKit de Playwright como sonda informativa de Ogg Opus; registrar el resultado o el límite.

## 7. Calibración y prueba de oído (Pablo)

- [ ] 7.1 Medir la sonoridad integrada (LUFS) de los cinco archivos y del render sin conexión de cada fondo sintetizado; fijar `nivel` (dentro de 1,5 LU entre sí) y registrar mediciones y fecha.
- [ ] 7.2 Preparar fuera del repositorio los clips de empalme de 20 s (10 s finales + 10 s iniciales) de los fondos en buffer y pasárselos a Pablo; confirmar `cruceSegundos` (agua 0, noche 4) y las dos capas de bosque y fuego según su oído (D5) y repetir la prueba en la app. Para la lluvia, la escucha de 20 min de D12.2b.
- [ ] 7.3 Ronda de oído con Pablo: los cinco fondos seguidos (natural contra sintetizado a igual volumen), sesión de 30 min en fuego y bosque (dos capas), 10 min en los demás; ajustar capas o `habilitado: false` por fondo. Igualar sonoridad (D6), en especial el bosque.
- [ ] 7.4 Conexión lenta («3G rápido» y «3G lento», caché desactivada): «Preparando el sonido…» no más de 3 s y respaldo con indicación; medir el pico de memoria decodificando `noche` y el de la lluvia en flujo (sin decodificarla entera) en escritorio.

## 8. Documentación y textos

- [ ] 8.1 Ficha `docs/productos/REMANSO.md`: fondos naturales y sintetizados, preferencia, respaldo, archivos y presupuesto de memoria, créditos, que el nivel libre sigue siendo un incentivo (los archivos son CC0 y públicos), riesgos no verificados actualizados y nuevo conjunto de archivos.
- [ ] 8.2 GLOSARIO: concepto «sonido del fondo» con sus nombres (interfaz «Natural» y «Sintetizado», código `natural` y `sintetizado`); correr `apps/app/test/glossary.test.js`.
- [ ] 8.3 STATUS y backlog: el ítem «Sonidos reales» pasa a implementado en rama con lo que sigue pendiente (flujo de la lluvia en iPhone, AAC, repetición de fuego y bosque); mantener el ítem «Remanso: sonido de mar (olas en la orilla)»; ADR-019: nota sobre los archivos de audio y el plan B.
- [ ] 8.4 **Texto legal que revisa Pablo:** redactar la propuesta para `apps/site/public/privacidad.html` (sección Remanso y lista de preferencias locales), `terminos.html` (sección Remanso) y `remanso.html` (landing) según D13; entregarla a Pablo como diff y esperar su aprobación; no cambiar «Última actualización» sin ella. Ajustar las pruebas del sitio que citen esas frases.
- [ ] 8.5 Revisión de todo texto nuevo: español rioplatense con voseo y lenguaje sin género; `glossary.test.js` en verde.

## 9. Verificación y publicación

- [ ] 9.1 Ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:remanso`, `npm run test:homesuite-site` y `openspec validate remanso-sonidos-naturales --strict`; registrar comandos, SHA y resultados.
- [ ] 9.2 Ofrecer a Pablo la versión local (`npm run dev:homesuite-app` y `:anonimo`) con qué mirar: las dos versiones de cada fondo, el respaldo (cortando la red), la preferencia y los créditos; esperar su OK.
- [ ] 9.3 Con árbol limpio: `wrangler deploy --dry-run --env staging`, avisar que se reemplaza el SHA activo de staging, confirmación de Pablo y despliegue; smoke del mismo SHA (cabeceras, tipo y caché de los cinco `.opus`, `/remanso/creditos`, política intacta).
- [ ] 9.4 Lista de prueba para el teléfono de Pablo y para un iPhone (D12.5, incluidos los puntos i-ix del flujo de la lluvia): Ogg Opus carga o no, interruptor de silencio, pantalla bloqueada, cambio de app, llamada, pausa, fundidos, seis fondos seguidos, memoria con `noche` y lluvia; escucha de 20 min de la lluvia (D12.2b); registrar modelo y versión de iOS y hallazgos en el backlog.
- [ ] 9.5 Decidir con esa evidencia las preguntas abiertas que dependen de ella (flujo de la lluvia en iPhone y `FLUJO_EN_IOS`, AAC/M4A, espera de 3 s) y, si hace falta, abrir un change nuevo.
- [ ] 9.6 Producción de la app solo con aprobación explícita de Pablo y con el sitio de los textos revisados ya desplegado (o junto con la app).
- [ ] 9.7 PR con problema, resultado, validación y límites; archivar el change cuando esté verificado e integrado, no por tener los documentos.
