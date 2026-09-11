## Context

`public/index.html` ya resolvió, para el Pulso WIP, los tres problemas que esta capacidad vuelve a encontrar:

- **Preferencia/estado por persona y por navegador**: claves `tasking-*` en `localStorage`, siempre dentro de `try/catch` porque el modo privado puede fallar (ver `wipPulseEnabled()`, línea ~1361).
- **Tope de una vez por día**: `maybeShowWipToast()` (línea ~1407) guarda `tasking-wip-msg-date` con la fecha `YYYY-MM-DD` y compara contra hoy.
- **Realce accesible**: el keyframe `wip-pulse` (línea ~317) vive dentro de `@media (prefers-reduced-motion: no-preference)`, de modo que quien reduce animaciones simplemente no lo recibe.

La app además ya habla el idioma de esta capacidad: el toast del Pulso WIP dice `🎯 Dejar de empezar y empezar a terminar` (línea ~924). El tip diario debe sonar como eso, no como un manual.

## Goals / Non-Goals

**Goals:**
- Reusar los tres patrones de arriba en lugar de inventar mecanismos paralelos, para que la funcionalidad se sienta parte de la app.
- Mantener el estado en su mínimo posible: un puntero y una fecha.

**Non-Goals:**
- Sincronizar el avance entre dispositivos de una misma persona (requeriría backend; el costo no se justifica para un consejo diario).
- Medir si los tips se leen o sirven (no hay telemetría en el proyecto; agregarla es una decisión aparte).
- Administrar el contenido desde la UI: los tips se curan en código y se revisan como cualquier otro texto de la app.

## Decisions

- **Avance por consumo, no por fecha.** El puntero avanza cuando la persona ve un tip nuevo, no según el día del calendario. Así nadie se pierde un tip por no entrar, y quien recién llega recorre los fundamentos en orden. *Alternativa descartada*: derivar el tip del día a partir de la fecha (`día del año % cantidad`), que no necesita guardar nada — pero a quien se suma en el día 47 le tocaría el tip 47 sin haber visto los primeros, que es exactamente lo contrario de una progresión.

- **Dos claves en `localStorage`, nada más**: el índice del tip actual y la fecha en que se mostró por última vez. Al abrir el tablero: si la fecha guardada no es hoy, avanzar el índice (con vuelta al inicio al llegar al final) y grabar la fecha de hoy; si es hoy, mostrar el índice tal cual. Eso solo ya cumple "un tip por día", "estable durante la jornada" y "no se pierde ninguno".

- **Una lista plana, ordenada intencionalmente.** Los tres tramos —principio + afordancia, Kanban puro, y otros métodos— viven en el mismo array; la progresión está en el orden, no en el código. El puntero no necesita saber que hay tramos. *Alternativa descartada*: marcar los tramos con metadata y saltear el primero en la segunda vuelta — agrega estado ("ya completó una vuelta") para resolver una redundancia menor, y son prácticas que se re-aplican.

- **Realce con tope diario propio, reutilizando el patrón de fecha.** Una tercera clave con la fecha del último realce, con la misma forma que `tasking-wip-msg-date`. Se dispara en el primer evento de interacción del día con el tablero; después queda inerte hasta el día siguiente.

- **El realce es refuerzo, no mecanismo.** Va dentro del mismo guard de `prefers-reduced-motion` que el pulso existente. Si no se ejecuta, el tip sigue visible y legible: el spec exige que la capacidad funcione sin animación.

- **Sin toggle de apagado en v1.** El header ya tiene cuatro controles (🎯, 🌙, perfil, Admin) y esto es una línea de texto quieta sin descarte. Se deja la puerta abierta: agregar un toggle después no invalida ningún requirement de este spec. *Alternativa considerada*: darle su propio toggle por simetría con el Pulso WIP — argumento legítimo, pero ese pulsa tarjetas y lanza un toast; esto no hace ruido comparable.

- **Ubicación: franja propia justo encima del footer** (no bajo el header, no modal, no overlay). Verificado en el código: `body` es flex column con `height:100vh` y `overflow:hidden`, el único elemento que scrollea es el área del tablero (línea ~203), y `.app-footer` es `flex: 0 0 auto` — o sea que **el footer está permanentemente a la vista, igual que el header**, así que ubicar el tip ahí no le quita permanencia. Tres razones: (1) arriba los ~36px se le restan al área que scrollea, justo sobre el pliegue; abajo se suman a una franja que ya es permanente; (2) el footer ya reúne "cómo usar la app" —atajos, ayuda F1, versión, links—, y un consejo de práctica pertenece a esa familia más que al borde del tablero; (3) en mobile el footer ya mide 48px e incluye los atajos `F · U · N · F1`, inútiles sin teclado: ocultarlos en pantallas angostas deja el costo neto en aproximadamente cero.
  - *Alternativa descartada — bajo el header*: se lee primero, pero cobra el espacio más caro de la pantalla. Costo aceptado de ir abajo: se lee menos; para eso está el realce diario.
  - *Alternativa descartada — dentro de la fila del footer*: no costaría espacio nuevo, pero a 12px y en `--muted` el consejo quedaría como letra chica entre créditos y licencia. Si el tip es lo único que empuja la práctica, tiene que leerse como contenido y no como pie de página.
  - *A tener en cuenta al implementar*: `.wip-toast` es `position: fixed` con `bottom: 24px`, así que al aparecer puede tapar la franja unos 5 segundos.

- **Dos líneas en mobile, sin truncado, con techo editorial de ~110 caracteres.** Medición real: los 66 textos del catálogo renderizados con la tipografía de la app a 360px y 13px dan **cero tips de una línea** — 62 necesitan dos y 4 necesitan tres (P5, K7, G5, G3). El corte está en ~110 caracteres. Truncar a una línea recortaría el 100% de los tips, así que queda descartado y el spec pasa a exigir lectura completa; el techo de ~110 queda como regla editorial del catálogo.

## Risks / Trade-offs

- **[Riesgo]** Un tip pasivo es fácil de ignorar; si nadie lo lee, no cambia ninguna práctica → **[Mitigación]** el realce diario existe justamente para eso, y está acotado a un momento en que la persona está mirando la pantalla. Si aun así no alcanza, la evidencia estará en el uso y se podrá revisar el realce sin tocar el resto.
- **[Riesgo]** El avance vive en el navegador: cambiar de máquina o limpiar el almacenamiento reinicia la secuencia → **[Mitigación]** aceptado a conciencia; volver a empezar por los fundamentos es un daño menor y sincronizarlo costaría backend.
- **[Riesgo]** El contenido envejece o se vuelve repetitivo en tableros de larga vida → **[Mitigación]** los tramos segundo y tercero alargan el ciclo, y ampliar la lista es agregar entradas a un array, sin cambios de spec.
- **[Riesgo]** La franja ocupa dos líneas permanentes y en pantallas chicas compite con el tablero → **[Mitigación]** ubicarla encima del footer (zona ya permanente) y ocultar los atajos de teclado en mobile, donde no sirven, para compensar el alto.
- **[Riesgo]** Quien trabaja en un tablero personal se cruza con tips en plural, pensados para equipos → **[Mitigación]** decisión consciente de Pablo: los tips de coordinación conservan el plural y, donde aplique, se suma la versión singular como tip adicional. Hoy son 14 de 59, es decir una jornada de cada cuatro; sumar las hermanas singulares baja la proporción sin eliminarla.

## Open Questions

_Sin preguntas abiertas._

### Resuelta el 2026-09-11: la franja no muestra categoría

**Decisión de Pablo: sin categoría visible en v1.** La franja es rótulo-libre: solo el texto del tip. Se mantiene el techo editorial de ~110 caracteres y la franja de dos líneas, y la procedencia del consejo va dentro de la frase cuando importa (como ya hace P2-V2, «Cuando hagas un Pomodoro…»).

Razón: en una franja permanente el espacio es el recurso escaso, y un rótulo cuesta ~10 de los ~110 caracteres o una tercera línea permanente. Además la asimetría de riesgo favorece esta opción: agregar la categoría más adelante no invalida ningún requirement ni obliga a reescribir textos; sacarla después sí obligaría a reescribir los que hubieran quedado apoyados en el rótulo. Alternativas descartadas: categoría por tema (Flujo, Próxima acción, Foco y pausas…) y categoría por método (Kanban, GTD, Pomodoro) — esta última además deja sin rótulo asignable a los tips de priorización general (T1–T6, N1–N10), que no provienen de una escuela con nombre.

## Migration Plan

Cambio puramente aditivo: markup y estilos nuevos más tres claves de `localStorage`. Sin migración de datos ni cambios de contrato. Deploy por el flujo normal del proyecto (local → staging → aprobación → producción). Rollback = revertir el deploy; las claves huérfanas en `localStorage` son inertes.
