import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS, parsePaymentMethod, paymentMethodName } from "../src/payment-methods.js";
import { ledgerCsv, parseEntryForm, renderEntryDetail, renderEntryForm, revisionSummary } from "../src/ledger-ui.js";

const participants = [{ id: "p1", displayName: "Ana", linkedUserId: "u", active: 1 }, { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 }];
const data = entries => ({ ledger: { default_currency: "COP", role: "owner", archived_at: null }, participants, categories: [], entries, balances: [] });
const entry = (extra = {}) => ({ id: "e1", type: "expense", currency: "COP", totalMinor: 10000, description: "Cena", note: "", occurredAt: "2026-10-01", status: "active", revision: 1, createdByUserId: "u", creatorName: "U", cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }], allocations: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: 5000 }], effects: [{ participantId: "p1", amountMinor: 5000 }], ...extra });

describe("catálogo de formas de pago", () => {
  it("es una lista fija y corta con nombres en español", () => {
    expect(PAYMENT_METHODS.map(method => method.id)).toEqual(["cash", "debit", "credit", "transfer", "wallet"]);
    expect(PAYMENT_METHODS.map(method => method.name)).toEqual(["Efectivo", "Débito", "Crédito", "Transferencia", "Billetera virtual"]);
    expect(Object.isFrozen(PAYMENT_METHODS)).toBe(true);
  });
  it("el nombre de un identificador desconocido o ausente es null", () => {
    expect(paymentMethodName("credit")).toBe("Crédito");
    expect(paymentMethodName("cheque")).toBeNull();
    expect(paymentMethodName(null)).toBeNull();
  });
  it("vacío o ausente es «sin indicar»; un identificador desconocido no es válido", () => {
    expect(parsePaymentMethod(undefined)).toEqual({ valid: true, id: null });
    expect(parsePaymentMethod("")).toEqual({ valid: true, id: null });
    expect(parsePaymentMethod("wallet")).toEqual({ valid: true, id: "wallet" });
    expect(parsePaymentMethod("cheque")).toEqual({ valid: false, id: null });
    expect(parsePaymentMethod("toString")).toEqual({ valid: false, id: null });
  });
});

describe("forma de pago en el formulario", () => {
  const form = (extra = {}) => renderEntryForm(data([]), { groupId: "casa", csrf: "", userId: "u", ...extra });
  it("ofrece «Sin indicar» y las cinco formas, sin ninguna marcada al agregar", () => {
    const html = form();
    expect(html).toContain('name="paymentMethod"');
    expect(html).toContain('<option value="">Sin indicar</option>');
    for (const method of PAYMENT_METHODS) expect(html).toContain(`<option value="${method.id}">${method.name}</option>`);
    expect(html).not.toMatch(/<option value="[a-z]+" selected>/u);
  });
  it("un ingreso también la ofrece y una transferencia no", () => {
    expect(form({ type: "income" })).toContain('name="paymentMethod"');
    expect(form({ type: "transfer" })).not.toContain('name="paymentMethod"');
  });
  it("al corregir marca la forma de pago del movimiento", () => {
    expect(form({ entry: entry({ paymentMethod: "debit" }) })).toContain('<option value="debit" selected>Débito</option>');
  });
  it("sin estilos ni scripts en línea", () => expect(form()).not.toMatch(/ style=|<script/u));
});

describe("forma de pago al leer el formulario", () => {
  const base = [["type", "expense"], ["currency", "COP"], ["amount", "100"], ["description", "x"], ["occurredAt", "2026-10-24"], ["payer", "a"], ["splitMethod", "equal"], ["beneficiary", "a"]];
  const read = extra => parseEntryForm(new URLSearchParams([...base, ...extra]));
  it("lee el identificador, un campo vacío es «sin indicar» y la ausencia significa «no tocar»", () => {
    expect(read([["paymentMethod", "credit"]])).toMatchObject({ paymentMethod: "credit" });
    expect(read([["paymentMethod", ""]])).toMatchObject({ paymentMethod: "" });
    expect(read([])).toMatchObject({ paymentMethod: undefined });
  });
});

describe("forma de pago en el detalle, el historial y la exportación", () => {
  const detail = item => renderEntryDetail(item, data([item]), { groupId: "casa", userId: "u", revisions: [] });
  it("el detalle muestra la forma de pago; sin ella no muestra nada", () => {
    expect(detail(entry({ paymentMethod: "wallet" }))).toContain('<span class="chip pay">Billetera virtual</span>');
    expect(detail(entry({ paymentMethod: null }))).not.toContain("chip pay");
  });
  const row = snapshot => ({ action: "revised", snapshot_json: JSON.stringify(snapshot) });
  it("el historial indica «forma de pago» cuando cambia, también al quitarla", () => {
    expect(revisionSummary(row({ paymentMethod: "cash" }), row({ paymentMethod: null }))).toBe("Cambió: forma de pago");
    expect(revisionSummary(row({ paymentMethod: "cash" }), row({ paymentMethod: "debit" }))).toBe("Cambió: forma de pago");
    expect(revisionSummary(row({ paymentMethod: null }), row({ paymentMethod: "debit" }))).toBe("Cambió: forma de pago");
  });
  it("una revisión anterior al campo equivale a «sin indicar»: no cuenta como cambio", () => {
    expect(revisionSummary(row({ paymentMethod: null }), row({}))).toBe("Sin cambios de contenido");
    expect(revisionSummary(row({ paymentMethod: "cash" }), row({}))).toBe("Cambió: forma de pago");
  });
  it("el CSV agrega «forma_pago» al final con el nombre, vacío si no se indicó", () => {
    const csv = ledgerCsv({ entries: [entry({ paymentMethod: "transfer" }), entry({ id: "e2" })] });
    const [header, first, second] = csv.replace("﻿", "").trim().split("\r\n");
    expect(header.replaceAll('"', "").split(",").at(-1)).toBe("forma_pago");
    expect(first.endsWith('"Transferencia"')).toBe(true);
    expect(second.endsWith('""')).toBe(true);
  });
});
