# Plataforma HomeSuite y sitio público

Hereda la [base común](../homesuite/README.md). Diseño objetivo en
[ADR-018](../ADRs/ADR-018-homesuite-suite-modular.md) y recursos concretos en
[infraestructura](../HOMESUITE_INFRASTRUCTURE.md). Implementación por rama/entorno
en [STATUS](../STATUS.md); no deducirla de los documentos de visión.

## Identidad, home y landings

Propósito, ejes, tono, voseo y borradores de copy en
[Identidad y visión](../HOMESUITE_IDENTIDAD_Y_VISION.md); es intención de marca, no
lista de tareas. Cambios de home, landings, descripciones y metadatos:

- proponer un diff acotado y distinguir hechos actuales de aspiraciones;
- presentar por separado productos disponibles, en desarrollo y exploraciones; no
  anunciar exploraciones ni fechas sin decisión de Pablo;
- no prometer funciones, privacidad, sincronización ni colaboración sin verificarlas;
- no cambiar logo, favicon ni paleta antes de revisar la identidad vigente; el acento por
  producto (verde, terracota y ámbar, sólo en rótulo, borde e ícono) usa colores que la
  suite ya tenía y se aprobó el 2026-10-27 (change `acentos-y-catalogo-publico`);
- el copy de home y landings se alineó con esta dirección el 2026-10-27 (change
  `identidad-textos-suite`); el sitio público muestra sólo herramientas funcionales: Compras
  no se nombra en ningún lugar del sitio ni de la app (se retiró el 2026-10-28); Cuentas Claras y Remanso se rotulan «Versión
  Beta» y Fun TasKing «Disponible». Jardín Zen se añadió como beta (cambio `jardin-zen-beta`, PR #124): está en `main`, en staging y en producción (desde 2026-10-31). Con cuatro herramientas, las tarjetas del inicio de la app y de la home del sitio se disponen en 2×2 (una columna en pantallas angostas).

## Plataforma

`apps/app/` implementa la app autenticada; su modelo compartido es identidad,
sesiones, grupos, membresías, invitaciones y auditoría. Mantener invariantes de
creación atómica del grupo/titular y aceptación atómica de invitaciones.
Descubrir una invitación no concede acceso al contenido privado.

La raíz de la app es la entrada a la suite. Cada herramienta tiene su propia
ruta; Cuentas Claras muestra su estado en `/cuentas-claras` después de elegirla.
El sitio público de staging replica home y landings en otro Worker. El HTML lleva los
enlaces de producción (`app.homesuite.info`, incluidas las tareas en `/tareas`) y el worker de
staging los reescribe a los del staging, así que cada sitio conduce a la app de su propio
ambiente. `npm run verify:coherence:<ambiente>` comprueba que sitio y app cuenten lo
mismo; la lista de herramientas de la app vive en `apps/app/src/tools.js`. Consultar STATUS para
dominios y versión activa.

Desde la raíz, comandos actualmente disponibles:

- `npm run dev:homesuite-app`
- `npm run test:homesuite-app`
- `npm run test:homesuite-app:integration`
- `npm run test:e2e:remanso` (Playwright sobre `wrangler dev`; ver [Remanso](REMANSO.md))
- `npm run dev:homesuite-app:anonimo` (sin usuario local)
- `npm run test:homesuite-site:e2e` (Playwright del sitio público)
- `npm run test:homesuite-site`
- `npm run db:migrate:homesuite-app:local`
- `npm run deploy:homesuite-app:staging`

Ver scripts en `package.json` y configuración en `apps/app/wrangler.jsonc` antes
de usarlos. El deploy de staging no ejecuta tests: correr las suites específicas
y los checks generales afectados primero. CI ejecuta las suites de app y sitio,
además de las generales y Playwright; el login real sigue requiriendo prueba
dirigida. No equiparar `test:all` con verificar toda la suite de productos.

La aceptación de identidad y colaboración requiere dos cuentas reales en staging:
crear grupo, invitar, descubrir sin filtrar contenido, aceptar/rechazar, comprobar
roles y aislamiento. Registrar el SHA y resultado de cada recorrido. Un login
exitoso no demuestra el resto. Separar identidades locales de sesiones reales.

## Sitio público

`apps/site/` sirve landings y assets, sin bindings de datos ni sesión de la app.
Configurar y publicar con su propio `wrangler.jsonc`; verificar apex, redirección
`www`, rutas, links y cabeceras. No publicar app para cambiar una landing ni enviar
cookies autenticadas al sitio. Cambios de DNS preservan registros ajenos al alcance.

## App instalable

Cambio [pwa-instalable](../../openspec/changes/archive/2026-11-22-pwa-instalable/proposal.md); estado en [STATUS](../STATUS.md).
El service worker (alcance `/`) guarda en el dispositivo solo una lista cerrada de estáticos públicos
(`/app.css`, scripts de la app, `/manifest.webmanifest`, archivos de Jardín Zen y Remanso sin audio) y las
páginas sin conexión. **Nunca** guarda nada autenticado: ni `/api`, ni `/auth`, ni HTML con datos de cuenta o
de grupo. Las navegaciones siempre van a la red; la página sin conexión solo aparece si la red falla.

Rutas nuevas: `/manifest.webmanifest`, `/sw.js`, `/pwa.js`, `/sin-conexion`, `/sin-conexion/jardin-zen` y
`/sin-conexion/remanso`.

- Apagado de emergencia: publicar con `PWA_SW=off` (`--var PWA_SW:off` en `node scripts/wrangler-deploy.mjs`). El service worker
  queda sin manejador `fetch`, borra sus cachés y se desregistra. Sin la variable, vuelve el modo normal.
- Íconos: `npm run pwa:iconos:homesuite-app`. Lista de precarga: `npm run pwa:precache:homesuite-app`; hay que
  correrlo cuando cambia algún archivo de `apps/app/public/jardin-zen/` o `remanso/`, porque una prueba falla si la
  lista no coincide con el disco.
- Sin *navigation preload*: con él, Chromium pide dos veces `/auth/google` y el acceso con Google puede fallar.
- El CI no corre los E2E de la app (`test:e2e:homesuite-app` no está en `.github/workflows/test.yml`; comprobado
  2026-11-12), así que `pwa.spec.js` y el resto de esa suite se corren a mano antes de integrar cambios de la app.
- Tareas (`/tareas`, desde el 2026-11-10) usa el mismo manifiesto, los mismos íconos de instalación y el mismo `/pwa.js`, con
  favicon propio. Sin conexión muestra la página genérica `/sin-conexion`. La caché nunca guarda `/tareas`, `/api/tareas/*` ni
  `/tareas/adjuntos/*` (`e2e/tasking/migration-ui.spec.js`). No hay Tareas sin conexión.

## Consola y estadística de uso

Change [`consola-administracion-homesuite`](../../openspec/changes/consola-administracion-homesuite/proposal.md).

- **Consola en `/consola`.** Tiene cuatro pestañas: Suite, Tareas, Cuentas Claras y Administradores. Se dibujan en el servidor
  (`apps/app/src/console/`).
  - **Acceso.** Lo da la condición de dueño de la suite: identificadores de `users` en el secreto `HOMESUITE_OWNER_USER_IDS`, nunca en la
    base. También lo da un rol por herramienta (`platform_roles`: `tareas`, `cuentas-claras`), que sólo da un dueño desde
    Administradores.
  - **404 uniforme.** Para quien no puede entrar, toda ruta `/consola*` y `/api/consola/*` responde el mismo 404 que una ruta
    inexistente. El intento queda sólo en el log (`console_denied`), sin la cuenta.
  - **Auditoría.** Queda en `platform_audit_events`, sin correos: `platform_role_granted` y `platform_role_revoked`, `console_opened` (una
    vez por persona y por día) y `console_accounts_viewed`.
- **Medición.** Un middleware (`usage-middleware.js`) corre después de la puerta legal. Mide sólo respuestas exitosas con sesión de las
  rutas de [`usage-catalog.js`](../../apps/app/src/usage-catalog.js), fuera del camino de la respuesta.
  - **Por persona** se guarda sólo `users.last_active_on`, en fecha de Colombia.
  - **En agregado** se guardan conteos diarios de acciones y personas distintas por período cerrado (día, semana ISO, mes, trimestre y
    año). Las marcas HMAC (`USAGE_MARKER_SECRET`) se borran al cerrar cada período.
  - **Remanso** informa sólo `{ resultado }` en `POST /api/uso/remanso`.
  - **Una ruta nueva** que deba contar como «entró» o «hizo algo» se suma al catálogo. Una prueba falla si una ruta del catálogo deja de
    existir.
- **Mantenimiento diario.** Purga las marcas vencidas y guarda la foto de la suite (`usage_suite_snapshots`). Los contadores no se borran.
- **Local.** `npm run dev:consola` (puerto 8795) siembra una cuenta dueña (`consola@example.test`), una con rol de Tareas
  (`tareas-admin@example.test`), una sin rol (`sin-rol@example.test`) y estadística sintética. Se cambia de cuenta con
  `/api/local/session?as=<correo>`.
- **Secretos por ambiente.** Ver [operación](../homesuite/OPERACION.md#secretos-de-la-consola-y-de-la-estadística-de-uso).

## Límites

La política de recuperación y ciclo de vida de datos debe demostrarse antes de
operar con información irreemplazable. Estado actual y dependencias de integración
no se copian aquí: consultar STATUS y el change correspondiente. Esta ficha no
habilita publicar producción ni convierte condiciones pendientes en excepciones.

## Textos legales y aceptación

La política de privacidad y los términos viven en `apps/site/public/privacidad.html` y `terminos.html`; su **versión** es la fecha de
«Última actualización» y la constante de `apps/app/src/legal.js` debe coincidir (una prueba lo exige). Toda pantalla de la app con
«Continuar con Google» muestra el aviso de aceptación con ambos enlaces y la declaración de 18 años; el pie de la app los enlaza. Al volver
de Google se registra en `legal_acceptances` la versión que la persona vio al empezar; si cambia una versión, `/aceptar` la pide antes de
seguir (la puerta se enciende con `LEGAL_GATE=on` y se despliega apagada). Cerrar sesión, la descarga de los datos propios y los recursos
estáticos funcionan siempre; la baja de cuenta debe sumarse a las rutas exentas (`GATE_EXEMPT`). Las solicitudes de datos por correo se
atienden con [su procedimiento](../HOMESUITE_SOLICITUDES_DATOS.md) y los proveedores que tratan datos figuran en
[encargados](../HOMESUITE_ENCARGADOS.md). Los textos legales son propuestas que revisa Pablo: no se publican por haberse escrito. Specs en
`openspec/changes/politica-y-aceptacion/`.

## Perfil compartido

Acuerdos de nombre, avatar y apodo por grupo en la
[exploración](../HOMESUITE_PERFIL_EXPLORACION.md); contratos y plan en el
[change de Perfil](../../openspec/changes/perfil-compartido-homesuite/proposal.md).
La [API común](../HOMESUITE_PROFILE_API.md) implementa datos y gestión en la
plataforma. La pantalla compartida `/perfil` se abre desde el avatar/nombre y
desde el menú general de la app. Cuentas Claras muestra el aviso «Muy pronto» al
entrar a su ruta tras el acceso con Google. La integración financiera y la
migración de TasKing quedan para cortes posteriores. Consultar STATUS para el SHA
y el estado de staging.


El módulo TasKing en preparación conserva sus permisos por tablero: los grupos
comunes no conceden acceso a tareas. Su identidad se vincula a la cuenta HomeSuite
sin una segunda sesión. `/api/me` mantiene el contrato de plataforma; el producto
usa `/api/tareas/me`. [Runbook](../tasking/MIGRACION-HOMESUITE.md) y
[evidencia](../tasking/VERIFICACION.md) distinguen implementación de publicación.
