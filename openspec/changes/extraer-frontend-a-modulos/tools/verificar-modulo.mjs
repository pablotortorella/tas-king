// Verifica que un módulo no use identificadores que no declara ni importa.
// Herramienta temporal de este change: se archiva junto con él.
//
// POR QUÉ EXISTE: el extractor por AST ya avisa de variables libres, pero no
// todos los bloques se pueden mover con él —los que incluyen listeners no son
// declaraciones— y esos hay que cortarlos por rangos de texto. Ahí no hay red.
// Pasó dos veces: io.js se llevó una sección vecina que llamaba a funciones que
// no importaba, y boards.js quedó sin AVATAR_COLORS. Las dos fallaron recién en
// el navegador, y una de ellas solo al usar una pantalla puntual.
//
// Uso:  node tools/verificar-modulo.mjs public/js/boards.js
import { readFileSync } from "fs";
import { parse } from "acorn";

const archivo = process.argv[2];
const src = readFileSync(archivo, "utf-8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });

const GLOBALES = new Set(["window","document","console","Math","JSON","Date","Object","Array","String",
  "Number","Boolean","Promise","Set","Map","Error","RegExp","localStorage","sessionStorage","location",
  "history","fetch","setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame",
  "cancelAnimationFrame","alert","confirm","prompt","navigator","CSS","URL","URLSearchParams","Blob",
  "FileReader","FormData","Intl","isNaN","parseInt","parseFloat","Symbol","globalThis","undefined",
  "NaN","Infinity","structuredClone","queueMicrotask","AbortController","Event","CustomEvent","Node",
  "encodeURIComponent","decodeURIComponent","encodeURI","decodeURI","atob","btoa","AbortSignal",
  "crypto","performance","Headers","Request","Response","TextEncoder","TextDecoder"]);

const declarados = new Set();
function ids(pat, out) {
  if (!pat) return;
  if (pat.type === "Identifier") out.push(pat.name);
  else if (pat.type === "ObjectPattern") pat.properties.forEach(p => ids(p.value || p.argument, out));
  else if (pat.type === "ArrayPattern") pat.elements.forEach(e => ids(e, out));
  else if (pat.type === "AssignmentPattern") ids(pat.left, out);
  else if (pat.type === "RestElement") ids(pat.argument, out);
}
function walk(n, cb, padre = null) {
  if (!n || typeof n.type !== "string") return;
  cb(n, padre);
  for (const k of Object.keys(n)) {
    if (["loc","start","end","type"].includes(k)) continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach(h => walk(h, cb, n));
    else if (v && typeof v.type === "string") walk(v, cb, n);
  }
}
// Todo lo que el modulo declara en cualquier scope, mas lo que importa.
walk(ast, (n) => {
  const out = [];
  if (n.type === "VariableDeclarator") ids(n.id, out);
  if (/Function/.test(n.type)) { n.params.forEach(p => ids(p, out)); if (n.id) out.push(n.id.name); }
  if (n.type === "CatchClause") ids(n.param, out);
  if (n.type === "ClassDeclaration" && n.id) out.push(n.id.name);
  if (n.type === "ImportDeclaration") n.specifiers.forEach(e => out.push(e.local.name));
  out.forEach(x => declarados.add(x));
});

const faltan = new Map();
walk(ast, (n, padre) => {
  if (n.type !== "Identifier") return;
  if (padre?.type === "MemberExpression" && padre.property === n && !padre.computed) return;
  if (padre?.type === "Property" && padre.key === n && !padre.computed) return;
  if (padre?.type === "ImportSpecifier" || padre?.type === "ImportDefaultSpecifier") return;
  if (declarados.has(n.name) || GLOBALES.has(n.name)) return;
  if (!faltan.has(n.name)) faltan.set(n.name, n.loc.start.line);
});

if (!faltan.size) console.log(`${archivo}: OK, no usa nada que no declare o importe`);
else {
  console.error(`${archivo}: usa identificadores que no declara ni importa`);
  for (const [nom, linea] of faltan) console.error(`  ${nom}  (línea ${linea})`);
  process.exit(1);
}
