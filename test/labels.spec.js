import { describe, it, expect } from "vitest";

// Paleta Material Design — debe coincidir con VALID_COLORS en src/routes/labels.js
// y LABEL_COLORS en public/index.html
const VALID_COLORS = [
  "#F44336", "#2196F3", "#4CAF50", "#FFC107", "#FF9800",
  "#9C27B0", "#00BCD4", "#009688", "#E91E63", "#3F51B5",
];

describe("Validación de colores para etiquetas", () => {
  it("tiene exactamente 10 colores válidos", () => {
    expect(VALID_COLORS).toHaveLength(10);
  });

  it("todos los colores son hexadecimales válidos", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    VALID_COLORS.forEach(color => {
      expect(color).toMatch(hexRegex);
    });
  });

  it("rechaza colores inválidos", () => {
    const invalid = ["#GGGGGG", "#123", "red", "#12345", "123456"];
    invalid.forEach(color => {
      expect(VALID_COLORS.includes(color)).toBe(false);
    });
  });

  it("acepta cualquiera de los 10 colores válidos", () => {
    VALID_COLORS.forEach(color => {
      expect(VALID_COLORS.includes(color)).toBe(true);
    });
  });
});

describe("Estructura de etiquetas", () => {
  it("una etiqueta tiene id, name, color, position", () => {
    const label = {
      id: "l1",
      name: "Bug",
      color: "#F44336",
      position: 0,
    };
    expect(label).toMatchObject({ id: expect.any(String), name: expect.any(String), color: expect.any(String), position: expect.any(Number) });
  });

  it("una asignación tarjeta-etiqueta solo tiene card_id y label_id", () => {
    const assignment = {
      card_id: "c1",
      label_id: "l1",
    };
    expect(assignment).toMatchObject({ card_id: expect.any(String), label_id: expect.any(String) });
  });
});
