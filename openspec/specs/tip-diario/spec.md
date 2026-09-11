## Purpose

Transmitir práctica Lean/Kanban a quien usa el tablero todos los días, mediante un consejo diario visible pero no interruptivo, que avanza como una progresión pedagógica propia de cada persona.

## Requirements

### Requirement: Un tip por día
El sistema SHALL mostrar exactamente un tip por día en la pantalla del tablero. El tip visible SHALL NOT cambiar durante la misma jornada, aunque la persona recargue la página, cambie de tablero o mantenga la sesión abierta muchas horas.

#### Scenario: El tip permanece estable durante el día
- **WHEN** una persona abre el tablero varias veces el mismo día
- **THEN** ve el mismo tip en todas esas visitas

#### Scenario: Cambia al día siguiente
- **WHEN** una persona abre el tablero un día después de haber visto un tip
- **THEN** ve el tip siguiente de su secuencia

### Requirement: Progresión propia por persona
Cada persona SHALL avanzar su propia secuencia de tips, empezando por el primero de la lista, independientemente de la fecha en que haya empezado a usar la app y de en qué punto estén otras personas del mismo tablero.

#### Scenario: Alguien nuevo empieza por el principio
- **WHEN** una persona ve un tip por primera vez
- **THEN** el sistema le muestra el primer tip de la secuencia, sin importar la fecha

#### Scenario: No se pierde ningún tip por ausencia
- **WHEN** una persona pasa varios días sin abrir la app y luego vuelve
- **THEN** el sistema le muestra el tip siguiente al último que vio, no el que correspondería a la fecha del calendario

#### Scenario: Dos personas pueden ver tips distintos
- **WHEN** dos personas del mismo tablero tienen distinto avance en la secuencia
- **THEN** cada una ve el tip que le corresponde por su propio avance

#### Scenario: La secuencia cicla
- **WHEN** una persona ya vio el último tip de la lista y pasa al día siguiente
- **THEN** el sistema vuelve a empezar por el primer tip

### Requirement: Presencia pasiva
El tip SHALL mostrarse como un elemento permanente y discreto de la pantalla del tablero, que no interrumpe ni bloquea el trabajo. El sistema SHALL NOT exigir ninguna acción de la persona para seguir usando el tablero, y SHALL NOT ofrecer un control de descarte.

#### Scenario: No bloquea el uso del tablero
- **WHEN** el tip está visible
- **THEN** todas las funciones del tablero permanecen accesibles, sin superposiciones ni modales que haya que cerrar

#### Scenario: Sin acción requerida
- **WHEN** una persona ignora el tip durante toda la jornada
- **THEN** el sistema no insiste, no lo repite en otro formato y no pide confirmación

### Requirement: Realce diario independiente del contenido
Una vez por día, después de una interacción de la persona con el tablero, el sistema SHALL realzar brevemente el tip para que se lo note. El realce SHALL NOT depender de qué acción realizó la persona ni alterar el contenido del tip.

#### Scenario: Realce tras la primera interacción del día
- **WHEN** una persona interactúa con el tablero por primera vez en el día
- **THEN** el tip se realza brevemente una vez

#### Scenario: No se repite el mismo día
- **WHEN** la persona sigue interactuando con el tablero el resto de la jornada
- **THEN** el tip SHALL NOT volver a realzarse ese día

#### Scenario: El contenido no cambia según la acción
- **WHEN** el realce se dispara por una acción cualquiera (crear, mover o editar una tarjeta)
- **THEN** el tip mostrado sigue siendo el mismo tip del día, sin relación con esa acción

### Requirement: El tip funciona sin animación
El mecanismo SHALL ser plenamente funcional para quien tiene las animaciones reducidas en su sistema: el realce es un refuerzo, nunca el medio por el cual el tip se vuelve accesible.

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el navegador informa `prefers-reduced-motion: reduce`
- **THEN** el tip del día se muestra igual, legible y completo, y el sistema omite el realce animado

### Requirement: Contenido como progresión de práctica
La secuencia de tips SHALL estar ordenada como una progresión de tres tramos: primero tips que combinan un principio Kanban con la afordancia concreta de la app que permite aplicarlo; luego tips de práctica Kanban pura, sin referencia a funcionalidades; y finalmente tips de otros métodos y prácticas de gestión del trabajo. Recién después de los tres tramos la secuencia vuelve a empezar.

#### Scenario: El primer tramo conecta práctica y herramienta
- **WHEN** una persona recorre el primer tramo de la secuencia
- **THEN** los tips enuncian un principio de práctica y muestran cómo aplicarlo sobre el tablero, señalando la funcionalidad de la app cuando hay una que lo sostiene

#### Scenario: El segundo tramo profundiza en el método propio de la herramienta
- **WHEN** una persona termina el primer tramo y continúa
- **THEN** los tips siguientes tratan sobre práctica Kanban sin depender de funcionalidades específicas de la app

#### Scenario: El tercer tramo se abre a otros métodos
- **WHEN** una persona termina el segundo tramo y continúa
- **THEN** los tips siguientes tratan sobre otros métodos y prácticas de gestión del trabajo, sin referencia a funcionalidades de la app

### Requirement: Textos legibles por completo
Cada tip SHALL poder leerse entero en la pantalla más angosta soportada. El sistema SHALL NOT truncar el texto de un tip.

#### Scenario: Lectura completa en mobile
- **WHEN** una persona abre el tablero en una pantalla angosta
- **THEN** el tip se muestra completo, ocupando las líneas que necesite, sin recortes ni puntos suspensivos

### Requirement: Cada tip se entiende por sí solo
Cada tip SHALL ser comprensible sin conocer el método que lo inspira, sin haber visto los tips anteriores y sin depender de ninguna etiqueta o rótulo que lo acompañe.

#### Scenario: Primer día de uso
- **WHEN** una persona ve su primer tip, sin conocer Kanban ni ningún otro método
- **THEN** el texto se entiende por sí mismo y no requiere contexto externo para saber qué hacer

### Requirement: El avance se guarda en la cuenta de la persona
El avance de la secuencia —el índice del tip y la fecha en que se mostró— SHALL guardarse en la cuenta de la persona y no en el navegador, de modo que la progresión sea la misma desde cualquier dispositivo en el que abra el tablero. El contenido de los tips SHALL seguir siendo estático, sin tabla propia ni administración desde la interfaz.

#### Scenario: La progresión sigue a la persona entre dispositivos
- **WHEN** una persona ve el tip del día en un dispositivo y más tarde abre el tablero en otro
- **THEN** ve el mismo tip, y al día siguiente continúa por el que sigue, sin repetir ni saltear ninguno

#### Scenario: Limpiar el navegador no reinicia la secuencia
- **WHEN** una persona borra los datos de su navegador o entra desde una sesión nueva
- **THEN** su avance se conserva y la secuencia continúa donde había quedado

#### Scenario: Guardar el avance puede fallar
- **WHEN** el sistema no logra guardar el avance (error de red o de escritura)
- **THEN** SHALL seguir mostrando un tip, sin arrojar errores ni bloquear el uso del tablero

#### Scenario: El contenido no se administra desde la base
- **WHEN** se agrega, se corrige o se reordena un tip
- **THEN** el cambio SHALL hacerse en el catálogo estático del frontend, y no SHALL requerir escribir en la base de datos
