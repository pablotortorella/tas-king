import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appCss } from "../src/styles.js";

// El glosario (docs/homesuite/GLOSARIO.md) fija una palabra por concepto. El término anterior de «grupo» no puede
// reaparecer en el código, la base, las pruebas, los scripts ni los documentos vigentes.
const root = path.resolve(import.meta.dirname, "../../..");

const SCOPE = ["apps/", "scripts/", "docs/", "openspec/", ".github/", "package.json", "README.md", "QUICK_START.md", "CLAUDE.md"];

// Excepciones, cada una con su motivo.
const EXCLUDED_PATHS = [
  ["openspec/changes/archive/", "registro histórico de decisiones pasadas, que OpenSpec no reescribe"],
  ["openspec/changes/grupos-con-identidad/", "el cambio que elimina el término lo nombra para describir el renombre"],
  ["apps/app/test/glossary.test.js", "esta prueba define los términos descartados"],
  ["docs/HOMESUITE_IDENTIDAD_Y_VISION.md", "documento de identidad y voz de marca, que usa «espacio» en sentido figurado («tu espacio», «un espacio para respirar»); el vocabulario del dominio lo fija el glosario"],
];
const ALLOWED_PHRASES = [
  ["white-space", "propiedad CSS"],
  ["space-between", "valor CSS"], ["space-around", "valor CSS"], ["space-evenly", "valor CSS"],
  ["press(\"Space\")", "nombre de la tecla de espacio en Playwright"],
  ["un espacio para la vida compartida", "lema de marca del sitio público, uso figurado y no el concepto (decisión pendiente de Pablo)"],
  ["feature/homesuite-authenticated-spaces", "nombre de una rama de git ya publicada, citado en documentos históricos"],
  ["espacios sobrantes", "caracteres en blanco, no el concepto"], ["espacios internos", "caracteres en blanco, no el concepto"],
  ["espacios y puntuación", "caracteres en blanco, no el concepto"], ["compuesto sólo de espacios", "caracteres en blanco, no el concepto"],
  ["vacío/espacios", "caracteres en blanco, no el concepto"],
  ["pasa a un espacio, espacios colapsados", "caracteres en blanco, no el concepto"], ["celdas con espacios", "caracteres en blanco, no el concepto"],
  ["espacios en blanco", "caracteres en blanco, no el concepto"], ["espacio en blanco", "caracteres en blanco, no el concepto"],
];

// «space» como palabra o identificador (spaceId, space_id, SPACE_X, createSpaceForUser) pero no namespace, whitespace ni spacing;
// «espacio(s)» en cualquier forma.
const DISCARDED = /(?<![A-Za-z])[Ss]paces?(?![a-z])|[a-z]Spaces?(?![a-z])|(?<![A-Za-z])SPACES?(?![A-Za-z])|[Ee]spacios?|ESPACIOS?/gu;

function trackedFiles() {
  const listed = execFileSync("git", ["ls-files", "-z", "--", ...SCOPE], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return listed.split("\0").filter(Boolean).filter(file => !EXCLUDED_PATHS.some(([prefix]) => file.startsWith(prefix)) && fs.existsSync(path.join(root, file)));
}

export function findDiscardedTerms(text) {
  let cleaned = text;
  for (const [phrase] of ALLOWED_PHRASES) cleaned = cleaned.split(phrase).join(" ".repeat(phrase.length));
  return [...cleaned.matchAll(DISCARDED)].map(match => match[0]);
}

describe("lenguaje del dominio", () => {
  it("el detector marca los términos descartados y deja pasar los usos legítimos", () => {
    expect(findDiscardedTerms("const spaceId = 1")).toEqual(["space"]);
    expect(findDiscardedTerms("space_id TEXT, FROM spaces")).toEqual(["space", "spaces"]);
    expect(findDiscardedTerms("renameSpace(createSpaceForUser)")).toEqual(["eSpace", "eSpace"]);
    expect(findDiscardedTerms("Crear espacio")).toEqual(["espacio"]);
    expect(findDiscardedTerms("/spaces/new")).toEqual(["spaces"]);
    expect(findDiscardedTerms("white-space: nowrap; justify-content: space-between")).toEqual([]);
    expect(findDiscardedTerms("namespace_id, whitespace, letter-spacing, Whitespace")).toEqual([]);
    expect(findDiscardedTerms("sin espacios en blanco")).toEqual([]);
    expect(findDiscardedTerms('await page.keyboard.press("Space")')).toEqual([]);
    expect(findDiscardedTerms("SPACE_LIMIT y ESPACIO")).toEqual(["SPACE", "ESPACIO"]);
  });

  it("ningún archivo vigente usa el término descartado", () => {
    const found = [];
    for (const file of trackedFiles()) {
      if (findDiscardedTerms(file).length) found.push(`${file}: el nombre del archivo`);
      const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
      lines.forEach((line, index) => { if (findDiscardedTerms(line).length) found.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`); });
    }
    expect(found.slice(0, 40), `${found.length} línea(s) con el término descartado`).toEqual([]);
  });

  // «Libro» queda como concepto técnico (`ledger`); mientras haya uno solo por grupo, ningún texto de la interfaz lo nombra. Se revisan las
  // líneas de código de la aplicación (los comentarios pueden hablar del libro).
  it("los textos de la interfaz no dicen «libro»", () => {
    const found = [];
    const sources = fs.readdirSync(path.join(root, "apps/app/src"), { recursive: true }).filter(file => file.endsWith(".js"));
    for (const file of sources) {
      fs.readFileSync(path.join(root, "apps/app/src", file), "utf8").split("\n").forEach((line, index) => {
        const code = line.trimStart();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;
        if (/\blibros?\b/iu.test(line.replace(/\s\/\/ .*$/u, ""))) found.push(`apps/app/src/${file}:${index + 1}: ${code.slice(0, 100)}`);
      });
    }
    expect(found.slice(0, 40), `${found.length} línea(s) con «libro»`).toEqual([]);
  });

  // El renombre automático ya rompió una vez `space-between` al leerlo como el término descartado.
  it("el renombre no alteró valores de CSS legítimos", () => {
    const css = appCss();
    expect(css).toContain("justify-content:space-between");
    expect(css).toContain("white-space:nowrap");
    expect(css).not.toMatch(/group-(between|around|evenly)/u);
  });
});
