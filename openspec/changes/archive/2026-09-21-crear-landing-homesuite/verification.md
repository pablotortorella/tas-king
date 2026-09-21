# Verificación local y de producción

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

## Publicación — 2026-09-21

- PRs #48, #49 y #50 integrados en ese orden. Antes del PR #49, la rama se
  actualizó con el `main` del refactor: 217 pruebas unitarias y 93 E2E pasaron
  sobre la rama y luego sobre el `main` integrado. El PR #50 pasó CI, además de
  las 4 unitarias y 3 E2E aisladas de la landing y Wrangler dry-run.
- Preview `homesuite-site.pablotortorella.workers.dev` revisado con respuesta
  200, contenido esperado, CSS y cabeceras de seguridad.
- Tras aprobación explícita, se retiraron los A de parking del apex y el CNAME
  `www`; `_domainconnect` y `_dmarc` permanecieron. Se desplegó el Worker desde
  `main` SHA `f8cb9b6`, Version ID `48847d8f-86de-4b18-b2ad-def62e348bba`.
- `homesuite.info` respondió 200 por HTTPS con la bienvenida y enlace a Fun
  TasKing; el CSS y el preview respondieron 200. `www` respondió 308 al apex
  preservando path y query. `1.1.1.1` devolvió `ad` para el A del apex. TasKing
  mantuvo respuesta 200. No hubo cambios a D1, OAuth ni al Worker de TasKing.
