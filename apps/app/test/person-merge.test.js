import { describe, expect, it } from "vitest";
import { aliasResolver, isTransferBetween, mergedSnapshot, movePerson, relabelComponents, touchesPerson } from "../src/person-merge.js";

const cash = (participantId, amountMinor, direction = "out") => ({ participantId, direction, amountMinor });
const share = (participantId, amountMinor) => ({ participantId, amountMinor });

describe("movePerson", () => {
  it("pasa la parte de la persona unida a la destinataria", () => {
    expect(movePerson({ cashParties: [cash("a", 100)], allocations: [share("a", 40), share("c", 60)] }, "a", "b")).toEqual({
      cashParties: [cash("b", 100)], allocations: [share("b", 40), share("c", 60)],
    });
  });

  it("suma cuando las dos participaban, por dirección en las partes de efectivo", () => {
    expect(movePerson({ cashParties: [cash("a", 60), cash("b", 40)], allocations: [share("a", 50), share("b", 50)] }, "a", "b")).toEqual({
      cashParties: [cash("b", 100)], allocations: [share("b", 100)],
    });
    expect(movePerson({ cashParties: [cash("a", 70, "in"), cash("b", 70, "out")], allocations: [] }, "a", "b").cashParties).toEqual([cash("b", 70, "in"), cash("b", 70, "out")]);
  });

  it("conserva el total y no muta lo recibido", () => {
    const input = { cashParties: [cash("a", 33), cash("b", 67)], allocations: [share("a", 10), share("b", 20), share("c", 70)] };
    const frozen = JSON.parse(JSON.stringify(input));
    const result = movePerson(input, "a", "b");
    expect(input).toEqual(frozen);
    expect(result.cashParties.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(100);
    expect(result.allocations.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(100);
  });

  it("sin la persona unida no cambia nada", () => {
    const input = { cashParties: [cash("b", 10)], allocations: [share("c", 10)] };
    expect(movePerson(input, "a", "b")).toEqual(input);
  });
});

describe("touchesPerson e isTransferBetween", () => {
  const expense = { type: "expense", cashParties: [cash("a", 10)], allocations: [share("b", 10)] };
  it("detecta si la persona aparece como quien pagó o en el reparto", () => {
    expect(touchesPerson(expense, "a")).toBe(true);
    expect(touchesPerson(expense, "b")).toBe(true);
    expect(touchesPerson(expense, "c")).toBe(false);
  });

  it("solo una transferencia con las dos puntas en las personas que se unen se anula", () => {
    const transfer = { type: "transfer", cashParties: [cash("a", 5), cash("b", 5, "in")], allocations: [] };
    expect(isTransferBetween(transfer, "a", "b")).toBe(true);
    expect(isTransferBetween(transfer, "b", "a")).toBe(true);
    expect(isTransferBetween(transfer, "a", "c")).toBe(false);
    expect(isTransferBetween({ ...transfer, cashParties: [cash("a", 5), cash("c", 5, "in")] }, "a", "b")).toBe(false);
    expect(isTransferBetween(expense, "a", "b")).toBe(false);
  });
});

describe("mergedSnapshot", () => {
  it("descarta el método de reparto, marca la unión y conserva el resto", () => {
    const previous = { description: "Cena", note: "n", categoryId: "cat", split: { method: "equal", beneficiaries: ["a", "b"], inputs: {} }, status: "active", cashParties: [], allocations: [] };
    const result = mergedSnapshot(previous, { cashParties: [cash("b", 10)], allocations: [share("b", 10)] }, "merge_1");
    expect(result).toEqual({ description: "Cena", note: "n", categoryId: "cat", status: "active", cashParties: [cash("b", 10)], allocations: [share("b", 10)], personMerge: "merge_1" });
    expect("split" in result).toBe(false);
    expect(previous.split).toBeDefined();
  });
});

describe("aliasResolver", () => {
  it("sigue las uniones encadenadas hasta la persona vigente", () => {
    const resolve = aliasResolver([{ id: "a", mergedIntoId: "b" }, { id: "b", mergedIntoId: "c" }]);
    expect(resolve("a")).toBe("c");
    expect(resolve("b")).toBe("c");
    expect(resolve("c")).toBe("c");
    expect(resolve("x")).toBe("x");
  });

  it("un ciclo imposible no cuelga la lectura", () => {
    const resolve = aliasResolver([{ id: "a", mergedIntoId: "b" }, { id: "b", mergedIntoId: "a" }]);
    expect(["a", "b"]).toContain(resolve("a"));
  });
});

describe("relabelComponents", () => {
  it("aplica cualquier función de resolución", () => {
    expect(relabelComponents({ cashParties: [cash("a", 1)], allocations: [share("a", 1)] }, id => id.toUpperCase())).toEqual({ cashParties: [cash("A", 1)], allocations: [share("A", 1)] });
  });
});
