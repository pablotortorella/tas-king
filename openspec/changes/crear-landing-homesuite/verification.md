# Verificación local

**Fecha:** 2026-09-17

## Línea base de TasKing

Antes de crear archivos de HomeSuite se ejecutó `npm run test:all` desde
`origin/main` en el worktree nuevo:

- Vitest: 172/172 pruebas pasaron en ambas ejecuciones.
- Primera ejecución E2E: el servidor local dejó de responder durante la suite;
  24 pruebas pasaron, 13 fallaron y 30 no corrieron.
- Segunda ejecución E2E: 57 pruebas pasaron, 3 fallaron y 7 no corrieron. Las
  fallas mostraron el tablero sin columnas antes de cualquier cambio de
  HomeSuite.

Pablo autorizó continuar con la superficie aislada mientras el refactor grande
de TasKing sigue en otro worktree. No se modificó código ni configuración de
TasKing y esta inestabilidad no se atribuye a la landing.

## Verificación de `apps/site`

- `openspec validate crear-landing-homesuite --strict`: válido.
- `npx vitest run --config apps/site/vitest.config.mjs`: 4/4 pruebas pasaron.
- `npx playwright test --config apps/site/playwright.config.mjs`: 3/3 pruebas pasaron.
- `npx wrangler deploy --dry-run --config apps/site/wrangler.jsonc`: exitoso;
  cuatro assets y un único binding `ASSETS`.
- Revisión visual en Chromium: desktop claro a 1440 px y móvil oscuro a 390 px.
- Se corrigió durante la revisión el contraste del texto descriptivo de la
  tarjeta activa.

## Pendiente

- Desplegar el preview `workers.dev` requiere autorización.
- Asociar `homesuite.info` y `www.homesuite.info` requiere revisión del preview y
  aprobación explícita.
- Antes de integrar, actualizar la rama contra el `main` que resulte del refactor
  y repetir las pruebas correspondientes.
