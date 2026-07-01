# ADR-013: Workflow Analytics Engine (Motor de Análisis de Flujo de Trabajo)

**Estado**: 💡 Pendiente de Decisión / Diseño Técnico
**Fecha Propuesta**: 2026-06-26

## Problema
El sistema registra eventos históricos (`card_moved`, `comment_added`) con alta fidelidad en la tabla `audit_log`. Sin embargo, los usuarios y gestores deben constantemente **analizar** estos datos para tomar decisiones de proceso (ej: "¿Por qué nos estamos retrasando en la etapa 'QA'?"). Actualmente, esta capacidad analítica requiere cálculos complejos y lentos en el *frontend* o está limitada a reportes manuales.

## Decisión Propuesta
Implementar una capa de **Servicio de Resumen Analítico** que consuma los registros de `audit_log` para calcular métricas clave (KPIs) y generar un resumen narrativo precalculado, sirviendo como una "Vista Analítica" sobre el historial transaccional. Esto moverá la lógica analítica del *frontend* al *backend* (`src/db/helpers.js`).

## Consecuencias
**✅ Ventajas:**
1. **Rendimiento (Client-Side):** El *frontend* simplemente llama a un endpoint `/summary` y recibe un objeto DTO precalculado, mejorando la experiencia de usuario significativamente.
2. **Consistencia Backend:** La lógica de cálculo reside en el backend, eliminando inconsistencias client/server.
3. **Escalabilidad Analítica:** Facilita la adición futura de métricas predictivas y *bottleneck detection*.

**❌ Desventajas:**
1. **Write Amplification Risk:** Si se ejecuta el cálculo en cada lectura, puede generar latencia alta si no se gestiona bien la caché o el guardado por eventos (Se requiere implementar Opción A primero).

## Trade-offs y Planificación Técnica (Path Forward)
Se proponen dos enfoques para el cálculo:

1. **Opción A (Recomendada - Low Risk): Cálculo Bajo Demanda (*On-Demand*).**
   - El endpoint `/history` ejecuta la lógica de cálculo **solo en la petición**. Se recomienda usar funciones transaccionales o consultas SQL muy optimizadas contra `audit_log`.

2. **Opción B (Alto Rendimiento - High Complexity): Event Sourcing / Listener.**
   - Se implementa un *trigger* o *listener* que actualiza campos resumen (`metrics_summary`) directamente en la tabla principal de la entidad (ej: `cards`) cada vez que hay un evento en `audit_log`.

**Fase 1 (MVP):** Implementar Opción A. El resultado debe ser exponer el DTO completo:

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
  "activityLog": [ /* lista cronológica de eventos */ ]
}
```

**Siguiente Tarea:** Modificar `src/db/helpers.js` para contener la función `calculateCardKPIs(cardId)` que implemente esta lógica y el endpoint asociado en `src/routes/cards.js`.
