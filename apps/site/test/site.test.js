import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

function assetEnvironment(body = "asset") {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response(body, {
        headers: {
          "Cache-Control": "public, max-age=60",
          "Content-Type": "text/html; charset=utf-8",
          "ETag": "test-etag",
        },
      })),
    },
  };
}

describe("homesuite-site", () => {
  it("sirve el asset y preserva sus cabeceras junto con las de seguridad", async () => {
    const env = assetEnvironment("portada");
    const response = await worker.fetch(new Request("https://homesuite.info/"), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("portada");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("etag")).toBe("test-etag");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it("redirige www al apex y conserva ruta y query", async () => {
    const env = assetEnvironment();
    const response = await worker.fetch(
      new Request("https://www.homesuite.info/herramientas?origen=www"),
      env,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://homesuite.info/herramientas?origen=www",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("rechaza métodos que no son de lectura", async () => {
    const env = assetEnvironment();
    const response = await worker.fetch(
      new Request("https://homesuite.info/", { method: "POST" }),
      env,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it("mantiene la portada sin JavaScript y con el enlace productivo a TasKing", async () => {
    const html = await readFile(
      new URL("../public/index.html", import.meta.url),
      "utf8",
    );

    expect(html).toContain("Bienvenido a casa");
    expect(html).toContain("Abrir Fun TasKing");
    expect(html).toContain("https://tas-king.pablotortorella.workers.dev");
    expect(html).toContain("Gastos");
    expect(html).toContain("Compras");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
  });
});
