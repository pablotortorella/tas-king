# HomeSuite App: contrato de plataforma

**Estado:** operativo en staging, sin recursos de producción

**Última actualización:** 2026-10-20

## Alcance

`apps/app` es el Worker autenticado de HomeSuite. En este corte ofrece identidad,
sesiones, espacios privados, membresías e invitaciones para Cuentas Claras. No
contiene todavía movimientos, saldos, archivos, correo ni importaciones.

El sitio público `homesuite-site`, TasKing y HomeSuite App no comparten Worker,
cookie, D1 ni secretos. Staging usa además un cliente OAuth propio.

## Identidad y sesión

- Google OAuth Authorization Code es el único proveedor inicial.
- La identidad estable es el claim `sub`; el email verificado se usa como dato de
  contacto y para descubrir invitaciones.
- El flujo valida firma RS256, issuer, audience, `azp`, expiración, nonce y
  `email_verified`, y usa PKCE S256 con `code_verifier`.
- La sesión vive en D1 durante 14 días y la cookie firmada
  `__Host-homesuite_session` es `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` y
  no declara `Domain`.
- Cerrar sesión revoca la fila de D1 y expira la cookie.

Los scopes actuales son únicamente `openid email profile`. No se solicita acceso
a Gmail, Drive, Calendar ni otros datos de Google.

## Mutaciones y CSRF

Toda mutación autenticada bajo `/spaces`, `/invitations` o `/auth/logout` exige:

1. una sesión vigente en D1;
2. un token CSRF firmado y ligado al ID de esa sesión;
3. un `Origin` del mismo origen o, como fallback, un `Referer` del mismo origen.

Los formularios incluyen `_csrf`; clientes futuros pueden usar
`X-CSRF-Token`. La validación ocurre antes de leer o modificar datos de producto.
Las rutas `/local` y `/api/local` sólo existen con `DEV_LOCAL_MODE=true` y no se
habilitan en staging o producción.

## Autorización y privacidad

- `owner` puede renombrar el espacio y administrar invitaciones.
- `member` puede abrir el espacio después de aceptar una invitación.
- Toda ruta consulta la membresía en D1; la cookie no contiene permisos.
- Una persona ajena recibe 404 al consultar un espacio para no confirmar su
  existencia.
- Antes de aceptar, una invitación revela sólo espacio, nombre de quien invitó y
  que concede acceso a Cuentas Claras.
- Crear/renombrar espacios e invitar/cancelar/aceptar/rechazar quedan auditados.

## Ambientes

| Ambiente | Hostname | Worker | D1 |
|---|---|---|---|
| Local | `127.0.0.1` | Wrangler local | emulada |
| Staging | `staging.homesuite.info` | `homesuite-app-staging` | `homesuite-app-db-staging` |
| Producción | `app.homesuite.info` | pendiente | pendiente |

Staging contiene sólo datos sintéticos o autorizados. Producción no se crea ni se
publica sin aprobación explícita.

## Observabilidad

Staging tiene Workers Observability habilitado con muestreo `1`. Cada respuesta
incluye `X-Request-Id`; los errores estructurados registran evento, request ID,
método, path y tipo de error. No se registran cookies, códigos OAuth, tokens,
emails ni cuerpos de solicitudes.

En el panel en español: **Workers y Pages → homesuite-app-staging →
Observabilidad → Logs**. Un error mostrado al usuario puede correlacionarse por
`X-Request-Id`.

## Verificación y despliegue

```bash
npm run test:homesuite-app
npm run test:homesuite-app:integration
npm run test:e2e:homesuite-app
npm run deploy:homesuite-app:staging
```

El E2E inicia un Worker local en `127.0.0.1:8791` con D1 persistida bajo
`.wrangler/homesuite-app-e2e`. Cubre crear espacio, invitar, cancelar,
privacidad previa, aceptar/rechazar y aislamiento; las integraciones cubren
roles, auditoría, sesiones y CSRF.

Después de cada deploy de staging se verifica `/healthz`, cabeceras, redirect
OAuth y Version ID. La prueba manual pendiente requiere dos cuentas Google:

1. la primera crea un espacio e invita el email exacto de la segunda;
2. la segunda entra en ventana separada y ve espacio y nombre del invitante, pero
   no participantes ni saldos;
3. rechaza una invitación y confirma que no obtuvo acceso;
4. recibe otra invitación, la acepta y abre el mismo espacio;
5. una tercera identidad o una cuenta no invitada no puede abrirlo.

## Pendiente antes de datos financieros reales

- modelo monetario e idempotencia del change financiero;
- límites de payload y rate limiting;
- política de retención, exportación y eliminación;
- procedimiento de backup y restauración ensayado;
- limpieza de sesiones expiradas y revocación global;
- rotación del secreto OAuth antes de declarar producción lista.
