## Purpose

Definir las reglas de una sesión de Remanso: cuánto dura, cuándo suena el gong,
qué fondos existen y cómo se controla, para que el tiempo y el sonido sean
previsibles y no dependan de la pantalla que los muestra.

## ADDED Requirements

### Requirement: Duraciones disponibles

Remanso SHALL ofrecer sesiones de 1, 2, 5, 10, 20 y 30 minutos, y SHALL rechazar
cualquier otra duración antes de producir sonido.

#### Scenario: Elegir una duración válida

- **WHEN** la persona elige 10 minutos y comienza
- **THEN** la sesión dura 10 minutos y la pantalla muestra el tiempo restante

#### Scenario: Duración no soportada

- **WHEN** se intenta iniciar una sesión con una duración fuera de la lista
- **THEN** la sesión no empieza y no suena nada

### Requirement: Opciones libres y opciones con cuenta

Sin sesión de HomeSuite, Remanso SHALL permitir únicamente las duraciones de 1, 2
y 5 minutos, los fondos `silencio`, `agua` y `bosque` y el gong `brillante`. Con
sesión SHALL permitir además 10, 20 y 30 minutos, los fondos `lluvia`, `fuego` y
`noche` y los gongs `profundo` y `cuenco`. Una opción
no permitida SHALL NOT iniciar sonido. Los valores iniciales SHALL ser una opción
permitida para quien los ve.

#### Scenario: Sesión corta sin cuenta

- **WHEN** una persona sin sesión elige 5 minutos y agua y comienza
- **THEN** la sesión empieza normalmente

#### Scenario: Duración larga sin cuenta

- **WHEN** una persona sin sesión intenta usar 10, 20 o 30 minutos
- **THEN** no comienza ninguna sesión y se le ofrece entrar con su cuenta

#### Scenario: Fondo con cuenta sin sesión

- **WHEN** una persona sin sesión intenta usar lluvia, fuego o noche
- **THEN** no comienza ninguna sesión y se le ofrece entrar con su cuenta

#### Scenario: Con cuenta

- **WHEN** una persona con sesión elige cualquier duración y fondo
- **THEN** la sesión comienza normalmente

### Requirement: Momentos del gong

Hasta 10 minutos de duración, el gong SHALL sonar al inicio, a la mitad y al
final. En sesiones de más de 10 minutos SHALL sonar cada 5 minutos, incluidos
inicio y final. Los gongs de inicio y final SHALL ser más agudos, más fuertes y
más largos que los intermedios.

#### Scenario: Sesión corta

- **WHEN** la sesión es de 2 minutos
- **THEN** el gong suena en 0:00, 1:00 y 2:00

#### Scenario: Sesión larga

- **WHEN** la sesión es de 20 minutos
- **THEN** el gong suena en los minutos 0, 5, 10, 15 y 20

#### Scenario: Gong final distinto

- **WHEN** suenan el gong del medio y el gong final
- **THEN** el final es más agudo, más fuerte y se apaga más tarde

### Requirement: Sonidos de gong elegibles

Remanso SHALL ofrecer tres sonidos de gong con nombre: **Gong brillante**
(`brillante`, metálico y de golpe marcado; el predeterminado), **Gong profundo**
(`profundo`, una octava más grave y más largo) y **Cuenco tibetano** (`cuenco`, tono
agudo cantante de ataque suave). Todos se sintetizan en el dispositivo. El sonido
elegido SHALL aplicarse a todos los gongs de la sesión (inicio, mitad o cada 5
minutos, y final) y a «Probar gong»; en cada sonido los gongs de inicio y final
SHALL ser más agudos que los intermedios. La elección SHALL recordarse en el
dispositivo, SHALL NOT enviarse al servidor y SHALL ignorarse si el nivel de acceso
actual no la permite.

#### Scenario: Sonido predeterminado

- **WHEN** una persona abre Remanso por primera vez en un dispositivo
- **THEN** el gong elegido es el Gong brillante

#### Scenario: Elegir otro sonido

- **GIVEN** una persona con cuenta
- **WHEN** elige Cuenco tibetano y comienza una sesión
- **THEN** todos los gongs de esa sesión suenan como cuenco tibetano

#### Scenario: Probar con el sonido elegido

- **WHEN** la persona elige Gong profundo y presiona «Probar gong»
- **THEN** suena el gong de inicio y fin del Gong profundo

#### Scenario: Recordar la elección

- **GIVEN** una persona con cuenta que eligió Gong profundo
- **WHEN** vuelve a abrir Remanso en el mismo dispositivo
- **THEN** el Gong profundo ya está elegido

#### Scenario: Elección que el nivel actual no permite

- **GIVEN** un dispositivo donde se eligió Cuenco tibetano con cuenta
- **WHEN** se abre Remanso sin sesión
- **THEN** el gong elegido es el Gong brillante y la elección guardada no se aplica

### Requirement: El gong no oscila de volumen

Cada sonido de gong, en sus dos variantes (inicio/fin e intermedio), SHALL sonar sin
oscilaciones audibles de volumen (el «wa-wa» de dos tonos casi iguales que se
cancelan): tras quitar su caída natural, su volumen SHALL variar menos de 3 dB. El
Cuenco tibetano conserva un temblor lento y suave, propio de ese instrumento, y SHALL
variar menos de 4 dB. La inarmonicidad propia de cada sonido (parciales metálicos)
SHALL conservarse.

#### Scenario: Gong de inicio y fin

- **WHEN** se renderiza sin conexión el gong de inicio o fin de cada sonido y se mide su volumen en ventanas de 25 ms entre 0,5 y 10 s
- **THEN** la oscilación del volumen respecto de su caída es menor que 3 dB (4 dB para el Cuenco tibetano)

#### Scenario: Gong intermedio

- **WHEN** se hace la misma medición con el gong intermedio de cada sonido
- **THEN** la oscilación es menor que 3 dB (4 dB para el Cuenco tibetano)

### Requirement: Fondos sonoros

Remanso SHALL ofrecer los fondos `silencio`, `agua`, `lluvia`, `bosque`, `fuego` y
`noche`. Todos SHALL sintetizarse en el dispositivo, sin descargar audio. El fondo
SHALL entrar con un fundido de 4 s al comenzar y apagarse con un fundido de 6 s al
terminar. El volumen elegido SHALL aplicarse sólo al fondo, no a los gongs.

#### Scenario: Solo gongs

- **WHEN** la persona elige silencio
- **THEN** únicamente suenan los gongs

#### Scenario: Fondo con fundido

- **WHEN** la sesión con fondo llega a su fin
- **THEN** el fondo se apaga gradualmente mientras suena el gong final

#### Scenario: Cualquier fondo es válido

- **WHEN** la persona elige cada uno de los seis fondos
- **THEN** la sesión comienza sin error y sin descargar archivos de audio

### Requirement: El viento del bosque no tiene ráfagas fuertes

En el fondo `bosque`, las ráfagas de viento SHALL tener un nivel máximo de 0,20 sobre el
fondo (el motor del paquete llegaba a 0,65), sin editar el motor: la suite reemplaza
únicamente `windGust()` en `SuiteEngine`, igual que hace con el gong. El resto del
fondo (pájaros, hojas) y la cadencia de las ráfagas no cambian. El nivel SHALL poder
afinarse con una sola constante (ajuste del 2026-10-27, pedido de Pablo: ráfagas muy
fuertes).

#### Scenario: Nivel máximo de las ráfagas

- **WHEN** se generan muchas ráfagas con `SuiteEngine`
- **THEN** ninguna supera 0,20 de nivel y todas suben desde silencio y vuelven a silencio

#### Scenario: El motor sigue sin editar

- **WHEN** se compara `remanso-engine.js` con el del paquete
- **THEN** su huella SHA-256 es la original

### Requirement: Pausa, silencio del fondo y fin anticipado

La persona SHALL poder pausar y reanudar la sesión; al pausar se congelan juntos
el tiempo, los gongs programados y el fondo. SHALL poder silenciar sólo el fondo
sin afectar los gongs. SHALL poder terminar antes, con un fundido breve. Si el
sistema suspende el audio (por ejemplo, una llamada), la sesión SHALL mostrarse en
pausa.

#### Scenario: Pausar y reanudar

- **WHEN** la persona pausa a mitad de la sesión y reanuda luego
- **THEN** el tiempo restante y el siguiente gong continúan desde donde quedaron

#### Scenario: Silenciar el fondo

- **WHEN** la persona silencia el fondo
- **THEN** los gongs siguen sonando en sus momentos

#### Scenario: Terminar antes

- **WHEN** la persona termina la sesión antes de tiempo
- **THEN** el sonido se apaga con un fundido y el cierre registra el tiempo realmente transcurrido

#### Scenario: Audio suspendido por el sistema

- **WHEN** el sistema suspende el audio durante la sesión
- **THEN** la pantalla muestra la sesión en pausa y permite reanudarla

### Requirement: El sonido sólo empieza por un gesto

Una sesión y la prueba de gong SHALL comenzar únicamente como respuesta directa a
un toque o clic de la persona. Abrir la página o volver a ella SHALL NOT producir
sonido.

#### Scenario: Abrir Remanso

- **WHEN** la persona abre `/remanso`
- **THEN** no suena nada hasta que presiona «Comenzar» o «Probar gong»

### Requirement: La sesión no sobrevive a la pantalla

Al salir de Remanso o cerrar la página, el audio SHALL liberarse y no seguir
sonando. Durante la sesión la pantalla SHALL pedir mantenerse encendida y SHALL
funcionar igual si el navegador no lo soporta.

#### Scenario: Salir en medio de la sesión

- **WHEN** la persona navega a otra herramienta mientras la sesión está en curso
- **THEN** el sonido se detiene

#### Scenario: Navegador sin pantalla encendida

- **WHEN** el navegador no soporta mantener la pantalla encendida
- **THEN** la sesión transcurre con normalidad
