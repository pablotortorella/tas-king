# Plataforma HomeSuite y sitio público

Hereda la [base común](../homesuite/README.md). Diseño objetivo en
[ADR-018](../ADRs/ADR-018-homesuite-suite-modular.md) y recursos concretos en
[infraestructura](../HOMESUITE_INFRASTRUCTURE.md). Implementación por rama/entorno
en [STATUS](../STATUS.md); no deducirla de los documentos de visión.

## Plataforma

`apps/app/` implementa la app autenticada; su modelo compartido es identidad,
sesiones, espacios, membresías, invitaciones y auditoría. Mantener invariantes de
creación atómica del espacio/titular y aceptación atómica de invitaciones.
Descubrir una invitación no concede acceso al contenido privado.

La raíz de la app es la entrada a la suite. Cada herramienta tiene su propia
ruta; Cuentas Claras muestra su estado en `/cuentas-claras` después de elegirla.
El sitio público de staging replica home y landings en otro Worker, y su landing
de Cuentas Claras conduce a la app de ese mismo entorno. Consultar STATUS para
dominios y versión activa.

Desde la raíz, comandos actualmente disponibles:

- `npm run dev:homesuite-app`
- `npm run test:homesuite-app`
- `npm run test:homesuite-app:integration`
- `npm run test:homesuite-site`
- `npm run db:migrate:homesuite-app:local`
- `npm run deploy:homesuite-app:staging`

Ver scripts en `package.json` y configuración en `apps/app/wrangler.jsonc` antes
de usarlos. El deploy de staging no ejecuta tests: correr las suites específicas
y los checks generales afectados primero. CI ejecuta las suites de app y sitio,
además de las generales y Playwright; el login real sigue requiriendo prueba
dirigida. No equiparar `test:all` con verificar toda la suite de productos.

La aceptación de identidad y colaboración requiere dos cuentas reales en staging:
crear espacio, invitar, descubrir sin filtrar contenido, aceptar/rechazar, comprobar
roles y aislamiento. Registrar el SHA y resultado de cada recorrido. Un login
exitoso no demuestra el resto. Separar identidades locales de sesiones reales.

## Sitio público

`apps/site/` sirve landings y assets, sin bindings de datos ni sesión de la app.
Configurar y publicar con su propio `wrangler.jsonc`; verificar apex, redirección
`www`, rutas, links y cabeceras. No publicar app para cambiar una landing ni enviar
cookies autenticadas al sitio. Cambios de DNS preservan registros ajenos al alcance.

## Límites

La política de recuperación y ciclo de vida de datos debe demostrarse antes de
operar con información irreemplazable. Estado actual y dependencias de integración
no se copian aquí: consultar STATUS y el change correspondiente. Esta ficha no
habilita publicar producción ni convierte condiciones pendientes en excepciones.

## Perfil compartido

Acuerdos de nombre, avatar y apodo por espacio en la
[exploración](../HOMESUITE_PERFIL_EXPLORACION.md); contratos y plan en el
[change de Perfil](../../openspec/changes/perfil-compartido-homesuite/proposal.md).
La [API común](../HOMESUITE_PROFILE_API.md) implementa datos y gestión en la
plataforma. La pantalla compartida `/perfil` se abre desde el avatar/nombre y
desde el menú general de la app. Cuentas Claras muestra el aviso «Muy pronto» al
entrar a su ruta tras el acceso con Google. La integración financiera y la
migración de TasKing quedan para cortes posteriores. Consultar STATUS para el SHA
y el estado de staging.
