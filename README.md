# Tablero de tareas

Tablero Kanban minimalista **multiusuario** sobre **Cloudflare**: Workers + Hono para la
API, **D1** (SQLite) para los datos y **R2** para los archivos. El frontend es un único
`public/index.html` sin build. Cada persona entra con su cuenta de Google (vía
**Cloudflare Access**), tiene su tablero personal y puede crear tableros compartidos.

## Requisitos

- Node.js 18+
- Cuenta de Cloudflare (para el deploy)

## Desarrollo local

`wrangler dev` emula D1 y R2 en tu máquina (no toca tu cuenta de Cloudflare):

```bash
npm install
npm run db:migrate:local     # aplica todas las migraciones en la D1 local
npm run dev                  # → http://localhost:8787
```

**Usuario simulado en local**: como no hay Cloudflare Access en local, el usuario lo
define `.dev.vars` (`DEV_USER_EMAIL`). Para probar varios usuarios, mandá el header
`X-Dev-User: otra@persona.com` en tus requests (curl o herramientas de dev del navegador).

## Deploy a Cloudflare (una vez)

```bash
npx wrangler login

# 1) Crear la base D1 y pegar el database_id que devuelve en wrangler.jsonc
npx wrangler d1 create tas-king

# 2) Crear el bucket R2 para los adjuntos
npx wrangler r2 bucket create tas-king-uploads

# 3) Aplicar el esquema en la base remota
npm run db:migrate:remote

# 4) Publicar
npm run deploy               # queda en https://tas-king.<subdominio>.workers.dev
```

### Proteger con login de Google (Cloudflare Access)

En el panel de Cloudflare → **Zero Trust → Access → Applications → Add an application**
(Self-hosted) apuntando al dominio del Worker. Como proveedor de identidad agregá
**Google** y creá una política que permita los emails autorizados. No requiere cambios
de código: Access pone el login con Google delante de toda la app.

## Estructura

```
wrangler.jsonc        # config de Workers, D1 y R2
src/index.js          # Worker (Hono): API + servido de /uploads
migrations/           # esquema D1
public/index.html     # frontend
```

## Funcionalidades

- **Multiusuario**: cada persona se identifica por su email (Google vía Access). Tablero
  personal automático + tableros compartidos (crear, invitar por email, roles dueño/miembro).
- **Tarjetas**: título, detalles, fecha límite, comentarios, adjuntos y **responsable**
  (asignación a un miembro, con filtro por persona).
- 5 columnas; drag & drop con orden exacto; mover el tablero arrastrando el fondo;
  archivar/restaurar/eliminar; buscador; export CSV (estilo Notion) y Copia JSON; importar (agrega).

## Modelo de datos

- `users` (email), `boards` (`is_personal` marca el personal), `board_members` (rol por tablero).
- `cards` pertenecen a un `board_id` y pueden tener `assignee_email`.
- Toda la API valida **membresía del tablero** (acceso ajeno → 403).
- **R2** (`tas-king-uploads`): los archivos subidos. Respaldo portable: **Copia JSON** (sin archivos de R2).

## Identidad / autenticación

- **Producción**: Cloudflare Access pone el login con Google delante de la app e inyecta
  `Cf-Access-Authenticated-User-Email`, que el Worker usa como identidad.
- El Worker crea el usuario y su tablero personal en el primer acceso (just-in-time).
- Pendiente de hardening: validar el JWT `Cf-Access-Jwt-Assertion`.
