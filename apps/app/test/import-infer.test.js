import { describe, expect, it } from "vitest";
import { validateEntryDraft } from "../src/finance.js";
import { inferComponents, mergeEffects } from "../src/import-infer.js";
import { seededRandom } from "./fixtures/synthetic-splitwise.js";

const infer = (totalMinor, amounts, fallback = "p0") => inferComponents({ totalMinor, effects: amounts.map((amountMinor, index) => ({ participantId: `p${index}`, amountMinor })), fallbackParticipantId: fallback });
const effectsOf = (result, totalMinor, count) => {
  const ids = Array.from({ length: count }, (_, index) => `p${index}`);
  const validated = validateEntryDraft({ type: "expense", currency: "COP", totalMinor, cashParties: result.cashParties, allocations: result.allocations }, ids);
  return Object.fromEntries(validated.effects.filter(effect => effect.amountMinor !== 0).map(effect => [effect.participantId, effect.amountMinor]));
};
const expected = amounts => Object.fromEntries(amounts.map((amount, index) => [`p${index}`, amount]).filter(([, amount]) => amount !== 0));

describe("inferencia de pagadores y reparto", () => {
  it("reparto parejo entre dos personas: paga quien está a favor, 50 y 50", () => {
    const result = infer(10000, [5000, -5000]);
    expect(result).toEqual({ ok: true, cashParties: [{ participantId: "p0", direction: "out", amountMinor: 10000 }], allocations: [{ participantId: "p0", amountMinor: 5000 }, { participantId: "p1", amountMinor: 5000 }] });
    expect(effectsOf(result, 10000, 2)).toEqual({ p0: 5000, p1: -5000 });
  });

  it("todo a cargo de una persona: paga quien está a favor y la otra lo debe todo", () => {
    const result = infer(10000, [10000, -10000]);
    expect(result.cashParties).toEqual([{ participantId: "p0", direction: "out", amountMinor: 10000 }]);
    expect(result.allocations).toEqual([{ participantId: "p1", amountMinor: 10000 }]);
  });

  it("varias personas a favor: dos pagadores cuyos aportes suman el total y reproducen los efectos", () => {
    const result = infer(9000, [2000, 3000, -5000]);
    expect(result.cashParties.reduce((sum, party) => sum + party.amountMinor, 0)).toBe(9000);
    expect(result.cashParties).toHaveLength(2);
    expect(effectsOf(result, 9000, 3)).toEqual({ p0: 2000, p1: 3000, p2: -5000 });
  });

  it("fila sin efecto: una misma persona paga y consume el total", () => {
    const result = infer(4500, [0, 0]);
    expect(result).toEqual({ ok: true, cashParties: [{ participantId: "p0", direction: "out", amountMinor: 4500 }], allocations: [{ participantId: "p0", amountMinor: 4500 }] });
    expect(effectsOf(result, 4500, 2)).toEqual({});
  });

  it("una fila sin efecto sin persona de reserva se rechaza", () => {
    expect(infer(4500, [0, 0], null)).toMatchObject({ ok: false });
  });

  it("efecto a favor mayor que el total: no se puede representar", () => {
    expect(infer(5000, [6000, -6000])).toEqual({ ok: false, reason: "El efecto a favor supera el total del movimiento." });
  });

  it("un total cero con efectos se rechaza porque el efecto supera el total", () => {
    expect(infer(0, [1000, -1000])).toMatchObject({ ok: false });
  });

  it("efectos que no suman cero se rechazan", () => {
    expect(infer(5000, [2000, -1000])).toMatchObject({ ok: false, reason: expect.stringContaining("no suman cero") });
  });

  it("el residuo de las partes propias va al último pagador", () => {
    const result = infer(10001, [1, 1, -2]);
    expect(result.allocations.filter(share => share.participantId !== "p2")).toEqual([{ participantId: "p0", amountMinor: 4999 }, { participantId: "p1", amountMinor: 5000 }]);
    expect(effectsOf(result, 10001, 3)).toEqual({ p0: 1, p1: 1, p2: -2 });
  });

  it("las personas con efecto cero no aparecen en pagadores ni en el reparto", () => {
    const result = infer(1000, [500, -500, 0]);
    expect([...result.cashParties, ...result.allocations].some(item => item.participantId === "p2")).toBe(false);
  });

  it("junta las columnas asociadas a la misma persona antes de inferir", () => {
    const effects = mergeEffects([300, -100, -200], ["a", "b", "a"]);
    expect(effects).toEqual([{ participantId: "a", amountMinor: 100 }, { participantId: "b", amountMinor: -100 }]);
    expect(inferComponents({ totalMinor: 500, effects })).toMatchObject({ ok: true });
  });
});

describe("propiedad: los efectos que resultan son idénticos a los del archivo", () => {
  it.each([[1], [2], [3]])("miles de vectores válidos (semilla %i)", seed => {
    const random = seededRandom(seed);
    let representable = 0;
    for (let round = 0; round < 4000; round += 1) {
      const count = 2 + Math.floor(random() * 5);
      const amounts = Array.from({ length: count }, () => Math.round((random() - 0.45) * 100000));
      amounts[count - 1] -= amounts.reduce((sum, amount) => sum + amount, 0);
      const positive = amounts.filter(amount => amount > 0).reduce((sum, amount) => sum + amount, 0);
      const totalMinor = Math.max(1, positive + (random() < 0.5 ? 0 : Math.floor(random() * 50000)));
      const result = infer(totalMinor, amounts);
      if (!result.ok) {
        expect(positive).toBeGreaterThan(totalMinor);
        continue;
      }
      representable += 1;
      expect(effectsOf(result, totalMinor, count)).toEqual(expected(amounts));
      expect(result.cashParties.every(party => party.amountMinor > 0)).toBe(true);
      expect(result.allocations.every(share => share.amountMinor > 0)).toBe(true);
    }
    expect(representable).toBeGreaterThan(3500);
  });

  it("con centavos impares y repartos desparejos nunca produce importes negativos ni cero", () => {
    const random = seededRandom(99);
    for (let round = 0; round < 3000; round += 1) {
      const a = 1 + Math.floor(random() * 99999);
      const total = a + Math.floor(random() * 99999);
      const result = infer(total, [a, -a]);
      expect(result.ok).toBe(true);
      for (const item of [...result.cashParties, ...result.allocations]) expect(item.amountMinor).toBeGreaterThan(0);
      expect(effectsOf(result, total, 2)).toEqual({ p0: a, p1: -a });
    }
  });
});
