## Context

Motivación y alcance en [proposal.md](proposal.md). Base inspeccionada: `origin/main`, `3fe9cd6`, actualizada el 2026-11-09. Sólo se preparan artefactos; no se inspeccionaron datos privados ni recursos desplegados.

Hechos relevantes del código:

- `src/index.js` compone Hono, rutas de dominio y autenticación propia. `src/db/helpers.js` crea el personal y consulta membresías por email. No existe vínculo persistido con Google `sub` en TasKing.
- `src/routes/boards.js` agrega integrantes directamente por email, llama a `ensureUser` incluso para personas aún no autenticadas y permite quitar integrantes sólo al titular. No hay aceptación de invitaciones como en los grupos de HomeSuite.
- Las migraciones `0001`–`0015` cubren tarjetas, tableros, perfiles, administración, actividad, límites, etiquetas, solicitudes, checklists, objetivos, columnas, temas, tips y revisión persistente. `0015_board_sync.sql` contiene triggers cuya semántica debe conservarse.
- `src/routes/uploads.js` sirve `/uploads/:key` con autenticación independiente y usa `BUCKET`. TasKing limita cada archivo a 20 MB; HomeSuite limita por defecto las mutaciones a 16 KiB. Copiar los handlers sin adaptar middleware rompería las subidas.
- `public/js/core/api.js` llama a `/api/*` sin CSRF; `card-modal.js` sube archivos mediante un `fetch` separado. `public/index.html` y los módulos usan estilos inline. HomeSuite exige sesión/CSRF y CSP más estrictas.
- `apps/app/src/routes/shell.js` sirve `/tareas` como página puente. `apps/app/src/users.js`, `sessions.js`, `profiles.js` y `csrf.js` ya ofrecen identidad estable, sesión y perfil comunes. `GET /api/me` tiene consumidores de plataforma y no puede sustituirse por el payload de TasKing.
- El flag `is_admin` de TasKing administra también estadísticas y roles, además de la lista global. Retirar la lista no autoriza eliminar las otras funciones ni promover esas personas a administradoras de HomeSuite.

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
- Servir datos y adjuntos privados con política de caché que vuelva a comprobar sesión y membresía; evitar almacenar privados en un service worker si la PWA entra antes. El trabajo PWA está en otra rama y no es dependencia para esta propuesta.

Las claves `tasking-theme`, `tasKingBoardId` y opciones de pulso viven en el origen antiguo. No se promete recuperación entre orígenes ni se envían preferencias por query. Mantener valores predeterminados y permitir la selección habitual; el tema del tablero y el tip almacenados en D1 sí se trasladan.

### 5. Transferencia operativa completa y acotada

Crear herramienta versionada de extracción/carga/conciliación del dominio con manifiesto, versión de esquema, origen, ambiente, lote y hash de contenido por entidad/archivo. No cargar un SQL completo de TasKing sobre HomeSuite ni usar su export JSON/CSV de tarjetas: no cubre el sistema entero. Guardar material privado fuera de Git, Dropbox y logs.

Cobertura mínima: identidades, tableros/opciones/revisión, membresías/roles, columnas, tarjetas/asignaciones, comentarios/autoría, metadatos y bytes de adjuntos, etiquetas/relaciones, checklists/ítems, objetivos/relaciones, actividad, configuración administrativa aún aplicable y tip. Excluir del modelo activo cookies, tokens, solicitudes de acceso, lista global y logs transitorios de rate limiting. Los respaldos del origen conservan la evidencia anterior según el runbook; no borrarla por la mera carga.

Usar un bucket de adjuntos HomeSuite por ambiente con binding propio de Tareas; copiar preservando claves y metadatos y comprobar tamaño y checksum de bytes. No usar el bucket de backups como almacenamiento activo ni compartir un bucket de producción con staging. Incorporar ese bucket a recuperación: un respaldo sólo de D1 no cubre Tareas.

La carga final usa staging lógico por lote no visible hasta completar conciliación. Cada clave heredada se carga idempotentemente con hash: misma clave/contenido no duplica, payload distinto requiere detectar y resolver la discrepancia, sin sobrescribir una versión ya activa. Los ensayos con datos sintéticos se hacen en destinos descartables aislados. No mezclar copias de ensayo con el destino final; impedir el uso de Tareas en HomeSuite antes de completar el corte.

### 6. Transición con un único escritor

La preparación y pruebas no cambian la autoridad del origen. Para el traslado final se propone una ventana breve de mantenimiento explícito, ensayada y acordada antes de publicar; no se propone coexistencia con dos copias editables ni sincronización bidireccional.

El bloqueo del origen abarca todas las mutaciones, OAuth/aprovisionamiento, tips que se escriben desde GET, API, subidas/borrados R2 y tareas programadas con efectos relevantes. Detener admisión y esperar las peticiones ya admitidas antes del snapshot final; comprobar que no quedan cargas parciales. Bloquear sólo POST sería insuficiente. La guardia debe vivir en servidor y cubrir pestañas antiguas.

Después de conciliar, habilitar Tareas en HomeSuite y convertir el origen en entrada hacia ella. El destino valida sesión nueva de HomeSuite; no intercambiar cookies. Mantener correspondencia de enlaces a tarjetas/tableros cuando los identificadores lo permitan; enlaces de archivos antiguos requieren autenticación y autorización en el destino, sin redirigir mutaciones ni reproducirlas automáticamente.

Alternativas descartadas: un traslado en caliente sin bloqueo pierde cambios; dos escritores obligan a implementar replicación y conflictos ajenos a esta migración. Usuarios escasos permiten un corte controlado, pero no justifican omitir datos o recuperación.

## Risks / Trade-offs

- [Vínculo inicial sin `sub` histórico] → Usar sólo el email verificado por Google, fijar después el vínculo estable y bloquear conflictos. Declarar el límite para cambios previos de email; no fingir una correspondencia demostrada.
- [Autorización global retirada reactiva acceso a cuentas antes bloqueadas] → Es consecuencia del acuerdo: al autenticarse en HomeSuite conservan sus membresías de tablero vigentes. Eliminar una membresía sigue siendo el mecanismo de revocación de ese tablero.
- [Copia SQL íntegra con archivos faltantes] → Manifiesto D1/R2, checksums y restauración conjunta obligatorios antes del corte.
- [Cambio de ruta/CSP rompe interacción] → Reutilizar E2E de TasKing sobre el origen HomeSuite y comprobar móvil, teclado, foco, estilos, descargas e imports.
- [Regresión de plataforma por límites o rutas] → Namespace propio y regresiones de `/api/me`, CSRF, finanzas, perfil y assets reales.
- [Trabajo activo en paralelo] → Coordinar perfil, PWA, baja de cuenta y esquema al aplicar. Incorporar identidades/tablas/archivos de Tareas a la cobertura de futuros export/baja sin afirmar que esos cambios están implementados.
- [Carga extra o N+1] → Conservar los presupuestos de dominio y revisión consistente de ADR-016; medir por separado la sesión de plataforma y justificar cualquier diferencia frente a `test/backend-performance.test.js`.

## Migration Plan

1. Implementar en cortes compatibles: esquema/módulo inaccesibles al uso normal; adaptación de UI/seguridad; herramientas de traslado; guardia de mantenimiento del origen. No activar producto en HomeSuite por desplegar tablas.
2. Ensayar con snapshot sintético del esquema actual, con personas sin HomeSuite, roles distintos, archivos, actividad y datos financieros preexistentes. Verificar reintentos, colisiones y fallo parcial. Restaurar D1 y R2 en un destino aislado y comparar manifiestos, restricciones y triggers.
3. Verificar el mismo SHA en staging con dos cuentas Google reales y recursos de su ambiente: entrar/salir, recuperar tableros, invitar, quitar acceso con sesión activa, comprobar aislamiento y adjuntos. Coordinar el SHA activo y registrar evidencia. No copiar producción a staging.
4. Preparar runbook con destinos, cobertura, tiempo de mantenimiento medido en ensayo, responsables, criterios de aborto y retención de copias. Obtener aprobación de publicación conforme a operación; la propuesta no la concede.
5. Respaldar destino HomeSuite y origen TasKing más archivos. Bloquear/drenar el origen, generar snapshot final y cargar sólo el dominio en destino. Conciliar entidades/relaciones, ausencia de personales duplicados, archivos y conservación de finanzas. Cualquier diferencia bloquea activación.
6. Habilitar destino como único escritor; activar enlaces/redirección antigua y hacer smoke de login/logout, tablero, edición, permisos, archivos y coherencia. Publicar primero app y luego sitio si sus enlaces cambian. Registrar SHA, versiones, lote y resultado.
7. Tras aceptación, retirar caminos activos de lista global, solicitudes, OAuth/cookie y configuración ya sin uso; actualizar documentación y conservar recuperación según el plazo definido en el runbook. Retirar infraestructura antigua y purgar sus respaldos no se ejecuta implícitamente al aceptar esta propuesta.

Rollback: antes de admitir escrituras en destino, abortar la activación y reabrir el origen conciliado; las tablas aditivas HomeSuite pueden quedar deshabilitadas sin tocar finanzas. Después de la primera escritura en destino, mantener el origen cerrado: preservar D1/R2 de destino y reparar o planificar una recuperación conciliada. Un revert de Worker no vuelve actual a la copia antigua ni autoriza restaurar toda la base HomeSuite sobre cambios financieros nuevos.
