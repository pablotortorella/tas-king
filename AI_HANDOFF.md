# AI_HANDOFF

## Estado actual
**FUN TasKing!** es un tablero Kanban minimalista multiusuario, desplegado en producción en
https://tas-king.pablotortorella.workers.dev. El proyecto está activo y en iteración continua.

La iteración más reciente (esta sesión) agregó un **panel de administración** accesible desde
la UI: el admin puede agregar/eliminar usuarios permitidos y promover otros admins sin tocar
la consola. La lista de emails pasó de un Secret de Cloudflare (`ALLOWED_EMAILS`) a una tabla
`allowed_emails` en D1, con fallback al Secret para compatibilidad.

## Objetivo inmediato
El próximo ítem del backlog priorizado es el **#0: Deep-link a una tarjeta** — abrir la app
directamente en una tarjeta puntual vía URL (ej: `/?card=<id>`). Es un cambio chico (🟢).

El backlog completo está en `docs/backlog.txt`. Las ideas y contexto ampliado en `docs/ideas.txt`.

## Stack
- **Runtime**: Cloudflare Workers
- **Framework API**: Hono (JS)
- **Base de datos**: Cloudflare D1 (SQLite) — migraciones en `migrations/`
- **Almacenamiento de archivos**: Cloudflare R2 (`tas-king-uploads`)
- **Frontend**: HTML/CSS/JS vanilla en un único `public/index.html` (sin build)
- **Auth**: OAuth 2.0 con Google, implementado dentro del Worker. Cookie de sesión firmada con HMAC
- **Dev local**: `wrangler dev` con D1/R2 emulados. Usuario simulado vía `DEV_USER_EMAIL` en `.dev.vars`

## Decisiones tomadas
- **Un solo archivo de frontend**: `public/index.html` sin framework ni build step. Decisión
  deliberada para mantener simplicidad operativa.
- **Sin Cloudflare Access**: se intentó pero no funciona en subdominios `*.workers.dev`. Se
  implementó OAuth de Google directamente en el Worker.
- **Emails permitidos en D1**: la lista de acceso pasó del Secret `ALLOWED_EMAILS` a la tabla
  `allowed_emails`, para poder gestionarla desde la UI. El Secret se mantiene como fallback.
- **Admins configurables vía Secret `ADMIN_EMAILS`**: quienes forkeen el repo definen sus propios
  admins; no hay emails hardcodeados en el código.
- **Import agrega, no reemplaza**: la importación de tarjetas nunca pisa datos existentes.
- **Roles owner/member**: no hay "solo lectura". El tablero personal tiene `is_personal=1` y no
  se puede borrar.
- **Backfill de datos históricos**: la migración `0002` hardcodea `pablotortorella@gmail.com`
  para los datos previos al multiusuario — esto es específico de esta instancia.

## Archivos importantes
- `src/index.js`: Worker completo — API REST (Hono), OAuth Google, middlewares de auth y admin
- `public/index.html`: frontend completo — UI Kanban, modales, drag & drop, atajos de teclado
- `migrations/`: esquema D1 incremental (0001 init → 0004 admin)
- `wrangler.jsonc`: configuración de Workers, D1 y R2
- `.dev.vars`: variables locales (no commiteado — ver README para el formato)
- `docs/backlog.txt`: backlog priorizado
- `docs/ideas.txt`: ideas extendidas y contexto de decisiones de producto

## Comandos útiles
```bash
npm install                        # instalar dependencias
npm run dev                        # servidor local → http://localhost:8787
npm run db:migrate:local           # aplicar migraciones en D1 local
npm run db:migrate:remote          # aplicar migraciones en D1 producción
npm run deploy                     # build + deploy a Cloudflare Workers
npx wrangler secret put <NOMBRE>   # cargar un secret en producción
npx wrangler d1 execute tas-king --remote --command "SELECT ..."  # consulta SQL en prod
```

Hay tests unitarios y de API con Vitest ejecutándose en Workerd con D1/R2 emulados, más tests
E2E con Playwright. `npm run test:all` ejecuta la suite completa. La estrategia y el checklist
manual complementario para IAs y personas están en `TESTING.md`.

## Pendientes
Ver `docs/backlog.txt` para la lista priorizada. En orden:
- [ ] #0 🔗 Deep-link a una tarjeta (abrir app en tarjeta puntual vía URL)
- [x] ⚡ Polling de cambios en tiempo real (cada 5s, pausa en segundo plano)
- [x] 🎉 Celebración al terminar (confeti + tarjeta titilante)
- [ ] #1 📜 Historial de actividad (dentro de la tarjeta + panel lateral por tablero)
- [ ] #2 🏷️ Etiquetas de colores + filtro + página de AYUDA (F1) con todos los atajos
- [ ] #3 ✅ Checklists / subtareas dentro de una tarjeta
- [ ] #4 🔐 Proteger adjuntos (hoy `/uploads` son URLs públicas con UUID)
- [ ] #5 🛡️ Validar JWT de Google con rigor (hardening del login)
- [ ] #6 🌙 Modo oscuro/claro
- [ ] #7 🖼️ Mejores adjuntos (pegar imágenes, vista previa, reordenar)
- [ ] #8 💾 Respaldo automático programado del tablero

## No hacer
- No usar Cloudflare Access (no funciona en `*.workers.dev` sin dominio propio)
- No introducir un framework JS ni paso de build en el frontend (decisión de producto)
- No reemplazar datos al importar (import siempre agrega)
- No hardcodear emails de usuarios/admins en el código fuente
- No commitear `.dev.vars` (está en `.gitignore` — contiene credenciales)
- No borrar el tablero personal de un usuario (`is_personal=1`)

## Último handoff (2026-06-23, Claude Sonnet 4.6)
**Sesión de testing automatizado (Codex)**: se agregó Vitest con la integración oficial de
Cloudflare Workers, tests de API contra D1/R2 emulados, Playwright para recorridos críticos,
CI en GitHub Actions y `TESTING.md` con la estrategia manual complementaria. El deep-link sigue
pendiente; sus casos E2E están definidos como requisito para cuando se implemente.

**Sesión 1**: Panel de administración completo (tabla `allowed_emails` en D1, Secret `ADMIN_EMAILS`, UI con agregar/eliminar/promover admins) + README actualizado + creados `CLAUDE.md` y `AI_HANDOFF.md`.

**Sesión 2** (continuación): 
- Polling de cambios en tiempo real: endpoint `/api/boards/:id/version` devuelve el MAX(updated_at) de tarjetas; cliente consulta cada 5s, recarga si hay cambios, pausa en segundo plano
- Celebración al terminar una tarea: confeti animado en pantalla + tarjeta titilante con colores transiciones (naranja, rosa, verde, azul, amarillo); se dispara tanto al arrastrar localmente como vía polling para otros usuarios
- Instrucción `CLAUDE.md`: solo actualizar handoff cuando Pablo lo pida explícitamente (no automático)

## Handoffs anteriores
**Sesión 2026-06-23 (Claude Sonnet 4.6)**:
- Se subió la carpeta `docs/` al repo (contexto compartido entre IAs y humanos)
- Se habilitaron dos nuevos usuarios en producción: `florenciatortorella@gmail.com` y
  `leonardo.agudelo@kleer.la` (vía Secret `ALLOWED_EMAILS`)
- Se implementó el **panel de administración** completo:
  - Migración `0004_admin.sql`: tabla `allowed_emails` + columna `is_admin` en `users`
  - Backend: endpoints `/api/admin/users`, `/api/admin/allowed` (GET/POST/DELETE),
    `/api/admin/set-admin`; middleware `requireAdmin`; helpers `isEmailAllowed` y
    `seedAdminIfNeeded`
  - Frontend: botón "⚙ Admin" en header (solo para admins), modal con lista de usuarios,
    agregar/eliminar, checkbox de promoción a admin
  - Deploy a producción + seed de los 5 emails existentes en `allowed_emails`
  - Secret `ADMIN_EMAILS=pablotortorella@gmail.com` cargado en producción
- Se actualizó el README con instrucciones completas de setup (OAuth, secrets, primer admin)
- Se creó este archivo `AI_HANDOFF.md`
