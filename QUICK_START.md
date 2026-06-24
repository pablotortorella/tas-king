# 🚀 QUICK START — FUN TasKing!

**Lee esto al empezar cada sesión (5 min).**

---

## ✅ Checklist: Setup (2 min)

```bash
git pull origin main
npm install
npm run test:all              # Debe pasar 100% — si falla, STOP
```

---

## 📍 Dónde estamos (Estado actual)

**Última actualización**: 2026-06-24  
**Versión**: 1.7 (Refactor modular completado)

### ✅ Completado esta sesión
- Refactor: `src/index.js` (1267 líneas) → 13 módulos temáticos (~100 líneas c/u)
- Tests: 38 unitarios + 5 E2E ✅ Todos pasan
- Documentación: Estructura modular en CLAUDE.md + QUICK_START.md

### 🔄 En progreso
(nada)

### ⏭️ Próximo
**Feature #2: Etiquetas + filtro** (MEDIA priority)
- Tablas: `labels` y `card_labels`
- UI: crear/editar/filtrar etiquetas
- Atajos: 0-9 para filtrar
- Página AYUDA (F1) con todos los atajos

Ver `docs/STATUS.md` sección "Features NO Implementados" para detalles.

### ⚠️ Blockers
(ninguno)

---

## 🎯 Reglas no negociables

- **Tests primero**: Si escribís código, escribís tests (unitarios + E2E según corresponda)
- **Commits pequeños**: 1 commit = 1 cambio lógico (no gigantes)
- **Commits claros**: Mensaje describe QUÉ cambió, no por qué
- **Estructura modular**: Código backend en `src/` — cada archivo ~100-150 líneas máximo
- **Documentar decisiones**: Si es arquitectónico, va en `docs/ADRs.md`

**Detalles completos**: [Ver CLAUDE.md](CLAUDE.md)

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
npm run dev                   # Servidor local (http://localhost:8787)
npm run test:watch           # Tests en tiempo real (re-ejecuta al guardar)
npm run test:all             # Suite completa (unitarios + E2E)
npm run deploy               # Deploy a producción
```

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
