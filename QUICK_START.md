# 🚀 QUICK START — FUN TasKing!

**Lee esto al empezar cada sesión (5 min).**

---

## ✅ Checklist: Setup (2 min)

```bash
git fetch origin --prune
npm install
npm run check:env             # Diagnóstico rápido del ambiente
npm run test:all              # Debe pasar 100% — si falla, STOP
```

---

## 📍 Dónde estamos (Estado actual)

**Última actualización**: 2026-09-19
**Última versión desplegada registrada**: 2.3.0. El frontend modular, las cabeceras de seguridad y la sincronización ampliada ya están en producción; ver `docs/STATUS.md`.

### ✅ Contexto reciente de TasKing
- **v2.3.0 en producción** (2026-09-18): frontend modular, cabeceras de seguridad y sincronización ampliada; ver `docs/STATUS.md`.
- **Tip diario** (v2.2.0, desplegado): una franja sobre el pie muestra un tip por día, guarda el avance por cuenta y realiza el realce diario tras la primera interacción.
- **Mejora de guardado** (incluida en v2.2.0): crear/editar tarjetas y cambiar etiquetas evita las tres recargas globales, que en la línea base agregaban aproximadamente 1,4–1,5 s por acción. Se mantienen protecciones ante polling y cambios concurrentes. Comprobación posterior de tres rondas en `docs/PERFORMANCE-2026-09-14.md`; acción a pantalla aún pendiente.
- **Nuevo flujo Git para trabajo paralelo**: `main` queda como integración/producción; cada tarea usa rama propia y, si hay más de un agente, worktree propio. Ver la sección siguiente y `CLAUDE.md`.

### ⏭️ Próximo
1. **HomeSuite ya tiene sitio público**: `https://homesuite.info/` sirve la landing desde el Worker independiente `homesuite-site`; `www` redirige al apex. La migración de identidad, sesiones y TasKing a `app.homesuite.info` sigue pendiente. Ver `docs/HOMESUITE_INFRASTRUCTURE.md`.
2. **Seguimiento de v2.3.0**: los flakes y hallazgos no bloqueantes figuran en `docs/STATUS.md`; investigarlos si se reproducen, sin volver a tratar la migración 0015 como pendiente.
3. Mantener los presupuestos y criterios de `docs/PERFORMANCE-PRACTICES.md` en los cambios siguientes.

Otros pendientes vigentes: ver `docs/PRODUCT_BACKLOG.md` (fuente de verdad del backlog).

---

## 🎯 Reglas no negociables

- **Tests primero**: Si escribís código, escribís tests (unitarios + E2E según corresponda)
- **Commits pequeños**: 1 commit = 1 cambio lógico (no gigantes)
- **Commits claros**: Mensaje describe QUÉ cambió, no por qué
- **Estructura modular**: Código backend en `src/` — cada archivo ~100-150 líneas máximo
- **Documentar decisiones**: Si es arquitectónico, va en `docs/ADRs.md`
- **Rama por tarea**: no trabajar ni commitear directamente en `main`
- **Worktree por agente cuando hay paralelismo**: no editar la misma carpeta desde dos agentes

**Detalles completos**: [Ver CLAUDE.md](CLAUDE.md)

---

## 🌿 Trabajo en paralelo: ramas y worktrees

El checkout principal se reserva para `main` limpio. Cada tarea se inicia desde `origin/main` en su propia rama; si hay dos agentes activos, también en su propia carpeta.

```bash
# Desde el checkout principal, sin cambios locales.
git fetch origin --prune
git worktree add ../tas-king-<tema> -b <tipo>/<tema> origin/main
cd ../tas-king-<tema>

# Ejemplo:
# git worktree add ../tas-king-perf -b perf/card-mutations origin/main
```

Antes de integrar: `git fetch origin --prune`, `git rebase origin/main`, `npm run test:all` y revisar el diff. Agregar archivos por ruta, nunca con `git add .`. El detalle y el protocolo de staging están en [CLAUDE.md](CLAUDE.md) y [docs/WORKFLOW.md](docs/WORKFLOW.md).

---

## 📐 OpenSpec (Spec-Driven Development)

Incorporado el 2026-09-09 para planificar funcionalidades antes de escribir código. CLI: `@fission-ai/openspec` (instalado global).

**El ciclo**, en orden. El primer paso no es opcional:

```
/opsx:explore  -->  /opsx:propose  -->  /opsx:apply  -->  /opsx:archive
   conversar         4 artefactos       implementar      mergear specs
   y decidir         (planeamiento)     tasks.md         a openspec/specs/
```

- **`explore` primero, siempre.** Es una conversación, no un formulario: una decisión por vez, con el código a la vista. Saltearlo y pedir `propose` directo produce artefactos que suenan bien pero deciden por vos.
- **Ir despacio.** El valor está en las decisiones, no en la velocidad de generar archivos.

**Dónde vive cada cosa:**

| Carpeta | Qué contiene |
|---|---|
| `openspec/specs/` | Specs vigentes. Permanentes. Fuente de verdad de qué hace el sistema. |
| `openspec/changes/` | Trabajo **en vuelo**. Solo lo que se está por hacer. |
| `openspec/changes/archive/` | Changes ya implementados, con fecha. |
| `docs/PRODUCT_BACKLOG.md` | Ideas futuras. **No** van en `changes/` — llenarlo de ideas mata la señal de "qué hay en vuelo". |

**Brownfield**: no hay que documentar retroactivamente lo ya construido. Las specs son *deltas* (ADDED/MODIFIED/REMOVED) y nacen recién cuando se toca esa parte. El código sin spec queda como está.

**Ojo**: `.claude/` está en `.gitignore`, así que los comandos `/opsx:*` y sus skills **no se versionan** — viven solo en la máquina donde se corrió el init. En una máquina nueva: `openspec init --tools claude --language es`. Lo que sí se versiona es `openspec/`, que es lo que importa.

```bash
openspec list                    # changes activos
openspec status --change <name>  # progreso de artefactos
openspec validate <name> --strict
```

---

## 💻 Dónde editar (cheat sheet)

| Necesito | Dónde | Ejemplo |
|---|---|---|
| **Nuevo endpoint** | `src/routes/` | Crear `routes/labels.js` |
| **Función DB** | `src/db/queries.js` o `helpers.js` | Helper para cargar labels |
| **Constante global** | `src/constants.js` | `MAX_LABELS_PER_BOARD` |
| **Middleware/auth** | `src/middleware/auth.js` | Validar permisos |
| **Test unitario** | `test/` | `test/labels.spec.js` |
| **Test E2E** | `e2e/` | `e2e/labels.spec.js` |

**Detalles completos**: [Ver docs/WORKFLOW.md](docs/WORKFLOW.md) sección "Estructura modular del backend"

---

## 🧪 Comandos útiles

```bash
# Desarrollo diario
npm run dev                   # Servidor local (http://localhost:8787)
npm run test:watch            # Tests en tiempo real (re-ejecuta al guardar)
npm run test:all              # Suite completa (unitarios + E2E)

# Deploy
npm run deploy:staging        # Deploy a staging (revisar antes de prod)
npm run deploy                # Deploy a producción (después de revisar staging)

# Ambiente y datos
npm run check:env             # Diagnóstico del ambiente (usar al inicio o ante problemas)
npm run db:reset:local        # Borrar DB local y re-aplicar migraciones ⚠️ destructivo
npm run db:seed:local         # Cargar datos de ejemplo en DB local (idempotente)
npm run e2e:reset             # Limpiar estado E2E (cuando tests E2E fallan por estado)
npm run e2e:server            # Servidor E2E solo (para debugging interactivo de tests)
npm run setup:local           # Setup completo desde cero (primera vez o nueva máquina)

# Para humanos
npm run operator              # Menú interactivo con todas las operaciones + ayuda contextual
```

**Flujo recomendado**: rama/worktree → local (dev + tests) → staging de la rama → integrar a `main` → staging de `main` → producción

---

## 📚 Consultas específicas

| Pregunta | Archivo | Sección |
|---|---|---|
| ¿Qué features existen? | `docs/STATUS.md` | Features Implementados/NO Implementados |
| ¿Por qué se decidió así? | `docs/ADRs.md` | Decisiones arquitectónicas |
| ¿Hacia dónde evoluciona la suite? | `docs/HOMESUITE_VISION.md` | Visión, plataforma y secuencia |
| ¿Cómo se organizan dominio, Workers y repo? | `docs/HOMESUITE_INFRASTRUCTURE.md` | DNS, ambientes y migración |
| ¿Qué incluye el reemplazo de Splitwise? | `docs/HOMESUITE_GASTOS_MVP.md` | Alcance, reglas e invariantes |
| ¿Qué ya se decidió para explorar Gastos? | `docs/HOMESUITE_GASTOS_EXPLORACION.md` | Tricount, saldo neto, ejemplos y preguntas abiertas |
| ¿Cuál es el flujo de trabajo? | `docs/WORKFLOW.md` | Todo el documento |
| ¿Qué pasó en la última sesión? | `AI_HANDOFF.md` | Sección "Último handoff" |
| ¿Reglas y estándares? | `CLAUDE.md` | Todo el documento |

---

## 🏗️ Stack (para referencia)

- **Runtime**: Cloudflare Workers (Wrangler)
- **Backend**: Hono (~80 líneas, modular)
- **Frontend**: HTML/CSS/JS vanilla (1900 líneas, sin build)
- **DB**: Cloudflare D1 (SQLite) — migraciones en `migrations/`
- **Storage**: Cloudflare R2 (`tas-king-uploads`)
- **Auth**: OAuth 2.0 Google (directo en Worker, JWT validation)
- **Tests**: Vitest (unitarios) + Playwright (E2E)

---

## 🚨 Antes de hacer push

```bash
# 1. Correr tests
npm run test:all

# 2. Ver cambios
git diff
git log --oneline main..HEAD

# 3. Verificar commits
git status

# 4. Push de tu rama
git push -u origin <tipo>/<tema>
```

---

**¿Necesitas más contexto?** Lee los archivos específicos arriba.  
**¿Obstaculizado?** Ver [CLAUDE.md](CLAUDE.md) sección "Ayuda".
