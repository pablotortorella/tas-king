# Flujo de Trabajo — FUN TasKing!

Este documento define cómo trabajamos en el proyecto: desde el setup local hasta el deploy en producción.

---

## 🎯 Principios

- **Tests first**: No mergeamos código sin tests pasando
- **Documented decisions**: Cada decisión arquitectónica va en `docs/ADRs.md`
- **Single source of truth**: `docs/STATUS.md` = estado actual del proyecto
- **Feature branches**: Cada feature en su propia rama
- **Protected main**: Solo PRs con tests + review mergean a main
- **Staging before prod**: Cambios se prueban en staging antes de producción

---

## 📋 Al iniciar una sesión de desarrollo

**Checklist obligatorio** (2-3 minutos):

```bash
# 1. Actualizar desde remoto
git pull origin main

# 2. Revisar qué hay implementado
cat docs/STATUS.md          # ¿Qué está listo? ¿Qué falta tests?
cat CLAUDE.md               # ¿Cuáles son las reglas?
cat AI_HANDOFF.md           # ¿Cuál es el objetivo?

# 3. Correr tests (deben pasar siempre)
npm run test:all            # Si fallan, investigar antes de continuar

# 4. Confirmar tu feature del backlog
# Abrir docs/STATUS.md → buscar tu item
# Si dice "✅ 100% completo" → no tocar
# Si dice "❌ No existe" → OK, empezar a implementar
# Si dice "⚠️ Falta testing" → agregar tests

# 5. (opcional) Ver los cambios recientes
git log --oneline -10       # Últimos commits
```

Si tests fallan, **NO** empezar a codar. Investigar por qué.

---

## 🔀 Crear rama de feature

```bash
git checkout -b feature/nombre-descriptivo

# Ejemplos:
# git checkout -b feature/etiquetas-coloridas
# git checkout -b feature/historial-actividad
# git checkout -b feature/modo-oscuro
```

**Regla**: Una rama = una feature. Si necesitas hacer dos features, dos ramas.

---

## 💻 Durante el desarrollo

### Workflow local

```bash
# Editar código, crear tests
npm run dev                 # Ver cambios en tiempo real → localhost:8787
npm run test:watch          # Tests se re-ejecutan al guardar
```

### Estructura modular del backend

El código backend (`src/`) está organizado por responsabilidad (~100-150 líneas cada archivo, manejable):

```
src/
├── index.js              (solo app setup + middleware + rutas)
├── constants.js          (RATE_LIMITS, ALLOWED_MIME_TYPES, etc.)
├── middleware/
│   ├── cors.js          (CORS + security headers)
│   ├── logging.js       (structured logging, getClientIP)
│   ├── rateLimit.js     (rate limiting helpers)
│   └── auth.js          (JWT, sesiones, requireAdmin)
├── routes/
│   ├── auth.js          (/auth/login, /auth/callback, /auth/logout)
│   ├── users.js         (GET/PUT /api/me)
│   ├── boards.js        (/api/boards/*, /api/boards/:id/members, /activity)
│   ├── cards.js         (/api/cards/*, /api/boards/:id/cards, reorder, history)
│   ├── uploads.js       (GET /uploads/:key, POST attachments)
│   └── admin.js         (/api/admin/*)
└── db/
    ├── queries.js       (cardToJSON, getBoard, cardWithAccess, etc.)
    └── helpers.js       (ensureUser, membership, logEvent, etc.)
```

**Dónde editar**:
- **Nuevo endpoint**: crear en `routes/` (o agregar a archivo existente si es del mismo recurso)
- **Función de DB**: agregar en `db/queries.js` o `db/helpers.js`
- **Constante**: agregar en `constants.js`
- **Lógica de permisos**: editar middleware en `middleware/auth.js` o en la ruta

### Commits frecuentes

```bash
# Hacer commits pequeños y atómicos (no 1 commit gigante)
git add src/index.js e2e/test.js
git commit -m "Agregar endpoint de etiquetas: GET /api/labels"

# El mensaje debe ser claro y describir QUÉ cambió, no por qué
# ✅ BUENO: "Agregar validación de email en signup"
# ❌ MALO: "Fixed stuff" o "WIP"
```

### Tests

**Regla de oro**: Si escribís código, escribís tests.

- **Cambio de lógica o API** → test unitario (Vitest)
- **Cambio visible en UI** → test E2E (Playwright)
- **Cambio de auth/permisos** → test unitario + E2E
- **Cambio cosmético solo** → podría no necesitar test automático

```bash
# Ejemplo: agregaste endpoint POST /api/labels
# 1. Crear test en test/labels.spec.js
# 2. El test falla (red)
# 3. Implementar endpoint
# 4. El test pasa (green)
# 5. Refactorizar si es necesario (refactor)
# = Red-Green-Refactor
```

### Verificar antes de push

```bash
# Correr suite completa
npm run test:all

# Ver qué cambios llevas
git diff

# Verificar commits
git log --oneline main..HEAD    # commits de tu rama que no están en main

# Script automático (recomendado)
npm run verify-ready            # ✅ listo para push o ❌ falta algo
```

---

## 📤 Abrir Pull Request

```bash
# 1. Push tu rama
git push origin feature/etiquetas-coloridas

# 2. En GitHub: abrir PR a main
# - Título: describe qué hace (máx 70 chars)
# - Descripción: 
#   - Qué cambió
#   - Cómo se prueba (pasos manuales)
#   - Cuáles tests agregaste
#   - Capturas si hay UI changes

# Ejemplo:
# Título: Agregar etiquetas de colores a tarjetas
# 
# Descripción:
# ## Cambios
# - Tabla `labels` y `card_labels` en D1
# - Endpoints GET/POST/DELETE para CRUD de labels
# - UI: crear etiquetas por tablero, agregar a tarjetas, filtrar
#
# ## Cómo probar
# 1. Abrir tablero personal
# 2. Hacer clic en "⚙️ Etiquetas"
# 3. Crear etiqueta "Urgente" (roja)
# 4. Abrir tarjeta, click en "Agregar etiqueta"
# 5. Seleccionar "Urgente"
# 6. Filtrar por "Urgente" desde header
#
# ## Tests
# - 2 tests unitarios (CRUD de labels)
# - 1 test E2E (crear → aplicar → filtrar)
```

---

## ✅ Checklist antes de mergear (Code Review)

**Antes de mergear tu PR**:

- [ ] Tests pasan (`npm run test:all`)
- [ ] Nuevo código tiene tests (>80% cobertura en líneas cambiadas)
- [ ] Commits tienen mensajes claros
- [ ] `docs/STATUS.md` está actualizado con la feature
- [ ] `AI_HANDOFF.md` sección "Último handoff" tiene resumen
- [ ] Si hay breaking changes, README está actualizado
- [ ] Si hay secretos/credenciales en diff, STOP → revertir

**Review automático** (GitHub Actions):
- Tests pasan ✅
- No hay conflictos con main ✅

**Review manual** (si se requiere):
- Código tiene sentido
- Lógica es correcta
- Tests cubren casos edge

---

## 🚀 Merge y Deploy

### Mergear a main

```bash
# En GitHub: click "Merge Pull Request"
# O en CLI:
git checkout main
git pull origin main
git merge feature/etiquetas-coloridas
git push origin main
```

### Deploy a staging

```bash
# GitHub automáticamente deploya develop branch a staging
# (Si exists develop branch con CI configurado)
# Esperar a que CI termine

# Verificar staging: https://tas-king-staging.pablotortorella.workers.dev
# Probar manualmente:
# 1. Login con test user
# 2. Crear tarjeta, agregar etiqueta
# 3. Filtrar por etiqueta
# 4. Ver en historial que se registró el evento
```

### Deploy a producción

```bash
# Cuando changes en main están listos
npm run deploy

# O:
git push origin main:production   # Si tienen rama de production

# Verificar: https://tas-king.pablotortorella.workers.dev
# Smoke test:
# 1. Login real
# 2. Navegar tablero
# 3. Crear/editar tarjeta
# 4. Ver que no hay errores en consola
# 5. Revisar logs de Cloudflare
```

---

## 🐛 Si algo sale mal en producción

```bash
# 1. Identifica el commit problemático
git log --oneline main | head -10

# 2. Revert el commit (crea un nuevo commit que lo deshace)
git revert <commit-hash>
git push origin main

# 3. Investigar en rama separada
git checkout -b hotfix/investigar-bug
# ... arreglar ...
# ... tests pasar ...
# PR → review → merge

# 🚫 NO hacer: git reset --hard, git push --force
# (Eso pierde historia, rompe otros colaboradores)
```

---

## 📊 Estructura de branches

```
main (protegida)
├── feature/etiquetas-coloridas   (tu rama)
├── feature/modo-oscuro           (otra rama)
└── hotfix/fix-seguridad          (arreglo urgente)

develop (si existe, = staging)
└── auto-deploya a staging
```

---

## 🔍 Validaciones automáticas

Antes de mergear, estos checks deben pasar:

| Check | Herramienta | Falla si... |
|---|---|---|
| Tests unitarios | Vitest | Hay fallos o timeout |
| Tests E2E | Playwright | Hay fallos o timeout |
| Linting | ESLint (si está configurado) | Hay errores de estilo |
| TypeScript | tsc (si está configurado) | Hay errores de tipo |
| Commits | Convencional (si está configurado) | Mensajes no tienen formato |

**Status checks requeridos en main branch**:
- ✅ GitHub Actions / CI pasa
- ✅ Cambios no conflictúan

---

## 📝 Documentación obligatoria

Cuando terminas una feature:

**1. Actualizar `docs/STATUS.md`**
```markdown
### ✅ #2 Etiquetas + filtro 🏷️

**Qué hace**: Crear etiquetas de colores, aplicar a tarjetas, filtrar.

**Implementación**:
- **Backend**: Tabla `labels` (id, board_id, name, color, created_at)
  - GET `/api/labels` — lista por tablero
  - POST `/api/labels` — crear
  - PUT/DELETE `/api/labels/:id`
  - POST `/api/cards/:id/labels/:labelId` — aplicar a tarjeta
- **Frontend**: 
  - Modal "Etiquetas" en header
  - UI: crear/editar/eliminar etiquetas
  - Selector en modal de tarjeta
  - Filtro por etiqueta en board
- **Atajos**: 0-9 para filtrar

**Tests**:
- ✅ Unitarios: CRUD de labels, permisos (4 tests)
- ✅ E2E: crear → aplicar → filtrar (1 test)

**Estado**: **100% completo** — listo para producción.
```

**2. Actualizar `AI_HANDOFF.md` sección "Último handoff"**
```markdown
**Sesión 2026-06-24 (Claude Sonnet)**:
- Implementado #2 Etiquetas: tabla labels/card_labels, endpoints CRUD, UI completa
- Agregados 5 tests (4 unitarios + 1 E2E)
- Actualizado docs/STATUS.md
- Deploy a staging ✅, verificado manualmente ✅
```

**3. Actualizar `README.md` si hay cambios en:**
- Nuevos comandos npm
- Nuevos secrets requeridos
- Cambios en stack
- Nuevas dependencias

**4. Si hay breaking changes**: Actualizar `docs/CHANGELOG.md`

---

## ⏰ Tiempo estimado

| Tarea | Tiempo |
|---|---|
| Setup + tests iniciales | 30 min |
| Feature chica (🟢) | 2-4 horas |
| Feature mediana (🟡) | 8-16 horas |
| Feature grande (🔴) | 20+ horas |
| Tests E2E para feature | +30 min |
| Documentar + deploy | +30 min |

---

## 🆘 Troubleshooting

**"Tests fallan localmente pero pasaban ayer"**
- Actualizar repo: `git pull origin main`
- Limpiar caché: `rm -rf .wrangler/state`
- Reinstalar: `npm install`
- Correr de nuevo: `npm run test:all`

**"Mi rama divergió de main"**
```bash
git fetch origin
git rebase origin/main    # O: git merge origin/main
```

**"Necesito hacer rebase interactivo"**
```bash
git rebase -i origin/main
# (Editar commits, squash, reorder)
```

**"Committé en main por error"**
```bash
git checkout -b feature/nueva-rama          # Guardar cambios en rama
git reset --hard origin/main                # Volver main a remoto
git checkout feature/nueva-rama             # Ir a rama con cambios
```
