## Purpose

Hacer instalable HomeSuite App y permitir que Jardín Zen y Remanso (nivel sin cuenta) abran sin
conexión una vez visitados, sin guardar en el dispositivo nada que dependa de la sesión, con un
service worker versionado, acotado y que se puede apagar.

## ADDED Requirements

### Requirement: Manifiesto web del mismo origen y válido en cada ambiente

HomeSuite App SHALL servir un manifiesto web en `/manifest.webmanifest` con
`Content-Type: application/manifest+json`, generado por el Worker. El manifiesto SHALL declarar
`id`, `start_url` y `scope` iguales a `/`, `display: standalone`, `lang: es`, íconos de 192 y 512
píxeles con propósito `any` y `maskable`, y `theme_color` y `background_color` tomados de la paleta
clara de `theme.js`. Todas sus URLs SHALL ser relativas al origen: SHALL NOT contener el host de
producción ni el de staging. El nombre SHALL ser «HomeSuite» en el host de producción y SHALL
distinguir la instalación de staging en cualquier otro host. Toda página generada por
`renderPage` SHALL enlazar el manifiesto, el favicon y el `apple-touch-icon` del mismo origen.

#### Scenario: Manifiesto en producción

- **WHEN** se pide `/manifest.webmanifest` con host `app.homesuite.info`
- **THEN** la respuesta es JSON de manifiesto con `id`, `start_url` y `scope` iguales a `/`, `display` `standalone` y nombre «HomeSuite»

#### Scenario: Manifiesto en staging

- **WHEN** se pide `/manifest.webmanifest` con host `staging.homesuite.info`
- **THEN** el nombre identifica a staging y ninguna URL del manifiesto es absoluta

#### Scenario: Colores de la suite

- **WHEN** se lee el manifiesto
- **THEN** `theme_color` y `background_color` coinciden con el fondo de la paleta clara de `theme.js`

#### Scenario: Enlaces en cada página

- **WHEN** se pide cualquier página HTML de la app
- **THEN** la cabeza enlaza `/manifest.webmanifest`, el favicon y el `apple-touch-icon`, todos del mismo origen

### Requirement: Íconos derivados del favicon vigente

Los íconos de instalación SHALL derivarse del favicon simplificado vigente de la suite sin
modificar su dibujo ni su paleta, SHALL generarse con un script reproducible del repositorio y
SHALL versionarse en `apps/app/public/icons/` con la versión en el nombre. SHALL existir PNG de
192 y 512 (`any`), de 192 y 512 «maskable» con el dibujo dentro de la zona segura y un
`apple-touch-icon` opaco de 180. Los íconos SHALL entregarse con `X-Content-Type-Options: nosniff`,
HSTS sin `preload` y `Cache-Control: public, max-age=31536000, immutable`.

#### Scenario: Archivos y tamaños

- **WHEN** se leen los PNG referenciados por el manifiesto y por la cabeza de las páginas
- **THEN** cada archivo existe, es PNG y mide lo que declara

#### Scenario: Cabeceras de los íconos

- **WHEN** se pide un ícono a un servidor en ejecución
- **THEN** llega con tipo de imagen, `nosniff` y caché inmutable de un año

#### Scenario: Ícono nuevo

- **WHEN** cambia un ícono
- **THEN** se publica con otro número de versión en el nombre y el manifiesto apunta al nuevo

### Requirement: Service worker servido por el Worker, sin caché y con cabeceras

El service worker SHALL servirse en `/sw.js` desde el Worker con tipo JavaScript,
`Cache-Control: no-cache` y las mismas cabeceras de seguridad que el resto de la app, y SHALL
registrarse con alcance `/` desde un script del mismo origen (`/pwa.js`), sin código en línea. La
política de contenido de la app SHALL NOT cambiar. `apps/app/public/` SHALL NOT contener `sw.js`,
`pwa.js`, `manifest.webmanifest` ni archivos HTML. La app SHALL NOT necesitar
`Service-Worker-Allowed`.

#### Scenario: Cabeceras del service worker

- **WHEN** se pide `/sw.js` a un servidor en ejecución
- **THEN** la respuesta es JavaScript con `Cache-Control: no-cache`, la política de contenido vigente y `X-Content-Type-Options: nosniff`

#### Scenario: Registro sin código en línea

- **WHEN** una persona abre cualquier página de la app en un navegador compatible
- **THEN** queda registrado un service worker con alcance `/` y no hay violaciones de la política de contenido

#### Scenario: El almacén no tapa las rutas del Worker

- **WHEN** se listan los archivos de `apps/app/public/`
- **THEN** no hay `sw.js`, `pwa.js`, `manifest.webmanifest` ni HTML

### Requirement: El service worker solo intercepta lo que puede servir sin datos privados

El service worker SHALL NOT interceptar pedidos que no sean `GET`, de otro origen, bajo `/auth/` o
`/api/`, con cabecera `Range`, bajo `/remanso/audio/`, ni el propio `/sw.js`: esos pedidos SHALL
llegar a la red como si no hubiera service worker. Las navegaciones SHALL resolverse siempre en la
red y SHALL recurrir a una página sin conexión **solo** cuando la red falla; una respuesta del
servidor con error SHALL entregarse tal cual. Los pedidos `GET` de la lista de precarga SHALL ir a
la red primero y SHALL usar la copia guardada solo si la red falla. Cualquier otro pedido SHALL NOT
interceptarse.

#### Scenario: Escrituras intactas

- **WHEN** se envía un formulario (`POST`) con el service worker activo
- **THEN** el pedido llega al servidor sin pasar por la caché y su respuesta no se guarda

#### Scenario: Acceso con Google intacto

- **WHEN** se navega a `/auth/google` o vuelve `/auth/callback`
- **THEN** el service worker no intercepta el pedido

#### Scenario: API intacta

- **WHEN** la página pide `/api/me`
- **THEN** el pedido va a la red y la respuesta no se guarda

#### Scenario: Navegación con conexión

- **GIVEN** el service worker activo y conexión
- **WHEN** una persona navega a `/` o a una página de un grupo
- **THEN** recibe la respuesta del servidor, con su sesión vigente

#### Scenario: Error del servidor no se disfraza

- **WHEN** el servidor responde 404 o 500 a una navegación
- **THEN** la persona ve esa respuesta y no la página sin conexión

### Requirement: Nada que dependa de la sesión se guarda en el dispositivo

La caché del service worker SHALL contener únicamente las rutas de una lista cerrada de recursos
públicos (las páginas sin conexión, los estilos y módulos comunes que cargan, los recursos de Jardín
Zen y de Remanso salvo el audio, el manifiesto y el favicon). La lista de archivos de `public/`
SHALL generarse desde el disco y una prueba SHALL fallar si no coincide. La precarga SHALL pedirse
sin credenciales y SHALL rechazar toda respuesta que no sea `200` del mismo origen o que declare
`private` o `no-store`. El service worker SHALL NOT escribir en la caché fuera de la precarga. Las
páginas sin conexión SHALL generarse sin leer sesión, cookies, usuario local de desarrollo ni D1, y
SHALL NOT contener nombre, email, avatar, token CSRF ni datos de grupos, ni establecer cookies. La
revocación de acceso SHALL seguir surtiendo efecto en la siguiente navegación o llamada.

#### Scenario: Contenido de la caché

- **GIVEN** el service worker instalado después de recorrer Inicio, Cuentas Claras, Perfil, Remanso y Jardín Zen con sesión
- **WHEN** se listan las entradas de la caché
- **THEN** son exactamente las de la lista de precarga y ninguna es `/`, `/remanso`, `/jardin-zen`, `/perfil`, `/groups/*`, `/api/*` ni `/auth/*`

#### Scenario: Página sin conexión pedida con sesión

- **WHEN** se pide `/sin-conexion/remanso` con una cookie de sesión válida
- **THEN** la respuesta no contiene el nombre ni el email de la persona, ni `_csrf`, no establece cookies y no consulta D1

#### Scenario: Usuario local de desarrollo

- **GIVEN** la app con `DEV_LOCAL_MODE` y `DEV_LOCAL_EMAIL`
- **WHEN** el service worker precarga las páginas sin conexión
- **THEN** las copias no contienen el usuario local

#### Scenario: Respuesta privada en la lista

- **WHEN** una ruta de la lista de precarga responde con `Cache-Control: private, no-store`
- **THEN** la instalación falla y sigue activa la versión anterior

#### Scenario: Lista desactualizada

- **WHEN** se agrega o modifica un archivo bajo `public/jardin-zen/` o `public/remanso/` sin regenerar la lista
- **THEN** la prueba de la lista falla

#### Scenario: Acceso revocado

- **GIVEN** una persona con la app instalada y su sesión revocada
- **WHEN** abre la app con conexión
- **THEN** el servidor la trata como sin acceso, igual que sin service worker

### Requirement: Páginas sin conexión

HomeSuite App SHALL servir, desde el Worker y con las cabeceras de seguridad comunes, una página
sin conexión genérica en `/sin-conexion` y versiones sin cuenta de Jardín Zen en
`/sin-conexion/jardin-zen` y de Remanso en `/sin-conexion/remanso`. Ante una navegación sin red, el
service worker SHALL responder con la copia de `/sin-conexion/jardin-zen` para `/jardin-zen`, con
la de `/sin-conexion/remanso` para `/remanso` y con la de `/sin-conexion` para cualquier otra ruta
navegada. La página genérica SHALL ofrecer reintentar sin JavaScript y SHALL nombrar las
herramientas que funcionan sin conexión. La copia de Remanso SHALL mostrar el nivel sin cuenta e
indicar que no hay conexión.

#### Scenario: Ruta cualquiera sin red

- **GIVEN** el service worker instalado
- **WHEN** sin conexión se navega a `/cuentas-claras`
- **THEN** se ve la página «Sin conexión» con un enlace para reintentar, sin datos de la persona

#### Scenario: Cabeceras de las páginas sin conexión

- **WHEN** se piden `/sin-conexion`, `/sin-conexion/jardin-zen` y `/sin-conexion/remanso` a un servidor en ejecución
- **THEN** llevan la política de contenido vigente, `X-Frame-Options: DENY` y `Cache-Control: no-cache`

### Requirement: Jardín Zen y Remanso funcionan sin conexión una vez visitados

Después de que el service worker se instaló en ese navegador o en esa app instalada, Jardín Zen y
Remanso SHALL abrir y funcionar sin conexión con los recursos de la versión instalada, sin
violaciones de la política de contenido y sin pedidos fallidos a recursos de la lista. Remanso sin
conexión SHALL ofrecer las opciones sin cuenta con sonido sintetizado.

#### Scenario: Jardín Zen sin red

- **GIVEN** el service worker instalado
- **WHEN** sin conexión se abre `/jardin-zen`
- **THEN** la escena se dibuja y se puede rastrillar

#### Scenario: Remanso sin red

- **GIVEN** el service worker instalado
- **WHEN** sin conexión se abre `/remanso`, se elige 1 minuto y se comienza
- **THEN** la sesión corre con las opciones sin cuenta y el aviso de que no hay conexión

#### Scenario: Primera visita sin red

- **GIVEN** un navegador que nunca abrió la app
- **WHEN** sin conexión se intenta abrir la app
- **THEN** se ve el error propio del navegador, sin promesas de funcionamiento sin conexión

### Requirement: Versión por contenido, instalación atómica y limpieza

La versión del service worker SHALL derivarse del contenido de todo lo precargado y del propio
código del service worker, de modo que cambie si y solo si cambia alguno. La versión SHALL formar
parte del texto de `/sw.js` y del nombre de la caché (`homesuite-pwa-<versión>`). La instalación
SHALL precargar la lista completa o fallar sin afectar a la versión activa. Al activarse, el
service worker SHALL tomar el control y SHALL borrar las cachés `homesuite-pwa-*` de otras
versiones, sin tocar otras cachés.

#### Scenario: Cambio de un recurso

- **WHEN** cambia el contenido de un archivo de la lista de precarga
- **THEN** cambia la versión servida en `/sw.js`

#### Scenario: Sin cambios

- **WHEN** se despliega de nuevo sin cambios en lo precargado ni en el service worker
- **THEN** la versión es la misma y el navegador no reinstala

#### Scenario: Limpieza al activar

- **GIVEN** cachés `homesuite-pwa-a`, `homesuite-pwa-b` y una caché ajena
- **WHEN** se activa la versión `b`
- **THEN** se borra `homesuite-pwa-a` y quedan `homesuite-pwa-b` y la ajena

### Requirement: Apagado del service worker

La app SHALL poder apagar el service worker en todos los dispositivos con un despliegue que fije
`PWA_SW=off`, sin cambiar código. En modo apagado, `/sw.js` SHALL servir un service worker sin
manejador de pedidos que borre las cachés `homesuite-pwa-*` y se desregistre sin recargar las
pestañas abiertas, y `/pwa.js` SHALL NOT registrar y SHALL desregistrar lo que encuentre. La ruta
`/sw.js` SHALL seguir respondiendo `200` en modo apagado.

#### Scenario: Apagar

- **GIVEN** un navegador con el service worker instalado
- **WHEN** la app se publica con `PWA_SW=off` y la persona navega una vez
- **THEN** no queda service worker registrado ni cachés `homesuite-pwa-*`, y la página abierta no se recarga

#### Scenario: Volver a encender

- **WHEN** la app se publica de nuevo sin `PWA_SW=off`
- **THEN** el registro vuelve a instalar el service worker normal

### Requirement: Convivencia con el audio de Remanso

El service worker SHALL NOT interceptar ni guardar `/remanso/audio/*` ni pedidos con `Range`, de
modo que los archivos de audio conserven su entrega por el almacén de assets, sus respuestas
parciales y la caché HTTP que defina su propia especificación. Sin conexión, la falta de un archivo
de audio SHALL resolverse con el respaldo que define Remanso, sin errores nuevos del service worker.

#### Scenario: Pedido parcial de audio

- **WHEN** el reproductor pide `/remanso/audio/lluvia.v1.opus` con `Range` y el service worker activo
- **THEN** el pedido llega a la red y la respuesta parcial no se guarda en la caché del service worker

#### Scenario: Lista de precarga sin audio

- **WHEN** se lee la lista de precarga
- **THEN** no contiene ninguna ruta bajo `/remanso/audio/`

### Requirement: Acceso con Google en la app instalada

El acceso con Google SHALL funcionar en la app instalada con el mismo flujo, cookies y
validaciones que en el navegador, sin intervención del service worker. Si el sistema devuelve el
retorno de Google sin la cookie de verificación (por ejemplo, en otro almacén de cookies), la app
SHALL mostrar la página de error de acceso con el encabezado de la suite y SHALL NOT crear una
sesión. El resultado en Android, escritorio e iPhone SHALL registrarse como verificación manual en
dispositivo real antes de publicar en producción.

#### Scenario: Retorno sin cookie de verificación

- **WHEN** llega `/auth/callback` con `code` y `state` pero sin la cookie `homesuite_oauth`
- **THEN** la respuesta es la página «No pudimos verificar el acceso» con enlace a Inicio y sin cookie de sesión

#### Scenario: Verificación en dispositivo

- **WHEN** se prepara la publicación en producción
- **THEN** existe el registro de la prueba de acceso con Google dentro de la app instalada en Android e iPhone, con dispositivo, versión y resultado

### Requirement: Costo acotado de las rutas nuevas

`/sw.js`, `/pwa.js`, `/manifest.webmanifest` y las páginas sin conexión SHALL NOT consultar D1.
Los íconos SHALL servirse desde el almacén de assets sin invocar al Worker. Las navegaciones SHALL
ir a la red con un único `fetch` (sin *navigation preload*, que duplica los pedidos no interceptados como `/auth/google`).

#### Scenario: Cero consultas

- **WHEN** se piden las rutas nuevas con y sin cookie de sesión
- **THEN** el contador de consultas a D1 queda en cero
