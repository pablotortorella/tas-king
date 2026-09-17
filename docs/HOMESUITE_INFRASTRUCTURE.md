# HomeSuite — infraestructura, dominios y repositorio

**Estado:** dominio, Universal SSL y DNSSEC activos; landing local lista para preview

**Fecha:** 2026-09-17

## Objetivo

Preparar dominio, DNS, certificados, repositorio y unidades de despliegue antes de
mover identidad, sesiones o datos. El resultado debe permitir construir HomeSuite
por etapas sin interrumpir TasKing ni convertir cada herramienta en un servicio
independiente prematuramente.

La idea central es:

> Un repositorio no implica un único Worker, y varios Workers no implican un
> microservicio por producto.

HomeSuite tendrá un monorepo, una superficie pública aislada y una aplicación
autenticada modular.

## Estado comprobado del dominio

Snapshot del 2026-09-17:

- `homesuite.info` está registrado en GoDaddy hasta el 2029-09-16.
- La zona fue incorporada a la cuenta Cloudflare que ya opera TasKing.
- Los nameservers asignados son:

  ```text
  irma.ns.cloudflare.com
  mack.ns.cloudflare.com
  ```

- GoDaddy recibió el cambio desde `ns43/ns44.domaincontrol.com` y resolvers
  públicos ya devolvían `irma` y `mack` al cerrar esta revisión.
- La zona figura activa y ambos nameservers de Cloudflare responden
  autoritativamente.
- Universal SSL figura activo y cubre `homesuite.info` y `*.homesuite.info`.
- DNSSEC está activo. El DS publicado en `.info` usa etiqueta `2371`, algoritmo
  `13` y digest SHA-256 (`2`); `1.1.1.1` devuelve la respuesta con bandera `ad`.
- Los registros importados corresponden al parking de GoDaddy:
  - dos registros `A` en el apex;
  - `www` como CNAME al apex;
  - `_domainconnect` de GoDaddy;
  - `_dmarc` con política de parking.
- No hay registros MX ni servicio de correo configurado.
- `app.homesuite.info` y `staging.homesuite.info` todavía no tienen contenido.
- Wrangler quedó autenticado en la cuenta Cloudflare correcta para operaciones
  posteriores de Workers.
- La rama local `feature/homesuite-landing` contiene `apps/site`, su change
  OpenSpec y pruebas aisladas en verde. Todavía no fue pusheada ni desplegada.
- El apex devuelve temporalmente error 525 porque los registros de parking de
  GoDaddy siguen proxificados. Se reemplazarán al asociar el Custom Domain; no se
  habilitó HSTS ni se aplicó una solución insegura como el modo Flexible.

Este snapshot no es una fuente dinámica. Antes de cualquier modificación se debe
volver a comprobar DNS y estado de la zona.

## Mapa de hostnames

### Hostnames aprobados

| Hostname | Propósito | Despliegue |
|---|---|---|
| `homesuite.info` | Sitio público y landings | `homesuite-site` |
| `www.homesuite.info` | Redirección 308 al apex | `homesuite-site` |
| `app.homesuite.info` | Suite autenticada de producción | `homesuite-app` |
| `staging.homesuite.info` | Suite autenticada de prueba | `homesuite-app-staging` |

Todos son apex o subdominios de primer nivel, cubiertos por Universal SSL de
Cloudflare una vez que la zona esté activa.

### Hostnames que no se crearán inicialmente

- `api.homesuite.info`
- `auth.homesuite.info`
- `tareas.homesuite.info`
- `gastos.homesuite.info`
- `compras.homesuite.info`
- subdominios anidados como `staging.app.homesuite.info`

API y productos se sirven por paths bajo `app.homesuite.info`. Esto conserva una
sesión host-only, evita CORS innecesario y reduce certificados y configuración.

```text
https://app.homesuite.info/
├── /tareas/*
├── /gastos/*
├── /compras/*
├── /auth/*
└── /api/*
```

No se reservarán hostnames mediante registros vacíos. Se crearán al asociarlos a
un Worker o cuando exista un destino real.

## Un monorepo, dos superficies

Se conservará un único repositorio para toda la suite. La estructura objetivo es:

```text
homesuite/
├── apps/
│   ├── site/
│   │   ├── public/
│   │   └── wrangler.jsonc
│   │
│   └── app/
│       ├── public/
│       │   ├── shell/
│       │   ├── tasks/
│       │   ├── expenses/
│       │   └── shopping/
│       ├── src/
│       │   ├── platform/
│       │   └── domains/
│       │       ├── tasks/
│       │       ├── expenses/
│       │       └── shopping/
│       ├── migrations/
│       └── wrangler.jsonc
│
├── packages/
│   └── shared/
├── docs/
├── test/
├── e2e/
└── package.json
```

`packages/shared` no debe convertirse en un depósito genérico. Solo recibirá
código efectivamente utilizado por más de una unidad de despliegue.

### Por qué un único repositorio

- identidad, shell y productos pueden evolucionar en un mismo PR;
- contratos de frontend, API y D1 quedan versionados juntos;
- una suite de pruebas detecta regresiones cruzadas;
- no se publican ni versionan paquetes internos innecesariamente;
- la migración de TasKing puede ser incremental;
- el trabajo sigue perteneciendo a un solo equipo y producto.

No se usarán submódulos Git. Un repositorio por producto solo se evaluará con
equipos, releases o requisitos de aislamiento realmente independientes.

## Unidades de despliegue

### `homesuite-site`

Worker de assets estáticos para:

- landing general;
- landings de Tareas, Gastos y Compras;
- privacidad, términos y novedades;
- redirección canónica de `www` al apex.

No tendrá:

- D1 o R2;
- OAuth o sesiones;
- secretos de la aplicación;
- APIs de producto;
- cookie de autenticación.

Separarlo reduce el radio de impacto y permite publicar contenido sin desplegar
la aplicación financiera.

### `homesuite-app`

Worker full-stack de producción para `app.homesuite.info`. Contendrá:

- assets y shell autenticado;
- OAuth y sesión;
- plataforma: usuarios, espacios, membresías e invitaciones;
- dominios Tasks, Expenses y Shopping;
- API Hono;
- bindings de D1, R2 y backups.

Es el **monolito modular**. Los productos no tendrán un Worker propio al inicio.

### `homesuite-app-staging`

Ejecuta el mismo código que producción, pero con hostname, secrets y recursos
separados. Staging no comparte D1, R2, backups ni cliente OAuth con producción.

La protección adicional de staging mediante Cloudflare Access se decidirá antes
de publicarlo. Access puede proteger el entorno, pero no sustituirá la identidad y
los permisos internos de HomeSuite.

## Recursos y convención de nombres

Objetivo de nombres, sujeto a comprobar disponibilidad antes de crear:

| Recurso | Producción | Staging |
|---|---|---|
| Worker app | `homesuite-app` | `homesuite-app-staging` |
| D1 | `homesuite-app-db` | `homesuite-app-db-staging` |
| R2 de archivos | `homesuite-app-files` | `homesuite-app-files-staging` |
| R2 de backups | `homesuite-app-backups` | `homesuite-app-backups-staging` |
| OAuth client | `HomeSuite Production` | `HomeSuite Staging` |

El Worker público es `homesuite-site` y no necesita variante staging al inicio;
los previews de rama o `workers.dev` alcanzan hasta que el sitio lo justifique.

Una D1 por entorno contiene inicialmente plataforma, Tareas, Gastos y Compras. Las
tablas y módulos mantienen fronteras claras. Separar bases por producto se hará
solo por escala, seguridad, retención o cadencia comprobadas.

## Ambientes

### Local

- Wrangler emula bindings localmente.
- Se conserva el bypass de identidad únicamente para localhost.
- No usa bases ni buckets remotos.
- OAuth real local es opcional; no debe ser requisito para ejecutar tests.

### Staging

- Hostname: `staging.homesuite.info`.
- Worker y recursos propios.
- Cliente OAuth propio.
- Datos sintéticos o explícitamente autorizados; no se copia producción por
  conveniencia.
- Todo cambio se prueba aquí antes de producción.

### Producción

- Hostname de app: `app.homesuite.info`.
- Recursos exclusivos.
- Deploy únicamente desde integración aprobada y después de staging.
- Backups restaurables fuera del bucket de archivos.

## OAuth y sesión

Se usarán dos clientes web dentro del proyecto Google Cloud correspondiente:

```text
HomeSuite Production
  https://app.homesuite.info/auth/callback

HomeSuite Staging
  https://staging.homesuite.info/auth/callback
```

Los client IDs y secrets no se comparten entre ambientes. El cliente actual de
TasKing permanece hasta completar la migración.

La cookie de producción será:

- exclusiva de `app.homesuite.info`;
- sin atributo `Domain`;
- `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`;
- preferentemente `__Host-homesuite_session`.

El sitio público no recibe esa cookie. El login admite un `returnTo` relativo y
validado; nunca una URL arbitraria.

## DNS, certificados y seguridad de zona

### Activación inicial

1. Esperar a que la delegación pública muestre `irma` y `mack`.
2. Confirmar que Cloudflare marque la zona como **Active**.
3. Verificar que los registros importados sigan respondiendo durante el cambio.
4. Esperar la emisión de Universal SSL.
5. No habilitar HSTS todavía.

### Limpieza de parking

Al asociar los Custom Domains:

- eliminar los dos `A` de parking del apex justo antes de asociar
  `homesuite.info` a `homesuite-site`;
- reemplazar el `CNAME www` mediante el Custom Domain o routing elegido;
- eliminar `_domainconnect` después de confirmar que ningún producto GoDaddy lo
  requiere;
- conservar `_dmarc` hasta decidir el servicio de correo y su política final.

No se debe dejar un hostname sin destino durante el corte. Se prepara y prueba el
Worker por `workers.dev`, luego se cambia el DNS o se asocia el Custom Domain.

### DNSSEC

DNSSEC se habilitó después de que la zona quedó activa, siguiendo este orden:

1. activar DNSSEC en Cloudflare;
2. copiar exactamente el registro DS generado;
3. agregar el DS en GoDaddy;
4. comprobar el DS desde resolvers públicos;
5. documentar algoritmo, digest y fecha.

Un DS incorrecto vuelve irresoluble el dominio; no se improvisa ni se activa en
ambos lados fuera de este orden.

Registro confirmado públicamente el 2026-09-17:

```text
homesuite.info. 3600 IN DS 2371 13 2
C97FB65EB7352A4B8C668FE46406A921A0FAFAA113EBC44A54C4C3E90F3B4233
```

### TLS y HSTS

- Universal SSL debe figurar activo para apex, `www`, `app` y `staging`.
- “Always Use HTTPS” puede activarse después de verificar certificados.
- HSTS, especialmente `includeSubDomains` y preload, se difiere hasta que todos
  los hostnames y flujos OAuth funcionen por HTTPS y exista rollback probado.
- No se crearán subdominios anidados que queden fuera de la cobertura Universal
  SSL prevista.

### Registrador

Mantener en GoDaddy:

- renovación automática;
- 2FA;
- protección de dominio;
- email de recuperación vigente;
- bloqueo de transferencia, salvo una operación explícita.

## Correo

HomeSuite no tiene correo configurado todavía. Hasta elegir proveedor:

- no crear MX, SPF o DKIM improvisados;
- conservar el DMARC importado como estado temporal;
- no habilitar Email Routing si no hay un caso de uso;
- definir por separado correo transaccional para invitaciones y correo humano.

Si se usa un subdominio de envío —por ejemplo `notify.homesuite.info`— deberá tener
SPF, DKIM, return-path y política DMARC coherentes. Esa decisión pertenece al
flujo de invitaciones, no a la activación básica del dominio.

## Secuencia de migración

1. ✅ Completar activación de la zona, Universal SSL y DNSSEC.
2. 🟡 Crear `apps/site` y desplegar una landing mínima en `workers.dev`: código y
   pruebas locales completos; preview remoto pendiente de autorización.
3. Asociar apex y `www` a `homesuite-site`; verificar HTTPS y redirección.
4. Crear el esqueleto de `apps/app` sin mover todavía TasKing.
5. Crear `homesuite-app-staging` y asociar `staging.homesuite.info`.
6. Crear recursos staging y cliente OAuth staging.
7. Validar shell, sesión e infraestructura en staging.
8. Crear recursos y cliente OAuth de producción.
9. Asociar `app.homesuite.info` a `homesuite-app`.
10. Migrar TasKing a `/tareas` sin retirar su URL actual.
11. Mantener ambas entradas durante una ventana de compatibilidad.
12. Renombrar el repositorio de `tas-king` a `homesuite` cuando no haya ramas o
    worktrees que compliquen la transición.
13. Retirar o redirigir `workers.dev` solo después de validar producción.

No se hará un big bang de dominio, repositorio, identidad y base de datos en un
mismo cambio.

## Flujo de repositorio y despliegue

El checkout principal sigue reservado para `main`. Cada cambio usa rama y worktree.
La raíz del monorepo ofrecerá scripts explícitos, cuando existan:

```text
npm run dev:site
npm run dev:app
npm run test
npm run test:e2e
npm run deploy:site
npm run deploy:app:staging
npm run deploy:app
```

El deploy de una unidad no debe publicar silenciosamente otra. Los cambios que
afecten contratos compartidos sí deben ejecutar las pruebas de toda la suite.

## Retoma después del refactor de TasKing

Estado local al cerrar el 2026-09-17:

- `docs/homesuite-foundation`: visión, MVP, infraestructura, DNSSEC y ADR-018;
- `feature/homesuite-landing`: change OpenSpec `crear-landing-homesuite` y
  `apps/site` implementado y probado;
- ambos worktrees están bajo `/tmp`, pero el trabajo está commiteado en refs Git
  locales y puede recrearse aunque desaparezcan esas carpetas;
- no se hizo push, deploy, asociación de Custom Domains ni cambio de registros
  de parking;
- la suite base de TasKing mostró inestabilidad E2E antes de crear la landing. El
  detalle está en `verification.md` dentro del change de la landing.

Cuando el refactor quede integrado:

1. actualizar `main` y confirmar que su suite completa vuelve a estar verde;
2. rebasar `docs/homesuite-foundation` sobre el nuevo `main`, revisar enlaces e
   integrar primero la documentación;
3. rebasar `feature/homesuite-landing` sobre ese `main` ya documentado y resolver
   únicamente conflictos reales —`apps/site` no debe mezclarse con `public/`,
   `src/` ni el `wrangler.jsonc` de TasKing—;
4. repetir:

   ```text
   openspec validate crear-landing-homesuite --strict
   npx vitest run --config apps/site/vitest.config.mjs
   npx playwright test --config apps/site/playwright.config.mjs
   npx wrangler deploy --dry-run --config apps/site/wrangler.jsonc
   npm run test:all
   ```

5. revisar el diff final, hacer push y abrir el PR correspondiente;
6. con autorización explícita, desplegar primero el preview `workers.dev` y
   revisarlo sin tocar el dominio;
7. con una segunda aprobación, retirar los registros de parking incompatibles y
   asociar `homesuite.info` y `www.homesuite.info` como Custom Domains;
8. verificar HTTPS, redirección 308, cabeceras, CTA a TasKing y desaparición del
   525; mantener HSTS desactivado;
9. actualizar `docs/STATUS.md`, este documento y archivar el change OpenSpec una
   vez que la landing esté efectivamente publicada.

## Cuándo separar repositorios o productos

Reevaluar el monorepo solo si aparece una señal concreta:

- equipos autónomos con ownership distinto;
- releases independientes que se bloquean entre sí regularmente;
- controles de acceso al código diferentes;
- requisitos regulatorios o de licencia incompatibles;
- tamaño o tiempos de CI que no pueden resolverse con selección de tests;
- un producto se independiza organizacionalmente de HomeSuite.

Separar un Worker o una D1 no obliga a separar el repositorio.

## Qué no hacer

- No apuntar `app.homesuite.info` al Worker actual de TasKing antes de registrar
  sus redirect URIs y adaptar rutas.
- No compartir cookies mediante `Domain=.homesuite.info`.
- No usar una base o bucket de producción desde staging.
- No habilitar DNSSEC antes de que Cloudflare sea autoritativo.
- No activar HSTS preload durante la migración.
- No crear CNAME manual para un Custom Domain sin asociarlo también al Worker.
- No borrar los registros de parking antes de tener un destino probado.
- No renombrar repositorio y recursos mientras haya trabajo activo que dependa de
  los nombres actuales.

## Criterios de infraestructura lista

La base de dominio estará resuelta cuando:

1. la zona figure activa en Cloudflare;
2. resolvers públicos devuelvan `irma` y `mack`;
3. DNSSEC valide correctamente;
4. `homesuite.info` responda desde `homesuite-site` por HTTPS;
5. `www` redirija de manera permanente al apex;
6. `staging.homesuite.info` llegue al Worker staging y no comparta recursos;
7. `app.homesuite.info` esté reservado o asociado sin exponer TasKing por error;
8. certificados y redirects estén verificados;
9. recursos y propietarios estén documentados;
10. el procedimiento de rollback conserve acceso a TasKing.

## Referencias

- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)
- [MVP de HomeSuite Gastos](HOMESUITE_GASTOS_MVP.md)
- [Cloudflare: configuración DNS primaria](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Cloudflare: Custom Domains de Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare: Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/)
- [Cloudflare: Static Assets en Workers](https://developers.cloudflare.com/workers/static-assets/)
- [GoDaddy: cambiar nameservers](https://www.godaddy.com/help/change-my-domain-nameservers-664)
