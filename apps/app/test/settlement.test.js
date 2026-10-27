import { describe, expect, it } from "vitest";
import { explainBalance, suggestTransfers } from "../src/settlement.js";

const rows = (...amounts) => amounts.map((amountMinor, index) => ({ participantId: `p${index}`, amountMinor }));
function settle(balances, transfers) {
  const next = new Map(balances.map(row => [row.participantId, row.amountMinor]));
  for (const transfer of transfers) {
    next.set(transfer.from, next.get(transfer.from) + transfer.amountMinor);
    next.set(transfer.to, next.get(transfer.to) - transfer.amountMinor);
  }
  return [...next.values()];
}

describe("sugerencias para quedar a mano", () => {
  it("empareja el mayor acreedor con el mayor deudor", () => {
    const balances = [{ participantId: "pablo", amountMinor: 1748350 }, { participantId: "mateo", amountMinor: -122050 }, { participantId: "laura", amountMinor: -389050 }, { participantId: "ana", amountMinor: -1237250 }];
    expect(suggestTransfers(balances)).toEqual([
      { from: "ana", to: "pablo", amountMinor: 1237250 },
      { from: "laura", to: "pablo", amountMinor: 389050 },
      { from: "mateo", to: "pablo", amountMinor: 122050 },
    ]);
  });

  it("es determinista: mismos saldos, mismas sugerencias, aunque cambie el orden de entrada", () => {
    const balances = rows(500, -200, -300, 400, -400, 0);
    const first = suggestTransfers(balances);
    expect(suggestTransfers(balances)).toEqual(first);
    expect(suggestTransfers([...balances].reverse())).toEqual(first);
  });

  it("deja todos los saldos en cero con a lo sumo n−1 transferencias, sin importar los saldos", () => {
    let seed = 7;
    const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let round = 0; round < 200; round++) {
      const size = 2 + Math.floor(random() * 7);
      const amounts = Array.from({ length: size - 1 }, () => Math.round((random() - 0.5) * 100000));
      amounts.push(-amounts.reduce((sum, value) => sum + value, 0));
      const balances = rows(...amounts);
      const transfers = suggestTransfers(balances);
      expect(settle(balances, transfers).every(value => value === 0)).toBe(true);
      expect(transfers.length).toBeLessThanOrEqual(size - 1);
      expect(transfers.every(transfer => transfer.amountMinor > 0 && transfer.from !== transfer.to)).toBe(true);
    }
  });

  it("no sugiere nada cuando todos están a mano", () => {
    expect(suggestTransfers(rows(0, 0, 0))).toEqual([]);
  });
});

describe("explicación de un saldo", () => {
  const entry = (id, occurredAt, effectMinor, overrides = {}) => ({ id, occurredAt, currency: "COP", status: "active", effects: [{ participantId: "p1", amountMinor: effectMinor }, { participantId: "p2", amountMinor: -effectMinor }], ...overrides });

  it("acumula en orden cronológico y la suma coincide con el saldo", () => {
    const result = explainBalance([entry("c", "2026-10-22", 214800), entry("a", "2026-10-18", 150000), entry("b", "2026-10-20", 900000)], "p1", "COP");
    expect(result.rows.map(row => row.entry.id)).toEqual(["a", "b", "c"]);
    expect(result.rows.map(row => row.accumulatedMinor)).toEqual([150000, 1050000, 1264800]);
    expect(result.totalMinor).toBe(1264800);
  });

  it("ignora anulados, otras monedas y movimientos sin efecto", () => {
    const result = explainBalance([
      entry("ok", "2026-10-01", 100),
      entry("anulado", "2026-10-02", 999, { status: "voided" }),
      entry("usd", "2026-10-03", 888, { currency: "USD" }),
      entry("ajeno", "2026-10-04", 5, { effects: [{ participantId: "p2", amountMinor: 5 }] }),
    ], "p1", "COP");
    expect(result.rows.map(row => row.entry.id)).toEqual(["ok"]);
    expect(result.totalMinor).toBe(100);
  });
});
