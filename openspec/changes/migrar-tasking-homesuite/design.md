## Context

Motivación y alcance en [proposal.md](proposal.md). Primera inspección sobre `3fe9cd6`; revisión de cierre del 2026-11-09 actualizada mediante rebase sobre `origin/main` `65a1b53`, que ya integra la PWA. Sólo se preparan artefactos; no se inspeccionaron datos privados ni recursos desplegados.

Contexto operativo confirmado por Pablo el 2026-11-09: las personas actuales de TasKing son pocas, conocidas directamente y pertenecen a su círculo de amigos y familia. Aclaración posterior: no se requiere que Pablo las contacte, gestione sus altas ni compruebe manualmente cada cuenta. La aplicación comunica la mudanza al llegar al TasKing antiguo, con un aviso firmado por Pablitux; con un clic van a HomeSuite, usan su cuenta Google habitual y recuperan automáticamente sus tableros. No hace falta una plataforma de migración masiva, despliegue gradual, autoservicio de reclamación ni un sistema adicional de verificación de identidad. Sólo una incidencia excepcional ofrece contactar a Pablitux; no es un paso del recorrido normal. Se conservan los controles técnicos de integridad, permisos y una sola copia operativa.

Hechos relevantes del código:

- `src/index.js` compone Hono, rutas de dominio y autenticación propia. `src/db/helpers.js` crea el personal y consulta membresías por email. No existe vínculo persistido con Google `sub` en TasKing.
- `src/routes/boards.js` agrega integrantes directamente por email, llama a `ensureUser` incluso para personas aún no autenticadas y permite quitar integrantes sólo al titular. No hay aceptación de invitaciones como en los grupos de HomeSuite.
- Las migraciones `0001`–`0015` cubren tarjetas, tableros, perfiles, administración, actividad, límites, etiquetas, solicitudes, checklists, objetivos, columnas, temas, tips y revisión persistente. `0015_board_sync.sql` contiene triggers cuya semántica debe conservarse.
- `src/routes/uploads.js` sirve `/uploads/:key` con autenticación independiente y usa `BUCKET`. TasKing limita cada archivo a 20 MB; HomeSuite limita por defecto las mutaciones a 16 KiB. Copiar los handlers sin adaptar middleware rompería las subidas.
- `public/js/core/api.js` llama a `/api/*` sin CSRF; `card-modal.js` sube archivos mediante un `fetch` separado. `public/index.html` y los módulos usan estilos inline. HomeSuite exige sesión/CSRF y CSP más estrictas.
- `apps/app/src/routes/shell.js` sirve `/tareas` como página puente. `apps/app/src/users.js`, `sessions.js`, `profiles.js` y `csrf.js` ya ofrecen identidad estable, sesión y perfil comunes. `GET /api/me` tiene consumidores de plataforma y no puede sustituirse por el payload de TasKing.
- El flag `is_admin` de TasKing administra también estadísticas y roles, además de la lista global. Retirar la lista no autoriza eliminar las otras funciones ni promover esas personas a administradoras de HomeSuite.
- `public/favicon.svg` es la corona vigente, y todas las páginas antiguas la referencian. `public/js/app.js` abre enlaces `?card=…`; `src/db/queries.js` produce URLs `/uploads/:key`. `wrangler.jsonc` usa assets-first salvo ciertas páginas y un cron cada ocho horas; un redirect sólo en `/` no retira esos otros caminos.
- El bucket antiguo contiene adjuntos y `backups/*.sql` (`src/backup.js`): la copia activa debe seleccionar por manifiesto de adjuntos, nunca publicar todo el bucket como estáticos. La PWA HomeSuite ya integrada tiene un solo manifiesto/SW y favicon de suite en `ui-parts.js`; su lista de precarga no admite privados.

Fuentes normativas: [base común](../../../docs/homesuite/README.md), [ficha TasKing](../../../docs/productos/TASKING.md), [ADR-018](../../../docs/ADRs/ADR-018-homesuite-suite-modular.md) y [perfil común](../../../docs/HOMESUITE_PROFILE_API.md). La frase general de ADR-018 sobre incorporación por grupos se aclarará para que no se interprete como autorización de tableros por grupo. No cambia el contrato de grupos.

## Goals / Non-Goals

**Goals:** mantener un módulo de Tareas con rutas y tablas propias, identidad estable compartida y datos operables sin depender del Worker anterior después del corte. Minimizar cambios funcionales y hacer verificables el traslado, los permisos y la recuperación.

**Non-Goals:** SSO entre Workers, doble escritura, replicación permanente, nuevas abstracciones de entidades compartidas o generalización de la consola administrativa. No convertir el import/export de usuario en un backup operativo.

## Decisions

### 1. Módulo integrado con namespace de Tareas

Adaptar la implementación existente a `apps/app/src/tasking/` y assets bajo `apps/app/public/tareas/`, con composición explícita desde el Worker HomeSuite. Usar `/api/tareas/*` para API, `/tareas/adjuntos/:key` para descargas y `/tareas` para el documento. Preservar identificadores de tableros y tarjetas. Un adaptador del cliente cambia prefijos y contrato de sesión; no duplicar `/api/me` de plataforma. No construir una reescritura del tablero.

Migraciones aditivas nuevas crean tablas `tasking_*` dentro de la D1 HomeSuite por ambiente. Mantener columnas, restricciones, índices y triggers de dominio equivalentes, con nombres propios; fechas heredadas pueden conservar su formato en las tablas del módulo. Las tablas de plataforma y finanzas permanecen intactas. Añadir los términos de Tareas al glosario en la implementación, sin reutilizar `memberships` de grupos.

Alternativa descartada: proxy permanente al Worker actual, que mantiene dos autenticaciones y acopla la integración al origen. Tampoco copiar sin cambios tablas `users`, `/api/me` y middleware heredados sobre los de HomeSuite.

### 2. Identidad heredada representable antes del alta de HomeSuite

Proponer `tasking_identities` con ID propio estable, ID heredado cuando exista, email heredado normalizado único y `user_id` HomeSuite nullable y único. Dueños, integrantes, asignaciones, autoría y rol administrativo de Tareas referencian esa identidad; los emails históricos se conservan como datos del traslado, no como claves de autorización futuras. Materializar también referencias a emails presentes en relaciones aunque falte una fila `users`; reportar inconsistencias reales en vez de omitirlas. Conservar perfil heredado sólo como respaldo de personas no vinculadas y como evidencia de migración.

En el primer acceso al módulo, usar la identidad autenticada en servidor y su email Google verificado para vincular de manera atómica una identidad pendiente. Si la cuenta ya existía en HomeSuite, funciona igual. No crear un usuario de plataforma ficticio para quien sólo aparece en los datos trasladados. Tras vincular, resolver por `user_id`, ligado al `sub`; no volver a reclamar por contacto nuevo. Un cambio de email posterior no mueve los permisos.

La revisión de seguridad restringe ese puente: conservar en el contexto interno validado los datos necesarios para saber si Google es autoridad del email. Para Gmail o Workspace verificado puede usarse la correspondencia inicial sin conflicto; para correos externos, reasignaciones conocidas o casos ambiguos, `email_verified` solo no basta. Vincular automáticamente los casos que sí tienen prueba suficiente, con conciliación automatizada de roles y relaciones; nunca elevar privilegios por un email declarado por cliente. Una ambigüedad real se trata como incidencia excepcional sin conceder datos y con indicación de contactar a Pablitux; no imponer aprobaciones manuales ni comprobaciones persona por persona al recorrido normal. Si los datos reales requieren una prueba adicional no disponible, resolver esa incidencia específica de forma segura; no inventar un vínculo para aparentar recuperación. No habilitar autoservicio de transferencias entre cuentas ni una nueva consola de recuperación.

Invitar sigue agregando membresía de tablero por email, sin aceptación nueva. Resolver una cuenta conocida a su identidad estable; para una persona todavía desconocida, conservar una identidad pendiente hasta su acceso autenticado. No permitir apropiación por cuerpo de petición, ni por coincidencia con nombre/avatar. Las restricciones de unicidad y el batch deben impedir doble reclamación y resolver reintentos sin efectos adicionales.

Límite de evidencia: TasKing no persistió `sub`; el email verificado es el puente inicial disponible, no prueba retrospectiva de un `sub` antiguo. Una cuenta Google que cambió de email antes de vincularse no es resoluble automáticamente sólo con el snapshot. No se hace transferencia automática: registrar el conflicto sin conceder datos ni reemplazar el personal; resolver incidentes antes de la aceptación de esa cuenta. Si se necesita cubrir ese caso en forma automática, se requiere ampliar el contrato antes de implementarlo.

Alternativa descartada: exigir que todas las personas creen antes una cuenta HomeSuite, que contradice el alta posterior acordada. Usar email permanentemente pierde estabilidad; crear usuarios OAuth artificiales inventa autenticación.

### 3. Aprovisionamiento único y permisos independientes de grupos

Antes de aprovisionar, comprobar que el traslado final está completo y que el vínculo no presenta conflicto. Resolver el personal heredado; sólo si no existe, crear tablero, membresía owner y columnas en una unidad atómica. Un índice único parcial por identidad titular donde `is_personal = 1`, más las restricciones de membresía/columnas, impide dos personales en accesos simultáneos. Si el origen ya contiene varios personales para una identidad, bloquear conciliación y reportar; no eliminar uno automáticamente.

Cada recurso pasa por la membresía del tablero; mantener las facultades concretas de owner/member actuales y comprobar la pertenencia de IDs relacionados en rutas equivalentes, masivas, importaciones y descargas. La consulta de autorización no depende de `groups` ni de `memberships` de plataforma. Retirar a alguien de un grupo no altera sus tableros; retirarlo de un tablero no cierra su cuenta HomeSuite.

Alternativa descartada: un grupo por tablero o acceso automático de integrantes de Cuentas Claras, que cambia el modelo elegido por Pablo.

### 4. Adaptaciones comunes acotadas

- La sesión viene sólo de HomeSuite y el cliente obtiene CSRF de su contrato existente. Enviar el token tanto en JSON como en la subida multipart directa y en administración; usar Salir protegido de HomeSuite. No aceptar cookies antiguas como sustituto ni compartirlas entre hosts.
- El perfil visible y su edición usan HomeSuite, sin copiar automáticamente perfil heredado ni inventar consentimiento. Adaptar la proyección de nombre/avatar al contrato visual existente. Preferencias del tablero, progreso del tip y opciones de Tareas siguen en el módulo.
- Mantener estadísticas y gestión de roles administrativos de Tareas con autorización propia, migrando `is_admin` de forma explícita. Quitar sólo controles de autorización global y solicitudes. Los conteos «activo/inactivo» actuales significan presencia/ausencia en la lista: retirarlos al retirar esa lista, sin presentarlos como actividad real ni crear una métrica nueva. No incorporar la futura consola HomeSuite.
- Extraer estilos inline estáticos a CSS acotado a Tareas y adaptar estados dinámicos con clases/atributos; conservar arrastre, temas y geometría mediante mecanismos compatibles con la CSP real. Validar en navegador, sin copiar `unsafe-inline` a HomeSuite. No aplicar CSS de tablero globalmente a otras herramientas.
- Dar límites específicos a subida e importación de Tareas conservando los límites funcionales vigentes, con comprobación efectiva del cuerpo y no sólo de `Content-Length`. Mantener el resto de límites sin cambios. Autorizar antes de escribir en R2 y cubrir fallos parciales.
- Servir datos y adjuntos privados con política de caché que vuelva a comprobar sesión y membresía; verificar la PWA ya integrada, manteniendo un solo SW y sin añadir datos privados a su precarga ni convertir Tareas en un producto offline.
- Revisar puntos de interpolación/URL del frontend y metadatos de adjuntos como contenido no confiable trasladado al origen compartido. Probar HTML/script en nombres, comentarios, etiquetas y actividad, esquemas de URL peligrosos y nombres/tipos engañosos de archivo. Imágenes permitidas conservan vista segura; documentos activos o ambiguos se descargan con `Content-Disposition` adecuado, tipo controlado y `nosniff`, sin ejecutarse como HTML de HomeSuite. No basta con confiar en el MIME enviado por el cliente.
- Al abrir Tareas a todas las cuentas HomeSuite, aplicar límites por sujeto/ruta antes de crear tableros o escribir archivos, conservando topes de 20 MiB por archivo y 10 por tarjeta. Acotar bytes totales, procesamiento y memoria de multipart/imports y tratar fallos parciales. La ausencia de allowlist no se compensa inventando otra aprobación global.

Hay una contradicción heredada verificable: `proteccion-operativa-homesuite` expresa 16 KiB para toda mutación, mientras `index.js` ya permite más para el import financiero. El delta de esa capacidad incluido en este change declara límite general y excepciones explícitas, verificando que Tareas no relaje los demás endpoints; no presenta la regla universal vieja como compatible con adjuntos de 20 MiB.

Las claves `tasking-theme`, `tasKingBoardId` y opciones de pulso viven en el origen antiguo. No se promete recuperación entre orígenes ni se envían preferencias por query. Mantener valores predeterminados y permitir la selección habitual; el tema del tablero y el tip almacenados en D1 sí se trasladan.

### 5. Transferencia operativa completa y acotada

Crear herramienta versionada de extracción/carga/conciliación del dominio con manifiesto, versión de esquema, origen, ambiente, lote y hash de contenido por entidad/archivo. No cargar un SQL completo de TasKing sobre HomeSuite ni usar su export JSON/CSV de tarjetas: no cubre el sistema entero. Guardar material privado fuera de Git, Dropbox y logs.

Cobertura mínima: identidades, tableros/opciones/revisión, membresías/roles, columnas, tarjetas/asignaciones, comentarios/autoría, metadatos y bytes de adjuntos, etiquetas/relaciones, checklists/ítems, objetivos/relaciones, actividad, configuración administrativa aún aplicable y tip. Excluir del modelo activo cookies, tokens, solicitudes de acceso, lista global y logs transitorios de rate limiting. Los respaldos del origen conservan la evidencia anterior según el runbook; no borrarla por la mera carga.

Usar un bucket de adjuntos HomeSuite por ambiente con binding propio de Tareas; copiar preservando claves y metadatos y comprobar tamaño y checksum de bytes. No usar el bucket de backups como almacenamiento activo ni compartir un bucket de producción con staging. Incorporar ese bucket a recuperación: un respaldo sólo de D1 no cubre Tareas.

La carga final usa staging lógico por lote no visible hasta completar conciliación. Cada clave heredada se carga idempotentemente con hash: misma clave/contenido no duplica, payload distinto requiere detectar y resolver la discrepancia, sin sobrescribir una versión ya activa. Los ensayos con datos sintéticos se hacen en destinos descartables aislados. No mezclar copias de ensayo con el destino final; impedir el uso de Tareas en HomeSuite antes de completar el corte.

### 6. Transición con un único escritor

La preparación y pruebas no cambian la autoridad del origen. Para el traslado final se propone una ventana breve de mantenimiento explícito, ensayada y acordada antes de publicar; no se propone coexistencia con dos copias editables ni sincronización bidireccional.

El bloqueo del origen abarca todas las mutaciones, OAuth/aprovisionamiento, tips que se escriben desde GET, API, subidas/borrados R2 y tareas programadas con efectos relevantes. Detener admisión y esperar las peticiones ya admitidas antes del snapshot final; comprobar que no quedan cargas parciales. Bloquear sólo POST sería insuficiente. La guardia debe vivir en servidor y cubrir pestañas antiguas.

Después de conciliar, habilitar Tareas en HomeSuite y convertir el origen en el aviso de mudanza con botón hacia ella. El destino usa la sesión HomeSuite vigente o su acceso Google normal si no la hay; no intercambiar cookies ni exigir otro login a quien ya tiene sesión válida. Mantener correspondencia de enlaces a tarjetas/tableros cuando los identificadores lo permitan; enlaces de archivos antiguos requieren autenticación y autorización en el destino, sin redirigir mutaciones ni reproducirlas automáticamente.

Alternativas descartadas: un traslado en caliente sin bloqueo pierde cambios; dos escritores obligan a implementar replicación y conflictos ajenos a esta migración. Usuarios escasos permiten un corte controlado, pero no justifican omitir datos o recuperación.

### 7. Puente del host antiguo preparado como parte de la migración

Construir y ensayar un artefacto de compatibilidad que reemplaza la aplicación en el mismo nombre/host de Worker antiguo. No borrar el Worker ni delegar todo a una regla indiscriminada `/*`: el tratamiento depende del método y del tipo de ruta. Activarlo como parte obligatoria del corte, no como limpieza opcional posterior. Mantenerlo sin fecha de retiro automático; no contiene una segunda implementación de Tareas.

La entrada humana muestra una página HTML 200, sin sesión ni consulta de datos antiguos, con favicon TasKing, un único botón principal y este texto:

> **¡Nos mudamos!**
>
> Fun TasKing ahora vive en HomeSuite.
>
> Entrá con la misma cuenta de Google que usabas acá. En Tareas vas a encontrar tu tablero personal y los tableros que compartís.
>
> Si tenés cualquier consulta, contactame.
>
> **Pablitux**

Botón: **Ir a HomeSuite**. Apunta directamente al destino permitido del ambiente (`/tareas` o el recurso original conservado), sin un paso de confirmación ni formulario en el origen. Se mantiene el acceso Google habitual de HomeSuite, con alta automática si aún no tiene cuenta allí. El aviso no pide nombre, email, transferencia, importación, códigos ni aprobación de Pablitux. No agregar datos de contacto no solicitados, notificaciones externas ni tareas manuales de comunicación. No usar temporizador, meta refresh ni JavaScript que salte el aviso; una persona con sesión HomeSuite también lo ve al volver a entrar por el origen antiguo.

| Solicitud antigua | Respuesta después del corte |
|---|---|
| GET/HEAD `/`, `/index`, `/index.html`, `/landing[.html]`, `/revoked[.html]` | Aviso HTML 200 (HEAD sin cuerpo) con botón a `/tareas` del host HomeSuite fijo del ambiente. Conservar sólo `card` válido en el destino cuando corresponde; no copiar la query completa. |
| GET/HEAD `/?card=<id>` | Mismo aviso, con botón a `/tareas?card=<id>`; login conserva ese retorno completo y el destino comprueba membresía antes de mostrar contenido. |
| GET/HEAD `/uploads/:key` | Para navegación de documento, aviso con botón a `/tareas/adjuntos/:key` validado/codificado. Para descarga/subrecurso, 302 directo al recurso compatible, sin sustituir bytes por el aviso. El destino ofrece login con retorno seguro y después autoriza el tablero; borrado o acceso ajeno se manejan sin revelar contenido. |
| GET/HEAD `/favicon.svg` y fallback de icono que se publique | Imagen original o redirect hacia la imagen trasladada con MIME correcto; jamás hacia HTML de `/tareas`. Si se soporta `.ico`, generar un ICO real de la corona, sin rediseño. |
| GET/HEAD `/releases[.html]` | Histórico de novedades trasladado como documento inerte bajo `/tareas/novedades`, con enlaces e iconos corregidos. |
| GET/HEAD `/terminos[.html]` | Documento histórico identificado como tal y enlazado a términos vigentes de la suite; conservar el contenido anterior como archivo, sin presentarlo como política actual. |
| GET/HEAD `/auth/login`, `/auth/logout`, `/auth/callback` | Expirar las cookies propias antiguas y mostrar el aviso. Limpiar la URL del callback mediante salto local seguro al aviso, descartando query/fragment sin canjearlos ni copiarlos; sólo el botón inicia el recorrido HomeSuite y no cierra una sesión HomeSuite por un GET antiguo. |
| Cualquier método de `/api/*` antiguo | `410` JSON con código estable `tasking_migrated` y destino canónico fijo, `no-store`; sin datos privados, sin `Location` de reenvío ni ejecución de negocio. OPTIONS no concede CORS autenticado. |
| Escrituras fuera de API | Rechazo explícito de migración; nunca 307/308 ni reproducción automática del cuerpo en el destino. |
| JS/CSS/bundles antiguos | Respuesta tipada de recurso retirado, sin fallback HTML ni bundle operativo. Una página ya cacheada tampoco puede usar API antigua. |
| Otras navegaciones GET/HEAD | Mismo aviso de mudanza con botón fijo hacia `/tareas`, sin query arbitraria; no un 404 accidental de infraestructura. |

El aviso se sirve con `Cache-Control: no-store` y `Referrer-Policy: no-referrer`; no hay redirect automático hacia HomeSuite para esas entradas humanas. Los 302 quedan para los recursos que requieren compatibilidad de bytes y la limpieza local de URLs sensibles. Evitar herencia accidental de fragmentos en callbacks/destinos descartados con un fragmento explícito seguro y probarlo en navegador (el servidor no recibe el fragmento original). El origen/ambiente del botón sale de configuración cerrada, no de un host suministrado ni de `returnTo` del origen. No conservar códigos OAuth, tokens, payloads, borradores o emails en URLs o logs.

El puente final no debe empaquetar `public/index.html` ni servir el antiguo `ASSETS` como fallback. Si necesita assets mínimos propios, su ruteo no puede eludir el handler. Esto evita el bypass de assets-first de la configuración actual. Desactivar cron, entrypoints de negocio y secretos/bindings D1/R2 del puente tras retirar negocio; conservar respaldos operativos fuera de esa superficie pública. Configurar logs/traces acotados a clase de ruta, ambiente, versión y resultado; verificar que captura automática y logs propios no registren callbacks, query completa ni identificadores privados.

Inventariar antes del corte los hosts/aliases/custom domains, preview URLs/version URLs y automatizaciones que publican el origen; el repositorio no prueba su estado remoto. Deshabilitar rutas a versiones viejas y despliegues de app independiente. Hacer el corte a 100 % del artefacto previsto, nunca reparto gradual entre app editable y puente. Mantener además un cerrojo persistente de escritura del origen que resista un redeploy viejo: guardias en base para las tablas de negocio y control operativo de versiones/bindings de archivos, con mecanismo de reapertura limitado al aborto previo a nuevas escrituras de destino. Verificar que ningún camino antiguo puede usar R2 antes o después de ese cerrojo. Un modo de mantenimiento sólo en memoria/configuración del código nuevo es insuficiente.

### 8. Assets completos, cachés y transición de personas

Inventariar todos los assets referenciados desde HTML, CSS y módulos, incluidos favicon, corona/identidad, tema de arranque y documentos públicos previos; marcar cuáles se trasladan y cuáles desaparecen por integración. Copiar `public/favicon.svg` con los mismos bytes a `/tareas/favicon.v1.svg` y enlazarlo desde páginas de Tareas (también históricas), con versión/MIME/cabeceras correctos. Adaptar `renderPage` con opción acotada de favicon para Tareas. No reemplazar `/icons/homesuite-*`, el manifiesto, `id`, `scope`, el icono Apple ni los iconos de instalación de la PWA; no crear otro SW. El inventario debe cerrar con cero referencias de la versión nueva a módulos o archivos que sólo existan en el origen.

Preparar antes del corte un cliente transitorio compatible que entienda mantenimiento y `tasking_migrated`, detenga sondeos/reintentos automáticos y ofrezca continuar en HomeSuite. Si hay un borrador, mantenerlo visible y facilitar que la persona lo copie antes de navegar; no descartarlo por forzar un redirect ni enviarlo en una URL. Probar también el JS verdaderamente antiguo que no entiende el código: debe fallar sin éxito falso y sin persistir nada, aun si conserva una apariencia antigua. No es posible borrar de forma universal HTML/archivos ya descargados ni controlar una pestaña desconectada; la garantía es que no pueda volver a operar contra el origen. La propia interfaz muestra mantenimiento o mudanza cuando corresponde; no exigir que Pablo avise individualmente ni reúna a las personas antes del corte.

El origen sirve hoy adjuntos con caché privada de un año. Cambiar cabeceras no retira bytes ya descargados ni revoca copias locales. Antes de cortar, preparar revalidación/no-store en respuestas nuevas, invalidación de caché controlable y limpieza de caché del origen cuando sea compatible, sin borrar borradores/storage indiscriminadamente ni tocar otros orígenes. La seguridad de los nuevos accesos depende del servidor, no de esa limpieza. Probar caché caliente, volver atrás, pestaña vieja, cambio de cuenta y una instalación HomeSuite previa a la migración. Si el destino cae, la entrada mantiene un mensaje recuperable; no reactiva el origen para mantener aparente disponibilidad.

## Risks / Trade-offs

- [Vínculo inicial sin `sub` histórico] → Usar sólo el email verificado por Google, fijar después el vínculo estable y bloquear conflictos. Declarar el límite para cambios previos de email; no fingir una correspondencia demostrada.
- [Autorización global retirada reactiva acceso a cuentas antes bloqueadas] → Es consecuencia del acuerdo: al autenticarse en HomeSuite conservan sus membresías de tablero vigentes. Eliminar una membresía sigue siendo el mecanismo de revocación de ese tablero.
- [Copia SQL íntegra con archivos faltantes] → Manifiesto D1/R2, checksums y restauración conjunta obligatorios antes del corte.
- [Cambio de ruta/CSP rompe interacción] → Reutilizar E2E de TasKing sobre el origen HomeSuite y comprobar móvil, teclado, foco, estilos, descargas e imports.
- [Regresión de plataforma por límites o rutas] → Namespace propio y regresiones de `/api/me`, CSRF, finanzas, perfil y assets reales.
- [Trabajo activo en paralelo] → La PWA ya está integrada en la base revisada: probar su actualización instalada y privacidad, no dejarla como comprobación condicional. Coordinar perfil, baja de cuenta y esquema al aplicar; no afirmar capacidades pendientes como implementadas.
- [Carga extra o N+1] → Conservar los presupuestos de dominio y revisión consistente de ADR-016; medir por separado la sesión de plataforma y justificar cualquier diferencia frente a `test/backend-performance.test.js`.

Revisión adicional de uso y seguridad (riesgos, no incidentes remotos demostrados):

| Riesgo | Evidencia y mitigación exigida antes del corte |
|---|---|
| Dos versiones o vuelta accidental al origen | Assets-first, crons y scripts viejos existen. Exigir puente sin app/bindings, cerrojo persistente, inventario de hosts/previews y publicación al 100 %, con intentos negativos de escritura. |
| Marcador compartido termina en login sin tarjeta | `?card` existe. Conservar identificador permitido y retorno completo a través de OAuth; autorización posterior, mensajes de recurso ausente/ajeno sin filtración. |
| Callback o redirect filtra credenciales | Destino fijo, sin reenvío de `code/state`, sin redirects de mutaciones, sin query/fragment arbitrario ni logs sensibles. |
| XSS de Tareas alcanza finanzas | Origen compartido amplía impacto; revisar interpolaciones/URLs, CSP y archivos activos. Pruebas de payloads heredados hostiles y cabeceras reales. |
| Cuenta errónea, email reasignado o rol admin mal vinculado | Google `sub` no está en el origen. Distinguir email verificado de autoridad/continuidad, bloquear ambigüedades y conciliar administradores antes del corte. |
| Invitaciones o endpoints exponen lista global de usuarios | Presentar sólo identidades necesarias por tablero; probar ajenos y no devolver directorio de usuarios de HomeSuite en búsquedas o errores. |
| Nuevas cuentas agotan almacenamiento o memoria | La allowlist desaparece; límites efectivos por cuenta/ruta, tamaño/cantidad y procesamiento acotado, comprobando fallos sin archivos huérfanos. |
| Pérdida de borrador o doble envío tras timeout | Cliente de transición con borrador visible y reintentos detenidos; drenar operaciones en curso y conciliar lo confirmado antes del snapshot. |
| Caché conserva una UI o archivo anterior | No prometer borrado remoto de copias locales; probar cache caliente/SW, no-store privado y cierre server-side de todos los caminos antiguos. |
| Backups expuestos como adjuntos | Origen comparte bucket para SQL y uploads; copiar sólo archivos referenciados, buckets privados y negativas de descarga de `backups/*.sql`. |
| Degradación del destino o restauración afecta Cuentas Claras | Fallar con continuidad explicada sin segunda app; recuperación por dominio que preserve escrituras financieras y de Tareas. |

Fuentes técnicas consultadas el 2026-11-09: [ruteo de assets de Workers](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [versiones y deployments](https://developers.cloudflare.com/workers/versions-and-deployments/), [HTTP Location y fragmentos](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), [Google y autoridad sobre emails](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). El aviso con botón para entradas humanas y los redirects acotados a compatibilidad de recursos son decisiones de este diseño; el aviso sustituye la propuesta anterior de redirect automático de entrada, según la aclaración de Pablo.

## Migration Plan

1. Implementar en cortes compatibles: esquema/módulo inaccesibles al uso normal; adaptación de UI/seguridad/assets/favicon; herramientas de traslado; guardia y cliente transitorio del origen; puente sin negocio y protección de despliegues preparados desde el principio. No activar producto en HomeSuite por desplegar tablas.
2. Ensayar con snapshot sintético del esquema actual, con personas sin HomeSuite, roles distintos, archivos, actividad y datos financieros preexistentes. Verificar reintentos, colisiones y fallo parcial. Restaurar D1 y R2 en un destino aislado y comparar manifiestos, restricciones y triggers.
3. Verificar el mismo SHA en staging con dos cuentas Google reales y recursos de su ambiente: entrar/salir, recuperar tableros, invitar, quitar acceso con sesión activa, comprobar aislamiento y adjuntos. Coordinar el SHA activo y registrar evidencia. No copiar producción a staging.
4. Preparar runbook con destinos, matriz completa de URLs/métodos/MIME, inventario remoto de aliases/previews/crons, cobertura, tiempo de mantenimiento medido, avisos de la propia interfaz, responsables, criterios de aborto y retención de copias. Verificar de antemano el aviso firmado por Pablitux, su botón y el cerrojo persistente, sin campaña manual a usuarios. Obtener aprobación de publicación conforme a operación; la propuesta no la concede.
5. Respaldar destino HomeSuite y origen TasKing más archivos. Bloquear/drenar el origen, generar snapshot final y cargar sólo el dominio en destino. Conciliar entidades/relaciones, ausencia de personales duplicados, archivos y conservación de finanzas. Cualquier diferencia bloquea activación.
6. Con origen bloqueado y copia conciliada, activar el puente antiguo al 100 % y habilitar destino como único escritor. Durante el intervalo, el puente muestra continuidad/mantenimiento; no sirve dos apps. Hacer smoke de login/logout, tablero, edición, permisos, archivos, favicon, enlaces viejos y coherencia, incluida pestaña antigua y PWA previa. Publicar primero app y luego sitio si sus enlaces cambian. Registrar SHA, versiones, lote y resultado.
7. Verificar retiro de caminos activos de lista global, solicitudes, OAuth/cookie y configuración ya sin uso; mantener el puente sin acceso a datos, confirmar bloqueos de redeploy/rollback y observar fallos de navegación/API sin datos personales en logs. Actualizar documentación y conservar recuperación según el runbook. Retirar datos/infraestructura de respaldo es una operación separada; el host puente sigue disponible y no se elimina automáticamente.

Rollback: antes de admitir escrituras en destino, abortar la activación y reabrir el origen conciliado; las tablas aditivas HomeSuite pueden quedar deshabilitadas sin tocar finanzas. Después de la primera escritura en destino, mantener el origen cerrado: preservar D1/R2 de destino y reparar o planificar una recuperación conciliada. Un revert de Worker no vuelve actual a la copia antigua ni autoriza restaurar toda la base HomeSuite sobre cambios financieros nuevos.
