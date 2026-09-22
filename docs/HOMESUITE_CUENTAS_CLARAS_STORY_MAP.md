# HomeSuite Cuentas Claras — User Story Map

**Estado:** validado como mapa de producto; las historias candidatas están en el backlog, todavía sin cambio OpenSpec

**Fecha:** 2026-09-21

## Resultado que organiza el mapa

Una persona puede dejar Splitwise sin perder sus movimientos ni sus saldos,
continuar registrando la vida compartida en HomeSuite y encontrar cualquier
movimiento —nuevo o importado— desde una misma experiencia.

El mapa sigue actividades de la persona, de izquierda a derecha. Cada fila
inferior es un corte vertical que atraviesa el recorrido completo, no una lista
de componentes técnicos. La primera prueba no equivale todavía a un lanzamiento
para todos; el segundo corte es el primer reemplazo familiar usable.

## Backbone y cortes de entrega

| Corte | 1. Armar el grupo | 2. Elegir y traer el punto de partida | 3. Registrar lo nuevo | 4. Encontrar movimientos | 5. Entender y conciliar | 6. Compartir y conservar |
|---|---|---|---|---|---|---|
| **Tareas de la persona** | Nombrar grupo; reconocer participantes | Importar historia o abrir en cero/no cero; revisar procedencia | Anotar gasto, ingreso o transferencia | Buscar por nombre, monto o palabra; distinguir origen | Ver saldo por persona y moneda; explicar cambios; quedar a mano | Invitar, corregir, exportar y archivar |
| **A · Probar la migración** | Titular con login y una persona invitada que acepta acceso | Seleccionar un CSV Splitwise; mapear personas; incorporar todas las líneas válidas una vez | Añadir un gasto nuevo para probar continuidad | Campo libre único para nuevos e importados; marcar «Importado de Splitwise» | Comparar saldo final; señalar incidentes por fila y diferencias sin ajustes ocultos | Ver resumen del lote, supuestos y filas no importadas |
| **B · Reemplazo familiar usable** | Invitar con acceso seguro; gestionar participantes | Permitir inicio en cero o apertura no cero; impedir solapamiento con importación | Gastos, ingresos y transferencias; repartos frecuentes; correcciones auditables | Misma búsqueda global en móvil; resultados con fecha, personas, monto y origen | Balance neto, detalle explicativo y sugerencia de transferencia para quedar a mano | Exportar CSV/JSON, respaldar y recuperar; revocar acceso sin perder historia |
| **C · Ampliar a otros grupos** | Viajes, amistades y proyectos con más participantes | Migrar otros grupos o relaciones; reimportaciones controladas | Repartos desiguales, varios pagadores/receptores y varias monedas | Filtros avanzados sin separar el historial por fuente | Cierre y archivo de grupo con saldos visibles | Roles y preferencias más finos; restaurar grupos |

El modelo de datos y la autorización deben admitir grupos generales desde el
inicio; «grupo con dos participantes» en A es una prueba de recorrido, no una
limitación estructural. Los cortes son hipótesis de entrega para validar antes
de convertirlos en historias de backlog.

## Reglas transversales acordadas

- Aceptar CSV del formato de exportación de Splitwise, sea de grupo o relación
  directa. Importar **todos los movimientos válidos**. Una duda sobre pagador o
  reparto original no bloquea la línea ni cambia su efecto exacto. No importar
  filas de resumen como movimientos ni omitir filas silenciosamente.
- Si hay un incidente, indicar número de fila y motivo. Permitir cancelar,
  avanzar con un supuesto explícito o importar sólo el subconjunto seguro. El
  resumen conserva supuestos y filas excluidas; una diferencia global sin fila
  atribuible se muestra sin inventar una explicación.
- Conservar procedencia visible por movimiento importado y por lote. Inferencias
  útiles sobre «quién pagó» pueden mostrarse como tales, pero no sustituyen los
  efectos originales que trae la fuente.
- Historial, búsqueda y balance son únicos para movimientos propios e
  importados. La búsqueda inicial es un campo libre: textos, participantes,
  montos totales y efectos individuales, con coincidencia explicada y origen
  visible en cada resultado importado.
- Al terminar la importación, comparar balances por participante y moneda con
  los del origen. Una diferencia se explica o se señala: nunca se corrige con
  un asiento invisible.
- Los saldos de apertura no cero son hechos fechados, equilibrados por moneda y
  auditables. No se añaden sobre el mismo período ya importado.
- Un reintento o la carga repetida del mismo archivo no debe duplicar dinero.
  La evolución hacia importaciones incrementales es una decisión posterior.
- No usar exports reales, nombres, descripciones ni importes de personas en el
  repositorio, fixtures de prueba o bases de datos durante el diseño. Las
  pruebas usan datos sintéticos.

## Puerta de salida del primer reemplazo usable (B)

1. Un titular autenticado crea el grupo e invita a una persona que acepta acceso.
2. El grupo puede comenzar por importación o por apertura cero/no cero.
3. La importación incorpora todos los movimientos válidos, muestra su origen y
   reconcilia los saldos sin duplicados ni filas omitidas silenciosamente. Ante
   un incidente permite cancelar, explicitar un supuesto o excluir un subconjunto.
4. Dos personas autorizadas registran gastos, ingresos y transferencias sin
   perder ni duplicar cambios; el saldo neto se explica desde el historial.
5. Una búsqueda libre por texto, nombre o monto devuelve en conjunto movimientos
   importados y creados en HomeSuite.
6. Correcciones, exportación y respaldo permiten confiar en la historia y salir
   del producto si fuese necesario.

## Preguntas para revisar antes del backlog

- ¿Qué parte de la inferencia «pagó X / se dividió así» se muestra por defecto
  en importados y cuál queda como detalle verificable?
- ¿Qué supuestos de corrección estarán disponibles ante una fila con incidente?
- ¿Qué fecha de corte se usará cuando se combine apertura con importación parcial?

## Siguiente paso

Validar o mover los cortes A/B/C en conversación. Recién entonces derivar unas pocas
User Stories pequeñas para el corte A, cada una con criterio observable de
aceptación y sin convertir este mapa en una lista de tareas técnicas.

## Documentos relacionados

- [User Journey de entrada y migración](HOMESUITE_CUENTAS_CLARAS_JOURNEY.md)
- [Brief de exploración](HOMESUITE_CUENTAS_CLARAS_EXPLORACION.md)
- [Especificación funcional inicial](HOMESUITE_CUENTAS_CLARAS_MVP.md)
- [Versión visual navegable](../visual/story-map.html) · [PDF para revisión](../visual/story-map.pdf)
