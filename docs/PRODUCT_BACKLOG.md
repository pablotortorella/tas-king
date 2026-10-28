# 📋 PRODUCT BACKLOG — FUN TasKing!

## Base común: controles por completar (2026-10-24)

Seguimiento de la [matriz de cumplimiento](homesuite/README.md#cumplimiento-conocido-al-adoptar-la-base).
Responsable de priorización/revisión: Pablo; implementación a asignar al abrir cada cambio.
Los ítems restantes no quedan cerrados por el despliegue de staging.

- **Prioridad alta — Exportación y eliminación administrada de un grupo (bloquea aceptar datos financieros reales en producción).** Hoy el export de infraestructura da un SQL de recuperación, no una exportación entendible, y no hay borrado de un grupo. Debe existir, según [ciclo de vida de datos](HOMESUITE_DATA_LIFECYCLE.md): (1) exportación de un grupo con miembros, movimientos, componentes, moneda, revisiones y eventos en un formato documentado; (2) eliminación administrada del grupo completo, con confirmación reforzada y autorización exclusiva de quien corresponda; (3) exportación previa a la eliminación y comprobación de que no quedan filas financieras huérfanas; (4) política para solicitudes de eliminación de cuenta cuando la identidad siga siendo necesaria en libros compartidos o auditoría. Anular o editar un movimiento sigue creando una revisión, no reescribe el pasado. Aceptación: exploración con Pablo (`/opsx:explore`), change con pruebas de autorización y de integridad, y el ensayo de exportar, eliminar y restaurar sobre una base descartable. Decidido el 2026-10-28: se hace después del primer deploy, antes de abrir producción a datos reales.
- Automatizar la verificación previa al deploy de HomeSuite App y sitio. Las suites específicas entraron a CI el 2026-10-25; el comando de deploy aún no las encadena. Aceptación: fallos de cada suite bloquean la publicación.
- Hacer verificable la correspondencia entre SHA revisado, staging y producción; coordinar el uso compartido de staging. Aceptación: rechazo o detección explícita de una versión distinta antes de publicar.
- Revisar la detección de secretos de `verify-ready` y definir control efectivo. Aceptación: un fixture sintético demuestra detección sin exponer secretos reales.
- Corregir el aislamiento de `scripts/db-restore.sh` local: hoy elimina `.wrangler/state` completo. Aceptación: restaurar en estado descartable sin borrar D1/R2 ajenos al ensayo.
- Ensayar restauración aislada completa de TasKing y definir/comprobar recuperación y ciclo de vida de datos de HomeSuite antes de información irreemplazable. Incluir índices, triggers y archivos aplicables; registrar RPO/RTO y resultados.
- Seguir la primera ejecución programada del respaldo diario de HomeSuite, comprobar la notificación de fallos y acordar RPO/RTO. El ensayo manual del workflow del 2026-10-27 verificó exportación, carga en R2, descarga y restauración de la base vacía; no prueba aún el cron ni el comportamiento con datos reales.
- **Consulta pendiente — alcance del token de backup D1.** Comprobar en Cloudflare si `D1 Edit` del token guardado en GitHub como `HOMESUITE_PROD_BACKUP_API_TOKEN` se limita a `homesuite-app-db` o abarca todas las D1 de la cuenta, incluidas las de TasKing. El backup exitoso no demuestra ese alcance. Si es global, evaluar el riesgo y una alternativa antes de declarar cumplido el acceso mínimo. Aceptación: alcance verificado en el panel, decisión y mitigación registradas en [recuperación](HOMESUITE_RECOVERY.md); responsable de revisión: Pablo.
- Automatizar enlaces internos de documentación en CI. Aceptación: un enlace local roto falla y los enlaces válidos pasan sin consultar red.

## 🧘 Remanso: decisiones y riesgos pendientes (2026-10-26)

Ficha: [Remanso](productos/REMANSO.md). Primer corte en la rama `feature/remanso`
(ver [STATUS](STATUS.md)). Nada de lo siguiente está decidido ni resuelto; los ítems
marcados **investigar** requieren una investigación a fondo en internet (qué
conviene y cómo) antes de elegir, y su resultado se registra aquí.

- **Historial de sesiones** `{ fecha, minutos, fondo, ánimo }`: persona u hogar, para qué, sin rachas ni presión. Hoy el ánimo no se guarda ni se envía. Aceptación: exploración con Pablo; si se guarda, migración, privacidad y export definidos.
- **Publicar Remanso en producción** (app y sitio público). La placa y la landing existen y funcionan en staging; el sitio de producción dice «en preparación». Aceptación: aprobación explícita de Pablo, publicación de la app y el sitio por separado según [operación](homesuite/OPERACION.md), y la landing de producción con enlace real a la app.
- **Elección del gong en el perfil** para que siga a la persona entre dispositivos (hoy vive en el dispositivo). Aceptación: exploración con Pablo; si se guarda en el servidor, migración compatible, API con CSRF y qué pasa sin cuenta.
- **Más sonidos de gong o campanas** si hace falta; hoy son tres (brillante, profundo, cuenco) y los dos últimos requieren cuenta.
- **Modo oscuro para todo el shell de la app.** Hoy sólo Remanso adapta el encabezado. Aceptación: tokens compartidos y snapshots de las demás rutas actualizados con revisión visual.
- **Investigar: iPhone en modo silencio.** Web Audio probablemente no suene con el interruptor activado. Hallazgo de la búsqueda del 2026-10-28 (fuentes: boletines de WebKit y guías de desarrollo, no documentación oficial): iOS trata Web Audio como sonido «ambiente», que obedece el interruptor, mientras que los elementos de medios lo ignoran; desde iOS 17 se puede pedir `navigator.audioSession.type = "playback"` (con detección de la función; evitar los tipos «transient»), y antes se usaba un `<audio>` silencioso de un segundo (con el efecto lateral de mostrar controles de medios en la pantalla de bloqueo). No hay API para leer el estado del interruptor; un botón propio de silencio es un respaldo. Nadie en el equipo tiene iPhone (decisión de Pablo): opciones para probarlo son una persona con iPhone con una lista de pasos, un servicio de dispositivos reales en la nube (BrowserStack o similar; precios sin verificar) o Playwright con WebKit, que no reproduce el interruptor ni el bloqueo. Aceptación: prueba en un dispositivo real en ambas posiciones y solución o aviso decidido; si se implementa la línea de `audioSession`, queda sin verificar hasta esa prueba.
- **Investigar: pantalla bloqueada o app en segundo plano.** El audio puede cortarse; el Wake Lock no se renueva al volver a la pestaña. Evaluar PWA/app nativa con reproducción en segundo plano. Aceptación: opciones comparadas con fuentes y decisión.
- **Investigar: arranque suspendido del audio.** En Firefox headless ~1 de cada 8 inicios queda «En pausa» hasta pulsar «Reanudar». Aceptación: reproducir en iOS/Android reales y decidir si la interfaz debe reintentar.
- **Volumen relativo entre fondos:** calibrado a mano. Aceptación: escuchar los seis seguidos en el teléfono y ajustar.
- **Investigar: fondos sintetizados vs. grabados.** Sintetizados no tienen licencias ni peso pero suenan menos reales; si se pasa a grabaciones, verificar la licencia de cada archivo (p. ej. CC0). Si el nivel con cuenta llegara a incluir grabaciones, mover la restricción de nivel al servidor.
- **Segundo motor de navegador (WebKit/Safari)** para las pruebas automáticas de Remanso; hoy Chromium y, de forma opcional e intermitente, Firefox.

**Última actualización**: 2026-10-26
**Reemplaza a**: `PROJECT_BACKLOG.md` (raíz) y `docs/backlog.txt` — unificados y borrados el 2026-07-04.

Este es el documento madre de prioridades del producto: qué falta, por qué importa, y con qué nivel de detalle ya está pensado. Para el historial de qué se implementó y cómo, ver [`docs/STATUS.md`](STATUS.md).

---

## Identidad de marca: aplicación pendiente (2026-10-26)

Origen: [Identidad y visión](HOMESUITE_IDENTIDAD_Y_VISION.md), §11. Son tareas de
exploración y revisión, no un roadmap comprometido; ninguna autoriza cambios de código,
logo ni paleta por sí sola. Priorización y aprobación: Pablo.

- Explorar el alcance individual de Cuentas Claras (registro sin grupo, estructura mínima, privacidad, paso a compartido) antes de reflejarlo en landing o app.
- Definir el alcance individual de TasKing y Compras y su comunicación.
- Revisar la identidad visual actual (emblema y favicon) antes de proponer cambios. El acento por producto ya se aplicó (2026-10-27, `acentos-y-catalogo-publico`); el azul verdoso de Compras queda definido y sin uso.
- Volver a publicar Compras en el sitio cuando la herramienta exista: mover `apps/site/pendientes/compras.html` a `public/`, reponer su tarjeta y los enlaces de las otras landings, y darle su clase de acento.
- Decidir si y cómo comunicar productos en exploración (Rituales, Momentos, Bitácora) y sus nombres definitivos. «Pausa» salió el 2026-10-27: Remanso, la herramienta de meditación ya integrada, ocupa su lugar.
- Definir estrategia de idioma/localización y privacidad/modelo de datos para herramientas de bienestar.

---

## 🔄 Cómo mantener este documento actualizado

- **Fuente única**: toda idea nueva, pedido de Pablo, o feature pendiente se agrega acá — no se crean archivos de backlog paralelos.
- **Al completar algo**: mover el ítem a "✅ Completado", con la fecha. El detalle técnico de la implementación va en `docs/STATUS.md`, no acá — acá solo queda la referencia.
- **Al surgir una idea nueva**: agregarla en la sección de prioridad que corresponda (🔴 Prioritario, 🟠 Alta, 🟡 Media, 🟢 Baja/futuro), con esfuerzo estimado si se conoce (🟢 chico · 🟡 medio · 🔴 grande).
- **Al re-priorizar**: mover el ítem entre secciones — no hace falta pedir permiso para reordenar, solo para decidir qué se hace *ahora*.
- **División de responsabilidades**:
  - `docs/PRODUCT_BACKLOG.md` (este archivo) → **qué falta y por qué** (prioridades, visión, ideas).
  - `docs/STATUS.md` → **qué existe y cómo** (implementación, tests, fecha de cada sesión).
  - `docs/ADRs.md` → **por qué se decidió así** (decisiones de arquitectura).

---

## 🏠 Horizonte de producto: HomeSuite

**Estado:** visión y MVP documentados; landing pública en producción desde el
2026-09-21 en `https://homesuite.info/`, con `www` redirigido al apex. La suite
autenticada funciona en staging; el núcleo cotidiano de Cuentas Claras está en
una rama de revisión y Compras aún no está implementada. Esto no reemplaza
automáticamente el foco vigente de TasKing.

HomeSuite será la marca paraguas en `homesuite.info` para herramientas de la vida
cotidiana del hogar (ver [identidad](HOMESUITE_IDENTIDAD_Y_VISION.md)). La dirección acordada es reutilizar Cloudflare, autenticación y
operación mediante un monorepo. El sitio público tendrá un Worker sin datos ni
sesión; la aplicación autenticada será un monolito modular con staging aislado,
manteniendo separados los dominios de Tareas, Cuentas Claras y Compras.

Orden estratégico inicial:

1. plataforma mínima: identidad estable, sesión, grupos e invitaciones;
2. **Cuentas Claras**, con el objetivo concreto de reemplazar Splitwise;
3. migración gradual de TasKing a `/tareas`, sin big bang;
4. **HomeSuite Compras**, reutilizando la plataforma colaborativa.

Los ingresos compartidos que afectan el saldo neto sí forman parte del MVP.
Presupuesto, análisis global de ingresos del hogar y flujo de caja son una evolución
prevista, no parte del primer producto financiero. Antes de implementar cada etapa
se seguirá el ciclo OpenSpec completo y se incorporarán sus tareas concretas a las
prioridades de este backlog.

Documentación fuente:

- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [Infraestructura, dominios y repositorio](HOMESUITE_INFRASTRUCTURE.md)
- [MVP de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_MVP.md)
- [Brief de exploración de Cuentas Claras y referencia de Tricount](HOMESUITE_CUENTAS_CLARAS_EXPLORACION.md)
- [User Journey de entrada y migración de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_JOURNEY.md)
- [User Story Map de Cuentas Claras](HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md)
- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)

### Corte activo: plataforma mínima de Cuentas Claras (A)

Estas son User Stories candidatas. Están ordenadas por dependencia de producto,
no son tareas técnicas ni un change OpenSpec activo. Cada propuesta se dividirá
en un change pequeño al llegar a `propose`.

#### Capacidad transversal posterior: perfil de HomeSuite

Una vez que la identidad Google y la sesión real estén resueltas, HomeSuite debe
ofrecer un perfil único para la suite: nombre visible, avatar emoji y color. El
perfil base se identifica por el mismo usuario interno vinculado al `sub` de
Google y puede mostrarse en Cuentas Claras, TasKing y futuros productos.

No se copiarán datos entre productos ni se compartirán sus preferencias: cada
producto conservará su configuración propia. Antes de leer el perfil existente
de TasKing o migrarlo, se definirá un contrato explícito y una migración
consentida; hasta entonces, el perfil de HomeSuite será su fuente de verdad. Así
evitamos acoplar la nueva plataforma a la cookie, la base o el Worker actual de
TasKing.

| Orden | Historia | Resultado observable |
|---|---|---|
| HP-01 | Como persona usuaria, quiero editar mi nombre visible, avatar emoji y color desde HomeSuite para que mi identidad se vea de forma consistente en los productos de la suite. | Los productos que ya usan la plataforma muestran el mismo perfil base, sin duplicar datos personales. |
| HP-02 | Como persona usuaria con perfil previo en TasKing, quiero que HomeSuite pueda proponer reutilizarlo de forma segura para no cargarlo de nuevo. | Sólo tras autenticación con la misma identidad estable y confirmación explícita se copia el perfil; los datos y preferencias de TasKing permanecen aislados. |

#### Capacidad transversal posterior: administración y temas de la suite

La titularidad de un grupo no equivale a administrar HomeSuite. Existirá un
rol técnico y explícito de **administración de la suite**, inicialmente asignado
al usuario administrador de la plataforma. Su perfil ofrecerá una entrada a la
administración global y a la de cada producto habilitado.

La primera consola deberá priorizar salud y operación: usuarios, grupos,
invitaciones, uso por producto y conteos agregados de registros (por ejemplo,
transacciones). El acceso al contenido privado de un grupo o a movimientos
individuales no será implícito por ser administrador: requerirá una capacidad
separada, justificación visible y auditoría, si alguna vez resulta necesaria.

Los temas visuales también serán una capacidad compartida, con tokens comunes
que cada producto aplica sin perder su propia interfaz. La nomenclatura y la
paleta inspiradas en América Latina se explorarán cuando Cuentas Claras sea
usable; no se congelan nombres ni colores antes de esa conversación de diseño.

| Orden | Historia | Resultado observable |
|---|---|---|
| HA-01 | Como administrador de HomeSuite, quiero acceder desde mi perfil a una consola de suite y a las administraciones de productos para operar la plataforma sin confundir ese poder con la titularidad de un grupo. | El acceso sólo aparece y funciona para administradores de plataforma; toda acción administrativa queda auditada. |
| HA-02 | Como administrador, quiero ver indicadores agregados de usuarios, grupos y uso de cada producto para conocer el estado de la suite sin exponer contenidos privados por defecto. | La consola muestra métricas agregadas y separa expresamente cualquier acceso excepcional a datos individuales. |
| HT-01 | Como persona usuaria, quiero elegir temas visuales coherentes entre productos para reconocer mi experiencia de HomeSuite en Tareas, Cuentas Claras y Compras. | La selección usa tokens compartidos; cada producto conserva su composición y preferencias específicas. |
| HT-02 | Como persona usuaria, quiero temas con nombres e historias inspirados en América Latina para que la suite tenga una identidad cercana y no genérica. | La paleta y sus nombres se definen en una exploración visual posterior, con referencias culturales cuidadosas y sin apropiación superficial. |

| Orden | Historia | Resultado observable |
|---|---|---|
| HG-01 | Como titular, quiero iniciar sesión y crear un grupo con mi libro de Cuentas Claras para tener una frontera privada y un punto de partida propio. | El titular ve únicamente su grupo y su libro nuevo. |
| HG-02 | Como titular, quiero invitar a una persona por email para que ambos veamos el mismo libro sin compartir una cuenta. | La invitación se acepta una vez; ambas personas acceden al mismo grupo y no a grupos ajenos. |
| HG-03 | Como titular, quiero previsualizar un CSV de exportación de Splitwise y mapear sus participantes para saber qué se importará antes de guardar. | Se distinguen participantes, movimientos y fila de resumen; se muestran conteos y saldos previstos por moneda. |
| HG-04 | Como titular, quiero decidir qué hacer ante cada incidente de importación para no perder control sobre mi historia. | Cada incidente muestra fila y motivo; puedo cancelar, aplicar un supuesto explícito o importar el subconjunto seguro. |
| HG-05 | Como titular, quiero confirmar una importación idempotente y ver su conciliación para confiar en los saldos migrados. | El lote registra origen, supuestos y filas no importadas; compara saldos; un reintento no duplica dinero. |
| HG-06 | Como integrante, quiero registrar un gasto compartido simple después de importar para continuar mi uso cotidiano. | Un pagador, dos participantes y división igual actualizan el saldo y la cronología de ambos. |
| HG-07 | Como integrante, quiero buscar libremente por texto, participante o monto para encontrar movimientos propios e importados en una sola lista. | La búsqueda normaliza texto, incluye total y efecto individual, explica la coincidencia y marca el origen importado. |

**Estado 2026-09-22:** `plataforma-homesuite-minima` está en WIP. PR #59 dejó
integrados Worker aislado, esquema D1, restricciones de owner/invitación y demo
local. El corte en curso convierte creación de grupo e invitación en operaciones
D1 locales cubiertas por integración; Google OAuth, sesión host-only, staging y
producción siguen pendientes. Después, `importacion-splitwise-inicial` cubre
HG-03 a HG-05; no se mezclarán autenticación, modelo financiero y parser de
importación en un solo change.

**Estado 2026-10-23:** el recorrido con dos cuentas y la base financiera están
verificados en staging (#68 y #71, aún abiertos). La rama
`feature/homesuite-financial-core` implementa HG-01, HG-02 y el uso cotidiano
de HG-06, además de ingresos, transferencias, balances, correcciones y
exportación. HG-03 a HG-05 y HG-07 quedan para el cambio de importación y
búsqueda. No hay publicación productiva de Cuentas Claras.

**Avance del mismo corte:** `feature/homesuite-splitwise-import`, apilada sobre
el núcleo, implementa HG-03 a HG-05 y HG-07 con CSV, mapeo, incidentes,
conciliación, importación idempotente y búsqueda conjunta. Falta integrar y
validar ambas ramas en staging antes de cambiar el estado de estas historias a
completado.

**Ajustes de revisión 2026-10-23:** la rama apilada
`feature/homesuite-review-feedback` amplía monedas a Sudamérica y México,
incorpora URLs de grupo legibles pero estables, lleva a la segunda cuenta
directamente a sus invitaciones pendientes y permite buscar fragmentos de
montos ignorando separadores de miles.

---

## ✅ Completado

| # | Feature | Notas |
|---|---|---|
| #0 | 🔗 Deep-link a tarjeta | |
| #1 | 📜 Historial de actividad | Por tarjeta + panel de actividad del tablero, filtros por usuario/fecha |
| #2 | 🏷️ Etiquetas + filtro | Atajos numéricos 0-9, hasta 10 por tablero |
| #3 | ✅ Checklists / subtareas | |
| #4 | 🔐 Proteger adjuntos | |
| #5 | 🛡️ Validar JWT de Google | Hardening del login |
| #6 | 🌙 Modo oscuro/claro | |
| #7 | 📊 Lead time (a nivel tablero) | Parte de #8 — falta la versión personal, ver Media prioridad |
| #8 | 📊 Workflow Analytics Engine / ¿Cómo vamos? | MVP completo: completadas por período, burn-up, WIP, ¡Pilas con esto! (Quietas + Por vencer + Pulso WIP) |
| — | Columnas personalizables (crear/editar/eliminar/reordenar) | |
| — | Columnas de cierre múltiples (`isDone` toggle) | Desacoplado de la posición |
| — | CSP + Security Headers | |
| — | Polling en tiempo real (5s) | Reemplaza la necesidad de WebSockets/Durable Objects para el caso de uso actual |
| — | 👤 Perfil de usuario (nombre + avatar emoji + color) | |
| — | 💬 Autoría en comentarios | Autor + avatar + fecha |
| — | ✏️ Renombrar tablero desde la UI | |
| — | 🗑️ Borrar tablero | Solo dueño, tablero no personal |
| — | 💾 Backup automático (Cron + R2) | ⚠️ Corregido 2026-07-07: NO estaba operativo en prod — cron sin aplicar al worker + bug `_cf_METADATA` rompía el dump. Ver hallazgos 🔴 abajo. Falta además el push a GitHub (secrets pendientes, ver Media prioridad) |
| — | Import/Export JSON + CSV completo | Incluye etiquetas, checklists, responsable |
| — | 🎯 Objetivos (gestión por metas) | |
| — | 🎯 Pulso WIP "Dejar de empezar y empezar a terminar" | 2026-07-04 — ver detalle en `docs/STATUS.md` |
| #10 | 🎨 Temas de color (paleta oficial + selector por tablero) | 2026-07-11 — Candy Pop es el default de toda la app (Kanban + páginas públicas); Sunset Pop/Citrus Fresh/Jungle Pop seleccionables por tablero desde ⚙️ → Tema; prompt de bienvenida para el dueño en tableros sin paleta. Ver detalle en `docs/STATUS.md` |
| — | 🧹 Purga de `rate_limit_log` + backup automático operativo | 2026-07-11 — código de PR #19 (2026-07-07) ya estaba mergeado y testeado; el gap real era que el cron nunca se registraba en el worker de producción (`triggers.crons` vivía solo en `env.production`, no en el nivel raíz que usa `npm run deploy`). Fix + verificado en el log del deploy (`schedule: 0 */8 * * *`) |
| — | 🔒 Revocación de acceso efectiva | 2026-09-07 — re-chequeo de `allowed_emails` en cada request autenticado por cookie real (no en el bypass de dev/tests) + página pública `/revoked` con mensaje diferencial. Ver `docs/ADRs/ADR-015-revocacion-acceso-sesion-cookie.md` y `docs/STATUS.md` |
| — | ⚡ Mutaciones de tarjetas y etiquetas sin recargas globales | 2026-09-11 — incluida en v2.2.0. Crear/editar y asignar/quitar etiquetas actualiza el estado desde la respuesta confirmada; evita el tramo de tres lecturas que sumaba ~1,4–1,5 s en la línea base. Comprobación del 14/09 documentada; Pablo confirmó el 15/09 que toda la interacción se siente más veloz. |
| — | ⚡ Menos llamadas de backend (v2.2.1) | Producción 2026-09-14; mejora percibida confirmada por Pablo el 15/09. Ronda de performance cerrada; nuevas optimizaciones solo ante demoras observadas. |
| — | 🔒 Cabeceras de seguridad en el documento | 2026-09-17 — el diagnóstico del backlog estaba equivocado: no era que el CSP tuviera `'unsafe-inline'`, era que **ninguna cabecera de seguridad llegaba al HTML**. El Asset Worker respondía antes que el Worker, así que la app no tenía CSP ni `X-Frame-Options` (era enmarcable). El único test que lo cubría invocaba `app.request()` y se salteaba el ruteo. Ver ADR-017 |
| — | 🧩 Frontend en módulos ES | 2026-09-17 — `index.html` pasó de 4.545 a 512 líneas de markup; el JS vive en 17 módulos bajo `public/js/` con tres capas y dirección de dependencia única. Habilitó `script-src 'self'` sin `'unsafe-inline'`. Ver ADR-017 |
| — | ⌨️ Esc cierra la ayuda (F1) | 2026-09-17 — el impacto era mayor que el reportado: con la ayuda abierta el guard `.overlay.open` mataba **todos** los atajos, y como Esc no cerraba, no había salida por teclado. Se sumó a la cadena de Escape (un solo lugar decide qué cierra Esc) y se borró el código muerto. 5 tests E2E nuevos |
| — | 🔄 Sincronización de comentarios, checklists y borrados | 2026-09-15 implementada (ADR-016, migración 0015); llegó a producción el 2026-09-18 junto con la v2.3.0 |
| — | 🚦 Migrar antes de desplegar el Worker | 2026-09-18 — los scripts desplegaban antes de migrar, contra lo que pedía la documentación desde el 15/09. Con la 0015 sin aplicar en producción eso abría una ventana de 500. `test/deploy-scripts.test.js` verifica el orden |

| — | 📱 Tip diario completo en móvil, etiquetas en tarjeta nueva y teclado en checklists | 2026-10-23 — v2.3.1 (PRs #65, #66 y #67). `100dvh` en el `body`; `draftLabels` con el patrón de `draftGoals`; Tab/Enter/Backspace en ítems de checklist (ADR-014). Falta auditar el resto de los campos del modal con el mismo criterio de teclado. Ver `docs/STATUS.md` |
| — | 🎯 Progreso de objetivos con varias columnas de cierre + validación de columna al guardar tarjetas | 2026-10-23 — v2.3.2 (PRs #77 y #78). El progreso cuenta todas las columnas `is_done` (servidor y cliente); crear/editar/reordenar rechazan columnas inexistentes con 400 y el import manda las tarjetas desconocidas a la primera columna. Ver `docs/STATUS.md` |
---

## 🛠️ Implementado, pendiente de publicar

_Sin ítems pendientes — todo lo implementado está en producción desde el deploy v2.3.0 del 2026-09-18._

---

## 🔴 Prioritario — en foco

### #9 ¡Pilas con esto! como puerta de entrada inteligente

**Prioridad**: Alta — toca el corazón del producto.

**Visión**: hoy "¡Pilas con esto!" muestra las tareas más urgentes (por vencer) y más quietas. El siguiente paso es convertirla en la **recomendación activa** que abre la app: cuando el usuario llega, el sistema ya sabe qué debería hacer primero. La lógica de fondo siempre es la misma: **terminar algo que está empezado antes de empezar algo nuevo**.

Ideas de evolución, en orden de qué falta:

1. ✅ **Pulso periódico en tarjetas WIP** — completado 2026-07-04. Ver `docs/STATUS.md`.
2. **Panel de entrada** — al abrir FUN TasKing!, en vez de arrancar directo en el tablero, mostrar brevemente "¿Por dónde empezamos hoy?" con la lista ¡Pilas con esto! como punto de partida, y un botón "Ver tablero" para continuar.
3. **Configuración de N** — permitir al dueño del tablero configurar cuántas tareas muestra cada lista (default 5, máximo 10).
4. **Notificación silenciosa** — si una tarea lleva más de X días sin moverse, mostrar un badge o ícono especial en la tarjeta directamente en el tablero (sin tener que abrir el panel).

**Por qué es clave**: FUN TasKing! se posiciona como una herramienta que no solo organiza tareas sino que empuja a terminarlas. "¡Pilas con esto!" es la manifestación más directa de esa filosofía: no acumular, no olvidar, cerrar el loop.

> ✅ Los 3 hallazgos 🔴 del análisis técnico 2026-07-07 que competían en prioridad con #9 (backup no operativo, revocación de acceso, purga de `rate_limit_log`) ya están resueltos — ver ✅ Completado arriba. Quedan los hallazgos 🟠/🟡/🟢 de la sección 🩺 más abajo, ninguno crítico.

---

## 🟠 Alta prioridad

- **Onboarding para usuarios nuevos**: primer login → tablero vacío sin guía. Opciones: estado vacío con instrucciones ("Creá tu primera tarjeta con N"), tarjetas de ejemplo precargadas, o mini-tour de tooltips.

## 🟡 Media prioridad

- **Performance: localizar latencia residual del backend** — 🟡 esfuerzo medio. Después de aplicar y comprobar el set de mejoras estructurales, instrumentar etapas si la latencia sigue alta: rate limiting, autenticación/revocación, preparación de usuario y handler. Distinguir ejecución SQL de espera Worker-D1. Preservar revocación inmediata. Evaluar junto con “Rate limiting más granular” y el hallazgo técnico de overhead D1.
- **Performance frontend en tableros grandes** — 🟡 esfuerzo por determinar. La primera mejora todavía llama a `render()` completo después de una mutación. Capturar tiempo de clic a actualización, tareas largas, tamaño de respuesta y costo de render con un tablero representativo antes de diseñar un render incremental.
- **Guardados con recursos relacionados** — 🟡 esfuerzo medio, condicionado por medición. Adjuntos, checklists y objetivos conservan varias escrituras y una relectura de la tarjeta afectada. Medir esos flujos por separado; agrupar operaciones o respuestas solo si aparecen como parte relevante de la latencia.
- **Backup a GitHub**: falta crear repo `tas-king-backups` + PAT + `wrangler secret put` (`GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPO`). R2 ya funciona cada 8h — esto es la capa off-platform adicional.
- **Lead time y tasa de completitud personal** (#7 extendido): panel "📊 Tu desempeño" en el tablero personal — tiempo promedio para completar + % de tarjetas completadas, por usuario. Backend: `GET /api/me/metrics` o agregar a `/api/me`.
- **Rate limiting más granular**: hoy hay límite global por IP. Mejorar a límite por usuario autenticado + distinguir lectura vs escritura. Menos urgente que otras piezas de seguridad ya resueltas (CSP, adjuntos protegidos, JWT).
- **Mejores adjuntos** — 🟡 esfuerzo medio (3-4h), impacto bajo-medio:
  - *Drag & drop de archivos en el modal*: listener `dragover`/`drop` en `.attachments`, agrega a `draftAttachments`, feedback visual con clase `.dragover`.
  - *Pegar imágenes desde el portapapeles*: listener global `paste` dentro del modal, leer `e.clipboardData.items`, crear blobs y agregarlos a `draftAttachments`. Permitir pegar varias imágenes.
  - *Reordenar adjuntos (drag to reorder)*: requiere columna `position` en tabla `attachments`, drag handlers por adjunto, endpoint `PUT /api/attachments/reorder`.
- **Panel lateral de actividad del tablero**: el historial existe por tarjeta y en Admin — falta un feed lateral tipo "¿qué pasó hoy en el tablero?" sin ir al panel de administración (similar a Notion/Linear).
- **Notificaciones** (asignación de tarjeta, vencimiento próximo): badge en el tab del navegador, email, o Web Push. 🟡/🔴 esfuerzo.
- **Cuentas Claras: envío de correo electrónico** (pedido por Pablo el 2026-10-27; prioridad por confirmar). Hoy invitar crea un registro: la persona invitada lo ve solo si entra con Google con ese mismo email y abre `/invitations`; nadie recibe un aviso. El primer caso es el correo de la invitación; más adelante podrían sumarse otros avisos (aceptación, recordatorios). Esfuerzo 🔴. Necesita su propia exploración: proveedor (hay Cloudflare Email Service) y dominio remitente con SPF/DKIM, qué dice el correo sin revelar datos del grupo antes de aceptar (hoy la invitación solo muestra quién invita), estado de entrega y reintentos, límites de envío por titular y por email, qué pasa si el correo rebota, y cómo se prueba sin enviar correos reales (local y staging).
- **Cuentas Claras: borrar personas del grupo** (pedido por Pablo el 2026-10-27; prioridad por confirmar). Hoy no hay forma de quitar a nadie: una persona solo puede **unirse** con otra (sus movimientos pasan a la otra y deja de figurar) y la invitación pendiente se puede cancelar. Hay dos casos distintos y conviene decidirlos por separado: **quitar a un integrante** (con acceso: pierde el acceso al grupo, sus sesiones dejan de ver los saldos, el titular no puede quitarse a sí mismo y habría que ver «salir del grupo» por cuenta propia) y **borrar una persona que participa** (con o sin cuenta, que ya figura en movimientos y saldos). Preguntas abiertas: borrar de verdad o desactivar y ocultar (los movimientos viejos no pueden quedar sin nombre), qué pasa si tiene saldo distinto de cero o movimientos, si se puede volver a invitar, qué queda en la auditoría y en las revisiones, y cómo se habla de esto en el [glosario](homesuite/GLOSARIO.md) (integrante = tiene acceso; persona = participa). Esfuerzo 🟠.

## 🟢 Baja prioridad / ideas a futuro

- **Búsqueda avanzada full-text**: hoy busca solo por título. Extender a descripción, comentarios, etiquetas, responsable.
- **Vista calendario / ordenar por fecha**: alternativa al Kanban para ver tarjetas por fecha límite.
- **Vista lista**: tabla sortable con todas las tarjetas — útil cuando hay muchas en una columna.
- **Bulk actions**: seleccionar varias tarjetas → archivar/mover/etiquetar en lote.
- **Mover tarjetas entre tableros**: útil pero de mayor esfuerzo relativo.
- **Papelera (soft-delete)**: recuperar tarjetas borradas (distinto del archivo actual, que ya permite restaurar tarjetas archivadas — evaluar si esto ya cubre la necesidad antes de construir algo nuevo).
- **Rol "solo lectura"** en tableros compartidos.
- **PWA instalable** + mejoras de mobile.
- **Cuentas Claras: categorías y subcategorías** (decidido 2026-10-26 con Pablo al unificar el lenguaje de «grupo»). Hoy «Casa» en «Casa - Otro» se llama «grupo de la categoría» (campo «Grupo», `group_name`, `group_key`, `category.group`) y choca con «grupo» como lugar compartido. Decisión: «Casa» es la categoría y «Otro» la subcategoría; el movimiento se asigna a una subcategoría. Esto reformula el modelo (`ledger_categories`, la pantalla de Categorías, filtros «Todo Casa», selectores con `optgroup`, recategorización, importación de Splitwise, pruebas) y necesita su propia exploración: qué nombre lleva lo que se asigna, cómo se muestra «Sin categoría», y qué pasa con las categorías sin subcategoría. Esfuerzo 🔴. Hasta entonces el código conserva `group` en las categorías como excepción conocida del [glosario](homesuite/GLOSARIO.md).
- **Cuentas Claras: más de un libro por grupo** (decidido 2026-10-26 con Pablo: el concepto se conserva, la capacidad queda para después). El grupo es quiénes están y quién es titular; el libro (`ledger`) es donde viven movimientos, categorías y saldos, y hoy hay uno solo por grupo (`expense_ledgers.group_id` es `UNIQUE`). Mientras haya uno, la UI habla de «grupo», «movimientos» y «saldos», y «libro» aparece cuando exista el segundo. Las rutas ya separan `/ledger/…` del grupo, así que no hay que reescribirlas. Para abrirlo hará falta decidir: cómo se crea un libro y cuál es el principal, si los saldos son por libro o del grupo, si las categorías y las personas se comparten entre libros, y cómo elige el libro la persona al entrar. Esfuerzo 🔴. Se abre como cambio propio: la base solo quita el `UNIQUE` y suma un nombre de libro.
- **Tips a medida basados en comportamiento** (explorado 2026-09-09, pensado junto con el tip diario de onboarding pero implementable por separado):
  - *Enfoque decidido*: mirada **sistémica** (el estado del flujo del tablero) mostrando además **cómo el comportamiento concreto de la persona contribuye a ese estado**. Ni acusación individual ("moviste 6 tarjetas y no terminaste ninguna") ni estadística abstracta que no le habla a nadie. Fundamento Lean: el problema es el proceso, no la persona; la persona necesita ver su aporte al flujo, no ser juzgada.
  - *Hallazgo técnico*: no requiere instrumentar nada nuevo. `audit_log` (migración 0005) ya registra `board_id | card_id | action | email | ts | details(JSON)` con 10 acciones (`card_created/moved/edited/archived/restored/deleted`, `column_created/renamed/moved/deleted`). Es un lector sobre un stream de eventos existente, no un feature de captura de datos.
  - *Riesgo principal*: molestar o sonar vigilante. Necesita control de frecuencia explícito y un grupo de UI propio, distinto del tip diario.

---

## 🩺 Hallazgos del análisis técnico (2026-07-07)

Resultado del análisis funcional y técnico completo (código, seguridad, operación, docs). La criticidad pondera **riesgo × impacto**, no esfuerzo — casi todos los fixes son chicos (esfuerzo: 🟢 chico · 🟡 medio · 🔴 grande). Al resolver un ítem: moverlo a ✅ Completado con fecha; el detalle técnico va en `docs/STATUS.md`.

### 🔴 Crítico

_Sin ítems pendientes — ver ✅ Completado._

### 🟠 Alto — bugs funcionales visibles

- **Docs de arranque desactualizadas** — 🟢 chico. `QUICK_START.md` (lectura obligatoria por sesión) congelado al 2026-06-30: menciona PRs "pendientes de merge" ya mergeados y deployados, y "69 unit + 22 E2E" (son 111+36). `STATUS.md`: la sección "Features NO Implementados" está llena de features implementadas, y dice "máx 20 etiquetas / paleta de 20 colores" cuando el código impone 10 y 10. **Impacto**: cada sesión (humana o IA) arranca con un mapa falso del proyecto.

### 🟡 Medio — endurecimiento y robustez

- **`style-src` con `'unsafe-inline'`** — 🟡 medio. Lo que quedó pendiente después de ADR-017: hay 148 atributos `style=` en el markup, y varios se generan con valores interpolados (anchos de barras de progreso, swatches de color). Los estáticos pasan a clases; los dinámicos hay que moverlos a CSSOM (`el.style.width = ...`), que el CSP sí permite. Hasta entonces `style-src` conserva `'unsafe-inline'`, declarado a propósito en `src/middleware/cors.js`. Ojo: `script-src` ya **no** lo tiene, así que el riesgo de XSS ejecutable está cerrado; esto es endurecimiento adicional.
- **Sin límites de longitud en inputs** — 🟢 chico. Título, detalles, comentarios e ítems de checklist no tienen máximo server-side (columnas y perfil sí). **Riesgo**: payloads de MB guardados en D1 por cualquier miembro.
- **Rate limit de descargas de adjuntos demasiado bajo** — 🟢 chico. `GET /uploads/:key` usa 50 req/5 min **por IP**: una oficina con NAT compartido y un tablero con muchas imágenes rompe la carga de previews. Nota: el límite se llama `uploadAttachment` pero aplica a las descargas; el POST de subida usa el límite genérico de API.
- **MIME de uploads confía en el `Content-Type` del cliente** — 🟡 medio. La whitelist mitiga (y SVG está excluido, bien); validar magic bytes sería el paso siguiente.
- **Backups en el mismo bucket R2 que los uploads** (prefijo `backups/`) — 🟢 chico. Hoy no son alcanzables vía `/uploads/:key` (requiere match en `attachments`), pero un bucket dedicado elimina la clase de riesgo de exponer el dump completo de la DB.
- **Cualquier miembro puede borrar comentarios y adjuntos ajenos** — 🟢 chico. No hay check de autoría. Puede ser decisión válida para equipos chicos — decidirlo a propósito y registrarlo en `docs/ADRs.md` (o restringir a autor + owner).
- **Overhead D1 por request** — 🟡 medio. Cada request API paga ~4-5 queries antes del handler (COUNT + INSERT del rate limit, SELECT+INSERT de `ensureUser`, `seedAdminIfNeeded`), multiplicado por el polling de 5s de cada usuario = el grueso del consumo D1. `ensureUser` podría correr solo en login/`/api/me`. (Relacionado con "Rate limiting más granular", ya listado en Media.)
- **Export CSV sin protección contra formula injection** de Excel — 🟢 chico. Celdas que empiezan con `=`, `+`, `-`, `@` se ejecutan como fórmula al abrir el CSV.

### 🟢 Bajo — limpieza

- `deniedPage()` (`src/routes/auth.js`) interpola el email en HTML sin escapar — riesgo real bajísimo (viene verificado por Google), pero escapar cuesta una línea.
- `uid()` (`public/js/core/dom.js`) puede colisionar: timestamp en ms + 5 caracteres aleatorios, y `test/frontend-dom.test.js` (500 llamadas seguidas) falló una vez en la v2.3.1 (chance ~0,2 %). Usar `crypto.randomUUID()` o un contador.
- `Logger("debug")` nunca funciona: `this.levels[level] || 1` — `debug` vale 0 (falsy) y cae a `info`.
- `DONE_COLUMN` en `src/constants.js` es código muerto desde que las columnas son dinámicas.
- `checklists.js` monkey-patchea `c.req.param` para reusar `cardWithAccess` — frágil; refactor honesto: `cardWithAccessById(db, cardId, email)`.
- Timestamps mixtos: epoch ms en casi todo, `datetime('now')` (string) en `allowed_emails`.
- `ALLOWED_ORIGINS` no incluye la URL de staging (irrelevante mientras todo sea same-origin; anotado por si algún día hay frontend separado).
- ~10 ramas locales ya mergeadas sin borrar (`feature/deep-link`, `feature/proteger-adjuntos`, …).

---

## 🗄️ Contexto histórico (decisiones ya resueltas, para no repreguntar)

- **Tiempo real vía WebSockets/Durable Objects**: evaluado y descartado por ahora — el polling cada 5s ya cubre el caso de uso de "ver cambios de otros sin recargar" con mucho menos esfuerzo/costo.
- **Epic "Workflow Analytics Engine" (ADR-013)**: era el foco de una sesión anterior a fines de completar KPIs de flujo de trabajo. Se completó como el punto #8 (¿Cómo vamos?) — la épica como tal ya no está "en curso", quedó absorbida en el backlog normal de #9 en adelante.
- **e) Múltiples tableros**: los miembros se agregan desde ⚙️ — no es un gap, ya existe.
- **c/d) Mobile IO y modal con checklists largos**: funcionan bien según feedback de Pablo, no requieren rediseño por ahora.
