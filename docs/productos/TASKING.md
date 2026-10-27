# TasKing: particularidades de producto

Hereda la [base común de HomeSuite](../homesuite/README.md). Esta ficha no redefine
método, seguridad, pruebas ni autorización de despliegue.

## Identidad y copy

Marco de marca en [Identidad y visión](../HOMESUITE_IDENTIDAD_Y_VISION.md) (§3, §5, §9.3).
FUN TasKing! conserva su personalidad lúdica y puede servir también para trabajo; el
tablero personal ya permite uso individual. Los textos sugeridos son borradores:
validar cada promesa contra lo implementado antes de publicarlos.

## Implementación y contratos propios

- Worker Hono en `src/`: composición en `index.js`, rutas, middleware y acceso D1.
- Frontend en `public/index.html`, `public/js/` y CSS; módulos ES sin bundler.
  [ADR-017](../ADRs/ADR-017-frontend-modular-y-cabeceras.md) fija las capas y las
  excepciones técnicas de carga: el arranque de tema es un script clásico para
  evitar parpadeo; no es una excepción a la política de scripts externos.
- Tableros con roles owner/member, tablero personal no eliminable y allowlist
  global heredada. Esa incorporación no se generaliza a HomeSuite: allí se usan
  espacios e invitaciones. [ADR-015](../ADRs/ADR-015-revocacion-acceso-sesion-cookie.md)
  conserva el detalle de revocación de TasKing.
- Columnas de cierre múltiples: objetivos, métricas, urgencia y celebración deben
  considerar todas. Validar pertenencia de columna al tablero en cada escritura.
- Importación aditiva: no reemplaza datos existentes. Revisar `public/js/io.js`,
  import del backend y cobertura JSON/CSV cuando cambia el modelo.
- Polling con revisión persistente y preservación de borradores; alcance y límites
  en [ADR-016](../ADRs/ADR-016-board-sync-revision.md). No implica resolución de conflictos.

## Interacción propia

[ADR-014](../ADRs/ADR-014-keyboard-ux-standards.md) define teclado de TasKing.
Encabezados de sección reutilizan `.field-label`: 12px, peso 600, `var(--muted)`,
mayúsculas y espaciado `.03em`; revisar el CSS vigente antes de agregar variantes.
Validar arrastre entre columnas y dentro de una columna, scroll/pan, modal con
borrador, textos largos, tema y movimiento reducido cuando el cambio los afecte.
No asumir cinco columnas fijas: son configurables.

## Comandos y evidencia

| Necesidad | Comando desde raíz |
|---|---|
| Diagnóstico | `npm run check:env` |
| Desarrollo | `npm run dev` |
| Unitarios/integración D1/R2 | `npm test` |
| Navegador | `npm run test:e2e` |
| Suite TasKing | `npm run test:all` |
| Migraciones locales | `npm run db:migrate:local` |
| Seed local | `npm run db:seed:local` |
| Reset del estado E2E descartable | `npm run e2e:reset` |

Playwright usa puerto 8787 y `.wrangler/e2e-state`; coordinar suites entre worktrees.
Fixtures en `test/fixtures/`, pruebas en `test/` y `e2e/`. Para instalar Chromium,
`npx playwright install chromium`. Migraciones reales y recursos emulados aislados.

## Presupuestos propios

| Flujo | Presupuesto estructural registrado |
|---|---|
| `ensureUser` existente | Una llamada D1 batch; excluye middleware y handler |
| Autenticación con cookie | Una verificación de firma y revocación vigente |
| GET versión con usuario/tablero existentes | Seis llamadas D1 totales |
| Tablero y revisión | Un batch, nueve sentencias, instantánea consistente |
| Tarjeta sin checklists | Sin consulta de ítems |
| Tarjeta con uno o varios checklists | Una consulta de ítems, sin N+1 |
| Mutación simple de tarjeta o etiqueta | Una escritura inmediata, sin tres recargas globales |

`test/backend-performance.test.js` y `e2e/card-mutation-performance.spec.js` son la
evidencia automatizada. Revisar expectativas vigentes al cambiar el contrato;
justificar un costo nuevo antes de modificar el presupuesto. Los triggers agregan
trabajo SQL interno aunque no agreguen llamadas al binding.
Mediciones históricas: [línea base](../PERFORMANCE-2026-09-11.md) y
[comprobación](../PERFORMANCE-2026-09-14.md); no son un SLA actual.

## Operación y deuda

Runbooks: [despliegue](../DEPLOYMENT.md) y [recuperación](../DISASTER_RECOVERY.md).
Estado y límites conocidos: [STATUS](../STATUS.md); pendientes: [backlog](../PRODUCT_BACKLOG.md).
Las novedades públicas viven en `public/releases.html`; al publicar cambios
visibles sincronizar versión de `package.json`, `package-lock.json` y pie de UI.

Identidad relacional por email y `style-src` permisivo son condiciones heredadas;
no son excepciones aprobadas para productos nuevos. Antes de migrarlas: analizar
compatibilidad, registrar decisión y probar transición sin interrumpir TasKing.
