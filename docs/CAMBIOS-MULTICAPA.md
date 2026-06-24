# 📋 Cambios Multi-Capa: Frontend + Backend

**Cuándo aplica**: Cuando cambios en el frontend requieren cambios en el backend (o viceversa) para que funcionen.

## ⚠️ Ejemplos de cambios multi-capa

- ✅ Cambiar paleta de colores (frontend ↔ validación backend)
- ✅ Cambiar estructura de API response (backend ↔ frontend parser)
- ✅ Cambiar formato de datos guardados (backend ↔ frontend display)
- ✅ Agregar nuevos campos a tarjeta (backend DB ↔ frontend form)

## 📖 Proceso obligatorio

### Paso 1: Cambiar AMBAS capas en la misma rama

```bash
git checkout -b feature/colores-etiquetas

# Editar frontend
# Editar backend
# Tests deben pasar 100%

npm run test:all  # ✅ Must pass
```

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

### Paso 3: Probar en Staging (UNA SOLA VEZ)

```bash
npm run deploy:staging
# URL: https://tas-king-staging.pablotortorella.workers.dev
```

**En staging, verificar:**
- [ ] Login funciona
- [ ] Feature principal funciona end-to-end
- [ ] No hay errores de consola

### Paso 4: **CONFIRMACIÓN EXPLÍCITA antes de producción**

**Flujo correcto** (que NO seguimos):
```
Pablo: "Claude, verificá todo en local y staging"
Claude: "✅ Tests pasan, staging funciona, estoy listo"
Pablo: "OK, mergea a main y deployá a producción"
Claude: npm run deploy  ← SOLO después de aprobación explícita
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
// Debe coincidir con LABEL_COLORS en public/index.html
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
