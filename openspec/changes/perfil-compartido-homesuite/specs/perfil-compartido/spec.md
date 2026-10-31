## ADDED Requirements

### Requirement: El perfil global pertenece a la plataforma

HomeSuite SHALL mantener un perfil global por ID de usuario, consumido por los
productos mediante contratos comunes independientes de la UI. SHALL separar
identidad de acceso, preferencias de perfil y presentación autorizada.

#### Scenario: Dos productos presentan a una misma persona

- **WHEN** consultan su presentación global autorizada después de una edición
- **THEN** reciben el mismo nombre y avatar resueltos sin mantener copias por producto

#### Scenario: Una persona edita su apariencia

- **WHEN** cambia nombre o avatar
- **THEN** su ID, permisos y autoría permanecen iguales

### Requirement: El nombre permite fuente Google o personalización

HomeSuite SHALL inicializar nombre desde Google cuando esté disponible, actualizar
los valores automáticos al iniciar sesión y conservar el nombre personalizado.
SHALL permitir volver explícitamente al nombre de Google sin afectar avatar ni apodos.

#### Scenario: Login con nombre personalizado

- **WHEN** Google entrega un nombre diferente después de una edición propia
- **THEN** el nombre para mostrar personalizado permanece y se conserva independencia del avatar

#### Scenario: Login con nombre automático

- **WHEN** Google entrega un nombre válido nuevo y la fuente elegida es Google
- **THEN** la presentación usa ese nombre actualizado

#### Scenario: Restablecer nombre Google

- **WHEN** la persona selecciona volver al nombre de Google
- **THEN** usa el último nombre válido del proveedor o la alternativa definida si falta y retoma futuras actualizaciones automáticas sin cambiar avatar ni apodos

### Requirement: El avatar tiene modo explícito y alternativa

El avatar SHALL tener modo `google`, `emoji` o `initial` independiente del nombre.
Google SHALL ser el modo inicial; su imagen SHALL usar sólo referencia válida del
proveedor. SHALL mostrar inicial si falta/falla la foto, sin cambiar preferencia.
Emoji e inicial SHALL usar color elegido; elegirlos SHALL reemplazar visualmente
la foto sin impedir volver a Google. No habrá subida de fotos en este corte.

#### Scenario: Google no entrega foto o la imagen no carga

- **WHEN** la persona tiene modo Google y no hay imagen utilizable
- **THEN** la presentación ofrece la inicial y conserva modo Google

#### Scenario: Emoji elegido y login posterior con foto

- **WHEN** Google devuelve una foto después de seleccionar emoji
- **THEN** sigue seleccionado el emoji con su color, sin perder referencia válida para volver a Google

#### Scenario: Cambiar nombre manteniendo avatar

- **WHEN** se actualiza sólo la preferencia de nombre
- **THEN** no cambia el modo, emoji ni color elegidos

### Requirement: Gestión propia y presentación ajena tienen contratos separados

HomeSuite SHALL permitir edición propia exclusivamente por identidad autenticada.
La presentación ajena SHALL limitarse a datos autorizados para el contexto, sin
email, `sub`, sesión ni preferencias privadas. No habrá directorio global por ID.

#### Scenario: Intento de editar otro usuario

- **WHEN** una petición propia contiene una identidad ajena para cambiar su perfil
- **THEN** el servidor la rechaza sin modificar ningún perfil

#### Scenario: Lectura en grupo compartido

- **WHEN** un integrante autorizado recibe la presentación de otra persona del grupo
- **THEN** sólo obtiene nombre/avatar y contexto permitido, sin datos privados del proveedor

#### Scenario: Mutación sin sesión o sin CSRF válido

- **WHEN** se intenta editar el perfil sin los controles de sesión y origen/token requeridos
- **THEN** la operación se deniega y no modifica ni audita un éxito

### Requirement: Las ediciones protegen consistencia y validación

La plataforma SHALL validar entradas en servidor, rechazar tipos/campos inválidos,
preservar campos omitidos y detectar revisiones desactualizadas sin sobreescritura
silenciosa. Cambio, proyección y auditoría SHALL ser atómicos. Emoji SHALL conservar
secuencias completas y color SHALL provenir del catálogo común.

#### Scenario: Dos ediciones parten de la misma revisión

- **WHEN** una ya confirmó y la otra intenta confirmar después
- **THEN** la segunda recibe conflicto y no borra el primer cambio ni registra éxito

#### Scenario: Emoji compuesto o color inválido

- **WHEN** se recibe una secuencia emoji válida compuesta o un color fuera del catálogo
- **THEN** la primera se conserva completa y el segundo se rechaza sin persistencia parcial

#### Scenario: Login concurrente con edición propia

- **WHEN** Google actualiza datos mientras la persona confirma una preferencia
- **THEN** la preferencia explícita confirmada no se pierde y la proyección queda consistente

### Requirement: Migración e historia preservan datos existentes

La capacidad SHALL conservar perfiles previos sin inferir consentimiento, autoría
por ID y compatibilidad de consumidores. Actividad antigua SHALL presentar el perfil
actual sin reescribir snapshots, nombres contables ni movimientos financieros.

#### Scenario: Usuario previo y primer acceso tras migración

- **WHEN** ya tiene nombre y no hay procedencia verificable
- **THEN** se conserva ese nombre hasta selección explícita de fuente Google y no se pierden membresías

#### Scenario: Alta durante la ventana entre migración y Worker nuevo

- **WHEN** el Worker anterior crea un usuario sin fila de perfil
- **THEN** el Worker nuevo inicializa la fila idempotentemente sin duplicar identidad

#### Scenario: Autor de actividad cambia nombre

- **WHEN** se lee de nuevo la actividad autorizada
- **THEN** se muestra el nombre actual conservando IDs y contenido financiero histórico

#### Scenario: Colección con varios autores

- **WHEN** un producto solicita sus presentaciones autorizadas
- **THEN** la plataforma las obtiene colectivamente sin una consulta por autor
