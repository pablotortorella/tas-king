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

### Requirement: Host antiguo como entrada de compatibilidad

El corte SHALL dejar preparado y activar un Worker de compatibilidad en el host antiguo, sin servir la app independiente. SHALL cubrir entradas conocidas con y sin extensión, enlaces de tarjeta, adjuntos y favicon, usando un destino fijo autorizado por ambiente. Las navegaciones antiguas sin equivalencia SHALL ofrecer continuidad hacia Tareas y nunca una página genérica de error de infraestructura. La API antigua SHALL terminar con una respuesta explícita de migración sin devolver datos de negocio ni reenviar operaciones a HomeSuite. OAuth antiguo SHALL reiniciar el acceso HomeSuite sin transportar `code`, `state`, tokens, cookies o parámetros arbitrarios. El puente SHALL continuar disponible sin fecha de retirada automática; su eliminación requiere verificar el uso remanente y una decisión explícita.

#### Scenario: Favorito antiguo
- **WHEN** una persona abre la raíz, `/index.html`, `/landing` o una variante histórica equivalente en el host antiguo
- **THEN** llega a `/tareas` en HomeSuite del ambiente correcto mediante un recorrido sin bucles ni dependencia de la app antigua

#### Scenario: Enlace antiguo a archivo
- **WHEN** se abre `/uploads/:key` desde un favorito o una conversación anterior
- **THEN** se llega al recurso correspondiente en HomeSuite mediante su login y permiso de tablero; un recurso borrado o ajeno recibe un estado controlado que no revela datos

#### Scenario: Favicon antiguo
- **WHEN** un navegador pide el favicon de TasKing en su dirección antigua
- **THEN** recibe una imagen válida o redirección a su imagen equivalente, nunca HTML de login presentado como imagen

#### Scenario: Petición de API de una pestaña antigua
- **WHEN** una pestaña antigua consulta o modifica `/api/*` después de completar el corte
- **THEN** recibe una respuesta de migración identificable, no un éxito falso ni una redirección que reenvíe su método, cuerpo o credenciales

#### Scenario: Callback Google tardío
- **WHEN** vuelve un callback OAuth iniciado en el origen antes del corte
- **THEN** el origen ya no crea sesión ni datos y conduce a un acceso nuevo en HomeSuite sin reenviar ni registrar sus credenciales de callback

#### Scenario: Destino de redirección manipulado
- **WHEN** la URL antigua contiene un destino externo, cabeceras de host manipuladas, rutas codificadas o parámetros inesperados
- **THEN** sólo se usa la correspondencia permitida hacia el ambiente fijo y no se copian secretos ni destinos arbitrarios

### Requirement: Una sola versión operativa después del corte

Después del corte, ningún dominio, alias o preview alcanzable del origen SHALL permitir operar sobre su copia anterior. El cierre SHALL abarcar assets servidos antes del Worker, API, autenticación, crons y caminos de despliegue/rollback que pudieran reactivar el origen. SHALL existir un bloqueo persistente de escrituras del origen además de la redirección; no se permitirá repartir tráfico entre una versión editable y el puente. El Worker de compatibilidad SHALL prescindir de acceso activo a D1/R2 y secretos de autenticación una vez retirados los caminos de negocio. Los recursos de recuperación SHALL permanecer separados de los activos.

#### Scenario: Entrada por asset o alias
- **WHEN** se pide un HTML, bundle o alias histórico después del corte
- **THEN** no se obtiene una aplicación independiente operable ni un bypass que siga usando la base antigua

#### Scenario: Publicación antigua accidental
- **WHEN** un script, automatización o rollback intenta restablecer una versión editable del origen después del corte
- **THEN** los controles operativos impiden reabrir escrituras sobre la copia anterior y registran el intento o la condición bloqueante

#### Scenario: Pestaña con borrador durante el corte
- **WHEN** una persona tiene un borrador sin guardar cuando el origen entra en mantenimiento o queda migrado
- **THEN** el cliente preparado informa qué no está guardado y cómo continuar sin sobrescribirlo ni navegar automáticamente perdiéndolo; un cliente antiguo que no entiende el aviso tampoco recibe una confirmación falsa

#### Scenario: Interrupción del destino después del corte
- **WHEN** HomeSuite falla temporalmente después de admitir cambios
- **THEN** se ofrece información recuperable de indisponibilidad sin activar la app vieja ni enviar escrituras a su copia desactualizada
