# HomeSuite App: contrato de plataforma

**Estado:** operativo en staging, sin recursos de producción

**Última actualización:** 2026-10-20

## Alcance

`apps/app` es el Worker autenticado de HomeSuite. En este corte ofrece identidad,
sesiones, grupos privados, membresías e invitaciones para Cuentas Claras. El
esquema y el dominio monetario preparan libros y movimientos auditables, pero no
hay todavía endpoints ni pantallas para registrar datos financieros.

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

Toda mutación autenticada bajo `/groups`, `/invitations` o `/auth/logout` exige:

1. una sesión vigente en D1;
2. un token CSRF firmado y ligado al ID de esa sesión;
3. un `Origin` del mismo origen o, como fallback, un `Referer` del mismo origen;
   si ambos están ausentes o la política `no-referrer` produce `Origin: null`,
   Fetch Metadata debe declarar `Sec-Fetch-Site: same-origin`.

Los formularios incluyen `_csrf`; clientes futuros pueden usar
`X-CSRF-Token`. La validación ocurre antes de leer o modificar datos de producto.
Las rutas `/local` y `/api/local` sólo existen con `DEV_LOCAL_MODE=true` y no se
habilitan en staging o producción.

## Autorización y privacidad

- `owner` puede renombrar el grupo y administrar invitaciones.
- `member` puede abrir el grupo después de aceptar una invitación.
- Toda ruta consulta la membresía en D1; la cookie no contiene permisos.
- Una persona ajena recibe 404 al consultar un grupo para no confirmar su
  existencia.
- Antes de aceptar, una invitación revela sólo grupo, nombre de quien invitó y
  que concede acceso a Cuentas Claras.
- Crear/renombrar grupos e invitar/cancelar/aceptar/rechazar quedan auditados.

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

## Protección operativa

- Los cuerpos mutables con `Content-Length` superior a 16 KiB se rechazan con
  413 antes de ejecutar un handler.
- OAuth usa un Rate Limiting binding por IP de 20 solicitudes por minuto.
- Las mutaciones autenticadas usan otro binding por sesión de 60 solicitudes por
  minuto. Un límite excedido devuelve 429, `Retry-After: 60` y request ID.
- Staging exige ambos bindings; si faltan, las rutas protegidas fallan cerradas.
- El cron diario de las 04:17 UTC vence invitaciones pendientes y elimina sólo
  sesiones vencidas o revocadas hace más de 30 días. No purga historia financiera.

## Recuperación y ciclo de vida

El deploy de staging ejecuta backup, migraciones y publicación en ese orden. Ver
[backup y recuperación](HOMESUITE_RECOVERY.md) y
[ciclo de vida de datos](HOMESUITE_DATA_LIFECYCLE.md). El 2026-10-20 se comprobó
un export previo a `0003` mediante una restauración D1 local aislada.

## Verificación y despliegue

```bash
npm run test:homesuite-app
npm run test:homesuite-app:integration
npm run test:e2e:homesuite-app
npm run deploy:homesuite-app:staging
```

El E2E inicia un Worker local en `127.0.0.1:8791` con D1 persistida bajo
`.wrangler/homesuite-app-e2e`. Cubre crear grupo, invitar, cancelar,
privacidad previa, aceptar/rechazar y aislamiento; las integraciones cubren
roles, auditoría, sesiones y CSRF.

Después de cada deploy de staging se verifica `/healthz`, cabeceras, redirect
OAuth y Version ID. La prueba manual con dos cuentas Google, completada el
2026-10-23, verificó:

1. la primera crea un grupo e invita el email exacto de la segunda;
2. la segunda entra en ventana separada y ve grupo y nombre del invitante, pero
   no participantes ni saldos;
3. rechaza una invitación y confirma que no obtuvo acceso;
4. recibe otra invitación, la acepta y abre el mismo grupo;
5. la cuenta invitada no pudo abrir la URL directa antes de aceptar y, después,
   accedió como integrante sin controles de titular.

La prueba descubrió que Chrome envía `Origin: null` en el formulario bajo
`Referrer-Policy: no-referrer`. El fix `130fc74` quedó cubierto por un E2E con
sesión real y se desplegó dentro de `4d9bfdc` como Version ID
`7098716d-2685-4371-a573-f890a7a5244e`.

El corte de preparación financiera se desplegó el 2026-10-20 desde `a0d9155`
como Version ID `cff2c319-b514-483f-aa49-c0b29e6b2169`. Se comprobaron health,
cabeceras, request ID, rechazo 413, OAuth con PKCE, cron, ambos rate limiters,
migración `0003`, ocho tablas financieras vacías y cero violaciones de foreign
keys. Producción no fue creada ni modificada.

## Pendiente antes de datos financieros reales

- endpoints transaccionales que consuman las invariantes e idempotencia ya
  definidas, con autorización y concurrencia optimista;
- exportación y eliminación administrada por grupo;
- backup externo y restore drill del ambiente productivo;
- rotación del secreto OAuth antes de declarar producción lista;
- monitoreo y alertas para cron, errores y backups.
