# Verificación

## Automatizada

Ejecutada nuevamente el 2026-10-23 sobre `feature/homesuite-authenticated-spaces`:

- `npm run test:homesuite-app`: 16 pruebas;
- `npm run test:homesuite-app:integration`: 14 pruebas D1;
- `npm run test:e2e:homesuite-app`: 4 recorridos Playwright;
- `wrangler deploy --dry-run`: bundle y bindings válidos;
- escaneo del diff: ningún secreto OAuth o de sesión versionado.

El cuarto E2E usa una sesión y formulario autenticados reales. Reprodujo el 403
observado manualmente: con `Referrer-Policy: no-referrer`, Chrome declara
`Origin: null` y `Sec-Fetch-Site: same-origin`. La validación acepta ese origen
opaco sólo con Fetch Metadata de mismo origen y token firmado válido; orígenes
explícitos distintos continúan rechazados.

## Staging

- SHA desplegado: `4d9bfdc`, que contiene el fix `130fc74`;
- Version ID: `7098716d-2685-4371-a573-f890a7a5244e`;
- D1: sin migraciones pendientes;
- `/healthz`: 200 con `homesuite-app`;
- raíz: 200 por HTTPS con CSP, COOP, Permissions Policy, Referrer Policy,
  `nosniff`, `DENY` y `X-Request-Id`;
- `/auth/google`: 302 a Google con callback de staging, scopes básicos y PKCE
  S256.

## Verificación humana

Completada el 2026-10-23 con dos cuentas Google reales. Se comprobó crear el
espacio, invitar, denegar la URL directa antes de aceptar, mostrar únicamente
espacio y nombre del invitante, rechazar sin obtener acceso, volver a invitar,
aceptar y abrir el mismo espacio como integrante sin controles de titular. La
vista del titular mostró a la nueva persona.

D1 confirmó dos membresías (`owner` + `member`), una invitación `rejected`, otra
`accepted` y eventos auditados de creación, dos invitaciones, rechazo y
aceptación, sin consultar emails ni nombres personales.

Producción no fue creada ni modificada.
