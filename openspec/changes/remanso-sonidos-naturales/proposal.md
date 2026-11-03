## Why

Los fondos de Remanso se sintetizan en el dispositivo y suenan menos reales que una
grabación. Pablo reunió un kit de audio (seis archivos Ogg Opus de 48 kHz, todos CC0 de
Freesound, 4,4 MiB en total) y decidió el 2026-11-02, tras escuchar un prototipo, que los
cinco fondos con sonido (agua, lluvia, bosque, fuego y noche) tengan una versión **natural**,
**por defecto y para todas las personas**, **conviviendo** con la sintetizada: una preferencia
«Natural / Sintetizado» por dispositivo y, si la grabación no carga o no se puede reproducir,
el sintetizado de siempre. Los gongs siguen sintetizados.

Esto cambia tres cosas que hoy están escritas como invariantes: el requisito «Fondos
sonoros» (dice «sin descargar audio»), el non-goal «Grabaciones de audio» de
`remanso-meditacion` y los textos públicos («audio generado en tu dispositivo», «sin
descargas»). También abre dos riesgos técnicos que este cambio resuelve con números: la
memoria al decodificar (la lluvia larga de 316 s, que Pablo eligió, son unos 121 MB de PCM, tres veces el
presupuesto de 40 MB) y la compatibilidad de Ogg Opus en Safari e iPhone.

## What Changes

- **Capa nueva `remanso-fondos.js`**, al estilo de `remanso-gongs.js`: una subclase que
  decide en el clic si el fondo suena natural o sintetizado y, si es natural, arranca el
  motor con fondo `silencio` y conecta la grabación al nodo `session.amb` que el motor ya
  crea. Hereda gratis el fundido de 4 s, el de 6 s, el volumen, el silencio del fondo, la
  pausa y el cierre. **El motor no se edita** y su huella SHA-256 sigue fijada.
- **Dos caminos de reproducción según el tamaño decodificado** (presupuesto de 40 MB por fondo, decidido por el manifiesto):
  - **Buffer** (agua, bosque, fuego y noche, de 3 a 34 MB decodificados): `AudioBufferSourceNode`, como los gongs.
  - **Flujo** (la lluvia de 316 s, 121 MB): `<audio loop>` conectado al mismo grafo con `MediaElementAudioSourceNode`; la memoria queda
    acotada por el navegador y el empalme medido de ese archivo es 0, así que no necesita cruce. Si el flujo no arranca, suena el
    sintetizado; **nunca** se decodifica entera. Alternativas (mono o menor frecuencia, recortar, partir en trozos) y sus riesgos en
    `design.md` (D2); lo que solo se cierra con un iPhone, en la pregunta abierta 1.
- **Empalme y repetición por fondo, según lo que Pablo decidió al escuchar el prototipo:**
  `lluvia` (larga) y `agua` sin cruce; `noche` con cruce de 4 s; `bosque` y `fuego` con **dos capas** (el mismo buffer, una a velocidad
  normal y otra a 0,94, desfasada un tercio de la duración, con paneo opuesto de 0,25 y volumen 0,7 la segunda), para que el patrón corto deje de
  repetirse. `bosque` además se **iguala en sonoridad** (≈ 20 dB más fuerte que los demás, `design.md` D6).
- **Preferencia «Natural / Sintetizado»** por dispositivo (`localStorage`), **Natural por defecto** (decidido), en la fila del rótulo «Fondo». Sin cuenta o con cuenta, cada fondo mantiene el
  nivel de acceso que ya tiene: **los niveles no cambian**.
- **Respaldo automático** al sintetizado si el navegador no reproduce Ogg Opus, si la
  descarga falla o tarda más de 3 s, si el archivo no se decodifica o si el flujo no arranca. La sesión indica
  «sintetizado» cuando eso ocurre.
- **Carga solo del fondo elegido** (los de buffer, sin cookies; la lluvia, en flujo desde que se comienza), desde archivos estáticos con nombre
  versionado, `Content-Type: audio/ogg` y caché `immutable` por `_headers`. La política de
  contenido **no cambia** (`default-src 'self'` ya cubre `fetch` y medios del mismo origen).
- **Procedencia y créditos:** manifiesto con autor, título, enlace, licencia y SHA-256 por
  archivo, página `/remanso/creditos` generada de ese manifiesto y registro en el repositorio.
- **Textos:** ficha de Remanso, créditos y revisión de lo que dicen privacidad, términos y la
  landing sobre el audio (**texto legal que revisa Pablo**, se despliega con el sitio).
- **Pruebas:** unitarias de la capa y del respaldo, integridad de los archivos contra el
  manifiesto, E2E en Chromium y Firefox. El oído y el iPhone quedan como verificación manual
  de Pablo.

### Non-goals

- Gongs grabados (siguen sintetizados) y cualquier cambio de sus sonidos.
- Editar `remanso-engine.js` o cambiar su huella.
- Restringir los archivos por cuenta en el servidor (`run_worker_first`, R2, ADR nuevo):
  son CC0, el nivel con cuenta sigue siendo un incentivo de producto y así se documenta.
- Modo sin conexión, Service Worker, PWA, audio en segundo plano o con la pantalla bloqueada.
- Un segundo formato (AAC/M4A) en la primera versión; queda como alternativa decidida con
  la prueba en iPhone (ver preguntas abiertas).
- Mezclar eventos sintetizados sobre la grabación (chispazos del fuego, etc.).
- La lluvia de 87,6 s (`lluvia-alternativa`): queda fuera de la entrega por decisión de Pablo; no se copia ni se acredita.
- Un sonido de mar (olas en la orilla): con la versión natural de «agua» (un arroyo) se pierde el mar que tenía el sintetizado;
  queda en el backlog hasta que haya una grabación real con licencia compatible.
- Datos, tablas, migraciones o cualquier envío de la sesión al servidor.
- Publicar en producción: staging primero, con confirmación de Pablo.

## Capabilities

### New Capabilities

- `remanso-sonidos-naturales`: versión natural de cada fondo, preferencia por dispositivo,
  respaldo al sintetizado, carga acotada, empalme del bucle, nivel entre fondos, límite de
  memoria, procedencia y créditos, y coherencia de los textos públicos.

### Modified Capabilities

- `remanso-sesion`: «Fondos sonoros» deja de exigir que todo se sintetice sin descargar audio.
- `remanso-entrega`: los recursos de audio se entregan con su tipo y caché inmutable; «Sin
  datos ni esquema nuevos» admite la descarga del archivo del fondo, que revela cuál es.
- `remanso-pantallas`: el inicio suma la preferencia «Natural / Sintetizado» y el enlace a los
  créditos.

## Impact

- `apps/app/public/remanso/`: `remanso-fondos.js` (capa), `remanso-sonidos.js` (manifiesto),
  `audio/*.opus` (cinco archivos, 4 123 752 B = 3,93 MiB; se descarga uno por sesión, el mayor la lluvia con 2,09 MiB) y ajustes de `remanso.js` y `remanso.css`.
  `remanso-engine.js` y `remanso-gongs.js` no cambian.
- `apps/app/public/_headers`: regla de caché y tipo para `/remanso/audio/*`.
- `apps/app/src/remanso.js` y `apps/app/src/index.js`: ruta `/remanso/creditos` y enlace.
  Sin cambios en la política de contenido ni en `wrangler.jsonc`.
- Pruebas: Vitest (capa, manifiesto contra archivos, rutas, cabeceras) y Playwright de Remanso
  (`e2e-remanso`) en Chromium y Firefox; se reescribe el escenario «sin descargar archivos de
  audio».
- Documentación: `docs/productos/REMANSO.md`, `docs/diseno/remanso/audio/` (kit tal cual se
  recibió), GLOSARIO, STATUS y backlog (cierra «Sonidos reales» para los fondos).
- Sitio público (`apps/site`, despliegue aparte): `privacidad.html`, `terminos.html` y
  `remanso.html` dicen hoy que el audio se genera en el dispositivo y «sin descargas».
- Sin datos ni esquema. Hereda la [base común](../../../docs/homesuite/README.md).

## Estado y orden

**Propuesto, sin implementar y sin copiar los audios al repositorio.** Se implementa después
de los changes de Cuentas Claras. `remanso-meditacion` ya está archivado (sus requisitos están en
`openspec/specs/`), así que los `MODIFIED` de este cambio tienen contra qué aplicarse. Queda una
pregunta que solo se cierra con un iPhone (flujo de la lluvia): hasta entonces no se publica en
producción.
