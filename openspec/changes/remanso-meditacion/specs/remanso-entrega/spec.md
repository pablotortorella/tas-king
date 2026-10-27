## Purpose

Garantizar que Remanso se entregue de forma segura y reproducible: sin código ni
estilos incrustados, con cabeceras de seguridad en todas sus respuestas y con el
motor de sonido idéntico al del paquete de origen.

## ADDED Requirements

### Requirement: Sin contenido incrustado ni orígenes externos

Los documentos de Remanso SHALL cargar su código y estilos únicamente desde el
propio origen. No SHALL contener scripts, estilos ni manejadores de eventos en
línea, ni atributos de estilo en el marcado. No SHALL cargar fuentes, scripts, hojas de
estilo ni imágenes de otros orígenes, salvo la foto de perfil de Google que el
encabezado de la suite ya muestra bajo su política vigente. La política de seguridad de
contenido vigente de la app SHALL conservarse sin relajarse.

#### Scenario: Documento limpio

- **WHEN** se inspecciona el HTML de `/remanso`
- **THEN** no hay `<script>` sin `src`, ni `<style>`, ni atributos `style` u `on*`, y todo recurso es del mismo origen

#### Scenario: Navegador real

- **WHEN** se recorre inicio, sesión y cierre en un navegador
- **THEN** no se registra ninguna violación de la política de contenido

#### Scenario: Política sin relajar

- **WHEN** se piden `/remanso` y las demás rutas HTML
- **THEN** la política de contenido es la misma de antes del cambio

### Requirement: Cabeceras en documentos y recursos propios

Toda respuesta de `/remanso` SHALL incluir las cabeceras de seguridad de la app,
incluidas la política de contenido, la prohibición de ser enmarcada y la
prohibición de adivinar tipos. Los archivos estáticos de Remanso SHALL entregarse
con su tipo de contenido correcto y la prohibición de adivinar tipos. Las
cabeceras SHALL verificarse sobre el servidor real, no sólo invocando el
manejador.

#### Scenario: Cabeceras del documento

- **WHEN** se pide `/remanso` a un servidor en ejecución
- **THEN** la respuesta incluye política de contenido, `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff`

#### Scenario: Recursos estáticos

- **WHEN** se piden el código y los estilos de Remanso
- **THEN** se entregan con tipo de contenido JavaScript y CSS respectivamente y `X-Content-Type-Options: nosniff`

#### Scenario: Ninguna ruta HTML existente queda sin cabeceras

- **WHEN** se piden `/`, `/tareas`, `/cuentas-claras`, `/compras` y `/perfil` a un servidor en ejecución
- **THEN** todas siguen incluyendo las cabeceras de seguridad

### Requirement: El motor de sonido se integra tal cual

El motor SHALL integrarse sin modificar su contenido respecto del paquete de
origen, y su fuente de verdad SHALL ser un único archivo. Los sonidos de gong
propios de Remanso SHALL vivir en un módulo aparte que reemplaza únicamente la
síntesis del gong, sin editar el motor. Una prueba SHALL fallar si el archivo
servido difiere de la huella registrada del paquete; actualizar el motor SHALL
requerir cambiar la huella de forma explícita.

#### Scenario: Motor idéntico al paquete

- **WHEN** se calcula la huella del motor servido
- **THEN** coincide con la registrada para el paquete de origen

#### Scenario: Motor modificado sin registrar

- **WHEN** el archivo del motor cambia
- **THEN** la prueba falla

### Requirement: Sin datos ni esquema nuevos

Remanso SHALL NOT crear tablas, columnas ni migraciones, y SHALL NOT enviar al
servidor datos de la sesión de meditación (duración, fondo, estado de ánimo).
Las únicas lecturas del servidor SHALL ser la sesión y el nombre del perfil;
una visita sin sesión SHALL NOT requerir lecturas de base de datos ni crear
cookies.

#### Scenario: Sesión completa sin tráfico de datos

- **WHEN** se completa una sesión
- **THEN** el navegador no envía al servidor ninguna petición con datos de la sesión

#### Scenario: Visita sin sesión

- **WHEN** una persona sin cookie de sesión abre y usa Remanso
- **THEN** el servidor no consulta la base de datos ni establece cookies

#### Scenario: Sin migraciones

- **WHEN** se prepara la publicación en staging
- **THEN** no hay migraciones de D1 pendientes por este cambio

### Requirement: Publicación en staging con el protocolo común

La primera versión SHALL publicarse en el Worker de staging existente sólo con
confirmación explícita de Pablo, tras ejecutar las suites afectadas sobre el SHA
a publicar, y SHALL registrar SHA, versión, pruebas y límites. Producción SHALL
quedar intacta.

#### Scenario: Antes de publicar

- **WHEN** se va a publicar en staging
- **THEN** las suites afectadas pasaron sobre ese SHA y Pablo confirmó la publicación

#### Scenario: Después de publicar

- **WHEN** termina la publicación en staging
- **THEN** un smoke del mismo SHA confirma `/remanso` y sus recursos con cabeceras y el resultado se registra en STATUS

#### Scenario: Producción

- **WHEN** termina el trabajo de este cambio
- **THEN** ningún recurso de producción fue modificado
