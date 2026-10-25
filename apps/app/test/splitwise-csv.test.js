import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseMovement, parseSignedMinor, parseSplitwiseCsv, SplitwiseCsvError } from "../src/splitwise-csv.js";
import { buildImportPlan } from "../src/splitwise-import.js";

describe("CSV de Splitwise", () => {
  it("lee el fixture sintético y conserva los efectos exactos", async () => {
    const csv = await readFile(new URL("../../../test/fixtures/splitwise-export-example.csv", import.meta.url), "utf8");
    const parsed = parseSplitwiseCsv(csv);
    expect(parsed.participantNames).toEqual(["Don Quijote", "Sancho Panza"]);
    expect(parsed.movements).toHaveLength(6);
    expect(parsed.movements[0]).toMatchObject({ line: 2, totalMinor: 8000000, currency: "COP", effects: [{ sourceName: "Don Quijote", amountMinor: 4000000 }, { sourceName: "Sancho Panza", amountMinor: -4000000 }] });
    expect(parsed.incidents).toEqual([]);
  });

  it("distingue resumen, filas problemáticas y moneda asumible", () => {
    const csv = 'Date,Description,Category,Cost,Currency,Ana,Beto\n2026-01-01,"Comida, juntos",Food,12.50,USD,6.25,-6.25\n2026-01-02,Taxi,Travel,10.00,,5.00,-5.00\n2026-01-03,Error,Food,8.00,USD,3.00,-2.00\nTotal balance,,,,USD,6.25,-6.25\n';
    const parsed = parseSplitwiseCsv(csv);
    expect(parsed.movements).toHaveLength(1);
    expect(parsed.movements[0].description).toBe("Comida, juntos");
    expect(parsed.incidents.map(row => [row.line, row.code])).toEqual([[3, "missing_currency"], [4, "invalid_row"]]);
    expect(parsed.summaries).toHaveLength(1);
    expect(parseMovement(parsed.incidents[0].cells, parsed.participantNames, 3, "USD").effects[0].amountMinor).toBe(500);
  });

  it("rechaza montos ambiguos, fechas imposibles y encabezados ajenos", () => {
    expect(parseSignedMinor("-1.234", "KWD")).toBe(-1234);
    expect(() => parseSignedMinor("1.2.3", "USD")).toThrow(SplitwiseCsvError);
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-02-30,Error,Comida,10.00,COP,5.00,-5.00\n";
    expect(parseSplitwiseCsv(csv).incidents[0].reason).toBe("Fecha inválida.");
    expect(() => parseSplitwiseCsv("uno,dos,tres\n1,2,3")).toThrow("encabezado");
  });

  describe("fila de resumen con la fecha de exportación en la primera celda", () => {
    const body = "2026-01-01,Comida,Comida,10.00,COP,5.00,-5.00\n2026-01-02,Taxi,Viaje,20.00,COP,-10.00,10.00\n";

    it("la reconoce como resumen, no como movimiento, tras líneas vacías y con celdas en blanco", () => {
      const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n\n${body}\n2026-10-24,Saldo total, , ,COP,-5.00,5.00\n`;
      const parsed = parseSplitwiseCsv(csv);
      expect(parsed.movements.map(row => row.description)).toEqual(["Comida", "Taxi"]);
      expect(parsed.incidents).toEqual([]);
      expect(parsed.summaries).toHaveLength(1);
      expect(parsed.summaries[0]).toMatchObject({ currency: "COP", rawEffects: [{ sourceName: "Ana", raw: "-5.00" }, { sourceName: "Beto", raw: "5.00" }] });
    });

    it("reconoce las variantes en inglés y sin moneda", () => {
      for (const label of ["Total balance", "Balance total", "Saldo"]) {
        const csv = `Date,Description,Category,Cost,Currency,Ana,Beto\n${body}2026-10-24,${label},,,COP,-5.00,5.00\n`;
        const parsed = parseSplitwiseCsv(csv);
        expect(parsed.summaries, label).toHaveLength(1);
        expect(parsed.movements, label).toHaveLength(2);
      }
    });

    it("no confunde con un resumen a un movimiento que se llama «Saldo» pero tiene coste", () => {
      const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Saldo total,General,10.00,COP,5.00,-5.00\n2026-01-02,Saldo,General,20.00,COP,10.00,-10.00\n`;
      const parsed = parseSplitwiseCsv(csv);
      expect(parsed.movements).toHaveLength(2);
      expect(parsed.summaries).toEqual([]);
    });

    it("concilia sin diferencias cuando el resumen coincide con los efectos y no advierte la falta de resumen", () => {
      const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n${body}2026-10-24,Saldo total, , ,COP,-5.00,5.00\n`;
      const parsed = parseSplitwiseCsv(csv);
      const plan = buildImportPlan(parsed, { mapping: ["new", "new"], decisions: [] }, "COP");
      expect(plan.rows).toHaveLength(2);
      expect(plan.warnings).toEqual([]);
      expect(plan.reconciliation.map(row => row.differenceMinor)).toEqual([0, 0]);
    });
  });
});
