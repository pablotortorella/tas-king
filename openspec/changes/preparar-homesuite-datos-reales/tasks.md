## 1. Núcleo financiero

- [x] 1.1 Crear migración D1 para libros, participantes, movimientos, componentes, revisiones, eventos e idempotencia con aislamiento por libro.
- [x] 1.2 Implementar catálogo monetario, normalización de importes y reparto igual determinista para exponentes 0, 2 y 3.
- [x] 1.3 Implementar validación pura de drafts de gasto, ingreso y transferencia, incluida suma cero y rechazo entre libros.
- [x] 1.4 Agregar pruebas unitarias e integración D1 para constraints, invariantes, revisión e idempotencia.

## 2. Protección operativa

- [x] 2.1 Rechazar payloads mutables mayores a 16 KiB antes del handler y cubrir respuesta 413.
- [x] 2.2 Configurar bindings separados de rate limiting para OAuth y mutaciones, con 429, `Retry-After`, request ID y pruebas inyectables.
- [x] 2.3 Añadir expiración a invitaciones nuevas y compatibilidad para pendientes existentes.

## 3. Mantenimiento programado

- [x] 3.1 Implementar cron que purga sesiones antiguas y vence invitaciones pendientes con auditoría, sin tocar historia financiera.
- [x] 3.2 Configurar el trigger sólo para HomeSuite staging y probar mantenimiento con D1 local.

## 4. Recuperación

- [x] 4.1 Crear script de bookmark y export SQL por ambiente, con artefactos ignorados y fallo cerrado.
- [x] 4.2 Crear restore drill sobre D1 local aislada con comprobaciones de integridad y conteos.
- [x] 4.3 Ejecutar export y restore drill de staging antes de aplicar la migración nueva.
- [x] 4.4 Hacer que el deploy de staging respalde antes de migrar y documentar rollback con Time Travel.

## 5. Política, verificación y staging

- [x] 5.1 Documentar clases de datos, retención, exportación, eliminación y bloqueos previos a producción.
- [x] 5.2 Ejecutar suites de HomeSuite, E2E, OpenSpec strict, dry-run y escaneo de secretos.
- [ ] 5.3 Desplegar a staging sin crear datos financieros, verificar límites, cron, observabilidad y esquema.
- [ ] 5.4 Actualizar estado e infraestructura con SHA, Version ID, backup y resultado del restore drill; abrir PR apilado.
