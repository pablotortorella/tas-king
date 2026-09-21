# HomeSuite — visión de producto y plataforma

**Estado:** dirección acordada; dominio base activo y landing implementada localmente

**Fecha:** 2026-09-17

**Dominio adquirido:** `homesuite.info`

## Propósito

HomeSuite será una suite de herramientas pequeñas para coordinar la vida compartida.
Nace a partir de tres necesidades concretas:

1. **Tareas:** evolucionar FUN TasKing! como herramienta de organización compartida.
2. **Cuentas Claras:** reemplazar Splitwise con una alternativa propia, robusta y auditable.
3. **Compras:** mejorar sustancialmente la experiencia actual de armar y usar la
   lista del supermercado en Google Keep.

La suite podrá sumar otras herramientas en el futuro, pero no se construirá una
plataforma genérica por anticipado. Solo se compartirán capacidades que tengan un
uso real en más de un producto.

## Decisiones de producto

- **HomeSuite** es la marca paraguas. TasKing pasa a ser uno de sus productos; no
  se descarta su identidad ni se fuerza un renombre inmediato.
- Cada herramienta conserva su propio modelo, navegación y experiencia. Una suite
  no significa una única interfaz con conceptos mezclados.
- La primera herramienta nueva será **Cuentas Claras**. Su objetivo inicial es
  reemplazar Splitwise, no administrar el presupuesto completo del hogar.
- Cuentas Claras incluye desde el MVP ingresos compartidos que afectan el saldo neto. La
  arquitectura no debe impedir incorporar después categorías, recurrencias,
  presupuestos, análisis de ingresos y flujo de caja, pero esas capacidades
  posteriores no forman parte del primer reemplazo de Splitwise.
- HomeSuite Compras se diseñará después sobre la misma identidad, espacios e
  invitaciones. Las integraciones entre productos serán explícitas y confirmadas
  por la persona usuaria; no habrá automatismos sorpresivos.

## Principios

### Una plataforma pequeña, productos claros

HomeSuite comparte:

- identidad y sesión;
- perfil;
- espacios, miembros e invitaciones;
- selector de herramientas y navegación global;
- patrones visuales y de accesibilidad;
- auditoría, exportación, backups y operación.

Cada producto es dueño de:

- su vocabulario;
- sus reglas de negocio;
- sus permisos específicos;
- sus tablas y endpoints;
- su interfaz y pruebas.

### Confianza antes que sofisticación

En especial para información financiera, HomeSuite debe priorizar:

- cálculos reproducibles;
- historial de correcciones;
- operaciones atómicas e idempotentes;
- permisos comprobados en el servidor;
- exportación y recuperación de datos;
- ausencia de borrados silenciosos;
- comportamiento comprensible antes que automatización opaca.

### Evolución incremental

TasKing seguirá operativo mientras se construye HomeSuite. No habrá una
reescritura total ni un cambio de dominio de una sola vez. La plataforma se
extraerá gradualmente a partir de componentes probados.

## Arquitectura de experiencia

### Superficie pública

```text
https://homesuite.info/
├── /                 Presentación de la suite
├── /tareas           Presentación de TasKing
├── /cuentas-claras   Presentación de Cuentas Claras
└── /compras          Presentación de HomeSuite Compras
```

El sitio público no necesita recibir ni compartir la sesión autenticada.

### Aplicación autenticada

```text
https://app.homesuite.info/
├── /                 Selector de herramientas y espacios recientes
├── /tareas/*         TasKing dentro de HomeSuite
├── /cuentas-claras/* Cuentas Claras compartidas
└── /compras/*        Listas compartidas
```

Todos los productos autenticados viven bajo el mismo origen para compartir una
sesión sin abrir cookies a todos los subdominios.

La ruta OAuth canónica será:

```text
https://app.homesuite.info/auth/callback
```

El login aceptará un destino relativo validado (`returnTo`) para devolver a la
persona a la herramienta que lo inició, sin permitir redirecciones externas.

## Arquitectura técnica objetivo

HomeSuite vivirá en un **monorepo**, pero tendrá dos superficies desplegables:

```text
homesuite-site
└── sitio público sin sesión, D1 ni secretos de la app

homesuite-app / homesuite-app-staging
├── platform       identidad, sesión, espacios e invitaciones
├── tasks          dominio actual de TasKing
├── expenses       grupos, transacciones, repartos y balances
└── shopping       listas, catálogo y sincronización
```

API prevista:

```text
/api/platform/*
/api/tasks/*
/api/expenses/*
/api/shopping/*
```

Se conservarán Cloudflare Workers, Hono, D1, R2, Wrangler y los entornos local,
staging y producción. El sitio público tendrá un Worker de assets separado. La
aplicación autenticada será un **monolito modular** y usará inicialmente una D1
por entorno, con tablas y módulos separados por dominio. Esto conserva
transacciones locales, reduce operación y evita resolver consistencia entre bases
antes de necesitarla.

Staging tendrá Worker, OAuth, D1, R2 y backups propios. Separar despliegues no
significa separar repositorios: sitio, app, módulos, tests y documentación
permanecen versionados juntos.

Un producto podrá extraerse a otro Worker o D1 cuando exista una razón observable:

- cadencias de despliegue realmente independientes;
- requisitos de retención o seguridad distintos;
- saturación o límites medidos de una base;
- necesidad de aislamiento operativo;
- coordinación en tiempo real que justifique Durable Objects.

La separación interna debe hacer posible esa extracción, pero no simular
microservicios desde el primer día.

## Identidad, acceso y colaboración

### Identidad estable

El email deja de ser la clave primaria de la persona. El modelo objetivo usa:

- `user_id` interno e inmutable;
- identidad Google vinculada mediante el claim estable `sub`;
- email normalizado como atributo verificable y modificable;
- posibilidad futura de agregar otro mecanismo de acceso sin migrar relaciones.

La sesión contendrá el identificador interno, no usará el email como identidad
relacional. La cookie objetivo será host-only, `Secure`, `HttpOnly`,
`SameSite=Lax`, `Path=/` y con nombre `__Host-homesuite_session`.

### Acceso por espacio

La allowlist global actual sirve para una aplicación privada, pero no para viajes
o grupos de amigos. HomeSuite usará invitaciones y membresías por espacio.

Un **espacio** representa el contexto compartido —por ejemplo, Familia, Viaje a
Cartagena o Proyecto X— y puede habilitar uno o más productos. Un tablero, libro
de Cuentas Claras o lista pertenece a un espacio. Crear un grupo desde Cuentas Claras podrá crear
el espacio y su primer libro en una sola operación.

No se migrarán obligatoriamente todos los tableros actuales al introducir el
concepto. La compatibilidad y migración de TasKing se especificarán por separado.

### Acceso no equivale a participación financiera

Los miembros de un espacio pueden abrir y modificar recursos según su rol. Los
participantes de un libro aparecen en pagos, repartos y balances. Un participante
puede no tener cuenta —por ejemplo, un hijo o un invitado— y podrá vincularse a un
usuario después sin reescribir la historia.

## Seguridad y datos

- `homesuite.info` y `app.homesuite.info` tendrán responsabilidades separadas; la
  cookie autenticada no llevará atributo `Domain`.
- Antes de incorporar información financiera se eliminará la dependencia general
  de CSP `unsafe-inline` en la aplicación autenticada.
- Cada endpoint comprobará membresía y rol del recurso; la UI nunca será la barrera
  de autorización.
- Los backups de base de datos se separarán de los archivos subidos cuando se
  implemente HomeSuite, evitando compartir bucket y política de retención.
- Las escrituras monetarias usarán transacciones D1 y claves de idempotencia.
- Se documentarán restauración, exportación y eliminación de cuenta antes de abrir
  la suite fuera del círculo controlado actual.

## HomeSuite Compras: dirección inicial

La oportunidad no es copiar Keep sino optimizar el recorrido completo:

- captura en uno o dos toques;
- sugerencias basadas en productos anteriores;
- combinación de duplicados;
- cantidades y unidades opcionales;
- orden por sección o pasillo;
- modo supermercado con controles grandes;
- uso simultáneo y actualización optimista;
- cola local para conectividad deficiente;
- favoritos, recurrencias y plantillas.

Una compra finalizada podrá generar un **borrador** de gasto. La persona deberá
revisar y confirmar pagador, participantes, monto y moneda antes de incorporarlo
al libro.

## Secuencia de evolución

1. Documentar y validar la visión, arquitectura, infraestructura y MVP de Cuentas Claras.
2. Activar la zona Cloudflare y DNSSEC para `homesuite.info`.
3. Crear el sitio público y asociar apex y `www`.
4. Preparar aplicación y recursos aislados de staging.
5. Separar el frontend en superficies mantenibles sin detener TasKing.
6. Extraer identidad estable, sesión, espacios, miembros e invitaciones.
7. Preparar aplicación y recursos de producción.
8. Implementar y validar Cuentas Claras.
9. Mantener TasKing en su URL actual hasta completar una migración probada a
   `/tareas`.
10. Diseñar e implementar HomeSuite Compras sobre la plataforma compartida.
11. Integrar productos únicamente a partir de recorridos reales.

Cada etapa de implementación deberá recorrer OpenSpec: `explore` → `propose` →
`apply` → `archive`. Este documento expresa dirección de producto; no reemplaza
las especificaciones incrementales ni autoriza un despliegue.

## Riesgos conscientes

- **Radio de impacto compartido:** una falla del shell o de autenticación puede
  afectar varios productos.
- **Seguridad same-origin:** una vulnerabilidad de frontend puede operar contra
  otras APIs autenticadas; CSP, validación y aislamiento modular son obligatorios.
- **Despliegues de producto acoplados:** Tareas, Cuentas Claras y Compras se publican
  juntos inicialmente; se separarán si el costo se vuelve observable. Sitio y
  aplicación sí tienen deploy independiente desde el principio.
- **Sobre-generalización:** espacios y membresías deben resolver casos presentes,
  no convertirse en un framework abstracto.
- **Confianza financiera:** Cuentas Claras necesita más auditoría e invariantes que una
  herramienta de tareas.

## Éxito inicial

HomeSuite habrá validado su primera etapa cuando:

- una familia o grupo pueda abandonar Splitwise para sus gastos cotidianos;
- los balances se puedan explicar y reconstruir desde el historial;
- invitar a otra persona no requiera intervención del administrador global;
- los datos puedan exportarse y restaurarse;
- TasKing continúe funcionando sin regresiones;
- la plataforma compartida reduzca —y no aumente— el trabajo de construir Compras.

## Documentos relacionados

- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)
- [Infraestructura, dominios y repositorio](HOMESUITE_INFRASTRUCTURE.md)
- [Especificación del MVP de Cuentas Claras](HOMESUITE_GASTOS_MVP.md)
- [Brief de exploración de Cuentas Claras y referencia de Tricount](HOMESUITE_GASTOS_EXPLORACION.md)
- [Backlog del producto](PRODUCT_BACKLOG.md)
- [ADRs históricos de TasKing](ADRs.md)
