import { describe, expect, it } from "vitest";
import { mappingChoices, mappingWarnings } from "../src/import-mapping.js";
import { renderImportPreview, renderImportReview } from "../src/splitwise-ui.js";

const people = [{ id: "p_yo", displayName: "Pablo" }, { id: "p_ana", displayName: "Ana" }, { id: "p_jose", displayName: "José" }];

describe("mappingChoices", () => {
  it("ofrece «Soy yo» primero, luego las demás personas y al final una persona nueva", () => {
    const { options } = mappingChoices({ sourceName: "Otro", participants: people, ownId: "p_yo" });
    expect(options.map(option => option.label)).toEqual(["Soy yo (Pablo)", "Ana", "José", "Una persona nueva"]);
    expect(options.map(option => option.value)).toEqual(["p_yo", "p_ana", "p_jose", "new"]);
  });

  it("sin persona propia no hay «Soy yo»", () => {
    expect(mappingChoices({ sourceName: "Otro", participants: people }).options.map(option => option.label)).toEqual(["Pablo", "Ana", "José", "Una persona nueva"]);
  });

  it("preselecciona por nombre sin distinguir mayúsculas ni tildes y, si no coincide, una persona nueva", () => {
    expect(mappingChoices({ sourceName: "jose", participants: people, ownId: "p_yo" }).selected).toBe("p_jose");
    expect(mappingChoices({ sourceName: "  ANA ", participants: people, ownId: "p_yo" }).selected).toBe("p_ana");
    expect(mappingChoices({ sourceName: "Pablo", participants: people, ownId: "p_yo" }).selected).toBe("p_yo");
    expect(mappingChoices({ sourceName: "Caro", participants: people, ownId: "p_yo" }).selected).toBe("new");
  });

  it("lo guardado manda sobre el nombre, y una persona que ya no existe vuelve a «una persona nueva»", () => {
    expect(mappingChoices({ sourceName: "Ana", participants: people, ownId: "p_yo", saved: "p_yo" }).selected).toBe("p_yo");
    expect(mappingChoices({ sourceName: "Ana", participants: people, ownId: "p_yo", saved: "new" }).selected).toBe("new");
    expect(mappingChoices({ sourceName: "Ana", participants: people, ownId: "p_yo", saved: "p_borrada" }).selected).toBe("new");
  });
});

describe("mappingWarnings", () => {
  const names = ["Pablo T", "yo", "Ana"];
  it("avisa cuando dos columnas van a la misma persona", () => {
    const result = mappingWarnings({ names, mapping: ["p_yo", "p_yo", "p_ana"], participants: people, ownId: "p_yo" });
    expect(result.shared).toEqual([{ personId: "p_yo", personName: "Pablo", columns: ["Pablo T", "yo"] }]);
    expect(result.ownMissing).toBe(false);
  });

  it("avisa cuando ninguna columna es quien importa", () => {
    const result = mappingWarnings({ names, mapping: ["new", "p_ana", "new"], participants: people, ownId: "p_yo" });
    expect(result).toMatchObject({ shared: [], ownMissing: true, ownName: "Pablo" });
  });

  it("sin avisos cuando está todo claro, y sin persona propia no hay aviso de «yo»", () => {
    expect(mappingWarnings({ names, mapping: ["p_yo", "new", "p_ana"], participants: people, ownId: "p_yo" })).toMatchObject({ shared: [], ownMissing: false });
    expect(mappingWarnings({ names, mapping: ["new", "new", "new"], participants: people, ownId: null })).toMatchObject({ shared: [], ownMissing: false, ownName: null });
  });

  it("varias columnas nuevas no se consideran la misma persona", () => {
    expect(mappingWarnings({ names, mapping: ["new", "new", "new"], participants: people, ownId: "p_yo" }).shared).toEqual([]);
  });
});

describe("pantallas de la importación", () => {
  const meta = { participantNames: ["Pablo T", "Ana", "Caro"], counts: { movements: 3, incidents: 0, summaries: 0 } };
  const preview = (review = null) => ({ id: "preview_1", fileName: "grupo.csv", meta, review });
  const summary = { incidents: [], balances: [], pages: 1, page: 1 };
  const render = (extra = {}) => renderImportPreview({ groupId: "casa", csrf: "", preview: preview(), participants: people, summary, ledger: { default_currency: "COP" }, ownId: "p_yo", ...extra });

  it("cada columna pregunta quién es y ofrece «Soy yo» como primera opción", () => {
    const html = render();
    expect(html).toContain("¿Quién es “Pablo T” en este grupo?");
    expect(html).toContain("¿Quién es “Caro” en este grupo?");
    expect(html).toContain("elegí «Soy yo»");
    const first = /<select name="mapping_0"[^>]*>(.*?)<\/select>/su.exec(html)[1];
    expect(first.indexOf("Soy yo (Pablo)")).toBeGreaterThanOrEqual(0);
    expect(first.indexOf("Soy yo (Pablo)")).toBeLessThan(first.indexOf("Ana"));
    expect(first.indexOf("Una persona nueva")).toBeGreaterThan(first.indexOf("José"));
    expect(html).not.toContain("Crear participante nuevo");
  });

  it("preselecciona por nombre y respeta lo ya guardado", () => {
    const html = render();
    expect(/<option value="p_ana" selected>/u.test(html)).toBe(true);
    expect(/<option value="new" selected>Una persona nueva/u.test(html)).toBe(true);
    const saved = render({ preview: preview({ mapping: ["p_yo", "new", "new"], decisions: {} }) });
    expect(/<select name="mapping_0"[^>]*>.*?<option value="p_yo" selected>Soy yo/su.test(saved)).toBe(true);
  });

  it("sin persona propia no promete «Soy yo»", () => {
    const html = render({ ownId: null });
    expect(html).not.toContain("Soy yo");
  });

  const review = (mapping, extra = {}) => renderImportReview({ groupId: "casa", csrf: "", preview: preview({ mapping, decisions: {} }), plan: { rows: [], totals: [], reconciliation: [], warnings: [], assumptions: [], excluded: [] }, participants: people, ownId: "p_yo", ...extra });

  it("la revisión nombra a «Soy yo» y avisa de columnas repetidas y de que nadie es quien importa", () => {
    const clear = review(["p_yo", "p_ana", "new"]);
    expect(clear).toContain("Pablo T → Soy yo (Pablo)");
    expect(clear).toContain("Caro → Una persona nueva");
    expect(clear).not.toContain("quedarás fuera");
    const missing = review(["new", "p_ana", "new"]);
    expect(missing).toContain("quedarás fuera de estos movimientos");
    const shared = review(["p_ana", "p_ana", "p_yo"]);
    expect(shared).toContain("«Pablo T» y «Ana» se cargan a la misma persona (Ana)");
  });
});
