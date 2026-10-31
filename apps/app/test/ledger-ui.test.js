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

describe("búsqueda con varios términos", () => {
  const participants = [{ id: "p1", displayName: "Laura" }, { id: "p2", displayName: "Pablo" }];
  const gas = { id: "1", description: "Gás natural", category: "Servicios", note: "Cuenta de octubre", totalMinor: 6000000, currency: "COP", effects: [{ participantId: "p1", amountMinor: 4500000 }, { participantId: "p2", amountMinor: -1500000 }] };
  const mercado = { id: "2", description: "Mercado", category: "", note: "", totalMinor: 100, currency: "COP", effects: [{ participantId: "p2", amountMinor: 100 }] };

  it("exige que cada término coincida en algún campo, ignorando acentos y mayúsculas", () => {
    const found = searchLedger([gas, mercado], participants, "GAS laura");
    expect(found.map(row => row.id)).toEqual(["1"]);
    expect(found[0].matchReason).toBe("Descripción + Participa Laura");
    expect(searchLedger([gas, mercado], participants, "gas pablo mercado")).toEqual([]);
  });

  it("busca también en la nota", () => {
    expect(searchLedger([gas], participants, "octubre")[0].matchReason).toBe("Nota");
    expect(searchLedger([gas], participants, "cuenta de gas")[0].matchReason).toBe("Nota + Descripción");
    expect(searchLedger([gas], participants, "cuenta zzz")).toEqual([]);
  });

  it("una frase que coincide completa conserva su motivo único", () => {
    expect(searchLedger([gas], participants, "gas natural")[0].matchReason).toBe("Descripción");
  });
});
