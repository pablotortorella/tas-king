## Why

FUN TasKing! es una herramienta Kanban, pero hoy no enseña Kanban. Tiene funcionalidades que encarnan buenas prácticas del método —columnas de cierre, Objetivos, Pulso WIP, métricas de flujo— que buena parte de las personas usuarias nunca descubre, y prácticas de fondo (limitar el trabajo en curso, gestionar el flujo, hacer explícitas las políticas) que la app hoy no transmite en ningún lado.

El objetivo no es sólo dar a conocer features: es que quien usa el tablero todos los días vaya incorporando la práctica que hace que el tablero sirva para algo.

## What Changes

- Nueva capacidad **tip diario**: una línea discreta y permanente bajo el header del tablero, con un consejo por día sobre práctica Lean/Kanban.
- **Un tip por día, no una rotación**: el mismo consejo durante toda la jornada. Se lo puede mirar cuando uno quiera, sin que cambie mientras se trabaja.
- **Progresión por persona**: cada persona avanza su propia secuencia. Quien recién llega empieza por el primer tip y recorre los fundamentos en orden; cuando termina la lista, vuelve a empezar.
- **Realce discreto**: una vez por día, tras una interacción cualquiera con el tablero, la línea titila brevemente para que se la note. El titileo no depende de *qué* hizo la persona — sólo aprovecha un momento en que está mirando la pantalla.
- **Contenido**: principio Lean/Kanban primero, afordancia concreta de la app después. La secuencia se ordena según las seis prácticas centrales del método Kanban, y luego continúa con tips de método puro antes de reiniciar el ciclo.
- **Sin toggle de apagado en v1**: es una línea de texto quieta que no interrumpe; se evalúa agregar un control si la práctica muestra que molesta.

### Fuera de alcance (explícito)

- **Onboarding de primer login** (tablero vacío sin guía): es otro problema, con otra solución (estado vacío con acción concreta, tarjetas de ejemplo o mini-tour). Sigue vivo como ítem propio en `docs/PRODUCT_BACKLOG.md`. El tip diario no lo reemplaza.
- **Tips a medida basados en comportamiento** (leer `audit_log` y responder a lo que la persona hizo): explorado y parqueado en `docs/PRODUCT_BACKLOG.md`. Es otra capacidad, con otro espacio de UI, implementable por separado.

## Capabilities

### New Capabilities
- `tip-diario`: consejo diario de práctica Lean/Kanban en el tablero, con progresión propia por persona.

### Modified Capabilities
(ninguna)

## Impact

- **Frontend** (`public/index.html`): la línea de tip bajo el header, la lista ordenada de tips, el puntero por persona y el realce diario. Reutiliza patrones ya presentes en el archivo (preferencias en `localStorage`, tope diario por fecha, animación con guard de `prefers-reduced-motion`).
- **Backend**: sin cambios. No hay endpoints ni tablas nuevas; el contenido es estático y el estado es por navegador.
- Cambio aditivo, sin impacto en datos, permisos ni autenticación.
