## Why

Las pruebas actuales (20 archivos unitarios y 23 specs E2E) corren solo en local y asumen el seed. Lo que se valida "a mano" en staging no está automatizado, y no hay una lista escrita de qué escenarios hay que cubrir: viven en la cabeza de Pablo y en los handoffs.

El 2026-10-23, al probar los PRs #65 y #66 en staging, el ambiente servía `main` y no las ramas, y nada lo detectó hasta comparar archivos publicados contra cada rama. Ese mismo día, el bug de `dvh` (tip tapado en el celular) pasó la prueba automatizada porque esta miraba la regla CSS y no el comportamiento; solo se vio en un Motorola real. Hace falta un criterio explícito de qué es "suficiente prueba" y pruebas que se comporten como una persona probando, ejecutables en local y en staging.

## What Changes

- Se define un **estándar de pruebas por escenarios**: cada cambio escribe sus escenarios en OpenSpec (`#### Scenario:` con id corto estable) y cada escenario tiene una prueba automatizada que lleva ese id en su título.
- Se define una **lista de 10 dimensiones** (camino feliz, variaciones, negativos y límites, persistencia, filtración de estado, permisos y roles, entrada y dispositivo, concurrencia, regresión, efectos colaterales). Todas se resuelven siempre en uno de tres estados: automatizado, no aplica (con razón) o residual manual (con razón y checklist).
- Se fijan **siete reglas de redacción** para que una prueba sea "como una manual" (ver `design.md`, decisión D8).
- Se crea una **suite nueva `e2e/escenarios/`**, con proyecto propio de Playwright, que corre contra local y contra staging con el mismo código. Las 23 specs existentes no se tocan; se migran a la suite nueva cuando un cambio las toca.
- Para entrar a staging, las pruebas **fabrican una cookie de sesión** de un usuario de pruebas dedicado, con tres salvaguardas (secreto local sin versionar, negativa a correr contra producción, usuario reconocible).
- Cada corrida **crea su propio tablero por API y lo borra al terminar**; los fixtures se preparan por API y la acción bajo prueba siempre se ejecuta por la interfaz.
- Se agrega un **script de trazabilidad** que verifica que cada escenario de las specs tenga prueba y que cada id citado en una prueba exista.
- **Piloto** con los cinco arreglos recientes (#65, #66, #67, #77, #78): se escriben sus escenarios, se automatizan y se corren en local y en staging. Una vez validado el criterio, se promueve a estándar del proyecto (CLAUDE.md y documentación de flujo).

Fuera de alcance de este cambio: migrar las 23 specs existentes, aplicar el criterio a toda la app (se hará después del piloto) y la verificación del SHA desplegado en staging (ítem aparte en `docs/PRODUCT_BACKLOG.md`, PR #83).

## Capabilities

### New Capabilities
- `pruebas-por-escenarios`: el estándar: dimensiones, estados, reglas de redacción, ids de escenario y trazabilidad entre specs y pruebas.
- `pruebas-en-staging`: cómo se ejecutan las pruebas contra local y staging: usuario de pruebas con cookie fabricada, salvaguardas, tablero por corrida y limpieza.
- `etiquetas-borrador`: asignar etiquetas a una tarjeta nueva antes de guardarla (PR #66). Describe comportamiento ya en producción.
- `checklists-teclado`: Tab, Enter y Backspace en ítems de checklist (PR #67). Describe comportamiento ya en producción.
- `objetivos-progreso`: el avance de un objetivo cuenta todas las columnas de cierre, en servidor y cliente (PR #77). Describe comportamiento ya en producción.
- `tarjetas-columnas`: una tarjeta siempre vive en una columna que existe en su tablero; el import manda las desconocidas a la primera columna (PR #78). Describe comportamiento ya en producción.

### Modified Capabilities
- `tip-diario`: agrega el requisito de que el tip se vea completo en pantallas móviles, sin quedar tapado por la barra de direcciones del navegador (PR #65).

## Impact

- **Código de pruebas:** `e2e/escenarios/` (nuevo), configuración de Playwright con proyecto y destino (`E2E_TARGET`), ayudantes de fixtures y de sesión, script de trazabilidad.
- **Backend de la app:** sin cambios en este cambio. La exposición del SHA en staging queda como ítem aparte.
- **Staging (operación):** rotar `SESSION_SECRET` de staging y guardarlo en un archivo local sin versionar; agregar el o los usuarios de pruebas a `allowed_emails` de la base de staging. La rotación cierra las sesiones actuales de staging.
- **Documentación:** `CLAUDE.md`, `docs/WORKFLOW.md` (checklist de PR y sección de tests), una guía nueva del estándar, y `openspec/specs/` con las specs del piloto.
- **Scripts:** comandos nuevos en `package.json` para correr la suite de escenarios en local y en staging.
- **Sin migraciones de base de datos ni cambios para quien usa la app.**
