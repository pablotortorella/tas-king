import { describe, expect, it } from "vitest";
import { slowBookEvent, SLOW_BOOK_MS, SQL_TRIGGER_ENTRIES } from "../src/perf.js";
import { PAGE_SIZE, renderLedgerOverview } from "../src/overview-ui.js";

const people = [{ id: "p1", displayName: "Ana", linkedUserId: "u1", active: 1 }, { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 }];
const entry = (index, extra = {}) => ({ id: `e${index}`, type: "expense", currency: "COP", totalMinor: 10000, description: `Movimiento ${index}`, note: "", occurredAt: "2026-06-01", status: "active", revision: 1, createdByUserId: "u1", creatorName: "Ana", inferred: false, categoryInfo: null, cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }], allocations: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: 5000 }], effects: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: -5000 }], ...extra });
const data = entries => ({ ledger: { default_currency: "COP", role: "owner", archived_at: null }, participants: people, categories: [], entries, balances: [] });
const view = (entries, options = {}) => renderLedgerOverview(data(entries), { groupId: "casa", userId: "u1", ...options });
const rowsOf = html => [...html.matchAll(/<strong class="entry-title">([^<]*)<\/strong>/gu)].map(match => match[1]);

describe("«Ver más» y el contador con el índice nuevo", () => {
  const many = Array.from({ length: 95 }, (_, index) => entry(index));
  it("muestra 40 con el conteo total y «Ver 40 movimientos más»", () => {
    const html = view(many);
    expect(rowsOf(html)).toHaveLength(PAGE_SIZE);
    expect(html).toContain("95 vigentes");
    expect(html).toContain("mostrando 40");
    expect(html).toContain("Ver 40 movimientos más");
  });
  it("«Ver más» conserva la búsqueda y los filtros", () => {
    const html = view(many, { query: "movimiento", category: "none", person: "pago:p1" });
    expect(html).toMatch(/href="[^"]*q=movimiento[^"]*categoria=none[^"]*quien=pago%3Ap1[^"]*mostrar=80/u);
  });
  it("con una búsqueda el contador es «N de M» y los anulados aparecen rotulados con su motivo", () => {
    const list = [entry(1, { description: "Gas natural" }), entry(2, { description: "Gas viejo", status: "voided" }), entry(3, { description: "Luz" })];
    const html = view(list, { query: "gas" });
    expect(html).toContain("2 de 3 movimientos");
    expect(html).toContain("Anulado");
    expect(html).toContain("Coincide: Descripción");
    expect(html).toContain("entry-voided");
  });
  it("sin coincidencias lo dice", () => expect(view(many, { query: "zzzz" })).toContain("No hay coincidencias."));
});

describe("filtros rápidos por persona en la vista", () => {
  const list = [entry(1, { description: "Uno" }), entry(2, { description: "Dos", cashParties: [{ participantId: "p2", direction: "out", amountMinor: 10000 }] }), entry(3, { description: "Tres", cashParties: [{ participantId: "p2", direction: "out", amountMinor: 10000 }] })];
  it("aparecen solo cuando la consulta coincide con el nombre de una persona, con su cantidad", () => {
    const html = view(list, { query: "beto" });
    expect(html).toContain("Pagó Beto (2)");
    expect(html).toContain("Participa Beto (3)");
    expect(view(list, { query: "uno" })).not.toContain("person-filters");
    expect(view(list, { query: "" })).not.toContain("person-filters");
  });
  it("el filtro elegido reduce la lista, se marca como activo y se puede quitar", () => {
    const html = view(list, { query: "beto", person: "pago:p2" });
    expect(rowsOf(html).sort()).toEqual(["Dos", "Tres"]);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Quitar búsqueda y filtros");
    const link = /<a class="chip-button active" href="([^"]+)"/u.exec(html)[1];
    expect(link).not.toContain("quien=");
  });
  it("cada chip lleva la búsqueda y la categoría en su dirección", () => {
    const html = view(list, { query: "beto", category: "none" });
    expect(html).toMatch(/href="[^"]*q=beto[^"]*categoria=none[^"]*quien=pago%3Ap2/u);
  });
  it("sin estilos ni scripts en línea", () => expect(view(list, { query: "beto" })).not.toMatch(/ style=|<script/u));
});

describe("franja «Recién agregado» en la vista", () => {
  const list = [entry(1, { description: "Reciente" }), entry(2, { description: "Otro" })];
  it("muestra el movimiento afectado arriba, con enlace al detalle", () => {
    const html = view(list, { recent: { entry: list[0], title: "Recién agregado" } });
    expect(html).toMatch(/<section class="recent-strip"[^>]*><h3>Recién agregado<\/h3>/u);
    expect(html).toContain('href="/groups/casa/ledger/entries/e1"');
    expect(html.indexOf("recent-strip")).toBeLessThan(html.indexOf('class="entry-list"'));
  });
  it("sin el parámetro no hay franja", () => expect(view(list)).not.toContain("recent-strip"));
  it("escapa el título y el movimiento", () => {
    const html = view(list, { recent: { entry: { ...list[0], description: "<img src=x onerror=1>" }, title: "Recién <b>agregado</b>" } });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>agregado");
  });
});

describe("aviso de apertura lenta", () => {
  const base = { elapsedMs: 450, entries: 2500, participants: 2, categories: 51, requestId: "r1" };
  it("no se emite por debajo del umbral y sí con el umbral cumplido", () => {
    expect(slowBookEvent({ ...base, elapsedMs: 299 })).toBeNull();
    expect(slowBookEvent({ ...base, elapsedMs: SLOW_BOOK_MS })).toMatchObject({ event: "slow_book_open", elapsedMs: 300 });
  });
  it("marca cuando supera el umbral de movimientos para pasar a SQL", () => {
    expect(slowBookEvent(base).overSqlTrigger).toBe(false);
    expect(slowBookEvent({ ...base, entries: SQL_TRIGGER_ENTRIES }).overSqlTrigger).toBe(true);
  });
  it("acepta un umbral propio y descarta valores inválidos", () => {
    expect(slowBookEvent({ ...base, elapsedMs: 5 }, "0")).not.toBeNull();
    expect(slowBookEvent({ ...base, elapsedMs: 5 }, "abc")).toBeNull();
    expect(slowBookEvent({ ...base, elapsedMs: 5 }, "")).toBeNull();
    expect(slowBookEvent({ ...base, elapsedMs: 450 }, "")).not.toBeNull();
    expect(slowBookEvent({ ...base, elapsedMs: -1 }, 0)).toBeNull();
  });
  it("solo lleva cantidades y tiempos", () => expect(Object.keys(slowBookEvent(base)).sort()).toEqual(["categories", "elapsedMs", "entries", "event", "overSqlTrigger", "participants", "requestId", "thresholdMs"]));
});
