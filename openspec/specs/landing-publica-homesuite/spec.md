# landing-publica-homesuite Specification

## Purpose
Definir la portada pública de HomeSuite, el acceso a Fun TasKing y la presentación
honesta de los próximos productos, sin identidad, sesiones ni datos de aplicación.
## Requirements
### Requirement: La portada presenta HomeSuite

La portada pública SHALL identificar el sitio como HomeSuite y SHALL explicar en
lenguaje breve que reúne herramientas para organizar lo cotidiano y que sigue creciendo
hacia el cuidado y el disfrute del hogar, sin presuponer que viven varias personas
juntas. SHALL NOT afirmar como disponible ninguna herramienta que no lo esté. El
contenido SHALL poder leerse y navegarse sin JavaScript, autenticación ni cookies.

#### Scenario: Primera visita al dominio

- **WHEN** una persona abre la portada de HomeSuite
- **THEN** ve el nombre HomeSuite, un mensaje de bienvenida, el título «Organizá, cuidá y disfrutá tu hogar.» y una explicación breve de la suite

#### Scenario: JavaScript no está disponible

- **WHEN** el navegador no ejecuta JavaScript
- **THEN** todo el contenido y todos los enlaces de la portada siguen disponibles

### Requirement: Fun TasKing está disponible desde la portada

La portada SHALL mostrar Fun TasKing como herramienta disponible y SHALL enlazar
a su landing pública en `/tareas`. Esa landing SHALL ofrecer un enlace con nombre
accesible hacia `https://tas-king.pablotortorella.workers.dev` y SHALL explicar
que la aplicación aún vive en su dirección actual.

#### Scenario: Conocer y abrir Fun TasKing

- **WHEN** una persona activa el enlace de Fun TasKing en la portada
- **THEN** llega a `/tareas` y encuentra un enlace a la URL productiva actual

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL NOT simular como disponible una herramienta que todavía no lo está: una herramienta en preparación
SHALL NOT usar botones, formularios ni controles deshabilitados que sugieran una función disponible, y debe tener una
landing estática, sin JavaScript, que explique el producto sin fingir que la aplicación ya existe. Remanso, Cuentas Claras
y Fun TasKing funcionan hoy y se rotulan según el requisito «El estado de cada herramienta se rotula con precisión»; una
herramienta que todavía no existe no se muestra (ver «El catálogo público muestra sólo herramientas funcionales»).

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** distingue Fun TasKing como disponible y Cuentas Claras y Remanso como versión beta, sin controles que finjan una función inexistente

#### Scenario: Landing de Remanso en el sitio público

- **WHEN** una persona abre la landing de Remanso
- **THEN** lee qué es Remanso, que está en versión beta y encuentra «Entrar a Remanso» hacia la app de su ambiente

### Requirement: La portada se adapta al dispositivo

La portada SHALL conservar jerarquía, legibilidad y acceso al CTA en pantallas de
360 píxeles de ancho o mayores, sin overflow horizontal. SHALL respetar la
preferencia de esquema claro u oscuro del sistema.

#### Scenario: Abrir desde un teléfono

- **WHEN** la portada se abre en un viewport de 360 píxeles
- **THEN** el contenido cabe horizontalmente, el CTA es visible y los textos no se recortan

#### Scenario: Preferencia de color oscura

- **WHEN** el sistema de la persona prefiere un esquema oscuro
- **THEN** la portada usa la variante oscura manteniendo contraste y legibilidad

### Requirement: El dominio canónico es el apex

El Worker SHALL redirigir toda solicitud a `www.homesuite.info` hacia el mismo
path y query string en `https://homesuite.info` con estado permanente 308.

#### Scenario: Visita mediante www

- **WHEN** una persona solicita `https://www.homesuite.info/ruta?origen=www`
- **THEN** recibe una redirección 308 a `https://homesuite.info/ruta?origen=www`

### Requirement: La superficie pública es mínima y endurecida

El Worker SHALL aceptar únicamente `GET` y `HEAD`, SHALL servir assets sin D1,
R2, OAuth ni secretos y SHALL incluir cabeceras que impidan framing, sniffing de
contenido y acceso a capacidades innecesarias del navegador.

#### Scenario: Servir la portada

- **WHEN** un cliente solicita la portada con `GET` o `HEAD`
- **THEN** el Worker delega el contenido al asset server y agrega las cabeceras de seguridad

#### Scenario: Método no permitido

- **WHEN** un cliente envía `POST`, `PUT`, `PATCH` o `DELETE`
- **THEN** recibe estado 405 y una cabecera `Allow` limitada a `GET, HEAD`

### Requirement: Cada producto tiene una landing pública canónica

El sitio SHALL servir páginas informativas en `/tareas`, `/cuentas-claras` y `/remanso` con un título propio, navegación
de regreso a HomeSuite y contenido disponible sin JavaScript, autenticación ni cookies. Las páginas SHALL conservar la
legibilidad y el acceso a sus enlaces en 360 píxeles y en esquemas claro y oscuro. `/gastos` SHALL NOT servir la landing de
Cuentas Claras ni redirigir a ella, y `/compras` SHALL responder 404 mientras esa herramienta no exista.

#### Scenario: Abrir directamente una landing

- **WHEN** una persona solicita cualquiera de las tres rutas públicas canónicas
- **THEN** recibe su página de producto por HTTPS y puede volver a la portada

#### Scenario: Visitar la ruta anterior

- **WHEN** una persona solicita `/gastos`
- **THEN** no recibe una redirección ni contenido de Cuentas Claras

#### Scenario: Visitar una herramienta que no existe

- **WHEN** una persona solicita `/compras`
- **THEN** la respuesta es 404

#### Scenario: Visitar desde un teléfono

- **WHEN** una landing se abre con viewport de 360 píxeles
- **THEN** el contenido y sus enlaces caben sin overflow horizontal

### Requirement: El catálogo público muestra sólo herramientas funcionales

La portada SHALL mostrar únicamente las herramientas que funcionan hoy (Fun TasKing, Cuentas Claras y
Remanso). Una herramienta que todavía no existe SHALL NOT tener tarjeta en la portada, landing publicada ni
enlace desde otra página, y su ruta SHALL responder 404.

#### Scenario: Tres herramientas

- **WHEN** una persona abre la portada
- **THEN** ve tres tarjetas de herramientas y ninguna menciona Compras

#### Scenario: Herramienta oculta

- **WHEN** se pide `/compras` o `/compras.html`
- **THEN** la respuesta es 404 y ninguna landing enlaza a esa ruta

### Requirement: El estado de cada herramienta se rotula con precisión

La portada SHALL rotular Fun TasKing «Disponible» y Cuentas Claras y Remanso «Versión Beta». Ninguna
página SHALL decir «Próximamente» ni «En preparación». Las landings de herramientas en beta SHALL decir
«Esta herramienta está en versión beta.» y SHALL ofrecer la entrada a la app de su ambiente (ver `textos-y-enlaces-de-produccion`).

#### Scenario: Rótulos de la portada

- **WHEN** una persona abre la portada
- **THEN** ve una tarjeta «Disponible» y dos «Versión Beta», y ningún «Próximamente»

#### Scenario: Landing de una herramienta en beta

- **WHEN** se abre la landing de Cuentas Claras o de Remanso
- **THEN** dice «Esta herramienta está en versión beta.» y ofrece «Entrar a …» hacia la app de ese ambiente

### Requirement: Cada herramienta tiene su acento

Cada herramienta SHALL tener un color de acento propio en la portada y en su landing: verde para Fun TasKing,
terracota para Cuentas Claras y ámbar para Remanso, con variante clara y oscura. El acento SHALL usarse sólo en
rótulos, bordes e íconos, no como fondo de texto blanco, y SHALL leerse con contraste de al menos 4,5:1 sobre la
página, la tarjeta y su propio fondo suave.

#### Scenario: Contraste de los acentos

- **WHEN** se evalúan los colores de acento de cada herramienta en esquema claro y oscuro
- **THEN** cada uno cumple 4,5:1 sobre la página, la tarjeta y su fondo suave

#### Scenario: Cada página declara su producto

- **WHEN** se revisan las tarjetas de la portada y las tres landings
- **THEN** cada una declara el producto cuyo acento usa

### Requirement: La portada se conecta con Remanso

El texto del hero SHALL mencionar los momentos de calma sin frases temporales sobre
herramientas que «se están sumando». El hero SHALL ofrecer «Probá Remanso», un enlace a
Remanso en la app del propio ambiente: `https://app.homesuite.info/remanso` en producción y
`https://staging.homesuite.info/remanso` en staging (revisado el 2026-10-28 por
`textos-y-enlaces-de-produccion`; antes sólo existía en staging porque la app no tenía producción).
El sitio de producción SHALL NOT contener enlaces a staging.

#### Scenario: Hero en staging

- **WHEN** se pide la portada al sitio de staging
- **THEN** el hero muestra «Probá Remanso» hacia la app de staging, con `X-Robots-Tag: noindex` y sin caché

#### Scenario: Hero en producción

- **WHEN** se pide la portada a `homesuite.info`
- **THEN** el hero muestra «Probá Remanso» hacia `app.homesuite.info` y ningún enlace a staging

### Requirement: Los textos no presuponen convivencia ni dividen la suite

Los textos de la portada y de las landings SHALL hablar del hogar sin presuponer convivencia
(«vida compartida», «en equipo», «organizarnos») y SHALL presentar compartir como una
posibilidad cuando la función lo es (repartos de gastos, tableros compartidos), nunca como
requisito. SHALL describir cada herramienta por lo que hace, sin llamarla «una mitad» de la
suite ni agruparlas por categorías. La portada SHALL cerrar con «Tu hogar, a tu ritmo.» (una sola vez) y el pie de las páginas SHALL usar «Herramientas pequeñas para cosas importantes.» (ajuste del 2026-10-28). Los textos SHALL usar lenguaje no excluyente, sin formas con género como «solo/sola»: «por tu cuenta o con tu equipo».

#### Scenario: Ninguna página presupone convivencia

- **WHEN** se revisa el texto visible de la portada y de las cuatro landings
- **THEN** no aparecen «vida compartida», «en equipo», «del equipo», «organizarnos» ni «la otra mitad»

#### Scenario: La landing de Remanso no habla de cuentas

- **WHEN** se lee la landing de Remanso, con o sin el botón de staging
- **THEN** no dice si se necesita una cuenta («sin crear una cuenta», «no piden cuenta»): qué opciones requieren cuenta lo decide y lo muestra la app

#### Scenario: Compartir como posibilidad

- **WHEN** una persona lee la landing de Fun TasKing o de Cuentas Claras
- **THEN** entiende que puede usarla sola y que compartir tableros, repartos y saldos es una opción

### Requirement: El sitio apunta a la app de su ambiente

El HTML publicado SHALL llevar los enlaces de producción: a `https://app.homesuite.info/<herramienta>` para Cuentas
Claras y Remanso y al TasKing de producción para Fun TasKing. El sitio de staging SHALL reescribirlos a los de su propio
ambiente (`https://staging.homesuite.info`, TasKing de staging) y SHALL NOT apuntar nunca a producción. El sitio de
producción SHALL NOT contener ningún enlace a staging.

#### Scenario: Landing de una herramienta en producción

- **WHEN** se abre `/cuentas-claras` o `/remanso` en `homesuite.info`
- **THEN** ofrece «Entrar a …» hacia `app.homesuite.info` y la portada ofrece «Probá Remanso» hacia la misma app

#### Scenario: Mismo contenido en staging

- **WHEN** se piden las mismas páginas al sitio de staging
- **THEN** los enlaces apuntan a `staging.homesuite.info` y al TasKing de staging, con `noindex` y sin caché

### Requirement: Los textos reflejan las herramientas activas

El sitio SHALL presentar Fun TasKing como disponible y Cuentas Claras y Remanso como activas en versión beta, en
presente («Ya podés usarla; la seguimos mejorando»), sin frases que las traten como futuras («Estamos creando»,
«llegarán»). Los términos SHALL mencionar que las herramientas en versión beta pueden cambiar o tener errores.

#### Scenario: Portada

- **WHEN** una persona lee la portada
- **THEN** no hay promesas de herramientas futuras y las tarjetas dicen «Disponible» y «Versión Beta»

### Requirement: Compras no se nombra en ningún ambiente

Mientras la herramienta no exista, ni el sitio público ni la app SHALL mostrarla ni nombrarla: sin tarjeta, ruta, landing ni
enlace, y `/compras` SHALL responder 404 en ambos.

#### Scenario: Sitio y app sin Compras

- **WHEN** se revisan la portada, las landings, los términos y el inicio de la app, y se piden `/compras` y `/compras.html`
- **THEN** ninguna página nombra Compras y las rutas responden 404

### Requirement: El sitio y la app son coherentes

Las herramientas, sus estados y sus rutas anunciados por el sitio SHALL coincidir con la lista de herramientas de la app:
mismas herramientas en el mismo orden, mismo estado, cada enlace a una ruta que la app tiene y que responde, y
ninguna herramienta retirada nombrada. Esa comprobación SHALL correr en CI contra el HTML del repositorio y SHALL poder correr
contra lo publicado en staging y en producción.

#### Scenario: Desvíos

- **WHEN** el sitio anuncia una herramienta que la app no tiene, un estado distinto, una ruta inexistente, una herramienta retirada o el TasKing de otro ambiente
- **THEN** la comprobación falla y nombra el desvío

