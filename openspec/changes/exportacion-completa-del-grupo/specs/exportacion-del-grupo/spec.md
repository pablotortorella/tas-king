## Purpose

Define qué exporta HomeSuite de un grupo de Cuentas Claras, en qué formato, para quién, con qué garantía de fidelidad y cómo queda auditado.

## ADDED Requirements

### Requirement: La exportación JSON contiene todo lo que el grupo guarda para la persona que exporta

La exportación JSON SHALL incluir, con ids estables, el grupo (nombre, descripción, emoji, color, fechas y estado de archivo), los integrantes con rol y fecha de ingreso, las personas del grupo (incluidas las unidas, con la persona de destino), las uniones de personas, las categorías, los movimientos con partes de efectivo, repartos y efectos, las revisiones, los eventos del libro, las recategorizaciones, los lotes de importación y sus filas de origen, y los saldos por persona y moneda. SHALL declarar `schemaVersion` y el momento de exportación. Los importes SHALL expresarse en unidad menor con su moneda. La exportación SHALL NOT incluir lotes o filas que todavía no se publicaron.

#### Scenario: Exportar un grupo completo

- **WHEN** la persona titular exporta un grupo con movimientos, una unión de personas y una importación publicada
- **THEN** el JSON incluye todas esas secciones, la versión de esquema y los saldos por persona y moneda

#### Scenario: Importación sin publicar

- **WHEN** el grupo tiene un lote de importación todavía sin publicar
- **THEN** el JSON no contiene sus movimientos ni sus filas de origen

#### Scenario: Grupo archivado

- **WHEN** un integrante exporta un grupo archivado
- **THEN** la exportación funciona y refleja el estado de archivo

### Requirement: El contenido depende del rol y no incluye emails

La exportación SHALL incluir exactamente lo que la aplicación muestra a quien exporta. La persona titular SHALL recibir además las invitaciones (con su estado, fechas y persona vinculada) y los eventos de auditoría de la plataforma del grupo; un integrante SHALL NOT recibir esas dos secciones. Ninguna exportación SHALL contener el email de un integrante ni de una persona invitada.

#### Scenario: Un integrante exporta

- **WHEN** un integrante que no es titular exporta el grupo
- **THEN** el JSON no contiene `invitations` ni `auditEvents`

#### Scenario: Sin emails

- **WHEN** se exporta un grupo con una invitación pendiente a un email
- **THEN** ningún archivo exportado contiene ese email

### Requirement: Solo integrantes exportan y la respuesta no revela grupos ajenos

El servidor SHALL permitir exportar a cualquier integrante del grupo, SHALL pedir iniciar sesión a quien no la tiene y SHALL responder 404 sin datos a quien está autenticado pero no es integrante, sin distinguir entre grupo inexistente y ajeno.

#### Scenario: Persona ajena

- **WHEN** una persona autenticada que no integra el grupo pide la exportación
- **THEN** recibe 404 sin datos

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión pide la exportación
- **THEN** se le pide iniciar sesión y no recibe datos

### Requirement: Los datos exportados reproducen los saldos

Los saldos recalculados a partir de los movimientos vigentes del JSON, con las reglas de dominio del producto, SHALL coincidir exactamente por persona y moneda con los saldos que muestra la aplicación y con la sección `balances` del archivo, incluidos casos de redondeo, uniones de personas, anulaciones y varias monedas.

#### Scenario: Exportar y recalcular

- **WHEN** se exporta un grupo con un reparto de 100,00 entre tres personas, una anulación y dos monedas, y se recalculan los saldos desde el archivo
- **THEN** los saldos por persona y moneda son idénticos a los de la aplicación

### Requirement: El CSV se entiende sin el JSON

El CSV SHALL tener una fila por efecto de la versión vigente de cada movimiento y SHALL incluir, además de los identificadores, el nombre de la persona afectada y de quien cargó el movimiento. Todo texto que comience con `=`, `+`, `-` o `@` SHALL escribirse de modo que no se interprete como fórmula.

#### Scenario: Nombres en el CSV

- **WHEN** se abre el CSV de un grupo con tres personas
- **THEN** cada fila muestra el nombre de la persona además de su id

#### Scenario: Descripción con fórmula

- **WHEN** una descripción comienza con `=`
- **THEN** el CSV la escribe precedida por una comilla simple

### Requirement: Cada exportación queda auditada sin modificar el libro

Cada exportación SHALL registrar en la auditoría de la plataforma quién exportó, el grupo, el formato y la revisión del libro leída antes de armar el archivo. Exportar SHALL NOT cambiar la revisión del libro. El número de exportaciones por persona SHALL estar limitado y, al superar el límite, el servidor SHALL responder 429.

#### Scenario: Registro de la exportación

- **WHEN** un integrante exporta el JSON
- **THEN** existe un evento `ledger_exported` con su identidad, el grupo, el formato y la revisión del libro, y la revisión del libro no cambió

#### Scenario: Exportación durante una importación en curso

- **WHEN** una persona exporta mientras otra tiene una vista previa de importación abierta
- **THEN** la vista previa no queda invalidada por la exportación

### Requirement: La exportación se descarga desde una pantalla pensada para el teléfono

La aplicación SHALL ofrecer una pantalla de exportación con las descargas JSON y CSV, una explicación de qué contiene cada una y de que no sustituye a las copias de seguridad, con controles de al menos 44 px y sin desborde horizontal en 390 px de ancho. El nombre del archivo SHALL incluir el grupo y la fecha.

#### Scenario: Descargar desde el teléfono

- **WHEN** una persona abre la pantalla de exportación en 390 px
- **THEN** ve ambas descargas sin desplazarse horizontalmente y el archivo descargado se llama `cuentas-claras-<grupo>-<fecha>.json`

### Requirement: El formato está documentado como contrato versionado

El repositorio SHALL documentar cada sección del JSON, la unidad de los importes, el cálculo de saldos y la regla de versionado en un documento que una prueba usa para validar el archivo exportado.

#### Scenario: El archivo coincide con el documento

- **WHEN** la prueba de esquema valida una exportación de ejemplo contra lo documentado
- **THEN** no hay secciones ni campos sin documentar ni documentados que falten

### Requirement: La persona puede exportar los datos de su cuenta

Una persona autenticada SHALL poder descargar, desde «Mi perfil», un JSON con los datos de su cuenta: identificador, nombre visible, su email, fecha de alta, perfil, grupos de los que es integrante con su rol y fecha de ingreso, invitaciones recibidas, aceptaciones de términos y los eventos de auditoría en los que ella actuó. La descarga SHALL ser gratuita, SHALL registrar un evento de auditoría, SHALL estar sujeta al límite de uso y SHALL estar disponible aunque haya una versión de términos sin aceptar. SHALL NOT incluir movimientos ni personas de los grupos, ni datos de otras personas. La pantalla SHALL enlazar la exportación de cada grupo.

#### Scenario: Descargar mis datos

- **WHEN** una persona con cuenta abre «Mi perfil» y descarga sus datos
- **THEN** recibe un JSON con su cuenta, sus grupos, sus invitaciones y sus aceptaciones, y queda un evento `account_exported`

#### Scenario: Sin datos de otras personas

- **WHEN** se inspecciona el archivo de una integrante de un grupo con tres personas
- **THEN** no contiene emails, nombres de otras personas ni movimientos

#### Scenario: Sin sesión

- **WHEN** alguien sin sesión pide `/perfil/mis-datos.json`
- **THEN** se le pide iniciar sesión y no recibe datos
