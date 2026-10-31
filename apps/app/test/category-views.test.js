import { describe, expect, it } from "vitest";
import { categoryChip, filterByCategory, ledgerCsv, renderEntryDetail, renderEntryForm, searchLedger } from "../src/ledger-ui.js";
import { renderLedgerOverview } from "../src/overview-ui.js";
import { renderCategories } from "../src/categories-ui.js";
import { searchable } from "../src/text.js";
import { TEXT_MODULE_SOURCE } from "../src/text.js";

const info = (id, name, group = "Casa", extra = {}) => ({ id, name, group, groupKey: searchable(group), icon: "home", archived: false, ...extra });
const categories = [
  { id: "c-rest", name: "Restaurantes", nameKey: "restaurantes", group: "Comidas y bebidas", groupKey: "comidas y bebidas", icon: "food", position: 1, status: "active", mergedInto: null },
  { id: "c-alq", name: "Alquiler", nameKey: "alquiler", group: "Casa", groupKey: "casa", icon: "home", position: 2, status: "active", mergedInto: null },
  { id: "c-vie", name: "Vieja", nameKey: "vieja", group: "Casa", groupKey: "casa", icon: "tag", position: 3, status: "archived", mergedInto: null },
  { id: "c-fus", name: "Fusionada", nameKey: "fusionada", group: "Casa", groupKey: "casa", icon: "tag", position: 4, status: "archived", mergedInto: "c-alq" },
];
const entry = (id, extra = {}) => ({ id, type: "expense", currency: "COP", totalMinor: 10000, description: `Mov ${id}`, note: "", occurredAt: "2026-10-01", status: "active", revision: 1, createdByUserId: "u", creatorName: "U", cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }], allocations: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: 5000 }], effects: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: -5000 }], categoryId: null, categoryInfo: null, ...extra });
const entries = [
  entry("a", { categoryId: "c-rest", categoryInfo: info("c-rest", "Restaurantes", "Comidas y bebidas") }),
  entry("b", { categoryId: "c-alq", categoryInfo: info("c-alq", "Alquiler") }),
  entry("c", { categoryId: "c-fus", categoryInfo: info("c-alq", "Alquiler") }),
  entry("d"),
  entry("e", { type: "transfer", cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }, { participantId: "p2", direction: "in", amountMinor: 10000 }], allocations: [] }),
  entry("f", { importBatchId: "import_x", sourceRowNumber: 9, categoryInfo: info("c-suelta", "Comida suelta", "Importadas de Splitwise") }),
];
const ids = list => list.map(row => row.id);

describe("filtro por categoría", () => {
  it("sin filtro devuelve todo", () => expect(ids(filterByCategory(entries, ""))).toEqual(["a", "b", "c", "d", "e", "f"]));
  it("por categoría incluye los movimientos de las fusionadas en ella", () => expect(ids(filterByCategory(entries, "c-alq"))).toEqual(["b", "c"]));
  it("por grupo reúne las categorías del grupo", () => expect(ids(filterByCategory(entries, "g:casa"))).toEqual(["b", "c"]));
  it("«sin categoría» no incluye transferencias ni importados con categoría de origen", () => expect(ids(filterByCategory(entries, "none"))).toEqual(["d"]));
  it("un valor desconocido no devuelve nada", () => expect(filterByCategory(entries, "no-existe")).toEqual([]));
});

describe("búsqueda por categoría", () => {
  it("encuentra por el nombre de la categoría e indica el motivo", () => {
    const found = searchLedger(entries, [], "restaurantes");
    expect(ids(found)).toEqual(["a"]);
    expect(found[0].matchReason).toBe("Categoría");
  });
  it("encuentra aunque se escriba con otras mayúsculas o acentos", () => expect(ids(searchLedger(entries, [], "ALQUILER"))).toEqual(["b", "c"]));
  it("sigue encontrando por la categoría de origen de un importado", () => expect(ids(searchLedger(entries, [], "comida suelta"))).toEqual(["f"]));
  it("combina un término de categoría con uno de descripción", () => expect(ids(searchLedger(entries, [], "restaurantes mov"))).toEqual(["a"]));
});

describe("chip de categoría", () => {
  it("muestra ícono y nombre escapado", () => {
    const html = categoryChip(entry("x", { categoryInfo: info("i", "<b>Hack</b>") }));
    expect(html).toContain("&lt;b&gt;Hack&lt;/b&gt;");
    expect(html).toContain("<svg");
    expect(html).not.toContain("<b>");
  });
  it("muestra «Sin categoría» salvo en transferencias", () => {
    expect(categoryChip(entry("x"))).toContain("Sin categoría");
    expect(categoryChip(entry("y", { type: "transfer" }))).toBe("");
  });
  it("un importado sin coincidencia muestra el texto de origen", () => expect(categoryChip(entries[5])).toContain("Comida suelta"));
});

const participants = [{ id: "p1", displayName: "Ana", linkedUserId: "u", active: 1 }, { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 }];
const data = (list = entries, role = "owner") => ({ ledger: { default_currency: "COP", role, archived_at: null }, participants, categories, entries: list, balances: [] });

describe("selector de categoría en el formulario", () => {
  const form = (extra = {}) => renderEntryForm(data(), { groupId: "casa", csrf: "", userId: "u", ...extra });
  it("agrupa las categorías vigentes y ofrece escribir una nueva", () => {
    const html = form();
    expect(html).toContain('<optgroup label="Comidas y bebidas">');
    expect(html).toContain('name="categoryId"');
    expect(html).toContain('name="categoryNew"');
    expect(html).toContain('data-key="restaurantes"');
    expect(html).not.toContain(">Vieja<");
  });
  it("las transferencias no muestran categoría", () => expect(form({ type: "transfer" })).not.toContain('name="categoryId"'));
  it("al corregir preselecciona la categoría del movimiento", () => {
    const html = form({ entry: entries[0] });
    expect(html).toMatch(/<option value="c-rest"[^>]*selected/u);
  });
  it("al corregir un movimiento de una archivada la sigue ofreciendo marcada", () => {
    const html = form({ entry: entry("z", { categoryId: "c-vie", categoryInfo: info("c-vie", "Vieja", "Casa", { archived: true }) }) });
    expect(html).toMatch(/<option value="c-vie"[^>]*selected[^>]*>Vieja \(archivada\)/u);
  });
  it("al corregir un movimiento de una fusionada preselecciona la destino y no duplica opciones", () => {
    const html = form({ entry: entries[2] });
    expect(html).toMatch(/<option value="c-alq"[^>]*selected/u);
    expect(html).not.toContain('value="c-fus"');
  });
  it("sin estilos ni scripts en línea", () => expect(form()).not.toMatch(/ style=|<script/u));
});

describe("lista, detalle y filtro en la vista general", () => {
  const view = (extra = {}) => renderLedgerOverview(data(), { groupId: "casa", userId: "u", ...extra });
  it("muestra el chip de categoría de cada fila", () => {
    const html = view();
    expect(html).toContain("Restaurantes");
    expect(html).toContain("Sin categoría");
  });
  it("ofrece el filtro con «todo el grupo» y «sin categoría» y marca el elegido", () => {
    const html = view({ category: "g:casa" });
    expect(html).toContain('name="categoria"');
    expect(html).toMatch(/<option value="g:casa" selected>Todo Casa<\/option>/u);
    expect(html).toContain('value="none"');
  });
  it("filtrando por grupo solo se ven esas filas y se puede quitar el filtro", () => {
    const html = view({ category: "g:casa" });
    expect(html).toContain("Mov b");
    expect(html).not.toContain("Mov a<");
    expect(html).toContain("Quitar filtro");
  });
  it("el enlace «ver más» conserva el filtro", () => {
    const many = Array.from({ length: 50 }, (_, index) => entry(`m${index}`, { categoryId: "c-alq", categoryInfo: info("c-alq", "Alquiler") }));
    const html = renderLedgerOverview(data(many), { groupId: "casa", userId: "u", category: "c-alq" });
    expect(html).toContain("categoria=c-alq");
  });
  it("enlaza a la gestión de categorías", () => expect(view()).toContain('href="/groups/casa/ledger/categories"'));
  it("el detalle muestra la categoría con su grupo", () => {
    const html = renderEntryDetail(entries[0], data(), { groupId: "casa", userId: "u", revisions: [] });
    expect(html).toContain("Restaurantes");
    expect(html).toContain("Comidas y bebidas");
  });
  it("el detalle de un movimiento sin categoría lo dice", () => expect(renderEntryDetail(entries[3], data(), { groupId: "casa", userId: "u", revisions: [] })).toContain("Sin categoría"));
  it("el detalle de una transferencia no muestra categoría", () => expect(renderEntryDetail(entries[4], data(), { groupId: "casa", userId: "u", revisions: [] })).not.toContain("Sin categoría"));
});

describe("pantalla de gestión", () => {
  const owner = renderCategories(data(), { groupId: "casa", csrf: '<input type="hidden" name="_csrf" value="t">', owner: true });
  const member = renderCategories(data(undefined, "member"), { groupId: "casa", csrf: "", owner: false });
  it("el titular ve los formularios de editar, archivar, fusionar y crear", () => {
    for (const fragment of ["/ledger/categories/c-alq/archive", "/ledger/categories/c-alq/merge", 'action="/groups/casa/ledger/categories"', "Nueva categoría"]) expect(owner).toContain(fragment);
  });
  it("un integrante solo ve la lista", () => {
    expect(member).not.toContain("<form");
    expect(member).toContain("Solo la persona titular");
    expect(member).toContain("Restaurantes");
  });
  it("cuenta los movimientos por categoría y separa archivadas y fusionadas", () => {
    expect(owner).toContain("1 movimiento");
    expect(owner).toContain("Archivadas y fusionadas");
    expect(owner).toContain("Fusionada en «Alquiler»");
  });
  it("las opciones de fusión excluyen a la propia categoría y a las que ya apuntan a ella", () => {
    const merge = owner.split("/ledger/categories/c-alq/merge")[1].split("</form>")[0];
    expect(merge).toContain("Restaurantes");
    expect(merge).not.toContain(">Casa · Alquiler<");
  });
  it("escapa los nombres y no usa estilos en línea", () => {
    const html = renderCategories({ ...data(), categories: [{ ...categories[0], name: '"><img src=x onerror=1>' }] }, { groupId: "casa", csrf: "", owner: true });
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/ style=|<script/u);
  });
});

describe("exportación", () => {
  it("el CSV agrega la columna categoría con el nombre vigente", () => {
    const withEffects = entries.map(row => ({ ...row, effects: [{ participantId: "p1", amountMinor: 100 }] }));
    const csv = ledgerCsv({ entries: withEffects });
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain('"categoria"');
    const column = lines[0].replaceAll('"', "").replace("﻿", "").split(",").indexOf("categoria");
    const cell = line => line.split('","')[column].replaceAll('"', "");
    expect(cell(lines[1])).toBe("Restaurantes");
    expect(cell(lines[3])).toBe("Alquiler");
    expect(cell(lines[4])).toBe("");
    expect(cell(lines[6])).toBe("Comida suelta");
  });
  it("neutraliza fórmulas en el nombre de la categoría", () => {
    const row = entry("x", { categoryInfo: info("i", "=HYPERLINK(1)"), effects: [{ participantId: "p1", amountMinor: 1 }] });
    expect(ledgerCsv({ entries: [row] })).toContain("\"'=HYPERLINK(1)\"");
  });
});

describe("módulo /text.js", () => {
  it("evaluado de forma aislada normaliza igual que la función del servidor", async () => {
    const module = await import(`data:text/javascript;base64,${Buffer.from(TEXT_MODULE_SOURCE).toString("base64")}`);
    for (const sample of ["Álimentos", "Casa - Otro", "  Café  y  Panadería ", "TV/teléfono/Internet", "", "Ñandú", "x".repeat(200)]) expect(module.searchable(sample)).toBe(searchable(sample));
  });
});
