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
      expect(html).not.toMatch(/sin crear una cuenta|no piden cuenta/u); // la landing no habla de cuentas (2026-10-27)
      expect(html).not.toContain("staging-app-entry");
    }
    const production = await worker.fetch(new Request("https://homesuite.info/remanso"), assetEnvironment(body));
    const html = await production.text();
    expect(html).not.toContain("staging.homesuite.info");
    expect(production.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("conecta la portada con Remanso: en staging el hero abre la app, en producción no hay acceso a la app", async () => {
    const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(home).toContain("<!-- staging-app-entry -->");
    for (const path of ["/", "/index.html"]) {
      const staging = await worker.fetch(new Request(`https://site-staging.homesuite.info${path}`),
        { ...assetEnvironment(home), SITE_ENV: "staging" });
      expect(staging.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(staging.headers.get("Cache-Control")).toBe("no-store");
      const html = await staging.text();
      expect(html).toContain('class="secondary-action" href="https://staging.homesuite.info/remanso"');
      expect(html).toContain("Probá Remanso");
      expect(html).not.toContain("staging-app-entry");
    }
    const production = await worker.fetch(new Request("https://homesuite.info/"), assetEnvironment(home));
    const html = await production.text();
    expect(html).not.toContain("staging.homesuite.info");
    expect(html).not.toContain("Probá Remanso");
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
    // El hero no usa una frase temporal sobre herramientas «que se están sumando»: la calma se conecta con Remanso.
    expect(html.replace(/\s+/g, " ")).toContain("organizar lo cotidiano y encontrar momentos de calma");
    expect(html).not.toContain("Estamos sumando");
    expect(html).toContain('href="/tareas"');
    expect(html).toContain('href="/cuentas-claras"');
    expect(html).toContain('href="/remanso"');
    expect(html).toContain("Conocé Remanso");
    expect(html).toContain("Conocé Fun TasKing");
    expect(html).not.toContain("https://tas-king.pablotortorella.workers.dev");
    expect(html).toContain("Cuentas Claras");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain('href="/terminos"');
  });

  it.each([
    ["privacidad", "Política de privacidad"],
    ["terminos", "Términos y condiciones"],
  ])("publica /%s como documento legal de la suite", async (slug, heading) => {
    const html = await readFile(new URL(`../public/${slug}.html`, import.meta.url), "utf8");
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain(`href="https://homesuite.info/${slug}"`);
    expect(html).toContain("Cuentas Claras");
    expect(html).toContain("Remanso");
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain('href="/terminos"');
    expect(html).not.toMatch(/\{\{[^}]+\}\}/u);
    expect(html).not.toMatch(/<script\b|\sstyle=/iu);
  });

  it("usa el nuevo emblema y favicon en todas las páginas", async () => {
    const pages = ["index", "tareas", "cuentas-claras", "remanso"];
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
      expect(html).toContain("Esta herramienta está en versión beta.");
      expect(html).not.toMatch(/en preparación|Próximamente/iu);
      expect(html).not.toMatch(/<button\b|<form\b/i);
      expect(html).not.toContain("https://tas-king.pablotortorella.workers.dev");
    }
  });

  // Marco de identidad (docs/HOMESUITE_IDENTIDAD_Y_VISION.md, §4, §5 y §7): el hogar no presupone convivencia, las herramientas
  // se describen por lo que hacen y ninguna se presenta como «una mitad» de la suite.
  it.each(["index", "tareas", "cuentas-claras", "remanso"])("el texto de %s no presupone convivencia ni divide la suite", async (name) => {
    const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
    const visible = html.replace(/<[^>]+>/g, " ");
    for (const frase of ["sin crear una cuenta", "no piden cuenta", "vida compartida", "en equipo", "del equipo", "organizarnos", "otra mitad", "mitad de la casa", "Cuidarla, la otra"]) {
      expect(visible.toLowerCase(), `«${frase}» en ${name}`).not.toContain(frase.toLowerCase());
    }
    expect(visible).toContain("Tu hogar, a tu ritmo.");
  });

  // Catálogo público: sólo las tres herramientas funcionales. Compras queda oculto hasta que exista (su landing espera en
  // apps/site/pendientes/ y no se publica).
  it("la portada y las landings muestran sólo las tres herramientas funcionales: Compras está oculto", async () => {
    const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(home.match(/class="tool-card[ "]/g)).toHaveLength(3);
    for (const name of ["index", "tareas", "cuentas-claras", "remanso"]) {
      const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
      expect(html, name).not.toMatch(/href="\/compras"|Compras/u);
    }
    await expect(readFile(new URL("../public/compras.html", import.meta.url))).rejects.toThrow();
    await expect(readFile(new URL("../pendientes/compras.html", import.meta.url), "utf8")).resolves.toContain("Compras");
  });

  // Estado de cada herramienta (2026-10-27, Pablo): Fun TasKing está disponible; Cuentas Claras y Remanso funcionan y se rotulan
  // «Versión Beta». Ninguna página dice «Próximamente» ni «En preparación».
  it("la portada rotula una herramienta Disponible y dos Versión Beta, sin «Próximamente»", async () => {
    const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    expect(home.match(/class="status status-available">Disponible</g)).toHaveLength(1);
    expect(home.match(/class="status">Versión Beta</g)).toHaveLength(2);
    for (const name of ["index", "tareas", "cuentas-claras", "remanso"]) {
      const html = await readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
      expect(html, name).not.toMatch(/Próximamente|en preparación/iu);
    }
  });

  // Acentos por producto (verde, terracota y ámbar de la paleta de la suite): sólo en rótulos, bordes e íconos, nunca como fondo de
  // texto blanco. Cada acento debe leerse (4,5:1) sobre la página, la tarjeta y su propio fondo suave, en claro y en oscuro.
  describe("acentos por producto", async () => {
    const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
    const corte = css.indexOf("@media (prefers-color-scheme: dark)");
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const accent = (block, product) => {
      const rule = block.match(new RegExp(`\\.tool-card-${product}[^{]*\\.product-page-${product}\\s*\\{([^}]*)\\}`, "u"));
      expect(rule, `falta la regla del acento de ${product}`).not.toBeNull();
      return Object.fromEntries([...rule[1].matchAll(/--product-accent(-soft)?:\s*(#[0-9a-f]{6})/gu)].map((m) => [m[1] ? "soft" : "accent", m[2]]));
    };
    const ESQUEMAS = [["claro", css.slice(0, corte), "#f7f2e8", "#fffdf8"], ["oscuro", css.slice(corte), "#161914", "#20251f"]];
    it.each(ESQUEMAS.flatMap(([name, block, page, surface]) => ["tasks", "expenses", "calm"].map((product) => [name, product, block, page, surface])))(
      "%s: el acento de %s se lee sobre la página, la tarjeta y su fondo suave", (_name, product, block, page, surface) => {
        const { accent: color, soft } = accent(block, product);
        for (const fondo of [page, surface, soft]) expect(ratio(color, fondo)).toBeGreaterThanOrEqual(4.5);
      });

    it("cada tarjeta de la portada y cada landing declaran su producto", async () => {
      const home = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
      for (const product of ["tasks", "expenses", "calm"]) {
        expect(home).toContain(`tool-card-${product}`);
        const page = await readFile(new URL(`../public/${{ tasks: "tareas", expenses: "cuentas-claras", calm: "remanso" }[product]}.html`, import.meta.url), "utf8");
        expect(page).toContain(`product-page-${product}`);
      }
    });
  });
});
