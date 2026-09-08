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
git pull origin main
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

### Commits claros y pequeños
- **Mensaje**: describe QUÉ cambió, no por qué
  - ✅ "Agregar validación de email en signup"
  - ❌ "Fixed stuff", "WIP", "asdfgh"
- **Tamaño**: 1 commit = 1 cambio lógico
  - ✅ `git add src/labels.js test/labels.spec.js`
  - ❌ `git add .` (todo junto)

### Rama vs. commit directo a main
**Default: commit + push directo a `main`.** Rama + PR es la excepción, no la regla.

Usar rama + PR solo cuando el cambio es:
- **Migración de DB** (cambio de esquema D1) — más riesgoso de revertir una vez aplicado en producción.
- **Grande o multi-archivo** (una feature que toca muchos archivos, donde conviene revisar el diff completo antes de main).

Cualquier otra cosa (fixes, cambios cosméticos, features chicas, docs) va directo a `main`. Ante la duda, o si Pablo lo pide explícitamente para un caso puntual, usar rama.

### Pruebas locales
```bash
npm run dev                 # Ver cambios en tiempo real
npm run test:watch          # Tests re-ejecutan al guardar
npm run test:all            # Suite completa antes de push
npm run deploy:staging      # Probar en staging (URL real) antes de prod
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

## ✅ Antes de push/deploy

```bash
npm run test:all           # Suite completa pasa (✅ obligatorio)
git diff                   # Revisar cambios
git log --oneline main..HEAD  # Revisar commits
git push origin main       # Default. Si es migración de DB o cambio grande: rama + PR
```

## 🚀 Despliegue a producción (FLUJO OBLIGATORIO)

**REGLA**: Nunca deployar a producción sin confirmación explícita del usuario.

```
1. Tests pasan 100% ✅ (local)
2. Probar en staging ✅
3. Usuario aprueba: "OK, deployá" (o "mergea y deployá" si el cambio está en una rama — migración de DB o cambio grande)
4. Claude hace: npm run deploy
5. Actualizar documentación (ver abajo)
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
- ❌ Migración de DB o cambio grande/multi-archivo directo a main (siempre rama + PR para esos casos — ver "Rama vs. commit directo a main")
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

**Mi rama divergió de main** (para los casos que sí usan rama — migración de DB o cambio grande):
```bash
git fetch origin
git rebase origin/main
```

**Empecé un cambio directo en main pero resultó ser grande/migración de DB**:
```bash
git checkout -b feature/nueva-rama    # Mover el trabajo a una rama
git reset --hard origin/main          # Volver main local a lo que ya está en remoto
git checkout feature/nueva-rama       # Seguir ahí, abrir PR cuando esté listo
```

---

**Stack**: Cloudflare Workers + Hono + D1 + R2 + HTML vanilla + Vitest + Playwright

**Próxima feature**: #2 Etiquetas (ver QUICK_START.md)
