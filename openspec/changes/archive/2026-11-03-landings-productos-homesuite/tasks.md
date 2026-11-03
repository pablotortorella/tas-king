> **Cierre registrado el 2026-09-21:** change implementado, integrado mediante
> PR #52 y publicado en `homesuite.info`. Se conserva fuera de `archive` por
> decisión explícita de producto; no quedan tareas pendientes en este change.

## 1. Contrato

- [x] 1.1 Registrar rutas, navegación y disponibilidad en OpenSpec
- [x] 1.2 Validar el change con OpenSpec strict

## 2. Sitio público

- [x] 2.1 Enlazar las tres tarjetas de la portada a sus landings
- [x] 2.2 Crear `/tareas` con CTA a Fun TasKing en su URL actual
- [x] 2.3 Crear `/gastos` y `/compras` como páginas informativas en preparación
- [x] 2.4 Compartir estilos responsive, foco visible y modo oscuro sin JS

## 3. Verificación e integración

- [x] 3.1 Cubrir navegación, rutas, estados, CTA y cabeceras con tests
- [x] 3.2 Pasar pruebas aisladas, Wrangler dry-run y suite completa de TasKing
- [x] 3.3 Revisar diff y publicar PR sin desplegar a producción
- [x] 3.4 Revisión local y CI completadas; publicación aprobada y desplegada desde `main` SHA `45f5222` (Version ID `cc65ff3f-6747-41d3-98e0-c0b3742b81b9`). Las cuatro rutas se comprobaron en producción y el estado quedó registrado en `docs/STATUS.md`.
