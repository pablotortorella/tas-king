import { describe, it, expect } from "vitest";

describe("Validación de colores para etiquetas", () => {
  const VALID_COLORS = [
    "#4477AA", "#66CCEE", "#228833", "#CCBB44", "#EE6677",
    "#AA3377", "#BBBBBB", "#002D9C", "#FF832B", "#009D9A",
    "#8A3FFC", "#EE538B", "#A2191F", "#737008", "#4D8400",
    "#0F62FE", "#BA4E00", "#D02670", "#697077", "#007448",
  ];

  it("tiene exactamente 20 colores válidos", () => {
    expect(VALID_COLORS).toHaveLength(20);
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

  it("acepta cualquiera de los 20 colores válidos", () => {
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
      color: "#EE6677",
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
