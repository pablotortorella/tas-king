# Retomar este change

**Última sesión: 2026-09-17.** Todo lo hecho está commiteado y pusheado: si esta
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

**Verificado**: 206 unitarios + 84 E2E en verde, y el núcleo modular probado
contra Cloudflare real (no solo `wrangler dev`).

```
public/index.html   512 lineas de markup   (era 4.545)
public/js/
  app.js        2.462   <- lo que falta repartir
  board.js        333   capa del tablero
  feedback.js     209   pulso WIP + tip diario + confeti
  drag.js         171   arrastre + paneo
  theme.js         44   tema y paleta (no importa nada: va debajo de board)
  theme-boot.js    14   anti-flash, script clasico bloqueante
  core/  state 85 · dom 73 · bus 56 · api 38
public/css/app.css  809
```

**Fases cerradas**: F1 (cabeceras al documento), F0 (tests de caracterización),
F2 (CSS fuera), F3/F4 (JS fuera y como módulo ES), y el núcleo + 4 features.

**Arquitectura vigente** (corregida durante la implementación, ver D3 en `design.md`):

```
app.js            composition root: arranca, cablea, registra hooks de window
   |
FEATURES          feedback  drag  (faltan: modal, checklists, goals, metrics,
   |                                labels, columns, boards, io, admin, keyboard, polling)
BOARD             board.js — render, loadBoard, loadCards, withCardMutation
   |
NUCLEO + THEME    state  api  dom  bus  |  theme (no importa nada)
```

Regla: una feature importa de board y del núcleo, **nunca de otra feature**.
Cuando hay que avisar hacia arriba y no se espera respuesta, se emite por el bus.
Lo que se espera (`await loadCards()`) se llama directo: el bus devuelve
`undefined` y atrapa excepciones, así que no puede reemplazar un `await`.

## 4. El próximo paso concreto

Quedan 11 secciones en `app.js`. El orden no importa mucho; sí el método:

```bash
# 1. Ver qué grupos están cerrados
node openspec/changes/extraer-frontend-a-modulos/tools/analizar-dependencias.mjs '["fnA","fnB"]'

# 2. Extraer (aborta solo si el grupo no está cerrado o usa variables de afuera)
node openspec/changes/extraer-frontend-a-modulos/tools/extraer-modulo.mjs '{
  "destino":"public/js/NOMBRE.js",
  "grupo":["..."], "publicas":["..."],
  "cabecera":"// comentario del modulo", "importa":"import ... "}'

# 3. Verificar SIEMPRE, en este orden
cp public/js/NOMBRE.js /tmp/s.mjs && node --check /tmp/s.mjs
npx playwright test --reporter=line
npm test

# 4. Un commit por módulo
```

**Ojo con los títulos de sección**: los comentarios `// ---------- X ----------`
derivaron del código. `renderLabels` vive bajo "Checklists" y `createLabel` bajo
"Objetivos dentro del modal". Agrupar por lo que dice el grafo, no por el título.
Por eso algunos módulos no van a coincidir con los nombres de `tasks.md`.

Después de los módulos quedan **5.21-5.23** (composition root, los cuatro hooks
de `window` juntos, verificación), el **grupo 6** (sacar `'unsafe-inline'`) y el
**grupo 7** (documentación e integración).

**Decisión pendiente antes del grupo 6**, marcada en el diseño como "decidir
antes, no durante": `landing.html`, `releases.html`, `revoked.html` y
`terminos.html` tienen 8 bloques `<script>` inline entre las cuatro. O se
extraen también, o la política de contenido se diferencia por ruta.

## 5. Herramientas y trampas

Las dos herramientas en `tools/` son andamiaje de este change y se archivan con
él. Requieren `acorn`, instalado con `--no-save` a propósito: no es dependencia
del producto.

Cinco cosas que salieron mal en la última sesión y no conviene repetir:

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
   La herramienta de AST no sirve cuando el bloque incluye listeners (no son
   declaraciones), y al cortar `io.js` por texto se coló la sección vecina
   "Selector de tablero", que llamaba a funciones que el módulo no importaba.
   No fallaba al cargar la página, solo al usar el selector. El chequeo que lo
   evita cuesta un comando:
   `grep -n "^// ---------- " public/js/NUEVO.js`

Y la que funcionó: **un commit por unidad lógica**. Salvó el día dos veces.

## 6. Pendientes conocidos (ninguno bloquea)

- **El bus atrapa las excepciones de sus oyentes.** Un fallo en un aviso se
  registra en consola en vez de cortar. Ya escondió un `ReferenceError` una vez.
  Al mover un módulo, confiar en el chequeo de variables libres, no en la consola.
- **Flake sin causa identificada**: cada tanto el `beforeEach` de
  `card-mutation-performance` se cuelga en `page.goto` porque dos subrecursos
  nunca completan. Mitigado con `retries: 1` en local; Playwright lo cuenta
  aparte como "flaky". Cinco hipótesis medidas y descartadas.
- **9 referencias viejas a `public/index.html`** en docs y comentarios
  (`src/constants.js:3`, `test/labels.spec.js:4`, `docs/CAMBIOS-MULTICAPA.md:110`,
  `docs/WORKFLOW.md:372`, ADR-014, ADR-015, `docs/ADRs.md:19` y dos ítems del
  backlog con números de línea muertos). Va en el grupo 7.
- **30 tests unitarios que nunca corren**: `vitest.config.mjs` incluye
  `test/**/*.test.js` y hay dos archivos `.spec.js`. Uno falla de verdad
  (`/uploads/:key` devuelve 500 en vez de 401). **Preexistente y fuera del
  alcance de este change** — no mezclarlo acá.
- **`estado.state.cards`** se lee mal. Renombrar era cambio semántico; quedó como
  deuda deliberada.
