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
git push origin feature/...
```

## 🚀 Despliegue a producción (FLUJO OBLIGATORIO)

**REGLA**: Nunca deployar a producción sin confirmación explícita del usuario.

```
1. Tests pasan 100% ✅ (local)
2. Probar en staging ✅
3. Usuario aprueba: "OK, mergea y deployá"
4. Claude hace: npm run deploy
```

**Cambios multi-capa** (frontend + backend): Leer [docs/CAMBIOS-MULTICAPA.md](docs/CAMBIOS-MULTICAPA.md)

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
- ❌ Pushear directamente a main (siempre rama + PR)
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

**Committé en main por error**:
```bash
git checkout -b feature/nueva-rama    # Guardar cambios
git reset --hard origin/main          # Volver main a remoto
git checkout feature/nueva-rama       # Ir a rama con cambios
```

---

**Stack**: Cloudflare Workers + Hono + D1 + R2 + HTML vanilla + Vitest + Playwright

**Próxima feature**: #2 Etiquetas (ver QUICK_START.md)
