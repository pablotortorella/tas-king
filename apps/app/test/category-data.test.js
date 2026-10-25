import { describe, expect, it } from "vitest";
import { searchLedger } from "../src/ledger-ui.js";
import { CATEGORY_ICON_KEYS, DEFAULT_CATEGORIES, categoryIcon, defaultCategoriesJson } from "../src/category-data.js";
import { searchable } from "../src/text.js";

describe("normalización compartida", () => {
  it.each([
    ["Alimentos", "alimentos"],
    ["  ÁLIMENTOS ", "alimentos"],
    ["ALIMENTOS", "alimentos"],
    ["Café  y  Panadería", "cafe y panaderia"],
    ["Casa - Otro", "casa otro"],
    ["TV/teléfono/Internet", "tv telefono internet"],
    ["¿Ñandú?", "nandu"],
    ["", ""],
    [null, ""],
  ])("normaliza %j como %j", (input, expected) => expect(searchable(input)).toBe(expected));

  it("la búsqueda y las categorías producen la misma forma para las mismas variantes", () => {
    const variants = ["Casa - Otro", "casa otro", "CASA   -   OTRO", "Cása, otro"];
    expect(new Set(variants.map(searchable)).size).toBe(1);
    const entry = { id: "e1", description: "x", note: "", category: "Casa - Otro", currency: "COP", totalMinor: 100, effects: [] };
    for (const variant of variants) expect(searchLedger([entry], [], variant)).toHaveLength(1);
  });

  it("es idempotente", () => {
    for (const text of ["Álimentos Y Más", "a--b", "  x  "]) expect(searchable(searchable(text))).toBe(searchable(text));
  });
});

describe("lista inicial de categorías", () => {
  it("no tiene dos nombres con la misma forma normalizada", () => {
    const keys = DEFAULT_CATEGORIES.map(category => searchable(category.name));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("agrupa por grupo, con íconos permitidos y sin entradas vacías", () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThan(40);
    expect(new Set(DEFAULT_CATEGORIES.map(category => category.group))).toEqual(new Set(["Casa", "Comidas y bebidas", "Entretenimiento", "Transporte", "Utilidades", "Vida", "Viajes", "Ingresos", "Sin categoría"]));
    for (const category of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICON_KEYS).toContain(category.icon);
      expect(category.name.trim()).toBe(category.name);
      expect(searchable(category.name)).not.toBe("");
    }
  });

  it("incluye las mejoras decididas respecto de la lista de Splitwise", () => {
    const names = DEFAULT_CATEGORIES.map(category => category.name);
    for (const name of ["Suscripciones", "Servicio doméstico", "Avión", "Hotel", "Seguro del hogar", "Alquiler cobrado"]) expect(names).toContain(name);
  });

  it("viaja como un único JSON con claves normalizadas y orden estable", () => {
    const rows = JSON.parse(defaultCategoriesJson());
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(rows.map(row => row.position)).toEqual(rows.map((_, index) => index));
    for (const row of rows) expect(row.name_key).toBe(searchable(row.name));
  });

  it("cada ícono es un SVG decorativo propio y una clave desconocida cae en el genérico", () => {
    for (const key of CATEGORY_ICON_KEYS) expect(categoryIcon(key)).toMatch(/^<svg [^>]*aria-hidden="true"/u);
    expect(categoryIcon("no-existe")).toBe(categoryIcon("tag"));
    for (const key of CATEGORY_ICON_KEYS) expect(categoryIcon(key)).not.toMatch(/style=|<script|href=/u);
  });
});
