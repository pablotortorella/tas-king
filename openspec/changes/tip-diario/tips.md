# Catálogo de tips y criterios de curación

Registro de la exploración con Pablo del 9–10 de septiembre de 2026. Este documento permite continuar la curación con Claude sin reconstruir la conversación.

## Estado y alcance

- El cambio activo es `tip-diario`; las referencias antiguas a `onboarding-tips` corresponden al nombre anterior.
- Este es un catálogo editorial de trabajo, no una lista lista para implementar. Arrancó con 59 candidatos con ID más 7 variantes (66 textos). **Al 2026-09-11**: 74 textos vivos (20 aprobados, 54 todavía propuestos) y 1 descartado (P5), tras sumar las nueve hermanas singulares nuevas.
- Pablo aprobó la voz de la primera muestra, pidió cambiar «cambie de etapa» por «cambie de estado», aceptó ampliar las temáticas y quiere muchos tips para curarlos personalmente.
- La aceptación de la voz no equivale a la aprobación individual de todos los textos posteriores. Se conserva el estado de cada candidato para evitar esa confusión.
- El orden de las tablas facilita la revisión; todavía no define el orden final de aparición.
- **Actualizado el 2026-09-10**: los cuatro artefactos de OpenSpec ya quedaron alineados con las decisiones de esa sesión (ver más abajo). Lo que sigue pendiente es la curación de los textos y una única decisión abierta: la categoría visible.

## Acuerdos y preferencias expresadas por Pablo

- Voz cercana, concreta, con voseo, como en «Dejar de empezar y empezar a terminar». La primera muestra de práctica + acción gustó.
- Usar «estado», no «etapa», en K1.
- Incluir las seis prácticas de Kanban, Gestión de Objetivos y un segundo tramo sin referencias a funciones de la app.
- Ampliar la colección con GTD, Pomodoro y otras temáticas de gestión de tareas. Se busca abundancia para luego curar.
- Tener en cuenta tanto a quienes trabajan en solitario como a quienes comparten tablero. Las referencias al trabajo en equipo también son bienvenidas.
- Pablo sugirió para O2 «usá su descripción para recordar qué se quiere lograr», como ejemplo de una voz aplicable a ambos escenarios.
- Pablo propuso explorar una label o hashtag de categoría y señaló que frases como «durante el foco» pueden presuponer una práctica que la persona no está realizando.

## Criterios editoriales propuestos durante la exploración

Estos criterios son recomendaciones para revisar con Pablo; no todos constituyen decisiones cerradas del spec.

- Cada tip debería entenderse por sí solo, incluso el primer día de uso y sin conocer el método que lo inspira.
- Una idea principal y una observación, pregunta o acción concreta por tip. Combinar frases memorables con instrucciones breves.
- ~~Voz amplia por defecto~~ → **superado el 2026-09-10**: Pablo decidió conservar el plural en las prácticas de coordinación y sumar la versión singular como tip adicional. Sigue valiendo evitar repetir «reflexioná o conversen» en cada texto.
- No diagnosticar el comportamiento: el contenido no es contextual. Evitar «Tenés demasiadas tareas abiertas»; preferir «Antes de empezar otra…».
- Ser fieles a las funciones reales: el Pulso recuerda mirar el trabajo en curso, pero no impone límites de WIP. Una tarjeta «Quieta» no necesariamente está bloqueada. Las métricas ofrecen señales, no prueban causalidad.
- Tramos (actualizado a tres el 2026-09-10): T1 principio + función concreta de TasKing; T2 Kanban puro; T3 otros métodos. T2 y T3 sin botones, íconos ni pantallas.
- Distinguir consejos generales, invitaciones a probar una práctica y consejos condicionales para quienes ya la usan. Presentar el contexto dentro de la frase cuando haga falta.
- Las frases son redacciones propias inspiradas en prácticas y métodos, no citas de sus autores.
- Revisar repeticiones por su utilidad pedagógica. Si se conservan, separarlas en la secuencia.
- **Resuelto el 2026-09-10**: dos líneas en mobile, sin truncado, con techo de ~110 caracteres. Ver decisión 3 más abajo.

## Decisiones cerradas en la sesión del 2026-09-10

Conversadas con Pablo y ya reflejadas en `proposal.md`, `spec.md`, `design.md` y `tasks.md`.

1. **Tres tramos**, no dos. T1: Kanban + afordancia de la app (K, O). T2: Kanban puro (M). T3: otros métodos — GTD (G), Pomodoro (P), priorización general (T). Los N1–N10 mezclan temas de los tres y hay que repartirlos, no van todos al T3. La progresión va de la herramienta, al método que la fundamenta, a otras escuelas.
2. **Voz**: el plural **se conserva** en las prácticas de coordinación, colaboración y sincronización. Donde aplique, se suma la versión singular como **tip adicional**, nunca como reemplazo. Consecuencia directa: las variantes K7-V1, K9-V1, M4-V1, M6-V1 y O2-V1 dejan de ser "reemplazaría a" y pasan a ser **hermanas** del original; ambas conviven en la secuencia. Medición: 14 de 59 tips están en plural (K6–K12, O2, O6, M4–M10), o sea una jornada de cada cuatro para quien trabaja solo.
3. **Dos líneas en mobile, sin truncado.** Medición real renderizando los 66 textos con la tipografía de la app a 360px y 13px: **ninguno entra en una línea**, 62 necesitan dos y 4 necesitan tres. **Regla editorial nueva: máximo ~110 caracteres.** A recortar: P5 (112), K7 (117), G5 (120), G3 (125).
4. **Ubicación**: franja propia **encima del footer**, no bajo el header. El footer está permanentemente a la vista (solo scrollea el área del tablero), es la zona que ya reúne "cómo usar la app", y en mobile se pueden ocultar los atajos de teclado —inútiles sin teclado— para que el costo neto sea casi cero.

### Verificación de fidelidad: aprobada

Se comprobaron contra el código **todas** las referencias de interfaz que citan los tips, y todas existen y están bien nombradas: «¿Cómo vamos?» (`metricsBtn`, línea 819), «Quietas» y «Por vencer» (dentro de la sección «¡Pilas con esto! 🔥», que vive adentro de ese panel), «Distribución actual», el marcador ✅ de columna de cierre, el Pulso 🎯 —bien descripto: recuerda mirar, no impone límites— y la descripción de Objetivo, que existe en el gestor y está soportada por la API.

Única corrección pendiente: **K5** presenta «Quietas» como si estuviera directo en «¿Cómo vamos?», cuando está dos niveles adentro.

## Decisiones pendientes

1. **Curar los textos**, tip por tip, y elegir entre originales y hermanas. Lo hace Pablo. No reemplazar automáticamente un original por la última sugerencia del asistente.
2. ~~¿Se muestra categoría?~~ → **Resuelta el 2026-09-11: sin categoría visible en v1.** Decisión de Pablo. La franja muestra solo el texto; el techo editorial queda en ~110 caracteres y la procedencia va dentro de la frase cuando importa. Descartadas: categoría por tema y categoría por método. Ver `design.md` § Open Questions. **Consecuencia para la curación**: se cura contra ~110 caracteres, no contra ~95.
3. Definir la secuencia final, el tamaño del catálogo inicial y qué repeticiones conservar. Los IDs son referencias editoriales estables, no posiciones de reproducción.
4. ~~Resolver los solapamientos detectados: K4/M1, K11/M6, O4/G4, T5/N7, T6/N4.~~ → **Resuelto el 2026-09-11: los cinco pares se conservan completos**, separados en la secuencia. Ver el registro de la curación.

## Registro de la curación

**2026-09-11 — Lote 1: los cuatro textos que superaban el techo de ~110 caracteres.** Decisiones de Pablo:

- **P5 — Descartado.** El tip sale del catálogo, no se recorta.
- **K7 — Aprobado con redacción propia de Pablo** (99): «Terminar debe significar lo mismo para todos: acuerden qué debe cumplir una tarjeta para llegar a ✅». Sin punto final y sin «una columna» antes del ✅.
- **G5 — Aprobado con redacción propia de Pablo** (98): «No todo lo que anotes necesita acción: puede ser una referencia, puede esperar o ya no hace falta». Conserva los tres destinos de GTD (referencia / esperar / descartar). *Detalle pendiente de confirmar*: dice «anotes» donde el voseo del resto del catálogo pediría «anotés» — se dejó tal como Pablo lo escribió.
- **G3 — Aprobada la opción de 101 caracteres**: ««Resolver presupuesto» es demasiado grande. ¿La próxima acción es pedir un precio o llamar a alguien?». Dos ejemplos en vez de tres, y «es» en lugar de «puede ser».

Con esto, **ningún texto vivo del catálogo supera los 110 caracteres**.

**2026-09-11 — Lote 2: los cinco solapamientos.** Decisión de Pablo: **quedan los diez tips**, ningún par se reduce. Los pares se separan en la secuencia para que funcionen como refuerzo pedagógico y no como repetición:

- **K4 / M1** — misma apertura, pedidos distintos: K4 pide mirar cuánto hay en curso, M1 pide ayudar a terminar algo ya empezado.
- **K11 / M6** — el mismo consejo con y sin herramienta: K11 lo ancla en «¿Cómo vamos?», M6 enuncia el principio desnudo. Es el patrón que define los tramos 1 y 2.
- **O4 / G4** — «resultado buscado + próxima acción», una vez sobre los Objetivos de la app (T1) y otra como principio de GTD (T3). Ya quedan a dos tramos de distancia.
- **T5 / N7** — misma acción (dejar anotado por dónde seguir) con distinto disparador: fin del día y cualquier pausa.
- **T6 / N4** — misma pregunta (¿esto todavía vale la pena?) con distinto disparador: perder el propósito y retomar una tarea.

**K4 se conserva tal como está y permanece en el tramo 1**, decisión explícita de Pablo. Consecuencia registrada: K4 aplica un principio sobre el tablero sin nombrar una funcionalidad puntual de la app, a diferencia del resto del tramo 1.

**2026-09-11 — Lote 3: K5, la única referencia a la UI que estaba mal.** Verificado contra `public/index.html` (líneas 915-919): «Quietas» no cuelga directo de «¿Cómo vamos?», sino de la sección «¡Pilas con esto! 🔥» que vive dentro de ese panel. Pablo eligió la redacción con la ruta completa: «Una tarea quieta merece una pregunta: en «¿Cómo vamos?» buscá «¡Pilas con esto! 🔥» y mirá las «Quietas».» (104). Ya no queda ninguna referencia de interfaz incorrecta en el catálogo.

**2026-09-11 — Lote 4: reparto de los candidatos N1–N10 entre tramos.** Aprobado por Pablo tal como se propuso:

- **Al segundo tramo (Kanban puro)**: N1 (claridad, hermana pura de K2), N4 (trabajo en curso), N5 (desbloqueo, acompaña a M2), N6 (colaboración, con M8/M9), N9 (qué significa terminar, hermana pura de K7) y N10 (mejora continua en positivo, versión individual de M10).
- **Al tercer tramo (otros métodos)**: N2 (próxima acción, GTD), N3 (resultado buscado, GTD), N7 (retomar después de una pausa, Pomodoro) y N8 (revisar el plan, planificación general).
- **Ninguno al primer tramo**: ninguno nombra una funcionalidad de la app, y mudarlo implicaría reescribirlo.
- **N3 queda con el texto tal cual**, en el tercer tramo. Se señaló que dice «objetivo» y que en esta app Objetivo es el nombre de una función; Pablo decidió no tocarlo.
- Los pares separados por tramo quedan así: N4 (T2) frente a T6 (T3), y N9 (T2) frente a K7 (T1). **Pendiente para la secuencia final (tarea 1.7)**: T5 y N7 quedaron los dos en el tercer tramo, así que hay que separarlos a conciencia en el orden.

Se corrigieron además los encabezados de GTD, Pomodoro y priorización, que seguían diciendo «Segundo tramo» de cuando había dos tramos: son los tres del tercero.

**2026-09-11 — Lote 5: hermanas singulares.** Pablo aprobó **las diez**: las nueve hermanas nuevas (K6-V1, K8-V1, K11-V1, K12-V1, O6-V1, M5-V1, M7-V1, M9-V1, M10-V1) más la alineación de K7-V1, que ahora dice «Definí qué significa terminar: ¿qué debe cumplir una tarjeta para llegar a ✅?» (77), sin «una columna», igual que el K7 aprobado. Se aprobaron también las cuatro hermanas que ya existían (O2-V1, K9-V1, M4-V1, M6-V1).

Quedó explícitamente descartada la recomendación del asistente de dejar afuera las cinco que solo cambian la conjugación (K11-V1, K12-V1, M7-V1, O6-V1, M10-V1): van todas. Consecuencia para la secuencia final (tarea 1.7): **cada hermana tiene que quedar lejos de su original**, porque en esos cinco casos la única diferencia es el verbo y verlas cerca se leería como un tip repetido.

## Cómo curar

Se puede comentar por ID: «K3 queda», «G5 cambiar», «P2 afuera». Estados: **Propuesto**, **Aprobado**, **Descartado**. Las variantes tienen su propio ID y siguen propuestas hasta elegirlas. «Aprobado» en K1 y O1 refleja la aceptación explícita de esos modelos; la selección definitiva de la colección y su orden siguen pendientes. No hay descartes registrados.

## Primer tramo: seis prácticas de Kanban

| ID | Práctica | Texto | Estado |
|---|---|---|---|
| K1 | Visualizar | Que el tablero cuente lo que pasa: mové las tarjetas cuando el trabajo cambie de estado. | Aprobado |
| K2 | Visualizar | Hacé visible lo que falta saber: dejá el contexto de la tarea en su descripción. | Propuesto |
| K3 | Limitar el WIP | Dejar de empezar y empezar a terminar: el Pulso 🎯 te recuerda mirar lo que ya está en marcha. | Propuesto |
| K4 | Limitar el WIP | Antes de sumar otra tarea en curso, mirá cuántas tarjetas ya están esperando tu atención. | Propuesto |
| K5 | Gestionar el flujo | Una tarea quieta merece una pregunta: en «¿Cómo vamos?» buscá «¡Pilas con esto! 🔥» y mirá las «Quietas». | **Aprobado** (2026-09-11, ruta corregida, 104) |
| K6 | Gestionar el flujo | Mirá la distribución en «¿Cómo vamos?»: si se acumulan tarjetas en una columna, conversen sobre qué pasa ahí. | Propuesto |
| K7 | Explicitar políticas | Terminar debe significar lo mismo para todos: acuerden qué debe cumplir una tarjeta para llegar a ✅ | **Aprobado** (2026-09-11, redacción de Pablo, 99) |
| K8 | Explicitar políticas | Una etiqueta sirve más cuando todos la entienden igual: acuerden qué significa y cuándo usarla. | Propuesto |
| K9 | Retroalimentación | Miren juntos «¿Cómo vamos?»: elijan una tarea que se demoró y conversen sobre qué pasó. | Propuesto |
| K10 | Retroalimentación | Que lo aprendido quede a mano: registrá en un comentario lo que ayudaría a resolver una tarea parecida. | Propuesto |
| K11 | Mejorar colaborativamente | Prueben un cambio pequeño y vuelvan a «¿Cómo vamos?» para buscar señales de mejora. | Propuesto |
| K12 | Mejorar colaborativamente | Si una confusión se repite, prueben aclararla en la descripción o en una checklist de la tarjeta. | Propuesto |

## Primer tramo: Gestión de Objetivos

| ID | Texto | Estado |
|---|---|---|
| O1 | Antes de empezar, mirá para qué: tocá un Objetivo para resaltar las tarjetas que contribuyen a él. | Aprobado |
| O2 | Un objetivo necesita un resultado claro: usá su descripción para contar qué quieren lograr. | Propuesto |
| O3 | Conectá el trabajo con su propósito: vinculá la tarjeta con el Objetivo al que contribuye. | Propuesto |
| O4 | Un objetivo sin próximos pasos puede quedarse en deseo: revisá sus tarjetas y acordá cuál sigue. | Propuesto |
| O5 | Al cerrar una tarjeta vinculada a un Objetivo, revisá qué cambió gracias a ese trabajo. | Propuesto |
| O6 | Cuando cambien las prioridades, revisen los Objetivos y las tarjetas vinculadas: ¿qué sigue teniendo sentido? | Propuesto |

## Segundo tramo: flujo, colaboración y mejora

| ID | Texto | Estado |
|---|---|---|
| M1 | Antes de empezar otra tarea, ¿podés ayudar a terminar una que ya está en marcha? | Propuesto |
| M2 | Una tarea bloqueada sigue siendo trabajo en curso. ¿Qué necesita para avanzar? | Propuesto |
| M3 | ¿Esta tarea puede dividirse en una entrega más pequeña que ya le sirva a alguien? | Propuesto |
| M4 | Antes de sumar una urgencia, acuerden qué trabajo va a esperar. | Propuesto |
| M5 | Si una tarea vuelve atrás seguido, revisen qué falta acordar antes de pasarla. | Propuesto |
| M6 | Una mejora pequeña también merece una revisión: ¿qué esperaban que cambiara y qué pasó? | Propuesto |
| M7 | Cuando algo se demora, miren también las esperas: ¿dónde pasa tiempo sin avanzar? | Propuesto |
| M8 | Antes de pasarle trabajo a otra persona, comprobá que tenga lo necesario para continuarlo. | Propuesto |
| M9 | Si una tarea depende de alguien más, acuerden cuándo volver a conversar sobre ella. | Propuesto |
| M10 | Cuando algo salga bien, investiguen también: ¿qué ayudó y vale la pena repetir? | Propuesto |

## Tercer tramo: GTD

| ID | Texto | Estado |
|---|---|---|
| G1 | Si algo te ocupa la cabeza, anotalo en un lugar que después vayas a revisar. | Propuesto |
| G2 | Anotar algo es el comienzo: volvé después para decidir qué significa y qué vas a hacer con eso. | Propuesto |
| G3 | «Resolver presupuesto» es demasiado grande. ¿La próxima acción es pedir un precio o llamar a alguien? | **Aprobado** (2026-09-11, 101) |
| G4 | Si algo necesita varios pasos, definí el resultado buscado y la próxima acción concreta. | Propuesto |
| G5 | No todo lo que anotes necesita acción: puede ser una referencia, puede esperar o ya no hace falta. | **Aprobado** (2026-09-11, redacción de Pablo, 98) |
| G6 | Si estás esperando una respuesta, anotá de quién y sobre qué: así podés retomar el seguimiento. | Propuesto |
| G7 | Reservá un momento semanal para revisar compromisos, pendientes y próximos pasos. | Propuesto |
| G8 | Para elegir qué hacer ahora, considerá también el tiempo, la energía y los recursos que tenés disponibles. | Propuesto |

Redacciones inspiradas en los [pasos de GTD](https://gettingthingsdone.com/what-is-gtd/) y los [criterios para elegir qué hacer](https://gettingthingsdone.com/2023/01/choosing-what-to-do/), consultados durante la exploración.

## Tercer tramo: Pomodoro

| ID | Texto | Estado |
|---|---|---|
| P1 | Antes de iniciar un Pomodoro, elegí una tarea y definí qué parte vas a trabajar. | Propuesto |
| P2 | Si aparece otra idea durante el foco, anotala para después y volvé a lo que estabas haciendo. | Propuesto |
| P3 | La pausa también forma parte del trabajo: cuando llegue, dejá la tarea y descansá un momento. | Propuesto |
| P4 | Si una interrupción puede esperar, acordá cuándo atenderla y protegé el rato de foco. | Propuesto |
| P5 | ~~Compará los Pomodoros que imaginabas con los que necesitaste: usá esa diferencia para planificar la próxima vez.~~ | **Descartado** (2026-09-11) |
| P6 | Si las interrupciones se repiten, observá de dónde vienen y acordá una forma de reducirlas. | Propuesto |

Redacciones inspiradas en la [técnica Pomodoro](https://www.pomodorotechnique.com/) y su [programa oficial](https://www.pomodorotechnique.com/pomodoro-self-paced/), consultados durante la exploración. Revisar especialmente los supuestos de contexto en P1–P5; una categoría por sí sola no vuelve autosuficiente el texto.

## Tercer tramo: priorización y planificación cotidiana

Consejos generales, sin atribución a un método específico.

| ID | Texto | Estado |
|---|---|---|
| T1 | Antes de elegir lo más urgente, preguntate qué pasa si espera y qué trabajo importante desplaza. | Propuesto |
| T2 | Dale un lugar en tu semana a lo importante que todavía no tiene urgencia. | Propuesto |
| T3 | Antes de llenar el día de tareas, mirá cuánto tiempo ya está comprometido. | Propuesto |
| T4 | Dejá espacio para imprevistos: lo inesperado también ocupa tiempo. | Propuesto |
| T5 | Antes de cerrar el día, dejá escrito por dónde retomar lo que quedó abierto. | Propuesto |
| T6 | Si una tarea perdió su propósito, revisá si todavía vale la pena hacerla. | Propuesto |

## Nuevos candidatos N1–N10, repartidos entre el segundo y el tercer tramo

Estos diez textos surgieron al explorar categorías por tema. Se les asignan IDs N1–N10 en este documento para facilitar la curación; antes no tenían ID. **Reparto aprobado por Pablo el 2026-09-11**: seis al segundo tramo y cuatro al tercero. Ninguno va al primero, porque ninguno nombra una funcionalidad de la app.

| ID | Tramo | Tema | Texto | Estado |
|---|---|---|---|---|
| N1 | T2 | Claridad | Escribí la tarea de modo que mañana puedas entenderla sin reconstruir toda la historia. | Propuesto (tramo asignado 2026-09-11) |
| N2 | T3 | Próxima acción | Si no sabés por dónde empezar, anotá qué necesitás averiguar primero. | Propuesto (tramo asignado 2026-09-11) |
| N3 | T3 | Objetivos | ¿Cómo vas a reconocer que lograste el objetivo? Dejá esa señal por escrito. | Propuesto (tramo asignado 2026-09-11) |
| N4 | T2 | Trabajo en curso | Antes de retomar una tarea, revisá si sigue siendo necesario terminarla. | Propuesto (tramo asignado 2026-09-11) |
| N5 | T2 | Desbloqueo | Cuando pidas ayuda, contá qué intentaste y en qué punto te trabaste. | Propuesto (tramo asignado 2026-09-11) |
| N6 | T2 | Colaboración | Antes de dar por hecho un compromiso, confirmá que la otra persona lo entendió igual. | Propuesto (tramo asignado 2026-09-11) |
| N7 | T3 | Foco y pausas | Si te cuesta retomar después de una pausa, dejá anotado el próximo paso antes de parar. | Propuesto (tramo asignado 2026-09-11) |
| N8 | T3 | Planificación | Cuando una tarea lleve más de lo previsto, revisá el plan con lo que ahora sabés. | Propuesto (tramo asignado 2026-09-11) |
| N9 | T2 | Cierre | Antes de dar una tarea por terminada, comprobá que el resultado esté disponible para quien lo necesita. | Propuesto (tramo asignado 2026-09-11) |
| N10 | T2 | Aprendizaje | ¿Qué te facilitó el trabajo hoy? Pensá cómo volver a tener esa condición mañana. | Propuesto (tramo asignado 2026-09-11) |

## Hermanas singulares de tips en plural

**Actualizado 2026-09-11**: estas ya **no** son reemplazos — el original en plural se conserva y su versión singular se suma como tip adicional; las dos conviven en la secuencia. **La colección de hermanas está cerrada**: Pablo aprobó las cinco que ya existían y las nueve nuevas (K6, K8, K11, K12, O6, M5, M7, M9, M10), incluidas las que solo cambian la conjugación. K7-V1 se alineó con la redacción aprobada de K7.

| ID | Hermana singular de | Texto | Estado |
|---|---|---|---|
| O2-V1 | O2 | Un objetivo necesita un resultado claro: usá su descripción para recordar qué se quiere lograr. | **Aprobado** (2026-09-11) |
| K7-V1 | K7 | Definí qué significa terminar: ¿qué debe cumplir una tarjeta para llegar a ✅? | **Aprobado** (2026-09-11, alineada con K7, 77) |
| K9-V1 | K9 | Mirá «¿Cómo vamos?»: elegí una tarea que se demoró y revisá qué pasó. | **Aprobado** (2026-09-11) |
| M4-V1 | M4 | Antes de sumar una urgencia, decidí qué trabajo va a esperar. | **Aprobado** (2026-09-11) |
| K6-V1 | K6 | Mirá la distribución en «¿Cómo vamos?»: si se acumulan tarjetas en una columna, preguntate qué pasa ahí. | **Aprobado** (2026-09-11, nueva, 104) |
| K8-V1 | K8 | Una etiqueta sirve más cuando significa siempre lo mismo: definí qué quiere decir y cuándo usarla. | **Aprobado** (2026-09-11, nueva, 98) |
| K11-V1 | K11 | Probá un cambio pequeño y volvé a «¿Cómo vamos?» para buscar señales de mejora. | **Aprobado** (2026-09-11, nueva, 79) |
| K12-V1 | K12 | Si una confusión se repite, probá aclararla en la descripción o en una checklist de la tarjeta. | **Aprobado** (2026-09-11, nueva, 95) |
| O6-V1 | O6 | Cuando cambien las prioridades, revisá los Objetivos y sus tarjetas: ¿qué sigue teniendo sentido? | **Aprobado** (2026-09-11, nueva, 97) |
| M5-V1 | M5 | Si una tarea vuelve atrás seguido, revisá qué te falta definir antes de darla por lista. | **Aprobado** (2026-09-11, nueva, 88) |
| M7-V1 | M7 | Cuando algo se demore, mirá también las esperas: ¿dónde pasa tiempo sin avanzar? | **Aprobado** (2026-09-11, nueva, 80) |
| M9-V1 | M9 | Si una tarea depende de alguien más, definí cuándo vas a volver a preguntar por ella. | **Aprobado** (2026-09-11, nueva, 85) |
| M10-V1 | M10 | Cuando algo salga bien, mirá también qué ayudó: ¿vale la pena repetirlo? | **Aprobado** (2026-09-11, nueva, 72) |
| M6-V1 | M6 | Una mejora pequeña también merece una revisión: ¿qué esperabas que cambiara y qué pasó? | **Aprobado** (2026-09-11) |

## Variantes de foco y práctica explícita

| ID | Relación | Texto | Estado |
|---|---|---|---|
| P2-V1 | Variante general de P2 | Si aparece otra idea mientras trabajás en una tarea, anotala para después y retomá lo que estabas haciendo. | Propuesto |
| P2-V2 | Variante condicional de P2 | Cuando hagas un Pomodoro, anotá las ideas que aparezcan y revisalas al terminar el bloque. | Propuesto |
| F1 | Invitación nueva, tema Foco y pausas | Elegí una tarea y reservá un rato para dedicarle atención. Antes de empezar, apartá lo que pueda esperar. | Propuesto |

## Notas para continuar con Claude

- **Retomar por acá**: la tarea 1.1 de `tasks.md` es la curación tip por tip, y la hace Pablo. Conservar los IDs al editar.
- Registrar lo aprobado sin asumir que las recomendaciones del asistente ya fueron aceptadas. Silencio no es aprobación.
- Los solapamientos K4/M1, K11/M6, O4/G4, T5/N7 y T6/N4 siguen sin resolver: pueden funcionar como refuerzo si se separan en la secuencia, o reducirse al curar.
- No convertir el catálogo completo directamente en `DAILY_TIPS`: primero curar, repartir los N entre tramos y definir el orden.
- **Los artefactos de OpenSpec ya están alineados** con lo decidido el 2026-09-10 (tres tramos, voz, dos líneas, ubicación). Lo único que sigue abierto y bloquea la UI es la categoría visible.
- El formato de la categoría y sus posibles interacciones siguen sin decidir. No implementar esas opciones como si estuvieran confirmadas.
