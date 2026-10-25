import { describe, expect, it } from "vitest";
import { renderEntryDetail } from "../src/ledger-ui.js";
import { renderLedgerOverview } from "../src/overview-ui.js";
import { categorySelect, recategorizationNotice, renderClassify, renderRecategorizePreview, selectionBar } from "../src/recategorize-ui.js";
import { CLASSIFY_JS } from "../src/classify-client.js";

const csrf = '<input type="hidden" name="_csrf" value="t">';
const categories = [
  { id: "c1", name: "Alimentos", nameKey: "alimentos", group: "Comidas y bebidas", groupKey: "comidas y bebidas", icon: "food", position: 1, status: "active", mergedInto: null },
  { id: "c2", name: "Taxi", nameKey: "taxi", group: "Transporte", groupKey: "transporte", icon: "car", position: 2, status: "active", mergedInto: null },
];
const entry = (id, extra = {}) => ({ id, type: "expense", currency: "COP", totalMinor: 10000, description: `Mov ${id}`, note: "", occurredAt: "2026-10-01", status: "active", revision: 1, createdByUserId: "u1", creatorName: "Pablo", categoryId: null, categoryInfo: null, cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }], allocations: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: 5000 }], effects: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: -5000 }], ...extra });
const participants = [{ id: "p1", displayName: "Ana", linkedUserId: "u1", active: 1 }, { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 }];
const data = (entries, archived = null) => ({ ledger: { default_currency: "COP", role: "owner", archived_at: archived }, participants, categories, entries, balances: [] });

describe("lista con selección", () => {
  const html = renderLedgerOverview(data([entry("a"), entry("b", { status: "voided" }), entry("c", { type: "transfer", allocations: [], cashParties: [{ participantId: "p1", direction: "out", amountMinor: 1 }, { participantId: "p2", direction: "in", amountMinor: 1 }] })]), { spaceId: "casa", userId: "u1", csrf });
  it("agrega casillas solo a los movimientos que se pueden recategorizar", () => {
    expect(html).toContain('name="ids" value="a"');
    expect(html).not.toContain('name="ids" value="b"');
    expect(html).not.toContain('name="ids" value="c"');
  });
  it("envía el formulario a la vista previa, con CSRF y el selector de categoría", () => {
    expect(html).toContain('action="/spaces/casa/ledger/recategorize/preview"');
    expect(html).toContain(csrf);
    expect(html).toContain('name="categoryId"');
    expect(html).toContain('<optgroup label="Transporte">');
  });
  it("ofrece «todos los resultados» con la cantidad y conserva búsqueda y filtro", () => {
    const filtered = renderLedgerOverview(data([entry("a"), entry("d")]), { spaceId: "casa", userId: "u1", csrf, query: "mov", category: "none" });
    expect(filtered).toContain("Todos los 2 resultados");
    expect(filtered).toContain('name="query" value="mov"');
    expect(filtered).toContain('name="categoria" value="none"');
  });
  it("sin CSRF (vista de solo lectura) o con el libro archivado no hay selección", () => {
    expect(renderLedgerOverview(data([entry("a")]), { spaceId: "casa", userId: "u1" })).not.toContain("recategorize");
    expect(renderLedgerOverview(data([entry("a")], "2026-01-01"), { spaceId: "casa", userId: "u1", csrf })).not.toContain("recategorize/preview");
  });
  it("ofrece «Clasificar rápido» con la cantidad de pendientes solo si hay", () => {
    expect(html).toContain("Clasificar rápido · 1");
    const none = renderLedgerOverview(data([entry("a", { categoryInfo: { id: "c1", name: "Alimentos", group: "Comidas y bebidas", groupKey: "comidas y bebidas", icon: "food" } })]), { spaceId: "casa", userId: "u1", csrf });
    expect(none).not.toContain("Clasificar rápido");
  });
  it("sin estilos ni scripts en línea", () => expect(html).not.toMatch(/ style=|<script/u));
});

describe("vista previa y confirmación", () => {
  const preview = { count: 12, selected: 14, sample: [{ id: "a", description: "Carulla 1", occurredAt: "2026-10-01", currency: "COP", totalMinor: 10000, current: null }], skipped: { voided: 1, permission: 1, unchanged: 0, transfers: 0 }, category: { id: "c1", name: "Alimentos" }, ledgerRevision: 7 };
  it("muestra cuántos cambian, la muestra, los omitidos y el aviso de que se puede deshacer", () => {
    const html = renderRecategorizePreview({ spaceId: "casa", csrf, preview, criteria: { ids: ["a", "b"] }, key: "k".repeat(36) });
    expect(html).toContain("Cambiarán 12 movimientos");
    expect(html).toContain("Alimentos");
    expect(html).toContain("Carulla 1");
    expect(html).toContain("1 movimiento anulado se omite");
    expect(html).toContain("1 movimiento queda fuera porque no son tuyos");
    expect(html).toContain("…y 11 más");
    expect(html).toContain("deshacer toda la operación");
  });
  it("el formulario de confirmación lleva el criterio, la revisión del libro y la clave", () => {
    const byIds = renderRecategorizePreview({ spaceId: "casa", csrf, preview, criteria: { ids: ["a", "b"] }, key: "k".repeat(36) });
    expect(byIds).toContain('name="ids" value="a"');
    expect(byIds).toContain('name="expectedRevision" value="7"');
    expect(byIds).toContain(`name="key" value="${"k".repeat(36)}"`);
    const byCriteria = renderRecategorizePreview({ spaceId: "casa", csrf, preview, criteria: { all: true, query: "carulla", category: "none" }, key: "k".repeat(36) });
    expect(byCriteria).toContain('name="all" value="1"');
    expect(byCriteria).toContain('name="query" value="carulla"');
    expect(byCriteria).not.toContain('name="ids"');
  });
  it("sin nada para cambiar no ofrece confirmar", () => {
    const html = renderRecategorizePreview({ spaceId: "casa", csrf, preview: { ...preview, count: 0, sample: [] }, criteria: { ids: ["a"] }, key: "k".repeat(36) });
    expect(html).toContain("Ya no hay nada para cambiar");
    expect(html).not.toContain("Confirmar el cambio");
    expect(html).not.toContain("<form");
  });
  it("escapa lo que viene del criterio y de los movimientos", () => {
    const html = renderRecategorizePreview({ spaceId: "casa", csrf, preview: { ...preview, sample: [{ ...preview.sample[0], description: "<img src=x onerror=1>" }] }, criteria: { all: true, query: '"><script>', category: "" }, key: "k".repeat(36) });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
  });
});

describe("aviso posterior", () => {
  const batch = { id: "recat_abc", kind: "bulk", changed: 40, skipped: 2, categoryName: "Alimentos", canUndo: true };
  it("informa lo cambiado y ofrece deshacer", () => {
    const html = recategorizationNotice({ spaceId: "casa", csrf, batch });
    expect(html).toContain("40 movimientos");
    expect(html).toContain("«Alimentos»");
    expect(html).toContain("2 omitidos");
    expect(html).toContain('action="/spaces/casa/ledger/recategorize/recat_abc/undo"');
  });
  it("sin permiso o ya deshecho no ofrece el botón", () => expect(recategorizationNotice({ spaceId: "casa", csrf, batch: { ...batch, canUndo: false } })).not.toContain("<form"));
  it("el aviso de un deshacer cuenta lo restaurado y lo que quedó", () => {
    const html = recategorizationNotice({ spaceId: "casa", csrf, batch: { id: "recat_undo", kind: "undo", changed: 6, skipped: 4 } });
    expect(html).toContain("6 movimientos volvieron");
    expect(html).toContain("4 quedaron como estaban porque se modificó después");
  });
});

describe("clasificar rápido", () => {
  const base = { spaceId: "casa", csrf, current: entry("a", { description: "Veterinaria Patitas" }), names: new Map([["p1", "Ana"]]), remaining: 12, suggestion: null, recents: categories, categories, skipped: [], last: null, key: "k".repeat(36) };
  it("muestra el movimiento, el contador y los recientes con atajos numéricos", () => {
    const html = renderClassify(base);
    expect(html).toContain("Veterinaria Patitas");
    expect(html).toContain("Quedan 12 movimientos pendientes");
    expect(html).toContain('data-key="1"');
    expect(html).toContain('data-key="2"');
    expect(html).toContain("pagó Ana");
    expect(html).toContain("Sin sugerencia");
    expect(html).toContain('src="/classify.js"');
  });
  it("la sugerencia muestra su causa y solo se aplica con una acción", () => {
    const html = renderClassify({ ...base, suggestion: { categoryId: "c1", name: "Alimentos", reason: "«pizza» aparece en 5 movimientos de Alimentos" } });
    expect(html).toContain("Sugerida:");
    expect(html).toContain("aparece en 5 movimientos de Alimentos");
    expect(html).toMatch(/<button[^>]*name="categoryId" value="c1"[^>]*data-accept/u);
  });
  it("saltar acumula los saltados en la URL y deshacer solo aparece con una última asignación", () => {
    expect(renderClassify({ ...base, skipped: ["x_1234567", "y_1234567"] })).toContain("saltar=x_1234567%2Cy_1234567%2Ca");
    expect(renderClassify(base)).not.toContain("data-undo");
    expect(renderClassify({ ...base, last: { id: "recat_1", canUndo: true } })).toContain("data-undo");
  });
  it("sin pendientes lo informa y vuelve al libro", () => {
    const html = renderClassify({ ...base, current: null, remaining: 0 });
    expect(html).toContain("No quedan movimientos pendientes");
    expect(html).toContain('href="/spaces/casa"');
  });
  it("escapa la descripción y no usa estilos ni scripts en línea", () => {
    const html = renderClassify({ ...base, current: entry("a", { description: "<b>x</b><script>1</script>" }) });
    expect(html).not.toContain("<b>x</b>");
    expect(html.replace('<script type="module" src="/classify.js"></script>', "")).not.toMatch(/ style=|<script/u);
  });
  it("el selector completo agrupa por grupo y exige elegir", () => {
    const html = categorySelect(categories);
    expect(html).toContain('<optgroup label="Transporte">');
    expect(html).toMatch(/<select[^>]*required/u);
  });
});

describe("historial", () => {
  it("una revisión de una recategorización en lote lo indica", () => {
    const revisions = [
      { revision: 1, action: "created", created_at: "2026-10-01 10:00:00", actor_name: "Pablo", snapshot_json: JSON.stringify({ categoryId: null }) },
      { revision: 2, action: "revised", created_at: "2026-10-02 10:00:00", actor_name: "Pablo", snapshot_json: JSON.stringify({ categoryId: "c1", recategorizationBatch: "recat_x" }) },
    ];
    const html = renderEntryDetail(entry("a"), data([entry("a")]), { spaceId: "casa", userId: "u1", revisions });
    expect(html).toContain("Cambió: categoría · recategorización en lote");
  });
});

describe("atajos de teclado", () => {
  it("el script usa los atajos del diseño y no actúa mientras se escribe", () => {
    expect(CLASSIFY_JS).toContain("[data-accept]");
    expect(CLASSIFY_JS).toContain("[data-skip]");
    expect(CLASSIFY_JS).toContain("[data-undo]");
    expect(CLASSIFY_JS).toContain("typing(event.target)");
    expect(CLASSIFY_JS).toContain("event.ctrlKey || event.metaKey || event.altKey");
  });
});
