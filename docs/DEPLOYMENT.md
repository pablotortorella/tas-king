# 🚀 Guía de Deployment — tas-king

**Flujo: Desarrollo Local → Staging → Producción**

---

## 📍 Entornos

| Entorno | URL | DB | R2 | Comando |
|---|---|---|---|---|
| **Local** | `localhost:8787` | D1 local emulado | R2 local emulado | `npm run dev` |
| **Staging** | `tas-king-staging.<subdominio>.workers.dev` | `tas-king-staging` (D1) | `tas-king-uploads-staging` (R2) | `npm run deploy:staging` |
| **Production** | `tas-king.pablotortorella.workers.dev` | `tas-king` (D1) | `tas-king-uploads` (R2) | `npm run deploy` |

---

## 🎯 Flujo típico

### 1️⃣ Desarrollo local (sin cambios)

```bash
git checkout -b feature/mi-feature
npm run dev                    # http://localhost:8787
# Editar, probar en navegador
npm run test:all              # Tests locales pasan
git commit -m "Feature: ..."
```

### 2️⃣ Crear PR en GitHub

```bash
git push origin feature/mi-feature
# Abrir PR en GitHub
```

### 3️⃣ Deployar a Staging (para revisar antes de producción)

```bash
npm run deploy:staging
# → https://tas-king-staging.<subdominio>.workers.dev
```

**En staging**:
- Datos separados de producción (D1 staging ≠ D1 production)
- Todos los secrets igual a producción (GOOGLE_CLIENT_ID, etc.)
- Misma versión de código que vas a mergear

### 4️⃣ Revisar en Staging

- Probar el feature completo en una URL real (no localhost)
- Verificar adjuntos suben correctamente a R2 staging
- Verificar que no hay errores de CORS, auth, etc.

### 5️⃣ Mergear a main

```bash
# Una vez que el code review pasó y staging verificó OK
git merge --no-ff feature/mi-feature
git push origin main
```

### 6️⃣ Deployar a Producción

```bash
npm run deploy              # O: npm run deploy:production
# → https://tas-king.pablotortorella.workers.dev
```

---

## 🔧 Setup inicial de Staging (UNA sola vez)

Si aún no existe staging, seguir estos pasos:

### Paso 1: Crear D1 staging

```bash
npx wrangler d1 create tas-king-staging
```

Devuelve algo como:
```
✅ Created database "tas-king-staging"
📝 Add the following to your wrangler.jsonc

"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tas-king-staging",
    "database_id": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
    "migrations_dir": "migrations"
  }
]
```

Copiar el `database_id`.

### Paso 2: Crear R2 bucket staging

```bash
npx wrangler r2 bucket create tas-king-uploads-staging
```

### Paso 3: Actualizar wrangler.jsonc

En la sección `"env": { "staging": { ... } }`, reemplazar:
- `database_id` en la sección `d1_databases` (copiar del paso 1)
- `bucket_name` debe ser `tas-king-uploads-staging`

```jsonc
"env": {
  "staging": {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "tas-king-staging",
        "database_id": "PASTE_THE_ID_FROM_STEP_1",
        "migrations_dir": "migrations"
      }
    ],
    "r2_buckets": [
      {
        "binding": "BUCKET",
        "bucket_name": "tas-king-uploads-staging"
      }
    ]
  }
}
```

### Paso 4: Aplicar migraciones a staging

```bash
npm run db:migrate:staging
```

Esto copia el schema (tablas, índices) a D1 staging.

### Paso 5: Cargar secrets en staging

```bash
# Los mismos secrets que en producción
npx wrangler secret put --env staging GOOGLE_CLIENT_ID
npx wrangler secret put --env staging GOOGLE_CLIENT_SECRET
npx wrangler secret put --env staging SESSION_SECRET
npx wrangler secret put --env staging ADMIN_EMAILS
# (opcional) npx wrangler secret put --env staging ALLOWED_EMAILS
```

---

## 🛠️ Troubleshooting

### Staging falla con "DB binding not found"

```bash
# Verificar que wrangler.jsonc tiene la sección "env.staging" con d1_databases
# Luego re-deployar:
npm run deploy:staging
```

### Migraciones no se aplicaron en staging

```bash
# Ver estado
npx wrangler d1 migrations list --env staging

# Aplicar forzado
npm run db:migrate:staging
```

### Staging necesita datos de prueba

Staging hereda el schema, pero no los datos. Para copiar datos de producción a staging (⚠️ cuidado con info sensible):

```bash
# Esto es manual en Cloudflare Dashboard:
# 1. D1 → Manage
# 2. Download backup de `tas-king` (producción)
# 3. Subir a `tas-king-staging`
```

(Mejor alternativa: crear fixtures de test en `test/fixtures/` y cargarlas en staging si necesitas datos)

### Necesito borrar staging y empezar de nuevo

```bash
# En Cloudflare Dashboard → D1 → Delete "tas-king-staging"
# Luego repetir setup desde el Paso 1
```

---

## 🤖 Deployar desde Claude Code (agentes remotos / VS Code extension)

Esta sección es para Claude Code cuando corre en un sandbox remoto (VS Code extension, Claude.ai/code, fleet remoto).

### Por qué falla `npm run deploy` en entornos remotos

`wrangler deploy` necesita autenticarse contra la cuenta Cloudflare de Pablo. Hay dos formas:

1. **OAuth local** (`wrangler login`): guarda tokens en `~/.wrangler/config/default.toml`. Funciona en la PC de Pablo, no en sandboxes remotos.
2. **API Token** (`CLOUDFLARE_API_TOKEN`): una variable de entorno con el token. Los sandboxes remotos no la tienen por defecto.

### Qué hacer si no hay auth

**Opción A (recomendada): pedirle a Pablo que lo corra él**
```bash
# Pablo lo ejecuta en su PC — ya tiene wrangler login activo
npm run deploy:staging
npm run deploy
```

**Opción B: inyectar el token en la sesión**

Pablo puede pegar el token en la conversación (o configurarlo como secret en el entorno):
```bash
export CLOUDFLARE_API_TOKEN="<token de Pablo>"
npm run deploy:staging
```

El token se obtiene en: Cloudflare Dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template. Permisos mínimos: Workers Scripts Edit, D1 Edit, R2 Edit.

> ⚠️ **Nunca commitear el token.** Usarlo solo en la sesión actual y no guardarlo en archivos.

### Lo que sí funciona siempre en remoto

- `npm run dev` (wrangler dev emula D1/R2 localmente, sin auth Cloudflare)
- `npm test` y `npm run test:e2e` (no necesitan auth)
- Todo el desarrollo de código, commits y PRs vía `gh`

### Resumen rápido

| Operación | ¿Funciona sin token? |
|---|---|
| `npm run dev` | ✅ Siempre |
| `npm test` / `npm run test:e2e` | ✅ Siempre |
| `git push` / `gh pr create` | ✅ (usa GH_TOKEN) |
| `npm run deploy:staging` | ❌ Necesita Cloudflare auth |
| `npm run deploy` | ❌ Necesita Cloudflare auth |

---

## 📋 Checklist antes de npm run deploy

```bash
npm run test:all              # ✅ Tests pasan localmente
git diff                      # ✅ Revisar cambios
git log --oneline main..HEAD  # ✅ Revisar commits
npm run deploy:staging        # ✅ Test en staging
# Revisar https://tas-king-staging.<subdominio>.workers.dev
npm run deploy                # ✅ A producción
```

---

## 🔐 Secretos

Los secrets en Cloudflare se cargan con `wrangler secret put`:

```bash
# Listar secrets
npx wrangler secret list --env production
npx wrangler secret list --env staging

# Actualizar un secret
npx wrangler secret put --env production GOOGLE_CLIENT_ID
npx wrangler secret put --env staging GOOGLE_CLIENT_ID
```

Cada entorno tiene sus propios secrets. **No hardcodear en wrangler.jsonc**.

---

## 📊 Verificar estado de ambientes

```bash
# Production
curl -I https://tas-king.pablotortorella.workers.dev

# Staging
curl -I https://tas-king-staging.<subdominio>.workers.dev

# Local
npm run dev  # http://localhost:8787
```

---

**Última actualización**: 2026-07-01  
**Responsable**: Claude Code
