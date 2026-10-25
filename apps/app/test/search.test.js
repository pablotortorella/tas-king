import { describe, expect, it } from "vitest";
import { filterByPerson, personCounts, personRoles, personsInQuery, searchLedger } from "../src/search.js";
import { seededRandom } from "./fixtures/synthetic-splitwise.js";
import { referenceSearch } from "./fixtures/search-reference.js";

const people = [
  { id: "p1", displayName: "Ana María", linkedUserId: "u1", active: 1 },
  { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 },
  { id: "p3", displayName: "Carla Gómez", linkedUserId: null, active: 1 },
];

function expense(id, description, { payer = "p1", split = ["p1", "p2"], total = 10000, currency = "COP", note = "", category = null, status = "active", inferred = false } = {}) {
  const share = Math.floor(total / split.length);
  const allocations = split.map((participantId, index) => ({ participantId, amountMinor: index === split.length - 1 ? total - share * (split.length - 1) : share }));
  const effects = new Map();
  effects.set(payer, (effects.get(payer) ?? 0) + total);
  for (const item of allocations) effects.set(item.participantId, (effects.get(item.participantId) ?? 0) - item.amountMinor);
  return { id, type: "expense", currency, totalMinor: total, description, note, status, inferred, categoryInfo: category ? { id: category, name: category, group: "G", groupKey: "g", icon: "tag" } : null, cashParties: [{ participantId: payer, direction: "out", amountMinor: total }], allocations, effects: [...effects].map(([participantId, amountMinor]) => ({ participantId, amountMinor })) };
}
function transfer(id, from, to, total = 5000) {
  return { id, type: "transfer", currency: "COP", totalMinor: total, description: "Pase", note: "", status: "active", inferred: false, categoryInfo: null, cashParties: [{ participantId: from, direction: "out", amountMinor: total }, { participantId: to, direction: "in", amountMinor: total }], allocations: [], effects: [{ participantId: from, amountMinor: total }, { participantId: to, amountMinor: -total }] };
}
function income(id, description, receiver = "p1", total = 20000) {
  return { id, type: "income", currency: "COP", totalMinor: total, description, note: "", status: "active", inferred: false, categoryInfo: null, cashParties: [{ participantId: receiver, direction: "in", amountMinor: total }], allocations: [{ participantId: "p1", amountMinor: total / 2 }, { participantId: "p2", amountMinor: total / 2 }], effects: [{ participantId: receiver, amountMinor: -total + total / 2 }, { participantId: receiver === "p1" ? "p2" : "p1", amountMinor: total / 2 }].filter((effect, index, all) => all.findIndex(other => other.participantId === effect.participantId) === index) };
}
const ids = list => list.map(row => row.id);

describe("criterios por persona", () => {
  const entries = [
    expense("e1", "Mercado", { payer: "p1", split: ["p1", "p2"] }),
    expense("e2", "Cena", { payer: "p2", split: ["p1", "p2", "p3"] }),
    expense("e3", "Taxi", { payer: "p3", split: ["p3"] }),
    transfer("t1", "p1", "p2"),
    income("i1", "Reintegro", "p2"),
  ];

  it("«Pagó X» cuando la persona pagó y «Participa X» cuando está en el reparto", () => {
    const found = searchLedger(entries, people, "beto");
    const reason = id => found.find(row => row.id === id).matchReason;
    expect(reason("e1")).toBe("Participa Beto");
    expect(reason("e2")).toBe("Pagó Beto + Participa Beto");
  });

  it("en una transferencia: «Entregó X» y «Recibió X»", () => {
    expect(searchLedger(entries, people, "ana").find(row => row.id === "t1").matchReason).toBe("Entregó Ana María");
    expect(searchLedger(entries, people, "beto").find(row => row.id === "t1").matchReason).toBe("Recibió Beto");
  });

  it("en un ingreso, quien recibe el dinero figura como «Recibió»", () => {
    expect(searchLedger(entries, people, "beto").find(row => row.id === "i1").matchReason).toBe("Recibió Beto + Participa Beto");
  });

  it("un pagador inferido lo indica", () => {
    const inferred = [expense("x1", "Importado", { payer: "p1", inferred: true })];
    expect(searchLedger(inferred, people, "ana")[0].matchReason).toBe("Pagó Ana María · inferido + Participa Ana María");
    expect(searchLedger(inferred, people, "beto")[0].matchReason).toBe("Participa Beto");
  });

  it("no aparece quien no participó ni pagó", () => {
    expect(ids(searchLedger(entries, people, "carla"))).toEqual(["e2", "e3"]);
  });

  it("sin «Participante: X» ni «Efecto de X» por nombre", () => {
    for (const row of searchLedger(entries, people, "ana")) expect(row.matchReason).not.toMatch(/^Participante:/u);
  });

  it("los roles se derivan de pagadores, reparto y transferencias", () => {
    expect(personRoles(entries[0], "p1")).toMatchObject({ paid: true, participates: true });
    expect(personRoles(entries[0], "p2")).toMatchObject({ paid: false, participates: true });
    expect(personRoles(entries[3], "p1")).toMatchObject({ gave: true, received: false, paid: false });
    expect(personRoles(entries[3], "p2")).toMatchObject({ gave: false, received: true });
  });
});

describe("filtros rápidos por persona", () => {
  const entries = [
    expense("e1", "Uno", { payer: "p1", split: ["p1", "p2"] }),
    expense("e2", "Dos", { payer: "p2", split: ["p1", "p2"] }),
    expense("e3", "Tres", { payer: "p2", split: ["p1", "p2"] }),
    expense("e4", "Cuatro", { payer: "p1", split: ["p1", "p2"] }),
  ];
  it("con dos personas, «Pagó X» reduce los resultados aunque todos la involucren", () => {
    const found = searchLedger(entries, people.slice(0, 2), "beto");
    expect(found).toHaveLength(4);
    expect(ids(filterByPerson(found, "pago:p2"))).toEqual(["e2", "e3"]);
    expect(ids(filterByPerson(found, "participa:p2"))).toEqual(["e1", "e2", "e3", "e4"]);
    expect(personCounts(found, "p2")).toEqual({ paid: 2, participates: 4 });
  });
  it("con tres personas los filtros siguen siendo coherentes", () => {
    const three = [expense("a", "A", { payer: "p1", split: ["p1", "p2", "p3"] }), expense("b", "B", { payer: "p3", split: ["p1", "p3"] }), expense("c", "C", { payer: "p2", split: ["p2"] })];
    const found = searchLedger(three, people, "carla");
    expect(ids(found)).toEqual(["a", "b"]);
    expect(personCounts(found, "p3")).toEqual({ paid: 1, participates: 2 });
    expect(ids(filterByPerson(found, "pago:p3"))).toEqual(["b"]);
    expect(ids(filterByPerson(found, "participa:p3"))).toEqual(["a", "b"]);
  });
  it("un valor inválido no filtra", () => {
    expect(filterByPerson(entries, "")).toBe(entries);
    expect(filterByPerson(entries, "otro:p1")).toBe(entries);
    expect(filterByPerson(entries, "pago:")).toBe(entries);
  });
  it("en transferencias «pago» incluye a quien entregó y «participa» a quien recibió", () => {
    const list = [transfer("t", "p1", "p2")];
    expect(ids(filterByPerson(list, "pago:p1"))).toEqual(["t"]);
    expect(ids(filterByPerson(list, "participa:p2"))).toEqual(["t"]);
    expect(ids(filterByPerson(list, "pago:p2"))).toEqual([]);
  });
  it("reconoce las personas que menciona la consulta, con o sin acentos", () => {
    expect(personsInQuery(people, "ana maria").map(person => person.id)).toEqual(["p1"]);
    expect(personsInQuery(people, "gomez beto").map(person => person.id).sort()).toEqual(["p2", "p3"]);
    expect(personsInQuery(people, "supermercado")).toEqual([]);
    expect(personsInQuery(people, "")).toEqual([]);
  });
});

// La implementación nueva debe encontrar lo mismo que la de referencia, con los mismos motivos salvo el texto de persona.
describe("equivalencia con la implementación de referencia", () => {
  const WORDS = ["Gás", "gas", "café", "Carulla", "luz", "agua", "Taxi", "mercado", "renta", "Cena", "súper", "Pizza", "viaje", "hotel", "cine", "farmacia", "Éxito", "ñandú"];
  const NOTES = ["", "", "", "pagado con tarjeta", "regalo de cumpleaños", "Ñoño 1.000", "reintegro parcial"];
  const AMOUNTS = [100, 1000, 12345, 100000, 150000, 1000000, 2500050, 99, 5, 777];
  const QUERIES = ["gas", "GÁS", "cafe", "carulla gas", "luz agua", "1.000", "1000", "1,000", "10", "100", "1.234,50", "123", "cop", "COP", "usd", "co", "p", "ana", "beto", "carla", "ana gas", "nota", "tarjeta", "pagado", "ñandu", "reintegro 1", "café mercado", "zzz", "  ", "0", "00", "a", "5,00", "1.000,00", "12.345", "gas 10", "cop 1", "cop 1.000", "- 5", "$", "1 000"];

  function libro(seed, size) {
    const random = seededRandom(seed);
    const pick = list => list[Math.floor(random() * list.length)];
    return Array.from({ length: size }, (_, index) => {
      const currency = random() < 0.15 ? "USD" : "COP";
      const total = pick(AMOUNTS);
      const payer = pick(["p1", "p2", "p3"]);
      const split = ["p1", "p2", "p3"].filter(() => random() < 0.7);
      const members = split.length ? split : ["p1"];
      const base = expense(`g${index}`, `${pick(WORDS)} ${pick(WORDS)}`, { payer, split: members, total, currency, note: pick(NOTES), category: random() < 0.4 ? pick(WORDS) : null, status: random() < 0.1 ? "voided" : "active", inferred: random() < 0.2 });
      if (random() < 0.08) return { ...base, category: pick(WORDS), categoryInfo: null };
      return base;
    });
  }
  // El único cambio intencional: el nombre de una persona ya no se informa como «Participante: X».
  const normalizeReason = reason => [...new Set((reason ?? "").split(" + ").filter(Boolean).map(token => (/^(Participante: |Pagó |Participa |Recibió |Entregó )/u.test(token) ? "PERSONA" : token)))].join(" + ");
  const comparable = rows => rows.map(row => [row.id, normalizeReason(row.matchReason)]);

  it.each([[1, 120], [2, 120], [3, 300]])("devuelve los mismos movimientos y motivos sobre libros generados (semilla %i)", (seed, size) => {
    const entries = libro(seed, size);
    let compared = 0;
    for (const query of QUERIES) {
      const expected = referenceSearch(entries, people, query);
      const actual = searchLedger(entries, people, query);
      expect(ids(actual), `consulta «${query}»`).toEqual(ids(expected));
      expect(comparable(actual), `motivos de «${query}»`).toEqual(comparable(expected));
      compared += expected.length;
    }
    expect(compared).toBeGreaterThan(200);
  });

  it("sin persona de por medio los motivos son idénticos, letra por letra", () => {
    const entries = libro(9, 200);
    for (const query of ["gas", "cafe", "1.000", "10", "cop", "nota", "tarjeta", "luz agua", "100,00"]) {
      const expected = referenceSearch(entries, people, query).filter(row => !/Participante:/u.test(row.matchReason));
      const actual = searchLedger(entries, people, query).filter(row => !/(Pagó|Participa|Recibió|Entregó) /u.test(row.matchReason));
      expect(actual.map(row => [row.id, row.matchReason])).toEqual(expected.map(row => [row.id, row.matchReason]));
    }
  });

  it("encuentra por moneda con un término de letras, como la referencia", () => {
    const entries = libro(4, 60);
    expect(searchLedger(entries, people, "usd").length).toBe(referenceSearch(entries, people, "usd").length);
    expect(searchLedger(entries, people, "usd").length).toBeGreaterThan(0);
  });

  it("conserva el orden de entrada y no modifica los movimientos recibidos", () => {
    const entries = libro(5, 50);
    const snapshot = JSON.stringify(entries);
    const found = searchLedger(entries, people, "gas");
    expect(JSON.stringify(entries)).toBe(snapshot);
    const positions = ids(found).map(id => entries.findIndex(entry => entry.id === id));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("una consulta vacía devuelve todo sin motivo, como la referencia", () => {
    const entries = libro(6, 10);
    expect(ids(searchLedger(entries, people, "  "))).toEqual(ids(entries));
    expect(searchLedger(entries, people, "")[0].matchReason).toBeNull();
  });
});

describe("rendimiento de la búsqueda", () => {
  function synthetic(size) {
    const random = seededRandom(21);
    const words = ["super", "taxi", "gas", "luz", "cena", "pizza", "farmacia", "mercado", "viaje", "hotel", "cine", "renta", "agua", "cafe", "regalo", "libro"];
    return Array.from({ length: size }, (_, index) => expense(`s${index}`, `${words[Math.floor(random() * words.length)]} ${words[Math.floor(random() * words.length)]} ${index}`, { payer: random() < 0.5 ? "p1" : "p2", split: ["p1", "p2"], total: 1000 + Math.floor(random() * 500000), note: random() < 0.2 ? "con nota" : "" }));
  }
  const median = (fn, runs = 7) => { const times = []; for (let run = 0; run < runs; run += 1) { const start = performance.now(); fn(); times.push(performance.now() - start); } return times.sort((a, b) => a - b)[Math.floor(runs / 2)]; };
  const small = synthetic(2500);
  const large = synthetic(5000);

  it("una palabra con 5.000 movimientos se resuelve en menos de 100 ms", () => {
    const elapsed = median(() => searchLedger(large, people, "farmacia"));
    console.log(`SEARCH-PERF una palabra 5000: ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(100);
  });

  it("dos palabras y un nombre de persona también entran en el presupuesto", () => {
    expect(median(() => searchLedger(large, people, "farmacia taxi"))).toBeLessThan(100);
    expect(median(() => searchLedger(large, people, "beto"))).toBeLessThan(100);
    expect(median(() => searchLedger(large, people, "zzzz"))).toBeLessThan(100);
  });

  it("el costo crece de forma lineal con la cantidad de movimientos", () => {
    const a = median(() => searchLedger(small, people, "farmacia taxi"));
    const b = median(() => searchLedger(large, people, "farmacia taxi"));
    console.log(`SEARCH-PERF dos palabras 2500: ${a.toFixed(1)} ms · 5000: ${b.toFixed(1)} ms`);
    expect(b / Math.max(a, 0.5)).toBeLessThan(4);
  });

  it("es mucho más rápida que la referencia con importes sin formatear", () => {
    const reference = median(() => referenceSearch(small, people, "farmacia taxi"), 3);
    const indexed = median(() => searchLedger(small, people, "farmacia taxi"), 3);
    console.log(`SEARCH-PERF referencia ${reference.toFixed(1)} ms vs índice ${indexed.toFixed(1)} ms (2500 movimientos, dos palabras)`);
    expect(indexed).toBeLessThan(reference);
  });
});
