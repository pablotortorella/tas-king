import { describe, expect, it } from "vitest";
import { CURRENCY_MINOR_UNITS, FinancialValidationError, formatMoney, normalizeCurrency, parseMoney, splitEqually, validateEntryDraft } from "../src/finance.js";

describe("núcleo monetario", () => {
  it("reconoce exponentes monetarios 0, 2 y 3 sin convertir importes", () => {
    expect(CURRENCY_MINOR_UNITS.JPY).toBe(0);
    expect(CURRENCY_MINOR_UNITS.COP).toBe(2);
    expect(CURRENCY_MINOR_UNITS.KWD).toBe(3);
    expect(normalizeCurrency(" kwd ")).toBe("KWD");
    expect(normalizeCurrency("ZZZ")).toBeNull();
  });

  it("reparte el residuo de forma estable y conserva el total", () => {
    expect(splitEqually(100, ["ana", "beto", "cata"])).toEqual([
      { participantId: "ana", amountMinor: 34 },
      { participantId: "beto", amountMinor: 33 },
      { participantId: "cata", amountMinor: 33 },
    ]);
  });

  it("interpreta importes decimales sin flotantes y respeta la moneda", () => {
    expect(parseMoney("1.234", "KWD")).toBe(1234);
    expect(parseMoney("12,50", "COP")).toBe(1250);
    expect(parseMoney("300", "JPY")).toBe(300);
    expect(formatMoney(1250, "COP")).toBe("COP 12,50");
    expect(() => parseMoney("1,20", "JPY")).toThrow(FinancialValidationError);
    expect(() => parseMoney("9007199254740992", "COP")).toThrow(FinancialValidationError);
  });

  it("valida un gasto equilibrado y deriva efectos de suma cero", () => {
    const result = validateEntryDraft({
      type: "expense",
      currency: "COP",
      totalMinor: 9000,
      cashParties: [{ participantId: "ana", direction: "out", amountMinor: 9000 }],
      allocations: [
        { participantId: "ana", amountMinor: 4500 },
        { participantId: "beto", amountMinor: 4500 },
      ],
    }, ["ana", "beto"]);
    expect(result.effects).toEqual([
      { participantId: "ana", amountMinor: 4500 },
      { participantId: "beto", amountMinor: -4500 },
    ]);
  });

  it("valida ingresos y transferencias sin crear una entidad de deuda", () => {
    const income = validateEntryDraft({
      type: "income", currency: "USD", totalMinor: 100,
      cashParties: [{ participantId: "ana", direction: "in", amountMinor: 100 }],
      allocations: [{ participantId: "ana", amountMinor: 40 }, { participantId: "beto", amountMinor: 60 }],
    }, ["ana", "beto"]);
    expect(income.effects.reduce((total, effect) => total + effect.amountMinor, 0)).toBe(0);

    const transfer = validateEntryDraft({
      type: "transfer", currency: "JPY", totalMinor: 500,
      cashParties: [
        { participantId: "ana", direction: "out", amountMinor: 500 },
        { participantId: "beto", direction: "in", amountMinor: 500 },
      ],
    }, ["ana", "beto"]);
    expect(transfer.effects).toEqual([
      { participantId: "ana", amountMinor: 500 },
      { participantId: "beto", amountMinor: -500 },
    ]);
  });

  it("rechaza desequilibrio, participantes ajenos y transferencias a sí mismo", () => {
    expect(() => validateEntryDraft({
      type: "expense", currency: "COP", totalMinor: 100,
      cashParties: [{ participantId: "ana", direction: "out", amountMinor: 100 }],
      allocations: [{ participantId: "beto", amountMinor: 90 }],
    }, ["ana", "beto"])).toThrow(FinancialValidationError);
    expect(() => validateEntryDraft({
      type: "income", currency: "COP", totalMinor: 100,
      cashParties: [{ participantId: "ajena", direction: "in", amountMinor: 100 }],
      allocations: [{ participantId: "ana", amountMinor: 100 }],
    }, ["ana"])).toThrow("no pertenece");
    expect(() => validateEntryDraft({
      type: "transfer", currency: "COP", totalMinor: 100,
      cashParties: [
        { participantId: "ana", direction: "out", amountMinor: 100 },
        { participantId: "ana", direction: "in", amountMinor: 100 },
      ],
    }, ["ana"])).toThrow("origen y destino");
    expect(() => validateEntryDraft({
      type: "expense", currency: "COP", totalMinor: 100,
      cashParties: [{ participantId: "ana", direction: "out", amountMinor: 100 }],
      allocations: [{ participantId: "ana", amountMinor: 50, direction: "out" }, { participantId: "ana", amountMinor: 50, direction: "in" }],
    }, ["ana"])).toThrow("repetirse");
  });
});
