// Extractor de módulos, basado en AST (acorn). Herramienta temporal de este
// change: se archiva junto con él.
//
// POR QUÉ EXISTE, en vez de mover código a mano o con sed:
//
// 1. Un escáner de strings/comentarios hecho a mano falló con
//        return /[",\r\n]/.test(v) ? '"' + ...
//    porque decidía si la barra abría un regex mirando el último CARÁCTER
//    (la `n` de `return`) en vez del último token. A partir de ahí confundió
//    código con texto y llegó a renombrar dentro de
//    getElementById("assigneeFilter"). Con un AST los strings y comentarios
//    nunca son nodos Identifier.
//
// 2. Verifica que el grupo esté CERRADO: que ninguna función del grupo llame a
//    algo de fuera. Si hay fugas, aborta y las lista.
//
// 3. Verifica VARIABLES LIBRES: identificadores que el grupo usa pero que
//    declara otro módulo. Sin esto, mover una función deja atrás el `let` que
//    la sostiene. Pasó con `realceArmado`: la función movida lanzaba
//    ReferenceError y, como la invocaba el bus (que atrapa las excepciones de
//    sus oyentes), falló EN SILENCIO.
//
// REQUIERE acorn, instalado con `npm install acorn --no-save` (a propósito no
// está en package.json: es andamiaje, no dependencia del producto).
//
// Uso:
//   node tools/extraer-modulo.mjs '{"destino":"public/js/x.js","grupo":[...],
//                                   "publicas":[...],"cabecera":"...","importa":"..."}'
import { readFileSync, writeFileSync, existsSync } from "fs";
import { parse } from "acorn";

const cfg = JSON.parse(process.argv[2]);
const ARCHIVO = "public/js/app.js";
let src = readFileSync(ARCHIVO, "utf-8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const iife = ast.body.find(n => n.type === "ExpressionStatement" && /Call/.test(n.expression.type));

const funcs = new Map();
for (const n of iife.expression.callee.body.body) {
  let nombre = null, nodo = n;
  if (n.type === "FunctionDeclaration" && n.id) nombre = n.id.name;
  if (n.type === "VariableDeclaration" && n.declarations.length === 1) {
    const d = n.declarations[0];
    if (d.id.type === "Identifier") { nombre = d.id.name; nodo = d.init || n; }
  }
  if (nombre) funcs.set(nombre, { stmt: n, nodo, linea: n.loc.start.line });
}
function walk(n, cb) {
  if (!n || typeof n.type !== "string") return;
  cb(n);
  for (const k of Object.keys(n)) {
    if (["loc","start","end","type"].includes(k)) continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach(h => walk(h, cb));
    else if (v && typeof v.type === "string") walk(v, cb);
  }
}
// 1. Verificar que el grupo esta cerrado
const fugas = [];
for (const nom of cfg.grupo) {
  const i = funcs.get(nom);
  if (!i) { console.error(`ABORTA: no existe ${nom}`); process.exit(1); }
  walk(i.nodo, n => {
    if (n.type === "CallExpression" && n.callee.type === "Identifier"
        && funcs.has(n.callee.name) && !cfg.grupo.includes(n.callee.name))
      fugas.push(`${nom} -> ${n.callee.name}`);
  });
}
// 1.b Variables libres: el grupo referencia algo declarado fuera de el.
//     Sin esto, mover una funcion deja atras el `let` que la sostiene y el
//     fallo aparece recien en runtime, o peor: silenciado por el bus.
const declaradasFuera = new Set();
for (const n of iife.expression.callee.body.body) {
  if (n.type !== "VariableDeclaration") continue;
  for (const d of n.declarations)
    if (d.id.type === "Identifier" && !cfg.grupo.includes(d.id.name)
        && (!d.init || !/Function/.test(d.init.type)))
      declaradasFuera.add(d.id.name);
}
const libres = new Set();
for (const nom of cfg.grupo) {
  walk(funcs.get(nom).nodo, n => {
    if (n.type === "Identifier" && declaradasFuera.has(n.name)) libres.add(`${nom} usa ${n.name}`);
  });
}
if (libres.size && !cfg.permitirLibres) {
  console.error("ABORTA: el grupo usa variables declaradas afuera\n  " + [...libres].join("\n  "));
  console.error("  (sumalas al grupo, o pasa permitirLibres si de verdad son compartidas)");
  process.exit(1);
}

if (fugas.length && !cfg.permitirFugas) {
  console.error("ABORTA: el grupo no esta cerrado\n  " + [...new Set(fugas)].join("\n  "));
  process.exit(1);
}
// 2. Extraer con comentarios previos
function conComentarios(inicio) {
  const antes = src.slice(0, inicio);
  const lineas = antes.split("\n");
  let i = lineas.length - 1, n = 0;
  while (i - 1 >= 0 && /^\s*\/\//.test(lineas[i - 1])) { i--; n++; }
  return n ? antes.length - lineas.slice(i).join("\n").length : inicio;
}
const piezas = cfg.grupo.map(nom => {
  const s = funcs.get(nom).stmt;
  return { nom, ini: conComentarios(s.start), fin: s.end };
}).sort((a, b) => a.ini - b.ini);

const trozos = piezas.map(p => ({ nom: p.nom, texto: src.slice(p.ini, p.fin) }));
for (const p of [...piezas].sort((a, b) => b.ini - a.ini)) {
  let fin = p.fin;
  while (src[fin] === "\n") fin++;
  src = src.slice(0, p.ini) + src.slice(fin);
}
const dedent = t => t.split("\n").map(l => l.startsWith("  ") ? l.slice(2) : l).join("\n");
const cuerpo = trozos.map(t => {
  let x = dedent(t.texto);
  if (cfg.publicas.includes(t.nom)) {
    x = x.replace(/(^|\n)(async function |function |const |let )/, (m, a, b) => `${a}export ${b}`);
  }
  return x;
}).join("\n\n");

writeFileSync(cfg.destino, cfg.cabecera + "\n" + cfg.importa + "\n\n" + cuerpo + "\n");
const rel = "./" + cfg.destino.replace("public/js/", "");
src = src.replace('import { api } from "./core/api.js";',
  `import { api } from "./core/api.js";\nimport { ${cfg.publicas.join(", ")} } from "${rel}";`);
writeFileSync(ARCHIVO, src);
console.log(`${cfg.destino}: ${trozos.length} piezas, ${cfg.publicas.length} exportadas`);
