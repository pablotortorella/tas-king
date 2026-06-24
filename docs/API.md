# API Reference — FUN TasKing!

Documentación de endpoints REST. Base URL: `https://tas-king.pablotortorella.workers.dev`

En desarrollo local: `http://localhost:8787`

---

## Autenticación

Todos los endpoints (`/api/*`) requieren una sesión válida:

- **Producción**: Cookie `session` (HMAC-signed JWT, 30 días)
- **Local dev**: Header `X-Dev-User: email@example.com` O `.dev.vars` `DEV_USER_EMAIL`

Respuesta sin auth:
```json
{ "error": "No autenticado." }
```
Status: `401 Unauthorized`

---

## Auth Routes

Estas rutas **NO** requieren sesión previa.

### POST /auth/login
Inicia sesión con Google. Redirige a Google OAuth.

**Parámetros**: ninguno (se usan query params internos)
**Respuesta**: 302 redirect a Google

---

### GET /auth/callback
Callback de Google OAuth. Crea sesión.

**Parámetros**:
- `code` (query): código OAuth de Google
- `state` (cookie): CSRF token

**Respuesta**: 302 redirect a `/`

---

### GET /auth/logout
Borra sesión y redirige al login.

**Respuesta**: 302 redirect a `/auth/login`

---

## User Routes

### GET /api/me
Datos del usuario actual + lista de sus tableros.

**Autenticación**: Requerida  
**Respuesta** (200):
```json
{
  "email": "user@example.com",
  "isAdmin": true,
  "profile": {
    "name": "Usuario",
    "avatarEmoji": "🦊",
    "avatarColor": "#FF5733"
  },
  "boards": [
    {
      "id": "brd_123",
      "name": "Mi tablero",
      "isPersonal": true,
      "role": "owner",
      "ownerEmail": "user@example.com",
      "memberCount": 1
    }
  ]
}
```

---

### PUT /api/me
Actualiza perfil del usuario (nombre, avatar).

**Autenticación**: Requerida  
**Body**:
```json
{
  "name": "Nuevo nombre",
  "avatarEmoji": "🦒",
  "avatarColor": "#33FF57"
}
```

**Respuesta** (200): objeto actualizado

---

## Board Routes

### GET /api/boards/:boardId/cards
Obtiene todas las tarjetas del tablero.

**Autenticación**: Requerida + membresía  
**Parámetros**: 
- `boardId` (path): ID del tablero

**Respuesta** (200):
```json
{
  "version": 1686234567890,
  "cards": [
    {
      "id": "card_456",
      "title": "Título",
      "column": "pendiente",
      "details": "Detalles de la tarjeta",
      "due": "2026-12-31",
      "assignee": "otro@example.com",
      "archived": false,
      "comments": [ {...} ],
      "attachments": [ {...} ]
    }
  ]
}
```

**Errores**:
- `403`: No eres miembro de este tablero
- `404`: Tablero no existe

---

### GET /api/boards/:boardId/version
Devuelve versión (timestamp) del tablero. Útil para polling.

**Autenticación**: Requerida + membresía  
**Respuesta** (200):
```json
{
  "version": 1686234567890
}
```

---

### GET /api/boards/:boardId/members
Lista de miembros del tablero.

**Autenticación**: Requerida + membresía  
**Respuesta** (200):
```json
{
  "members": [
    {
      "email": "owner@example.com",
      "role": "owner",
      "name": "Owner",
      "avatarEmoji": "👤",
      "avatarColor": "#0079BF"
    }
  ]
}
```

---

### POST /api/boards
Crear tablero nuevo.

**Autenticación**: Requerida  
**Body**:
```json
{
  "name": "Nuevo tablero"
}
```

**Respuesta** (200): objeto tablero creado

---

### PATCH /api/boards/:boardId
Renombrar tablero.

**Autenticación**: Requerida + owner  
**Body**:
```json
{
  "name": "Nuevo nombre"
}
```

**Respuesta** (200): tablero actualizado  
**Errores**:
- `403`: No eres owner

---

### DELETE /api/boards/:boardId
Eliminar tablero (no funciona en personal).

**Autenticación**: Requerida + owner  
**Respuesta** (204): sin contenido

---

## Card Routes

### POST /api/boards/:boardId/cards
Crear tarjeta.

**Autenticación**: Requerida + membresía  
**Body**:
```json
{
  "title": "Mi tarjeta",
  "column": "pendiente",
  "details": "Detalles opcionales",
  "due": "2026-12-31"
}
```

**Respuesta** (200): tarjeta creada

---

### GET /api/cards/:cardId
Obtener una tarjeta (incluso de otro tablero, si tienes acceso).

**Autenticación**: Requerida + membresía del tablero de la tarjeta  
**Respuesta** (200): objeto tarjeta + `boardId`

**Errores**:
- `404`: Tarjeta no existe
- `403`: No tienes acceso (no eres miembro del tablero)

---

### PUT /api/cards/:cardId
Editar tarjeta.

**Autenticación**: Requerida + membresía  
**Body**:
```json
{
  "title": "Título nuevo",
  "column": "en_progreso",
  "details": "Nuevos detalles",
  "due": "2026-12-25",
  "assignee": "user@example.com"
}
```

**Respuesta** (200): tarjeta actualizada

---

### DELETE /api/cards/:cardId
Eliminar tarjeta permanentemente.

**Autenticación**: Requerida + membresía  
**Respuesta** (204): sin contenido

---

### POST /api/cards/:cardId/archive
Archivar tarjeta (la oculta pero no la borra).

**Autenticación**: Requerida + membresía  
**Respuesta** (200): tarjeta archivada

---

### POST /api/cards/:cardId/restore
Restaurar tarjeta archivada.

**Autenticación**: Requerida + membresía  
**Respuesta** (200): tarjeta restaurada

---

## Comment Routes

### POST /api/cards/:cardId/comments
Agregar comentario a una tarjeta.

**Autenticación**: Requerida + membresía  
**Body**:
```json
{
  "text": "Mi comentario"
}
```

**Respuesta** (200): comentario creado

---

### DELETE /api/cards/:cardId/comments/:commentId
Eliminar comentario.

**Autenticación**: Requerida + ser autor del comentario  
**Respuesta** (204): sin contenido

---

## Admin Routes

Todas requieren que seas admin (`is_admin=1`).

### GET /api/admin/users
Lista de emails permitidos y admins.

**Autenticación**: Requerida + admin  
**Respuesta** (200):
```json
{
  "allowed": [
    { "email": "user@example.com", "added_by": "admin@example.com", "added_at": "2026-06-23T10:00:00Z" }
  ],
  "admins": [
    { "email": "admin@example.com", "name": "Admin User" }
  ]
}
```

---

### POST /api/admin/allowed
Agregar email a la lista de permitidos.

**Autenticación**: Requerida + admin  
**Body**:
```json
{
  "email": "nuevo@example.com"
}
```

**Respuesta** (200): `{ "ok": true }`

---

### DELETE /api/admin/allowed/:email
Eliminar email de permitidos.

**Autenticación**: Requerida + admin  
**Respuesta** (200): `{ "ok": true }`

---

### POST /api/admin/set-admin
Promover o degradar usuario a admin.

**Autenticación**: Requerida + admin  
**Body**:
```json
{
  "email": "user@example.com",
  "isAdmin": true
}
```

**Respuesta** (200): `{ "ok": true }`

---

## Audit Log Routes

### GET /api/cards/:cardId/history
Historial de una tarjeta (últimos 100 eventos).

**Autenticación**: Requerida + membresía  
**Respuesta** (200):
```json
{
  "history": [
    {
      "action": "card_created",
      "email": "user@example.com",
      "ts": 1686234567890,
      "details": {}
    },
    {
      "action": "card_edited",
      "email": "user@example.com",
      "ts": 1686234568000,
      "details": { "title": "Viejo → Nuevo" }
    }
  ]
}
```

---

### GET /api/boards/:boardId/activity
Actividad del tablero (eventos globales, hasta 500).

**Autenticación**: Requerida + membresía  
**Query params** (opcionales):
- `email`: filtrar por usuario
- `action`: filtrar por tipo de evento (card_created, etc.)
- `since`: timestamp (ms) desde cuándo
- `until`: timestamp (ms) hasta cuándo

**Respuesta** (200): array de eventos

---

## Upload Routes

### POST /api/cards/:cardId/attachments
Subir archivo adjunto.

**Autenticación**: Requerida + membresía  
**Content-Type**: multipart/form-data  
**Body**: archivo en `file`

**Respuesta** (200):
```json
{
  "id": "att_789",
  "originalName": "documento.pdf",
  "mime": "application/pdf",
  "size": 12345,
  "url": "/uploads/uuid-random"
}
```

---

### DELETE /api/cards/:cardId/attachments/:attachmentId
Eliminar adjunto.

**Autenticación**: Requerida + membresía  
**Respuesta** (204): sin contenido

---

## Import/Export

### POST /api/boards/:boardId/import
Importar tarjetas desde CSV (agrega, no reemplaza).

**Autenticación**: Requerida + membresía  
**Content-Type**: multipart/form-data  
**Body**: archivo CSV en `file`

**Respuesta** (200):
```json
{
  "summary": "3 tarjetas a importar",
  "preview": [ ... ]
}
```

---

## Error Responses

Todos los errores devuelven JSON con `error`:

```json
{ "error": "Descripción del error" }
```

**Códigos comunes**:
- `400`: Bad request (parámetro faltante o inválido)
- `401`: No autenticado
- `403`: Autenticado pero sin permisos
- `404`: Recurso no existe
- `500`: Error interno del servidor

---

## Notas

- **Timestamps**: En milisegundos desde epoch (use `Date.now()` en JS)
- **Colores**: Formato hex (`#RRGGBB`)
- **Emails**: Siempre lowercase internamente
- **Campos opcionales**: Si no están en body, no se actualizan

---

## Ejemplos de curl

```bash
# Login (devuelve cookie)
curl -c cookies.txt "https://tas-king.pablotortorella.workers.dev/auth/login"

# Obtener usuario
curl -b cookies.txt "https://tas-king.pablotortorella.workers.dev/api/me"

# Crear tarjeta
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","column":"pendiente"}' \
  "https://tas-king.pablotortorella.workers.dev/api/boards/brd_123/cards"

# Local dev con DEV_USER_EMAIL
curl -H "X-Dev-User: test@example.com" \
  "http://localhost:8787/api/me"
```
