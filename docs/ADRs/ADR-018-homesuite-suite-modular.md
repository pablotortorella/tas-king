# ADR-018: HomeSuite como suite modular bajo un origen autenticado

**Fecha:** 2026-09-16

**Estado:** aceptado como arquitectura objetivo; implementación pendiente

## Contexto

FUN TasKing! ya resuelve tareas compartidas sobre Cloudflare Workers, Hono, D1,
R2 y OAuth de Google. Aparecieron dos necesidades nuevas: un reemplazo propio de
Splitwise y una mejor experiencia de lista de supermercado. También es probable
que aparezcan otras herramientas familiares.

Las alternativas extremas son incorporar todos los conceptos a la aplicación
actual o crear productos completamente independientes. La primera mezcla modelos,
permisos y UI; la segunda duplica autenticación, perfiles, invitaciones, operación
y patrones de seguridad.

El dominio paraguas adquirido es `homesuite.info`.

## Decisión

Construir HomeSuite como un **monorepo con dos superficies desplegables** y una
aplicación autenticada que funciona como monolito modular evolutivo:

- `homesuite.info` aloja la superficie pública y las landings por producto.
- `app.homesuite.info` aloja todas las herramientas autenticadas bajo rutas.
- `staging.homesuite.info` ejecuta la aplicación con Worker, OAuth, D1, R2 y
  backups separados de producción.
- El sitio público se despliega como `homesuite-site`, un Worker de assets sin
  base, sesión ni secretos de la aplicación.
- Producción se despliega como `homesuite-app` y staging como
  `homesuite-app-staging`.
- Un shell común resuelve sesión, perfil, espacios, membresías, invitaciones y
  selector de herramientas.
- Tareas, Gastos y Compras son dominios separados, con rutas, tablas, reglas y
  pruebas propias.
- La aplicación usa inicialmente una D1 por entorno para plataforma y productos.
  Separar Workers o bases por producto requiere una señal observable.
- Sitio, aplicación, módulos, tests, infraestructura y documentación viven en un
  único repositorio. Separar una unidad de despliegue no implica separar el repo.
- La identidad migra de email como clave relacional a `user_id` interno más
  identidad externa Google `sub`.
- La allowlist global no será el modelo de incorporación de HomeSuite: el acceso
  se concederá mediante membresías e invitaciones por espacio.
- La cookie autenticada será exclusiva de `app.homesuite.info`, sin atributo
  `Domain`, idealmente `__Host-homesuite_session`.
- El callback OAuth será canónico en `app.homesuite.info` y aceptará únicamente
  destinos relativos previamente validados.
- TasKing permanecerá operativo durante la transición. No se realizará una
  reescritura ni migración de producción de una sola vez.
- El repositorio no se renombrará mientras existan ramas o worktrees activos que
  dependan de la estructura actual. El cambio a `homesuite` será posterior.

## Fronteras

### Plataforma compartida

- cuentas e identidades externas;
- sesión y cierre de sesión;
- espacios, roles, miembros e invitaciones;
- navegación general;
- auditoría transversal, exportación y operación.

### Dominios de producto

- **Tasks:** tableros, columnas, tarjetas, objetivos y métricas.
- **Expenses:** libros, participantes, operaciones, repartos, saldos y pagos.
- **Shopping:** listas, ítems, catálogo aprendido y sincronización de compras.

No se crearán entidades genéricas para reemplazar los modelos propios de cada
dominio.

## Consecuencias

### Positivas

- Un solo login y perfil para toda la suite.
- Las invitaciones y grupos creados para Gastos pueden reutilizarse en Compras.
- Menos duplicación operativa que tres aplicaciones independientes.
- El sitio público puede publicarse sin desplegar código autenticado o financiero.
- El Worker público no recibe bindings, secrets ni cookies de la aplicación.
- Staging no puede escribir accidentalmente en los recursos de producción.
- Un único PR puede cambiar contratos compartidos y verificar toda la suite.
- Las rutas y módulos internos permiten extraer un producto más adelante.
- La marca y los dominios dejan de estar atados a una herramienta de tareas.
- El sitio público queda fuera del origen que recibe la sesión autenticada.

### Negativas y riesgos

- Autenticación y shell compartidos amplían el radio de impacto entre productos.
- Todos los productos autenticados comparten origen; un XSS podría emitir acciones
  contra otras APIs aunque la cookie sea `HttpOnly`.
- Una D1 compartida acopla inicialmente backups, migraciones y capacidad.
- Dos configuraciones de Worker requieren scripts y ownership explícitos.
- La transición exige compatibilidad temporal con emails y membresías actuales.
- Separar módulos de forma prematura o abstracta puede agregar más complejidad que
  la que elimina.

## Mitigaciones

- Eliminar CSP `unsafe-inline` antes de alojar información financiera.
- Namespaces explícitos de rutas y módulos; tablas con nombres no ambiguos.
- Autorización en servidor para cada recurso y rol.
- Migraciones aditivas y transición gradual de identidad.
- Tests de regresión de TasKing y tests de invariantes del libro financiero.
- Backups restaurables y separados de archivos de usuario.
- Claves de idempotencia y batches transaccionales para operaciones monetarias.
- Recursos y OAuth distintos para staging y producción.
- Deploys independientes para sitio y app, orquestados desde la raíz del monorepo.

## Alternativas consideradas

### Extender la aplicación actual sin nuevas fronteras

Es la opción de menor esfuerzo inmediato, pero agrava el frontend único, mezcla
permisos y convierte cada cambio en un despliegue de una aplicación conceptualmente
monolítica. Rechazada.

### Una aplicación y un Worker por producto desde el inicio

Aísla fallas y despliegues, pero obliga a diseñar SSO, comunicación interna,
invitaciones y consistencia distribuida antes de validar los productos. Pospuesta.

### Un único Worker para sitio público y aplicación

Reduce la cantidad de configuraciones, pero entrega secretos y bindings al mismo
despliegue que sirve contenido anónimo y obliga a publicar la app para modificar
una landing. Rechazada: dos Workers por superficie agregan poco costo operativo y
crean una frontera útil.

### Un repositorio por producto

Permite ownership independiente, pero duplica CI, coordinación de contratos y
versionado de paquetes internos cuando existe un solo equipo. Rechazada hasta que
equipos, permisos o releases requieran esa separación.

### Subdominio autenticado por producto

`tareas.`, `gastos.` y `compras.` facilitan separación visual, pero complican la
sesión compartida o requieren una cookie válida para todos los subdominios, lo que
amplía su superficie de seguridad. Rechazada para la primera etapa.

### Cloudflare Access como identidad de producto

Puede proteger hosts, pero no reemplaza membresías por espacio, participantes sin
cuenta ni permisos propios del dominio. No se adopta como modelo de usuario.

## Cuándo separar servicios o bases

Reevaluar esta decisión cuando exista al menos una de estas señales:

- un producto necesita despliegue y rollback independiente con frecuencia;
- aparecen requisitos distintos de retención, residencia o aislamiento de datos;
- las métricas muestran contención o límites de D1;
- un fallo de un dominio no puede aceptar impacto sobre los otros;
- Compras necesita coordinación persistente en tiempo real;
- el equipo puede sostener la complejidad operativa adicional.

En ese momento se preferirán Service Bindings entre Workers y separación por
dominio o tenant, preservando el origen público `app.homesuite.info`.

Separar un Worker o una base no obliga a separar el repositorio. El monorepo se
revisará únicamente ante ownership, acceso al código o ciclos organizacionales
realmente independientes.

## Referencias

- [Visión de HomeSuite](../HOMESUITE_VISION.md)
- [Infraestructura, dominios y repositorio](../HOMESUITE_INFRASTRUCTURE.md)
- [MVP de HomeSuite Gastos](../HOMESUITE_GASTOS_MVP.md)
- [Cloudflare: Routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Cloudflare: Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare D1: límites](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1: batch transaccional](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
