import { describe, expect, it } from "vitest";
import { parseEntryForm } from "../src/ledger-ui.js";

function form(fields) {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
}
const common = [["type", "expense"], ["currency", "COP"], ["amount", "100,00"], ["description", "Cena"], ["occurredAt", "2026-10-24"], ["payer", "a"]];

describe("lectura del formulario de movimientos", () => {
  it("lee los datos de cada método de reparto sin calcular importes", () => {
    const cases = [
      ["equal", [], {}],
      ["exact", [["share_a", " 60,00 "], ["share_b", "40"]], { a: "60,00", b: "40" }],
      ["percent", [["percent_a", "60"], ["percent_b", "40"]], { a: "60", b: "40" }],
      ["shares", [["parts_a", "2"], ["parts_b", "1"]], { a: "2", b: "1" }],
      ["fixed", [["fixed_a", "10"], ["fixed_b", ""]], { a: "10", b: "" }],
    ];
    for (const [method, fields, inputs] of cases) {
      const parsed = parseEntryForm(form([...common, ["splitMethod", method], ["beneficiary", "a"], ["beneficiary", "b"], ...fields]));
      expect(parsed.split, method).toEqual({ method, beneficiaries: ["a", "b"], inputs });
      expect(parsed.allocations, method).toEqual([]);
      expect(parsed.totalMinor).toBe(10000);
    }
  });

  it("ignora los campos de otros métodos", () => {
    const parsed = parseEntryForm(form([...common, ["splitMethod", "percent"], ["beneficiary", "a"], ["percent_a", "100"], ["share_a", "999"], ["parts_a", "9"]]));
    expect(parsed.split.inputs).toEqual({ a: "100" });
  });

  it("rechaza un método desconocido y la falta de beneficiarias", () => {
    expect(() => parseEntryForm(form([...common, ["splitMethod", "ajuste"], ["beneficiary", "a"]]))).toThrow("Reparto inválido.");
    expect(() => parseEntryForm(form([...common, ["splitMethod", "equal"]]))).toThrow("al menos un participante");
    expect(() => parseEntryForm(form([...common, ["splitMethod", "__proto__"], ["beneficiary", "a"]]))).toThrow("Reparto inválido.");
  });

  it("una transferencia no tiene reparto", () => {
    const parsed = parseEntryForm(form([["type", "transfer"], ["currency", "COP"], ["amount", "50"], ["description", "Pago"], ["occurredAt", "2026-10-24"], ["from", "a"], ["to", "b"], ["splitMethod", "percent"], ["beneficiary", "a"]]));
    expect(parsed.split).toBeUndefined();
    expect(parsed.allocations).toEqual([]);
    expect(parsed.cashParties.map(party => party.direction)).toEqual(["out", "in"]);
  });
});
