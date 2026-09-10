# 🚀 QUICK START — FUN TasKing!

**Lee esto al empezar cada sesión (5 min).**

---

## ✅ Checklist: Setup (2 min)

```bash
git pull origin main
npm install
npm run check:env             # Diagnóstico rápido del ambiente
npm run test:all              # Debe pasar 100% — si falla, STOP
```

---

## 📍 Dónde estamos (Estado actual)

**Última actualización**: 2026-09-09  
**Versión**: 2.1.4 en producción — `main` = staging = producción ✅

### ✅ Completado en la última sesión (2026-09-08/09)
- **Favicon** (v2.1.4, deployado): corona en SVG a medida (`public/favicon.svg`) en las 5 páginas públicas. Se compararon 5 variantes de contraste; ganó la de placa de fondo lavanda por legibilidad en tema claro y oscuro a 16px.
- **Cambio de workflow**: commit + push directo a `main` es ahora el default. Rama + PR quedó como excepción para migraciones de DB y cambios grandes/multi-archivo. Ver CLAUDE.md → "Rama vs. commit directo a main".
- **Limpieza de ramas**: se borraron 4 ramas obsoletas que `git branch --no-merged` marcaba como pendientes pero ya estaban incorporadas a `main` vía squash-merge. No quedan ramas con trabajo sin mergear.
- **OpenSpec incorporado** (spec-driven development) — ver sección propia más abajo.

### 🔄 En vuelo
- **`tip-diario`** — change de OpenSpec, artefactos completos y validados, **sin implementar**. Planeamiento puro; no se tocó código de producto.
  - El catálogo de textos está en `openspec/changes/tip-diario/tips.md` (59 candidatos + 7 hermanas). Lo trabajó Pablo con Codex.
  - Sesión 2026-09-10: se verificó que **todas** las referencias de UI que citan los tips existen y están bien nombradas, y se cerraron cuatro decisiones — tres tramos (Kanban+app → Kanban puro → otros métodos), el plural se conserva en prácticas de coordinación (la versión singular se suma como tip adicional), dos líneas en mobile sin truncado con techo de ~110 caracteres, y la franja va **encima del footer**, no bajo el header.

### ⏭️ Próximo — retomar `tip-diario`
1. **Curar los textos con Pablo, tip por tip** (tarea 1.1). Es la parte larga y la decide él; se comenta por ID: «K3 queda», «G5 cambiar», «P2 afuera».
2. **Cerrar la única decisión abierta**: si la franja muestra una categoría visible (tarea 3.0). Bloquea la UI, no la curación. Recomendación registrada: sin categoría en v1.
3. Recién después, **implementar** con `/opsx:apply`.

Otros pendientes vigentes: ver `docs/PRODUCT_BACKLOG.md` (fuente de verdad del backlog).

---

## 🎯 Reglas no negociables

- **Tests primero**: Si escribís código, escribís tests (unitarios + E2E según corresponda)
- **Commits pequeños**: 1 commit = 1 cambio lógico (no gigantes)
- **Commits claros**: Mensaje describe QUÉ cambió, no por qué
- **Estructura modular**: Código backend en `src/` — cada archivo ~100-150 líneas máximo
- **Documentar decisiones**: Si es arquitectónico, va en `docs/ADRs.md`

**Detalles completos**: [Ver CLAUDE.md](CLAUDE.md)

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

**Flujo recomendado**: Local (dev + tests) → Staging (URL real) → Producción

---

## 📚 Consultas específicas

| Pregunta | Archivo | Sección |
|---|---|---|
| ¿Qué features existen? | `docs/STATUS.md` | Features Implementados/NO Implementados |
| ¿Por qué se decidió así? | `docs/ADRs.md` | Decisiones arquitectónicas |
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

# 4. Push
git push origin feature/mi-feature
```

---

**¿Necesitas más contexto?** Lee los archivos específicos arriba.  
**¿Obstaculizado?** Ver [CLAUDE.md](CLAUDE.md) sección "Ayuda".
