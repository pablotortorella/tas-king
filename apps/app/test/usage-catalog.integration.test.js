import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { ACTION_LABELS, REMANSO_RESULTS, TOOL_LABELS, USAGE_CATALOG } from "../src/usage-catalog.js";
import { TOOLS } from "../src/usage.js";

// Tabla de rutas medidas (tarea 3.1): cada ruta del catálogo existe en la app, y no se mide Jardín Zen ni páginas sin sesión.
const registered = new Set(app.routes.filter((route) => route.method !== "ALL").map((route) => `${route.method} ${route.path}`));

describe("catálogo de uso", () => {
  it("cada ruta del catálogo está registrada en la app", () => {
    const missing = USAGE_CATALOG.map((entry) => `${entry.method} ${entry.path}`).filter((key) => !registered.has(key));
    expect(missing).toEqual([]);
  });

  it("no mide Jardín Zen, el ingreso, la aceptación ni las páginas sin conexión", () => {
    for (const entry of USAGE_CATALOG) {
      expect(entry.path).not.toMatch(/jardin-zen|^\/auth\/|^\/aceptar|sin-conexion|^\/demo\/|^\/local\/|^\/api\/local\//u);
    }
  });

  it("sólo usa herramientas, niveles y acciones conocidos, y cada acción tiene su nombre", () => {
    for (const entry of [...USAGE_CATALOG, ...Object.values(REMANSO_RESULTS)]) {
      expect(TOOLS).toContain(entry.tool);
      expect(["entro", "hizo"]).toContain(entry.level);
      if (entry.level === "hizo" && entry.tool !== "calm") expect(entry.action).toBeTruthy();
      if (entry.action) expect(ACTION_LABELS[entry.tool][entry.action]).toBeTruthy();
    }
    expect(Object.keys(TOOL_LABELS).sort()).toEqual([...TOOLS].sort());
  });

  it("cada herramienta medida tiene una forma de «entró» y una de «hizo algo»", () => {
    for (const tool of TOOLS) {
      const levels = new Set([...USAGE_CATALOG, ...Object.values(REMANSO_RESULTS)].filter((entry) => entry.tool === tool).map((entry) => entry.level));
      expect([...levels].sort()).toEqual(["entro", "hizo"]);
    }
  });
});
