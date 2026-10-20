# Verificación

## Automatizada

Ejecutada el 2026-10-20 sobre `feature/homesuite-authenticated-spaces`:

- `npm run test:homesuite-app`: 15 pruebas;
- `npm run test:homesuite-app:integration`: 14 pruebas D1;
- `npm run test:e2e:homesuite-app`: 3 recorridos Playwright;
- `wrangler deploy --dry-run`: bundle y bindings válidos;
- escaneo del diff: ningún secreto OAuth o de sesión versionado.

## Staging

- SHA desplegado: `30ed752`;
- Version ID: `cf49271c-7cd3-4ae3-a9b9-ad38b45bf3b2`;
- D1: sin migraciones pendientes;
- `/healthz`: 200 con `homesuite-app`;
- raíz: 200 por HTTPS con CSP, COOP, Permissions Policy, Referrer Policy,
  `nosniff`, `DENY` y `X-Request-Id`;
- `/auth/google`: 302 a Google con callback de staging, scopes básicos y PKCE
  S256.

## Pendiente humano

El login real con una cuenta ya fue comprobado el 2026-10-16. Sigue pendiente
repetir en staging el recorrido completo con dos cuentas Google reales: crear,
invitar, comprobar privacidad y nombre del invitante, rechazar, volver a invitar,
aceptar y abrir el mismo espacio.

Producción no fue creada ni modificada.
