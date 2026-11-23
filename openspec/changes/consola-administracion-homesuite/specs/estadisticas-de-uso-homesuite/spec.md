## Purpose

Medir cuánto se usa HomeSuite y cada herramienta, para decidir qué aporta valor: la última fecha de actividad por persona, conteos diarios de acciones sin personas, personas distintas por período de calendario cerrado y una foto diaria de la suite, con lo mínimo de datos personales.

## ADDED Requirements

### Requirement: Fecha de última actividad por persona

Toda petición atendida con una sesión válida SHALL dejar en la cuenta la fecha del día en Colombia (UTC−5), sin hora y sin herramienta, como última actividad. La fecha SHALL escribirse como mucho una vez por cuenta y por día, y SHALL borrarse con la cuenta. Las peticiones sin sesión SHALL NOT escribir nada.

#### Scenario: Varias peticiones el mismo día
- **WHEN** una persona con sesión abre tres páginas el mismo día
- **THEN** su última actividad es la fecha de ese día y la cuenta se escribió una sola vez

#### Scenario: Cambio de día en Colombia
- **WHEN** una persona usa la app a las 23:50 y a las 00:10 de Colombia
- **THEN** su última actividad pasa a la fecha del segundo día

### Requirement: Qué cuenta como «entró» y como «hizo algo»

HomeSuite SHALL medir tres herramientas, y solo con sesión: Cuentas Claras, Tareas y Remanso. Cuenta como uso solo una respuesta exitosa.

| Herramienta | «Entró» | «Hizo algo» |
|---|---|---|
| Cuentas Claras | abrir un libro | cargar, editar o borrar un movimiento, o confirmar una importación |
| Tareas | abrir un tablero | crear, mover o editar una tarjeta, comentar o adjuntar |
| Remanso | abrir Remanso | terminar una sesión |

«Hizo algo» SHALL contar también como «entró» en el mismo día. Las cuentas de los dueños de la suite y de quienes tienen roles SHALL medirse como cualquier otra. Jardín Zen, Remanso sin cuenta y cualquier visita sin sesión SHALL NOT medirse.

#### Scenario: Movimiento cargado
- **WHEN** una persona con sesión carga un movimiento y la respuesta es exitosa
- **THEN** cuenta como «entró» y «hizo algo» en Cuentas Claras ese día, y suma uno a «movimientos cargados»

#### Scenario: Petición rechazada
- **WHEN** una carga de movimiento falla por validación, permiso o CSRF
- **THEN** no cuenta como uso ni suma acciones

#### Scenario: Uso del dueño
- **WHEN** un dueño de la suite abre un tablero
- **THEN** cuenta como «entró» en Tareas, igual que cualquier otra cuenta

#### Scenario: Jardín Zen
- **WHEN** alguien, con o sin sesión, usa Jardín Zen
- **THEN** no se registra ningún uso ni acción

### Requirement: Conteos diarios de acciones sin personas

HomeSuite SHALL sumar, por día de Colombia, herramienta y acción, la cantidad de veces que se hizo cada acción del catálogo. Las acciones son:
- **Cuentas Claras:** movimientos cargados, editados y borrados, e importaciones confirmadas.
- **Tareas:** tarjetas creadas, movidas y editadas, comentarios y adjuntos.
- **Remanso:** sesiones terminadas y abandonadas.

Los conteos SHALL NOT tener ninguna referencia a la persona ni al grupo o tablero, SHALL NOT borrarse por mantenimiento y SHALL poder sumarse para cualquier rango de días.

#### Scenario: Suma de un rango arbitrario
- **WHEN** el dueño pide las acciones del 3 de marzo al 17 de abril
- **THEN** obtiene la suma de los conteos diarios de esos días

### Requirement: Personas distintas por período cerrado

HomeSuite SHALL contar, por herramienta y nivel («entró», «hizo algo»), las personas distintas de cada período de calendario de Colombia:
- el día;
- la semana ISO, de lunes a domingo;
- el mes;
- el trimestre;
- el año.

Para no contar dos veces a la misma persona, SHALL usar marcas por período que no guarden el identificador de la cuenta en claro. SHALL borrar las marcas de un período cuando ese período termina. Los contadores de personas por período SHALL conservarse para siempre. HomeSuite SHALL NOT ofrecer personas distintas para rangos que no sean uno de esos períodos.

#### Scenario: Persona que usa Tareas veinte días del mes
- **WHEN** la misma persona abre un tablero en veinte días distintos de noviembre
- **THEN** cuenta 1 en el mes de noviembre, 1 en cada uno de esos días y 1 en el trimestre y el año

#### Scenario: Cierre del mes
- **WHEN** termina noviembre y corre el mantenimiento
- **THEN** se borran las marcas del mes de noviembre y de sus días y semanas cerradas; el contador del mes queda; las marcas del trimestre y del año siguen hasta su cierre

#### Scenario: Marcas sin identificador en claro
- **WHEN** se inspecciona la tabla de marcas
- **THEN** ninguna fila contiene el identificador, el correo ni el nombre de la cuenta

### Requirement: Foto diaria de la suite

Cada día, el mantenimiento programado SHALL guardar una foto con el día de Colombia, el total de cuentas y las personas cuya última actividad cae en el último día, en los últimos 7 días y en los últimos 30. Las fotos SHALL conservarse para siempre y SHALL NOT incluir identificadores de personas. Si un día el mantenimiento no corre, esa foto falta y no se reconstruye.

#### Scenario: Foto del día
- **WHEN** corre el mantenimiento de un día con 12 cuentas, 3 activas ese día, 6 en 7 días y 9 en 30 días
- **THEN** queda una foto de ese día con 12, 3, 6 y 9

#### Scenario: Mantenimiento repetido
- **WHEN** el mantenimiento corre dos veces el mismo día
- **THEN** queda una sola foto de ese día, con los valores de la última corrida

### Requirement: La medición no frena ni rompe el uso

Si escribir la última actividad, las marcas o los conteos falla, la petición de la persona SHALL completarse igual, y el fallo SHALL quedar en el log del Worker sin datos de la persona. La medición SHALL NOT agregar lecturas de base de datos a las visitas sin sesión.

#### Scenario: Falla la escritura de la estadística
- **WHEN** la base rechaza la escritura de un contador durante la carga de un movimiento
- **THEN** el movimiento se guarda, la respuesta es la de siempre y el log registra el fallo de la medición
