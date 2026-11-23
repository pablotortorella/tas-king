## MODIFIED Requirements

### Requirement: Conservación de funciones y experiencia

La versión integrada SHALL conservar las funciones actuales de tableros, columnas configurables y múltiples cierres, tarjetas, asignaciones, fechas, comentarios, adjuntos, etiquetas, checklists, objetivos, métricas, actividad, búsqueda, filtros, archivo/restauración, importación aditiva JSON/CSV y exportación. SHALL conservar orden, arrastre, teclado, temas, preferencias propias, tip diario, celebraciones y sincronización con preservación de borradores. Las diferencias SHALL limitarse a las necesarias para sesión, perfil, rutas y seguridad de HomeSuite y al retiro acordado de autorización global. La administración de TasKing SHALL ejercerse desde la consola de HomeSuite (`/consola/tareas`) con el rol de plataforma `tareas` o la condición de dueño, y SHALL conservar su alcance exclusivo de Tareas, sin conceder administración de otras herramientas ni acceso a datos financieros. El tablero general SHALL NOT ofrecer controles para dar o quitar roles; SHALL mostrar a quien puede administrar Tareas un enlace a la consola y conservar para esas personas la vista de actividad del tablero.

#### Scenario: Continuar trabajando en un tablero trasladado
- **WHEN** alguien abre un tablero trasladado, mueve una tarjeta, edita su checklist, comenta y recarga
- **THEN** se conservan contenido, posiciones y relaciones, y las operaciones persisten con el comportamiento actual

#### Scenario: Sincronización entre dos personas
- **WHEN** una persona cambia o borra contenido mientras otra tiene el mismo tablero abierto con un borrador
- **THEN** la otra recibe la actualización mediante la revisión del tablero sin perder su borrador ni aplicar respuestas de otro contexto

#### Scenario: Intercambio de datos
- **WHEN** una persona exporta e importa con los formatos soportados por TasKing
- **THEN** mantiene la cobertura y semántica aditiva actuales, sin sustituir el traslado operativo íntegro por ese export de usuario

#### Scenario: Administración acotada
- **WHEN** alguien con rol `tareas` abre la administración de Tareas
- **THEN** la consola le muestra solo la pestaña Tareas, y las operaciones no incluyen información ni privilegios de otros productos

#### Scenario: Rol heredado de TasKing
- **WHEN** se publica la migración y una identidad de TasKing con marca de administrador tiene cuenta HomeSuite
- **THEN** esa cuenta tiene el rol `tareas`, y la marca heredada deja de dar permisos

#### Scenario: Sin controles de rol en el tablero
- **WHEN** alguien con rol `tareas` abre el tablero general
- **THEN** ve el enlace «Administración» a la consola y la actividad del tablero, pero ningún control para dar o quitar roles
