# Retomar este change

**Última actualización: 2026-09-17.** Todo lo hecho está commiteado y pusheado: si esta
máquina se apaga, no se pierde nada del trabajo.

---

## 1. Dónde está todo

| Qué | Dónde |
|---|---|
| Rama | `refactor/frontend-modulos` |
| Remoto | `origin/refactor/frontend-modulos` — **al día, 0 commits sin pushear** |
| Worktree usado | `../tas-king-frontend-modulos` (el checkout principal sigue en `main` limpio) |
| Staging | desplegado y verificado, Version ID `27b02022-c022-4902-8a15-646cba5c2c3e` |
| Producción | **intacta**. No se tocó en ningún momento |

## 2. Levantar en otra máquina

```bash
git fetch origin --prune
git worktree add ../tas-king-frontend-modulos refactor/frontend-modulos
cd ../tas-king-frontend-modulos
npm install
cp ../tas-king/.dev.vars .           # gitignoreado: no viaja por git
npx playwright install chromium      # la caché ms-playwright puede no existir
npm install acorn --no-save          # andamiaje del refactor, ver punto 5
npm run test:all                     # debe dar 206 unitarios + 84 E2E
```

## 3. Estado actual

**Verificado**: 212 unitarios + 85 E2E en verde. El núcleo modular se probó
además contra Cloudflare real, no solo `wrangler dev`.

```
public/index.html   512 lineas de markup   (era 4.545)
public/css/app.css  809
public/js/
  app.js      1.240   <- lo que falta repartir (era 3.220)
  boards.js     400   configuracion del tablero (⚙️) + perfil
  board.js      374   CAPA DEL TABLERO: render, loadBoard, loadCards, actionLabel
  goals.js      335   objetivos + metricas (los dos cajones laterales)
  admin.js      256   panel de administracion
  io.js         214   exportar/importar + menu de datos
  feedback.js   209   pulso WIP + tip diario + confeti
  drag.js       171   arrastre de tarjetas + paneo
  columns.js     75   gestion de columnas
  theme.js       44   tema y paleta (no importa nada: va debajo de board)
  theme-boot.js  14   anti-flash, script clasico bloqueante
  core/  state 88 · dom 81 · bus 56 · api 38
```

**Fases cerradas**: F1 (cabeceras al documento), F0 (tests de caracterización),
F2 (CSS fuera), F3/F4 (JS fuera y como módulo ES), el núcleo completo y 9 features.

**Arquitectura vigente** (corregida durante la implementación, ver D3 en `design.md`):

```
app.js            composition root: arranca, cablea, registra hooks de window
   |
FEATURES          boards  goals  admin  io  feedback  drag  columns
   |              (faltan: modal, checklists+etiquetas, teclado, polling)
BOARD             board.js — render, loadBoard, loadCards, withCardMutation, actionLabel
   |
NUCLEO + THEME    state  api  dom  bus  |  theme (no importa nada)
```

Regla: una feature importa de board y del núcleo, **nunca de otra feature**.
Cuando hay que avisar hacia arriba y no se espera respuesta, se emite por el bus.
Lo que se espera (`await loadCards()`) se llama directo: el bus devuelve
`undefined` y atrapa excepciones, así que no puede reemplazar un `await`.

**Avisos del bus en uso**: `sesion:cargada`, `tablero:cargado`,
`columnas:cambiaron`, `objetivos:cambiaron`, `tarjeta:abrir`, `tarjeta:arrastre`,
`tarjeta:celebrar`, `mutacion:inicio`, `mutacion:fin`. Todos se suscriben en
`app.js`, que es el único lugar donde se decide quién atiende qué.

## 4. El próximo paso concreto

Quedan **4 bloques** en `app.js`:

| Bloque | Tamaño aprox. | Nota |
|---|---|---|
| Archivar / Eliminar / Restaurar + overlay de archivadas | ~65 líneas | chico, buen calentamiento |
| **Modal de tarjeta** | ~585 líneas | el más grande; incluye comentarios, historial y adjuntos |
| Objetivos dentro del modal + etiquetas de tarjeta | ~300 líneas | ojo: `renderLabels` y `createLabel` están bajo títulos que no les corresponden |
| Buscador, selector de tablero, teclado y arranque | ~160 líneas | **el teclado va último** |

**Por qué el teclado va último**: su cadena de Escape referencia los overlays de
*todos* los demás módulos (`overlay`, `profileOverlay`, `importOverlay`,
`membersOverlay`, `archiveOverlay`, `goalsDrawer`, `metricsDrawer`,
`themePromptOverlay`). Hasta que existan, no se puede mover. Ahí también vive el
bug conocido de que **Esc no cierra la ayuda (F1)**: hay código muerto para eso
en `app.js` y `helpModal` no está en la cadena. Cuando se llegue, el fix va con
su test en rojo primero.

### El método, paso a paso

```bash
# 1. ¿El grupo está cerrado? (solo sirve para funciones, no para listeners)
node openspec/changes/extraer-frontend-a-modulos/tools/analizar-dependencias.mjs '["fnA","fnB"]'

# 2a. Si el bloque son solo declaraciones: extraer con el AST
node openspec/changes/extraer-frontend-a-modulos/tools/extraer-modulo.mjs '{
  "destino":"public/js/NOMBRE.js", "grupo":["..."], "publicas":["..."],
  "cabecera":"// comentario del modulo", "importa":"import ..."}'

# 2b. Si el bloque incluye listeners: cortar por rangos de texto, y DESPUÉS
grep -n "^// ---------- " public/js/NOMBRE.js     # ¿se coló una seccion vecina?

# 3. SIEMPRE, sea cual sea el camino
node openspec/changes/extraer-frontend-a-modulos/tools/verificar-modulo.mjs public/js/NOMBRE.js
node openspec/changes/extraer-frontend-a-modulos/tools/verificar-modulo.mjs public/js/app.js
cp public/js/NOMBRE.js /tmp/s.mjs && node --check /tmp/s.mjs

# 4. Suite completa, y recién ahí un commit por módulo
npx playwright test --reporter=line && npm test
```

**Ojo con los títulos de sección**: los comentarios `// ---------- X ----------`
derivaron del código. `renderLabels` vive bajo "Checklists", `createLabel` bajo
"Objetivos dentro del modal", y los atajos de teclado del modal de tarjeta
estaban bajo "Modal de perfil". Agrupar por lo que dice el grafo, no por el
título. Ya se coló código ajeno **tres veces** por confiar en ellos.

Después de los módulos quedan **5.21-5.23** (composition root, los cuatro hooks
de `window` juntos, verificación), el **grupo 6** (sacar `'unsafe-inline'`) y el
**grupo 7** (documentación e integración).

**Decisión pendiente antes del grupo 6**, marcada en el diseño como "decidir
antes, no durante": `landing.html`, `releases.html`, `revoked.html` y
`terminos.html` tienen 8 bloques `<script>` inline entre las cuatro. O se
extraen también, o la política de contenido se diferencia por ruta.

## 5. Herramientas y trampas

Las tres herramientas de `tools/` son andamiaje de este change y se archivan con
él. Requieren `acorn`, instalado con `--no-save` a propósito: no es dependencia
del producto.

| Herramienta | Qué red tiende |
|---|---|
| `analizar-dependencias.mjs` | si el grupo de funciones está cerrado |
| `extraer-modulo.mjs` | mueve por AST; aborta si hay fugas o variables libres |
| `verificar-modulo.mjs` | identificadores que un módulo usa sin declarar ni importar |

La tercera es la más valiosa y la más tardía: se escribió después de que dos
extracciones por texto fallaran. Al correrla sobre los módulos ya hechos
encontró un bug **que estaba commiteado y con la suite en verde** — `admin.js`
usaba `avatarHtml` sin importarlo, en una rama que ningún test alcanzaba.
Conviene correrla sobre todos los módulos, no solo el recién creado.

### Lo que salió mal, para no repetirlo

1. **No editar archivos con la suite corriendo.** El dev server recarga en
   caliente: invalida la corrida y, peor, las mediciones.
2. **No escribir un lexer de JS a mano.** Un escáner propio se rompió con
   `return /[",\r\n]/` y renombró dentro de un string. De ahí el uso de acorn.
3. **Ninguna herramienta que escriba archivos al importarse.** Un bloque CLI al
   final de un módulo corrió con argumentos equivocados y corrompió `app.js`.
4. **Medir en las condiciones correctas.** Una hipótesis correcta se descartó por
   medir con la máquina tranquila cuando la carrera solo se pierde bajo carga.
5. **Una corrida verde no prueba nada.** El flake se declaró cerrado con 3
   corridas limpias y falló a la siguiente.
6. **Al cortar por rangos de texto, verificar qué secciones quedaron adentro.**
   Pasó tres veces: `io.js` se llevó "Selector de tablero", `boards.js` se llevó
   los atajos de teclado del modal de tarjeta. Cuesta un comando:
   `grep -n "^// ---------- " public/js/NUEVO.js`
7. **Un bug arreglado sin test no está arreglado.** Dos se corrigieron sin
   prueba: el import faltante de `avatarHtml` y el reintento ante `SQLITE_BUSY`.
   Los dos tienen ahora su test, verificado en rojo antes y verde después. Para
   cada bug que aparezca: escribir el test, **verlo fallar**, arreglar, verlo pasar.
8. **El bus atrapa las excepciones de sus oyentes.** Un `ReferenceError` en una
   función invocada por el bus falla en silencio. No alcanza con mirar la
   consola: confiar en `verificar-modulo.mjs`.

Y la que funcionó: **un commit por unidad lógica**. Salvó el día dos veces —
cuando una herramienta propia corrompió `app.js` y cuando una tanda entera tuvo
que revertirse.

## 6. Pendientes conocidos (ninguno bloquea)

- **Flake sin causa identificada**: cada tanto el `beforeEach` de
  `card-mutation-performance` se cuelga en `page.goto` porque dos subrecursos
  nunca completan. Mitigado con `retries: 1` en local; Playwright lo cuenta
  aparte como "flaky". Cinco hipótesis medidas y descartadas. Si el contador
  deja de ser cero de forma persistente, o aparece en otros specs, volver ahí.
- **Overlays exportados por sus features** (`profileOverlay`, `membersOverlay`,
  `themePromptOverlay`, `importOverlay`, `goalsDrawer`, `metricsDrawer`): la
  cadena de Escape vive en `app.js` y necesita saber cuál está abierto. Es deuda
  consciente. Cuando se extraiga `keyboard.js`, evaluar si conviene que cada
  módulo registre "qué cierro y con qué prioridad" en vez de exportar el elemento.
- **9 referencias viejas a `public/index.html`** en docs y comentarios
  (`src/constants.js:3`, `test/labels.spec.js:4`, `docs/CAMBIOS-MULTICAPA.md:110`,
  `docs/WORKFLOW.md:372`, ADR-014, ADR-015, `docs/ADRs.md:19` y dos ítems del
  backlog con números de línea muertos). Va en el grupo 7.
- **30 tests unitarios que nunca corren**: `vitest.config.mjs` incluye
  `test/**/*.test.js` y hay dos archivos `.spec.js`. Uno falla de verdad
  (`/uploads/:key` devuelve 500 en vez de 401). **Preexistente y fuera del
  alcance de este change** — no mezclarlo acá.
- **Esc no cierra la ayuda (F1)**: bug conocido del backlog, con código muerto en
  `app.js`. El lugar natural para arreglarlo es al extraer `keyboard.js`, con su
  test en rojo primero.
- **`estado.state.cards`** se lee mal. Renombrar era cambio semántico; quedó como
  deuda deliberada.
- **Staging tiene el núcleo modular** (Version ID `27b02022`), pero **no** los
  módulos posteriores a esa verificación. Conviene re-desplegar antes de dar por
  buena la fase.
