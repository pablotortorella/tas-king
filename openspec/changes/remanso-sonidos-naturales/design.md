## Context

Estado observado en `main` (`51069f1`, 2026-11-02):

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
- `remanso-meditacion` **ya está archivado** (`openspec/changes/archive/2026-11-03-remanso-meditacion`): el requisito «Fondos sonoros»
  y los demás viven en `openspec/specs/remanso-sesion/spec.md`, así que los `MODIFIED` de este cambio tienen contra qué aplicarse.
- **Kit de Pablo** (verificado por SHA-256 contra su manifiesto, 2026-11-02): seis archivos Ogg
  Opus de 48 kHz, todos CC0 de Freesound. Prototipo de escucha de Pablo (fuera del repositorio, `remanso-audios/prueba-local`) con tres modos
  por fondo —bucle nativo, cruce y dos capas—; sus decisiones tras escuchar (2026-11-02) están en D5. Las fichas de Freesound de los seis se consultaron el
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
| `start(opts)` | Si hay un fondo natural listo (buffer decodificado, o elemento en flujo reproduciendo) y la preferencia es Natural: llama `super.start({ …opts, ambient: "silencio" })` y conecta la grabación a `this.session.amb`. Si no: `super.start(opts)` sin cambios. Anota en la sesión qué versión suena (`session.sonido = "natural" \| "sintetizado"`). |
| `fadeOutSession(s, secs)` | `super` y después detiene las fuentes naturales de esa sesión (y pausa y libera el elemento, si es un flujo) al terminar el fundido (cubre fin anticipado y «Repetir» sobre una sesión viva). |
| `pause()` / `resume()` | Fondos en buffer: sin cambios, las fuentes se programan con el reloj del `AudioContext`, que `suspend()` congela. Fondo en flujo: además de `super`, `element.pause()` y `element.play()` (D2.3). |
| `dispose()` | Sin cambios: `ctx.close()` libera fuentes y buffers de ese contexto; la capa suelta además su referencia al buffer y, si hay un elemento en flujo, lo pausa y le quita el `src`. |

Con fondo `silencio` el motor no sintetiza nada (`buildAmbient` no entra a ninguna rama), así
que la grabación suena sola bajo el mismo `amb`. La capa **depende de detalles del motor**
(`session.amb`, `session.t0`, `fadeOutSession`), igual que `gong()` depende hoy de
`this.gong(t, amp, dest, main)`: una prueba de contrato (D11) ejecuta la capa sobre el motor
real con un contexto simulado, y si un motor futuro cambia esos nombres, falla.

*Alternativas descartadas:* (a) editar el motor para aceptar un `buffer`: cambia la huella y
rompe «integrar tal cual»; (b) crear un `AudioContext` propio para el fondo: dos relojes, la
pausa no los congela juntos y se duplica la sesión de audio de iOS; (c) mezclar la grabación
con el sintetizado: se oyen las dos cosas.

### D2. Memoria: buffer para los fondos que entran, flujo para los que no

Un `AudioBuffer` guarda PCM Float32: `segundos × 48 000 × canales × 4 B`. Con los seis archivos del kit (la lluvia
principal de 316 s es la que se entrega; `lluvia-alternativa` queda fuera de la entrega por decisión de Pablo):

| Archivo | Duración | Canales | Opus (descarga) | Decodificado | Entra en 40 MB |
|---|---:|:---:|---:|---:|:---:|
| `agua` | 29,9 s | 2 | 0,37 MiB | 11,5 MB (11,0 MiB) | sí |
| `bosque` | 27,1 s | 2 | 0,20 MiB | 10,4 MB (9,9 MiB) | sí |
| `fuego` | 8,6 s | 2 | 0,06 MiB | 3,3 MB (3,1 MiB) | sí |
| `noche` | 177,6 s | 1 | 1,22 MiB | 34,1 MB (32,5 MiB) | sí |
| `lluvia` (316 s, Snoopy20111) | 316,0 s | 2 | 2,09 MiB | **121,3 MB (115,7 MiB)** (111,5 MB a 44,1 kHz) | **no** |

Cálculo, no medición: no se midió el pico real de `decodeAudioData` (que además tiene los bytes codificados y puede tener un
intermedio) ni el límite de memoria de Safari en iPhone, que Apple no publica. Se mide en la implementación (tarea 7.4). Un
celular de gama baja o un iPhone con poca memoria puede cerrar o recargar la pestaña mucho antes de los 121 MB que pide la
lluvia: el riesgo es real y por eso el presupuesto de 40 MB se mantiene.

**Problema.** Pablo decidió usar la lluvia larga (sin cruce, con empalme medido en 0) y esa sola pieza decodificada triplica el
presupuesto. Hay que reproducirla sin tenerla entera en memoria como PCM.

**Alternativas evaluadas**

| | Memoria (lluvia) | Qué se pierde o se arriesga | Veredicto |
|---|---|---|---|
| (a) Todo como `AudioBuffer` | 121,3 MB | Cuelgue o recarga de la pestaña en celulares; el pico de `decodeAudioData` puede ser mayor | Descartada |
| (b) Menor frecuencia de muestreo o mono | Estéreo 48 kHz 121,3 · 44,1 kHz 111,5 · 32 kHz 80,9 · 24 kHz 60,7 · 22,05 kHz 55,7 MB. Mono 48 kHz 60,7 · 32 kHz 40,4 · 24 kHz 30,3 · 22,05 kHz 27,9 MB | Para entrar en 40 MB hace falta mono a 31 kHz o menos, o estéreo a 15 kHz o menos: se pierde el estéreo, o la banda arriba de unos 12 kHz (el siseo de la lluvia). No es lo que Pablo escuchó y aprobó; habría que repetir la ronda de oído. Además el pico de la decodificación puede seguir siendo el del archivo completo (el remuestreo ocurre después de decodificar), sin verificar | Descartada como camino principal; queda como retirada si el flujo falla en iPhone (pregunta abierta 1) |
| (c) Recortar (p. ej. ~150 s en mono) | 28,8 MB | Altera el original y obliga a recalcular el empalme; contradice la decisión de Pablo | Descartada |
| (d) Partir en trozos de ~60-80 s y decodificar de a uno | ~25-30 MB | Nuevo proceso de generación de archivos, uniones entre trozos codificados por separado (Opus no empalma sin pérdida si se corta sin sobreposición), planificación de relevos y liberación de buffers: mucho más complejo que (e) | Descartada |
| (e) **Flujo: `<audio loop>` + `MediaElementAudioSourceNode`** | Acotada: el navegador descarga y decodifica en continuo, sin todo el PCM | Hueco en el `loop` del elemento (por navegador), efecto del nodo de ganancia sobre el elemento en iOS, pausa aparte, cookies (ver abajo) | **Recomendada solo para los fondos que no entran en el presupuesto** |

**Decisión: dos caminos según el tamaño, decididos por el manifiesto, no por el nombre del fondo.**

- **`modo: "buffer"`** (agua, bosque, fuego, noche): `AudioBufferSourceNode` sobre un `AudioBuffer` decodificado, como en los gongs y el
  sintetizado: el mismo grafo, bucle exacto por muestra, cruce y capas programados con el reloj del contexto, `suspend()` congela todo.
- **`modo: "flujo"`** (lluvia): `HTMLAudioElement` con `loop`, conectado con `createMediaElementSource` al mismo nodo de nivel y a `session.amb`.
  El fundido de 4 s, el de 6 s, el volumen y el silencio del fondo siguen siendo del motor (el elemento entra al grafo), y la memoria
  queda acotada por el navegador.
- **Regla:** un archivo es `flujo` si y solo si su tamaño decodificado supera `PRESUPUESTO_DECODIFICADO` (40 MB). Una prueba compara el `modo`
  del manifiesto con ese cálculo, para que nadie cargue por buffer un archivo que no entra ni mande a flujo uno que sí.
- **Pico de memoria de la sesión:** un solo fondo a la vez (D4). El mayor es `noche` en buffer (~34 MB, sin medir); la lluvia en flujo no
  decodifica el archivo completo (la cifra concreta es de la medición, 7.4). Es una cifra por debajo del presupuesto, no una garantía de que
  el iPhone la aguante: queda para la prueba manual.

**Riesgos del flujo y cómo se acotan**

1. **Hueco en el `loop` del elemento.** El bucle de un `<audio>` no tiene garantía de continuidad: hay reportes históricos de pequeños huecos
   en Chrome, Firefox y Safari (no se midieron los actuales). Aquí pesa poco: la lluvia es ruido sin silencios, el empalme del archivo medido por
   Pablo es 0, y el hueco, si existe, aparece una vez cada 316 s (≈ 5,7 veces en 30 min). No se hace cruce entre dos elementos (exigiría un
   temporizador impreciso y un segundo `play()` fuera del gesto en iOS). Criterio de verificación en D12, punto 2b: medida automática en
   Chromium y Firefox y escucha en celular.
2. **Nodo de ganancia sobre un elemento en iOS.** Hay reportes de WebKit y del foro de desarrolladores de Apple de ganancia sin efecto,
   degradación o crepitaciones al conectar un elemento al grafo, incluida una variante con `loop`
   ([151589](https://bugs.webkit.org/show_bug.cgi?id=151589), [180696](https://bugs.webkit.org/show_bug.cgi?id=180696),
   [foro 114772](https://developer.apple.com/forums/thread/114772)), de 2016 a 2022; el estado actual no está verificado. Si falla, fallan
   juntos el fundido, el volumen y el silencio del fondo, y no se puede detectar en ejecución. Por eso el criterio de la prueba en iPhone (D12.5)
   los comprueba uno por uno, y el resultado decide una constante (`FLUJO_EN_IOS`, ver Open Questions): si no pasa, en iOS la lluvia suena
   sintetizada y el resto no cambia.
3. **Pausa.** `ctx.suspend()` no detiene el elemento. La capa sobrescribe `pause()` y `resume()` para esos fondos: `element.pause()` y
   `element.play()` (este último dentro del clic de «Reanudar»), y el reloj de la sesión y los gongs siguen siendo los del motor.
4. **Inicio.** En iOS el elemento no precarga y `play()` debe ir dentro del gesto. Para un fondo `flujo` el elemento se crea en el clic
   (uno nuevo por sesión, porque `createMediaElementSource` solo se puede llamar una vez por elemento y contexto), con `src` hacia
   el archivo, sin `currentTime` (empieza en 0: evita la búsqueda en un Ogg y su ida y vuelta de solicitudes), `play()` dentro del
   gesto y el flujo de espera de D4 (hasta 3 s, «Preparando el sonido…»). El motor arranca cuando el elemento dice `playing`.
5. **`Range` en el servidor.** Safari exige respuestas 206 para reproducir un elemento. Los Workers Static Assets sirven el archivo desde
   Cloudflare, pero no se verificó que respondan `Accept-Ranges` y 206; es una prueba obligatoria (tarea 5.4: `curl -r 0-1023` contra
   `wrangler dev` y staging). Si no responde 206, el flujo no es viable y la lluvia suena sintetizada (mismo respaldo).
6. **Política de contenido.** Sin cambios: el elemento pide un archivo del mismo origen, que `default-src 'self'` cubre (sin `media-src`
   propio), no usa `blob:` ni `data:` y no hace falta `crossorigin`, porque un archivo del mismo origen no marca el audio como «tainted». Si alguna
   vez el audio pasara a otro origen sin CORS, el nodo entregaría silencio: otra razón para no moverlo (D8).
7. **Cookies.** Un `<audio>` no puede omitir credenciales de su propio origen (`crossorigin="anonymous"` las manda igual al mismo origen). La
   solicitud del flujo llevará la cookie de HomeSuite como cualquier otro archivo estático de la app, pero esos archivos los sirve el binding de
   assets sin pasar por el Worker (sin `run_worker_first`), así que la app no la lee ni la vincula al fondo. Se verifica en `wrangler.jsonc`
   y con una prueba; la afirmación «sin cookies» de la spec se limita a lo que la app puede garantizar (D9).
8. **Fallo del flujo** (`error`, `stalled`, `play()` rechazado, sin `playing` a los 3 s, sin `canPlayType`): respaldo sintetizado completo,
   como en D4. **Nunca** se cae a decodificar los 121 MB.

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
(≈ 559 s de audio), contra los 3,93 MiB de Opus; se descargaría solo uno por dispositivo. Costos:
otro juego de archivos, versionado y créditos; y el relleno del codificador AAC varía por
decodificador, lo que obliga a repetir la prueba de empalme (D5). No es gratis, por eso no entra
sin evidencia de que hace falta.

### D4. Carga, estado y respaldo

**Cuándo se descarga (fondos en buffer).** Cuando la persona tiene la preferencia en Natural, el navegador reproduce
Ogg Opus y el fondo elegido no es `silencio`: al abrir el inicio (fondo inicial) y cada vez que
elige otro fondo permitido por su nivel. Nunca se descargan los demás fondos ni se descarga con
Sintetizado. Los fondos con cuenta no se piden sin sesión porque la interfaz no los deja elegir.

**Fondos en flujo (lluvia).** No hay descarga ni decodificación previas al clic: el elemento se crea en el clic (D2.4) y el navegador
baja el archivo mientras suena. Por eso no tienen estado `listo` antes de comenzar; en el clic pasan directo al flujo de espera de abajo
(paso 3), con el mismo tope de 3 s. Cambiar de fondo antes de comenzar no tiene nada que soltar.

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
4. Fondo en flujo (lluvia, con el flujo habilitado en esa plataforma): dentro del gesto se desbloquea el audio, se crea el elemento y se
   llama `play()`, el botón dice «Preparando el sonido…» y se espera `playing` hasta `ESPERA_MAXIMA_MS`. Si llegó, el motor arranca con
   `silencio` y el elemento entra a `amb`; si no (o si falla), se cierra el elemento y arranca sintetizado.

**Por qué 3 s.** Tiempos de descarga completa de los cuatro archivos en buffer (cálculo con la tasa nominal, sin
latencia): a 10 Mbit/s ninguno pasa de 1,1 s (`noche`, el mayor); a 1,6 Mbit/s («3G rápido») `fuego` 0,3 s,
`bosque` 1,1 s, `agua` 1,9 s y `noche` 6,4 s; a 0,4 Mbit/s («3G lento») solo `fuego` llega en 3 s
(1,2 s), y `bosque` 4,2 s, `agua` 7,7 s y `noche` 25,5 s no. La lluvia en flujo no necesita bajar sus 2,09 MiB
(10,9 s a 1,6 Mbit/s y 43 s a 0,4 Mbit/s) para empezar: solo el comienzo del archivo; su flujo de 64 kbps cabe incluso en 3G lento. Como en los fondos en buffer la descarga empieza al elegir el
fondo y no al comenzar, el clic suele llegar con el archivo listo; en redes lentas cae al sintetizado y lo dice. El
valor es una constante; si Pablo prefiere esperar más, es una pregunta abierta.

**Respaldo.** Cualquier fallo (red, HTTP distinto de 200 —o de 206 en el flujo—, tipo inesperado, `decodeAudioData` que
rechaza, tiempo agotado, API ausente) deja el fondo `fallido` y **la sesión suena sintetizada
completa**: nunca se mezcla ni se cambia a mitad de sesión. La pantalla de sesión muestra
«Fondo: lluvia · sintetizado» cuando la preferencia era Natural y se cayó al sintetizado; sin
alertas ni sonidos extra, para no interrumpir. En la consola se registra la causa.

### D5. Empalme y repetición: tres modos por fondo

El kit dice que el empalme **no está garantizado**: comprobó duración y que no hay un salto de amplitud extremo, no que no se oiga. Lo que sí
se puede asegurar por construcción: el decodificador descarta el relleno inicial de Opus (campo `pre-skip` del encabezado), así que el buffer
decodificado tiene la duración del original y `loop = true` repite por muestra, sin hueco. Lo que no se garantiza es que el final del archivo
continúe suavemente en su principio: eso depende del material y de la codificación con pérdida.

Pablo escuchó un prototipo con tres modos por fondo (fuera del repositorio, `remanso-audios/prueba-local/app.js`) y decidió el 2026-11-02. El
manifiesto fija el modo de cada fondo con `modo` (`buffer` o `flujo`, D2), `cruceSegundos` y, si corresponde, `capas`:

| Fondo | Modo de reproducción | Empalme / repetición | Decisión de Pablo (2026-11-02) |
|---|---|---|---|
| `agua` (30 s) | buffer | `cruceSegundos: 0` (bucle nativo) | Sin cruce: con cruce sonaba peor |
| `lluvia` (316 s) | **flujo** | `cruceSegundos: 0`: `loop` del elemento | La larga (`lluvia.opus`, Snoopy20111), sin cruce; empalme del archivo medido en 0. Reemplaza a la de 87,6 s (`lluvia-alternativa` queda fuera de la entrega) |
| `noche` (178 s) | buffer | `cruceSegundos: 4` | Cruce de 4 s |
| `bosque` (27 s) | buffer | `capas: { tasa: 0,94; desfaseSegundos: 9,0; relativo: 0,7; paneo: 0,25 }`, `cruceSegundos: 0` | Dos capas con los valores por defecto del prototipo |
| `fuego` (8,6 s) | buffer | `capas: { tasa: 0,94; desfaseSegundos: 2,9; relativo: 0,7; paneo: 0,25 }`, `cruceSegundos: 0` | Dos capas con los valores por defecto del prototipo |

**Modo bucle nativo (`cruceSegundos: 0`, sin `capas`).** Buffer: un `AudioBufferSourceNode` con `loop = true`, `loopStart = 0`,
`loopEnd = duración`, iniciado en un desplazamiento al azar (como `noise()` en el motor), para que el comienzo no sea siempre igual. Flujo: el
`loop` del elemento, desde 0 (D2.4); su hueco, si lo hay, se mide (D12.2).

**Modo cruce (`cruceSegundos: X > 0`, solo en buffer).** Cruce de potencia constante entre instancias del mismo buffer, como el del prototipo
(dos `AudioBufferSourceNode` superpuestos con `sin(π·x/2)` al entrar y `cos(π·x/2)` al salir). Con paso `P = duración − X`, la instancia `i`
empieza en `t0 + i·P` (la primera, en el desplazamiento `o`, con `0 ≤ o ≤ duración − 2X`), sube durante `X` segundos al entrar y baja durante
`X` al salir, con `setValueCurveAtTime` sobre su propio `GainNode`. Se programan **todas las instancias al arrancar** hasta cubrir `D + 7 s`
(`ceil(1807 s / 173,6 s) = 11` para `noche` con `X = 4 s` en 30 min): no hay temporizadores, así que la pausa (`suspend`) no puede desfasarlas.
Potencia constante porque los materiales son ruido sin correlación entre cola y cabeza.

**Modo dos capas (`capas`, solo en buffer).** El mismo buffer suena dos veces a la vez, cada una con su `loop` nativo (`loopStart = 0`,
`loopEnd = duración`), para que el patrón de un fondo corto deje de repetirse idéntico:

| | Capa 1 | Capa 2 |
|---|---|---|
| Velocidad (`playbackRate`) | 1,00 | `tasa` = 0,94 (≈ −1,07 semitonos) |
| Posición de inicio | `o` al azar | `(o + desfaseSegundos) mod duración`, con `desfaseSegundos ≈ duración / 3` (bosque 9,0 s; fuego 2,9 s) |
| Paneo (`StereoPannerNode`) | `−paneo` (−0,25) | `+paneo` (+0,25) |
| Ganancia | 0,75 | `0,75 · relativo` = 0,525 (`relativo` = 0,7) |

Ambas cuelgan del nodo de nivel del fondo (D6) y de `session.amb`. Como la capa 2 va más lenta, se atrasa 0,06 s por segundo respecto de la
primera y las posiciones de las dos solo vuelven a coincidir cada `duración / (1 − tasa)`: bosque ≈ 451 s (la primera vez a los
`desfase / 0,06` ≈ 150 s) y fuego ≈ 143 s (≈ 48 s la primera), contra 27 s y 8,6 s del bucle simple. Es un cálculo del propio prototipo; la
coincidencia es de posición, no de sonido (la capa 2 suena más grave). Las dos fuentes se programan al arrancar con el reloj del contexto, como
el resto: `suspend()` las congela juntas. Costo: dos fuentes y dos paneadores por sesión, sin memoria extra (un solo buffer).

Todas las fuentes de buffer se detienen con `stop(t0 + D + 6,1 s)` y con `fadeOutSession`.

**Si la prueba de oído cambia un valor** (D12), se ajusta el manifiesto y se registra el valor y la fecha, **sin alterar los originales**,
como pide el kit. Un fondo con `cruceSegundos: 0` que muestre el salto pasa a cruce con el menor `X` que lo esconda (rango útil 1-8 s). El
prototipo ofrece las tres variantes por fondo; el resto de los valores del prototipo (cruce del fuego, de la lluvia) quedan descartados
por la decisión.

**Repetición audible.** Bosque y fuego repetían su patrón cada 27 s y 8,6 s (≈ 210 veces el fuego en 30 min). Las dos capas es la
mitigación elegida; la prueba de 30 min (D12.3) confirma si alcanza. Cada fondo tiene una marca `habilitado` en el manifiesto: si uno no pasa la
prueba, sale con el sintetizado y el resto sigue (ver Migration Plan).

### D6. Nivel entre fondos

Cada fondo trae `nivel` (ganancia lineal, 1 por defecto, puede ser mayor que 1) aplicada en un `GainNode` entre la fuente y `session.amb`; en dos capas,
la suma de las capas pasa por ese mismo nodo, así que la calibración mide la mezcla final y no el archivo solo. Calibración en tres pasos:
(1) medir la sonoridad integrada (LUFS, `ffmpeg … ebur128`) de los cinco archivos y del render sin conexión del fondo sintetizado equivalente
(el E2E ya renderiza con `OfflineAudioContext`); (2) fijar `nivel` para que los cinco naturales queden dentro de 1,5 LU entre sí y cerca del
sintetizado; (3) ajustar de oído, con los seis fondos seguidos, como en la ronda de gongs. Se registran las mediciones y la fecha.

**Bosque necesita igualar sonoridad sí o sí.** El prototipo midió el archivo a RMS ≈ −22 dBFS, **unos 20 dB más fuerte que los demás**, con un
pico de 1,06 (pasa 0 dBFS); los demás están entre ≈ −40 y −47 dBFS. El prototipo trae «Igualar sonoridad» (RMS objetivo −32 dBFS), que baja el
bosque ≈ 10 dB y sube los demás: su cálculo (`nivel = 10^((−32 − RMS)/20)`) es el valor inicial de `nivel` de cada fondo, y el paso (1) lo reemplaza
por la medición en LUFS. Sin esto, el bosque suena mucho más fuerte que todos los otros fondos y que su equivalente sintetizado.

El volumen elegido por la persona sigue aplicándose a `session.amb` con `(v/100)²`, igual para las dos versiones.

### D7. Preferencia «Natural / Sintetizado»

Dos botones segmentados («Natural», «Sintetizado») con `aria-pressed`, en la fila del rótulo «Fondo» (como «Probar gong» en
la del gong): **no suma una fila**, porque el E2E «caben en la ventana» exige 20 px de holgura en 390 × 720 y ya quedó ajustado
(task 11.9 de `remanso-meditacion`). Persistencia en `localStorage` (`remanso:sonido`, valores `natural` y `sintetizado`,
con `try/catch`; cualquier otro valor se ignora y vale Natural). Por defecto **Natural** (confirmación en las preguntas
abiertas). No se envía al servidor. Con fondo `silencio` o con natural no disponible, el control queda oculto o sin efecto y no
descarga nada. Es una preferencia del dispositivo, no del nivel: se aplica igual con y sin cuenta.

### D8. Entrega de los archivos

- `apps/app/public/remanso/audio/<fondo>.v1.opus` (`agua`, `lluvia`, `bosque`, `fuego`, `noche`): cinco archivos, **4 123 752 B
  (3,93 MiB)** en total: `agua` 387 025 B, `lluvia` 2 188 261 B, `bosque` 211 291 B, `fuego` 61 076 B y `noche` 1 276 099 B. Se
  descarga uno por sesión: el mayor es la lluvia con 2,09 MiB (antes, con la lluvia de 87,6 s, el mayor era `noche` con 1,22 MiB y el
  total 2,34 MiB). `public/` pasa de unos 120 KB a unos 4,0 MiB. Contenido inmutable: cambiar un archivo es crear `v2` y quitar `v1`; una prueba exige que la carpeta y el
  manifiesto coincidan exactamente (sin huérfanos). El archivo de `lluvia` es la grabación principal
  del kit (`lluvia.opus`, 316 s, Snoopy20111); `lluvia-alternativa` (87,6 s, myLoop) **no se copia ni se acredita**.
- `public/_headers`: `/remanso/audio/*` con `Cache-Control: public, max-age=31536000, immutable` y `X-Content-Type-Options: nosniff`.
  Por defecto Workers Static Assets responde `max-age=0, must-revalidate` con ETag: una revalidación por reproducción.
- **`Content-Type`:** hay que verificar en `wrangler dev` y en staging qué tipo da `.opus` (la base `mime-db` lo asocia a
  `audio/ogg`). Si no es `audio/ogg`, se fija en `_headers`; si `_headers` no puede fijarlo, plan B de ADR-019 acotado a
  `/remanso/audio/*` (`run_worker_first` + `ASSETS.fetch`, una invocación por archivo). Queda como tarea con prueba E2E sobre servidor real.
  Con el flujo de la lluvia hay una segunda verificación: el archivo debe responder `Accept-Ranges: bytes` y 206 a un pedido con `Range` (Safari no
  reproduce un elemento sin eso); si el plan B se activa, `ASSETS.fetch` debe reenviar `Range` y el Worker no leer la cookie.
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
  gongs, pausa). Los fondos en buffer se piden con `fetch` sin cookies (`credentials: "omit"`). El flujo de la lluvia lo pide un `<audio>`, que no puede
  omitir credenciales del mismo origen: la cookie de HomeSuite viaja, como viaja con cada archivo estático de la app, pero el binding de assets
  responde sin invocar al Worker, así que la app no la lee ni la vincula a una cuenta, y no se guarda en ningún dato
  de HomeSuite (se prueba: sin `run_worker_first` en `wrangler.jsonc`, sin `Set-Cookie` en la respuesta); pero Cloudflare, como proveedor, registra solicitudes (dirección IP, agente) como con cualquier archivo. Por eso el texto
  «no enviamos ni guardamos … el sonido que escuchás» y el requisito «sin tráfico de datos» se reescriben (D11, D13).
- Con Sintetizado o con `silencio` no sale ninguna solicitud de audio.

### D10. Procedencia y créditos

- **Manifiesto** `apps/app/public/remanso/remanso-sonidos.js` (módulo ES; lo importan la capa, el servidor y las pruebas): por fondo
  `id`, `archivo`, `sha256`, `bytes`, `duracionSegundos`, `canales`, `modo` (`buffer` o `flujo`), `cruceSegundos`, `capas` (opcional: `tasa`,
  `desfaseSegundos`, `relativo`, `paneo`), `nivel`, `habilitado`, y la procedencia (`titulo`,
  `autor`, `url`, `licencia`, `licenciaUrl`, `origenArchivo`).
- **Pruebas de integridad** (Vitest, sin `ffmpeg`): SHA-256 y bytes de cada archivo servido igual al manifiesto; duración y canales
  leídos del propio archivo (el `pre-skip` y los canales están en `OpusHead`; la duración, en la posición granular de la última página
  Ogg); decodificado estimado ≤ presupuesto para los `buffer` y `modo: "flujo"` si y solo si lo supera; `cruceSegundos > 0` y `capas` solo en `buffer`; carpeta y manifiesto sin huérfanos.
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
| Reglas de la capa: elección natural/sintetizado, `silencio` a `super.start`, conexión a `session.amb`, `nivel`, `stop` en `fadeOutSession`, programación del bucle nativo, del cruce (tiempos, curvas con potencia constante, cantidad de instancias) y de las dos capas (tasa, desfase, paneo, ganancias 0,75 y 0,525, un solo buffer), pausa sin desfase | Vitest con contexto simulado (como `remanso-gongs.test.js`) y **sobre el motor real** (contrato) |
| Respaldo: red caída, HTTP 404/500, tipo inesperado, bytes corruptos, `decodeAudioData` que rechaza, tiempo agotado, sin `canPlayType`, sin `OfflineAudioContext`; un fallo no se cachea para siempre; nunca mezcla | Vitest con `fetch` y decodificador simulados |
| Flujo de la lluvia: elemento nuevo por sesión, `createMediaElementSource` a `amb` por el nodo de nivel, `loop`, sin `currentTime`, `pause()`/`resume()` sobre el elemento, liberación en `fadeOutSession`/`dispose`, sin `playing` a los 3 s o `error` → sintetizado; nunca decodifica el archivo entero | Vitest con elemento y contexto simulados y sobre el motor real |
| Hueco del `loop` del elemento | Playwright en Chromium y Firefox: se mide el tramo continuo de silencio digital en el empalme (D12.2) |
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
2. **Empalme de los fondos en buffer (agua, noche, bosque, fuego):** se arma, fuera del repositorio, un clip de 20 s que une los 10 s finales
   con los 10 s iniciales del archivo (`ffmpeg`, con auriculares y con altavoz). Aprobado si en 3 repeticiones seguidas no se oye clic, hueco ni
   cambio de timbre. Si falla, se pasa al cruce de D5 con la menor duración que lo esconda y se repite en la app (en `noche` se confirma el
   cruce de 4 s; en `agua` que sin cruce suena bien).
   2b. **Empalme del flujo (lluvia), el criterio que decide si el `loop` del elemento alcanza.**
   - *Medida automática (Chromium y Firefox, E2E):* se reproduce el elemento como en la app, conectado a un nodo que registra las muestras, se lo
     lleva a 3 s del final (`currentTime = duración − 3`) y se registran 8 s alrededor del empalme. Aprobado si el tramo continuo de silencio
     digital (|x| < 1e-4) es menor que 20 ms y no hay salto de nivel de más de 6 dB entre los 500 ms anteriores y los posteriores. Se registra el
     valor medido (el proyecto no tiene medición previa del hueco).
   - *Escucha en celular (Android y iPhone):* sesión de 20 min con lluvia, con auriculares, atento a los empalmes (5:16, 10:32 y 15:48). Aprobado
     si no se oye hueco, clic ni salto de volumen en ninguno de los tres.
   - Si falla en una plataforma, esa plataforma usa la lluvia sintetizada (constante por plataforma, Open Question 1); si falla en todas, se
     reabre la decisión de D2 con las alternativas (b) y (d).
3. **Repetición:** sesión de 30 min en `fuego` y `bosque` (las dos capas; antes, los de bucle corto) y de 10 min en los demás; anotar si se nota un
   patrón. Ajustar `tasa`, `desfaseSegundos`, `relativo` y `paneo` si hace falta.
4. **Conexión lenta:** DevTools «3G rápido» y «3G lento» con caché desactivada: el clic no se cuelga, aparece «Preparando el sonido…»
   no más de 3 s y cae al sintetizado con la indicación.
5. **iPhone** (alguien con uno): Ogg Opus carga o no; con el interruptor de silencio activado y desactivado; pantalla bloqueada; cambio de
   app; llamada entrante; pausa y reanudar; fundidos; los seis fondos seguidos; que la app no se recargue sola por memoria (con `noche` y
   lluvia, los más pesados). Para el flujo de la lluvia, además, y cada uno por separado (porque un nodo de ganancia sin efecto sobre el
   elemento falla de manera distinta en cada uno): (i) la lluvia empieza a sonar dentro de los 3 s del toque; (ii) el fundido de entrada de 4 s
   es audible; (iii) el control de volumen sube y baja el nivel; (iv) «silenciar fondo» la calla y al volver suena; (v) «pausa» la detiene y
   «reanudar» continúa sin perder el reloj; (vi) el fundido final de 6 s; (vii) sin crepitaciones; (viii) el empalme de 2b; (ix) sesión de 30 min
   sin recarga de la pestaña. Registrar modelo y versión de iOS. Un solo punto fallido pone `FLUJO_EN_IOS = false`.
6. Navegador de escritorio con Firefox y Chromium en una sesión larga.

Los hallazgos van al backlog o ajustan `cruceSegundos`, `capas`, `nivel`, `habilitado` y `FLUJO_EN_IOS`.

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
  buffer, y la lluvia de 316 s (121 MB) en flujo, sin decodificarla entera (D2); medición y prueba manual (D12.5); `habilitado: false` por fondo como salida.
- [El flujo de la lluvia falla en iPhone: ganancia sin efecto sobre el elemento, crepitaciones, hueco en el `loop`, sin 206] → respaldo sintetizado
  si no arranca, `FLUJO_EN_IOS` si la prueba lo desaconseja, prueba punto por punto en iPhone (D12.5) y medida del hueco (D12.2b); nunca se cae a
  decodificar el archivo entero.
- [Hueco en el `loop` del elemento en otros navegadores] → medida automática en Chromium y Firefox y escucha de 20 min en celular (D12.2b); el
  material es ruido continuo y el empalme del archivo es 0.
- [Ogg Opus sin garantía en Safari/iOS] → `canPlayType`, rechazo de `decodeAudioData` y respaldo sintetizado; sin segundo formato por ahora (D3).
- [Empalme audible] → bucle nativo, cruce (`noche`) o dos capas (`bosque`, `fuego`) fijados por fondo (D5), con procedimiento de oído y valores registrados.
- [Repetición del fuego (8,6 s) y del bosque (27 s)] → dos capas (D5), prueba de 30 min; `habilitado` por fondo.
- [Nivel parejo] → medición LUFS más oído (D6).
- [La capa depende de nombres internos del motor] → prueba de contrato sobre el motor real.
- [`Content-Type` o `Cache-Control` de `.opus` distinto del esperado] → verificación sobre servidor real y plan B acotado (D8).
- [Los textos legales quedan desfasados] → la versión natural no llega a producción sin que Pablo revise y se despliegue el sitio.
- [Primera reproducción en red lenta cae al sintetizado] → comportamiento aceptado y señalado en la sesión; la descarga continúa para la siguiente.
- [El archivo revela el fondo elegido] → el Worker no ve la solicitud ni la cookie, solo el fondo (nunca la sesión), y dicho en los textos.
- [Un cambio de fondo sobre una sesión viva (`Repetir`) deja una fuente sonando] → `fadeOutSession` la detiene; prueba.

## Migration Plan

1. Implementar **después** de los changes de Cuentas Claras (`remanso-meditacion` ya está archivado). Rama `feature/remanso-sonidos`
   desde `main`. Cambio aditivo sin datos.
2. Pruebas locales y calibración con Pablo (oído, niveles, empalme) sin publicar. Si un fondo no pasa, entra con `habilitado: false`.
3. Con el OK de Pablo: `wrangler deploy --dry-run --env staging`, suites, staging, smoke del mismo SHA (cabeceras de los `.opus`, tipo,
   caché), prueba de Pablo en su teléfono y en un iPhone.
4. Textos legales: Pablo revisa; el sitio se despliega aparte. Producción de la app solo con ambas cosas listas y aprobación explícita.
5. *Rollback:* poner `habilitado: false` en un fondo (o en todos) sale con un despliegue y hace que se use el sintetizado; el SHA anterior
   también sirve. Los archivos son inmutables: nada que migrar. Las personas con la preferencia en Natural siguen sin errores porque el
   respaldo cubre el caso.

## Open Questions

Decisiones de Pablo del 2026-11-02 que cierran preguntas anteriores (ya no son preguntas): lluvia larga de 316 s sin cruce (se descarta la de 87,6 s);
Natural por defecto para todas las personas; bosque y fuego con dos capas; agua sin cruce; noche con cruce de 4 s.

1. **¿El flujo de la lluvia funciona en iPhone y en los navegadores móviles?** Es lo único que no se puede decidir sin un dispositivo: si la
   ganancia (fundido, volumen, silencio) tiene efecto sobre el elemento, si el `loop` no deja un hueco audible y si el servidor responde 206.
   *Prueba que lo cierra:* la lista D12.5 (i-ix) en un iPhone con iOS 18.4 o posterior y la escucha de 20 min (D12.2b) en un Android, ambas
   contra staging, más la medida automática en Chromium y Firefox y `curl -r 0-1023` sobre el `.opus` (tarea 5.4). *Resultado según el caso:* si
   pasa, la lluvia natural suena por flujo en todas las plataformas; si falla solo en iOS, `FLUJO_EN_IOS = false` y en iPhone la lluvia suena
   sintetizada (los demás fondos naturales no se ven afectados); si falla también en Android o en escritorio, se reabre D2 con las
   alternativas (b) mono o 24 kHz (con nueva ronda de oído) y (d). Hasta tener ese resultado, la implementación arranca con el flujo
   activado y no se publica en producción (tarea 9.6).
2. **¿Hace falta AAC/M4A para iPhones sin Ogg Opus?** Depende de cuántos usuarios estén en iOS < 18.4 y de qué pase con la 18.4 en un
   dispositivo real. Costo estimado: ~6,7 MB en el repo (cálculo por tasa de bits, sin medir) y otra ronda de empalme.
3. **Espera máxima antes de caer al sintetizado:** 3 s propuestos. ¿Preferís más (mejor en redes lentas, peor para quien quiere empezar)?
4. **Créditos:** ¿página dentro de la app (`/remanso/creditos`, propuesta) o también en el sitio público? ¿Te sirve el registro en
   `docs/diseno/remanso/audio/` en lugar de «junto a los archivos»?
5. **«Fundido al cambiar de fondo»:** en Remanso el fondo se elige antes de comenzar y no se cambia durante la sesión, así que no hay un
   cambio de fondo audible; el único caso es «Repetir sesión» sobre una sesión viva, que el motor ya funde en 0,5 s. Se interpretó así; si
   querías un fundido al elegir fondo (una vista previa), es una función nueva.
6. **Audio con la pantalla bloqueada y volumen en iOS:** igual que hoy, depende de la prueba en un iPhone; este cambio no lo mejora ni lo
   empeora por diseño, pero las grabaciones hacen más visible un corte.
7. **Gongs grabados y eventos sintetizados sobre la grabación:** fuera de alcance; quedan para después de la prueba de oído.
8. **Frecuencia de muestreo:** si el contexto de un dispositivo corre a 44,1 kHz, el remuestreo del buffer de 48 kHz puede notarse; se
   comprueba en la prueba de oído.
9. **Sonido de mar (olas en la orilla):** el sintetizado de «agua» sonaba a mar y la versión natural es un arroyo; queda en el backlog hasta que
   Pablo consiga una grabación real de olas en la orilla con licencia compatible. No es parte de este cambio.
