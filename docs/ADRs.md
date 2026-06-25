# Architecture Decision Records (ADRs)

Documento vivo que registra decisiones arquitectónicas importantes: **qué**, **por qué**, **consecuencias**, y **cuándo cambió**.

Formato: [ADR0001](https://adr.github.io/) adaptado.

---

## ADR-001: Frontend sin build step (HTML/CSS/JS vanilla)

**Estado**: ✅ Aceptado y funcionando  
**Decidido**: Iteración 1  
**Último review**: 2026-06-23  

**Problema**
Queremos un frontend rápido de iterar, sin fricción de build, tooling o npm.

**Decisión**
Un único archivo `public/index.html` (~2000 líneas) con HTML + inline CSS + inline JS. Sin React, Vue, Webpack, Parcel.

**Consecuencias**
- ✅ **Ventajas**:
  - Cero build time, zero bundle size
  - Una sola request HTTP para todo (gzip ~8KB)
  - Fácil de debuggear (todo en un archivo)
  - Bajo barrier to entry (solo HTML/CSS/JS)
  - Funcionaría incluso sin npm (sirva estático)
  
- ❌ **Desventajas**:
  - Archivo único es más difícil de organizar conforme crece
  - Sin TypeScript = errores descubiertos en runtime
  - Sin hot reload out-of-the-box
  - Testing de UI es manual o requiere Playwright

**Alternativas consideradas**
- Svelte / React / Vue (compiladas): más overhead, no necesario
- Preact (micro): mejor que React, pero aún overhead

**Cuándo cambiar**
Si el archivo pasa 5000 líneas o si necesitamos TypeScript/HMR urgentemente, considerar Vite + Preact (mínimo overhead).

---

## ADR-002: Backend en Cloudflare Workers + Hono (no Node.js/Express)

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 2  
**Último review**: 2026-06-23  

**Problema**
Necesitamos API REST para multiusuario. Opciones: Node.js (caro/lento en startup), Deno (eco inmaduro), Cloudflare Workers (edge, barato).

**Decisión**
Cloudflare Workers con Hono micro-framework. Base de datos en D1 (SQLite). Storage en R2.

**Consecuencias**
- ✅ **Ventajas**:
  - Sub-100ms latency desde cualquier punto del mundo (edge)
  - Gratis hasta 100K requests/día
  - Bundled con D1 (SQLite) + R2 (storage)
  - Startup < 1ms (no cold-start lento)
  - Hono es tiny (~4KB) y rápido
  
- ❌ **Desventajas**:
  - Lenguaje limitado a JS/TS
  - Sin stateful connections (no WebSockets nativos, solo Durable Objects pagos)
  - Vendor lock-in a Cloudflare
  - Debugging más complejo (emulación local no es 100% fiel)

**Alternativas consideradas**
- Vercel / Next.js: JavaScript, pero serverless de Vercel es más caro
- AWS Lambda: más complejo, más caro en pequeña escala
- Railway / Render: buena DX, pero más caro que Workers

**Cuándo cambiar**
Si necesitamos:
- Base de datos relacional compleja (PostgreSQL) → considerar Railway
- WebSockets en tiempo real intensivo → agregar Durable Objects o cambiar a Node.js
- Múltiples runtimes (Python, Go) → cambiar a Docker (Railway, Render)

---

## ADR-003: OAuth Google en el Worker (no Cloudflare Access)

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 3  
**Último review**: 2026-06-23  

**Problema**
Necesitamos autenticación segura. Cloudflare Access (UI SSO) es simple pero no funciona en dominios `*.workers.dev` sin un dominio propio.

**Decisión**
Implementar OAuth 2.0 con Google directamente en el Worker:
- `/auth/login` → redirige a Google
- `/auth/callback` → valida código, crea sesión HMAC-firmada
- `/auth/logout` → limpia cookie

**Consecuencias**
- ✅ **Ventajas**:
  - Funciona en `*.workers.dev` sin config extra
  - Sesión self-contained (no depende de Access)
  - Relativamente simple (~200 líneas de código)
  - Se puede agregar fácilmente más providers (GitHub, etc.)
  
- ❌ **Desventajas**:
  - Más código de auth que delegar a Access
  - JWT de Google no se valida con rigor (solo se confía en OAuth)
  - Sin rate-limit nativo contra ataques de fuerza bruta
  - Secrets en el Worker (aunque protegidos por Cloudflare)

**Alternativas consideradas**
- Cloudflare Access: no funciona en *.workers.dev
- Auth0 / Okta: overhead, costo no necesario
- Magic links vía email: más fricción UX

**Cuándo cambiar**
Si compran dominio propio (ej: `app.ejemplo.com`) → podrían usar Cloudflare Access. Si necesitan 2FA/SAML → considerar Auth0.

**Mejoras futuras**
- Validar JWT de Google con rigor (backlog #5)
- Agregar rate-limiting en `/auth/callback`
- Implementar refresh tokens

---

## ADR-004: Allowlist de emails + admins en D1 (no solo Secrets)

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 4  
**Último review**: 2026-06-23  

**Problema**
Necesitamos que admins puedan agregar usuarios desde la UI sin tocar Cloudflare console. Pero también necesitamos un bootstrap inicial (primer admin).

**Decisión**
- **Tabla `allowed_emails`** en D1: lista de emails permitidos
- **Secret `ADMIN_EMAILS`**: bootstrap inicial (emails que son admin al primer login)
- **Columna `is_admin`** en `users`: persistente en D1
- **Panel admin**: UI para agregar/eliminar/promover desde la app

**Consecuencias**
- ✅ **Ventajas**:
  - Admin puede operar sin cli (better UX)
  - Auditable (quién agregó cada usuario, cuándo)
  - Fallback al Secret si tabla está vacía (compatibilidad)
  - Escalable: soporte para múltiples admins
  
- ❌ **Desventajas**:
  - 2 fuentes de verdad inicialmente (Secret + tabla) → confusión
  - Requiere migración D1 cada deploy
  - Sin audit log de cambios en permisos (aún)

**Alternativas consideradas**
- Solo Secret: no escalable, no auditable
- Solo tabla: necesitaba un way para hacer el bootstrap inicial (requiere UI antes de UI)

**Cuándo cambiar**
Nunca. El modelo es sólido. Cuando se agregue audit-log completo (backlog #1), registrar todos los cambios de permisos ahí.

---

## ADR-005: Multiusuario mediante email (no ID de usuario)

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 3  
**Último review**: 2026-06-23  

**Problema**
¿Cómo identificar usuarios en multiusuario?

**Decisión**
Email como PK en tabla `users`. Todos los FKs usan email (board_members.email, cards.assignee_email, comments.author_email).

**Consecuencias**
- ✅ **Ventajas**:
  - Email es único, verificado por OAuth
  - No necesito UUID + mapping
  - UI más legible (muestra email/nombre)
  
- ❌ **Desventajas**:
  - Si alguien cambia email en Google → necesito migración
  - Email puede ser largo en indexes
  - Invitar "usuario" = invitar por email (requiere que exista en Google primero)

**Alternativas consideradas**
- UUID de usuario: más flexible, pero overhead
- OAuth ID (sub claim): no se podría hacer multi-provider fácil

**Cuándo cambiar**
Si necesitan que usuarios se registren sin Google (crear su cuenta local) → cambiar a UUID + tabla de emails. Muy probablemente no será necesario.

---

## ADR-006: Import agrega, no reemplaza

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 3  
**Último review**: 2026-06-23  

**Problema**
¿Qué pasa al importar CSV si ya hay tarjetas?

**Decisión**
Import **siempre agrega**. Nunca reemplaza ni borra lo existente. Vista previa muestra "Tarjetas a importar: 5 nuevas" (no "5 actualizadas").

**Consecuencias**
- ✅ **Ventajas**:
  - Seguro (nunca pierdes datos)
  - Simple (no hay merge logic)
  - Esperado (append = predictable)
  
- ❌ **Desventajas**:
  - Si quieren actualizar tarjetas vía CSV, no pueden
  - Puede resultar en duplicados si no son cuidadosos

**Alternativas consideradas**
- Replace: destructivo, no recomendable
- Merge/update: complejo, edge cases

**Cuándo cambiar**
Probablemente nunca. Si piden "actualizar via CSV", pueden seguir usando UI.

---

## ADR-007: Tarjeta personal = no borrable (is_personal=1)

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 3  
**Último review**: 2026-06-23  

**Problema**
¿Qué pasa si un usuario borra su tablero personal?

**Decisión**
Tarjeta personal (`is_personal=1`) no puede borrarse. Si intentan DELETE, retorna 403.

**Consecuencias**
- ✅ **Ventajas**:
  - Siempre hay un lugar donde guardar tareas (safe)
  - Simplifica lógica (es_personal=1 = root board)
  
- ❌ **Desventajas**:
  - Usuario no tiene control total (no puede borrar todo)

**Alternativas consideradas**
- Permitir borrar: riesgoso (pérdida de datos)
- Soft-delete + restore: más complejo

**Cuándo cambiar**
Nunca. Es una buena decisión UX.

---

## ADR-008: Sin tests E2E para features visuales complejas (por ahora)

**Estado**: ⚠️ Aceptado con deuda técnica  
**Decidido**: Iteración 4  
**Último review**: 2026-06-23  

**Problema**
Celebración (confeti), polling, dark mode son difíciles de testear automáticamente en Playwright.

**Decisión**
Tests manuales + tests unitarios donde sea posible. Tests E2E solo para critical path (crear tarjeta, login, etc.).

**Consecuencias**
- ✅ **Ventajas**:
  - Tests corren rápido (solo 5 E2E)
  - No gastamos tiempo debuggeando Playwright
  - Tests son confiables (no flaky)
  
- ❌ **Desventajas**:
  - **Deuda técnica**: celebración no tiene test automático
  - Polling falta test de concurrencia
  - Dark mode se testea manualmente

**Cuándo cambiar**
**PRIORIDAD ALTA**: Agregar tests E2E para:
- Historial: visualizar eventos
- Polling: múltiples clientes ven cambios
- Celebración: confeti aparece
- Multiusuario: permisos funcionan

Backlog: #9 "E2E tests para features visuales"

---

## ADR-009: Secrets de Cloudflare en lugar de .env

**Estado**: ✅ Aceptado  
**Decidido**: Iteración 3  
**Último review**: 2026-06-23  

**Problema**
¿Cómo manejar credenciales seguras (OAuth, DB)?

**Decisión**
- **Producción**: Secrets de Cloudflare (`wrangler secret put`)
- **Local**: `.dev.vars` (no committear)
- **Nunca**: hardcodear en el código

**Consecuencias**
- ✅ **Ventajas**:
  - Secrets no en repo
  - Separación: producción != local
  - Seguro (Cloudflare encripta)
  
- ❌ **Desventajas**:
  - Secrets no son versionados (no hay "quién cambió qué")
  - No hay rotate automático

**Alternativas consideradas**
- 1Password / Vault: overhead
- .env.production: menos seguro

**Mejoras futuras**
- Audit log de cambios de secrets
- Rotate automático de SESSION_SECRET

---

## ADR-010: Historial de auditoría para multiusuario

**Estado**: ✅ Aceptado (Implementado en v1.3)  
**Decidido**: Iteración 4  
**Último review**: 2026-06-23  

**Problema**
En multiusuario, necesitamos saber quién hizo qué y cuándo.

**Decisión**
Tabla `audit_log` en D1 con eventos:
- card_created, card_edited, card_moved, card_deleted, card_archived, card_restored
- comment_added, attachment_added, label_applied, etc.
- Cada evento: quién, qué, cuándo, detalles (JSON)

**Consecuencias**
- ✅ **Ventajas**:
  - Auditable (compliance, debugging)
  - Base para notificaciones futuras
  - Historial visible en UI
  
- ❌ **Desventajas**:
  - Más writes a D1 (pequeño overhead)
  - Retención de datos: ¿cuándo limpiar logs viejos?

**Mejoras futuras**
- Purgar logs con más de N meses
- Notificaciones en tiempo real vía polling (ya existe)
- Panel de admin con filtros avanzados

---

## Cómo actualizar este documento

Cuando tomes una decisión arquitectónica **importante** (no cambios menores):

1. Crea nueva sección ADR-XXX
2. Completa: Problema → Decisión → Consecuencias → Alternativas → Cuándo cambiar
3. Marca como ✅ Aceptado, ⚠️ Deuda, o ❌ Rechazado
4. Linkedar desde donde sea relevante (código, ADR anterior, etc.)
5. En Último review, actualiza la fecha

**Cuándo crear ADR**
- Cambio que afecta múltiples componentes
- Trade-off no obvio (ej: performance vs. simplicity)
- Decisión que se puede revertir con costo (ej: cambiar DB)
- Decisión que otros devs necesitan entender

**Cuándo NOT crear ADR**
- Bug fixes (documentar en commits/PRs)
- Refactoring local (no afecta arquitectura)
- Cambios UI menores

---

## ADR-012: Internacionalización (i18n) — estrategia y criterio de migración

**Estado**: ✅ Aceptado (landing page) / 🗂️ Backlog (app completa)
**Decidido**: 2026-06-25
**Último review**: 2026-06-25

**Problema**
La landing page tiene visibilidad pública internacional. La app también podría necesitar i18n si los equipos son multilingüe o si el producto se distribuye a otras regiones.

**Decisión: landing page — traducciones inline en un único archivo**

Todas las traducciones (ES / EN / PT / DE) viven en un objeto `T` dentro del `<script>` de `public/landing.html`. Una función `applyLang(lang)` recorre los elementos `[data-i18n]` y actualiza su `innerHTML`.

Detección de idioma:
1. `localStorage.getItem('tasking-lang')` si el usuario ya eligió antes
2. `navigator.language` del browser como detección automática
3. Fallback a español

**Por qué inline y no archivos separados (para esta etapa)**
- La landing tiene ~35 strings × 4 idiomas = payload trivial (~3 KB)
- Sin requests adicionales al servidor → carga más rápida
- Sin dependencias externas ni build step
- Para páginas de marketing pequeñas, esta práctica es aceptada en la industria (incluso i18next lo permite)

**Cuándo NO es suficiente (criterios de migración)**
Migrar a archivos JSON separados + librería cuando se cumpla cualquiera de estos:
- Hay que internacionalizar la **app completa** (`index.html`, mensajes de backend, emails)
- Se superan **~100 strings por idioma** en la landing
- Se suma un **quinto idioma o más**
- Se quiere integrar con herramientas de traducción colaborativa (Crowdin, Lokalise, Weblate) — estas requieren archivos JSON

**Recomendación para la migración futura (app completa)**

Estructura de archivos:
```
public/
  locales/
    es.json
    en.json
    pt.json
    de.json
```

Carga dinámica al detectar idioma:
```javascript
const lang = detectLang();
const T = await fetch(`/locales/${lang}.json`).then(r => r.json());
```

Librería recomendada: **i18next** (estándar de facto, sin framework, ~13 KB gzip). Soporta plurales, interpolación, fechas y fallback a idioma base.

Para el backend (mensajes de error en `auth.js`, emails): leer el header `Accept-Language` y seleccionar strings desde un objeto de configuración similar.

**Consecuencias actuales**
- ✅ Zero dependencias, zero build, zero latencia extra en la landing
- ✅ Fácil de leer y mantener para equipos pequeños
- ⚠️ Las traducciones están mezcladas con el código (no ideal para traductores externos)
- ⚠️ Si crece mucho, el archivo HTML se hace difícil de mantener

**Cuándo cambiar**
Ver criterios de migración arriba. El cambio no es urgente: la landing actual es estable y el costo de migrar es bajo cuando llegue el momento porque el patrón `data-i18n` + `applyLang()` se mantiene igual — solo cambia de dónde vienen los strings.

---

## ADR-011: Validación de JWT de Google con RSA

**Estado**: ✅ Aceptado (Implementado en v1.5)  
**Decidido**: Iteración actual  
**Último review**: 2026-06-24  

**Problema**
En `/auth/callback`, se decodificaban los claims del `id_token` de Google pero **sin validar la firma**. Un atacante podría interceptar y modificar los claims (ej. cambiar `email` a otro usuario) sin ser detectado. El token podría también estar expirado.

**Decisión**
Implementar validación completa del JWT:
1. **Obtener public keys de Google**: descargar del endpoint `https://www.googleapis.com/oauth2/v1/certs` y cachear por 24h
2. **Verificar firma RSA**: usar `crypto.subtle.verify()` con clave pública y algoritmo RSASSA-PKCS1-v1_5
3. **Validar claims**:
   - `exp`: token no expirado
   - `iss`: issuer es `https://accounts.google.com`
   - `aud`: audience es nuestro `GOOGLE_CLIENT_ID`
   - `email_verified`: email fue verificado por Google

**Implementación** (`src/index.js`):
- `verifyGoogleJWT(idToken, expectedAudience)`: función que valida firma y claims
- `getGooglePublicKeys()`: descarga y cachea keys con TTL
- `pemToCryptoKey(pem)`: convierte certificado PEM a CryptoKey
- `base64urlToBytes(str)`: decodifica base64url (usado en JWT)
- En `/auth/callback`: usar `verifyGoogleJWT()` antes de aceptar email

**Consecuencias**
- ✅ **Ventajas**:
  - Token modificado será detectado (tampering protection)
  - Token expirado será rechazado
  - Token de otra app (aud incorrecto) será rechazado
  - Email no verificado será rechazado
  - Cumple OWASP: validación de identidad fuerte
  
- ❌ **Desventajas**:
  - Una request extra a Google al cachear keys (cada 24h)
  - Costo computacional de verificación RSA (bajo en Workers con crypto.subtle)
  - Si Google tiene outage en googleapis.com/oauth2/v1/certs, no hay keys en cache

**Alternativas consideradas**
1. **No validar firma** (estado anterior): fácil pero inseguro
2. **Validar solo con HTTP call a Google**: lento (llamada extra por login)
3. **Hardcodear keys públicas**: frágil (cambios de Google = código roto)

**Cuándo cambiar**
- Si Google depreca el endpoint de keys, usar otro endpoint
- Si en el futuro hay rate limiting de keys, aumentar TTL de cache
- Si hay problemas de performance, cachear más agresivamente (pero verificar keys con menos frecuencia)

---
