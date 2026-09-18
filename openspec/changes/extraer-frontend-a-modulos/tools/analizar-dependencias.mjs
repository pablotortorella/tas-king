// Analizador de dependencias entre las funciones del IIFE de app.js.
// Herramienta temporal de este change: se archiva junto con él.
//
// Imprime, por sección, qué funciones contiene y a qué funciones de OTRAS
// secciones llama. Sirve para encontrar grupos cerrados antes de moverlos, en
// vez de descubrir los acoplamientos cuando ya rompiste algo.
//
// OJO: los comentarios `// ---------- X ----------` derivaron del código con el
// tiempo (renderLabels vive bajo "Checklists", createLabel bajo "Objetivos").
// Agrupar por cohesión real, que es lo que muestra el grafo, no por esos títulos.
//
// Requiere acorn: npm install acorn --no-save

import { readFileSync } from "fs";
import { parse } from "acorn";
const src = readFileSync("public/js/app.js", "utf-8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const funcs = new Map();
const iife = ast.body.find(n => n.type === "ExpressionStatement" && /Call/.test(n.expression.type));
for (const n of iife.expression.callee.body.body) {
  if (n.type === "FunctionDeclaration" && n.id) funcs.set(n.id.name, { nodo: n, llama: new Set(), linea: n.loc.start.line });
  if (n.type === "VariableDeclaration") for (const d of n.declarations)
    if (d.id.type === "Identifier" && d.init && /Function/.test(d.init.type))
      funcs.set(d.id.name, { nodo: d.init, llama: new Set(), linea: d.loc.start.line });
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
for (const [nombre, info] of funcs) walk(info.nodo, n => {
  if (n.type === "CallExpression" && n.callee.type === "Identifier" && funcs.has(n.callee.name) && n.callee.name !== nombre) info.llama.add(n.callee.name);
});
const G = JSON.parse(process.argv[2]);
const fugas = [];
for (const c of G) {
  const i = funcs.get(c);
  if (!i) { console.log(`(falta ${c})`); continue; }
  for (const x of i.llama) if (!G.includes(x)) fugas.push(`${c} -> ${x}`);
}
console.log(fugas.length ? "FUGAS:\n  " + fugas.join("\n  ") : "GRUPO CERRADO: ninguna funcion del grupo llama a algo de afuera");
const usadas = new Set();
for (const [n,i] of funcs) if (!G.includes(n)) for (const x of i.llama) if (G.includes(x)) usadas.add(x);
console.log("\nsuperficie publica necesaria (lo que app.js debe importar):");
console.log("  " + [...usadas].sort().join(", "));
