# Instrucciones para Claude — FUN TasKing!

**Lee esto + QUICK_START.md al empezar cada sesión (~5 min total).**

---

## 🎯 Objetivo del proyecto

**FUN TasKing!** es un tablero Kanban minimalista, multiusuario, de código abierto.

Objetivo: **Funcional** + **Hermoso** + **Veloz** + **Seguro** + **Sostenible**
(Con código limpio, tests, documentación, decisiones registradas)

---

## 📖 Al iniciar CADA sesión

**Checklist rápido** (2 min):

```bash
git fetch origin --prune
npm install
npm run check:env             # Diagnóstico rápido del ambiente
npm run test:all              # Debe pasar 100% — si falla, STOP
```

Luego lee:
1. **QUICK_START.md** (dónde estamos, qué hacer hoy)
2. **Memory automática** (context persiste entre sesiones)

Consultas específicas: [ver QUICK_START.md](QUICK_START.md) sección "📚 Consultas específicas"

---

## 💻 Reglas no negociables mientras codeas

### Tests primero
- **Cambio API** → test unitario (Vitest)
- **Cambio UI** → test E2E (Playwright)
- **Cambio auth** → test unitario + E2E
- **Cambio cosmético** → podría saltarse

Si escribís código, escribís tests.

### Performance como criterio de calidad

Aplicar [docs/PERFORMANCE-PRACTICES.md](docs/PERFORMANCE-PRACTICES.md) al diseñar y revisar cambios. Eliminar validaciones duplicadas, consultas N+1 y recargas innecesarias con regresiones automáticas; medir por etapas cuando la causa siga siendo incierta. Toda excepción a los presupuestos de llamadas debe justificarse.

### Commits claros y pequeños
- **Mensaje**: describe QUÉ cambió, no por qué
  - ✅ "Agregar validación de email en signup"
  - ❌ "Fixed stuff", "WIP", "asdfgh"
- **Tamaño**: 1 commit = 1 cambio lógico
  - ✅ `git add src/labels.js test/labels.spec.js`
  - ❌ `git add .` (todo junto)

### Ramas y trabajo paralelo

**`main` es la rama de integración y producción. No se desarrolla ni se hacen commits directos en `main`.** Cada cambio, incluso documentación, vive en una rama propia y llega a `main` mediante una integración revisable.

Cuando hay más de un trabajo o agente activo, cada uno usa además su propio **worktree**. Dos agentes nunca editan la misma carpeta de trabajo: Git comparte los archivos sin commit de un checkout, aunque cada persona crea estar en una rama distinta.

```bash
# Desde el checkout principal, que se reserva para main limpio.
git fetch origin --prune
git worktree add ../tas-king-<tema> -b <tipo>/<tema> origin/main
cd ../tas-king-<tema>

# Ejemplos de nombres: feature/tip-diario, perf/card-mutations,
# fix/drag-duplicate, docs/workflow.
```

- Una rama y un worktree por unidad de trabajo; no mezclar fixes, features y documentación ajena en el mismo commit.
- Antes de empezar, comunicar rama, carpeta y archivos o zonas que se prevé tocar. Si dos tareas tocan el mismo archivo, se turnan o una integra primero.
- Agregar archivos por nombre (`git add ruta/a ruta/b`), revisar `git diff --cached` y no usar `git add .`.
- Cada agente mantiene su rama actualizada con `git fetch origin --prune` y `git rebase origin/main` antes de integrarla. Si el rebase altera el cambio probado, se vuelve a correr la validación necesaria.
- El checkout principal se mantiene en `main`, limpio y sin experimentos. `git pull` solo se ejecuta ahí como `git pull --ff-only origin main`, después de confirmar que no hay cambios locales.

### Planificar antes de codear (OpenSpec)
Para una **funcionalidad nueva**, el flujo es `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`.

**`explore` va primero y no se saltea**: es una conversación para tomar decisiones de a una, con el código a la vista. Ir directo a `propose` genera artefactos que deciden por Pablo en vez de con Pablo. Ir despacio acá es la intención, no una demora.

Detalles y estructura de carpetas: [QUICK_START.md § OpenSpec](QUICK_START.md).

### Pruebas locales
```bash
npm run dev                 # Ver cambios en tiempo real
npm run test:watch          # Tests re-ejecutan al guardar
npm run test:all            # Suite completa antes de push
npm run deploy:staging      # Probar el commit actual en staging (URL real)
```

### Flujo de despliegue (Opción C: Hybrid)
1. **Local** (`npm run dev`): desarrollo + tests unitarios + E2E
2. **Staging** (`npm run deploy:staging`): revisar en URL real, datos separados de producción
3. **Producción** (`npm run deploy`): solo después de revisar staging

Esto evita romper producción. Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para guía detallada.

---

## 🏗️ Estándar: Estructura modular del backend

**OBLIGATORIO**: Backend (`src/`) está modularizado, NO monolítico.

```
src/
├── index.js              (solo setup + middleware + rutas)
├── constants.js          (constantes globales)
├── middleware/           (cors, logging, rateLimit, auth)
├── routes/               (auth, users, boards, cards, uploads, admin)
└── db/                   (queries, helpers)
```

**Regla**: Cada archivo ~100-150 líneas. Si crece, extrae a nuevo archivo.

**Cuándo crear archivo**:
- **Nuevo endpoint** → `routes/recurso.js` (o agregar a existente)
- **Función helper** → `db/helpers.js` o `db/queries.js`
- **Nuevo middleware** → `middleware/nombre.js`
- **Constante** → `constants.js`

**Beneficio**: código legible, testing simple, onboarding claro.

---

## ✅ Antes de push e integración

```bash
npm run test:all           # Suite completa pasa (✅ obligatorio)
git diff                   # Revisar cambios
git log --oneline main..HEAD  # Revisar commits
git push -u origin <tipo>/<tema>
```

Abrir un PR o preparar una integración explícita hacia `main`. Antes de mergear, actualizar la rama contra `origin/main`, resolver conflictos, volver a probar y revisar el diff final. El commit o merge resultante debe identificar exactamente qué se validará en staging.

## 🚀 Despliegue a producción (FLUJO OBLIGATORIO)

**REGLA**: Nunca deployar a producción sin confirmación explícita del usuario.

```
1. Tests pasan 100% en la rama ✅
2. Probar esa rama en staging e identificar el SHA desplegado ✅
3. Integrar a `main`, actualizar `main` y repetir tests ✅
4. Desplegar `main` a staging y verificar el SHA de integración ✅
5. Usuario aprueba explícitamente: "OK, deployá" ✅
6. Hacer `npm run deploy` desde `main` limpio
7. Actualizar documentación (ver abajo)
```

**Cambios multi-capa** (frontend + backend): Leer [docs/CAMBIOS-MULTICAPA.md](docs/CAMBIOS-MULTICAPA.md)

### 📝 Documentación al deployar a producción (OBLIGATORIO)

Todo deploy a producción va acompañado de estos dos updates, en el mismo momento del deploy:

1. **`docs/STATUS.md`**: agregar la sesión (qué se hizo, causa raíz si fue un fix, tests, Version ID del deploy).
2. **Si el cambio es relevante para quien usa la app** (nueva feature, fix de un bug visible, no algo puramente interno): agregar una entrada en las **release notes públicas** (`public/releases.html`, el link "Novedades" del pie de página) — copiar un bloque `.release` existente al principio, y bump del número de versión en `package.json` **y** en el pie de página de `public/index.html` (`<a href="/releases" ...>vX.Y.Z</a>`).

`AI_HANDOFF.md` se actualiza solo cuando Pablo lo pide explícitamente (no es parte de este flujo obligatorio).

---

## 📚 Documentación por tema

| Necesito | Archivo | Notas |
|---|---|---|
| **Dónde estamos** | QUICK_START.md | ✅ Lectura obligatoria al inicio |
| **Planificar una feature (SDD)** | QUICK_START.md § OpenSpec | `explore` → `propose` → `apply` → `archive` |
| **Qué features existen** | docs/STATUS.md | Estado actual de cada feature |
| **Por qué se decidió así** | docs/ADRs.md | Decisiones arquitectónicas |
| **Flujo de trabajo** | docs/WORKFLOW.md | Detalles de proceso |
| **Deployar a staging/prod** | docs/DEPLOYMENT.md | ✨ NUEVO — Local → Staging → Production |
| **Última sesión** | AI_HANDOFF.md | Qué se hizo, qué viene |
| **Setup local** | README.md | OAuth, secretos, primer admin |

---

## 🚫 Nunca hacer

- ❌ Código sin tests
- ❌ Commitear `.dev.vars` (contiene credenciales)
- ❌ Desarrollar o hacer commits directos en `main`
- ❌ Dos agentes editando el mismo checkout o worktree
- ❌ Mezclar cambios de dos tareas en un commit
- ❌ `git push --force` a main
- ❌ Hardcodear secrets, emails, URLs
- ❌ Cambiar DB sin migración versionada
- ❌ **Ignorar tests que fallan — REGLA CRÍTICA**
- ❌ **Deployar con tests fallando** (local, staging, producción)
  - Siempre: `npm run test:all` pasa 100% ANTES de cualquier deploy
  - Si hay test fallando: arreglarlo primero, luego mergear, luego deploy

---

## 🛠️ Scripts de operación (uso frecuente para agentes y humanos)

```bash
npm run check:env             # Diagnóstico del ambiente (usar al inicio de sesión)
npm run db:reset:local        # Borrar DB local y re-aplicar migraciones ⚠️ destructivo
npm run db:seed:local         # Cargar datos de ejemplo (idempotente)
npm run e2e:reset             # Limpiar estado E2E y re-aplicar seed (cuando E2E fallan por estado)
npm run e2e:server            # Servidor E2E solo, sin tocar migraciones
npm run setup:local           # Setup completo desde cero (primera vez o nueva máquina)
npm run operator              # Menú interactivo con todas las operaciones (solo para humanos)
```

**Nota para agentes IA**: `operator` es interactivo y no puede usarse en modo no-interactivo.
Llamar directamente los scripts individuales según la necesidad.

## 🆘 Si algo falla

**Tests fallan localmente**:
```bash
npm run check:env             # Primero diagnosticar
npm run db:reset:local        # Si la DB local está inconsistente
npm run test:all
```

**Mi rama divergió de main**:
```bash
git fetch origin
git rebase origin/main
```

**Empecé un cambio en el checkout de `main`**:
```bash
git switch -c <tipo>/<tema>            # Guardar el trabajo en una rama
# Crear un worktree para esa rama y continuar allí. No resetear ni borrar
# archivos hasta verificar que el cambio existe en la nueva carpeta.
git worktree add ../tas-king-<tema> <tipo>/<tema>
```

---

**Stack**: Cloudflare Workers + Hono + D1 + R2 + HTML vanilla + Vitest + Playwright

**Próxima feature**: #2 Etiquetas (ver QUICK_START.md)
