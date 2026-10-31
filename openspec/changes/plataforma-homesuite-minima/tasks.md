## 1. Fundaciones de HomeSuite App

- [x] 1.1 Crear `apps/app/` con Worker Hono, assets, configuración local y scripts de prueba propios, sin modificar TasKing ni `apps/site/`.
- [x] 1.2 Configurar cabeceras de seguridad, rutas de documento, API y manejo de errores para el nuevo origen.
- [x] 1.3 Crear migración D1 para usuarios, grupos, membresías, invitaciones y auditoría, con índices e invariantes necesarios.
- [x] 1.4 Agregar helpers de ID, normalización de email, transacciones y autorización por grupo.

## 2. Identidad y sesión

- [x] 2.1 Implementar Google OAuth Authorization Code con `state`, PKCE, validación completa de ID token y `sub` como identidad estable.
- [x] 2.2 Emitir, validar y cerrar sesión `__Host-homesuite_session` host-only; validar `returnTo` relativo.
- [x] 2.3 Cubrir rechazo de token inválido, issuer/audience/email no verificado, estado OAuth inválido y redirección externa.

## 3. Grupos y colaboración

- [x] 3.1 Implementar creación y renombre de grupo; crear propietario y grupo atómicamente.
- [x] 3.2 Implementar listado y selección sólo de grupos donde la persona es miembro.
- [x] 3.3 Implementar creación, listado y cancelación de invitaciones pendientes por email exacto; impedir duplicados pendientes.
- [x] 3.4 Implementar descubrimiento, vista privada, aceptación y rechazo de invitación en una transacción segura.
- [x] 3.5 Registrar auditoría de creación de grupo e invitaciones; aplicar autorización de titular/integrante en el servidor.

## 4. Experiencia mínima de Cuentas Claras

- [x] 4.1 Construir pantallas de login, creación de grupo, selector, integrantes e invitación, con estados vacíos y errores accesibles.
- [x] 4.2 Construir tarjeta de invitación que sólo revele grupo, titular y Cuentas Claras antes de aceptar.
- [x] 4.3 Crear `/cuentas-claras` como estado vacío honesto, sin simulación de saldos o importación.

## 5. Verificación y operación

- [x] 5.1 Tests unitarios de identidad, sesiones, D1, invariantes y autorización negativa entre grupos.
- [x] 5.2 E2E con identidades sintéticas: crear grupo, invitar, cancelar, aceptar/rechazar, aislamiento y privacidad previa a aceptar.
- [x] 5.3 Validar localmente el Worker, migraciones y suite completa de HomeSuite App.
- [x] 5.4 Crear recursos de staging aislados, asociar `staging.homesuite.info` y configurar cliente OAuth/secrets de staging fuera de Git.
- [x] 5.5 Verificar manualmente en staging con dos cuentas Google el recorrido completo, incluido el nombre de la persona invitante.
- [ ] 5.6 Tras aprobación explícita, crear/verificar recursos de producción, asociar `app.homesuite.info`, desplegar y actualizar estado operativo.

## 6. Documentación e integración

- [x] 6.1 Actualizar infraestructura, guía de desarrollo y estado con recursos realmente creados, sin secretos.
- [x] 6.2 Documentar el contrato de plataforma y las decisiones de sesión, identidad, privacidad y roles.
- [x] 6.3 Revisar diff, validar OpenSpec strict, ejecutar las pruebas aplicables y abrir PR.
