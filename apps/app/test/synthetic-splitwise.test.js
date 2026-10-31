import { describe, expect, it } from "vitest";
import { validateEntryDraft } from "../src/finance.js";
import { inferComponents, mergeEffects } from "../src/import-infer.js";
import { parseSplitwiseCsv } from "../src/splitwise-csv.js";
import { syntheticSplitwiseCsv } from "./fixtures/synthetic-splitwise.js";

describe("CSV sintético con la forma de un export real", () => {
  const { csv, balances, people } = syntheticSplitwiseCsv({ rows: 2485 });
  const parsed = parseSplitwiseCsv(csv);

  it("tiene la forma esperada: 2.485 filas, un resumen con fecha en la primera celda y ningún incidente", () => {
    expect(parsed.movements).toHaveLength(2485);
    expect(parsed.summaries).toHaveLength(1);
    expect(parsed.incidents).toEqual([]);
    expect(parsed.participantNames).toEqual(people);
    expect(new TextEncoder().encode(csv).byteLength).toBeLessThan(2 * 1024 * 1024);
  });

  it("todas las filas se convierten en gastos válidos con los mismos efectos del archivo", () => {
    const ids = ["p0", "p1"];
    const totals = [0, 0];
    for (const row of parsed.movements) {
      const effects = mergeEffects(row.effects.map(effect => effect.amountMinor), ids);
      const result = inferComponents({ totalMinor: row.totalMinor, effects, fallbackParticipantId: "p0" });
      expect(result.ok, `fila ${row.line}`).toBe(true);
      const validated = validateEntryDraft({ type: "expense", currency: row.currency, totalMinor: row.totalMinor, cashParties: result.cashParties, allocations: result.allocations }, ids);
      for (const [index, id] of ids.entries()) {
        const effect = validated.effects.find(item => item.participantId === id)?.amountMinor ?? 0;
        expect(effect, `fila ${row.line}, ${id}`).toBe(row.effects[index].amountMinor);
        totals[index] += effect;
      }
    }
    expect(totals).toEqual(balances);
  });

  it("el saldo por persona coincide con la fila de resumen", () => {
    const summary = parsed.summaries[0].rawEffects.map(effect => Math.round(Number(effect.raw) * 100));
    expect(summary).toEqual(balances);
  });

  it("incluye los patrones de la muestra real: mitad y mitad, todo a una persona y una fila sin efecto", () => {
    const evenSplit = parsed.movements.filter(row => row.effects.every(effect => Math.abs(effect.amountMinor) === Math.ceil(row.totalMinor / 2) || Math.abs(effect.amountMinor) === Math.floor(row.totalMinor / 2)));
    const all = parsed.movements.filter(row => row.effects.some(effect => Math.abs(effect.amountMinor) === row.totalMinor));
    const none = parsed.movements.filter(row => row.effects.every(effect => effect.amountMinor === 0));
    expect(evenSplit.length / parsed.movements.length).toBeGreaterThan(0.9);
    expect(all.length).toBeGreaterThan(0);
    expect(none).toHaveLength(1);
  });

  it("es determinista y distinto con otra semilla", () => {
    expect(syntheticSplitwiseCsv({ rows: 50, seed: 3 }).csv).toBe(syntheticSplitwiseCsv({ rows: 50, seed: 3 }).csv);
    expect(syntheticSplitwiseCsv({ rows: 50, seed: 3 }).csv).not.toBe(syntheticSplitwiseCsv({ rows: 50, seed: 4 }).csv);
  });
});
