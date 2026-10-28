import { describe, expect, it } from "vitest";
import { HERRAMIENTAS, TASKING_URL, renderTools, taskingUrl } from "../src/tools.js";

// Lista única de herramientas de la suite: el inicio de la app la dibuja y la comprobación de coherencia con el sitio público
// (scripts/homesuite-coherencia.mjs y su prueba) la compara con lo que anuncia homesuite.info.
describe("herramientas de la suite", () => {
  it("son cuatro, en este orden, con ruta única y un estado conocido", () => {
    expect(HERRAMIENTAS.map((tool) => tool.nombre)).toEqual(["Fun TasKing", "Cuentas Claras", "Compras", "Remanso"]);
    expect(new Set(HERRAMIENTAS.map((tool) => tool.ruta)).size).toBe(4);
    for (const tool of HERRAMIENTAS) expect(["disponible", "beta", "preparacion"]).toContain(tool.estado);
  });

  it("Fun TasKing está disponible; Cuentas Claras y Remanso, en versión beta; Compras no se muestra afuera", () => {
    const estado = Object.fromEntries(HERRAMIENTAS.map((tool) => [tool.nombre, tool.estado]));
    expect(estado).toEqual({ "Fun TasKing": "disponible", "Cuentas Claras": "beta", Compras: "preparacion", Remanso: "beta" });
    expect(HERRAMIENTAS.filter((tool) => tool.publica).map((tool) => tool.nombre)).toEqual(["Fun TasKing", "Cuentas Claras", "Remanso"]);
  });

  it("el inicio dibuja una tarjeta por herramienta, con el acento de las que lo tienen", () => {
    const html = renderTools();
    expect(html.match(/<a class="tool-card/g)).toHaveLength(4);
    expect(html).toContain('<a class="tool-card tool-card-tasks" href="/tareas"><strong>Fun TasKing</strong>');
    expect(html).toContain('<a class="tool-card" href="/compras"><strong>Compras</strong>');
  });

  it("TasKing se abre en el ambiente de quien lo pide: producción sólo desde app.homesuite.info", () => {
    expect(taskingUrl("app.homesuite.info")).toBe("https://tas-king.pablotortorella.workers.dev");
    for (const host of ["staging.homesuite.info", "localhost", "127.0.0.1", "otro.example"]) {
      expect(taskingUrl(host)).toBe("https://tas-king-staging.pablotortorella.workers.dev");
    }
    expect(TASKING_URL.production).not.toMatch(/staging/);
  });
});
