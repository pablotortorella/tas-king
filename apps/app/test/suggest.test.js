import { describe, expect, it } from "vitest";
import { isPending, selectEntries } from "../src/recategorize.js";
import { MIN_SHARE, MIN_VOTES, significantWords, suggestCategory } from "../src/suggest.js";
import { seededRandom } from "./fixtures/synthetic-splitwise.js";

const category = (id, name, groupKey = "casa") => ({ id, name, group: "Casa", groupKey, icon: "tag", archived: false });
const done = (id, description, categoryInfo) => ({ id, description, categoryInfo, status: "active", type: "expense" });
const target = (description, id = "t") => ({ id, description, categoryInfo: null, status: "active", type: "expense" });
const mascotas = category("c-masc", "Mascotas");
const comida = category("c-com", "Alimentos");
const taxi = category("c-taxi", "Taxi");

describe("palabras significativas", () => {
  it("descarta conectores, números y palabras cortas, en minúsculas y sin acentos", () => {
    expect(significantWords("Compra DE comida para el Perro #123 en Éxito")).toEqual(["compra", "comida", "perro", "exito"]);
  });
  it("no repite palabras y devuelve vacío si no queda nada", () => {
    expect(significantWords("pago pago PAGO")).toEqual(["pago"]);
    expect(significantWords("de la el 12 a")).toEqual([]);
  });
});

describe("suggestCategory: los tres escenarios del spec", () => {
  it("descripción conocida: la palabra aparece en 5 movimientos de Mascotas y en ninguno de otra", () => {
    const history = Array.from({ length: 5 }, (_, index) => done(`m${index}`, `Veterinaria Patitas ${index}`, mascotas));
    const found = suggestCategory(target("Veterinaria Patitas control"), [...history, done("x", "Café", comida)]);
    expect(found).toMatchObject({ categoryId: "c-masc", name: "Mascotas", votes: 5, total: 5 });
    expect(found.reason).toContain("aparece en 5 movimientos de Mascotas");
  });

  it("sin evidencia: ninguna palabra aparece en movimientos categorizados", () => {
    expect(suggestCategory(target("Rarísimo único"), [done("a", "Café", comida), done("b", "Taxi aeropuerto", taxi)])).toBeNull();
  });

  it("evidencia dividida: dos categorías sin que una domine", () => {
    const history = [done("a", "Mercado norte", comida), done("b", "Mercado sur", comida), done("c", "Mercado perros", mascotas), done("d", "Mercado gatos", mascotas)];
    expect(suggestCategory(target("Mercado centro"), history)).toBeNull();
  });
});

describe("suggestCategory: umbrales", () => {
  const corpus = (food, pets) => [
    ...Array.from({ length: food }, (_, index) => done(`f${index}`, `Supermercado Norte ${index}`, comida)),
    ...Array.from({ length: pets }, (_, index) => done(`p${index}`, `Supermercado Norte ${index}`, mascotas)),
  ];
  it("un solo movimiento parecido no alcanza", () => expect(suggestCategory(target("Supermercado Norte"), corpus(1, 0))).toBeNull());
  it("dos coincidencias de la misma categoría alcanzan", () => expect(suggestCategory(target("Supermercado Norte"), corpus(2, 0))).toMatchObject({ categoryId: "c-com" }));
  it("7 de 10 (70 %) alcanza y 6 de 10 no", () => {
    expect(suggestCategory(target("Supermercado Norte"), corpus(7, 3))).toMatchObject({ categoryId: "c-com", votes: 7, total: 10 });
    expect(suggestCategory(target("Supermercado Norte"), corpus(6, 4))).toBeNull();
  });
  it("la razón menciona cuántos parecidos hubo cuando no todos coinciden", () => expect(suggestCategory(target("Supermercado Norte"), corpus(8, 2)).reason).toContain("de 10 parecidos"));
  it("no se sugiere a sí mismo ni cuenta movimientos sin categoría", () => {
    const own = done("t", "Supermercado Norte", comida);
    expect(suggestCategory(target("Supermercado Norte"), [own, done("u", "Supermercado Norte", null), done("v", "Supermercado Norte", comida)])).toBeNull();
  });
  it("una descripción sin palabras significativas no sugiere nada", () => expect(suggestCategory(target("12 de la"), corpus(5, 0))).toBeNull());
  it("el desempate es estable", () => {
    const history = [done("a", "Pizza viernes", comida), done("b", "Pizza sábado", comida)];
    expect(suggestCategory(target("Pizza hoy"), history)).toEqual(suggestCategory(target("Pizza hoy"), [...history].reverse()));
  });
});

describe("suggestCategory: propiedad", () => {
  it("nunca sugiere con menos de dos votos o menos del 70 % sobre miles de casos generados", () => {
    const random = seededRandom(11);
    const words = ["pago", "super", "taxi", "gato", "perro", "cine", "luz", "agua", "gas", "viaje", "hotel", "cena"];
    const categories = [comida, mascotas, taxi, category("c4", "Hotel"), category("c5", "Cine")];
    let suggested = 0;
    for (let round = 0; round < 4000; round += 1) {
      const pick = () => `${words[Math.floor(random() * words.length)]} ${words[Math.floor(random() * words.length)]}`;
      const history = Array.from({ length: Math.floor(random() * 40) }, (_, index) => done(`h${index}`, pick(), random() < 0.1 ? null : categories[Math.floor(random() * categories.length)]));
      const entry = target(pick());
      const result = suggestCategory(entry, history);
      const wanted = new Set(significantWords(entry.description));
      const similar = history.filter(other => other.categoryInfo && significantWords(other.description).some(word => wanted.has(word)));
      if (!result) continue;
      suggested += 1;
      const votes = similar.filter(other => other.categoryInfo.id === result.categoryId).length;
      expect(similar.length).toBeGreaterThanOrEqual(MIN_VOTES);
      expect(votes).toBeGreaterThanOrEqual(MIN_VOTES);
      expect(votes / similar.length).toBeGreaterThanOrEqual(MIN_SHARE);
      expect(result.votes).toBe(votes);
      expect(result.total).toBe(similar.length);
    }
    expect(suggested).toBeGreaterThan(100);
  });
});

describe("pendientes y selección", () => {
  it("un movimiento está pendiente sin categoría o con una categoría genérica; no las anuladas ni las transferencias", () => {
    expect(isPending(target("x"))).toBe(true);
    expect(isPending({ ...target("x"), categoryInfo: { ...category("z", "General"), generic: true } })).toBe(true);
    expect(isPending({ ...target("x"), categoryInfo: comida })).toBe(false);
    expect(isPending({ ...target("x"), status: "voided" })).toBe(false);
    expect(isPending({ ...target("x"), type: "transfer" })).toBe(false);
  });

  const data = { participants: [], entries: [
    { ...target("Carulla uno", "e1"), currency: "COP", totalMinor: 100, effects: [], cashParties: [] },
    { ...target("Carulla dos", "e2"), currency: "COP", totalMinor: 100, effects: [], cashParties: [] },
    { ...target("Otra cosa", "e3"), currency: "COP", totalMinor: 100, effects: [], cashParties: [] },
  ] };
  it("resuelve ids explícitos", () => expect(selectEntries(data, { ids: ["e1", "e3", "nope"] }).map(entry => entry.id)).toEqual(["e1", "e3"]));
  it("resuelve todos los resultados de una búsqueda con el mismo código que la lista", () => {
    expect(selectEntries(data, { all: true, query: "carulla", category: "" }).map(entry => entry.id)).toEqual(["e1", "e2"]);
    expect(selectEntries(data, { all: true, query: "", category: "none" }).map(entry => entry.id)).toEqual(["e1", "e2", "e3"]);
  });
  it("sin criterio no selecciona nada", () => expect(selectEntries(data, {})).toEqual([]));
});
