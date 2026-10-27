## Purpose

Definir cómo se accede a Remanso dentro de HomeSuite y qué ve la persona en sus
tres pantallas: inicio, sesión y cierre, incluida la identidad visual de la suite
en modo claro y oscuro.

## ADDED Requirements

### Requirement: Acceso libre y acceso con cuenta

`/remanso` SHALL poder usarse sin sesión con las opciones libres (ver
`remanso-sesion`) y SHALL desbloquear todas las opciones con una sesión válida de
HomeSuite. Las opciones con cuenta SHALL verse marcadas como tales a quien no
tiene sesión; al elegirlas SHALL mostrarse una explicación breve y «Continuar con
Google» con retorno a `/remanso`, sin cambiar la selección vigente ni producir
sonido. La respuesta SHALL no almacenarse en cachés compartidas porque varía con
la sesión.

#### Scenario: Sin sesión

- **WHEN** una persona sin sesión abre `/remanso`
- **THEN** ve la pantalla de inicio con las opciones libres elegibles y las demás marcadas «con cuenta»

#### Scenario: Elegir una opción con cuenta sin sesión

- **WHEN** una persona sin sesión elige 20 minutos o lluvia
- **THEN** ve la invitación a entrar con Google que, al completarse, vuelve a `/remanso`, y su selección anterior no cambia

#### Scenario: Con sesión

- **WHEN** una persona autenticada abre `/remanso`
- **THEN** ve el inicio con todas las opciones elegibles y su avatar y nombre en el encabezado

#### Scenario: Ambiente sin acceso configurado

- **WHEN** el ambiente no tiene configurado el acceso con Google
- **THEN** las opciones libres funcionan y las opciones con cuenta explican que el acceso no está disponible en este ambiente

#### Scenario: Sin almacenamiento compartido

- **WHEN** se pide `/remanso`
- **THEN** la respuesta indica que es privada y no debe guardarse

#### Scenario: Sin almacenamiento compartido

- **WHEN** se pide `/remanso`
- **THEN** la respuesta indica que es privada y no debe guardarse

### Requirement: Entrada provisional en la suite

HomeSuite SHALL mostrar Remanso como una herramienta más en la home, junto a Tareas,
Cuentas Claras y Compras. El menú general (Inicio, Mis grupos y la cuenta) no lista
herramientas, por lo que Remanso no aparece ahí (ajuste del 2026-10-27, al integrar
con el menú de la app). No SHALL agrupar ni nombrar mitades de la suite en este corte.

#### Scenario: Elegir Remanso desde la home

- **WHEN** la persona activa la tarjeta o el enlace de Remanso
- **THEN** llega a `/remanso`

#### Scenario: Las otras herramientas no cambian

- **WHEN** se visitan `/tareas`, `/cuentas-claras` y `/compras`
- **THEN** se comportan como antes

### Requirement: Pantalla de inicio

El inicio SHALL permitir elegir duración, fondo y sonido de gong, ajustar el volumen
del fondo, probar el gong y comenzar. Los tres sonidos de gong SHALL mostrarse como
opciones con nombre; las que requieren cuenta SHALL seguir el mismo tratamiento que
las demás opciones con cuenta. SHALL mostrar los momentos de gong de la duración
elegida y el rótulo del botón con los minutos («Comenzar · N min»). Los valores
iniciales SHALL ser 10 minutos, lluvia y volumen 55 con sesión, y 5 minutos, agua
y volumen 55 sin sesión.

#### Scenario: Cambiar la duración

- **WHEN** la persona elige 30 minutos
- **THEN** la línea de gongs muestra 0, 5, 10, 15, 20, 25 y 30 minutos y el botón dice «Comenzar · 30 min»

#### Scenario: Probar el gong

- **WHEN** la persona presiona «Probar gong»
- **THEN** suena el gong de inicio y fin del sonido elegido y no comienza ninguna sesión

#### Scenario: Elegir el sonido del gong sin cuenta

- **WHEN** una persona sin sesión abre el inicio
- **THEN** ve el Gong brillante elegido y el Gong profundo y el Cuenco tibetano marcados «con cuenta», que al elegirlos explican y ofrecen entrar sin cambiar la selección

### Requirement: Pantalla de sesión

La sesión SHALL ocupar la pantalla con fondo oscuro en cualquier esquema de color,
mostrar el tiempo restante, el progreso con una marca por gong, el tiempo hasta el
próximo gong («Próximo gong en» o «Gong final en»), una frase guía y los controles
terminar, pausar/reanudar y silenciar fondo. Con fondo «silencio» el control de
silenciar SHALL ocultarse sin mover los demás.

#### Scenario: Sesión en curso

- **WHEN** transcurre una sesión
- **THEN** el tiempo restante y el anillo avanzan y las marcas de gong ya sonadas se distinguen de las pendientes

#### Scenario: Estado de pausa

- **WHEN** la sesión está en pausa
- **THEN** el control muestra «Reanudar» y la pantalla indica «En pausa»

#### Scenario: Enfoque

- **WHEN** la sesión está en curso
- **THEN** el encabezado de la suite no se muestra y terminar es siempre alcanzable

### Requirement: Cierre con reconocimiento por nombre

Al terminar, la pantalla SHALL mostrar cuánto duró la sesión («Cinco minutos de
calma», o «N minutos de calma» si terminó antes) y, con sesión, SHALL reconocer a
la persona por el nombre de su perfil global. Sin sesión SHALL omitir el nombre y
SHALL NOT mostrar invitaciones, enlaces ni mensajes sobre crear una cuenta: la
existencia de más opciones con cuenta ya se comunica en el inicio. SHALL ofrecer
«Volver al inicio» y «Repetir sesión».
La pregunta «¿Cómo te sentís?» con «En calma», «Igual» y «Con inquietud» SHALL ser
opcional y su respuesta SHALL NOT guardarse ni enviarse.

#### Scenario: Sesión completa con cuenta

- **GIVEN** una persona llamada Pablo
- **WHEN** completa una sesión de 20 minutos
- **THEN** ve «Veinte minutos de calma» y un mensaje que la nombra como Pablo

#### Scenario: Sesión completa sin cuenta

- **WHEN** una persona sin sesión completa una sesión de 5 minutos
- **THEN** ve «Cinco minutos de calma» sin ningún nombre y sin ninguna mención a crear una cuenta

#### Scenario: Repetir sin cuenta

- **WHEN** una persona sin sesión presiona «Repetir sesión»
- **THEN** comienza con la misma duración, fondo y volumen, todos del nivel libre

#### Scenario: Sesión terminada antes

- **WHEN** termina después de 3 minutos de una sesión de 10
- **THEN** el cierre dice «3 minutos de calma»

#### Scenario: Nombre del perfil actualizado

- **WHEN** la persona cambió su nombre en `/perfil`
- **THEN** el cierre la nombra con el nombre vigente

#### Scenario: Nombre con caracteres especiales

- **WHEN** el nombre contiene `<`, `&` o comillas
- **THEN** se muestra como texto sin interpretarse como código

#### Scenario: Estado de ánimo sin persistencia

- **WHEN** la persona elige un estado de ánimo y vuelve al inicio
- **THEN** no se envía ni se almacena en ningún sitio y la próxima sesión empieza sin selección

#### Scenario: Repetir

- **WHEN** la persona presiona «Repetir sesión»
- **THEN** comienza una sesión con la misma duración, fondo y volumen

### Requirement: Identidad de la suite en claro y oscuro

Remanso SHALL usar la identidad visual de HomeSuite (paleta, tipografía y formas) y
SHALL seguir el esquema claro u oscuro del sistema en inicio y cierre. SHALL no
cargar fuentes ni recursos de otros orígenes. El texto y los controles SHALL
cumplir contraste AA en ambos esquemas.

#### Scenario: Esquema claro

- **WHEN** el sistema prefiere esquema claro
- **THEN** inicio y cierre usan la paleta clara de la suite, incluido el encabezado

#### Scenario: Esquema oscuro

- **WHEN** el sistema prefiere esquema oscuro
- **THEN** inicio y cierre usan la paleta oscura de la suite, incluido el encabezado

### Requirement: Accesibilidad y adaptación al dispositivo

Las tres pantallas SHALL poder operarse con teclado, con foco visible, nombres
accesibles para todo control sin texto, selección comunicada a tecnologías de
asistencia y objetivos táctiles de al menos 44 píxeles. SHALL ajustarse a 360 px
de ancho sin desbordar y respetar la preferencia de movimiento reducido. El
progreso SHALL comunicarse también con texto.

#### Scenario: Teclado

- **WHEN** la persona recorre el inicio con Tab y activa con Enter o Espacio
- **THEN** puede elegir duración, fondo, volumen y comenzar sin ratón

#### Scenario: Viewport angosto

- **WHEN** la pantalla mide 360 px de ancho
- **THEN** ninguna pantalla desborda horizontalmente ni recorta texto

#### Scenario: Lector de pantalla

- **WHEN** cambia el tiempo restante
- **THEN** el valor está disponible como texto, sin anunciarse cada segundo de forma intrusiva
