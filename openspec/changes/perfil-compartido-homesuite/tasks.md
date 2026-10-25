## 1. Preparar integración y migración

- [ ] 1.1 Confirmar base funcional vigente, SHA y rutas consumidoras; revisar diferencias contra `973ce4a` y dependencias CSRF.
- [ ] 1.2 Revisar límites propuestos, catálogo de colores, validación emoji y hosts de imagen con evidencia; registrar ajustes técnicos.
- [ ] 1.3 Crear migración aditiva con restricciones, perfil por usuario, revisión y generación de presentación por membresía.
- [ ] 1.4 Probar backfill con datos, alta durante ventana de despliegue, nueva membresía, reingreso y preservación de tablas financieras.

## 2. Dominio de perfil compartido

- [ ] 2.1 Implementar normalización/validación de nombre, emoji, color, URL y patches; agregar pruebas de límites y campos desconocidos.
- [ ] 2.2 Implementar resolución pura de nombre/avatar, alternativas y contrato de presentación separado de gestión.
- [ ] 2.3 Implementar lectura/edición propias con revisión y auditoría atómicas; probar conflicto y rollback.
- [ ] 2.4 Mantener proyección legacy del nombre y materialización idempotente para usuarios previos/locales.

## 3. OAuth y apodo contextual

- [ ] 3.1 Conservar `picture` validado e integrar actualización Google sin pisar preferencias; cubrir ausencia y cambio de datos.
- [ ] 3.2 Implementar apodo propio por membresía, lectura autorizada, revisión y generación; cubrir vaciado y edición ajena por titular.
- [ ] 3.3 Probar login concurrente con personalización y petición vieja tras reingreso; evitar auditoría falsa.

## 4. Contratos y consumidores

- [ ] 4.1 Agregar rutas propias de perfil/presentación con sesión, JSON acotado, CSRF, errores y no-store; pruebas HTTP negativas.
- [ ] 4.2 Adaptar `GET /api/me`, sesión e integrantes al resolver común sin cambiar contratos existentes.
- [ ] 4.3 Integrar presentaciones colectivas en actividad de Cuentas Claras, incluida autoría pasada sin membresía vigente; impedir N+1.
- [ ] 4.4 Mantener participantes contables, revisiones, snapshots y exportaciones financieras intactos; probar presentación vinculada por separado.

## 5. Verificación y documentación

- [ ] 5.1 Ejecutar suites específicas de HomeSuite y regresiones de productos afectados; registrar comandos, SHA y límites.
- [ ] 5.2 Ensayar migración desde esquema anterior con datos y rollback de código, incluida reconciliación de proyección.
- [ ] 5.3 Cuando haya implementación, verificar login real en staging, dato de foto y aislamiento con dos cuentas; sin UI nueva.
- [ ] 5.4 Actualizar API, ficha de plataforma, ADR y STATUS; mantener documentación de producto como referencia a la capacidad común.
- [ ] 5.5 Validar OpenSpec y verificar criterios antes de archivar; no archivar ni declarar implementado por validar estos documentos.
