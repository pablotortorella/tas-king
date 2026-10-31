import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configuración del Worker y módulos servidos al navegador", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

  it("la minificación está apagada de forma explícita, porque split.js y text.js se sirven con su propio texto", () => {
    expect(config).toMatch(/^\s*"minify":\s*false,/mu);
  });

  it("ningún ambiente la vuelve a encender", () => {
    expect(config).not.toMatch(/"minify":\s*true/u);
  });
});
