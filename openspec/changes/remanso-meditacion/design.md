## Context

Ver [proposal.md](proposal.md) para el motivo. Estado observado en `main` (`97a592a`):

- `apps/app` es un Worker de Hono; cada herramienta es una ruta que arma HTML con
  template strings y lo envuelve en `page()`, que fija encabezado, menú, avatar y
  `/app.css` + `/shell.js` (servidos como strings desde rutas). No hay binding
  `assets` ni archivos estáticos.
- La política vigente es `default-src 'self'; script-src 'self'; style-src 'self'`
  y `img-src` con los hosts de fotos de Google. No admite scripts, estilos ni
  atributos `style` en línea, ni fuentes externas.
- El shell de la app es claro (crema, Georgia en títulos) y no tiene modo oscuro.
  El sitio público sí: define paleta clara y oscura con `prefers-color-scheme`.
- Las rutas con sesión usan `signedInUser` y `readOwnProfile`; en `DEV_LOCAL_MODE`
  `/perfil` sólo acepta el usuario local en `localhost`/`127.0.0.1`.
- El paquete de origen trae un motor ES (`remanso-engine.js`) que sólo toca `window`
  al crear el `AudioContext`, y una referencia (`remanso.html`) que usa script y
  estilo en línea y Google Fonts: no corre tal cual bajo la política vigente.
- El CI ejecuta Vitest y el Playwright raíz (TasKing); los E2E de `apps/site` y de
  la app no están en el CI.

## Goals / Non-Goals

**Goals:**

- Que Remanso sea un módulo de la app con fronteras claras: rutas y datos mínimos
  en el servidor, comportamiento en el navegador, sin tocar otros productos.
- Que lo seguro sea lo verificado: cabeceras y política comprobadas sobre un
  servidor real, no sobre el manejador directo (aprendizaje de ADR-017).
- Que el motor siga siendo reemplazable por una versión nueva del paquete.

**Non-Goals:**

- Un sistema de temas para toda la app ni cambiar el aspecto de otras herramientas.
- Un patrón genérico de "módulos de producto" para la app; se resuelve sólo
  Remanso, con el mismo estilo que `registerProfileRoutes`.
- Reescribir la síntesis de audio o abstraer el motor detrás de otra capa.

## Decisions

### D1. Archivos estáticos propios con binding `assets`, sin `run_worker_first`

`apps/app/wrangler.jsonc` suma `assets` (`directory: ./public`, binding `ASSETS`),
heredable por `env.staging`. Sin `run_worker_first`, una ruta con archivo lo
sirve el Asset Worker y el resto va al Worker. Como **todo el HTML sigue
generándose en el Worker**, la política y las cabeceras llegan al documento: el
problema de ADR-017 (HTML estático que se salta el Worker) no aparece. Los
recursos (JS/CSS) no necesitan política: ésta gobierna el documento que los carga.

Para que los recursos lleven `X-Content-Type-Options: nosniff` se usa un archivo
`_headers` de assets acotado a `/remanso/*`.

Controles contra la regresión que sí es posible aquí: un archivo `.html` en
`public/` (p. ej. `index.html`) capturaría rutas sin cabeceras. Una prueba exige
que `public/` no contenga HTML, y un E2E verifica cabeceras de `/`, `/tareas`,
`/cuentas-claras`, `/compras`, `/perfil` y `/remanso` sobre `wrangler dev`.

*Alternativas descartadas:* (a) embeber el motor como string en el Worker: viola
"integrar tal cual", exige escapar 500 líneas y duplica el archivo; (b) regla
`Text` de wrangler para importar el archivo como texto: configuración frágil, no
funciona igual en Vitest y sigue sin ser un archivo servible con caché; (c) otro
Worker para Remanso: operación, dominio y sesión duplicados sin necesidad;
(d) `run_worker_first: ["/remanso/*"]` con `ASSETS.fetch` para añadir cabeceras:
sirve como **plan B** si `_headers` no se comporta igual en `wrangler dev` y en
staging, a costa de una invocación por recurso.

### D2. Disposición de archivos y fidelidad del motor

```
apps/app/public/remanso/remanso-engine.js   # motor, sin cambios (única copia)
apps/app/public/remanso/remanso.js          # interfaz (módulo ES, importa el motor)
apps/app/public/remanso/remanso.css         # tokens, claro/oscuro, pantallas
apps/app/public/_headers                    # nosniff para /remanso/*
apps/app/src/remanso.js                     # rutas del servidor
docs/diseno/remanso/                        # INTEGRACION.md + remanso.html (referencia)
```

La única copia del motor vive en `public/remanso/`; la referencia `remanso.html`
queda sólo como diseño, nunca como código ejecutable. Para detectar cambios
accidentales una prueba revierte la línea de la modificación local y compara el
SHA-256 resultante con el del paquete recibido (registrado en la prueba y en la
ficha). Actualizar el motor es una decisión explícita: se cambia el archivo, la
huella y la ficha en el mismo commit.

**Historia (2026-10-26).** Tras la primera prueba, Pablo pidió menos «wa-wa» en el
gong. Causa medida: cada parcial suena como dos osciladores desafinados ±0,4 Hz; dos
tonos iguales con esa diferencia se cancelan por completo 0,8 veces por segundo y el
volumen oscila ~21 dB. Un primer arreglo cambió esa línea del motor (±0,02 Hz). Al
pedir Pablo varios sonidos elegibles, el motor volvió a ser **idéntico al paquete**
y los sonidos viven aparte (D9).

### D3. Interfaz sin código en línea

- El servidor entrega el armazón de las tres pantallas (`hidden` alterna entre
  ellas) y enlaza `/remanso/remanso.css` y `/remanso/remanso.js` (`type="module"`).
  Sin JavaScript se ve un aviso en `<noscript>`.
- El navegador genera lo variable (botones de duración y fondo, marcas del
  anillo y línea de gongs) con DOM (`createElement`, `textContent`); nunca
  `innerHTML` con datos. Las posiciones calculadas se aplican con
  `style.setProperty` o atributos SVG, que la política permite; no se usa
  `setAttribute("style", …)` ni marcado con `style=`.
- El nombre llega como `data-nombre` en el elemento raíz (sólo con sesión),
  escapado con el mismo `html()` de la app, y el cierre lo escribe con
  `textContent`. El nivel de acceso llega como `data-acceso` (`libre` o `cuenta`)
  junto con las listas de opciones libres (ver D8). No hay bloque JSON en línea ni
  ruta de API nueva.
- Opciones con cuenta sin sesión: se dibujan como botones marcados «con cuenta»
  (candado en texto, no sólo ícono) con `aria-disabled="true"` en lugar de
  `disabled`, para que reciban foco; al activarlas se abre un aviso con el enlace
  «Continuar con Google» y la selección vigente no cambia. Nunca llaman al motor.
- El estado de ánimo vive sólo en memoria de la página.
- Ciclo de vida: se crea un motor por página. `pagehide` llama `dispose()`;
  `pageshow` con `persisted` (bfcache) vuelve a la pantalla de inicio. `start()` y
  `testGong()` se invocan únicamente desde `click`.
- Anuncios para lector de pantalla: el tiempo restante se actualiza como texto en
  un elemento no vivo; un único `aria-live="polite"` anuncia sólo cambios de
  estado (pausa/reanudar, gong próximo al minuto, fin).

### D4. Rutas del servidor en un módulo propio

`registerRemansoRoutes(app, deps)` en `apps/app/src/remanso.js`, con el patrón de
`registerProfileRoutes`: recibe `page`, `html`, `signedInUser`, `localUser`,
`ensureLocalUser` y el estado de configuración de Google. `GET /remanso`:

- con sesión → inicio completo, con avatar/nombre en el encabezado,
  `data-acceso="cuenta"` y `data-nombre`;
- sin sesión → el mismo inicio con `data-acceso="libre"`, sin nombre, y el enlace
  `/auth/google?returnTo=%2Fremanso` disponible sólo desde el aviso de las opciones
  con cuenta; el cierre no menciona la cuenta (si el ambiente no tiene Google configurado, el aviso
  lo dice, como Cuentas Claras). Sin cookie de sesión `currentSession` devuelve
  `null` sin consultar D1, así que el acceso libre no suma lecturas ni escrituras;
- `DEV_LOCAL_MODE` → usuario local sólo en `localhost`/`127.0.0.1`, como `/perfil`
  (más estricto que `/` y `/cuentas-claras`; no se copia la laxitud).

`/remanso` se añade a la lista de rutas con `Cache-Control: private, no-store`.
`page()` gana un cuarto parámetro opcional `{ styles, scripts, bodyClass }`;
sin él produce exactamente el HTML de hoy (comprobado con una prueba de
caracterización de las demás rutas). Las tarjetas y enlaces de Remanso se añaden
a la home y al menú reutilizando un fragmento único para no repetirlo en las tres
variantes de la home.

### D5. Identidad: tokens de la suite en claro y oscuro

Los tokens parten de la paleta del sitio público (claro: crema `#f7f2e8`,
superficie `#fffaf0`, tinta `#20342a`, verde `#206447`, coral `#d95f46`; oscuro:
`#161914`, `#20251f`, `#edf1e9`, `#8ac29c`, `#ef927e`, dorado `#d4ad58`) y de la
tipografía del shell (Georgia en títulos, sans del sistema en cuerpo). El latón
del gong se mapea al amarillo/dorado de la suite. Manrope y Google Fonts se
descartan: la política los bloquea y la suite ya tiene tipografía.

- `prefers-color-scheme` decide el esquema; no hay selector manual ni script de
  arranque de tema (no se necesita: sin JS no hay parpadeo; ADR-017 sólo lo
  exigía para un selector manual).
- El shell de la app es claro-sólo. Para que el encabezado acompañe el esquema
  oscuro **únicamente** en Remanso, `remanso.css` lo redefine bajo `body.remanso`.
  Extender el modo oscuro a toda la app queda como seguimiento en el backlog.
- La sesión usa una paleta "noche" fija (derivada de la oscura) en ambos
  esquemas, oculta el encabezado y ajusta `theme-color`. Viene del diseño
  original del paquete y **Pablo la confirmó el 2026-10-26**: de noche, una pantalla
  clara molesta durante una meditación.
- Contraste: una prueba lee los tokens de `remanso.css` y verifica ≥ 4.5:1 en los
  pares texto/fondo y 3:1 en bordes de controles, para claro, oscuro y noche.
  Cualquier ajuste del dorado o del latón se hace ahí, no a ojo.

### D6. Verificación por capas

| Riesgo | Evidencia |
|---|---|
| Reglas de gongs, duraciones, fondos, rechazo de duración | Vitest sobre el motor importado (Node) |
| Huella del motor, `public/` sin HTML, contraste de tokens | Vitest |
| Ruta con y sin sesión, opciones libres vs. con cuenta, escape del nombre, HTML sin código en línea, no-store, home y menú, sin cookies ni D1 sin sesión | Vitest con `app.request` |
| Cabeceras de documentos y recursos, política sin violaciones | Playwright de la app sobre `wrangler dev` |
| Recorrido sin cuenta (opción con cuenta bloqueada → sesión de 1 min → cierre sin nombre) y con cuenta (→ cierre con nombre), teclado, 360 px, claro/oscuro | Playwright (Chromium) |
| Segundo motor | Playwright en Firefox/WebKit si se pueden instalar; si no, límite registrado |
| Audio real, iPhone en silencio, pantalla bloqueada, volumen entre fondos | Prueba física dirigida de Pablo en staging; riesgos registrados |

Un nuevo proyecto Playwright en `apps/app/e2e` (puerto propio, estado de D1 local
propio y migraciones aplicadas antes; `DEV_LOCAL_MODE` sin `DEV_LOCAL_EMAIL`, de
modo que por defecto la visita es anónima y las pruebas con cuenta envían la
cabecera `X-HomeSuite-Dev-Email`) y un script `test:e2e:remanso` que se
suma al CI, igual que las demás suites de HomeSuite. La sesión completa de un
minuto no se recorre en CI: el fin natural lo cubre la prueba física y las reglas
del motor; el E2E termina antes de tiempo.

### D7. Publicación en staging

Sin migraciones. Antes: suites afectadas sobre el SHA, `wrangler deploy --dry-run
--env staging --config apps/app/wrangler.jsonc` para comprobar que `assets` se
hereda, y confirmación explícita de Pablo. Luego
`npm run deploy:homesuite-app:staging` (aplica migraciones —ninguna pendiente— y
despliega; no ejecuta tests), smoke HTTP del mismo SHA y registro en STATUS.
Staging tiene un solo SHA activo: se avisa antes de pisarlo.

### D8. Nivel libre y nivel con cuenta

Las opciones libres (1, 2 y 5 min; silencio, agua y bosque) y el resto se definen
en **un solo lugar del servidor** (constante exportada por `apps/app/src/remanso.js`),
que las entrega al navegador como atributos de datos; el cliente no repite las
listas. El motor no se modifica: la restricción vive en la interfaz, que no llama a
`start()` con una opción fuera del nivel de quien la ve. Las pruebas fijan que la
lista libre ⊂ opciones del motor y que cada nivel inicial es válido.

Valores iniciales: con sesión 10 min / lluvia / 58; sin sesión 5 min / agua / 58. El
volumen era 55 (referencia del paquete) y dejaba el fondo bajo frente al gong; se subió a 72
(+30 % sobre el control) y, al bajar los gongs un 25 %, a 58 (−20 % sobre 72), todo el
2026-10-27. Se mide sobre el control, no sobre la amplitud: el motor aplica `(v/100)²`. «Crear cuenta» es entrar con Google: la primera vez se
crea la cuenta de HomeSuite; no hay registro aparte.

**Límite honesto:** el motor, sus archivos y todo el audio son estáticos y se
sintetizan en el navegador, así que cualquiera que abra las herramientas del
navegador puede saltarse la interfaz y usar las opciones con cuenta. No hay un
control de seguridad posible sin servir el audio desde el servidor, que contradice
la decisión de sintetizar en el dispositivo y no aporta valor para una pausa de
calma. Por eso es un incentivo de producto y así se documenta. Si en el futuro
el nivel con cuenta incluyera contenido de valor real (por ejemplo grabaciones),
la restricción tendría que moverse al servidor.

*Alternativas descartadas:* (a) exigir sesión para todo (versión anterior del
plan): alejaba a quien sólo quiere una pausa corta; (b) ocultar las opciones con
cuenta: no comunica qué se gana con la cuenta; (c) deshabilitarlas con `disabled`:
no son enfocables ni explican nada, y la landing de la suite evita controles que
simulan una acción disponible sin explicarla; (d) un parámetro `?as=` o cookie
propia para marcar "invitado": cookies nuevas sin necesidad.

### D9. Sonidos de gong propios, sin editar el motor

`apps/app/public/remanso/remanso-gongs.js` define los tres sonidos
(`brillante`, `profundo`, `cuenco`) como parámetros de una misma síntesis (base de
inicio/fin e intermedio, parciales, reparto de amplitud entre osciladores, golpe y
ataque; el mismo grafo del gong del paquete) y exporta `SuiteEngine extends
RemansoEngine` que **sobrescribe `gong()`** y agrega `setGong(id)`. El motor ya llama
`this.gong(...)` desde `start()` y `testGong()`, así que no hace falta tocarlo. Los
tres se afinaron en una página de prueba de oído con Pablo (2026-10-26): brillante =
variante 4, profundo = 5, cuenco = 6; el «actual» y el «brillo suave» se descartaron.

- Lista y niveles: `REMANSO_ACCESO` suma `gongs` (libre: `brillante`; cuenta: los tres)
  y `inicial.gong`; salen al navegador como `data-libre-gongs` e `data-inicial-gong`,
  igual que duraciones y fondos. Los ids y nombres viven en `remanso-gongs.js` y el
  servidor los importa, como ya hace con `DURATIONS`/`AMBIENTS`.
- Persistencia: `localStorage` (clave propia, con try/catch; la página debe funcionar
  sin él). Se lee al iniciar y se aplica sólo si el nivel actual lo permite. No hay
  tablas, API ni cookies nuevas. Alternativa descartada por ahora: guardarlo en el
  perfil (seguiría a la persona entre dispositivos, pero exige migración y API, y
  dejaría sin elección a quien no tiene cuenta); queda en el backlog.
- UI: un bloque «Sonido del gong» con tres botones, como duración y fondo, entre el
  fondo y el volumen; las opciones con cuenta usan el mismo tratamiento. «Probar
  gong» usa el sonido elegido.
- El requisito de no oscilación (<3 dB) se verifica para los tres sonidos, en sus dos
  variantes, con el render sin conexión que ya existe.

### D10. Placa de Remanso en el sitio público

Se repite el patrón de Cuentas Claras: tarjeta en la portada («Próximamente» y
«Conocé Remanso»), landing estática `remanso.html` con la nota «todavía está en
preparación» y el marcador `<!-- staging-app-entry -->`, que sólo el Worker del sitio
de staging reemplaza por el enlace a `https://staging.homesuite.info/remanso` (con la
aclaración de que las sesiones cortas no piden cuenta). El sitio de producción no
cambia de aspecto ni enlaza a staging; el despliegue de producción queda fuera. Hay
que agregar los estilos de la ilustración de la landing (anillos concéntricos, como
el ícono del cierre) en claro y oscuro, y actualizar las pruebas que hoy cuentan
«tres landings» y «cuatro páginas».

## Risks / Trade-offs

- [`_headers` no aplica igual en local y en staging] → el E2E lo cubre en local y el
  smoke en staging; plan B de D1(d).
- [Un HTML en `public/` captura rutas sin cabeceras] → prueba que lo prohíbe y E2E de
  cabeceras de todas las rutas HTML.
- [Agregar `assets` cambia la plataforma compartida] → cambio aditivo, sin
  `run_worker_first`, dry-run de staging y pruebas de caracterización de las
  demás rutas; revisar el diff de `wrangler.jsonc` antes de publicar.
- [Wake Lock se pierde si se cambia de pestaña y se vuelve] → el motor sólo lo
  pide al iniciar y reanudar y no se modifica; queda como límite conocido y como
  punto de la investigación posterior.
- [La pausa del navegador o bfcache deja audio vivo] → `dispose()` en `pagehide`;
  E2E verifica que navegar fuera no deja sesión activa.
- [Shell claro con Remanso oscuro genera dos criterios visuales] → redefinición
  acotada a `body.remanso` y seguimiento en backlog para el modo oscuro global.
- [Contraste del dorado sobre crema] → medido por prueba; se ajusta el token.
- [iPhone en silencio, audio en segundo plano, volumen relativo, fondos sintetizados
  vs. grabados] → no verificados; se registran en la ficha y el backlog para una
  investigación a fondo antes de decidir.
- [El nivel libre es client-side] → es una restricción de producto, no de
  seguridad (ver D8); no se promete protección y se documenta en la ficha.
- [Personas sin cuenta que no encuentran dónde crear una] → el aviso de la opción
  con cuenta y el cierre llevan a «Continuar con Google»; se mide con la prueba
  física de Pablo, no con métricas (no se recolectan).
- [Dispositivo emulado no acredita audio real] → el E2E prueba flujo y política,
  no calidad de sonido; la aceptación es la prueba física en staging.

## Migration Plan

1. Rama `feature/remanso` desde `main`; cambio aditivo sin datos.
2. Implementación y pruebas locales; se ofrece a Pablo verlo en
   `http://localhost` antes de staging, tanto con cuenta (`npm run dev:homesuite-app`,
   usuario local) como sin cuenta (`npm run dev:homesuite-app:anonimo`, script nuevo
   sin usuario local).
3. Con su OK: dry-run, suites, despliegue a staging, smoke y registro.
4. Pablo prueba en su teléfono. Hallazgos → backlog o correcciones del mismo change.
5. PR a `main` con evidencia. Producción no se toca.

*Rollback:* redeploy del SHA anterior en staging (Worker). No hay datos que
revertir. La ruta y los archivos nuevos dejan de existir con el redeploy.

## Open Questions

- Cómo se llamarán las dos mitades y cómo se navega entre ellas (decisión de
  producto, ya diferida por Pablo).
- Si la landing pública de Remanso entra antes o después del primer uso real.
- Si el modo oscuro del shell se generaliza a toda la app.
