import { describe, expect, it } from "vitest";
import { renderBookHead, renderLedgerOverview, renderPeople } from "../src/overview-ui.js";

const participants = [
  { id: "p1", displayName: "<b>Pablo</b>", linkedUserId: "u1", active: 1 },
  { id: "p2", displayName: "Laura", linkedUserId: null, active: 1 },
];
const entry = (overrides = {}) => ({
  id: "e1", type: "expense", currency: "COP", totalMinor: 10000, description: "Super <script>alert(1)</script>", note: "",
  occurredAt: "2026-10-22", status: "active", revision: 1, createdByUserId: "u1", creatorName: "Pablo",
  cashParties: [{ participantId: "p1", direction: "out", amountMinor: 10000 }],
  allocations: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: 5000 }],
  effects: [{ participantId: "p1", amountMinor: 5000 }, { participantId: "p2", amountMinor: -5000 }], ...overrides,
});
const data = (entries = [entry()]) => ({
  ledger: { default_currency: "COP", role: "owner", archived_at: null },
  participants, entries,
  balances: [{ currency: "COP", participantId: "p1", amountMinor: 5000 }, { currency: "COP", participantId: "p2", amountMinor: -5000 }],
});

describe("libro: vista general", () => {
  it("escapa nombres y descripciones, y no deja marcado ejecutable", () => {
    const html = renderLedgerOverview(data(), { spaceId: "casa", userId: "u1" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Pablo</b>");
    expect(html).toContain("&lt;b&gt;Pablo&lt;/b&gt;");
  });

  it("no usa estilos en línea, que la CSP bloquea", () => {
    const html = renderLedgerOverview(data(), { spaceId: "casa", userId: "u1" }) + renderBookHead({ slug: "casa", name: "Casa" }, data(), "u1");
    expect(html).not.toMatch(/\sstyle=/u);
  });

  it("muestra el saldo propio, la palabra del saldo, la suma cero y el efecto propio", () => {
    const html = renderLedgerOverview(data(), { spaceId: "casa", userId: "u1" });
    expect(html).toContain("Le deben COP 50,00");
    expect(html).toContain("Debe COP 50,00");
    expect(html).toContain("Suman 0");
    expect(html).toContain("Tu saldo · COP");
    expect(html).toContain("Te corresponde recibir.");
    expect(html).toContain("Tu efecto +COP 50,00");
  });

  it("el saldo negativo propio usa la tarjeta roja y la frase correspondiente", () => {
    const html = renderLedgerOverview(data(), { spaceId: "casa", userId: "u-otro" });
    expect(html).toContain("Estás a mano.");
    const negative = { ...data(), participants: [{ ...participants[0], linkedUserId: "u9" }, { ...participants[1], linkedUserId: "u1" }] };
    const rendered = renderLedgerOverview(negative, { spaceId: "casa", userId: "u1" });
    expect(rendered).toContain('class="hero neg"');
    expect(rendered).toContain("Te toca aportar.");
  });

  it("separa las monedas en bloques propios", () => {
    const multi = data();
    multi.balances.push({ currency: "USD", participantId: "p1", amountMinor: -4000 }, { currency: "USD", participantId: "p2", amountMinor: 4000 });
    const html = renderLedgerOverview(multi, { spaceId: "casa", userId: "u1" });
    expect(html).toContain("Saldos del grupo · COP");
    expect(html).toContain("Saldos del grupo · USD");
  });

  it("rotula anulados e importados una sola vez y cuenta resultados", () => {
    const voided = entry({ id: "e2", status: "voided", description: "Cena" });
    const imported = { ...entry({ id: "e3", description: "Taxi" }), type: "imported", imported: true, sourceRowNumber: 7, cashParties: [], allocations: [] };
    const html = renderLedgerOverview(data([entry(), voided, imported]), { spaceId: "casa", userId: "u1" });
    expect(html).toContain("2 vigentes · 1 anulado");
    expect(html.match(/Importado de Splitwise/gu)).toHaveLength(1);
    expect(html).toContain("No cuenta en los saldos");
    const filtered = renderLedgerOverview(data([entry(), voided, imported]), { spaceId: "casa", userId: "u1", query: "taxi" });
    expect(filtered).toContain("1 de 3 movimientos");
    expect(filtered).toContain("Quitar búsqueda");
  });

  it("muestra un estado vacío con la acción disponible según el rol", () => {
    const owner = renderLedgerOverview(data([]), { spaceId: "casa", userId: "u1" });
    expect(owner).toContain("Todavía no hay movimientos.");
    expect(owner).toContain("Importar Splitwise");
    const member = renderLedgerOverview({ ...data([]), ledger: { default_currency: "COP", role: "member" } }, { spaceId: "casa", userId: "u1" });
    expect(member).not.toContain("Importar Splitwise");
  });
});

describe("libro: personas", () => {
  const members = [{ user_id: "u1", display_name: "Pablo", role: "owner" }];
  const invitations = [{ id: "i1", invitee_email: "laura@example.test", target_participant_id: "p2" }];
  const base = { data: data(), space: { slug: "casa", name: "Casa" }, members, csrf: '<input type="hidden" name="_csrf" value="t">', userId: "u1" };

  it("distingue propietario, invitación pendiente y sin cuenta, y ofrece cancelar sólo al titular", () => {
    const owner = renderPeople({ ...base, invitations, owner: true });
    expect(owner).toContain("Propietario");
    expect(owner).toContain("Invitación pendiente");
    expect(owner).toContain("laura@example.test");
    expect(owner).toContain("Cancelar invitación");
    expect(owner).toContain('name="_csrf"');
    expect(owner).toContain("Administrar grupo");
    const member = renderPeople({ ...base, invitations: [], owner: false });
    expect(member).not.toContain("Administrar grupo");
    expect(member).not.toContain("Cancelar invitación");
    expect(member).toContain("Sin cuenta");
  });

  it("conserva los nombres de campos de administración", () => {
    const html = renderPeople({ ...base, invitations: [], owner: true });
    for (const field of ['name="name"', 'name="email"', 'name="targetParticipantId"']) expect(html).toContain(field);
    expect(html).toContain("/spaces/casa/participants");
    expect(html).toContain("/spaces/casa/invitations");
    expect(html).toContain("/spaces/casa/rename");
  });
});
