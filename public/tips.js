// Tips diarios de FUN TasKing! — un consejo de práctica por día.
//
// El ORDEN es contenido, no presentación: la secuencia va del principio Kanban
// anclado en una función de la app, a la práctica Kanban sin herramienta, a otros
// métodos de gestión del trabajo. Cada persona la recorre desde el principio a su
// propio ritmo, un tip por día, y al llegar al final vuelve a empezar.
//
// Los IDs de los comentarios son las referencias editoriales del catálogo curado en
// openspec/changes/tip-diario/tips.md. No cambiarlos al editar un texto.
// Techo editorial: ~110 caracteres, para que cada tip entre en dos líneas a 360px.

const DAILY_TIPS = [
  // ── Tramo 1 — un principio Kanban y la función de la app que permite aplicarlo ──
  "Que el tablero cuente lo que pasa: mové las tarjetas cuando el trabajo cambie de estado.", // K1
  "Hacé visible lo que falta saber: dejá el contexto de la tarea en su descripción.", // K2
  "Dejar de empezar y empezar a terminar: el Pulso 🎯 te recuerda mirar lo que ya está en marcha.", // K3
  "Antes de sumar otra tarea en curso, mirá cuántas tarjetas ya están esperando tu atención.", // K4
  "Una tarea quieta merece una pregunta: en «¿Cómo vamos?» buscá «¡Pilas con esto! 🔥» y mirá las «Quietas».", // K5
  "Mirá la distribución en «¿Cómo vamos?»: si se acumulan tarjetas en una columna, conversen sobre qué pasa ahí.", // K6
  "Terminar debe significar lo mismo para todos: acuerden qué debe cumplir una tarjeta para llegar a ✅", // K7
  "Una etiqueta sirve más cuando todos la entienden igual: acuerden qué significa y cuándo usarla.", // K8
  "Miren juntos «¿Cómo vamos?»: elijan una tarea que se demoró y conversen sobre qué pasó.", // K9
  "Que lo aprendido quede a mano: registrá en un comentario lo que ayudaría a resolver una tarea parecida.", // K10
  "Prueben un cambio pequeño y vuelvan a «¿Cómo vamos?» para buscar señales de mejora.", // K11
  "Si una confusión se repite, prueben aclararla en la descripción o en una checklist de la tarjeta.", // K12
  "Antes de empezar, mirá para qué: tocá un Objetivo para resaltar las tarjetas que contribuyen a él.", // O1
  "Un objetivo necesita un resultado claro: usá su descripción para contar qué quieren lograr.", // O2
  "Conectá el trabajo con su propósito: vinculá la tarjeta con el Objetivo al que contribuye.", // O3
  "Un objetivo sin próximos pasos puede quedarse en deseo: revisá sus tarjetas y acordá cuál sigue.", // O4
  "Al cerrar una tarjeta vinculada a un Objetivo, revisá qué cambió gracias a ese trabajo.", // O5
  "Cuando cambien las prioridades, revisen los Objetivos y las tarjetas vinculadas: ¿qué sigue teniendo sentido?", // O6
  "Mirá la distribución en «¿Cómo vamos?»: si se acumulan tarjetas en una columna, preguntate qué pasa ahí.", // K6-V1
  "Definí qué significa terminar: ¿qué debe cumplir una tarjeta para llegar a ✅?", // K7-V1
  "Una etiqueta sirve más cuando significa siempre lo mismo: definí qué quiere decir y cuándo usarla.", // K8-V1
  "Mirá «¿Cómo vamos?»: elegí una tarea que se demoró y revisá qué pasó.", // K9-V1
  "Probá un cambio pequeño y volvé a «¿Cómo vamos?» para buscar señales de mejora.", // K11-V1
  "Si una confusión se repite, probá aclararla en la descripción o en una checklist de la tarjeta.", // K12-V1
  "Un objetivo necesita un resultado claro: usá su descripción para recordar qué se quiere lograr.", // O2-V1
  "Cuando cambien las prioridades, revisá los Objetivos y sus tarjetas: ¿qué sigue teniendo sentido?", // O6-V1

  // ── Tramo 2 — práctica Kanban, sin referencias a funciones de la app ──
  "Antes de empezar otra tarea, ¿podés ayudar a terminar una que ya está en marcha?", // M1
  "Una tarea bloqueada sigue siendo trabajo en curso. ¿Qué necesita para avanzar?", // M2
  "¿Esta tarea puede dividirse en una entrega más pequeña que ya le sirva a alguien?", // M3
  "Antes de sumar una urgencia, acuerden qué trabajo va a esperar.", // M4
  "Si una tarea vuelve atrás seguido, revisen qué falta acordar antes de pasarla.", // M5
  "Una mejora pequeña también merece una revisión: ¿qué esperaban que cambiara y qué pasó?", // M6
  "Cuando algo se demora, miren también las esperas: ¿dónde pasa tiempo sin avanzar?", // M7
  "Antes de pasarle trabajo a otra persona, comprobá que tenga lo necesario para continuarlo.", // M8
  "Si una tarea depende de alguien más, acuerden cuándo volver a conversar sobre ella.", // M9
  "Cuando algo salga bien, investiguen también: ¿qué ayudó y vale la pena repetir?", // M10
  "Escribí la tarea de modo que mañana puedas entenderla sin reconstruir toda la historia.", // N1
  "Antes de retomar una tarea, revisá si sigue siendo necesario terminarla.", // N4
  "Cuando pidas ayuda, contá qué intentaste y en qué punto te trabaste.", // N5
  "Antes de dar por hecho un compromiso, confirmá que la otra persona lo entendió igual.", // N6
  "Antes de dar una tarea por terminada, comprobá que el resultado esté disponible para quien lo necesita.", // N9
  "¿Qué te facilitó el trabajo hoy? Pensá cómo volver a tener esa condición mañana.", // N10
  "Antes de sumar una urgencia, decidí qué trabajo va a esperar.", // M4-V1
  "Si una tarea vuelve atrás seguido, revisá qué te falta definir antes de darla por lista.", // M5-V1
  "Una mejora pequeña también merece una revisión: ¿qué esperabas que cambiara y qué pasó?", // M6-V1
  "Cuando algo se demore, mirá también las esperas: ¿dónde pasa tiempo sin avanzar?", // M7-V1
  "Si una tarea depende de alguien más, definí cuándo vas a volver a preguntar por ella.", // M9-V1
  "Cuando algo salga bien, mirá también qué ayudó: ¿vale la pena repetirlo?", // M10-V1

  // ── Tramo 3 — otros métodos y prácticas de gestión del trabajo ──
  "Si algo te ocupa la cabeza, anotalo en un lugar que después vayas a revisar.", // G1
  "Anotar algo es el comienzo: volvé después para decidir qué significa y qué vas a hacer con eso.", // G2
  "«Resolver presupuesto» es demasiado grande. ¿La próxima acción es pedir un precio o llamar a alguien?", // G3
  "Si algo necesita varios pasos, definí el resultado buscado y la próxima acción concreta.", // G4
  "No todo lo que anotes necesita acción: puede ser una referencia, puede esperar o ya no hace falta.", // G5
  "Si estás esperando una respuesta, anotá de quién y sobre qué: así podés retomar el seguimiento.", // G6
  "Reservá un momento semanal para revisar compromisos, pendientes y próximos pasos.", // G7
  "Para elegir qué hacer ahora, considerá también el tiempo, la energía y los recursos que tenés disponibles.", // G8
  "Antes de iniciar un Pomodoro, elegí una tarea y definí qué parte vas a trabajar.", // P1
  "Si aparece otra idea durante el foco, anotala para después y volvé a lo que estabas haciendo.", // P2
  "La pausa también forma parte del trabajo: cuando llegue, dejá la tarea y descansá un momento.", // P3
  "Si una interrupción puede esperar, acordá cuándo atenderla y protegé el rato de foco.", // P4
  "Si las interrupciones se repiten, observá de dónde vienen y acordá una forma de reducirlas.", // P6
  "Elegí una tarea y reservá un rato para dedicarle atención. Antes de empezar, apartá lo que pueda esperar.", // F1
  "Antes de cerrar el día, dejá escrito por dónde retomar lo que quedó abierto.", // T5
  "Antes de elegir lo más urgente, preguntate qué pasa si espera y qué trabajo importante desplaza.", // T1
  "Dale un lugar en tu semana a lo importante que todavía no tiene urgencia.", // T2
  "Antes de llenar el día de tareas, mirá cuánto tiempo ya está comprometido.", // T3
  "Si aparece otra idea mientras trabajás en una tarea, anotala para después y retomá lo que estabas haciendo.", // P2-V1
  "Dejá espacio para imprevistos: lo inesperado también ocupa tiempo.", // T4
  "Si una tarea perdió su propósito, revisá si todavía vale la pena hacerla.", // T6
  "Si no sabés por dónde empezar, anotá qué necesitás averiguar primero.", // N2
  "¿Cómo vas a reconocer que lograste el objetivo? Dejá esa señal por escrito.", // N3
  "Si te cuesta retomar después de una pausa, dejá anotado el próximo paso antes de parar.", // N7
  "Cuando una tarea lleve más de lo previsto, revisá el plan con lo que ahora sabés.", // N8
  "Cuando hagas un Pomodoro, anotá las ideas que aparezcan y revisalas al terminar el bloque.", // P2-V2
];

// Disponible para el script principal de index.html y para los tests unitarios.
globalThis.DAILY_TIPS = DAILY_TIPS;
