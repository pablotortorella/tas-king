# FUN TasKing! 👑

Tablero Kanban minimalista **multiusuario** sobre **Cloudflare**: Workers + Hono para la
API, **D1** (SQLite) para los datos y **R2** para los archivos. El frontend es un único
`public/index.html` sin build. Cada persona entra con su cuenta de Google (OAuth directo
en el Worker), tiene su tablero personal y puede crear tableros compartidos.

## Requisitos

- Node.js 18+
- Wrangler 4 (instalado como dependencia de desarrollo)
- Cuenta de Cloudflare (para el deploy)
- Proyecto OAuth de Google (para el login)

## Desarrollo local

`wrangler dev` emula D1 y R2 en tu máquina (no toca tu cuenta de Cloudflare):

```bash
npm install
npm run db:migrate:local     # aplica todas las migraciones en la D1 local
npm run dev                  # → http://localhost:8787
```

## Tests

El proyecto tiene tests unitarios y de API con Vitest dentro del runtime de Cloudflare, usando
D1/R2 emulados, y recorridos de navegador con Playwright:

```bash
npm test                     # unitarios + API
npx playwright install chromium  # solo la primera vez
npm run test:e2e             # navegador + wrangler dev
npm run test:all             # suite completa
```

La cobertura, los criterios para agregar casos y el checklist manual complementario para IAs y
personas están en [`TESTING.md`](TESTING.md).

**Usuario simulado en local**: el usuario se define en `.dev.vars` (`DEV_USER_EMAIL`).
Para probar varios usuarios, mandá el header `X-Dev-User: otra@persona.com` en tus requests.

Ejemplo de `.dev.vars`:

```
DEV_USER_EMAIL=tu@email.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=dev-secret-local
ALLOWED_EMAILS=tu@email.com
ADMIN_EMAILS=tu@email.com
```

## Deploy a Cloudflare (una vez)

```bash
npx wrangler login

# 1) Crear la base D1 y pegar el database_id que devuelve en wrangler.jsonc
npx wrangler d1 create tas-king

# 2) Crear el bucket R2 para los adjuntos
npx wrangler r2 bucket create tas-king-uploads

# 3) Aplicar el esquema en la base remota
npm run db:migrate:remote

# 4) Configurar los secrets (ver sección de autenticación más abajo)

# 5) Publicar
npm run deploy               # queda en https://tas-king.<subdominio>.workers.dev
```

## Autenticación y control de acceso

El login usa **OAuth de Google** implementado directamente en el Worker (rutas
`/auth/login`, `/auth/callback`, `/auth/logout`). La sesión se guarda en una cookie
firmada con HMAC.

### Secrets de Cloudflare requeridos

Configurar con `npx wrangler secret put <NOMBRE>`:

| Secret | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth de Google |
| `GOOGLE_CLIENT_SECRET` | Secret del cliente OAuth de Google |
| `SESSION_SECRET` | Clave aleatoria para firmar las cookies de sesión |
| `ADMIN_EMAILS` | Emails de los administradores iniciales (separados por coma) |
| `ALLOWED_EMAILS` | Lista de emails permitidos inicial (opcional, ver más abajo) |

### Configurar el proyecto OAuth de Google

1. Ir a [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Crear un **OAuth 2.0 Client ID** de tipo "Web application"
3. Agregar como URI de redirección autorizada: `https://<tu-worker>.workers.dev/auth/callback`
4. Copiar el Client ID y Secret y cargarlos como secrets del Worker

### Configurar el primer administrador

El primer paso para poder operar la app desde la UI es definir al menos un admin:

```bash
echo "tu@email.com" | npx wrangler secret put ADMIN_EMAILS
```

La próxima vez que ese usuario inicie sesión, verá el botón **⚙ Admin** en el header
y podrá agregar o eliminar usuarios permitidos y promover otros admins, sin necesidad
de volver a la consola.

Para configurar la lista inicial de usuarios permitidos podés usar `ALLOWED_EMAILS`
(separados por coma) o agregarlos directamente desde el panel de administración.

> **Nota para proyectos fork**: cada quien que despliega su propia instancia define
> sus propios admins vía `ADMIN_EMAILS`. No hay emails hardcodeados en el código.

## Estructura

```
wrangler.jsonc        # config de Workers, D1 y R2
src/index.js          # Worker (Hono): API + OAuth + servido de /uploads
migrations/           # esquema D1
public/index.html     # frontend
test/                 # tests unitarios y de API (Vitest + Workers)
e2e/                  # recorridos críticos de navegador (Playwright)
TESTING.md             # estrategia automatizada y manual
```

## Funcionalidades

- **Multiusuario**: tablero personal automático + tableros compartidos (crear, invitar
  por email, roles dueño/miembro).
- **Tarjetas**: título, detalles, fecha límite, comentarios, adjuntos y **responsable**
  (asignación a un miembro, con filtro por persona).
- **Perfiles**: nombre y avatar (emoji + color) editables desde el header.
- 5 columnas; drag & drop con orden exacto; mover el tablero arrastrando el fondo;
  archivar/restaurar/eliminar; buscador; export CSV y Copia JSON; importar (agrega).
- **Atajos de teclado**: `F` mis tareas · `U` urgentes · `N` nueva tarjeta.
- **Panel de administración**: agregar/eliminar usuarios y promover admins desde la UI.

## Modelo de datos

- `users` (email, nombre, avatar, `is_admin`), `boards` (`is_personal`), `board_members` (rol).
- `cards` pertenecen a un `board_id` y pueden tener `assignee_email`.
- `allowed_emails`: lista de emails con acceso permitido (gestionada desde el panel admin).
- Toda la API valida **membresía del tablero** (acceso ajeno → 403).
- **R2** (`tas-king-uploads`): archivos adjuntos. Respaldo portable: **Copia JSON**.
