## Purpose

Garantizar una transición verificable desde TasKing independiente a HomeSuite, preservando datos y acceso y evitando escrituras divergentes o un retiro prematuro del origen.

## ADDED Requirements

### Requirement: Traslado completo y reanudable

El traslado SHALL preservar identificadores de entidades de Tareas, relaciones, roles, contenido, orden, marcas temporales, revisiones de sincronización, configuración propia e historia de actividad. SHALL incluir identidades aún sin cuenta HomeSuite, archivos adjuntos y metadatos, además de todas las entidades necesarias para las funciones vigentes. SHALL usar un formato operativo versionado con manifiesto de cobertura, conteos y comprobación de integridad de archivos, sin modificar datos existentes de otros productos. Repetir o reanudar el mismo traslado SHALL evitar duplicados y detectar discrepancias; una importación incompleta SHALL permanecer inaccesible para uso normal.

#### Scenario: Tablero con todas sus relaciones
- **WHEN** se traslada un conjunto con tarjetas archivadas, comentarios, adjuntos, etiquetas, checklists, objetivos, columnas, roles, preferencias y actividad
- **THEN** el destino conserva las entidades y relaciones, el contenido de los archivos y las opciones necesarias para continuar trabajando

#### Scenario: Reintento tras fallo parcial
- **WHEN** falla la copia de un archivo o un lote y se reanuda el mismo traslado
- **THEN** continúa sin duplicar entidades, no habilita el conjunto incompleto y sólo permite habilitarlo después de conciliar datos y archivos

#### Scenario: Destino con datos financieros existentes
- **WHEN** se carga TasKing en una HomeSuite con usuarios, grupos y movimientos
- **THEN** no reemplaza ni reinicializa esos datos y las comprobaciones confirman su conservación

### Requirement: Origen operativo y autoridad única durante el corte

TasKing independiente SHALL seguir operativo durante la preparación y las pruebas. La activación final SHALL impedir escrituras concurrentes en copias independientes: detener y drenar las mutaciones del origen, obtener la copia final, conciliar y habilitar el destino en ese orden. Durante esa ventana SHALL informar mantenimiento recuperable sin afirmar que cambios rechazados se guardaron. Antes de habilitar el destino SHALL existir recuperación ensayada y evidencia del mismo artefacto en staging.

#### Scenario: Uso durante la preparación
- **WHEN** se construye o verifica TasKing integrado con datos sintéticos
- **THEN** las personas siguen usando el origen sin que la preparación altere sus datos o permisos

#### Scenario: Cliente antiguo durante el corte
- **WHEN** una pestaña antigua intenta editar, importar, subir o borrar después de bloquear mutaciones del origen
- **THEN** recibe mantenimiento o indicación de continuar en HomeSuite sin escribir en el origen ni fingir éxito

#### Scenario: Escritura iniciada antes del bloqueo
- **WHEN** hay una subida o mutación en curso al iniciar el corte
- **THEN** el corte espera su finalización o la cancela de forma comprobable antes de capturar el estado final, sin omitir cambios confirmados

### Requirement: Recuperación según el punto de activación

Un fallo antes de admitir escrituras en HomeSuite SHALL permitir volver al origen íntegro sin perder cambios confirmados. Después de admitirlas SHALL impedir reabrir el origen desactualizado como escritor: SHALL conservar los cambios del destino y requerir reparación o recuperación conciliada antes de cambiar la autoridad. Los respaldos SHALL cubrir D1 y archivos, con prueba de restauración aislada; los fallos de conciliación SHALL bloquear el corte.

#### Scenario: Archivo faltante antes de activar
- **WHEN** la conciliación final detecta un adjunto faltante
- **THEN** no se habilita HomeSuite como escritor y se conserva la posibilidad de reanudar el origen

#### Scenario: Fallo tras nuevas escrituras
- **WHEN** ocurre un incidente después de que alguien guardó cambios en HomeSuite
- **THEN** no se reactiva el origen antiguo sin conciliarlos y se preservan los datos del destino para recuperación

### Requirement: Retiro de autorización global al completar la migración

La versión integrada SHALL funcionar sin lista global de autorizados, solicitudes de acceso ni aprobación administrativa previa. Tras verificar el traslado completo SHALL retirarse su gestión y configuración heredadas del camino activo, junto con el OAuth y la cookie independientes que ya no se usen. SHALL conservarse la autorización necesaria en el origen hasta el corte y la evidencia necesaria para recuperación según la política operativa. El retiro SHALL distinguir la autorización global obsoleta de los roles por tablero y administrativos propios que se conservan.

#### Scenario: Acceso con HomeSuite sin lista
- **WHEN** una cuenta de HomeSuite entra a TasKing integrado sin figurar en la lista antigua
- **THEN** obtiene su tablero personal y sólo los tableros donde tiene membresía, sin generar una solicitud de autorización global

#### Scenario: Finalización del traslado
- **WHEN** el destino fue conciliado, verificado y aceptado como autoridad
- **THEN** los enlaces antiguos conducen a Tareas en HomeSuite y los endpoints y controles de aprobación global dejan de estar disponibles

#### Scenario: Retiro sin ampliar permisos
- **WHEN** se elimina la autorización global heredada
- **THEN** los controles por tablero y los privilegios administrativos que aún existen siguen aplicándose sin conceder acceso general a tableros
