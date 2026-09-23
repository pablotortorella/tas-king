# HomeSuite — infraestructura, dominios y repositorio

**Estado:** sitio público en producción; app autenticada y migración de TasKing pendientes

**Fecha:** 2026-09-21

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

Snapshot histórico del 2026-09-17, previo a la publicación de la landing:

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
- En ese momento, el apex devolvía 525 por el parking de GoDaddy proxificado.
  No se habilitó HSTS ni se aplicó una solución insegura como el modo Flexible.

### Estado operativo actual (2026-09-21)

- `homesuite.info` y `www.homesuite.info` son Custom Domains de `homesuite-site`.
  El Worker se desplegó desde `main` SHA `f8cb9b6`, Version ID
  `48847d8f-86de-4b18-b2ad-def62e348bba`; `workers.dev` sigue habilitado.
- El apex responde 200 por HTTPS, con cabeceras de seguridad y los cuatro assets
  esperados. `www` responde 308 al apex conservando path y query. El antiguo 525
  desapareció. El CTA a Fun TasKing apunta a su URL productiva, que responde 200.
- Se retiraron sólo los dos A de parking del apex (`15.197.148.33` y
  `3.33.130.190`) y el CNAME `www` → apex. `_domainconnect` y `_dmarc` se
  conservaron; no se configuró correo ni se activó HSTS.
- `1.1.1.1` devolvió la respuesta A del apex con bandera `ad` después del corte:
  DNSSEC sigue validando.
- TasKing continúa en su Worker original; todavía no existe una app autenticada
  bajo `app.homesuite.info` ni staging de HomeSuite.

Este estado es un snapshot, no una fuente dinámica. Antes de otra modificación
se debe volver a comprobar DNS, certificados y Worker.

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
├── /cuentas-claras/*
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
- landings de Tareas, Cuentas Claras y Compras;
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

El Worker público es `homesuite-site` y no necesita variante staging al inicio.
Su URL principal en `workers.dev` sirve la versión publicada, no es staging;
para revisar una versión remota antes de publicarla se usaría una URL de preview
asociada a esa versión.

Una D1 por entorno contiene inicialmente plataforma, Tareas, Cuentas Claras y Compras. Las
tablas y módulos mantienen fronteras claras. Separar bases por producto se hará
solo por escala, seguridad, retención o cadencia comprobadas.

## Ambientes

### Decisión para el sitio público y la futura app (2026-09-21)

- **Hoy:** `homesuite.info` y `www.homesuite.info` sirven `homesuite-site` en
  producción. Desde 2026-09-23, `staging.homesuite.info` está asociado al
  Worker aislado `homesuite-app-staging`, con la D1 exclusiva
  `homesuite-app-db-staging` (`7d270a78-adbb-45fc-b5fc-7550c547af68`). Tiene
  un `SESSION_SECRET` exclusivo, almacenado fuera de Git; aún no tiene cliente
  OAuth ni sus secretos de Google. `qa.homesuite.info` sigue sin uso.
  El staging existente de TasKing es propio de la aplicación anterior; no
  equivale a este staging de HomeSuite.
- **Sitio público:** revisión visual local primero; tras aprobación, pruebas,
  integración y deploy del sitio. Si hace falta compartir una versión remota
  previa, usar una URL de preview por versión de Cloudflare Workers. No asumir
  que la URL principal `homesuite-site.*.workers.dev` es un preview aislado.
  Los previews pueden ser públicos: no incluir datos privados ni secretos.
- **App autenticada:** reservar `staging.homesuite.info` para
  `homesuite-app-staging`, con D1, R2, secrets y cliente OAuth propios. Crear
  ese entorno antes de probar allí sesiones, datos o migraciones, y pasar a
  producción sólo después de validarlo. No apuntar ese hostname al sitio
  público provisionalmente.
- **Si el sitio necesita una URL de QA estable:** evaluar un Worker separado y
  `preview.homesuite.info`, protegido con Access si corresponde. No crear un
  segundo entorno permanente sólo por conveniencia de nomenclatura; revisar
  esta decisión cuando haya revisiones remotas frecuentes.

Esta decisión distingue revisión local, preview de una versión y staging con
recursos independientes. `qa.homesuite.info` no tiene uso asignado por ahora.

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
2. ✅ Crear `apps/site` y desplegar la landing en `workers.dev`.
3. ✅ Asociar apex y `www` a `homesuite-site`; HTTPS y redirección verificados.
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

## Retoma operativa después de publicar la landing

Estado comprobado el 2026-09-21:

- Los PRs #48 (fundamentos), #49 (landing) y #50 (Custom Domains) están
  integrados en `main`. `apps/site` y su `wrangler.jsonc` siguen separados de
  `public/`, `src/` y el Worker de TasKing.
- El preview se publicó primero y se verificó antes del corte. La configuración
  final declara ambos Custom Domains y `workers_dev: true` explícitamente.
- Un intento previo de asociarlos recibió `409 Conflict` por los registros de
  parking. Ese intento deshabilitó temporalmente el preview porque Wrangler
  asumió `workers_dev: false` al usar `--domain` sin declararlo. Se restauró el
  preview, se retiraron los tres registros incompatibles y se desplegó la
  configuración versionada desde `main`; el estado final responde 200/308.
- La sesión OAuth de Wrangler pudo desplegar Workers, pero la API DNS respondió
  `Authentication error` al listar registros. La eliminación se hizo desde el
  panel de Cloudflare, previa comparación exacta de nombres y contenidos.
- La suite del `main` integrado de la landing pasó 217 unitarias y 93 E2E. El
  PR #50 pasó CI, 4 pruebas unitarias y 3 E2E aisladas, y Wrangler dry-run.

Próxima etapa: planear identidad y el esqueleto de `apps/app`, con staging,
sesiones, OAuth y recursos independientes. No apuntar `app.homesuite.info` al
Worker actual de TasKing por conveniencia.

Para un redeploy exclusivo del sitio público desde un `main` limpio:

```bash
npx wrangler deploy --config apps/site/wrangler.jsonc
```

No usar `npm run deploy` para la landing: ese script pertenece a TasKing y
ejecuta respaldo y migraciones de su D1. Ante un problema del sitio público,
revisar primero los Custom Domains y las versiones del Worker `homesuite-site`;
no cambiar el DNS ni el Worker de TasKing como rollback improvisado.

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
- [MVP de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_MVP.md)
- [Cloudflare: configuración DNS primaria](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [Cloudflare: Custom Domains de Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare: Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/)
- [Cloudflare: Static Assets en Workers](https://developers.cloudflare.com/workers/static-assets/)
- [GoDaddy: cambiar nameservers](https://www.godaddy.com/help/change-my-domain-nameservers-664)
