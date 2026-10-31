import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { expectCleanDocument } from "./helpers/documento.js";

const origin = "https://staging.homesuite.info";

describe("Jardín Zen beta v0.2", () => {
  it("permite abrir la experiencia sin cuenta, sin consultar D1", async () => {
    const response = await app.request(`${origin}/jardin-zen`, {}, { DB: { prepare: () => { throw Error("No debería acceder a D1"); } } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await response.text();
    expect(html).toContain('id="jardin-zen"');
    expect(html).toContain('id="rake-size"');
    expect(html).toContain('Trazo fino');
    expect(html).toContain('data-tool="stone"');
    expect(html).toContain('data-tool="orbit"');
    expect(html).toContain('href="/jardin-zen/jardin-zen.css"');
    expect(html).toContain('src="/jardin-zen/jardin-zen.js"');
    expect(html).toContain('href="/"');
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/iu);
    expectCleanDocument(html);
  });
  it("conserva CSP estricta y sin archivos externos", async () => {
    const response = await app.request(`${origin}/jardin-zen`);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'; style-src 'self'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
