import { describe, expect, it } from "vitest";
import { MAX_STATEMENT_BYTES, chunkByBytes } from "../src/chunking.js";

describe("tandas con tamaño acotado", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: index, text: "x".repeat(100) }));
  it("respeta la cantidad máxima de elementos y conserva el orden", () => {
    const chunks = chunkByBytes(items, { maxItems: 4 });
    expect(chunks.map(chunk => chunk.length)).toEqual([4, 4, 2]);
    expect(chunks.flat().map(item => item.id)).toEqual(items.map(item => item.id));
  });
  it("parte antes si el tamaño estimado lo exige", () => {
    const chunks = chunkByBytes(items, { maxItems: 100, maxBytes: 350, weigh: () => 100 });
    expect(chunks.map(chunk => chunk.length)).toEqual([3, 3, 3, 1]);
  });
  it("un elemento más grande que el tope viaja solo, sin perderse", () => {
    const chunks = chunkByBytes([{ big: "y".repeat(500) }, { id: 1 }], { maxItems: 10, maxBytes: 100 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1);
  });
  it("una lista vacía no produce tandas", () => expect(chunkByBytes([], { maxItems: 5 })).toEqual([]));
  it("ninguna tanda con elementos normales supera el tope por defecto", () => {
    const notes = Array.from({ length: 300 }, (_, index) => ({ id: index, note: "n".repeat(1000) }));
    for (const chunk of chunkByBytes(notes, { maxItems: 100 })) expect(JSON.stringify(chunk).length).toBeLessThanOrEqual(MAX_STATEMENT_BYTES + 1100);
  });
});
