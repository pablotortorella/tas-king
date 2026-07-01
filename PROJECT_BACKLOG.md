# 🚀 PROJECT BACKLOG & EPICS (Resumen Maestro)

## 🎯 ÉPICA EN CURSO / PRÓXIMO FOCUS
**Épica:** Motor de Análisis de Flujo de Trabajo y KPIs (`Workflow Analytics Engine`)
**Prioridad**: Alta (Tras #3 Checklists, #2 Labels).
**Estado Objetivo:** Listo para Desarrollo Técnico/Implementación.

### 📊 Resumen del Impacto (Lo que se logró documentar):
- **ADR Formalizado:** ADR-013 creado. Define la necesidad de pasar de la mera *captura* a la *interpretación* de eventos.
- **Status Actualizado:** `docs/STATUS.md` lista el punto #8, señalando la meta.
- **Especificación Técnica:** `AI_HANDOFF.md` contiene los pasos exactos (DTO, funciones específicas en `src/db/helpers.js`) para que un agente ejecutor tome la batuta.

### ✨ Deliverable a Generar (El Producto Final)
Un endpoint de lectura (`GET /api/cards/:id/history`) que devuelva un objeto enriquecido con el siguiente esquema:

```json
{
  "cardId": "...",
  "boardId": "...",
  "timestampCalculated": "YYYY-MM-DDTHH:MM:SSZ",
  "summaryMetrics": {
    "totalMovementCount": 5,
    "stageEntryCounts": {
      "Pendiente": 1,
      "En Progreso": 3
    },
    "timeInStageDays": {
      "Pendiente": 2.5,
      "En Progreso": 1.8
    }
  },
  "activityLog": [ /* Lista cronológica de eventos */ ]
}
```

### 🛠️ Pasos Técnicos Clave (Para el Desarrollador):
1. **Backend/DB:** Refactorizar `src/db/helpers.js` con la función `calculateCardKPIs(cardId)` que implemente la lógica de conteo y promedio.
2. **Routes/API:** Actualizar el endpoint `/api/cards/:id/history` en `src/routes/cards.js` para llamar a esta nueva función y serializar la respuesta DTO (Summary + Log).
3. **Testing:** Crear o actualizar tests unitarios/E2E que validen los valores calculados (KPIs) contra escenarios conocidos.

**Siguiente Paso Definido:** Pasar al desarrollo técnico, enfocándose en la refactorización del backend basado en el ADR-013.

---

## 📋 Backlog Completo

| # | Feature | Estado | Prioridad |
|---|---|---|---|
| #0 | Deep-link a tarjeta | ✅ Completo | — |
| #1 | Historial de actividad | ✅ Completo | — |
| #2 | Etiquetas + filtro | ✅ Completo | — |
| #3 | Checklists / subtareas | ✅ Completo | — |
| #4 | Proteger adjuntos | ✅ Completo | — |
| #5 | Validar JWT de Google | ✅ Completo | — |
| #6 | Modo oscuro/claro | ✅ Completo | — |
| #7 | Lead time y tasa completitud | ✅ Completo (parte de #8) | — |
| **#8** | **Workflow Analytics Engine / ¿Cómo vamos?** | **✅ MVP completo** | **—** |
| **#9** | **¡Pilas con esto! — puerta de entrada inteligente** | **❌ Pendiente** | **Alta** |
| — | Columnas de cierre múltiples (isDone toggle) | ✅ Completo | — |
| — | CSP + Security Headers | ✅ Completo | — |
| — | Fix swatches etiquetas (tamaño) | ✅ Completo | — |
| — | Tab/Enter en modal tarjeta | ❌ Pendiente | Alta (UX) |
| — | Onboarding nuevos usuarios | ❌ Pendiente | Media |
| — | Búsqueda avanzada full-text | ❌ Pendiente | Baja |

---

## 🔥 #9 — ¡Pilas con esto! como puerta de entrada inteligente

**Estado:** Pendiente (top 5 estático ya implementado como sección del panel ¿Cómo vamos?)
**Prioridad:** Alta — toca el corazón del producto

### Visión

Hoy "¡Pilas con esto!" muestra las tareas más quietas. El siguiente paso es convertirla en la **recomendación activa** que abre la app: cuando el usuario llega, el sistema ya sabe qué debería hacer primero.

La lógica recomendada es siempre la misma: **terminar algo que está empezado antes de empezar algo nuevo**. Las tareas más avanzadas en el tablero (más a la derecha) deberían ser priorizadas sobre las nuevas.

### Ideas de evolución

1. **Destello periódico en tarjetas en progreso** — cada N segundos, las tarjetas de las columnas intermedias (no la primera, no la última) reciben un destello visual similar al confeti de celebración. Empezando por las más a la derecha: las más cerca de terminar. El objetivo: hacer visible lo que está casi listo para que el usuario lo termine.

2. **Panel de entrada** — al abrir Fun TasKing!, en vez de arrancar con el tablero vacío, mostrar brevemente "¿Por dónde empezamos hoy?" con la lista ¡Pilas con esto! como punto de partida, y un botón "Ver tablero" para continuar.

3. **Configuración de N** — permitir al owner del tablero configurar cuántas tareas muestra la lista (default 5, máximo 10).

4. **Notificación silenciosa** — si una tarea lleva más de X días sin moverse, mostrar un badge o ícono especial en la tarjeta directamente en el tablero.

### Por qué es clave para el producto

Fun TasKing! se posiciona como una herramienta que no solo organiza tareas sino que **empuja a terminarlas**. "¡Pilas con esto!" es la manifestación más directa de esa filosofía: no acumular, no olvidar, cerrar el loop.
