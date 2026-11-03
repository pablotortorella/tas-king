## Context

Estado observado en `main` (`1553229`, 2026-11-02):

- **Motor** `apps/app/public/remanso/remanso-engine.js`, huella SHA-256 `f00c37b5…7042` en
  `apps/app/test/remanso-assets.test.js`. `start()` crea `session.amb` (ganancia con fundido de
  entrada de 4 s, volumen `(v/100)²` y fundido de salida de 6 s), `session.mute` (silencio del
  fondo) y `session.bus`; después llama `buildAmbient(session)`. `pause()` suspende el
  `AudioContext`; `fadeOutSession(s, secs)` cierra el `bus` al terminar o al empezar otra
  sesión; `dispose()` cierra el contexto.
- **Capa propia** `remanso-gongs.js`: `SuiteEngine extends RemansoEngine` ya reemplaza `gong()`,
  `crackle()`, `windGust()`, `drop()`, `buildAmbient()` y `ensureCtx()`. Es el precedente.
- **Interfaz** `remanso.js` crea `new SuiteEngine()`, guarda el gong en `localStorage`
  (`remanso:gong`) y llama `engine.start(...)` solo desde `click`. Los niveles de acceso viven en
  `REMANSO_ACCESO` (`apps/app/src/remanso.js`): libre = silencio, agua, bosque; cuenta = además
  lluvia, fuego y noche.
- **Entrega** (ADR-019): binding `assets` (`./public`) sin `run_worker_first`; `public/_headers`
  solo pone `nosniff` en `/remanso/*`; una prueba prohíbe `.html` y `.map` en `public/`, que hoy
  pesa 120 KB. **CSP** (`apps/app/src/index.js`, `SECURITY_HEADERS`): `default-src 'self'; …
  script-src 'self'; style-src 'self'`, sin `media-src` ni `connect-src`, que caen en `default-src`.
- `remanso-meditacion` **sigue sin archivar**: el requisito «Fondos sonoros» vive en
  `openspec/changes/remanso-meditacion/specs/remanso-sesion/spec.md`, no en `openspec/specs/`.
- **Kit de Pablo** (verificado por SHA-256 contra su manifiesto, 2026-11-02): seis archivos Ogg
  Opus de 48 kHz, todos CC0 de Freesound. Las fichas de Freesound de los seis se consultaron el
  2026-11-02 y dicen CC0; los títulos de Freesound de agua y lluvia terminan en `.wav` y el kit
  tradujo el de agua («Arroyo tranquilo»): los créditos usan el título de Freesound.

## Goals / Non-Goals

**Goals:**

- Que cada fondo con sonido tenga una versión natural sin que el sintetizado deje de funcionar ni
  de estar disponible (preferencia y respaldo).
- Que ningún dispositivo reciba más memoria ni datos de los necesarios: un solo fondo en memoria,
  descargado solo si se eligió.
- Que la integración no toque el motor ni la política de contenido, y que lo seguro sea lo
  verificado sobre el servidor real.
- Que la procedencia de cada archivo sea comprobable (manifiesto, SHA-256, créditos).

**Non-Goals:** ver `proposal.md`. En particular, no se diseña acá el audio con la pantalla
bloqueada ni un servidor de audio con permisos.

## Decisions

### D1. Una capa nueva que usa el motor tal cual

`apps/app/public/remanso/remanso-fondos.js` exporta `FondosEngine extends SuiteEngine` (la
cadena es `RemansoEngine → SuiteEngine → FondosEngine`; `remanso.js` instancia `FondosEngine`
en vez de `SuiteEngine`). Usa solo los puntos de extensión que `SuiteEngine` ya usa más dos:

| Método | Qué hace la capa |
|---|---|
| `start(opts)` | Si hay un buffer natural listo y la preferencia es Natural: llama `super.start({ …opts, ambient: "silencio" })` y conecta la grabación a `this.session.amb`. Si no: `super.start(opts)` sin cambios. Anota en la sesión qué versión suena (`session.sonido = "natural" \| "sintetizado"`). |
| `fadeOutSession(s, secs)` | `super` y después detiene las fuentes naturales de esa sesión al terminar el fundido (cubre fin anticipado y «Repetir» sobre una sesión viva). |
| `pause()` / `resume()` | Sin cambios: las fuentes se programan con el reloj del `AudioContext`, que `suspend()` congela. |
| `dispose()` | Sin cambios: `ctx.close()` libera fuentes y buffers de ese contexto; la capa suelta además su referencia al buffer. |

Con fondo `silencio` el motor no sintetiza nada (`buildAmbient` no entra a ninguna rama), así
que la grabación suena sola bajo el mismo `amb`. La capa **depende de detalles del motor**
(`session.amb`, `session.t0`, `fadeOutSession`), igual que `gong()` depende hoy de
`this.gong(t, amp, dest, main)`: una prueba de contrato (D11) ejecuta la capa sobre el motor
real con un contexto simulado, y si un motor futuro cambia esos nombres, falla.

*Alternativas descartadas:* (a) editar el motor para aceptar un `buffer`: cambia la huella y
rompe «integrar tal cual»; (b) crear un `AudioContext` propio para el fondo: dos relojes, la
pausa no los congela juntos y se duplica la sesión de audio de iOS; (c) mezclar la grabación
con el sintetizado: se oyen las dos cosas.

### D2. Memoria: reproducir en buffer, con un presupuesto

Un `AudioBuffer` guarda PCM Float32: `segundos × 48 000 × canales × 4 B`. Con los archivos del kit:

| Archivo | Duración | Canales | Opus (descarga) | Decodificado | Entra en 40 MB |
|---|---:|:---:|---:|---:|:---:|
| `agua` | 29,9 s | 2 | 0,37 MiB | 11,5 MB (11,0 MiB) | sí |
| `bosque` | 27,1 s | 2 | 0,20 MiB | 10,4 MB (9,9 MiB) | sí |
| `fuego` | 8,6 s | 2 | 0,06 MiB | 3,3 MB (3,1 MiB) | sí |
| `noche` | 177,6 s | 1 | 1,22 MiB | 34,1 MB (32,5 MiB) | sí |
| `lluvia-alternativa` | 87,6 s | 2 | 0,50 MiB | 33,6 MB (32,1 MiB) | sí |
| `lluvia` (la principal del kit) | 316,0 s | 2 | 2,09 MiB | **121,3 MB (115,7 MiB)** | **no** |

Cálculo, no medición: no se midió el pico real de `decodeAudioData` (que además tiene los bytes
codificados y puede tener un intermedio) ni el límite de memoria de Safari en iPhone, que Apple
no publica. Se mide en la implementación (tarea 7.4).

**Los dos caminos:**

| | (a) `<audio loop>` + `MediaElementAudioSourceNode` | (b) `AudioBufferSourceNode` |
|---|---|---|
| Memoria | Streaming: no decodifica todo. Cualquier duración. | Todo el PCM. Acotado por presupuesto. |
| Empalme | `loop` del elemento: sin garantía de continuidad entre navegadores (hay reportes históricos de huecos en Chrome, Safari y otros; no medimos los actuales). Un cruce exigiría dos elementos y un temporizador impreciso (`timeupdate`). | `loop` exacto por muestra sobre el buffer, y cruce programado con el reloj del contexto sin imprecisión. |
| Control de nivel (fundidos, volumen, silencio) | Depende de que el nodo de ganancia tenga efecto sobre el elemento. En iOS hay reportes de WebKit de que **no lo tiene** ([151589](https://bugs.webkit.org/show_bug.cgi?id=151589), [180696](https://bugs.webkit.org/show_bug.cgi?id=180696): abiertos hasta iOS 16.6, estado actual sin verificar) y de crepitaciones al conectar un elemento al grafo. Sin eso fallan juntos el fundido de 4 s, el de 6 s, el volumen y el silencio del fondo. | Es el mismo camino de los gongs y del sintetizado: el grafo que el motor ya usa. |
| Pausa | `ctx.suspend()` no detiene el elemento: hay que pausarlo aparte, con otro reloj. | `suspend()` congela todo. |
| Inicio | `play()` debe ir dentro del gesto en iOS, y en iOS el elemento no precarga. | Se descarga y decodifica antes del clic. |
| Riesgo principal | iOS (justo donde la memoria importa). | Memoria. |

**Elección conservadora: (b) para todos los fondos, con un presupuesto de 40 MB decodificados por
fondo** (`PRESUPUESTO_DECODIFICADO`, una constante comprobada por una prueba contra el manifiesto).
Razón: el riesgo de (b) es medible y se acota con números; el de (a) cae justo sobre el control de
nivel de iOS, que no podemos probar sin un iPhone, y rompería el fundido y el volumen en silencio.
El presupuesto deja afuera la lluvia de 316 s, así que **la lluvia de la primera versión es
`lluvia-alternativa` (87,6 s)**. Solo se copia al repositorio, con su nombre versionado, el
archivo que se sirve; la lluvia de 316 s queda en el kit.

Con un solo buffer decodificado a la vez (D4), el pico es el del fondo más pesado: ~34 MB (noche
o lluvia). Es una cifra por debajo del presupuesto, no una garantía de que el iPhone la aguante:
queda para la prueba manual.

*Alternativas anotadas en Open Questions:* usar la lluvia de 316 s con (a) detrás de una marca
por fondo (`modo: "flujo"`) tras probarla en iPhone; recortarla a ~150 s en mono (28,8 MB) con
el cruce horneado; y las dos cosas por dispositivo (principal en escritorio, alternativa en móvil).

### D3. Formato y compatibilidad de Ogg Opus

Fuentes consultadas el 2026-11-02:

- caniuse, «Opus audio» (`audio` element): Safari de escritorio **parcial** en todas sus
  versiones; **Safari en iOS: parcial de 11 a 18.3 y «compatible» desde 18.4**. La tabla no
  distingue contenedor (Ogg, WebM, CAF).
- MDN, guía de códecs de audio: Safari reproduce Opus en `<audio>` «solo empaquetado en CAF» (nota
  histórica de macOS 10.13 e iOS 11).
- WebKit, [«WebKit Features in Safari 18.4»](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/):
  «Ogg container support for both Opus and Vorbis audio» en macOS Sequoia 15.4, iOS 18.4, iPadOS
  18.4 y visionOS 2.4.
- Reportes de terceros: en iOS 18.4 un `<source>` Ogg se elige pero no carga
  ([codevise/pageflow#2238](https://github.com/codevise/pageflow/pull/2238)) y `MediaRecorder` con
  `audio/ogg;codecs=opus` falla ([frequal.com, 2025-05-18](https://frequal.com/java/OggOpusStillNotWorkingInSafari18_4.html)).
  No hablan de `decodeAudioData`. Sin verificar en un dispositivo.

**Conclusión:** Ogg Opus en Safari/iOS **no está garantizado**: oficialmente existe desde la 18.4,
con al menos un reporte de que falló en esa versión, y no hay evidencia de nada anterior. Por eso:

1. La capa pregunta `new Audio().canPlayType('audio/ogg; codecs=opus')`. Si devuelve cadena vacía,
   no descarga nada, la versión natural se considera no disponible y la interfaz no muestra la
   preferencia (no hay nada que elegir). Un falso negativo solo significa usar el sintetizado.
2. Si el navegador dice que sí pero `decodeAudioData` rechaza el archivo, es un fallo de carga
   (D4): se usa el sintetizado y se anota en la sesión.
3. **No hay segundo formato en la primera versión.** Un iPhone con iOS anterior a 18.4 (o donde
   18.4 falle) oye el sintetizado de siempre, que es el estado de hoy. No se pierde nada.

**Alternativa si Pablo ve que le importa (pregunta abierta): AAC en M4A**, generado en la
implementación con `ffmpeg` desde los WAV del kit, que Safari reproduce desde siempre. Estimación
por tasa de bits, no medida: AAC-LC a 96 kbps ≈ 12 KB/s (estéreo) → ≈ 6,7 MB para los cinco fondos
(≈ 559 s de audio), contra los 2,34 MiB de Opus; se descargaría solo uno por dispositivo. Costos:
otro juego de archivos, versionado y créditos; y el relleno del codificador AAC varía por
decodificador, lo que obliga a repetir la prueba de empalme (D5). No es gratis, por eso no entra
sin evidencia de que hace falta.

### D4. Carga, estado y respaldo

**Cuándo se descarga.** Cuando la persona tiene la preferencia en Natural, el navegador reproduce
Ogg Opus y el fondo elegido no es `silencio`: al abrir el inicio (fondo inicial) y cada vez que
elige otro fondo permitido por su nivel. Nunca se descargan los demás fondos ni se descarga con
Sintetizado. Los fondos con cuenta no se piden sin sesión porque la interfaz no los deja elegir.

**Cómo.** `fetch(url, { credentials: "omit" })`, con `AbortController` al cambiar de fondo
mientras baja otro. `credentials: "omit"` evita mandar la cookie de sesión de HomeSuite a una
solicitud que no la necesita: el servidor no puede vincular el fondo con una cuenta.

**Dónde se decodifica.** Con `new OfflineAudioContext(canales, 1, 48000).decodeAudioData(bytes)`,
no con el contexto del motor. Razón: el contexto real se crea en el clic (`ensureCtx()`, donde
también se pide `audioSession`, y la spec exige que eso pase dentro del gesto), pero la
decodificación es asíncrona y debe terminar *antes* del clic para no demorarlo. Un `AudioBuffer`
se puede reproducir en cualquier contexto de la página; si el contexto real corre a 44,1 kHz, el
`AudioBufferSourceNode` remuestrea (el kit está a 48 kHz; cómo suena el remuestreo en un dispositivo
de 44,1 kHz es parte de la prueba de oído).

**Estados por fondo** (en memoria de la página): `ausente → cargando → listo | fallido`.
Se conserva **un solo buffer decodificado**: al elegir otro fondo se suelta el anterior (los bytes
siguen en el caché HTTP del navegador, `immutable`, así que volver a elegirlo decodifica sin bajar de
nuevo). `fallido` se reintenta cuando la persona elige ese fondo otra vez.

**En el clic** (`Comenzar` o `Repetir sesión`):

1. Fondo `silencio`, preferencia Sintetizado, natural no disponible o estado `fallido`: arranca de inmediato
   como hoy (sintetizado, o silencio).
2. Estado `listo`: arranca natural, de forma síncrona.
3. Estado `cargando`: dentro del gesto se desbloquea el audio (`ensureCtx()` y `ctx.resume()`), el botón
   dice «Preparando el sonido…» y se espera hasta `ESPERA_MAXIMA_MS = 3000`. Si llegó, arranca natural; si no,
   arranca sintetizado y la descarga sigue para la próxima sesión. Un guardia evita que un doble toque
   inicie dos sesiones.

**Por qué 3 s.** Tiempos de descarga de los cinco archivos que se sirven (cálculo con la tasa nominal, sin
latencia): a 10 Mbit/s ninguno pasa de 1,1 s (`noche`, el mayor); a 1,6 Mbit/s («3G rápido») `fuego` 0,3 s,
`bosque` 1,1 s, `agua` 1,9 s, lluvia 2,6 s y `noche` 6,4 s; a 0,4 Mbit/s («3G lento») solo `fuego` llega en 3 s
(1,2 s), y `bosque` 4,2 s, `agua` 7,7 s, lluvia 10,4 s y `noche` 25,5 s no. Como la descarga empieza al elegir el
fondo y no al comenzar, el clic suele llegar con el archivo listo; en redes lentas cae al sintetizado y lo dice. El
valor es una constante; si Pablo prefiere esperar más, es una pregunta abierta.

**Respaldo.** Cualquier fallo (red, HTTP distinto de 200, tipo inesperado, `decodeAudioData` que
rechaza, tiempo agotado, API ausente) deja el fondo `fallido` y **la sesión suena sintetizada
completa**: nunca se mezcla ni se cambia a mitad de sesión. La pantalla de sesión muestra
«Fondo: lluvia · sintetizado» cuando la preferencia era Natural y se cayó al sintetizado; sin
alertas ni sonidos extra, para no interrumpir. En la consola se registra la causa.

### D5. Empalme del bucle

El kit dice que el empalme **no está garantizado**: comprobó duración y que no hay un salto de
amplitud extremo, no que no se oiga. Lo que sí se puede asegurar por construcción:

- El decodificador descarta el relleno inicial de Opus (campo `pre-skip` del encabezado), así que el
  buffer decodificado tiene la duración del original y `loop = true` repite por muestra, sin hueco.
  Lo que no se garantiza es que el final del archivo continúe suavemente en su principio: eso depende
  del material y de la codificación con pérdida.
- Dos modos por fondo (`cruceSegundos` en el manifiesto):
  - **`0` = bucle nativo:** un `AudioBufferSourceNode` con `loop = true`, `loopStart = 0`,
    `loopEnd = duración`, iniciado en un desplazamiento al azar (como `noise()` en el motor), para que
    el comienzo no sea siempre igual.
  - **`X > 0` = cruce de potencia constante** entre instancias del mismo buffer. Con paso `P = duración − X`,
    la instancia `i` empieza en `t0 + i·P` (la primera, en el desplazamiento `o`, con
    `0 ≤ o ≤ duración − 2X`), sube con `sin(π·x/2)` durante `X` segundos al entrar y baja con `cos(π·x/2)`
    durante `X` al salir, con `setValueCurveAtTime` sobre su propio `GainNode`. Se programan **todas las
    instancias al arrancar** hasta cubrir `D + 7 s` (`ceil((1807 s) / 83,6 s) = 22` para la lluvia en
    30 min; 11 para la noche con `X = 4 s`): no hay temporizadores, así que la pausa (`suspend`) no puede
    desfasarlas. Potencia constante porque los materiales son ruido sin correlación entre cola y cabeza.
- Todas las fuentes se detienen con `stop(t0 + D + 6,1 s)` y con `fadeOutSession`.

**Valores iniciales** (todos provisionales hasta la prueba de oído, D12): `agua`, `bosque` y `noche` están
publicados por sus autores como bucles continuos → `0`. `lluvia-alternativa` (una grabación de campo, no
declarada como bucle) → `4`. `fuego` (8,6 s, sin declaración) → `1,5`. Si la prueba de oído de un fondo con `0`
detecta el salto, se pasa a cruce con el menor `X` que lo esconda (rango útil 1–8 s), **sin alterar los
originales**, como pide el kit; se registra el valor y la fecha en el manifiesto.

**Repetición audible.** Un fondo corto repite su patrón: el fuego cada 8,6 s (≈ 210 veces en 30 min) y el bosque
cada 27 s. El cruce no lo arregla. Mitigaciones ordenadas por costo, a decidir con la prueba de 30 min:
aceptar; dos capas con desplazamiento y velocidad ligeramente distinta (±3 %), que alargan el período combinado;
sumar eventos sintetizados encima. Cada fondo tiene una marca `habilitado` en el manifiesto: si uno no pasa la
prueba, sale con el sintetizado y el resto sigue (ver Migration Plan).

### D6. Nivel entre fondos

Cada fondo trae `nivel` (ganancia lineal, 1 por defecto) aplicada en un `GainNode` entre la fuente y `session.amb`.
Calibración en tres pasos: (1) medir la sonoridad integrada (LUFS, `ffmpeg … ebur128`) de los cinco archivos y
del render sin conexión del fondo sintetizado equivalente (el E2E ya renderiza con `OfflineAudioContext`);
(2) fijar `nivel` para que los cinco naturales queden dentro de 1,5 LU entre sí y cerca del sintetizado;
(3) ajustar de oído, con los seis fondos seguidos, como en la ronda de gongs. Se registran las mediciones y la fecha.
El volumen elegido por la persona sigue aplicándose a `session.amb` con `(v/100)²`, igual para las dos versiones.

### D7. Preferencia «Natural / Sintetizado»

Dos botones segmentados («Natural», «Sintetizado») con `aria-pressed`, en la fila del rótulo «Fondo» (como «Probar gong» en
la del gong): **no suma una fila**, porque el E2E «caben en la ventana» exige 20 px de holgura en 390 × 720 y ya quedó ajustado
(task 11.9 de `remanso-meditacion`). Persistencia en `localStorage` (`remanso:sonido`, valores `natural` y `sintetizado`,
con `try/catch`; cualquier otro valor se ignora y vale Natural). Por defecto **Natural** (confirmación en las preguntas
abiertas). No se envía al servidor. Con fondo `silencio` o con natural no disponible, el control queda oculto o sin efecto y no
descarga nada. Es una preferencia del dispositivo, no del nivel: se aplica igual con y sin cuenta.

### D8. Entrega de los archivos

- `apps/app/public/remanso/audio/<fondo>.v1.opus` (`agua`, `lluvia`, `bosque`, `fuego`, `noche`): cinco archivos, 2 455 206 B
  (2,34 MiB). Contenido inmutable: cambiar un archivo es crear `v2` y quitar `v1`; una prueba exige que la carpeta y el
  manifiesto coincidan exactamente (sin huérfanos). La lluvia se llama `lluvia.v1.opus` aunque venga de `lluvia-alternativa`:
  el id del fondo es `lluvia`, el origen queda en el manifiesto.
- `public/_headers`: `/remanso/audio/*` con `Cache-Control: public, max-age=31536000, immutable` y `X-Content-Type-Options: nosniff`.
  Por defecto Workers Static Assets responde `max-age=0, must-revalidate` con ETag: una revalidación por reproducción.
- **`Content-Type`:** hay que verificar en `wrangler dev` y en staging qué tipo da `.opus` (la base `mime-db` lo asocia a
  `audio/ogg`). Si no es `audio/ogg`, se fija en `_headers`; si `_headers` no puede fijarlo, plan B de ADR-019 acotado a
  `/remanso/audio/*` (`run_worker_first` + `ASSETS.fetch`, una invocación por archivo). Queda como tarea con prueba E2E sobre servidor real.
- **CSP sin cambios.** `fetch` y medios del mismo origen caen en `default-src 'self'`; no hay `blob:` ni `data:` (se decodifica
  desde bytes en memoria). Una prueba de caracterización exige que `SECURITY_HEADERS` no cambie y el E2E registra
  `securitypolicyviolation` durante la reproducción natural. Solo un dominio de audio externo (R2 con dominio propio) obligaría a agregar
  `media-src`/`connect-src`; no se hace.
- Límites de Cloudflare (documentación consultada el 2026-11-02): 25 MiB por archivo y 20 000 archivos por versión en Free; el
  mayor aquí pesa 1,22 MiB. Las solicitudes a assets estáticos son gratuitas e ilimitadas. No hace falta R2.
- Sin Service Worker: no hay modo sin conexión; con la caché HTTP inmutable, un fondo ya descargado se reproduce sin bajarlo de nuevo.

### D9. Acceso y privacidad: lo que el servidor ve

- **Niveles sin cambios.** `REMANSO_ACCESO` no se toca: la versión natural está disponible en cada fondo que el nivel ya permite.
  Los archivos de lluvia, fuego y noche son estáticos y públicos; son CC0, así que no hay un valor que proteger y el nivel con cuenta
  sigue siendo un incentivo, no un control de seguridad (la ficha lo decía para este caso: «si incluyera contenido de valor real»; no lo es).
- **Cambia lo que se puede decir sobre privacidad.** Hasta hoy el servidor no veía nada del fondo. Ahora la solicitud del archivo
  (`/remanso/audio/lluvia.v1.opus`) **revela qué fondo se eligió**, aunque nunca lo ocurrido en la sesión (duración, estado de ánimo,
  gongs, pausa). Va sin cookies (`credentials: "omit"`), así que la app no puede vincularla a una cuenta, y no se guarda en ningún dato
  de HomeSuite; pero Cloudflare, como proveedor, registra solicitudes (dirección IP, agente) como con cualquier archivo. Por eso el texto
  «no enviamos ni guardamos … el sonido que escuchás» y el requisito «sin tráfico de datos» se reescriben (D11, D13).
- Con Sintetizado o con `silencio` no sale ninguna solicitud de audio.

### D10. Procedencia y créditos

- **Manifiesto** `apps/app/public/remanso/remanso-sonidos.js` (módulo ES; lo importan la capa, el servidor y las pruebas): por fondo
  `id`, `archivo`, `sha256`, `bytes`, `duracionSegundos`, `canales`, `cruceSegundos`, `nivel`, `habilitado`, y la procedencia (`titulo`,
  `autor`, `url`, `licencia`, `licenciaUrl`, `origenArchivo`).
- **Pruebas de integridad** (Vitest, sin `ffmpeg`): SHA-256 y bytes de cada archivo servido igual al manifiesto; duración y canales
  leídos del propio archivo (el `pre-skip` y los canales están en `OpusHead`; la duración, en la posición granular de la última página
  Ogg); decodificado estimado ≤ presupuesto; carpeta y manifiesto sin huérfanos.
- **Créditos**: `GET /remanso/creditos` en el Worker, con la misma cabecera de seguridad que `/remanso` y `page()`, generada del manifiesto
  (título, autor, enlace a Freesound, «CC0 1.0» con enlace). Enlaces con `rel="noopener noreferrer"`; son navegación, no recursos, así que
  la política no los afecta. Dice también que los archivos se convirtieron a Ogg Opus y que CC0 no certifica la ausencia de derechos de
  terceros (el kit lo advierte). Se enlaza desde el inicio de Remanso con un enlace discreto. CC0 no exige atribución; se mantiene por
  decisión de Pablo como buena práctica y para auditoría.
- **Repositorio**: `docs/diseno/remanso/audio/` guarda el `README.md` y el `manifest.json` del kit tal cual se recibieron (sin los `.opus`,
  que ya están en `public/`), siguiendo el precedente del paquete de diseño; `docs/productos/REMANSO.md` resume procedencia y reglas.
  *Desvío de «junto a los archivos»:* una nota o créditos dentro de `public/remanso/audio/` se serviría con caché inmutable de un año; el
  manifiesto sí está en `public/remanso/`, al lado de la carpeta de audio, y es la fuente de verdad.

### D11. Pruebas

| Riesgo | Evidencia |
|---|---|
| Reglas de la capa: elección natural/sintetizado, `silencio` a `super.start`, conexión a `session.amb`, `nivel`, `stop` en `fadeOutSession`, programación del bucle nativo y del cruce (tiempos, curvas con potencia constante, cantidad de instancias), pausa sin desfase | Vitest con contexto simulado (como `remanso-gongs.test.js`) y **sobre el motor real** (contrato) |
| Respaldo: red caída, HTTP 404/500, tipo inesperado, bytes corruptos, `decodeAudioData` que rechaza, tiempo agotado, sin `canPlayType`, sin `OfflineAudioContext`; un fallo no se cachea para siempre; nunca mezcla | Vitest con `fetch` y decodificador simulados |
| Preferencia: por defecto, valor inválido, sin `localStorage`, no se envía al servidor | Vitest + E2E |
| Integridad de archivos contra manifiesto, presupuesto de memoria, sin huérfanos, `_headers` con la regla | Vitest |
| Huella del motor | La prueba existente (`ENGINE_SHA256`) + una que verifica que importar la capa no modifica `RemansoEngine.prototype` + E2E que calcula la huella del `remanso-engine.js` servido |
| Créditos: ruta, enlaces, escape, cabeceras, sin cookie | Vitest con `app.request` |
| Cabeceras del audio (tipo, `immutable`, `nosniff`) y CSP sin violaciones durante la reproducción | Playwright sobre `wrangler dev` |
| El fondo natural suena | Playwright (Chromium y Firefox): la sesión crea una fuente con el buffer del fondo (duración y canales del manifiesto) conectada a `amb`; además se decodifica el archivo servido y se comprueba que no es silencio |
| Fallo de carga cae al sintetizado | Playwright con `page.route`: abortar, 404, bytes corruptos y respuesta lenta (> 3 s): la sesión empieza, usa el sintetizado y muestra «sintetizado» |
| Solo se baja el fondo elegido; con Sintetizado no se baja nada | Playwright: cuenta de solicitudes a `/remanso/audio/` |
| Preferencia recordada tras recargar y con `localStorage` bloqueado | Playwright |
| Nivel de acceso | Las pruebas existentes (opciones con cuenta explican y no suenan) siguen en verde |
| Diseño: inicio sin desplazamiento en 390 × 720 con la fila nueva, 360 px | El E2E «caben en la ventana» existente, con 20 px de holgura |

Se reescribe el escenario «la sesión comienza sin error y **sin descargar archivos de audio**» y el parche de `AudioContext` del
E2E. El sonido real, el oído, el iPhone y Safari quedan **sin verificar por automatización**: WebKit de Playwright en Linux se puede
usar como sonda informativa de si decodifica Ogg Opus, no como criterio.

### D12. Prueba de oído y verificación manual de Pablo

No hay criterio de oído automatizable; se define el procedimiento para que sea repetible (modelo: la ronda de gongs del 2026-10-26):

1. **Nivel:** con los niveles de D6 aplicados, escuchar los cinco fondos naturales seguidos y comparar con sus sintetizados a igual
   volumen del control. Anotar «más fuerte / más bajo / parejo» por fondo.
2. **Empalme (por archivo):** se arma, fuera del repositorio, un clip de 20 s que une los 10 s finales con los 10 s iniciales del archivo
   (`ffmpeg`, con auriculares y con altavoz). Aprobado si en 3 repeticiones seguidas no se oye clic, hueco ni cambio de timbre. Si falla,
   se pasa al cruce de D5 con la menor duración que lo esconda y se repite en la app.
3. **Repetición:** sesión de 30 min en `fuego` y `bosque` (los de bucle corto) y de 10 min en los demás; anotar si se nota un patrón.
4. **Conexión lenta:** DevTools «3G rápido» y «3G lento» con caché desactivada: el clic no se cuelga, aparece «Preparando el sonido…»
   no más de 3 s y cae al sintetizado con la indicación.
5. **iPhone** (alguien con uno): Ogg Opus carga o no; con el interruptor de silencio activado y desactivado; pantalla bloqueada; cambio de
   app; llamada entrante; pausa y reanudar; fundidos; los seis fondos seguidos; que la app no se recargue sola por memoria (con `noche` y
   lluvia, los más pesados). Registrar modelo y versión de iOS.
6. Navegador de escritorio con Firefox y Chromium en una sesión larga.

Los hallazgos van al backlog o ajustan `cruceSegundos`, `nivel` y `habilitado`.

### D13. Textos

- **Ficha de Remanso:** alcance (fondos naturales y sintetizados), preferencia, respaldo, archivos y presupuesto, créditos y que el límite
  de nivel libre sigue siendo un incentivo; riesgos no verificados actualizados.
- **Créditos:** la página de D10.
- **Texto legal que revisa Pablo** (privacidad y términos del sitio, otro despliegue; el redactor propone, Pablo decide):
  - `privacidad.html` (sección Remanso): hoy dice «El audio se genera en tu dispositivo. Hoy no enviamos ni guardamos en el servidor tu
    estado de ánimo, el historial de sesiones ni el sonido que escuchás». Con fondos naturales, el navegador descarga el archivo del
    fondo elegido; eso revela qué fondo se eligió a nuestros servidores y al proveedor de infraestructura (como cualquier solicitud), sin
    cookies de sesión y sin guardarlo en datos de HomeSuite. La preferencia «Natural / Sintetizado» se suma a la lista de preferencias
    locales de la sección «Cookies y almacenamiento local».
  - `terminos.html`: «audio generado en el dispositivo» pasa a «audio sintetizado en el dispositivo o grabado»; acreditar autoría y licencia
    CC0 con enlace a la página de créditos.
  - `remanso.html` (landing): «Todo el sonido se genera en tu dispositivo, sin descargas» deja de ser cierto.
  - Actualizar las fechas «Última actualización» solo si Pablo aprueba el texto.
  Hasta que Pablo revise y se despliegue el sitio, **la versión natural no se publica en producción** (tarea 9.6): las dos superficies no
  pueden contradecirse.
- **Glosario:** el concepto «sonido del fondo» (interfaz «Natural» y «Sintetizado», código `natural` y `sintetizado`, sin URL ni base).

## Risks / Trade-offs

- [Memoria en iPhone: ~34 MB decodificados más el pico de `decodeAudioData`, sin medir] → presupuesto de 40 MB comprobado por prueba, un solo
  buffer, sin la lluvia de 316 s; medición y prueba manual (D12.5); `habilitado: false` por fondo como salida.
- [Ogg Opus sin garantía en Safari/iOS] → `canPlayType`, rechazo de `decodeAudioData` y respaldo sintetizado; sin segundo formato por ahora (D3).
- [Empalme audible] → bucle nativo o cruce calibrado por fondo (D5), con procedimiento de oído y valores registrados.
- [Repetición del fuego (8,6 s) y del bosque (27 s)] → prueba de 30 min y mitigaciones en D5; `habilitado` por fondo.
- [Nivel parejo] → medición LUFS más oído (D6).
- [La capa depende de nombres internos del motor] → prueba de contrato sobre el motor real.
- [`Content-Type` o `Cache-Control` de `.opus` distinto del esperado] → verificación sobre servidor real y plan B acotado (D8).
- [Los textos legales quedan desfasados] → la versión natural no llega a producción sin que Pablo revise y se despliegue el sitio.
- [Primera reproducción en red lenta cae al sintetizado] → comportamiento aceptado y señalado en la sesión; la descarga continúa para la siguiente.
- [El archivo revela el fondo elegido] → sin cookies, solo el fondo (nunca la sesión), y dicho en los textos.
- [Un cambio de fondo sobre una sesión viva (`Repetir`) deja una fuente sonando] → `fadeOutSession` la detiene; prueba.

## Migration Plan

1. Implementar **después** de los changes de Cuentas Claras; antes, archivar `remanso-meditacion` (tarea 0.1). Rama `feature/remanso-sonidos`
   desde `main`. Cambio aditivo sin datos.
2. Pruebas locales y calibración con Pablo (oído, niveles, empalme) sin publicar. Si un fondo no pasa, entra con `habilitado: false`.
3. Con el OK de Pablo: `wrangler deploy --dry-run --env staging`, suites, staging, smoke del mismo SHA (cabeceras de los `.opus`, tipo,
   caché), prueba de Pablo en su teléfono y en un iPhone.
4. Textos legales: Pablo revisa; el sitio se despliega aparte. Producción de la app solo con ambas cosas listas y aprobación explícita.
5. *Rollback:* poner `habilitado: false` en un fondo (o en todos) sale con un despliegue y hace que se use el sintetizado; el SHA anterior
   también sirve. Los archivos son inmutables: nada que migrar. Las personas con la preferencia en Natural siguen sin errores porque el
   respaldo cubre el caso.

## Open Questions

1. **Lluvia: ¿87,6 s (decidido para v1) o 316 s?** Opciones: (i) la de 316 s con `<audio>` en streaming (`modo: "flujo"` por fondo), solo
   después de probar en un iPhone que el fundido y el volumen funcionan; (ii) recortarla a ~150 s y mono, 28,8 MB, con el cruce horneado
   (altera el original, hay que registrarlo); (iii) 316 s en escritorio y 87,6 s en móvil (dos rutas de código y dos archivos).
2. **¿Hace falta AAC/M4A para iPhones sin Ogg Opus?** Depende de cuántos usuarios estén en iOS < 18.4 y de qué pase con la 18.4 en un
   dispositivo real. Costo estimado: ~6,7 MB en el repo (cálculo por tasa de bits, sin medir) y otra ronda de empalme.
3. **Espera máxima antes de caer al sintetizado:** 3 s propuestos. ¿Preferís más (mejor en redes lentas, peor para quien quiere empezar)?
4. **¿Natural es el valor por defecto para todas las personas?** Se asumió que sí; es reversible con una constante.
5. **Créditos:** ¿página dentro de la app (`/remanso/creditos`, propuesta) o también en el sitio público? ¿Te sirve el registro en
   `docs/diseno/remanso/audio/` en lugar de «junto a los archivos»?
6. **Fuego y bosque:** si el bucle de 8,6 s y de 27 s se oye repetido en 30 min, ¿aceptar, dos capas con velocidad levemente distinta, o
   dejar ese fondo solo sintetizado?
7. **«Fundido al cambiar de fondo»:** en Remanso el fondo se elige antes de comenzar y no se cambia durante la sesión, así que no hay un
   cambio de fondo audible; el único caso es «Repetir sesión» sobre una sesión viva, que el motor ya funde en 0,5 s. Se interpretó así; si
   querías un fundido al elegir fondo (una vista previa), es una función nueva.
8. **Audio con la pantalla bloqueada y volumen en iOS:** igual que hoy, depende de la prueba en un iPhone; este cambio no lo mejora ni lo
   empeora por diseño, pero las grabaciones hacen más visible un corte.
9. **Gongs grabados y eventos sintetizados sobre la grabación:** fuera de alcance; quedan para después de la prueba de oído.
10. **Frecuencia de muestreo:** si el contexto de un dispositivo corre a 44,1 kHz, el remuestreo del buffer de 48 kHz puede notarse; se
    comprueba en la prueba de oído.
