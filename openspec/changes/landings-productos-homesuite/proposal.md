## Why

La portada de HomeSuite ya reúne las tres herramientas, pero sólo TasKing tiene
un destino. La visión del producto prevé `/tareas`, `/gastos` y `/compras` como
presentaciones públicas separadas. Crear esas rutas ahora deja lista una
arquitectura pequeña y navegable sin adelantar identidad ni funcionalidades.

## What Changes

- La portada enlaza a tres páginas informativas bajo el mismo Worker público.
- `/tareas` presenta Fun TasKing! y enlaza a su URL productiva actual.
- `/gastos` y `/compras` explican cada idea y muestran inequívocamente que aún
  están en preparación, sin formularios ni acciones de aplicación.
- Las páginas comparten CSS, navegación de regreso a la suite y la política de
  seguridad existente; no agregan JavaScript, cookies ni servicios de terceros.
- Se amplían las pruebas E2E y el contrato OpenSpec para las nuevas rutas.

### Non-goals

- Implementar Gastos, Compras, sesiones, invitaciones o listas de espera.
- Mover TasKing a `app.homesuite.info` o cambiar su URL actual.
- Definir nombres o identidad visual definitivos para los productos futuros.
- Crear otro Worker, base de datos, subdominio o mecanismo de autenticación.
- Desplegar a producción sin revisión y aprobación explícita.

## Capabilities

### Modified Capabilities

- `landing-publica-homesuite`: el catálogo ahora navega a páginas públicas de
  producto y conserva la distinción entre herramienta disponible y futuras.

## Impact

Sólo cambia `apps/site/public/`, sus pruebas y este change OpenSpec. El Worker,
los Custom Domains y el producto TasKing permanecen independientes.
