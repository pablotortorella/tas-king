# Remanso: particularidades de producto

Hereda la [base común](../homesuite/README.md) y la [plataforma](PLATAFORMA.md).
Remanso es la herramienta de HomeSuite para descansar: meditaciones de tiempo fijo,
con gong y sonidos de fondo. Es la exploración que el [marco de identidad](../HOMESUITE_IDENTIDAD_Y_VISION.md)
llamaba «Pausa»; Pablo decidió el 2026-10-27 que ese nombre sale y Remanso ocupa su lugar.
No es «una mitad» de la suite: organizar, cuidar y disfrutar son dimensiones de la marca,
no categorías de navegación. Su
especificación vive en el change `remanso-meditacion` (`openspec/changes/`, y en
`openspec/specs/` cuando se archive); el paquete de diseño recibido está en
[docs/diseno/remanso](../diseno/remanso/README.md). Ver [STATUS](../STATUS.md) para
distinguir rama, integración, publicación y aceptación; esta ficha no lo acredita.

## Alcance y niveles de acceso

Ruta `/remanso` en HomeSuite App, con tres pantallas (inicio, sesión, cierre).

| | Sin cuenta | Con cuenta de HomeSuite |
|---|---|---|
| Duraciones | 1, 2 y 5 min | 1, 2, 5, 10, 20 y 30 min |
| Fondos | silencio, agua, bosque | los seis (suma lluvia, fuego, noche) |
| Sonido del gong | Gong brillante | Gong brillante, Gong profundo y Cuenco tibetano |
| Valores iniciales | 5 min · agua · Gong brillante · volumen 58 | 10 min · lluvia · Gong brillante · volumen 58 |
| Cierre | duración, sin nombre ni mención a la cuenta | duración y saludo por el nombre del perfil |

«Crear cuenta» es entrar con Google: la primera vez se crea la cuenta. Las opciones
con cuenta se ven marcadas; elegirlas sin sesión explica y ofrece entrar, sin
cambiar la selección ni sonar. La única definición de los niveles es
`REMANSO_ACCESO` en `apps/app/src/remanso.js`; el navegador la recibe por atributos
de datos.

**Límite del nivel libre:** el audio se sintetiza en el navegador y los archivos son
estáticos, así que el nivel libre es un incentivo de producto, **no un control de
seguridad**: quien use las herramientas del navegador puede saltarlo. Si el nivel
con cuenta llegara a incluir contenido de valor real (p. ej. grabaciones), la
restricción tendría que pasar al servidor.

**Sonido del gong.** Tres sonidos con nombre, todos sintetizados en el dispositivo:
*Gong brillante* (el predeterminado; metálico, golpe marcado), *Gong profundo* (una
octava más grave y más largo) y *Cuenco tibetano* (agudo, cantante, ataque suave). Se
afinaron de oído con Pablo el 2026-10-26. La elección vale para todos los gongs de la
sesión y para «Probar gong», se recuerda en el dispositivo (`localStorage`, clave
`remanso:gong`; nada llega al servidor) y se ignora —sin borrarla— si el nivel actual
no la permite. Seguir a la persona entre dispositivos exigiría guardarla en el perfil
(backlog).

Reglas de sesión: gongs al inicio, a la mitad y al final hasta 10 min; cada 5 min
desde 20 min. Inicio y final suenan más agudos, fuertes y largos. El fondo entra con
fundido de 4 s y sale con uno de 6 s. El estado de ánimo del cierre es opcional y
**no se guarda ni se envía**. No hay historial ni datos nuevos de ningún tipo.

## Archivos y arquitectura

| Ruta | Responsabilidad |
|---|---|
| `apps/app/src/remanso.js` | Ruta `GET /remanso`, niveles de acceso y armazón HTML de las tres pantallas |
| `apps/app/public/remanso/remanso-engine.js` | Motor de sonido del paquete, **sin modificar** |
| `apps/app/public/remanso/remanso-gongs.js` | Los tres sonidos de gong y `SuiteEngine`, que sólo reemplaza `gong()` (a 0,75 del volumen, `NIVEL_GONG`), `crackle()` (chispazos esporádicos del fuego, `PROB_CHISPAZO`), `windGust()`, `drop()` y `buildAmbient()` (viento del bosque a 0,15 del nivel del paquete y al doble de espaciado, `FACTOR_VIENTO`; lluvia con el 24,5 % de las gotas y el lecho al 60 %, `DENSIDAD_GOTAS` y `NIVEL_LECHO_LLUVIA`) |
| `apps/app/public/remanso/remanso.js` | Interfaz (módulo ES): arma opciones, sesión y cierre con DOM |
| `apps/app/public/remanso/remanso.css` | Tokens y estilos: claro, oscuro y noche |
| `apps/app/public/_headers` | `nosniff` para los recursos de `/remanso/*` |

- **Motor intacto.** Su huella SHA-256 está en `apps/app/test/remanso-assets.test.js`
  (`f00c37b5…7042`, del paquete del 2026-10-26). Actualizarlo es decisión explícita:
  cambiar archivo, huella y esta ficha juntos. La copia dentro de
  `docs/diseno/remanso/remanso.html` es sólo referencia y conserva el gong original.
- **Gongs sin «wa-wa».** El gong del paquete desafinaba ±0,4 Hz los dos osciladores de
  cada parcial: se cancelaban por completo 0,8 veces por segundo y el volumen oscilaba
  ~21 dB (medido sin conexión). Los sonidos de `remanso-gongs.js` usan un desafinado
  mínimo (±0,02 Hz) o desbalanceado (cuenco): ~0,7 dB (brillante, profundo) y hasta
  ~3,1 dB (cuenco, su temblor suave y deliberado). Un E2E renderiza cada sonido sin
  conexión y exige menos de 3 dB (4 dB el cuenco); falla si vuelve el desafinado
  original. Si se actualiza el motor, `SuiteEngine` sigue funcionando mientras llame
  a `this.gong(t, amp, dest, main)`.
- **Archivos estáticos propios.** La app tiene binding `assets` (`./public`) sin
  `run_worker_first`: todo el HTML lo genera el Worker, así que la política y las
  cabeceras llegan al documento. **Nunca poner un `.html` en `apps/app/public/`**
  (capturaría su ruta sin cabeceras); una prueba lo impide. Ver
  [ADR-019](../ADRs/ADR-019-archivos-estaticos-en-homesuite-app.md).
- **Sin código incrustado.** CSP `script-src 'self'; style-src 'self'`: nada de
  `<script>`/`<style>` en línea, ni atributos `style`/`on*`, ni recursos externos. Las
  posiciones calculadas se aplican por CSSOM (`el.style.*`) o atributos SVG; el
  nombre llega escapado en `data-nombre` y se escribe con `textContent`.
- **Ciclo de vida del audio.** `start()` y `testGong()` sólo desde `click`;
  `dispose()` en `pagehide`; al volver desde el caché de navegación se regresa al
  inicio. Un doble toque en «Comenzar» no inicia dos sesiones.
- **Usuario local.** En `DEV_LOCAL_MODE`, `/remanso` sólo acepta el usuario local en
  `localhost`/`127.0.0.1` (como `/perfil`), nunca por la IP de la red.

## Sitio público

`apps/site` tiene la tarjeta «Remanso» en la portada («Próximamente», como Cuentas
Claras y Compras) y la landing estática `remanso.html`: dice que la herramienta
«todavía está en preparación» y no tiene enlaces ni controles de la app. Sólo el Worker
del **sitio de staging** (`SITE_ENV=staging`) reemplaza el marcador
`<!-- staging-app-entry -->` por «Entrar a Remanso →», que lleva a
`https://staging.homesuite.info/remanso`. El sitio de producción no enlaza a staging, y
no se despliega en este corte. Aún no hay una portada de producción de Remanso con
aplicación real: depende de publicar la app en producción, que requiere aprobación
explícita de Pablo.

## Decisiones de diseño

- **Identidad de la suite**, no la del paquete: paleta del sitio público en claro y
  oscuro (sigue `prefers-color-scheme`, sin selector manual), Georgia en títulos y
  sans del sistema. Manrope y Google Fonts se descartaron: la política los bloquea.
- **La sesión es siempre «noche»** (oscura) aunque el sistema esté en claro, sin
  encabezado, para no encandilar (se medita de noche con la pantalla encendida y
  ahorra batería en OLED). Viene del diseño original del paquete. **Confirmado por
  Pablo el 2026-10-26** (opción A); la alternativa era que siguiera al sistema.
- El encabezado de la app es claro-sólo; Remanso lo adapta al oscuro únicamente bajo
  `body.remanso`. Extender el modo oscuro a toda la app queda en el backlog.
- Contraste AA medido por prueba (`remanso-contrast.test.js`) sobre los tokens de
  `remanso.css`; los bloques `@tokens` son la fuente.
- Las opciones con cuenta usan `aria-disabled` (no `disabled`) para seguir enfocables
  y poder explicarse.
- Checklist de UI: encabezados con Georgia/`rem-label` propios de Remanso (la regla
  de etiquetas de TasKing no aplica al shell de HomeSuite); teclado por botones
  nativos (Enter/Espacio) y Escape cierra el aviso; import/export no aplica (no hay
  datos).

## Comandos

- `npm run dev:homesuite-app` · local con usuario local (`zelda@example.test`)
- `npm run dev:homesuite-app:anonimo` · local sin usuario: se ve el nivel libre. Sin
  Google configurado, el aviso dice que el acceso no está disponible en el ambiente.
- `npm run test:homesuite-app` · unitarias (motor, huella, `public/`, contraste, rutas)
- `npm run test:homesuite-app:integration` · rutas con sesión sobre D1
- `npm run test:homesuite-site` y `npm run test:homesuite-site:e2e` · sitio público
  (la placa y la landing de Remanso; el E2E del sitio también corre en CI)
- `npm run test:e2e:remanso` · Playwright sobre `wrangler dev` real (cabeceras,
  política, recorridos, teclado, 360 px, claro/oscuro). Firefox es opcional:
  `REMANSO_E2E_FIREFOX=1 npx playwright test --config apps/app/playwright.config.mjs --project firefox`.

## Riesgos y límites no verificados

No resueltos; hay que probarlos en teléfono real y, antes de decidir qué hacer,
investigar a fondo cómo se resuelven en la práctica:

- **iPhone en modo silencio:** probablemente Web Audio no suene.
- **Pantalla bloqueada o app en segundo plano:** el audio puede cortarse. El Wake Lock
  se pide sólo al iniciar o reanudar; el motor no lo renueva al volver a la pestaña.
- **Volumen relativo entre fondos:** calibrado a mano; escuchar los seis seguidos.
- **Arranque suspendido:** en Firefox (headless) el `AudioContext` queda suspendido al
  iniciar ~1 de cada 8 veces; el motor lo trata como pausa y «Reanudar» lo recupera
  (8/8 en la sonda). Chromium 0/8. Probar en iOS y Android.
- **Dispositivo emulado ≠ físico:** las pruebas automáticas validan flujo, política y
  contraste, no calidad de sonido. WebKit/Safari no se probó.

Pendientes de producto en el [backlog](../PRODUCT_BACKLOG.md): historial, modo oscuro global, fondos grabados, elección del gong en el
perfil.
No hay excepciones propuestas a la base común en esta ficha.
