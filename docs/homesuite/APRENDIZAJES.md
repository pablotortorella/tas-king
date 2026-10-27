# Aprendizajes de TasKing y HomeSuite

Registro inicial: 2026-10-24. Parte de la [base común](README.md).
Hechos tomados de documentación versionada; no son una nueva auditoría remota.
Cada fila vincula incidente, prevención y evidencia. Un riesgo señalado no equivale
a un incidente confirmado ni a una corrección ya implementada.

| Hecho / error documentado | Aprendizaje convertido en control | Fuente y estado |
|---|---|---|
| Frontend y backend admitían paletas de etiquetas distintas; hubo publicación sin la confirmación prevista. | Revisar contratos entre capas y validar integración; aprobación explícita de producción. | [Cambios multicapa](../CAMBIOS-MULTICAPA.md); protocolo vigente en método y operación. |
| Las cabeceras de seguridad no llegaban al HTML: el test directo del handler omitía el ruteo de assets. | Verificar respuestas del servidor y navegador reales, incluyendo documentos y redirecciones. | [ADR-017](../ADRs/ADR-017-frontend-modular-y-cabeceras.md); corregido y verificado según STATUS. |
| Frontend inline creció a miles de líneas; la primera propuesta de bus no preservaba llamadas esperadas con `await`. | Modularizar por dependencias y caracterizar semántica antes de imponer un patrón. | ADR-017; refactor implementado. |
| La sesión firmada seguía habilitando acceso tras quitar la autorización; descargas tenían su propia entrada. | Autorización vigente en cada recurso y cobertura negativa de todas las entradas. | [ADR-015](../ADRs/ADR-015-revocacion-acceso-sesion-cookie.md); corrección registrada. |
| La versión derivada de fechas no detectaba borrados, comentarios ni colisiones de reloj. | Revisión persistente atómica y lectura consistente; preservar borradores y probar otra identidad. | [ADR-016](../ADRs/ADR-016-board-sync-revision.md); corrección registrada. No resuelve conflictos de edición. |
| Exportar tablas omitía triggers necesarios para sincronización. | Probar comportamiento después de restaurar, además de contar registros. | ADR-016; regresión de triggers. No acredita restauración completa de todos los componentes. |
| Se documentó migrar primero, pero scripts desplegaban antes: existía riesgo de consultar columnas aún ausentes. | Codificar y probar el orden compatible. Un fallo de migración debe cortar el deploy. | ADR-016 y STATUS 2026-09-18; scripts corregidos. La ventana de 500 era un riesgo evitado, no una caída demostrada. |
| Se pidieron pruebas de ramas que staging no contenía. Worktrees reutilizaban el mismo puerto E2E. | Identificar versión servida y coordinar entornos/procesos compartidos. | [STATUS](../STATUS.md), v2.3.1; protocolo manual, sin aislamiento automático completo. |
| El móvil físico cortaba el tip con `100vh`; el emulador no lo reproducía. | Prueba física dirigida cuando el riesgo depende de barras, viewport o teclado. | STATUS, v2.3.1; corregido con viewport dinámico y fallback. |
| Objetivos contaban una sola columna de cierre en servidor y cliente; se aceptaban columnas inexistentes por varias rutas. | Revisar cardinalidades y todos los caminos de escritura. Evitar que polling oculte el defecto del cliente. | STATUS, v2.3.2; regresiones previas al fix y correcciones registradas. |
| El primer OAuth real de HomeSuite detectó PKCE sin `code_verifier` en el canje. | Probar el intercambio completo con proveedor; no confundir un login con colaboración de dos cuentas. | STATUS, 2026-10-16; fix registrado, aceptación completa requiere evidencia propia. |
| Import/export quedó atrás de etiquetas, checklists y asignación; también hubo estilos de títulos inconsistentes. | Incluir consumidores y patrones de UI en el cierre de cada cambio de modelo. | Historial de WORKFLOW anterior a esta base, 2026-07-01; controles comunes y ficha TasKing. |
| `uid()` tuvo una colisión posible y aparecieron otros fallos intermitentes. | Investigar causa, conservar diagnóstico y seguimiento; reintento verde no elimina riesgo. | STATUS, v2.3.0/v2.3.1; pendientes, no declarados resueltos aquí. |
| Guías duplicaban versiones, instrucciones de sesión y resets de `.wrangler`; llegaron a contradecirse. | Una fuente por responsabilidad; fichas por producto y eliminación de resets indiscriminados. | Reorganización documental de esta rama; controles de enlaces locales, aún sin CI dedicada. |
| Al configurar producción (2026-10-27), se confundió el secreto OAuth de Google con el token de Cloudflare para respaldos y se guardó temporalmente bajo el nombre del token en GitHub Actions. | Al pedir una credencial, nombrar proveedor, finalidad, destino y comando en un solo paso; comprobar sólo nombres y retirar de inmediato copias en el destino equivocado. | [STATUS](../STATUS.md): copia retirada; el workflow de backup seguía sin integrar ni activar, sin ejecución con ese valor. |
| El backup automatizado obtuvo un bookmark con `D1 Read` pero `d1 export` devolvió código 10000; la regla de retención R2 sola no crea copias. | Ensayar la credencial real de CI de punta a punta y mantener desactivada la tarea periódica hasta verificar exportación, carga y restauración. | [STATUS](../STATUS.md), 2026-10-27; token actualizado y ensayo manual completo; alcance exacto del permiso D1 y primer cron aún pendientes de comprobar. |

## Cómo incorporar el siguiente aprendizaje

Registrar fecha y evidencia, comportamiento observado y alcance; distinguir causa
confirmada de hipótesis. Enlazar corrección y prueba/control que habría prevenido
el error. Actualizar el documento madre correspondiente y la ficha si existe un
detalle de producto. Asignar seguimiento a lo no resuelto; no cerrar por falta de
reproducción ni convertir una excepción pasada en regla permanente.
