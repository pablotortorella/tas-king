import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseMovement, parseSignedMinor, parseSplitwiseCsv, SplitwiseCsvError } from "../src/splitwise-csv.js";

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
});
