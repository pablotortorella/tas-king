# ADR-015 — Revocación de acceso efectiva para sesiones ya iniciadas

**Fecha**: 2026-09-07
**Estado**: ✅ Aceptado e implementado
**Autores**: Pablo Tortorella + Claude Sonnet 5

---

## Contexto

`allowed_emails` es la lista global de quién puede usar la app (gestionada desde ⚙ Admin). Hasta ahora solo se chequeaba en el callback de OAuth (`/auth/callback`), al emitir la cookie de sesión firmada. Una vez emitida, la cookie es válida hasta 30 días — el middleware de auth (`createAuthMiddleware`) solo verificaba que la firma HMAC fuera válida y no hubiera expirado, sin re-chequear si el email seguía permitido.

**Riesgo**: sacar a alguien desde el panel admin no le cortaba el acceso — seguía pudiendo usar la app hasta que su cookie expirara. Grave si la remoción responde a un incidente puntual (ver hallazgo 🔴 crítico en `docs/PRODUCT_BACKLOG.md`, análisis técnico 2026-07-07).

---

## Decisión

Re-chequear `isEmailAllowed()` en cada request autenticado, pero **solo cuando la identidad viene de una cookie de sesión real** (login con Google) — no cuando viene del bypass de desarrollo/tests (`X-Dev-User` / `DEV_USER_EMAIL`).

Se agregó `resolveSessionEmail(c)` (variante de `resolveEmail()` que nunca cae al bypass) y `checkAccessRevoked(c, sessionEmail)`, que:
1. Re-chequea `isEmailAllowed()` para ese email.
2. Si ya no está permitido: borra la cookie de sesión (`deleteCookie`) y responde `403 { code: "access_revoked" }`.

Aplicado en dos lugares — los dos únicos puntos que resuelven autenticación en esta app:
- `createAuthMiddleware()` (todo `/api/*`).
- `GET /uploads/:key` (vive fuera de `/api/*`, resuelve su propia autenticación — sin este fix quedaba como gap silencioso: alguien revocado podía seguir descargando adjuntos).

El frontend centraliza la reacción en la función `api()` (desde ADR-017, en `public/js/core/api.js`; antes inline en `public/index.html`) (el único punto por el que pasan todas las llamadas, incluido el polling de fondo): al ver `code: "access_revoked"` navega a `/revoked` y **no resuelve la promesa** — evita que algún `catch` de arriba llegue a mostrar un `alert()` con el error a mitad de la redirección. `/revoked.html` es una página estática nueva con el mensaje ("tu acceso fue revocado... tus tableros no se borraron...") y un link para reintentar el login.

### Por qué no aplicar el chequeo al bypass de dev/tests

`X-Dev-User`/`DEV_USER_EMAIL` ya está gateado por `isLocalRequest()` (el hostname debe ser `localhost`/`127.0.0.1` — inerte en producción real, donde el hostname es siempre el dominio público). Es un mecanismo de conveniencia para desarrollo local y para que los ~10 archivos de tests unitarios autentiquen con emails sintéticos (`owner@test.local`, `outsider@test.local`, etc.) que nunca tuvieron por qué estar en `allowed_emails`. Aplicarles el mismo chequeo hubiera roto toda la suite existente sin aportar seguridad real (ese bypass no es alcanzable desde internet).

### Alternativas descartadas

- **Cachear `isEmailAllowed()` unos minutos** para reducir el costo de una query D1 extra por request: se descartó por ahora — es una sola query indexada por PK (`allowed_emails.email`), y la revocación instantánea vale más que el ahorro. Si el overhead de D1 por request se vuelve un problema (hay un hallazgo relacionado en el backlog), se puede revisar junto con esa optimización más amplia.
- **Invalidar todas las sesiones activas de un email al revocarlo** (vía una tabla de sesiones o un `token_version` en el usuario): más robusto (cortaría el acceso sin depender de que el usuario haga otro request), pero es un cambio de modelo más grande. El chequeo por request ya corta el acceso en el próximo poll (≤5s) mientras la sesión está activa, y de inmediato en cualquier acción nueva — suficiente para el caso de uso actual.

---

## Consecuencias

- Revocar acceso desde ⚙ Admin ahora es efectivo en segundos, no en hasta 30 días.
- 1 query D1 extra (`SELECT 1 FROM allowed_emails WHERE email = ?`) por request autenticado vía cookie real — no aplica a los tests ni al dev local.
- Nueva página pública `/revoked` (mismo patrón visual que `/landing`, `/releases`, `/terminos`).
- Tests: `test/access-revocation.test.js` (backend, con una cookie de sesión real firmada en el test) + `e2e/access-revoked.spec.js` (frontend, redirección en la carga inicial y desde el poll de fondo, con la respuesta interceptada vía `page.route`).
