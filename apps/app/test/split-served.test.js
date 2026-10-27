import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { SPLIT_MODULE_SOURCE, splitAmount } from "../src/split.js";

async function servedSource() {
  const response = await app.request("https://app.test/split.js");
  expect(response.status).toBe(200);
  return { response, source: await response.text() };
}
// Evalúa el texto servido en aislamiento, como lo haría el navegador: sin acceso a nada del módulo del servidor.
const load = (source) => new Function(`${source.replace("export function", "function")}; return splitAmount;`)();

function generator(seed) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}
const pick = (random, max) => Math.floor(random() * max);
const IDS = ["a", "b", "c", "d", "e"];

// Casos de los cinco métodos, con entradas válidas e inválidas, y con empates de residuo.
function cases(count) {
  const random = generator(2026);
  const methods = ["equal", "exact", "percent", "shares", "fixed", "ajuste"];
  return Array.from({ length: count }, (_, round) => {
    const method = methods[round % methods.length];
    const chosen = IDS.slice(0, 1 + pick(random, IDS.length));
    const inputs = {};
    for (const id of chosen) {
      const text = [`${pick(random, 100)}`, `${pick(random, 100)},${String(pick(random, 100)).padStart(2, "0")}`, "", "x", "-3"][pick(random, 5)];
      inputs[id] = random() < 0.6 ? (method === "percent" ? String(Math.floor(100 / chosen.length)) : method === "shares" ? "1" : text) : text;
    }
    return { totalMinor: 1 + pick(random, 3_000_000), units: [0, 2, 3][round % 3], currency: "COP", method, beneficiaries: [...chosen].reverse(), inputs, order: Object.fromEntries(IDS.map((id, index) => [id, index])), names: { a: "Ana", b: "Beto" } };
  });
}
const mismatches = (served, requests) => requests.filter(request => JSON.stringify(served(request)) !== JSON.stringify(splitAmount(request))).length;

describe("regla de reparto servida al navegador", () => {
  it("se sirve como JavaScript, autosuficiente y del mismo origen", async () => {
    const { response, source } = await servedSource();
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(source).toContain("export function splitAmount");
    expect(source).not.toMatch(/^import /mu);
    expect(typeof load(source)).toBe("function");
  });

  it("el texto servido devuelve lo mismo que la función importada en miles de casos de los cinco métodos", async () => {
    const { source } = await servedSource();
    const requests = cases(6000);
    expect(requests.filter(request => splitAmount(request).ok).length).toBeGreaterThan(1000);
    expect(mismatches(load(source), requests)).toBe(0);
  });

  it("la prueba de paridad detecta que se altere una sola línea de la función servida", async () => {
    const { source } = await servedSource();
    const requests = cases(6000);
    for (const [from, to] of [["a.index - b.index", "b.index - a.index"], ["sum !== 10000n", "sum !== 9999n"], ["leftover: Number(leftover)", "leftover: Number(leftover) + 1"]]) {
      expect(source, from).toContain(from);
      expect(mismatches(load(source.replace(from, to)), requests), from).toBeGreaterThan(0);
    }
  });
});

describe("los módulos servidos al navegador conservan sus nombres", () => {
  it("el texto servido exporta las funciones por su nombre y no depende de variables externas", async () => {
    const { TEXT_MODULE_SOURCE } = await import("../src/text.js");
    expect(SPLIT_MODULE_SOURCE).toMatch(/export function splitAmount\(/u);
    expect(TEXT_MODULE_SOURCE).toMatch(/export function searchable\(/u);
    // Si un empaquetador renombrara la función, el `import { splitAmount }` del navegador dejaría de resolverse.
    for (const source of [SPLIT_MODULE_SOURCE, TEXT_MODULE_SOURCE]) expect(source.match(/export /gu)).toHaveLength(1);
  });
});
