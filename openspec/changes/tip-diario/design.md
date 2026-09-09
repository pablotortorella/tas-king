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

- **Una lista plana, ordenada intencionalmente.** Los tips del primer tramo (principio + afordancia) y los del segundo (método puro) viven en el mismo array; la progresión está en el orden, no en el código. El puntero no necesita saber que hay tramos. *Alternativa descartada*: marcar los tramos con metadata y saltear el primero en la segunda vuelta — agrega estado ("ya completó una vuelta") para resolver una redundancia menor, y son prácticas que se re-aplican.

- **Realce con tope diario propio, reutilizando el patrón de fecha.** Una tercera clave con la fecha del último realce, con la misma forma que `tasking-wip-msg-date`. Se dispara en el primer evento de interacción del día con el tablero; después queda inerte hasta el día siguiente.

- **El realce es refuerzo, no mecanismo.** Va dentro del mismo guard de `prefers-reduced-motion` que el pulso existente. Si no se ejecuta, el tip sigue visible y legible: el spec exige que la capacidad funcione sin animación.

- **Sin toggle de apagado en v1.** El header ya tiene cuatro controles (🎯, 🌙, perfil, Admin) y esto es una línea de texto quieta sin descarte. Se deja la puerta abierta: agregar un toggle después no invalida ningún requirement de este spec. *Alternativa considerada*: darle su propio toggle por simetría con el Pulso WIP — argumento legítimo, pero ese pulsa tarjetas y lanza un toast; esto no hace ruido comparable.

## Risks / Trade-offs

- **[Riesgo]** Un tip pasivo es fácil de ignorar; si nadie lo lee, no cambia ninguna práctica → **[Mitigación]** el realce diario existe justamente para eso, y está acotado a un momento en que la persona está mirando la pantalla. Si aun así no alcanza, la evidencia estará en el uso y se podrá revisar el realce sin tocar el resto.
- **[Riesgo]** El avance vive en el navegador: cambiar de máquina o limpiar el almacenamiento reinicia la secuencia → **[Mitigación]** aceptado a conciencia; volver a empezar por los fundamentos es un daño menor y sincronizarlo costaría backend.
- **[Riesgo]** El contenido envejece o se vuelve repetitivo en tableros de larga vida → **[Mitigación]** el segundo tramo alarga el ciclo, y ampliar la lista es agregar entradas a un array, sin cambios de spec.
- **[Riesgo]** Ocupar espacio permanente bajo el header compite con el tablero en pantallas chicas → **[Mitigación]** verificar en mobile durante la implementación; el elemento es de una línea y debe poder truncar sin romper el layout.

## Migration Plan

Cambio puramente aditivo: markup y estilos nuevos más tres claves de `localStorage`. Sin migración de datos ni cambios de contrato. Deploy por el flujo normal del proyecto (local → staging → aprobación → producción). Rollback = revertir el deploy; las claves huérfanas en `localStorage` son inertes.
