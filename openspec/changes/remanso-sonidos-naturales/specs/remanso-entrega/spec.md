## MODIFIED Requirements

### Requirement: Cabeceras en documentos y recursos propios

Toda respuesta de `/remanso` SHALL incluir las cabeceras de seguridad de la app,
incluidas la política de contenido, la prohibición de ser enmarcada y la
prohibición de adivinar tipos. Los archivos estáticos de Remanso SHALL entregarse
con su tipo de contenido correcto y la prohibición de adivinar tipos; los archivos
de audio SHALL entregarse como `audio/ogg`. Las
cabeceras SHALL verificarse sobre el servidor real, no sólo invocando el
manejador.

#### Scenario: Cabeceras del documento

- **WHEN** se pide `/remanso` a un servidor en ejecución
- **THEN** la respuesta incluye política de contenido, `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff`

#### Scenario: Recursos estáticos

- **WHEN** se piden el código y los estilos de Remanso
- **THEN** se entregan con tipo de contenido JavaScript y CSS respectivamente y `X-Content-Type-Options: nosniff`

#### Scenario: Recursos de audio

- **WHEN** se pide cada archivo de `/remanso/audio/` a un servidor en ejecución
- **THEN** se entrega con `Content-Type: audio/ogg` y `X-Content-Type-Options: nosniff`

#### Scenario: Ninguna ruta HTML existente queda sin cabeceras

- **WHEN** se piden `/`, `/tareas`, `/cuentas-claras`, `/compras` y `/perfil` a un servidor en ejecución
- **THEN** todas siguen incluyendo las cabeceras de seguridad

### Requirement: Sin datos ni esquema nuevos

Remanso SHALL NOT crear tablas, columnas ni migraciones, y SHALL NOT enviar al
servidor datos de la sesión de meditación (duración, estado de ánimo, gongs, pausas).
La única solicitud relacionada con el sonido SHALL ser la descarga del archivo público
del fondo natural elegido, que revela cuál es ese fondo y nada más. Esa solicitud SHALL
resolverse como archivo estático sin invocar el código de la app, de modo que la app no lee ninguna cookie
en ella ni la asocia a una cuenta.
Las únicas lecturas del servidor SHALL ser la sesión y el nombre del perfil;
una visita sin sesión SHALL NOT requerir lecturas de base de datos ni crear
cookies.

#### Scenario: Sesión completa sin datos de la sesión

- **WHEN** se completa una sesión
- **THEN** el navegador no envía al servidor ninguna petición con la duración, el estado de ánimo ni otros datos de la sesión, y las únicas peticiones de audio son las del archivo del fondo elegido, que la app no vincula a una cuenta

#### Scenario: El archivo de audio no pasa por el código de la app

- **WHEN** se pide un archivo de `/remanso/audio/`, con o sin cookie de sesión
- **THEN** lo sirve el almacén de archivos estáticos sin invocar al Worker, la respuesta no establece cookies y la configuración del despliegue no obliga a ejecutar el Worker primero para esa ruta

#### Scenario: Soporte de rangos para el flujo

- **WHEN** se pide un archivo de audio con una cabecera `Range` a un servidor en ejecución
- **THEN** responde 206 con `Accept-Ranges: bytes` y el fragmento pedido

#### Scenario: Sesión sintetizada sin tráfico de audio

- **GIVEN** la preferencia en Sintetizado
- **WHEN** se completa una sesión
- **THEN** el navegador no hace ninguna petición a `/remanso/audio/`

#### Scenario: Visita sin sesión

- **WHEN** una persona sin cookie de sesión abre y usa Remanso
- **THEN** el servidor no consulta la base de datos ni establece cookies

#### Scenario: Sin migraciones

- **WHEN** se prepara la publicación en staging
- **THEN** no hay migraciones de D1 pendientes por este cambio

## ADDED Requirements

### Requirement: Archivos de audio con nombre versionado y caché inmutable

Los archivos de audio de Remanso SHALL vivir en `/remanso/audio/` con el número de versión
en el nombre (`lluvia.v1.opus`), SHALL entregarse con `Cache-Control: public,
max-age=31536000, immutable` y su contenido SHALL NOT cambiar bajo el mismo nombre: un cambio
crea una versión nueva y retira la anterior. La política de contenido de la app SHALL NOT
cambiar por el audio (el audio es del mismo origen), y SHALL NOT haber audio ni código en otro
origen.

#### Scenario: Caché larga

- **WHEN** se pide un archivo de audio a un servidor en ejecución
- **THEN** la respuesta lleva `Cache-Control` con `immutable` y un `max-age` de un año

#### Scenario: Sin archivos huérfanos ni alterados

- **WHEN** se compara la carpeta de audio con el manifiesto de sonidos
- **THEN** cada archivo figura en el manifiesto con su SHA-256 y su tamaño, y todo archivo del manifiesto existe

#### Scenario: Política de contenido intacta

- **WHEN** se piden `/remanso` y las demás rutas HTML con este cambio
- **THEN** la política de contenido es idéntica a la anterior y una sesión con fondo natural no registra violaciones de la política
