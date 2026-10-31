import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/remanso/remanso.css");

// Pares [primer plano, fondo, mínimo]: 4.5 para texto, 3 para bordes de controles,
// foco y marcas que comunican información (WCAG 1.4.3 y 1.4.11).
const PAIRS = [
  ["ink", "page", 4.5], ["ink", "surface", 4.5], ["ink", "soft", 4.5],
  ["muted", "page", 4.5], ["muted", "surface", 4.5], ["muted", "soft", 4.5],
  ["link", "page", 4.5], ["link", "surface", 4.5], ["link", "soft", 4.5],
  ["on-accent", "accent", 4.5], ["eyebrow", "page", 4.5],
  ["line", "page", 3], ["line", "surface", 3],
  ["focus", "page", 3], ["focus", "surface", 3],
  ["gold", "page", 3], ["gold", "soft", 3],
];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function tokens(css, scheme) {
  const marker = css.indexOf(`/* @tokens ${scheme} */`);
  expect(marker, `falta el bloque @tokens ${scheme}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", marker);
  const block = css.slice(open + 1, css.indexOf("}", open));
  return Object.fromEntries([...block.matchAll(/--rem-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gu)].map((match) => [match[1], match[2]]));
}

describe("contraste de la identidad de Remanso", async () => {
  const css = await readFile(CSS, "utf8");

  for (const scheme of ["claro", "oscuro", "noche"]) {
    const palette = tokens(css, scheme);

    it(`${scheme}: define todos los tokens usados`, () => {
      for (const name of new Set(PAIRS.flatMap(([a, b]) => [a, b]))) expect(palette[name], `--rem-${name}`).toMatch(/^#[0-9a-f]{6}$/u);
    });

    it.each(PAIRS)(`${scheme}: %s sobre %s ≥ %s:1`, (foreground, background, minimum) => {
      expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(minimum);
    });
  }

  it("no carga fuentes ni recursos de otros orígenes", () => {
    expect(css).not.toMatch(/@import|url\(\s*["']?https?:|\/\/[a-z0-9.-]+\.[a-z]{2,}/iu);
  });
});
