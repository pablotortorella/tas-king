# 📋 Cambios Multi-Capa: Frontend + Backend

**Cuándo aplica**: Cuando cambios en el frontend requieren cambios en el backend (o viceversa) para que funcionen.

## ⚠️ Ejemplos de cambios multi-capa

- ✅ Cambiar paleta de colores (frontend ↔ validación backend)
- ✅ Cambiar estructura de API response (backend ↔ frontend parser)
- ✅ Cambiar formato de datos guardados (backend ↔ frontend display)
- ✅ Agregar nuevos campos a tarjeta (backend DB ↔ frontend form)

## 📖 Proceso obligatorio

### Paso 1: Crear una rama y worktree para el cambio

```bash
git fetch origin --prune
git worktree add ../tas-king-<tema> -b feature/<tema> origin/main
cd ../tas-king-<tema>

# Editar frontend
# Editar backend
# Tests deben pasar 100%

npm run test:all  # ✅ Must pass
```

El checkout principal se mantiene en `main` limpio. Si otro agente está activo, usa otro worktree; nunca compartir carpeta aunque las ramas sean diferentes.

### Paso 2: Verificar localmente ANTES de deployar

**Esto es CRÍTICO** — ejecutar:

```bash
# 1. Limpiar dev server (caché)
rm -rf .wrangler

# 2. Ejecutar tests (los tests ya lo prueban, pero verificar)
npm run test:all

# 3. Probar manualmente en localhost:8787
npm run dev
# → Crear tarjeta
# → Asignar etiqueta
# → Verificar que aparece correctamente
```

**⚠️ Si algo falla en local**: FIX LOCAL primero, luego mergea y deployá.

### Paso 3: Probar la rama en Staging

```bash
git status -sb
git rev-parse --short HEAD  # registrar el SHA desplegado
npm run deploy:staging
# URL: https://tas-king-staging.pablotortorella.workers.dev
```

**En staging, verificar:**
- [ ] Login funciona
- [ ] Feature principal funciona end-to-end
- [ ] No hay errores de consola

Staging tiene una sola versión activa. Si otro trabajo se despliega después, esta validación queda reemplazada; no se asume que dos ramas están verificadas a la vez.

### Paso 4: Integrar y probar el SHA de `main`

Antes del merge, rebasar la rama contra `origin/main`, resolver conflictos y volver a correr los tests afectados. Integrar por PR, actualizar el checkout principal de `main`, ejecutar `npm run test:all` y desplegar ese SHA a staging. El smoke test final es sobre esa integración, no sobre un deploy anterior de la rama.

### Paso 5: **CONFIRMACIÓN EXPLÍCITA antes de producción**

**Flujo correcto** (que NO seguimos):
```
Pablo: "Verificá todo en local y staging"
Agente: "✅ La rama y el SHA integrado en main pasaron tests y staging"
Pablo: "OK, deployá"
Agente: npm run deploy  ← SOLO después de aprobación explícita
```

**Flujo incorrecto** (lo que pasó):
```
Claude: Tests pasan → deploy a prod sin preguntar ❌
```

## 🔍 Checklist antes de deployar a producción

- [ ] Tests pasan 100% (unitarios + E2E)
- [ ] Cambios en frontend ✅ y backend ✅ están en el mismo commit
- [ ] Probé localmente (rm -rf .wrangler && npm run test:all)
- [ ] Probé en staging y funciona
- [ ] El SHA probado en staging corresponde al `main` que se va a desplegar
- [ ] **USUARIO da OK explícito** para ir a producción

## 🚫 Qué NO hacer

❌ Deployar solo cambios de frontend o backend (sin el otro)
❌ Deployar cambios multi-capa a producción sin testing local
❌ Confiar solo en tests (probar manualmente en dev server)
❌ Deployar a producción sin confirmación explícita del usuario

## 📝 Notas para cambios específicos

### Validaciones (frontend ↔ backend)
- **Paleta de colores**: VALID_COLORS en backend, LABEL_COLORS en frontend
- **Tipos de datos**: enum en backend, constante en frontend
- **Límites**: MAX_LABELS en backend, límite visual en frontend

→ **Siempre mantener sincronizados** con un comentario que lo señale:
```javascript
// Debe coincidir con LABEL_COLORS en public/js/core/dom.js
const VALID_COLORS = [...]
```

### Respuesta de API
Si cambias la estructura de respuesta:
1. Actualizar backend (nueva estructura)
2. Actualizar frontend parser (cómo procesa la respuesta)
3. Tests que cubran ambos

---

**Última actualización**: 2026-06-24
**Razón de creación**: Bug de colores de etiquetas en producción (frontend y backend desincronizados)
