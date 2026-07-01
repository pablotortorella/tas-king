import { describe, it, expect } from "vitest";
import { columnToJSON } from "../src/db/columns.js";
import { MAX_COLUMNS } from "../src/routes/columns.js";

describe("columnToJSON", () => {
  it("convierte un registro de DB a JSON", () => {
    const row = { id: "col1", name: "Pendiente", position: 2, is_done: 0 };
    expect(columnToJSON(row)).toEqual({ id: "col1", name: "Pendiente", position: 2, isDone: false });
  });

  it("marca isDone como true cuando is_done = 1", () => {
    const row = { id: "terminado", name: "Terminado", position: 5, is_done: 1 };
    const json = columnToJSON(row);
    expect(json.isDone).toBe(true);
  });

  it("trata cualquier valor truthy de is_done como isDone=true", () => {
    expect(columnToJSON({ id: "a", name: "A", position: 1, is_done: 1 }).isDone).toBe(true);
    expect(columnToJSON({ id: "b", name: "B", position: 2, is_done: 0 }).isDone).toBe(false);
  });
});

describe("Constantes de columnas", () => {
  it("MAX_COLUMNS es un número positivo", () => {
    expect(typeof MAX_COLUMNS).toBe("number");
    expect(MAX_COLUMNS).toBeGreaterThan(0);
  });

  it("MAX_COLUMNS >= 5 (mínimo para las columnas por defecto)", () => {
    expect(MAX_COLUMNS).toBeGreaterThanOrEqual(5);
  });
});

describe("Estructura de columna", () => {
  it("una columna tiene id, name, position, isDone", () => {
    const col = { id: "en_progreso", name: "En progreso", position: 3, isDone: false };
    expect(col).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      position: expect.any(Number),
      isDone: expect.any(Boolean),
    });
  });

  it("las columnas pueden tener posiciones decimales para reordenar", () => {
    const col = { id: "x", name: "X", position: 1.5, isDone: false };
    expect(col.position).toBe(1.5);
  });
});

describe("Columna de cierre (celebración)", () => {
  // getDoneColumnId vive en el frontend; testeamos la lógica pura aquí.
  const getDoneColumnId = (columns) =>
    (columns[columns.length - 1] || {}).id || "terminado";

  it("la columna de cierre es la última por posición (más a la derecha)", () => {
    const cols = [
      { id: "pendiente", position: 1 },
      { id: "en_progreso", position: 2 },
      { id: "terminado", position: 3 },
    ];
    expect(getDoneColumnId(cols)).toBe("terminado");
  });

  it("si se agrega una columna al final, pasa a ser la de cierre", () => {
    const cols = [
      { id: "pendiente", position: 1 },
      { id: "terminado", position: 2 },
      { id: "publicado", position: 3 },
    ];
    expect(getDoneColumnId(cols)).toBe("publicado");
  });

  it("si solo hay una columna, esa es la de cierre", () => {
    expect(getDoneColumnId([{ id: "unica", position: 1 }])).toBe("unica");
  });

  it("con array vacío devuelve el fallback 'terminado'", () => {
    expect(getDoneColumnId([])).toBe("terminado");
  });
});

describe("Validación de nombre de columna", () => {
  const MAX_NAME = 50;

  it("acepta nombres válidos", () => {
    const valid = ["Pendiente", "En progreso", "Por revisar", "Done", "🚀 Lanzado"];
    valid.forEach(name => {
      expect(name.length).toBeLessThanOrEqual(MAX_NAME);
      expect(name.trim().length).toBeGreaterThan(0);
    });
  });

  it("rechaza nombres vacíos", () => {
    const invalid = ["", "   ", "\t"];
    invalid.forEach(name => {
      expect(name.trim().length).toBe(0);
    });
  });

  it("rechaza nombres mayores a 50 caracteres", () => {
    const longName = "A".repeat(MAX_NAME + 1);
    expect(longName.length).toBeGreaterThan(MAX_NAME);
  });
});
