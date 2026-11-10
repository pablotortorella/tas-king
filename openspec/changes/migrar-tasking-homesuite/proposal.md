## Why

TasKing aparece en HomeSuite pero sigue siendo una aplicación separada, con otro acceso y datos propios. Incorporarlo a la app permite usar la cuenta de HomeSuite y recuperar los tableros existentes, conservando su funcionamiento y su colaboración por tablero.

## What Changes

- Servir TasKing en `/tareas` dentro de HomeSuite, con su sesión y perfil comunes, conservando la experiencia y funciones actuales salvo las adaptaciones necesarias para integrarlo.
- Mantener permisos `owner`/`member` por tablero, independientes de los grupos de Cuentas Claras. Conservar el tablero personal no eliminable y los accesos a tableros compartidos.
- Ofrecer un tablero personal a cualquier cuenta de HomeSuite que entre a TasKing. Recuperar los tableros previos usando la misma cuenta de Google, tanto para cuentas de HomeSuite existentes como para altas posteriores al traslado, sin duplicar el tablero personal.
- Migrar datos, relaciones, archivos adjuntos y configuración propia de TasKing mediante un traslado verificable y reanudable. La vinculación inicial usa el email verificado por Google que el sistema heredado conserva; después, la identidad estable de HomeSuite mantiene el vínculo.
- Mantener la app actual operativa durante la preparación. Hacer un corte final controlado con una sola autoridad de escritura; comprobar el destino antes de retirar el origen.
- **BREAKING**: una vez completo el traslado, la URL antigua conduce a HomeSuite y se retiran el acceso independiente y la autorización global de TasKing, su gestión y las solicitudes asociadas. La versión integrada nunca exige pertenecer a esa lista.

Fuera de alcance: dock de navegación (pendiente separado en el backlog), rediseño, mejoras funcionales, grupos para Tareas, nuevas reglas de invitación, transferencia de tableros entre cuentas de Google y copia automática del perfil de TasKing sobre el de HomeSuite.

## Capabilities

### New Capabilities

- `acceso-tableros-tasking`: acceso con HomeSuite, vinculación de identidades heredadas, tablero personal único y permisos por tablero.
- `tasking-integrado`: recorrido de TasKing bajo `/tareas`, conservación funcional y adaptación a sesión, perfil, rutas y seguridad de HomeSuite.
- `transicion-datos-tasking`: traslado íntegro de D1/R2, convivencia, corte, recuperación y retiro de autorización global.

### Modified Capabilities

Ninguna. Se conservan los contratos de identidad, perfil y grupos de la plataforma; se agrega el dominio de Tareas sin convertir los grupos en su unidad de autorización.

## Impact

- `src/`, `public/`, `test/` y `e2e/`: fuente funcional existente, compatibilidad temporal del origen y regresiones.
- `apps/app/src/`, assets y pruebas: módulo TasKing, rutas con namespace propio, sesión, CSRF, perfil y cabeceras reales. `GET /api/me` de plataforma conserva su contrato.
- Migraciones nuevas de HomeSuite para tablas propias de Tareas, identidades pendientes de vincular y control de traslado; no se reescriben migraciones aplicadas ni tablas financieras.
- D1, R2, configuración y scripts operativos por ambiente: copia, conciliación y recuperación de archivos además de SQL. Sin dependencias nuevas obligatorias propuestas.
- Catálogo/enlaces de app y sitio, comprobación de coherencia, ficha TasKing, aclaración de ADR-018 y runbooks. Coordinar cambios activos de perfil, baja de cuenta y PWA al integrar; no incorporar sus funcionalidades pendientes.

Esta propuesta autoriza planificación; no acredita implementación, aceptación ni despliegue.
