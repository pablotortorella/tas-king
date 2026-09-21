## Why

`homesuite.info` ya está delegado a Cloudflare, pero todavía responde mediante los
registros de parking importados de GoDaddy. HomeSuite necesita una primera
presencia pública intencional que confirme el dominio, explique la idea de suite
y permita entrar a Fun TasKing sin acoplarse al Worker autenticado actual.

El sitio público debe poder evolucionar y desplegarse sin tocar TasKing, sus
sesiones, su base de datos ni el refactor de frontend que está en curso.

## What Changes

- Se agrega `apps/site`, una unidad de despliegue independiente llamada
  `homesuite-site`.
- La portada presenta HomeSuite, enlaza al Fun TasKing existente y muestra Gastos
  y Compras como herramientas en preparación.
- El sitio no usa JavaScript, cookies, analytics, OAuth, D1, R2 ni secretos.
- El Worker sirve los assets, agrega cabeceras de seguridad y redirige
  `www.homesuite.info` al dominio raíz con estado 308.
- Se agregan pruebas unitarias del Worker y pruebas E2E de contenido,
  accesibilidad básica, enlace de salida y adaptación móvil.

### Non-goals

- Definir la identidad visual definitiva de HomeSuite.
- Implementar Gastos, Compras, autenticación o el shell de la aplicación.
- Mover Fun TasKing a `app.homesuite.info` o modificar su código actual.
- Configurar correo, analytics o consentimiento de cookies.
- Asociar los Custom Domains o desplegar a producción sin aprobación explícita.

## Capabilities

### New Capabilities

- `landing-publica-homesuite`: presencia pública de la suite, catálogo inicial de
  herramientas y acceso a Fun TasKing.

### Modified Capabilities

<!-- Ninguna. La landing es una unidad nueva y no modifica TasKing. -->

## Impact

**Código:** sólo archivos nuevos bajo `apps/site` y este change de OpenSpec.

**Infraestructura:** un Worker nuevo, sin bindings persistentes. En una fase
posterior se asociarán `homesuite.info` y `www.homesuite.info` y se retirarán los
registros de parking que hoy ocupan esos hostnames.

**Riesgo:** bajo y aislado. La principal operación sensible es el corte de DNS,
que queda fuera de este change hasta probar primero una URL `workers.dev` y
recibir aprobación.
