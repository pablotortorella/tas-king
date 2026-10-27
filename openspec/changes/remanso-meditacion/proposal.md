## Why

HomeSuite organiza la casa (Tareas, Cuentas Claras, Compras); Remanso inicia la
otra mitad: cuidarla, con meditaciones de tiempo fijo, gong y sonidos de fondo
que generen calma. Existe un paquete de traspaso (motor de sonido ya funcional y
una referencia visual) que hay que llevar a la suite respetando su identidad,
sesión, perfil y cabeceras de seguridad, y ponerlo en staging desde la primera
versión para probarlo en un teléfono real. Además, la calma no debería pedir
trámites: una pausa corta se puede hacer sin cuenta, y la cuenta de HomeSuite
desbloquea las sesiones largas y el resto de los sonidos.

## What Changes

- Ruta `/remanso` en HomeSuite App con tres pantallas (inicio, sesión, cierre)
  que reutilizan el motor `remanso-engine.js` sin modificarlo.
- Acceso en dos niveles. **Libre, sin login:** duraciones de 1, 2 y 5 minutos y
  fondos silencio, agua y bosque. **Con cuenta de HomeSuite:** 10, 20 y 30
  minutos y lluvia, fuego y noche. Las opciones con cuenta se ven marcadas y,
  al elegirlas sin sesión, invitan a entrar con Google (la primera vez se crea la
  cuenta) y vuelven a `/remanso`. Con sesión, el avatar/nombre y el menú general
  llevan a `/perfil`.
- El cierre reconoce por su nombre de perfil a quien tiene cuenta; sin sesión el
  mensaje es el mismo pero sin nombre y sin ninguna invitación a crear la cuenta
  (ya se comunica en el inicio).
- Gong elegible: tres sonidos con nombre — **Gong brillante** (el predeterminado,
  disponible sin cuenta), **Gong profundo** y **Cuenco tibetano** (con cuenta). La
  elección vale para todos los gongs de la sesión, se recuerda en el dispositivo y
  «Probar gong» suena con el sonido elegido. El gong del paquete se reemplaza por
  estos (ver design.md, D9).
- Placa de Remanso en el sitio público de staging: tarjeta en la portada y landing
  `/remanso`, que en staging lleva a `/remanso` de la app del mismo entorno (como
  Cuentas Claras). En el sitio de producción dice «en preparación»; no se publica.
- Identidad de la suite: paleta, tipografía y modos claro y oscuro (según el
  sistema) de HomeSuite en lugar de la paleta y la fuente del paquete. La
  pantalla de sesión es siempre oscura.
- Entrada provisional: Remanso aparece como una herramienta más en la home y en
  el menú, sin dividir todavía la suite en mitades.
- Entrega segura: cero scripts ni estilos inline, cero fuentes ni recursos
  externos; la app sirve archivos estáticos propios (nuevo binding `assets`)
  sin pasar el HTML por el Asset Worker.
- Documentación: ficha de producto, diseño de referencia, STATUS, backlog con
  decisiones y riesgos pendientes.
- Publicación en staging con el protocolo común, previa confirmación de Pablo.

### Non-goals

- Historial de sesiones, rachas o cualquier dato guardado; el estado de ánimo
  del cierre no se persiste ni se envía.
- Navegación o nombres de las dos mitades de la suite (decisión pendiente).
- Publicar el sitio público en producción: sólo se despliega el sitio de staging.
- Guardar la elección del gong en el perfil o el servidor (queda en el dispositivo).
- Grabaciones de audio, app nativa o PWA con audio en segundo plano.
- Tema manual (claro/oscuro) distinto del preferido por el sistema.
- Migraciones de D1, tablas nuevas, cambios de Worker de TasKing o producción.
- Planes, cobros, cuotas o límites de uso: la cuenta es gratuita y el nivel libre
  es una invitación, no un control antiabuso (ver design.md, D8).
- Resolver los riesgos de dispositivo (iPhone en silencio, pantalla bloqueada,
  volumen relativo entre fondos): se registran y se investigarán aparte.

## Capabilities

### New Capabilities

- `remanso-sesion`: reglas del producto de la meditación: duraciones, gongs,
  fondos, pausa, fin anticipado, silencio del fondo y contrato con el motor.
- `remanso-pantallas`: acceso libre y con cuenta, pantallas de inicio, sesión y cierre,
  reconocimiento por nombre, entrada en la suite, identidad visual,
  accesibilidad y adaptación a móvil.
- `remanso-entrega`: servicio de archivos estáticos propios, política de
  seguridad de contenido, cabeceras en documentos y en el resto de rutas, y
  fidelidad del motor integrado respecto del paquete.

### Modified Capabilities

- `landing-publica-homesuite`: la portada suma Remanso entre las herramientas en
  preparación.
- `recorrido-staging-suite`: el sitio de staging ofrece cuatro landings y la de
  Remanso lleva a la app del mismo entorno.

## Impact

- `apps/app/src/index.js`: función `page()` con soporte de hoja de estilos,
  script y clase de página propios; ruta `/remanso`; tarjeta de
  Remanso en la home (el menú general ya no lista herramientas); `Cache-Control: private, no-store` para la ruta.
- `apps/app/public/remanso/`: motor (idéntico al paquete), módulo de sonidos de
  gong, código de interfaz y hoja de estilos nuevos.
- `apps/site/`: tarjeta en la portada, `remanso.html`, estilos y Worker (enlace a la
  app sólo en staging) con sus pruebas. `apps/app/wrangler.jsonc`: binding `assets`.
- Pruebas: Vitest de reglas del motor y de la ruta; Playwright de la app sobre
  `wrangler dev` real (cabeceras, CSP, recorrido); CI.
- Documentación: `docs/productos/REMANSO.md`, `docs/diseno/remanso/`, STATUS,
  backlog, `CLAUDE.md` y `QUICK_START.md` (índice de fichas).
- Sin cambios de datos ni de esquema. Staging usa el Worker `homesuite-app-staging`
  existente; producción no se toca.
- Paquete de origen: `~/Descargas/remanso/` (`INTEGRACION.md`, `remanso.html`,
  `remanso-engine.js`); hereda la [base común](../../../docs/homesuite/README.md).
