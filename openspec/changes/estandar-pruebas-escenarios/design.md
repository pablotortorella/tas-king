## Context

Estado verificado el 2026-10-23, en la exploración:

- **Pruebas actuales:** 20 archivos de pruebas unitarias (Vitest) y 23 specs E2E (Playwright, ~2.400 líneas), todos locales. `baseURL` está fijo en `http://127.0.0.1:8787` y el `webServer` lo levanta la propia corrida con `npm run dev:e2e`.
- **Autenticación en pruebas:** el atajo `X-Dev-User` / `DEV_USER_EMAIL` solo vale si el host es localhost (`src/middleware/auth.js`, `isLocalRequest`). En staging el login es Google OAuth y la sesión es la cookie `session`, un JSON `{ email, exp }` firmado con HMAC-SHA256 y `SESSION_SECRET`. El acceso lo decide la tabla `allowed_emails` (con el secreto `ALLOWED_EMAILS` como respaldo solo si la tabla está vacía).
- **Datos:** `resetDb()` ejecuta `test/fixtures/seed.sql` contra el SQLite local; no existe equivalente en staging, cuya D1 es remota y compartida. Cinco specs dependen del seed (tablero `board-e2e`).
- **API disponible para fixtures:** `POST /api/boards` crea un tablero no personal con las 5 columnas por defecto y al usuario como dueño. `DELETE /api/boards/:id` lo borra; las tablas dependientes (etiquetas, objetivos, checklists, vínculos) tienen `ON DELETE CASCADE`. Solo `audit_log` no tiene clave foránea y conserva el historial de tableros borrados.
- **Lecciones de la sesión del 2026-10-23:**
  - Staging servía `main` y no las ramas de #65 y #66; se descubrió comparando archivos publicados contra cada rama.
  - `e2e/tip-diario.spec.js:103` verifica que `100dvh` esté en la hoja servida. Pasó mientras el bug existía en un Motorola real: el emulador no puede simular la barra de direcciones. Es una prueba proxy.
  - Para #66 hoy hay 2 pruebas; una persona que prueba con mala leche haría más (límite de 10 etiquetas, cancelar y abrir otra tarjeta nueva, permisos, táctil, concurrencia).
- **Specs:** `openspec/specs/` tiene `tip-diario` y `landing-publica-homesuite`; el proyecto es brownfield y las specs nacen cuando se toca cada parte.

## Goals / Non-Goals

**Goals:**
- Que "todos los escenarios necesarios" sea una lista escrita y verificable, no una promesa.
- Que cada escenario tenga una prueba automatizada que se comporte como una persona probando.
- Que la misma prueba corra en local y en staging, sin reset de base y sin pisar los datos de Pablo.
- Que el criterio se afine con un piloto real y luego se vuelva estándar del proyecto.

**Non-Goals:**
- Migrar las 23 specs existentes (se migran al tocarlas).
- Aplicar el criterio a toda la app antes del piloto.
- Verificar el SHA desplegado en staging (ítem aparte del backlog, PR #83).
- Correr pruebas contra producción. Nunca.
- Reemplazar las pruebas unitarias de backend, que siguen siendo la herramienta para la lógica de API.

## Decisions

### D1 — Piloto con los cinco arreglos recientes
Sobre #65, #66, #67, #77 y #78. Son pocos y conocidos, y tenemos su checklist manual, así que se ve qué pierde la traducción a automático. Alternativas: los recorridos críticos de toda la app (grande, y sin criterio probado terminaría en cientos de pruebas sin saber por qué) y piloto primero, app después (es el plan: el estándar se aplica al resto una vez validado).

Mapa de capacidades del piloto:

| Capacidad (carpeta de spec) | Cubre | PR |
|---|---|---|
| `etiquetas-borrador` | Etiquetas en una tarjeta nueva | #66 |
| `checklists-teclado` | Tab, Enter y Backspace en ítems | #67 |
| `tip-diario` (se modifica) | Tip visible en celular | #65 |
| `objetivos-progreso` | Avance con varias columnas de cierre | #77 |
| `tarjetas-columnas` | Una tarjeta vive siempre en una columna válida | #78 |

### D2 — Entrada a staging con cookie de sesión fabricada
La prueba firma `{ email, exp }` con el `SESSION_SECRET` de staging y arma la cookie `session` para un usuario de pruebas dedicado, agregado a `allowed_emails`. Ejercita el camino real de sesión (firma, revocación, allowlist), no el atajo de localhost.

Salvaguardas, que forman parte del estándar:
1. El secreto va en un archivo local sin versionar (como `.dev.vars`), nunca en el repositorio ni en CI.
2. El ayudante se niega a correr contra la URL de producción; contra producción no hay forma de fabricar nada.
3. El usuario de pruebas es uno reconocible, con tableros y datos aislados de los de Pablo.

Alternativas rechazadas: guardar una sesión de Google real con `storageState` (vence a los 30 días, renovación manual, depende de una cuenta Google) y un endpoint de login solo para pruebas (abre una puerta de entrada en una app donde la autenticación es crítica).

Nota operativa: los secretos de Cloudflare no se pueden leer; para que Pablo y Claude tengan el mismo valor hay que rotar `SESSION_SECRET` de staging con `wrangler secret put` y guardarlo local. Cierra las sesiones actuales de staging, nada más.

### D3 — Aislamiento: un tablero propio por corrida
Al inicio, `POST /api/boards` con nombre `QA-<runId>` para el usuario de pruebas; las pruebas trabajan solo dentro de ese tablero; al final, `DELETE /api/boards/<id>`. Si una corrida se cae, la siguiente barre al inicio los tableros `QA-*` viejos del usuario de pruebas. Sin reset de base, sin interferir con el uso humano de staging, mismo código en local y staging.

Consecuencia: ninguna prueba nueva puede depender del seed ni del tablero `board-e2e`; todo fixture se crea por API. Alternativas rechazadas: un tablero QA fijo que se limpia al empezar (las corridas no pueden solaparse; una corrida caída ensucia la siguiente) y dos suites, una local con seed y otra para staging (se duplican y divergen).

Residuo conocido: `audit_log` conserva filas de tableros borrados. Inocuo en staging.

### D4 — Escenarios en OpenSpec, con id corto estable
Cada escenario es un `#### Scenario:` de una spec bajo `openspec/specs/<capacidad>/spec.md`, con un id `[capacidad/n]` en el título; la prueba lleva el mismo id en su título. Los números no se reutilizan: un escenario retirado queda como `(retirado)`. Un script de trazabilidad compara ambos lados.

Alternativas rechazadas: tabla de escenarios en el PR y en STATUS (texto libre, no verificable, se pierde), un documento de casos de prueba por área en `docs/` (tercera fuente que se desactualiza) y enlazar por título idéntico (retocar una coma rompe el vínculo y entrena a ignorar el script).

### D5 — Diez dimensiones, todas se resuelven siempre
Camino feliz; variaciones; negativos y límites; persistencia (¿sobrevive a recargar? ¿se ve igual en la API?); filtración de estado (cancelar, reabrir, cambiar de tablero); permisos y roles; entrada y dispositivo (teclado, táctil, viewport angosto, tema oscuro); concurrencia; regresión (el defecto original queda cubierto por una prueba que falla sin el fix); efectos colaterales (historial, métricas, import/export).

Cada dimensión de cada cambio termina en uno de tres estados, siempre con una línea escrita: **automatizado** (hay prueba con el id), **no aplica** (con la razón) o **residual manual** (no se puede automatizar del todo; con la razón y el checklist exacto que debe hacer una persona).

Alternativas rechazadas: un núcleo obligatorio y el resto como guía (lo no obligatorio tiende a saltarse, y de ahí salen los bugs de filtración de estado) y obligatoriedad según el tamaño del cambio (hay que definir qué es "chico" y esa frontera se discute siempre).

### D6 — Suite nueva `e2e/escenarios/`, con regla de migración
Proyecto de Playwright propio; las 23 specs viejas siguen como están. Regla: cuando un cambio toca una spec vieja, esa spec pasa a la suite nueva en el mismo PR, así la deuda se paga sola. Alternativa rechazada: migrar las 23 ya (mucho trabajo antes de saber si el criterio funciona; riesgo de romper la red de seguridad actual).

### D7 — Capacidades de la spec del piloto describen comportamiento ya en producción
Siguiendo el enfoque brownfield: las specs nacen al tocar esa parte. Las cuatro capacidades nuevas del piloto y la modificación de `tip-diario` documentan lo ya implementado en v2.3.1 y v2.3.2.

### D8 — Siete reglas para que una prueba sea "como una manual" (confirmadas por Pablo el 2026-10-23)
1. **R1.** Se maneja la app como lo haría una persona: clics, teclado, texto y roles visibles. Nada de llamar funciones internas ni usar selectores ligados a la implementación.
2. **R2.** La API sirve solo para preparar datos y para comprobar persistencia (dimensión 4). La acción bajo prueba siempre se ejecuta por la interfaz.
3. **R3.** Cada prueba crea sus propios datos dentro del tablero de la corrida y no depende de otra. Nada de modo serial ni de orden.
4. **R4.** Se afirma lo que una persona vería: texto, visibilidad, foco, posición. No estilos ni clases CSS. Si algo solo puede verificarse mirando el CSS (como `dvh`), la prueba se declara "proxy" en su título y el escenario queda además con un residual manual.
5. **R5.** Toda prueba de regresión se demuestra roja: se verifica que falla sin el fix antes de darla por buena.
6. **R6.** Las dimensiones de dispositivo usan emulación real de Playwright (táctil, viewport y tema), no solo cambiar el ancho de la ventana.
7. **R7.** Sin esperas fijas. Se espera por condiciones visibles; los flakes se cuentan, no se esconden con reintentos.

## Risks / Trade-offs

- **[El secreto de staging queda en el equipo de Pablo]** → solo staging, archivo local sin versionar, ayudante que rechaza la URL de producción; el impacto máximo es falsificar sesiones de un ambiente de pruebas.
- **[Rotar `SESSION_SECRET` cierra las sesiones de staging]** → ambiente de pruebas; se hace una sola vez y se avisa.
- **[R2 hace las pruebas más lentas que ejecutar acciones por API]** → es el precio de que sean pruebas manuales de verdad; mitigación: suite aparte, tablero por corrida y medir el tiempo antes de ampliar.
- **[Escribir las 10 dimensiones en cambios chicos puede sentirse pesado]** → "no aplica" cuesta una línea de razón; se reevalúa el nivel de exigencia tras el piloto.
- **[Conviven dos estilos de E2E durante un tiempo y un comportamiento puede probarse dos veces]** → regla de migración al tocar una spec vieja.
- **[Rate limiting por IP puede dar 429 al correr la suite contra staging]** → medir en el piloto; si pasa, espaciar o ajustar el límite de staging, nunca el de producción.
- **[Una prueba proxy puede dar falsa confianza]** → R4 la obliga a declararse y a dejar un residual manual explícito.
- **[Residuo en `audit_log` de staging]** → inocuo; se puede purgar a mano si molesta.

## Migration Plan

No hay migración de datos ni cambios para quien usa la app. Pasos operativos previos al primer uso en staging:
1. Rotar `SESSION_SECRET` de staging con `wrangler secret put SESSION_SECRET --env staging` y guardar el valor en el archivo local sin versionar.
2. Agregar el o los usuarios de pruebas a `allowed_emails` de la base de staging.
3. Verificar que la suite se niegue a correr contra la URL de producción antes de apuntarla a cualquier otro destino.

Reversión: borrar el usuario de pruebas de `allowed_emails` y rotar el secreto de nuevo; la suite nueva es aditiva y no altera las specs existentes.

## Open Questions

Sin decidir al cierre de esta exploración. Los puntos 1 a 4 son los que más condicionan el resto.

1. **SHA desplegado en staging.** Dónde se expone (solo en staging), qué pasa si no coincide con `HEAD` y si `deploy:staging` corre la suite solo o con un comando aparte. Ítem de backlog en PR #83; se explora cuando el piloto esté en marcha.
2. **Identidades de prueba para escenarios de permisos.** Se necesitan al menos tres: dueño, miembro y quien no es miembro del tablero. Cuántos emails, y cómo se agregan a `allowed_emails` de staging (`wrangler d1 execute --remote` o el panel de administración).
3. **Autenticación en local.** Usar la misma cookie fabricada con el `SESSION_SECRET` de `.dev.vars` (ejercita el mismo camino en ambos destinos; recomendación de Claude, no decidida) o seguir con el atajo `X-Dev-User`.
4. **Cambios solo de API.** Cómo aplican R1 y R2 a un cambio sin interfaz; la hipótesis es que sus escenarios se cubren con pruebas de Vitest que citan el id, pero no está decidido.
5. **Forma del residual manual.** Dónde se escribe el checklist exacto (¿como escenario marcado en la propia spec? ¿en un documento de QA manual?) y cómo se registra que una persona lo ejecutó.
6. **Script de trazabilidad.** Si entra a `npm run test:all` y bloquea cuando falta una prueba, o primero solo informa.
7. **Texto final del estándar.** Cuánto va en `CLAUDE.md` (sección corta) y cuánto en una guía propia; cómo se incorpora al checklist de PR de `docs/WORKFLOW.md`.
8. **Cómo elige la prueba el tablero de la corrida en la interfaz** (selector de tableros o enlace directo): detalle técnico a resolver al implementar.
9. **Cuándo se corre contra staging**: a mano antes de promover, o automático tras cada despliegue (ligado al punto 1).
10. **Ajustes a la lista de dimensiones** una vez aplicada al piloto: falta o sobra alguna.
