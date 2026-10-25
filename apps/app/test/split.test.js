import { describe, expect, it } from "vitest";
import { splitEqually } from "../src/finance.js";
import { splitAmount } from "../src/split.js";

const names = { a: "Ana", b: "Beto", c: "Carla" };
const order = { a: 0, b: 1, c: 2 };
const base = { units: 2, currency: "COP", beneficiaries: ["a", "b", "c"], order, names };
const split = (overrides) => splitAmount({ ...base, ...overrides });
const amounts = (result) => Object.fromEntries(result.allocations.map(item => [item.participantId, item.amountMinor]));

describe("ejemplos del spec", () => {
  it("reparto igual: 100,00 y 100,01 entre tres", () => {
    expect(split({ totalMinor: 10000, method: "equal" }).allocations.map(item => item.amountMinor)).toEqual([3334, 3333, 3333]);
    const odd = split({ totalMinor: 10001, method: "equal" });
    expect(odd.allocations.map(item => item.amountMinor)).toEqual([3334, 3334, 3333]);
    expect(odd.residue).toEqual({ minor: 2, to: ["a", "b"] });
  });

  it("porcentajes: 50 / 30 / 20 de 100,00", () => {
    const result = split({ totalMinor: 10000, method: "percent", inputs: { a: "50", b: "30", c: "20" } });
    expect(amounts(result)).toEqual({ a: 5000, b: 3000, c: 2000 });
    expect(result.residue.minor).toBe(0);
  });

  it("porcentajes con residuo: 33,33 / 33,33 / 33,34 de 10,00 asigna la unidad al mayor resto", () => {
    const result = split({ totalMinor: 1000, method: "percent", inputs: { a: "33,33", b: "33.33", c: "33,34" } });
    expect(amounts(result)).toEqual({ a: 333, b: 333, c: 334 });
    expect(result.residue).toEqual({ minor: 1, to: ["c"] });
  });

  it("partes: 2 / 1 / 1 de 100,00 y una persona con cero partes queda fuera", () => {
    expect(amounts(split({ totalMinor: 10000, method: "shares", inputs: { a: "2", b: "1", c: "1" } }))).toEqual({ a: 5000, b: 2500, c: 2500 });
    expect(amounts(split({ totalMinor: 10000, method: "shares", inputs: { a: "1", b: "1", c: "0" } }))).toEqual({ a: 5000, b: 5000 });
  });

  it("importes exactos que suman el total", () => {
    expect(amounts(split({ totalMinor: 10000, method: "exact", inputs: { a: "20", b: "30,50", c: "49.50" } }))).toEqual({ a: 2000, b: 3050, c: 4950 });
  });

  it("algunos fijos: 10,00 para Ana y el resto entre las otras dos", () => {
    const result = split({ totalMinor: 10000, method: "fixed", inputs: { a: "10,00", b: "", c: "" } });
    expect(amounts(result)).toEqual({ a: 1000, b: 4500, c: 4500 });
  });

  it("algunos fijos: el resto se reparte con residuo entre quienes no tienen fijo", () => {
    const result = split({ totalMinor: 10001, method: "fixed", inputs: { a: "10", b: "", c: "" } });
    expect(Object.values(amounts(result)).reduce((sum, value) => sum + value, 0)).toBe(10001);
    expect(amounts(result).a).toBe(1000);
    expect(result.residue).toEqual({ minor: 1, to: ["b"] });
  });

  it("todos con fijo que suman el total, y sin fijos equivale a igual", () => {
    expect(amounts(split({ totalMinor: 10000, method: "fixed", inputs: { a: "20", b: "30", c: "50" } }))).toEqual({ a: 2000, b: 3000, c: 5000 });
    expect(split({ totalMinor: 10000, method: "fixed", inputs: {} }).allocations).toEqual(split({ totalMinor: 10000, method: "equal" }).allocations);
  });

  it("la única beneficiaria recibe todo: el atajo «lo debe todo una persona»", () => {
    expect(split({ totalMinor: 10000, method: "equal", beneficiaries: ["b"] }).allocations).toEqual([{ participantId: "b", amountMinor: 10000 }]);
  });

  it("monedas sin decimales y con tres decimales conservan el total", () => {
    expect(split({ units: 0, currency: "CLP", totalMinor: 100, method: "equal" }).allocations.map(item => item.amountMinor)).toEqual([34, 33, 33]);
    const kwd = split({ units: 3, currency: "KWD", totalMinor: 1001, method: "shares", inputs: { a: "1", b: "1", c: "1" } });
    expect(kwd.allocations.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(1001);
    expect(split({ units: 0, currency: "CLP", totalMinor: 100, method: "exact", inputs: { a: "50,5", b: "1", c: "1" } }).ok).toBe(false);
  });
});

describe("rechazos con motivo", () => {
  const rejected = (overrides) => { const result = split(overrides); expect(result.ok).toBe(false); return result; };

  it("porcentajes que no suman 100", () => {
    expect(rejected({ totalMinor: 10000, method: "percent", inputs: { a: "50", b: "30", c: "19" } }).error).toContain("99,00 %");
  });
  it("importes exactos con otra suma, con la diferencia", () => {
    expect(rejected({ totalMinor: 10000, method: "exact", inputs: { a: "30", b: "30", c: "39" } }).error).toContain("faltan COP 1,00");
    expect(rejected({ totalMinor: 10000, method: "exact", inputs: { a: "30", b: "30", c: "41" } }).error).toContain("sobran COP 1,00");
  });
  it("valores negativos, vacíos o ilegibles indican a quién corresponden", () => {
    for (const method of ["percent", "shares", "exact"]) {
      const result = rejected({ totalMinor: 10000, method, inputs: { a: "-1", b: "50", c: "50" } });
      expect(result.participantId, method).toBe("a");
      expect(result.error, method).toContain("Ana");
    }
    expect(rejected({ totalMinor: 10000, method: "percent", inputs: { a: "50", b: "", c: "50" } }).participantId).toBe("b");
    expect(rejected({ totalMinor: 10000, method: "fixed", inputs: { a: "abc" } }).participantId).toBe("a");
  });
  it("todas las partes en cero", () => {
    expect(rejected({ totalMinor: 10000, method: "shares", inputs: { a: "0", b: "0", c: "0" } }).error).toContain("partes");
  });
  it("sin beneficiarias y método desconocido", () => {
    expect(rejected({ totalMinor: 10000, method: "equal", beneficiaries: [] }).error).toContain("al menos una persona");
    expect(rejected({ totalMinor: 10000, method: "ajuste" }).error).toBe("Reparto inválido.");
  });
  it("fijos que superan el total, todos con fijo que no suman y sin resto", () => {
    expect(rejected({ totalMinor: 10000, method: "fixed", inputs: { a: "60", b: "50", c: "" } }).error).toContain("superan");
    expect(rejected({ totalMinor: 10000, method: "fixed", inputs: { a: "20", b: "30", c: "40" } }).error).toContain("falta repartir COP 10,00");
    expect(rejected({ totalMinor: 10000, method: "fixed", inputs: { a: "60", b: "40", c: "" } }).error).toContain("no queda resto");
  });
  it("importe total inválido", () => {
    expect(rejected({ totalMinor: 0, method: "equal" }).ok).toBe(false);
    expect(rejected({ totalMinor: 1.5, method: "equal" }).ok).toBe(false);
  });
});

// Generador pseudoaleatorio determinista para que una falla sea reproducible.
function generator(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}
const pick = (random, max) => Math.floor(random() * max);

describe("propiedades", () => {
  const ids = ["p0", "p1", "p2", "p3", "p4", "p5"];
  const positions = Object.fromEntries(ids.map((id, index) => [id, index]));

  function scenario(random, method, units) {
    const count = 1 + pick(random, ids.length);
    const chosen = ids.slice(0, count);
    const totalMinor = 1 + pick(random, 5_000_000);
    const inputs = {};
    if (method === "percent") {
      let left = 10000;
      chosen.forEach((id, index) => { const part = index === count - 1 ? left : pick(random, left + 1); left -= part; inputs[id] = `${Math.floor(part / 100)},${String(part % 100).padStart(2, "0")}`; });
    } else if (method === "shares") {
      chosen.forEach((id, index) => { inputs[id] = String(index === 0 ? 1 + pick(random, 5) : pick(random, 6)); });
    } else if (method === "exact") {
      let left = totalMinor;
      const scale = 10 ** units;
      chosen.forEach((id, index) => { const part = index === count - 1 ? left : Math.min(left - (count - 1 - index), 1 + pick(random, Math.max(1, left - (count - 1 - index)))); left -= part; inputs[id] = units ? `${Math.floor(part / scale)}.${String(part % scale).padStart(units, "0")}` : String(part); });
    } else if (method === "fixed") {
      const fixedCount = pick(random, count);
      let budget = Math.floor(totalMinor / 2);
      chosen.slice(0, fixedCount).forEach(id => { const part = 1 + pick(random, Math.max(1, Math.floor(budget / Math.max(1, fixedCount)))); budget -= part; const scale = 10 ** units; inputs[id] = units ? `${Math.floor(part / scale)}.${String(part % scale).padStart(units, "0")}` : String(part); });
    }
    return { totalMinor, units, currency: "XXX", method, beneficiaries: chosen, inputs, order: positions, names: {} };
  }

  for (const method of ["equal", "exact", "percent", "shares", "fixed"]) {
    it(`${method}: la suma es exactamente el total, ninguna asignación es cero o negativa y no depende del orden de entrada`, () => {
      const random = generator(method.length * 7919);
      let accepted = 0;
      for (let round = 0; round < 1500; round++) {
        const units = [0, 2, 3][round % 3];
        const request = scenario(random, method, units);
        const result = splitAmount(request);
        if (!result.ok) continue;
        accepted++;
        const sum = result.allocations.reduce((total, item) => total + item.amountMinor, 0);
        expect(sum, JSON.stringify(request)).toBe(request.totalMinor);
        expect(result.allocations.every(item => Number.isSafeInteger(item.amountMinor) && item.amountMinor > 0)).toBe(true);
        const shuffled = [...request.beneficiaries].reverse();
        const again = splitAmount({ ...request, beneficiaries: shuffled });
        expect(again.allocations, JSON.stringify(request)).toEqual(result.allocations);
        expect(splitAmount(request)).toEqual(result);
      }
      expect(accepted).toBeGreaterThan(500);
    });
  }

  it("el reparto igual coincide con splitEqually para el mismo orden y el residuo informado es la unidad sobrante", () => {
    const random = generator(42);
    for (let round = 0; round < 1500; round++) {
      const count = 1 + pick(random, ids.length);
      const chosen = ids.slice(0, count);
      const totalMinor = 1 + pick(random, 9_000_000);
      const result = splitAmount({ totalMinor, units: 2, currency: "COP", method: "equal", beneficiaries: chosen, order: positions });
      const reference = splitEqually(totalMinor, chosen).filter(item => item.amountMinor > 0);
      expect(result.allocations).toEqual(reference);
      expect(result.residue.minor).toBe(totalMinor % count);
      expect(result.residue.to).toEqual(chosen.slice(0, totalMinor % count));
    }
  });
});

describe("la función es autosuficiente", () => {
  it("se evalúa de forma aislada y produce lo mismo que la importada", async () => {
    const { SPLIT_MODULE_SOURCE } = await import("../src/split.js");
    const isolated = new Function(`${SPLIT_MODULE_SOURCE.replace("export function", "function")}; return splitAmount;`)();
    const random = generator(99);
    for (let round = 0; round < 300; round++) {
      const request = { totalMinor: 1 + pick(random, 1_000_000), units: 2, currency: "COP", method: "shares", beneficiaries: ["a", "b", "c"], inputs: { a: String(1 + pick(random, 4)), b: "1", c: String(pick(random, 3)) }, order, names };
      expect(isolated(request)).toEqual(splitAmount(request));
    }
  });
});
