# Instrucciones para Claude

Antes de hacer cualquier cosa, leer completo este archivo.

---

## 🎯 Objetivo del proyecto

**FUN TasKing!** es un tablero Kanban minimalista, multiusuario, de código abierto. El objetivo es que sea:
- **Funcional**: CRUD de tarjetas, colaboración, importar/exportar
- **Hermoso**: UX limpia, responsive, modo oscuro
- **Veloz**: Desplegado en Cloudflare, <100ms desde cualquier lugar
- **Seguro**: OAuth, permisos claros, multiusuario aislado
- **Sostenible**: Código limpio, tests, documentación, decisiones registradas

---

## 📖 Al iniciar CADA sesión

**Checklist obligatorio** (orden importa):

1. **Leer documentación** (~5 min):
   ```bash
   # Fuentes de verdad (en orden):
   cat docs/STATUS.md          # ¿Qué hay? ¿Qué falta? ¿Qué estado?
   cat docs/WORKFLOW.md        # Cómo trabajamos (proceso)
   cat docs/ADRs.md            # Por qué cada decisión
   cat AI_HANDOFF.md           # Objetivo inmediato, decisiones
   cat CLAUDE.md               # Este archivo (reglas)
   ```

2. **Actualizar repositorio**:
   ```bash
   git pull origin main        # ¿Hay cambios externos?
   npm install                 # ¿Hay deps nuevas?
   ```

3. **Correr tests SIEMPRE**:
   ```bash
   npm run test:all            # Debe pasar 100%
   ```
   
   Si fallan:
   - **STOP** — no continuar
   - Investigar qué se rompió
   - Reportar (puede ser cambios externos)
   - Arreglarlo antes de empezar tu trabajo

4. **Revisar tu feature** en `docs/STATUS.md`:
   - Busca el ítem del backlog
   - Si dice ✅ "100% completo" → no tocar, pick otra
   - Si dice ❌ "No existe" → OK, adelante
   - Si dice ⚠️ "Falta testing" → agregar tests a feature ya implementado

5. **Clonar rama de feature** (si cambios requeridos):
   ```bash
   git checkout -b feature/nombre-descriptivo
   ```

---

## 💻 Mientras codeas

### Reglas no negociables

- **Tests primero**: Si escribís código, escribís tests
  - Cambio API → test unitario
  - Cambio UI → test E2E
  - Cambio auth → test unitario + E2E
  - Cambio cosmético → podría saltarse

- **Commits claros**: Mensaje describe qué cambió, no por qué
  ```
  ✅ "Agregar validación de email en signup"
  ❌ "Fixed stuff", "WIP", "asdfgh"
  ```

- **Frecuentes y pequeños**: Un commit = un cambio lógico
  ```bash
  git add src/labels.js test/labels.spec.js
  git commit -m "Agregar endpoint POST /api/labels"
  ```

- **Pruebas locales**:
  ```bash
  npm run dev                 # Ver cambios en tiempo real
  npm run test:watch          # Tests se re-ejecutan al guardar
  npm run test:all            # Suite completa antes de push
  ```

### Workflow típico

```bash
# 1. Crear rama
git checkout -b feature/etiquetas-coloridas

# 2. Loop: code + test
# - Editar src/index.js (backend)
# - Crear/editar test/etiquetas.spec.js
# - npm run test:watch (debe fallar)
# - Implementar (test debe pasar)
# - Editar public/index.html (frontend)
# - Crear/editar e2e/etiquetas.spec.js
# - npm run test:e2e (debe fallar)
# - Implementar UI (test debe pasar)

# 3. Verificar
npm run test:all
npm run verify-ready            # Script que chequea TODO

# 4. Commit
git add .
git commit -m "Agregar etiquetas: backend + UI + tests"

# 5. Documentar
# - Actualizar docs/STATUS.md
# - Actualizar AI_HANDOFF.md sección "Último handoff"

# 6. Push
git push origin feature/etiquetas-coloridas

# 7. GitHub: Abrir PR → pedir review → mergear
```

---

## ✅ Antes de mergear a main

**Checklist final** (~15 min):

- [ ] `npm run test:all` pasa 100%
- [ ] Nuevo código tiene tests (>80% de líneas)
- [ ] Commits tienen mensajes claros
- [ ] `docs/STATUS.md` actualizado con feature
- [ ] `AI_HANDOFF.md` sección "Último handoff" tiene resumen
- [ ] `README.md` actualizado si hay breaking changes
- [ ] `docs/ADRs.md` actualizado si hay decisiones arquitectónicas
- [ ] `docs/WORKFLOW.md` actualizado si cambió el proceso
- [ ] No hay secrets/credenciales en diff
- [ ] No hay comentarios de debug o `console.log`

Si algo falta: no mergear.

---

## 🚀 Deploy

Después de mergear a main:

```bash
# 1. Verificar que main está en sync
git checkout main
git pull origin main

# 2. Deploy a producción
npm run deploy

# 3. Smoke test manual (2 min)
# - Abrir https://tas-king.pablotortorella.workers.dev
# - Login
# - Crear tarjeta
# - Ver que funciona
```

Si sale mal en producción:
```bash
# Revertir (crea un nuevo commit que lo deshace)
git revert <commit-hash>
git push origin main

# Investigar en rama separada
git checkout -b hotfix/fix-bug
# ... arreglar, tests pasar ...
# PR → merge → deploy
```

---

## 📚 Documentación obligatoria

Después de terminar feature, actualizar:

1. **`docs/STATUS.md`**: Estado de feature
   ```markdown
   ### ✅ #2 Etiquetas 🏷️
   **Qué hace**: ...
   **Implementación**: Backend, Frontend, Tests
   **Estado**: 100% completo
   ```

2. **`AI_HANDOFF.md`**: Resumen de lo que hiciste
   ```markdown
   ## Último handoff (fecha, sesión)
   - Implementado #2 Etiquetas: tabla labels, endpoints CRUD, UI completa
   - Agregados 5 tests
   - Deploy a producción ✅
   ```

3. **Si cambió stack/commands**: `README.md`

4. **Si hay decisión arquitectónica**: `docs/ADRs.md`

---

## 🚫 Nunca hacer

- ❌ Commitear `.dev.vars` (contiene credenciales)
- ❌ Pushear a main directamente (siempre PR)
- ❌ `git push --force` a main
- ❌ Código sin tests
- ❌ Hardcodear secrets, emails, URLs
- ❌ Cambiar base de datos sin migración versionada
- ❌ Borrar tablero personal de usuario (`is_personal=1`)
- ❌ Ignorar tests que fallan ("iré después")
- ❌ Commits con mensaje vacío o "asdf"
- ❌ Feature branches con >2 semanas sin mergear (divergen mucho)

---

## 📖 Referencia rápida

| Tarea | Comando |
|---|---|
| Arrancar | `git pull` → `npm install` → `npm run test:all` |
| Dev local | `npm run dev` (http://localhost:8787) |
| Tests unitarios | `npm test` o `npm run test:watch` |
| Tests E2E | `npm run test:e2e` o `npm run test:e2e:ui` |
| Todo | `npm run test:all` |
| Verificar | `npm run verify-ready` |
| Deploy | `npm run deploy` |
| Migrations | `npm run db:migrate:local` (dev) o `npm run db:migrate:remote` (prod) |
| Ver logs | `git log --oneline` |
| Ver cambios | `git status` y `git diff` |

---

## 🆘 Ayuda

**"No sé qué hacer"**
1. Leer docs/WORKFLOW.md
2. Revisar docs/STATUS.md para saber qué falta
3. Buscar similar en git log (`git log --oneline | grep "etiquetas"`)

**"Tests fallan"**
1. `npm run test:all` de nuevo
2. `rm -rf .wrangler/state` (limpiar caché)
3. `npm install` (reinstalar deps)
4. Revisar git status (hay cambios sin guardar)

**"No sé si debo hacer X"**
1. Leer docs/ADRs.md (qué decisiones existen)
2. Si es nueva decisión, crear ADR antes de implementar
3. Si es duda técnica, revisar comments en código

---

## 📈 La mentalidad

Este es un proyecto **de código abierto, mantenible, a largo plazo**. No es prototipo.

- **Código limpio** > código rápido (si necesitas elegir)
- **Tests > features** (test te protege en refactors futuros)
- **Documentación > asumir** (6 meses después no recordarás por qué)
- **Decisiones registradas > decisiones implícitas** (otros IAs/humanos también trabajan)
- **Pequeños PRs > PRs gigantes** (más fácil review, merge, revert)

El objetivo es que alguien nuevo pueda:
1. Leer docs/WORKFLOW.md
2. `git clone` → `npm install` → `npm run test:all`
3. Entender la arquitectura leyendo docs/ADRs.md
4. Empezar a contribuir sin preguntar

---

## ✨ Cuando termines tu sesión

Checklist final:

- [ ] Tests pasan (`npm run test:all`)
- [ ] Commit hecho y pusheado
- [ ] PR abierta si cambios significativos
- [ ] `docs/STATUS.md` actualizado
- [ ] `AI_HANDOFF.md` "Último handoff" actualizado
- [ ] Si hay cambios mayores: `README.md` actualizado
- [ ] Si hay decisión: `docs/ADRs.md` actualizado
