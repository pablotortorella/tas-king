# Cuentas Claras: análisis para aplicar el rediseño sobre el código existente

Fecha: 2026-10-23 (noche). Rama: `diseno/cuentas-claras-ui`, creada desde `origin/integration/homesuite-design-base` con `origin/main` mergeado.

**Cómo leer este documento.** Cada afirmación lleva una marca:
- **[leído]** lo leí en el código o en los documentos durante esta sesión.
- **[probado]** lo ejecuté en esta sesión (tests, servidor local, capturas).
- **[supongo]** no lo verifiqué; es una inferencia.

## 0. Punto de partida (probado)

| Suite | Resultado antes de tocar nada |
|---|---|
| `npm run test:all` (TasKing: unitarios + E2E) | 101 E2E pasan |
| `npm run test:homesuite-app` | 30 pasan |
| `npm run test:homesuite-app:integration` | 32 pasan |
| `npm run test:e2e:homesuite-app` | 7 pasan |

`npm run test:all` **no** ejecuta las suites de HomeSuite (`apps/app`); hay que correr las tres de HomeSuite aparte. El worktree nuevo no trae `.dev.vars` (está en `.gitignore`): se copió del checkout principal.

## 1. Restricciones técnicas que las maquetas no cumplen (leído)

1. **CSP estricta.** `apps/app/src/index.js` envía `style-src 'self'; script-src 'self'; default-src 'self'`. Las maquetas usan `style="…"` en cada elemento y cargan Inter desde Google Fonts: **ambas cosas quedan bloqueadas**. Hay que traducir todo a clases en una hoja de estilos propia y usar una pila tipográfica del sistema (Inter queda fuera salvo que se autoaloje). Los anchos de las barras de saldo no pueden ir en `style`; se resuelven con clases `w0…w50`.
2. **Una sola hoja de estilos.** `/app.css` es una cadena dentro de `index.js`. Es el lugar natural para la paleta (un solo archivo para cambiarla; ver `theme.js` en la implementación).
3. **COP con dos decimales.** `CURRENCY_MINOR_UNITS.COP = 2` [leído]. Las maquetas muestran COP sin decimales. La pregunta abierta n.º 1 del change `libro-y-saldos` ya está respondida por el código existente (exponente 2); la vista puede redondear o no, pero eso es una decisión de producto.
4. **Los tests E2E fijan textos.** Por ejemplo `Le deben COP 50,00` debe estar en un único elemento, `COP 120,00` debe aparecer una sola vez en el detalle, el campo se llama «Nombre», y no puede haber dos enlaces llamados «Importar Splitwise». El rediseño tiene que respetarlos (se listan en la sección 5).

## 2. Tabla pantalla por pantalla

| # | Pantalla del diseño | Vista actual | Qué ya existe | Brecha visual | Brecha funcional (lógica, rutas o DB nuevas) | Contratos que podría romper |
|---|---|---|---|---|---|---|
| 1 | Nuevo grupo | `GET /spaces/new` (`index.js`) | Nombre + moneda (17 monedas), `POST /spaces` con CSRF, redirige a `/spaces/<slug>` | Encabezado con «Paso 1 de 2», campos y selector con el estilo nuevo | «¿Para qué es?» (no hay columna de propósito); «¿Quiénes participan?» al crear (hoy se agregan después); «Paso 2» | Etiqueta exacta «Nombre»; `name="name"` y `name="currency"`; `_csrf`; redirección 303 a la URL con slug |
| 2 | Punto de partida | No existe: tras crear, se aterriza en el libro vacío | «Empezar en cero» es el estado por defecto; «Importar Splitwise» (solo titular) existe | Estado vacío del libro con las dos opciones | Pantalla/ruta intermedia tras crear; «saldos anteriores» no tiene change (debe mostrarse deshabilitada) | E2E espera ver el encabezado del grupo justo después de crear; cambiar la redirección lo rompe |
| 3 | Importar desde Splitwise | `splitwise-ui.js`: subir, vista previa, revisión, lote; rutas `/ledger/import/*` | Todo el flujo: vista previa, mapeo por columna, decisiones por fila (excluir; usar moneda por defecto), conciliación, casilla de diferencia, idempotencia por huella, 2 MiB | Pasos numerados, filas de incidente con insignia «Fila N», tablas con scroll, panel de resumen | «Usar un supuesto» para la fila 12 (falta el efecto de Mateo): hoy el único supuesto es la moneda faltante; atribuir cada diferencia a filas concretas (hoy solo muestra diferencia); un solo lote confirmado por libro (índice único `splitwise_one_committed_batch_per_ledger`) | `mapping_i`, `decision_i`, `acknowledgeDifference`, `_csrf`, límite 2 MiB, textos «1 movimientos válidos · 2 incidentes · 1 filas de resumen.», «Así quedará el libro», «Importación completada» |
| 4 | Saldos | Sección «Balances» de `renderLedgerOverview` (tabla participante/moneda/saldo) | Saldos por moneda, palabras «Le deben / Debe», suma cero garantizada por validación | Tarjeta verde «Tu saldo», filas con avatar y barra, un bloque por moneda | «¿Por qué?» (pantalla 8) y «Para quedar a mano» (sugerencias): ambos requieren cálculo y rutas nuevas; selector COP/USD (se resuelve visualmente agrupando por moneda, sin lógica) | `Le deben COP 50,00` en un solo elemento |
| 5 | Movimientos y búsqueda | Sección «Movimientos» con búsqueda `GET ?q=` | Búsqueda por descripción, categoría, importe y participante, con motivo de coincidencia; marca «Importado de Splitwise» con fila | Tarjetas con ícono por tipo, quién pagó, «Tu efecto» (se calcula con datos ya cargados), contador | Paginación «Ver los N anteriores»; varios términos combinados; buscar en nota; filtros por tipo (no están en ningún spec); mostrar anulados rotulados | Etiqueta «Buscar», `name="q"`, texto «Importado de Splitwise» una sola vez por resultado |
| 6 | Agregar movimiento | `renderEntryForm` | Gasto, ingreso, transferencia; reparto igual o exacto; clave de idempotencia; envío optimista por JS | Selector de tipo, importe grande, opciones como chips, botón fijo | Reparto por % y por partes; varios pagadores; vista previa del efecto (el spec la exige; se puede hacer en el cliente, pero duplica la regla de residuos) | Nombres de campos (`type`, `amount`, `currency`, `payer`, `beneficiary`, `splitMethod`, `share_<id>`, `from`, `to`, `occurredAt`, `note`, `idempotencyKey`, `expectedRevision`), `data-optimistic`, `.form-feedback`, `role="status"` |
| 7 | Detalle y revisiones | `renderEntryDetail` | Efecto por persona, historial de revisiones, corregir y anular con permisos titular/autor | Tabla «Cómo se repartió» (datos existen: aportes, asignaciones, efecto), línea de tiempo, insignias de estado | Comentarios (tabla nueva, spec `comentarios-de-movimientos`); menú «⋯» | `.entry-amount`, enlaces «Corregir», «Anular», «Volver al libro», «Efecto original, no vigente» |
| 8 | Por qué te deben | No existe | Los efectos por movimiento ya vienen en `readLedger` | Pantalla completa | Ruta nueva y acumulado (cálculo puro). Es lectura derivada, pero el change `libro-y-saldos` la pide dentro de un modelo distinto: decidir en `explore` | — |
| 9 | Libro en escritorio | Una columna de 720 px | Todo el contenido existe en una página | Dos paneles (saldos a un lado, movimientos al otro), barra superior | Selector de herramienta Tareas / Cuentas Claras / Compras: depende de dónde vivirán las otras apps (HT-01) | — |
| 10 | Personas y acceso | «Integrantes» + «Administrar grupo» en la página del libro | Roles, invitar por email con vínculo a participante sin cuenta, cancelar invitación, agregar participante, exportar JSON/CSV; `archived_at` existe en la tabla | Tarjeta de personas con avatar, rol y estado | «Reenviar invitación» (no existe); «Archivar/restaurar» (columna sí, ruta no); desactivar participantes; nombre único entre activos (no se valida) | Etiquetas «Participante sin cuenta», «Nombre del grupo», «Invitar por email», botones «Agregar participante», «Invitar», «Guardar nombre»; formularios con `_csrf` |

## 3. Los cuatro changes de OpenSpec contra el código real

Los cuatro se escribieron sin ver este código. Resumen: **el código ya implementa más de lo que suponen** (libro, movimientos, idempotencia, importación completa, exportación) **y hay tres contradicciones de fondo**.

### Contradicciones con lo implementado

1. **API.** `libro-y-saldos` D7 propone rutas `/api/expenses/*` y una app de un solo documento en `/cuentas-claras`. El código real usa páginas renderizadas en el servidor bajo `/spaces/:slug/ledger/*` con formularios POST y CSRF. Aplicar D7 tal cual duplicaría todo. **[leído]**
2. **`entry_effects`.** `importacion-splitwise` D2 propone una tabla única de efectos para todos los movimientos y que los saldos se calculen desde ella. El código tiene dos caminos: `entry_cash_parties` + `entry_allocations` para movimientos propios y `splitwise_import_effects` para importados, unificados en memoria en `readLedger`. Migrar a `entry_effects` es una decisión de arquitectura para `explore`, no una consecuencia del diseño visual. **[leído]**
3. **Concurrencia.** El spec habla de la revisión *del libro*; el código usa `expectedRevision` *por movimiento* (la del libro se incrementa pero no se exige). **[leído]**
4. **Búsqueda en base de datos.** `busqueda-movimientos` D1/D2 proponen texto normalizado e índices en D1. El código carga todo el libro en memoria y filtra con JavaScript (`searchLedger`). Funciona para un libro chico; no cumple el presupuesto «independiente del número de resultados» ni pagina. **[leído]**
5. Un libro admite **un único lote importado confirmado** (índice único). El spec habla de lotes por huella sin ese límite. **[leído]**

### Requisito por requisito

Leyenda: ✅ cubierto · 🟡 parcial · ❌ nuevo · ⚠️ contradice

**`libro-y-saldos-cuentas-claras`**
| Requisito | Estado | Nota |
|---|---|---|
| Libro por espacio creado en la misma transacción, con titular vinculado | ✅ | `createSpaceForUser` (un `db.batch`) |
| Moneda predeterminada no restringe; cambiarla no convierte | 🟡 | Se elige al crear; no hay forma de cambiarla después |
| Participantes con o sin cuenta | ✅ | `addParticipant` |
| Nombre único entre activos | ❌ | No se valida |
| Desactivar participante con historia | ❌ | Hay columna `active`, sin ruta |
| Libro solo accesible por miembros, sin revelar existencia | ✅ | `getLedgerAccess` responde 404 |
| Gasto con pagadores y asignaciones validadas en servidor | ✅ | `validateEntryDraft` |
| Ingreso, transferencia (origen ≠ destino) | ✅ | |
| Reparto igual y exacto | ✅ | |
| Reparto porcentual y por partes | ❌ | |
| Residuo determinista visible antes de confirmar | 🟡 | Determinista (los primeros reciben +1), no se muestra |
| Corregir crea revisión inmutable con historial visible | ✅ | Triggers de inmutabilidad en la migración 0003 |
| Edición concurrente rechazada | 🟡 | Por movimiento, no por libro (ver arriba) |
| Anular no borra, motivo opcional | ✅ | |
| Escritura atómica con clave de idempotencia | ✅ | |
| Saldo neto por participante y moneda, suma cero | ✅ | La suma cero no se muestra en pantalla |
| Explicación de cada saldo con acumulado | ❌ | |
| Sugerencias de transferencia derivadas | ❌ | Algoritmo es pregunta abierta n.º 3 |
| Importes con signo y palabra, no solo color | 🟡 | Palabra sí («Le deben/Debe»), signo no |
| Controles ≥ 44 px, campos con etiqueta | 🟡 | Etiquetas sí; tamaños no medidos |
| Paleta clara y oscura por `prefers-color-scheme`, contraste ≥ 4,5 | ❌ | La app no tiene modo oscuro |
| Escritorio de dos paneles / móvil apilado | ❌ | |
| API `/api/expenses` | ⚠️ | Ver contradicción 1 |

**`importacion-splitwise-inicial`**
| Requisito | Estado | Nota |
|---|---|---|
| Vista previa sin escribir; fila de resumen no se importa | ✅ | |
| Mapeo explícito de personas | ✅ | Propone por nombre igual |
| Efecto exacto por fila; sin clasificar préstamos | ✅ | |
| Incidentes con fila y motivo; excluir o supuesto | 🟡 | Solo excluir y «usar moneda por defecto»; falta completar efecto faltante |
| Conciliación sin ajustes ocultos | 🟡 | Muestra origen/importado/diferencia; no atribuye cada diferencia a filas |
| Procedencia por movimiento y lote | ✅ | |
| Importar dos veces no duplica | ✅ | Huella única por libro |
| Pruebas sin datos reales | ✅ | |
| Punto de partida (importar / cero / saldos anteriores deshabilitado) | ❌ | |
| `entry_effects` unificada | ⚠️ | Ver contradicción 2 |

**`busqueda-movimientos-unificada`**
| Requisito | Estado | Nota |
|---|---|---|
| Un campo único, historial completo sin texto | ✅ | |
| «N de M» y paginación | ❌ | |
| Normalización de acentos/mayúsculas/puntuación | ✅ | `searchable()` |
| Buscar en nota | ❌ | Descripción, categoría, importe, participante sí |
| Varios términos combinados con Y | ❌ | Hoy la frase completa debe coincidir |
| Monto total y efecto individual | ✅ | Con fragmentos que ignoran miles |
| Motivo de coincidencia y marca de origen | ✅ | Falta resaltar el término |
| Presupuesto de llamadas a D1 | 🟡 | Consultas fijas, pero carga todo el libro |
| Aislamiento por libro | ✅ | |
| Texto normalizado en columna e índices | ⚠️ | Ver contradicción 4 |

**`colaboracion-y-exportacion-del-libro`**
| Requisito | Estado | Nota |
|---|---|---|
| Lista de personas con rol y estado | 🟡 | Datos sí; falta mostrarlos juntos |
| Invitación asociada a un participante, vínculo al aceptar | ✅ | `targetParticipantId` |
| Cuenta ya vinculada a otro participante → decisión explícita | ❌ | |
| Vincular después a participante sin cuenta | ✅ | Invitando con ese destino |
| Permisos por rol en el servidor | ✅ | |
| Comentarios de solo agregar | ❌ | |
| Exportación JSON versionada | 🟡 | `schemaVersion: 2`, sin comentarios (no existen) |
| Exportación CSV en archivos separados | 🟡 | Un solo CSV por efecto |
| Archivar / restaurar | 🟡 | Escrituras ya rechazan libro archivado; no hay forma de archivar |
| Reenviar invitación | ❌ | |

## 4. Qué se hizo sin decisiones tuyas, y qué no

Ver «Estado de avance» al final: la lista completa, con commits y pruebas.

**No hecho a propósito (necesita `/opsx:explore` contigo):** pantalla 2 como paso propio (cambia la redirección tras crear el grupo y un E2E), comentarios (exige migración nueva y puede chocar con otras ramas que también agreguen `0007`), reparto por % y por partes, reenviar invitación (no hay correo transaccional), desactivar participantes, supuesto de efecto faltante en la importación, atribución de diferencias a filas, propósito del grupo y participantes al crear, y selector de herramienta de la suite.

## 5. Contratos que las pruebas fijan (verificado leyendo `apps/app/e2e/platform.spec.js`)

- Etiquetas: «Nombre» (exacta), «Invitar por email», «Participante sin cuenta», «Descripción», «Importe» (exacta), «Archivo CSV», «Buscar».
- Botones/enlaces: «Crear espacio», «Invitar», «Agregar participante», «Gasto» (exacto), «Guardar», «Volver al libro», «Corregir», «Anular», «Confirmar anulación», «Importar Splitwise», «Previsualizar», «Revisar saldos y decisiones», «Confirmar importación», «Ver el libro», «Buscar», «Aceptar invitación», «Rechazar».
- Textos únicos: «Le deben COP 50,00», «COP 120,00» (una sola vez en el detalle), «Importado de Splitwise» (una sola vez por resultado), «Efecto original, no vigente».
- Sin desborde horizontal a 390 px.

## 6. Orden de trabajo propuesto (un PR por grupo)

1. **Base visual**: paleta única, hoja de estilos sin estilos en línea, modo oscuro, barra superior y pruebas de contraste. (Hecho.)
2. **Libro**: saldos, movimientos y personas en dos paneles, con barra inferior en el teléfono. (Hecho.)
3. **Formulario y detalle de movimiento**, con vista previa del efecto. (Hecho.)
4. **Importación y páginas auxiliares**. (Hecho.)
5. **Funcionalidad que el spec ya determina** (sin pasar por `explore`; ver abajo): explicación del saldo, sugerencias, búsqueda con términos combinados, «Ver más», archivar/restaurar, nombre único. (Hecho, en commits separados para poder descartarlos.)
6. **Con `explore`**: punto de partida como paso, comentarios, reparto por % y partes, y lo demás de la sección 4.
7. **Pruebas reales**: teléfono, Safari/iOS y Firefox. No se hicieron.

## 7. Preguntas abiertas

1. ¿COP se muestra con dos decimales (como hoy) o sin decimales (como el diseño)?
2. ¿Se aceptan las clases del sistema (sin Inter) o se autoaloja Inter? Autoalojar exige relajar `font-src`/`style-src` de la CSP o servir los archivos desde el mismo origen.
3. ¿El punto de partida debe ser una pantalla propia tras crear el grupo (cambia la redirección y un E2E) o un estado vacío dentro del libro?
4. ¿Vale la pena unificar los efectos en `entry_effects` (contradicción 2) antes de construir «por qué» y sugerencias?
5. ¿La búsqueda pasa a SQL con paginación antes de agregar «N de M» y varios términos?
6. ¿«Tareas / Cuentas Claras / Compras» de la barra de escritorio apuntan a dónde, mientras TasKing y Compras viven en otros Workers?
7. ¿Quién puede ver la interfaz «sin cuenta» de un participante que luego acepta una invitación ya vinculada a otro (decisión explícita pendiente en el spec)?

## 8. Estado de avance (2026-10-24, madrugada)

Rama `diseno/cuentas-claras-ui`, solo local (no se hizo push ni deploy). Cada punto es un commit chico.

**Diseño aplicado** (solo vista; contratos conservados):
- `theme.js`: única fuente de la paleta (clara y oscura por `prefers-color-scheme`); `styles.js`: hoja sin estilos en línea (la CSP los prohíbe) con foco visible, controles de 44 px y barras de saldo con clases `w0…w50`.
- Barra superior, enlace «Saltar al contenido», `theme-color` por esquema, barra inferior en el teléfono (Saldos, Movimientos, +, Personas, Grupos) y dos paneles en escritorio.
- Libro: tarjeta «Tu saldo» por moneda (roja si debés), saldos con avatar y barra, movimientos con ícono por tipo, «Tu efecto», marca de origen y motivo de coincidencia, personas con rol y estado, estados vacíos con las tres formas de empezar («saldos anteriores» deshabilitada).
- Formulario: pestañas de tipo, importe grande, opciones como chips (pagó, reparto, método), personas con la persona autenticada primero («· vos») y **vista previa del efecto** antes de guardar, que además avisa si el importe se escribió con puntos de miles.
- Detalle: tabla «Cómo se repartió» con suma, línea de tiempo de revisiones, insignias, acciones Corregir/Anular.
- Importación: pasos numerados; tablas con scroll solo donde hace falta.
- Avisos de confirmación tras cada acción (lista cerrada; el parámetro de la URL nunca se muestra tal cual).

**Funcionalidad agregada (los specs la determinan; no pasó por `explore`, revisala):**
- «¿Por qué?»: `GET /spaces/:s/ledger/balance?moneda=&persona=` con acumulado y comprobación (spec `saldos-cuentas-claras`).
- «Para quedar a mano»: regla D6 (mayor con mayor, determinista, sin guardar nada) con «Registrar» que abre la transferencia prellenada (se valida contra los participantes del libro). **El algoritmo es la pregunta abierta n.º 3 del change: se adoptó el que propone D6.**
- Búsqueda con términos combinados (Y), búsqueda en la nota y «Ver 40 más».
- Archivar y restaurar el grupo (solo el titular, auditado en `ledger_events`; bloquea movimientos, personas por invitación e importación; la lectura y la exportación siguen).
- Nombre único entre participantes activos.
- Acceso local: la sesión de desarrollo entra directo al grupo si ya existe.

**Pruebas nuevas:** contraste calculado de la paleta (`theme.test.js`), marcado y escape (`overview-ui.test.js`), saldos y sugerencias con propiedades (`settlement.test.js`), integración de explicación, prellenado, archivo y nombres (`ledger-views.integration.test.js`) y E2E de diseño (`design.spec.js`: CSP sin violaciones, esquema oscuro, 390 px sin desborde, controles ≥ 44 px, paneles, vista previa, avisos, sugerencias, archivo y **contraste real del texto renderizado en claro y oscuro**). Una prueba existente cambió: el redirect de renombrar ahora agrega `?aviso=renombrado`.

**Hallazgos que corrigieron las pruebas:** el panel de saldos «pegajoso» tapaba los formularios en escritorio (se quitó); la tabla de reparto del detalle se cortaba a 390 px (se compactó); una referencia rota en el script del cliente (la prueba de CSP la detectó).

**Verificado / no verificado**
- Verificado en Chromium (Playwright): lo anterior, a 390 px y 1280 px, claro y oscuro.
- **No verificado:** teléfono real, Safari/iOS, Firefox (Chromium es el único navegador del entorno). El efecto del selector `:has()` que muestra los importes exactos tiene alternativa para navegadores sin soporte (se muestran siempre), pero no se probó en ellos. La fuente es la del sistema (Inter queda bloqueada por la CSP).
- El orden de las personas tiene un desempate por `id` aleatorio cuando se crean en el mismo segundo; solo afecta a quién se le asigna el residuo de un reparto, y la vista previa muestra el mismo resultado que el servidor.

**Cómo verlo en local**
```bash
cd ../tas-king-diseno-cc          # worktree de la rama diseno/cuentas-claras-ui
npm run dev:homesuite-demo        # migra, carga datos sintéticos y arranca en http://localhost:8793
# entrar como titular:  http://localhost:8793/api/local/session?as=pablo@example.test
# entrar como integrante: http://localhost:8793/api/local/session?as=laura@example.test
```
Los datos son el grupo «Casa compartida» del diseño (Pablo titular, Laura miembro, Ana con invitación pendiente, Mateo sin cuenta; COP y USD; un movimiento anulado; dos importados). Se guardan en `.wrangler/homesuite-app-demo` (ignorado por Git); para empezar de cero, borrá esa carpeta.
