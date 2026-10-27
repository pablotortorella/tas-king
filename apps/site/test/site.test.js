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

  it("conecta la landing de Cuentas Claras con la app del mismo staging", async () => {
    const body = '<p>En preparación.</p><!-- staging-app-entry -->';
    const staging = await worker.fetch(new Request("https://site-staging.homesuite.info/cuentas-claras"),
      { ...assetEnvironment(body), SITE_ENV: "staging" });
    expect(staging.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(staging.headers.get("Cache-Control")).toBe("no-store");
    expect(await staging.text()).toContain('href="https://staging.homesuite.info/cuentas-claras"');
    const production = await worker.fetch(new Request("https://homesuite.info/cuentas-claras"), assetEnvironment(body));
    expect(await production.text()).not.toContain('href="https://staging.homesuite.info/cuentas-claras"');
  });

  it("conecta la landing de Remanso con la app del mismo staging, sólo en staging", async () => {
    const body = '<p>En preparación.</p><!-- staging-app-entry -->';
    for (const path of ["/remanso", "/remanso.html"]) {
      const staging = await worker.fetch(new Request(`https://site-staging.homesuite.info${path}`),
        { ...assetEnvironment(body), SITE_ENV: "staging" });
      expect(staging.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(staging.headers.get("Cache-Control")).toBe("no-store");
      const html = await staging.text();
      expect(html).toContain('href="https://staging.homesuite.info/remanso"');
      expect(html).toContain("Las sesiones cortas no piden cuenta.");
      expect(html).not.toContain("staging-app-entry");
    }
    const production = await worker.fetch(new Request("https://homesuite.info/remanso"), assetEnvironment(body));
    const html = await production.text();
    expect(html).not.toContain("staging.homesuite.info");
    expect(production.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("en la landing de Tareas apunta al TasKing de staging", async () => {
    const staging = await worker.fetch(new Request("https://site-staging.homesuite.info/tareas"),
      { ...assetEnvironment('<a href="https://tas-king.pablotortorella.workers.dev">Tareas</a>'), SITE_ENV: "staging" });
    expect(await staging.text()).toContain('href="https://tas-king-staging.pablotortorella.workers.dev"');
  });

  it("mantiene la portada sin JavaScript y enlaza las cuatro landings", async () => {
    const html = await readFile(
      new URL("../public/index.html", import.meta.url),
      "utf8",
    );

    expect(html).toContain("Te damos la bienvenida a casa");
    expect(html).toContain("Organizá, cuidá y disfrutá tu hogar.");
    expect(html).toContain("Explorá las herramientas");
    expect(html).toContain('href="/tareas"');
    expect(html).toContain('href="/cuentas-claras"');
    expect(html).toContain('href="/compras"');
    expect(html).toContain('href="/remanso"');
    expect(html).toContain("Conocé Remanso");
    expect(html).toContain("Conocé Fun TasKing");
    expect(html).not.toContain("https://tas-king.pablotortorella.workers.dev");
    expect(html).toContain("Cuentas Claras");
    expect(html).toContain("Compras");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
  });

  it("usa el nuevo emblema y favicon en todas las páginas", async () => {
    const pages = ["index", "tareas", "cuentas-claras", "compras", "remanso"];
    for (const name of pages) {
      const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
      expect(html).toContain('href="/HomeSuite-favicon-simplificado.svg"');
      expect(html).toContain('src="/HomeSuite-favicon-simplificado.svg"');
      expect(html).not.toContain('href="/favicon.svg"');
    }
    const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(home).toContain('src="/HomeSuite-emblema.svg"');
    for (const name of ["HomeSuite-emblema.svg", "HomeSuite-emblema-preview.png", "HomeSuite-favicon-simplificado.svg", "HomeSuite-favicon-simplificado-preview.png"]) {
      expect((await readFile(new URL(`../public/${name}`, import.meta.url))).byteLength).toBeGreaterThan(0);
    }
  });

  it.each([
    ["tareas", "Fun TasKing!", true],
    ["cuentas-claras", "Las cuentas claras, sin vueltas.", false],
    ["compras", "Prepará tus listas con calma y evitá olvidos.", false],
    ["remanso", "Un rato de calma para la casa.", false],
  ])("mantiene /%s como landing estática y honesta", async (slug, heading, available) => {
    const html = await readFile(
      new URL(`../public/${slug}.html`, import.meta.url),
      "utf8",
    );

    expect(html).toContain(`href="https://homesuite.info/${slug}"`);
    expect(html).toContain(heading);
    expect(html).toContain('href="/"');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);

    if (available) {
      expect(html).toContain('href="https://tas-king.pablotortorella.workers.dev"');
      expect(html).toContain("Abrir Fun TasKing");
    } else {
      expect(html).toContain("Esta herramienta todavía está en preparación.");
      expect(html).not.toMatch(/<button\b|<form\b/i);
      expect(html).not.toContain("https://tas-king.pablotortorella.workers.dev");
    }
  });

  // Marco de identidad (docs/HOMESUITE_IDENTIDAD_Y_VISION.md, §4, §5 y §7): el hogar no presupone convivencia, las herramientas
  // se describen por lo que hacen y ninguna se presenta como «una mitad» de la suite.
  it.each(["index", "tareas", "cuentas-claras", "compras", "remanso"])("el texto de %s no presupone convivencia ni divide la suite", async (name) => {
    const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
    const visible = html.replace(/<[^>]+>/g, " ");
    for (const frase of ["vida compartida", "en equipo", "del equipo", "organizarnos", "otra mitad", "mitad de la casa", "Cuidarla, la otra"]) {
      expect(visible.toLowerCase(), `«${frase}» en ${name}`).not.toContain(frase.toLowerCase());
    }
    expect(visible).toContain("Tu hogar, a tu ritmo.");
  });
});
