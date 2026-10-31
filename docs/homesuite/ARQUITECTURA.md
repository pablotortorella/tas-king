# Arquitectura y calidad técnica de HomeSuite

Parte de la [base común](README.md). Arquitectura objetivo y alternativas en
[ADR-018](../ADRs/ADR-018-homesuite-suite-modular.md); topología y configuración en
[infraestructura](../HOMESUITE_INFRASTRUCTURE.md). Consultar STATUS para implementación.

## Fronteras y dependencias

Monorepo con sitio público aislado y aplicación autenticada como monolito modular
evolutivo. Plataforma comparte identidad, sesiones, grupos, membresías,
invitaciones y capacidades operativas; cada producto conserva entidades, reglas,
rutas y pruebas propias. No convertir tarjetas, movimientos y compras en una
entidad genérica ni anticipar servicios independientes sin señales observables.

Rutas, módulos y tablas tienen nombres inequívocos. El dominio no depende de la
UI ni de otro producto para sus invariantes. La composición conecta capacidades;
las dependencias tienen una dirección explícita y comprobable. Separar archivos
por responsabilidad y cohesión; su longitud es una señal de revisión, no un máximo
que justifique fragmentar artificialmente.

Usar llamadas directas cuando se necesita resultado, orden o propagación de error.
Reservar eventos para avisos sin respuesta esperada. Definir quién registra los
oyentes y cómo se eliminan; evitar suscripciones duplicadas. Extraer un servicio
cuando aislamiento, capacidad, releases u ownership lo justifiquen mediante un ADR.

## Contratos y datos

Validar entradas y autorización en servidor. Comprobar que cada ID relacionado
pertenece al contexto autorizado; no confiar en selectores de UI. Mantener
invariantes con restricciones y transacciones donde sea posible, más validaciones
de dominio probadas. Auditar también reordenamiento, importación y operaciones masivas.

Definir semántica de estados, cardinalidades y errores en contratos. Si una regla
existe en cliente y servidor, compartir una representación segura cuando sea
razonable o verificar equivalencia. El servidor sigue siendo autoridad. Revisar
todos los consumidores cuando una cardinalidad cambia de uno a varios.

Migraciones versionadas; preferir expansión compatible, transición y retiro en
pasos separados. Operaciones que deben persistir juntas incluyen su auditoría
en la misma unidad transaccional. Idempotencia explícita donde reintentar podría
duplicar efectos; definir clave, alcance y comportamiento ante payload distinto.

Exportación e importación declaran versión, cobertura y tratamiento de datos
inválidos. No omitir silenciosamente entidades nuevas. Un export de usuario y un
backup operativo tienen objetivos distintos; la recuperación verifica datos,
restricciones, índices, triggers y archivos relacionados cuando existan.

## Identidad, aislamiento y seguridad

Identidad interna estable; identidad Google por `sub`, email como contacto
verificado. Separar autenticación de autorización y comprobar membresías vigentes
en cada recurso, incluidos descargas, exportaciones y rutas fuera del prefijo API.
Revocar acceso debe afectar sesiones activas según un contrato explícito y probado.

Sesión exclusiva del origen autenticado; cookie host-only, segura y no accesible
por JavaScript. Protección CSRF de mutaciones, validación de destinos OAuth y del
intercambio completo. Los bypass de desarrollo requieren configuración explícita
y sólo funcionan en entornos locales; nunca rescatan una sesión revocada.

El sitio público no recibe datos, bindings ni secretos de la app. Comprobar las
cabeceras del HTML servido y sus redirecciones por el ruteo real de assets. La
política de scripts evita ejecución inline y código dinámico no confiable. Toda
relajación requiere alcance y justificación, no copiar la configuración heredada.
No registrar cookies, tokens, secretos ni payloads privados en logs.

## Consistencia, UX y accesibilidad

Una señal de sincronización debe cubrir creaciones, cambios relacionados y
borrados. Si se usa revisión persistente, escribirla atómicamente con el cambio
y leer revisión y contenido de manera consistente. Esto no resuelve por sí solo
conflictos entre ediciones: definir la política de conflicto por producto.

Evitar sondeos superpuestos; descartar respuestas viejas o de otro contexto.
Preservar borradores y foco durante reconciliación, indicar operaciones pendientes,
evitar doble envío y permitir reintentos sin simular persistencia confirmada.

Reutilizar patrones visuales del producto; teclado, foco visible, etiquetas,
contraste, estados vacío/carga/error y movimiento reducido forman parte del
recorrido. Verificar viewport dinámico y teclado móvil en dispositivo real cuando
el comportamiento dependa del navegador. Las dimensiones y atajos concretos van
en las fichas de producto.

## Performance como parte del contrato

Eliminar validaciones duplicadas, N+1 y recargas globales innecesarias. Reutilizar
resultados dentro de la petición mientras sigan siendo válidos. Separar la
inicialización del caso habitual. No cachear permisos entre peticiones sin un
mecanismo probado de vigencia y revocación.

Agrupar operaciones compatibles; un batch transaccional no equivale a SQL en
paralelo. Contar llamadas al binding y sentencias por separado. Usar concurrencia
sólo para operaciones independientes; autorización precede escrituras protegidas.
Auditoría y persistencia prometidas no se relegan a trabajo prescindible de fondo.

Cada producto define presupuestos estructurales medibles para sus flujos críticos.
Probar que el costo no crece por entidad cuando no corresponde. Instrumentar si la
causa es incierta o la lentitud persiste; no exigir una campaña de medición para
quitar trabajo redundante demostrado. Cachés, virtualización o render incremental
requieren un cuello de botella identificado y pruebas de invalidación.

Distinguir tiempo de servidor, CPU, petición y clic hasta confirmación visible.
Medir con contexto de red, dispositivo y volumen; conservar anomalías. No anunciar
p95 ni mejoras generalizables con pocas muestras. Feedback inmediato y confirmación
cercana a un segundo son objetivos de diseño para acciones simples, no un SLA ni
un resultado alcanzado. Esperas repetidas de más de dos segundos requieren revisión.
