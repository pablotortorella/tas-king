## 1. Fundaciones de HomeSuite App

- [ ] 1.1 Crear `apps/app/` con Worker Hono, assets, configuración local y scripts de prueba propios, sin modificar TasKing ni `apps/site/`.
- [ ] 1.2 Configurar cabeceras de seguridad, rutas de documento, API y manejo de errores para el nuevo origen.
- [ ] 1.3 Crear migración D1 para usuarios, espacios, membresías, invitaciones y auditoría, con índices e invariantes necesarios.
- [ ] 1.4 Agregar helpers de ID, normalización de email, transacciones y autorización por espacio.

## 2. Identidad y sesión

- [ ] 2.1 Implementar Google OAuth Authorization Code con `state`, PKCE, validación completa de ID token y `sub` como identidad estable.
- [ ] 2.2 Emitir, validar y cerrar sesión `__Host-homesuite_session` host-only; validar `returnTo` relativo.
- [ ] 2.3 Cubrir rechazo de token inválido, issuer/audience/email no verificado, estado OAuth inválido y redirección externa.

## 3. Espacios y colaboración

- [ ] 3.1 Implementar creación y renombre de espacio; crear propietario y espacio atómicamente.
- [ ] 3.2 Implementar listado y selección sólo de espacios donde la persona es miembro.
- [ ] 3.3 Implementar creación, listado y cancelación de invitaciones pendientes por email exacto; impedir duplicados pendientes.
- [ ] 3.4 Implementar descubrimiento, vista privada, aceptación y rechazo de invitación en una transacción segura.
- [ ] 3.5 Registrar auditoría de creación de espacio e invitaciones; aplicar autorización de titular/integrante en el servidor.

## 4. Experiencia mínima de Cuentas Claras

- [ ] 4.1 Construir pantallas de login, creación de espacio, selector, integrantes e invitación, con estados vacíos y errores accesibles.
- [ ] 4.2 Construir tarjeta de invitación que sólo revele espacio, titular y Cuentas Claras antes de aceptar.
- [ ] 4.3 Crear `/cuentas-claras` como estado vacío honesto, sin simulación de saldos o importación.

## 5. Verificación y operación

- [ ] 5.1 Tests unitarios de identidad, sesiones, D1, invariantes y autorización negativa entre espacios.
- [ ] 5.2 E2E con identidades sintéticas: crear espacio, invitar, cancelar, aceptar/rechazar, aislamiento y privacidad previa a aceptar.
- [ ] 5.3 Validar localmente el Worker, migraciones y suite completa de HomeSuite App.
- [ ] 5.4 Crear recursos de staging aislados, asociar `staging.homesuite.info` y configurar cliente OAuth/secrets de staging fuera de Git.
- [ ] 5.5 Verificar manualmente en staging con dos cuentas Google el recorrido completo, incluido el nombre de la persona invitante.
- [ ] 5.6 Tras aprobación explícita, crear/verificar recursos de producción, asociar `app.homesuite.info`, desplegar y actualizar estado operativo.

## 6. Documentación e integración

- [ ] 6.1 Actualizar infraestructura, guía de desarrollo y estado con recursos realmente creados, sin secretos.
- [ ] 6.2 Documentar el contrato de plataforma y las decisiones de sesión, identidad, privacidad y roles.
- [ ] 6.3 Revisar diff, validar OpenSpec strict, ejecutar las pruebas aplicables y abrir PR.
