## Purpose

Definir la versión natural (grabada) de los fondos de Remanso y cómo convive con la
sintetizada: quién puede usarla, cómo se elige, cuándo se descarga, qué pasa si falla, cómo
se empalma el bucle, cuánta memoria usa y de dónde viene cada archivo, sin tocar el motor
de sonido.

## ADDED Requirements

### Requirement: Versión natural de cada fondo con sonido

Remanso SHALL ofrecer una versión natural de los fondos `agua`, `lluvia`, `bosque`, `fuego` y
`noche`: una grabación en Ogg Opus del mismo origen, y SHALL estar activada por defecto para todas las personas. `silencio` no tiene versión natural. La
versión natural SHALL estar disponible en cada fondo que el nivel de acceso de la persona ya
permite, con y sin cuenta, y SHALL NOT cambiar qué fondos, duraciones ni gongs permite cada
nivel. Los gongs SHALL seguir sintetizándose.

#### Scenario: Sin cuenta

- **GIVEN** una persona sin sesión con la preferencia en Natural
- **WHEN** elige agua o bosque y comienza
- **THEN** la sesión suena con la grabación de ese fondo

#### Scenario: Con cuenta

- **GIVEN** una persona con sesión y la preferencia en Natural
- **WHEN** elige lluvia, fuego o noche y comienza
- **THEN** la sesión suena con la grabación de ese fondo

#### Scenario: Los niveles no cambian

- **WHEN** una persona sin sesión intenta elegir lluvia, fuego o noche
- **THEN** no comienza ninguna sesión, se le ofrece entrar con su cuenta y no se descarga ningún audio

#### Scenario: Los gongs no cambian

- **WHEN** suena un gong en una sesión con fondo natural
- **THEN** es el gong sintetizado elegido, igual que con el fondo sintetizado

### Requirement: Preferencia Natural o Sintetizado por dispositivo

La persona SHALL poder elegir entre «Natural» y «Sintetizado» para los fondos. La elección SHALL
recordarse en el dispositivo (`localStorage`, clave `remanso:sonido`), SHALL NOT enviarse al
servidor y SHALL valer igual con y sin cuenta. Por defecto SHALL ser Natural. Un valor guardado no
reconocido, o un navegador sin `localStorage`, SHALL equivaler al valor por defecto sin error.

#### Scenario: Valor por defecto

- **WHEN** una persona abre Remanso por primera vez en un dispositivo
- **THEN** la preferencia está en Natural

#### Scenario: Recordar la elección

- **GIVEN** una persona que eligió Sintetizado
- **WHEN** vuelve a abrir Remanso en el mismo dispositivo
- **THEN** Sintetizado ya está elegido y no se descarga ninguna grabación

#### Scenario: Sin almacenamiento

- **WHEN** el navegador no deja usar `localStorage`
- **THEN** la preferencia funciona durante la visita y la sesión transcurre con normalidad

#### Scenario: Valor guardado no reconocido

- **GIVEN** un valor guardado distinto de `natural` y `sintetizado`
- **WHEN** se abre Remanso
- **THEN** la preferencia es Natural

### Requirement: Respaldo automático al sintetizado

Si la versión natural no puede usarse, el fondo SHALL sonar sintetizado sin pedir nada a la
persona. Eso incluye: el navegador no reproduce Ogg Opus, la descarga falla o devuelve un estado
distinto de 200 o un tipo inesperado, el archivo no se decodifica, o la grabación no estuvo lista
(o el flujo no empezó a sonar) a los 3 s de presionar «Comenzar». La sesión SHALL sonar entera con una sola versión: nunca se mezclan
ni se cambia de versión a mitad de sesión. Cuando la preferencia era Natural y se usó el sintetizado, la
pantalla de sesión SHALL indicarlo («sintetizado») sin alertas ni sonidos extra. Un fallo SHALL NOT
impedir un nuevo intento al volver a elegir ese fondo.

#### Scenario: Descarga fallida

- **GIVEN** la preferencia en Natural y una descarga que falla
- **WHEN** la persona presiona «Comenzar»
- **THEN** la sesión empieza con el fondo sintetizado, sin error visible, y la sesión indica «sintetizado»

#### Scenario: Archivo que no se decodifica

- **GIVEN** un archivo corrupto o un navegador que rechaza Ogg Opus al decodificar
- **WHEN** la persona presiona «Comenzar»
- **THEN** la sesión empieza con el fondo sintetizado y la sesión indica «sintetizado»

#### Scenario: Carga lenta

- **GIVEN** una descarga que tarda más de 3 s
- **WHEN** la persona presiona «Comenzar»
- **THEN** el botón dice «Preparando el sonido…» hasta 3 s, después la sesión empieza sintetizada completa y la descarga sigue para la próxima sesión

#### Scenario: Doble toque mientras se prepara

- **WHEN** la persona presiona «Comenzar» dos veces mientras espera la grabación
- **THEN** se inicia una sola sesión

#### Scenario: Reintento tras un fallo

- **GIVEN** un fondo que falló al cargar
- **WHEN** la persona elige otro fondo y luego vuelve a elegir ese
- **THEN** se intenta descargarlo de nuevo

#### Scenario: Navegador sin Ogg Opus

- **WHEN** el navegador no reproduce Ogg Opus
- **THEN** no se descarga ningún audio y los fondos suenan sintetizados

### Requirement: Se descarga solo el fondo elegido

La grabación SHALL descargarse únicamente cuando la preferencia es Natural, el navegador reproduce
Ogg Opus y el fondo elegido tiene versión natural y lo permite el nivel de la persona. Un fondo reproducido en
buffer SHALL comenzar a descargarse al elegirlo (incluido el inicial al abrir el inicio), antes de «Comenzar», y
SHALL pedirse sin cookies; un fondo reproducido en flujo SHALL pedirse al comenzar la sesión. SHALL mantenerse a lo
sumo un fondo decodificado en memoria: al elegir otro se suelta el anterior.

#### Scenario: Solo el elegido

- **WHEN** una persona abre el inicio y elige un fondo con la preferencia en Natural
- **THEN** el navegador pide únicamente el archivo de ese fondo y ninguno de los otros

#### Scenario: Cambiar de fondo

- **WHEN** la persona elige otro fondo
- **THEN** se pide el archivo del nuevo fondo, se suelta el buffer del anterior y no quedan dos fondos decodificados

#### Scenario: Sin cookies en los fondos en buffer

- **WHEN** el navegador pide el archivo de un fondo reproducido en buffer
- **THEN** la solicitud no lleva la cookie de sesión de HomeSuite

#### Scenario: El flujo se pide al comenzar

- **GIVEN** la preferencia en Natural y la lluvia elegida
- **WHEN** la persona todavía no presionó «Comenzar»
- **THEN** no se pidió el archivo de la lluvia

#### Scenario: Preferencia Sintetizado o silencio

- **WHEN** la preferencia es Sintetizado o el fondo es silencio
- **THEN** no se hace ninguna solicitud de audio

### Requirement: La grabación usa el motor tal cual

La versión natural SHALL integrarse en una capa propia que extiende la clase del motor, sin editarlo: la
sesión arranca con el fondo `silencio` y la grabación se conecta al nodo de ganancia del fondo que el motor ya
crea, de modo que heredan sin cambios el fundido de entrada de 4 s, el de salida de 6 s, el volumen, el
silencio del fondo, la pausa y el cierre. La huella SHA-256 de `remanso-engine.js` SHALL seguir siendo la
registrada, y importar la capa SHALL NOT modificar la clase base. Todas las fuentes de una sesión SHALL
detenerse al terminar ella, al terminarla antes de tiempo y al empezar otra sesión.

#### Scenario: Motor intacto

- **WHEN** se calcula la huella del motor servido y se importa la capa
- **THEN** la huella coincide con la registrada y la clase base conserva sus métodos

#### Scenario: La grabación cuelga del fondo del motor

- **WHEN** empieza una sesión natural
- **THEN** el motor recibe el fondo `silencio` y la grabación llega a `session.amb` por un nodo de nivel propio del fondo

#### Scenario: Pausa y reanudación

- **WHEN** la persona pausa y luego reanuda una sesión con fondo natural
- **THEN** la grabación se congela y continúa junto con el reloj y los gongs, sin desfase

#### Scenario: Fin anticipado

- **WHEN** la persona termina la sesión antes de tiempo
- **THEN** el fondo se apaga con el fundido del motor y después todas las fuentes se detienen

#### Scenario: Repetir sobre una sesión viva

- **WHEN** empieza una sesión nueva mientras otra se está apagando
- **THEN** las fuentes de la sesión anterior se detienen al terminar su fundido

#### Scenario: iOS

- **WHEN** empieza una sesión natural en un navegador con `navigator.audioSession`
- **THEN** la categoría «playback» se pide igual que con el sintetizado, dentro del gesto

### Requirement: Memoria acotada

Ningún fondo natural SHALL decodificarse entero en memoria si supera 40 MB (segundos × 48 000 × canales × 4 bytes,
calculados desde la duración y los canales del propio archivo). Los fondos que no superan ese presupuesto SHALL
reproducirse desde un buffer decodificado; los que lo superan (la lluvia de 316 s, 121,3 MB) SHALL reproducirse en
flujo desde un elemento de audio conectado al mismo grafo, sin decodificarlos enteros. Si el flujo no puede usarse,
el fondo SHALL sonar sintetizado: nunca se decodifica entero un archivo que no entra en el presupuesto. El modo de
cada fondo en el manifiesto (`buffer` o `flujo`) SHALL coincidir con ese cálculo.

#### Scenario: Presupuesto por fondo en buffer

- **WHEN** se calcula el tamaño decodificado de cada archivo del manifiesto desde su duración y canales
- **THEN** los de modo buffer no superan 40 MB y los de modo flujo sí lo superan

#### Scenario: Duración declarada igual a la real

- **WHEN** se leen la duración y los canales del encabezado y la última página de cada archivo Ogg Opus
- **THEN** coinciden con los del manifiesto

#### Scenario: La lluvia larga se reproduce en flujo

- **GIVEN** la lluvia de 316 s con la preferencia en Natural
- **WHEN** empieza la sesión
- **THEN** suena desde un elemento de audio con `loop` conectado a `session.amb`, sin crear un `AudioBuffer` de la lluvia, con el mismo fundido de entrada, volumen y silencio del fondo que los demás fondos

#### Scenario: Pausa del flujo

- **WHEN** la persona pausa y luego reanuda una sesión con la lluvia en flujo
- **THEN** el elemento se pausa y continúa junto con el reloj y los gongs

#### Scenario: El flujo no arranca

- **GIVEN** un elemento que no empieza a sonar en 3 s, que da error, o un navegador que lo rechaza
- **WHEN** la persona presiona «Comenzar»
- **THEN** la sesión empieza con la lluvia sintetizada completa, indica «sintetizado» y no se decodifica el archivo de 316 s

#### Scenario: Flujo desactivado en una plataforma

- **GIVEN** una plataforma donde la prueba en dispositivo desaconsejó el flujo
- **WHEN** la persona elige la lluvia con la preferencia en Natural
- **THEN** la lluvia suena sintetizada y los demás fondos naturales no cambian

#### Scenario: Hueco del empalme del flujo

- **WHEN** se mide el elemento de la lluvia en el empalme del bucle en Chromium y en Firefox
- **THEN** el tramo continuo de silencio digital es menor que 20 ms

### Requirement: Empalme del bucle sin corte audible

Cada grabación SHALL repetirse sin clic, hueco ni cambio de timbre audibles en el punto de unión. Cada fondo
SHALL tener en el manifiesto un valor de cruce: 0 para repetir con `loop` nativo, o una duración en
segundos para superponer instancias del mismo buffer con un cruce de potencia constante programado con el reloj
del contexto; y, opcionalmente, dos capas (una velocidad, un desfase, un volumen relativo y un paneo para la segunda) que hacen sonar el
mismo buffer dos veces para que el patrón de un fondo corto no se repita idéntico. Los valores de la primera versión SHALL ser: agua y
lluvia sin cruce, noche con cruce de 4 s, bosque y fuego con dos capas (velocidad 0,94, desfase de un tercio de la duración —9,0 s y 2,9 s—,
volumen relativo 0,7 y paneo 0,25). Los originales SHALL NOT alterarse para esconder el salto. En bucle nativo y en
dos capas el inicio SHALL ser un desplazamiento al azar dentro del archivo (el flujo de la lluvia empieza en 0). Los valores SHALL
confirmarse con la prueba de oído y registrarse con su fecha.

#### Scenario: Bucle nativo

- **GIVEN** un fondo en buffer con cruce 0 y sin capas
- **WHEN** empieza la sesión
- **THEN** una única fuente repite el buffer completo con `loop` activado desde un desplazamiento al azar

#### Scenario: Cruce programado

- **GIVEN** un fondo con cruce de X segundos
- **WHEN** empieza una sesión de 30 minutos
- **THEN** se programan al inicio las instancias necesarias, cada una empieza X segundos antes de que termine la anterior, la ganancia de cada una sube y baja en X segundos y la suma de potencias es constante en el cruce

#### Scenario: Dos capas

- **GIVEN** bosque o fuego, con dos capas
- **WHEN** empieza la sesión
- **THEN** suenan dos fuentes con `loop` del mismo buffer: la primera a velocidad 1,00, con paneo −0,25 y ganancia 0,75; la segunda a velocidad 0,94, con paneo +0,25, ganancia 0,525 y comenzando un tercio de la duración después en el archivo; no se carga un segundo buffer y la pausa las congela juntas

#### Scenario: Fuentes acotadas en el tiempo

- **WHEN** termina la sesión
- **THEN** ninguna instancia ni capa sigue sonando después del fundido final

#### Scenario: Prueba de oído del empalme

- **WHEN** Pablo escucha 3 repeticiones seguidas de la unión de cada archivo con auriculares y con altavoz
- **THEN** no se oye clic, hueco ni cambio de timbre, o se fija un cruce mayor que 0 y se repite la prueba

### Requirement: Nivel parejo entre fondos

Cada fondo natural SHALL tener un nivel propio en el manifiesto, calibrado para que los cinco queden a menos
de 1,5 LU entre sí en sonoridad integrada y cerca de sus equivalentes sintetizados, y confirmado de oído con los
fondos seguidos. La medición y su fecha SHALL registrarse. El nivel SHALL medirse sobre la mezcla que se oye (en
dos capas, la suma de ambas). El bosque, que el archivo trae unos 20 dB más fuerte que los demás, SHALL igualarse con
su nivel.

#### Scenario: Niveles registrados

- **WHEN** se revisa el manifiesto
- **THEN** cada fondo tiene su nivel y el registro indica la medición, la fecha y quién confirmó de oído

#### Scenario: Bosque igualado

- **WHEN** se escuchan seguidos los cinco fondos naturales con el mismo volumen del control
- **THEN** el bosque no suena notablemente más fuerte que los demás

#### Scenario: Volumen del control

- **WHEN** la persona sube o baja el volumen del fondo
- **THEN** la grabación y el sintetizado responden con la misma curva

### Requirement: Procedencia, licencia y créditos de cada archivo

Cada archivo de audio SHALL tener en el repositorio, en un manifiesto, su título, autor, enlace de origen,
licencia con enlace, SHA-256, tamaño, duración, canales y qué conversión se le aplicó. Solo SHALL usarse audio CC0
o propio verificado en la ficha de origen. Remanso SHALL mostrar una página de créditos generada de ese manifiesto
(título de la fuente, autor, enlace y licencia de cada fondo, aviso de que los archivos se convirtieron a Ogg Opus y de que CC0 no
certifica la ausencia de derechos de terceros), accesible sin cuenta y enlazada desde el inicio. La atribución no es
obligatoria por la licencia: se mantiene como buena práctica.

#### Scenario: Manifiesto completo

- **WHEN** se lee el manifiesto
- **THEN** cada fondo natural trae título, autor, URL, licencia CC0 con enlace, SHA-256, tamaño, duración y canales

#### Scenario: Integridad

- **WHEN** se calcula el SHA-256 de cada archivo servido
- **THEN** coincide con el del manifiesto y con el registrado del kit recibido

#### Scenario: Página de créditos

- **WHEN** una persona sin sesión abre la página de créditos
- **THEN** ve los cinco fondos con título, autor, licencia y enlace, la respuesta lleva las cabeceras de seguridad de la app y no se establece ninguna cookie

#### Scenario: Enlaces externos

- **WHEN** se inspecciona la página de créditos
- **THEN** los enlaces a otros sitios son navegación con `rel="noopener noreferrer"` y no carga ningún recurso de otro origen

### Requirement: Textos públicos que no contradicen el audio

La ficha de Remanso, la página de créditos, la política de privacidad, los términos y la landing de Remanso SHALL
describir el audio como lo hace la aplicación: fondos sintetizados en el dispositivo o grabaciones que el navegador descarga,
la descarga revela qué fondo se eligió (sin cookies de sesión), la preferencia se guarda en el navegador y los sonidos tienen
autoría y licencia. Los textos públicos SHALL NOT afirmar que todo el audio se genera en el dispositivo ni que no hay descargas. El
texto legal SHALL ser revisado y aprobado por Pablo antes de publicarse, y la versión natural SHALL NOT llegar a producción antes
de que el sitio con esos textos esté desplegado.

#### Scenario: Sin afirmaciones falsas

- **WHEN** se revisan las páginas públicas de HomeSuite después del cambio
- **THEN** ninguna dice que todo el sonido se genera en el dispositivo ni que Remanso funciona sin descargas

#### Scenario: Aprobación del texto legal

- **WHEN** se propone el texto de privacidad y términos
- **THEN** el cambio queda marcado como pendiente de revisión de Pablo y el texto no se despliega sin su aprobación

#### Scenario: Orden de publicación

- **WHEN** se prepara la publicación en producción
- **THEN** el sitio con los textos revisados se despliega antes o junto con la app que ofrece la versión natural
