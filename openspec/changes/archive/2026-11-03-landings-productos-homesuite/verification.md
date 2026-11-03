# Verificación local

**Fecha:** 2026-09-21

- `openspec validate landings-productos-homesuite --strict`: válido.
- `npx vitest run --config apps/site/vitest.config.mjs`: 7/7 pruebas.
- `npx playwright test --config apps/site/playwright.config.mjs`: 13/13 E2E.
  Cubren rutas limpias, navegación, disponibilidad, CTA, cabeceras, 360 px y
  preferencia de modo oscuro.
- `npx wrangler deploy --dry-run --config apps/site/wrangler.jsonc`: exitoso;
  siete assets y sólo el binding `ASSETS`.
- `npm run test:all`: 217 unitarias y 93 E2E de TasKing, todas aprobadas.
- Revisión visual local en Chromium: las tres páginas en 1440 × 900 y 360 × 800,
  el catálogo actualizado y la página de Gastos en modo oscuro.

No se ha desplegado este cambio a producción ni se ha modificado el Worker de
TasKing. La revisión del PR y la aprobación de publicación siguen pendientes.
