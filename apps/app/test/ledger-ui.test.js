import { describe, expect, it } from "vitest";
import { searchLedger } from "../src/ledger-ui.js";

function entry(totalMinor, currency = "COP") {
  return { description: "Movimiento", category: "", totalMinor, currency, effects: [] };
}

describe("búsqueda monetaria", () => {
  it("ignora separadores de miles y encuentra fragmentos del importe entero", () => {
    const thousand = entry(100000);
    for (const query of ["1000", "1.000", "10", "100"]) {
      expect(searchLedger([thousand], [], query)[0].matchReason).toBe("Importe total");
    }
    const oneFortyFive = entry(14500);
    for (const query of ["14", "45", "145"]) {
      expect(searchLedger([oneFortyFive], [], query)[0].matchReason).toBe("Importe total");
    }
  });

  it("mantiene la búsqueda decimal explícita", () => {
    expect(searchLedger([entry(1250)], [], "12,50")[0].matchReason).toBe("Importe total");
    expect(searchLedger([entry(1250)], [], "1250")).toEqual([]);
  });
});
