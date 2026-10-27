import { describe, expect, it } from "vitest";
import { DARK, FIXED, LIGHT, themeCss } from "../src/theme.js";

function channel(value) {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(index => channel(Number.parseInt(hex.slice(index, index + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(foreground, background) {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Pares de texto y fondo que styles.js combina de verdad. Mínimo 4,5; bordes de controles, 3.
const TEXT = [
  ["ink", "bg"], ["ink", "surface"], ["ink-1", "surface"], ["ink-2", "bg"], ["ink-2", "surface"], ["ink-3", "bg"], ["ink-3", "surface"],
  ["accent-text", "bg"], ["accent-text", "surface"], ["accent-deep", "accent-soft"], ["accent-text", "accent-soft"], ["accent-deep", "bg"],
  ["neg", "bg"], ["neg", "surface"], ["coral-text", "coral-soft"], ["yel-text", "yel-soft"], ["yel-text", "warn-bg"],
  ["teal-text", "teal-soft"], ["ink-2", "chip"], ["ink", "chip"], ["accent-deep", "ok-bg"],
];
const BORDERS = [["field", "surface"], ["field", "bg"], ["accent-line", "bg"], ["accent-line", "surface"]];

describe.each([["claro", LIGHT], ["oscuro", DARK]])("paleta %s", (_name, palette) => {
  it.each(TEXT)("%s sobre %s cumple 4,5:1", (foreground, background) => {
    expect(ratio(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(BORDERS)("el borde %s sobre %s cumple 3:1", (border, background) => {
    expect(ratio(palette[border], palette[background])).toBeGreaterThanOrEqual(3);
  });
  it("el texto sobre el verde de acento y sobre el rojo de saldo negativo cumple 4,5:1", () => {
    for (const text of [FIXED["on-accent"], FIXED["on-accent-2"]]) {
      expect(ratio(text, palette["accent-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(text, FIXED["hero-neg"])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("hoja de tema", () => {
  it("define todas las variables claras, oscuras y fijas, y elige el oscuro por prefers-color-scheme", () => {
    const css = themeCss();
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    for (const name of [...Object.keys(LIGHT), ...Object.keys(FIXED)]) expect(css).toContain(`--${name}:`);
    expect(css).toContain("@media (prefers-color-scheme:dark)");
    expect(css).toContain(`--bg:${DARK.bg}`);
  });
});
