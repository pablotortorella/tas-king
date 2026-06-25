import { describe, it, expect } from "vitest";

// Lógica de negocio del checklist: progress y ordenamiento
describe("Checklist: progreso", () => {
  function calcProgress(items) {
    const total = items.length;
    const checked = items.filter(i => i.checked).length;
    return total ? Math.round(checked / total * 100) : 0;
  }

  it("0% cuando no hay ítems", () => {
    expect(calcProgress([])).toBe(0);
  });

  it("0% cuando ningún ítem está marcado", () => {
    const items = [
      { id: "1", text: "A", checked: false, position: 0 },
      { id: "2", text: "B", checked: false, position: 1 },
    ];
    expect(calcProgress(items)).toBe(0);
  });

  it("50% cuando la mitad está marcada", () => {
    const items = [
      { id: "1", text: "A", checked: true,  position: 0 },
      { id: "2", text: "B", checked: false, position: 1 },
    ];
    expect(calcProgress(items)).toBe(50);
  });

  it("100% cuando todos están marcados", () => {
    const items = [
      { id: "1", text: "A", checked: true, position: 0 },
      { id: "2", text: "B", checked: true, position: 1 },
    ];
    expect(calcProgress(items)).toBe(100);
  });

  it("redondea hacia el entero más cercano", () => {
    const items = [
      { id: "1", text: "A", checked: true,  position: 0 },
      { id: "2", text: "B", checked: false, position: 1 },
      { id: "3", text: "C", checked: false, position: 2 },
    ];
    expect(calcProgress(items)).toBe(33);
  });
});

describe("Checklist: reordenar ítems", () => {
  function swap(items, i, j) {
    const sorted = items.slice().sort((a, b) => a.position - b.position);
    [sorted[i].position, sorted[j].position] = [sorted[j].position, sorted[i].position];
    return sorted.sort((a, b) => a.position - b.position);
  }

  it("sube un ítem intercambiando posiciones", () => {
    const items = [
      { id: "1", text: "A", position: 0 },
      { id: "2", text: "B", position: 1 },
      { id: "3", text: "C", position: 2 },
    ];
    const result = swap(items, 1, 0); // B sube
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("1");
    expect(result[2].id).toBe("3");
  });

  it("baja un ítem intercambiando posiciones", () => {
    const items = [
      { id: "1", text: "A", position: 0 },
      { id: "2", text: "B", position: 1 },
      { id: "3", text: "C", position: 2 },
    ];
    const result = swap(items, 0, 1); // A baja
    expect(result[0].id).toBe("2");
    expect(result[1].id).toBe("1");
    expect(result[2].id).toBe("3");
  });
});

describe("Checklist: estructura", () => {
  it("un checklist tiene id, cardId, name, items", () => {
    const cl = { id: "cl1", cardId: "c1", name: "Lista de tareas", position: 0, items: [] };
    expect(cl).toMatchObject({
      id: expect.any(String),
      cardId: expect.any(String),
      name: expect.any(String),
      items: expect.any(Array),
    });
  });

  it("un ítem tiene id, checklistId, text, checked, position", () => {
    const item = { id: "i1", checklistId: "cl1", text: "Hacer algo", checked: false, position: 0 };
    expect(item).toMatchObject({
      id: expect.any(String),
      checklistId: expect.any(String),
      text: expect.any(String),
      checked: expect.any(Boolean),
      position: expect.any(Number),
    });
  });

  it("el nombre no puede estar vacío", () => {
    const isValid = name => typeof name === "string" && name.trim().length > 0;
    expect(isValid("")).toBe(false);
    expect(isValid("  ")).toBe(false);
    expect(isValid("Lista de tareas")).toBe(true);
  });
});
