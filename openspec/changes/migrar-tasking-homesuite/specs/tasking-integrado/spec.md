## Purpose

Incorporar la experiencia existente de TasKing al origen autenticado de HomeSuite, conservando sus funciones y los contratos compartidos de la suite.

## ADDED Requirements

### Requirement: TasKing dentro del origen de HomeSuite

La app SHALL servir TasKing en `/tareas` con assets y API propios del mismo origen, sin colisionar con rutas de plataforma u otros productos. SHALL ofrecer acceso al inicio de HomeSuite mediante la navegación existente, sin requerir un dock. El contrato de `GET /api/me` de plataforma SHALL mantenerse compatible. Cerrar sesión desde TasKing SHALL cerrar la sesión HomeSuite mediante su flujo protegido.

#### Scenario: Elegir Tareas en la suite
- **WHEN** una persona autenticada elige Fun TasKing en el inicio de HomeSuite después de habilitar la migración
- **THEN** abre sus tableros dentro de `/tareas` sin pasar a otro origen ni iniciar otra sesión

#### Scenario: Uso alternado de productos
- **WHEN** la persona vuelve al inicio y abre Cuentas Claras o su perfil
- **THEN** conserva la sesión y cada pantalla usa su propio contrato sin recibir el payload heredado de TasKing en `/api/me`

#### Scenario: Enlace compartido con login pendiente
- **WHEN** una persona sin sesión llega desde un enlace antiguo válido `?card=…` y completa el acceso HomeSuite
- **THEN** vuelve a `/tareas` con ese identificador y puede abrir la tarjeta si tiene permiso, sin perder el destino en OAuth ni revelar contenido antes del acceso

#### Scenario: Salida efectiva
- **WHEN** la persona usa Salir desde TasKing
- **THEN** se revoca la sesión HomeSuite y las siguientes solicitudes privadas a Tareas requieren autenticarse

### Requirement: Conservación de funciones y experiencia

La versión integrada SHALL conservar las funciones actuales de tableros, columnas configurables y múltiples cierres, tarjetas, asignaciones, fechas, comentarios, adjuntos, etiquetas, checklists, objetivos, métricas, actividad, búsqueda, filtros, archivo/restauración, importación aditiva JSON/CSV y exportación. SHALL conservar orden, arrastre, teclado, temas, preferencias propias, tip diario, celebraciones y sincronización con preservación de borradores. Las diferencias SHALL limitarse a las necesarias para sesión, perfil, rutas y seguridad de HomeSuite y al retiro acordado de autorización global. Los controles administrativos restantes SHALL conservar su alcance exclusivo de TasKing, sin conceder administración de HomeSuite ni acceso a datos financieros.

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
- **WHEN** alguien con rol administrativo heredado de TasKing consulta sus estadísticas o gestiona ese rol en la versión integrada
- **THEN** se aplican sus permisos de TasKing y las operaciones no incluyen información ni privilegios de otros productos

### Requirement: Perfil común y preferencias propias

TasKing integrado SHALL usar la fuente de perfil HomeSuite y su edición común, sin sobrescribirla automáticamente con nombre o avatar heredados. SHALL preservar las autorías y asignaciones históricas y una presentación de respaldo para personas aún sin cuenta HomeSuite. Las preferencias propias de TasKing SHALL permanecer separadas del perfil común. Las preferencias que sólo existían en almacenamiento del navegador del origen antiguo SHALL conservar sus valores predeterminados si no pueden trasladarse; esa limitación SHALL documentarse sin simular recuperación.

#### Scenario: Perfil de HomeSuite existente
- **WHEN** una persona con perfiles diferentes en ambas aplicaciones abre TasKing integrado
- **THEN** ve su perfil HomeSuite, conserva preferencias propias de Tareas y no modifica automáticamente ninguno de los datos de perfil heredados

#### Scenario: Autor todavía sin cuenta
- **WHEN** se muestra una tarjeta con autoría o asignación trasladada de una persona aún sin cuenta HomeSuite
- **THEN** se conserva la relación y una presentación de respaldo sin crear una cuenta Google ficticia

### Requirement: Seguridad compartida sin perder operaciones de Tareas

Todas las rutas privadas de TasKing SHALL comprobar la sesión de HomeSuite y el permiso del tablero, incluidas descargas fuera de la API. Las mutaciones SHALL validar origen y CSRF de la sesión; SHALL conservar límites funcionales de adjuntos e importaciones mediante límites específicos de ruta sin ampliar los de otros productos. El HTML y los assets servidos SHALL cumplir las cabeceras de HomeSuite sin relajar globalmente CSP. Las respuestas privadas y adjuntos SHALL impedir reutilizar contenido privado entre sesiones mediante cachés de la aplicación.

#### Scenario: Mutación sin protección
- **WHEN** una petición de creación, edición, importación, subida o administración omite CSRF, usa un token de otra sesión o viene de otro origen
- **THEN** se rechaza sin modificar datos ni archivos

#### Scenario: Adjunto con permiso vigente
- **WHEN** un integrante sube un archivo dentro de los límites actuales de TasKing, superiores al límite JSON general de HomeSuite
- **THEN** la ruta permite la operación protegida y la descarga posterior, sin ampliar el límite general de las otras rutas

#### Scenario: Descarga después de salir
- **WHEN** una persona sin sesión o con acceso revocado solicita directamente un adjunto por su URL
- **THEN** el servidor deniega el acceso y la app no lo recupera de una caché privada persistida

#### Scenario: Documento servido con CSP
- **WHEN** el navegador carga TasKing integrado con las cabeceras reales de HomeSuite
- **THEN** sus controles, temas, arrastre y estados visuales funcionan sin requerir scripts inline ni una relajación global de estilos

#### Scenario: Datos heredados con contenido ejecutable
- **WHEN** se muestran nombres, comentarios, etiquetas, actividad o metadatos importados con HTML o URLs peligrosas
- **THEN** se tratan como contenido no confiable y no ejecutan scripts, crean manejadores ni generan enlaces ejecutables en el origen HomeSuite

#### Scenario: Archivo con tipo o contenido peligroso
- **WHEN** se sirve un adjunto con extensión engañosa, tipo activo o metadatos no confiables
- **THEN** se entrega de forma segura con tipo controlado, `nosniff` y descarga o aislamiento apropiados, sin ejecutarse como documento activo con autoridad sobre HomeSuite

#### Scenario: Abuso de creación o subida
- **WHEN** una cuenta o sesión excede los límites operativos de mutaciones o tamaño y cantidad de archivos
- **THEN** la operación falla antes de persistir efectos indebidos, con error observable y reintentable según corresponda, sin degradar los límites de otros productos

### Requirement: Identidad visual y assets completos de TasKing

El traslado SHALL incluir el favicon SVG vigente de TasKing sin redibujarlo ni cambiar su paleta y el inventario de assets necesarios para el comportamiento y la identidad existentes. Las páginas de Tareas SHALL referenciar su favicon del origen HomeSuite; los recursos SHALL tener rutas, tipos y política de caché correctos y no depender del Worker antiguo. La PWA SHALL seguir siendo una única instalación HomeSuite con su manifiesto e iconos de suite; incorporar TasKing SHALL NOT crear una instalación o un service worker paralelo ni guardar respuestas privadas en precarga.

#### Scenario: Favicon trasladado
- **WHEN** se abre `/tareas` en un navegador y se pide su favicon declarado
- **THEN** se obtiene el mismo SVG de TasKing, con tipo de imagen correcto y sin depender de `/favicon.svg` en el host antiguo

#### Scenario: Dependencias completas
- **WHEN** se carga y usa Tareas después de retirar la aplicación del origen antiguo
- **THEN** su documento, módulos, estilos, fuentes e imágenes necesarias responden desde destinos inventariados y no intentan cargar el bundle antiguo

#### Scenario: App HomeSuite instalada y actualizada
- **WHEN** una instalación HomeSuite anterior al traslado se actualiza y abre Tareas, cierra sesión y vuelve sin red
- **THEN** conserva la identidad de instalación de la suite, muestra el favicon de TasKing al abrir su página y no ofrece una copia privada editable desde caché
