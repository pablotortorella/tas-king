## Why

TasKing aparece en HomeSuite pero sigue siendo una aplicación separada, con otro acceso y datos propios. Incorporarlo a la app permite usar la cuenta de HomeSuite y recuperar los tableros existentes, conservando su funcionamiento y su colaboración por tablero.

## What Changes

- Servir TasKing en `/tareas` dentro de HomeSuite, con su sesión y perfil comunes, conservando la experiencia y funciones actuales salvo las adaptaciones necesarias para integrarlo.
- Migrar también el favicon original y los assets de identidad y funcionamiento, con un inventario verificable. Tareas conserva su favicon; la instalación PWA mantiene la identidad de HomeSuite.
- Mantener permisos `owner`/`member` por tablero, independientes de los grupos de Cuentas Claras. Conservar el tablero personal no eliminable y los accesos a tableros compartidos.
- Ofrecer un tablero personal a cualquier cuenta de HomeSuite que entre a TasKing. Recuperar los tableros previos usando la misma cuenta de Google, tanto para cuentas de HomeSuite existentes como para altas posteriores al traslado, sin duplicar el tablero personal.
- Migrar datos, relaciones, archivos adjuntos y configuración propia de TasKing mediante un traslado verificable y reanudable. La vinculación inicial usa el email verificado por Google que el sistema heredado conserva; después, la identidad estable de HomeSuite mantiene el vínculo.
- Mantener la app actual operativa durante la preparación. Hacer un corte final controlado con una sola autoridad de escritura; comprobar el destino antes de retirar el origen.
- **BREAKING**: el corte incluye obligatoriamente un Worker antiguo reducido a un aviso de mudanza firmado por **Pablitux**, con un botón para continuar en HomeSuite usando la cuenta Google habitual y encontrar allí sus tableros. Se muestra al llegar, sin redirección automática a HomeSuite, temporizador ni gestión personal de altas o avisos por parte de Pablo. Conserva entradas y enlaces útiles; las API antiguas dejan de operar y nunca redirigen escrituras. No queda una segunda versión utilizable ni se elimina el host dejando un 404. Se retiran el acceso independiente y la autorización global, su gestión y las solicitudes asociadas; la versión integrada nunca exige pertenecer a esa lista.
- Hacer criterios de aceptación del corte la ausencia de caminos antiguos de escritura —incluidos aliases, previews y redeploys accidentales—, el retorno tras login a enlaces compartidos, la protección de adjuntos y datos migrados frente al origen compartido y el tratamiento explícito de borradores y cachés antiguos.

Fuera de alcance: dock de navegación (pendiente separado en el backlog), rediseño, mejoras funcionales, grupos para Tareas, nuevas reglas de invitación, transferencia de tableros entre cuentas de Google y copia automática del perfil de TasKing sobre el de HomeSuite.

## Capabilities

### New Capabilities

- `acceso-tableros-tasking`: acceso con HomeSuite, vinculación de identidades heredadas, tablero personal único y permisos por tablero.
- `tasking-integrado`: recorrido bajo `/tareas`, favicon y assets, conservación funcional y adaptación a sesión, perfil, rutas y seguridad del origen compartido.
- `transicion-datos-tasking`: traslado íntegro D1/R2, convivencia, corte, matriz de compatibilidad del host antiguo, recuperación y retiro de autorización global.

### Modified Capabilities

- `proteccion-operativa-homesuite`: mantener el límite general de 16 KiB y declarar excepciones acotadas por ruta para importaciones y adjuntos, con límites efectivos y sin ampliar otros endpoints. Corrige la contradicción entre la spec universal y el import financiero ya exceptuado por el código.

Se conservan los contratos de identidad, perfil y grupos; se agrega Tareas sin convertir grupos en autorización de tableros.

## Impact

- `src/`, `public/`, `test/` y `e2e/`: fuente funcional existente, compatibilidad temporal del origen y regresiones.
- `apps/app/src/`, assets y pruebas: módulo TasKing, rutas con namespace propio, sesión, CSRF, perfil y cabeceras reales. `GET /api/me` de plataforma conserva su contrato.
- Migraciones nuevas de HomeSuite para tablas propias de Tareas, identidades pendientes de vincular y control de traslado; no se reescriben migraciones aplicadas ni tablas financieras.
- D1, R2, configuración y scripts operativos por ambiente: copia, conciliación y recuperación de archivos además de SQL. Sin dependencias nuevas obligatorias propuestas.
- Catálogo/enlaces de app y sitio, comprobación de coherencia, ficha TasKing, aclaración de ADR-018 y runbooks. Coordinar cambios activos de perfil, baja de cuenta y PWA al integrar; no incorporar sus funcionalidades pendientes.
- Scripts de publicación/rollback del origen y configuración de assets, previews, crons y bindings: impedir que vuelva a publicarse la aplicación independiente una vez consumado el corte. Inventariar configuración remota real antes de publicar; este plan no acredita ese inventario.

Esta propuesta autoriza planificación; no acredita implementación, aceptación ni despliegue.
