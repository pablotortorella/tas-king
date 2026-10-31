import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { addParticipant, exportLedger, readLedger, saveEntry, voidEntry } from "../src/ledger.js";
import { classifyOne } from "../src/recategorize.js";
import { revisionSummary } from "../src/ledger-ui.js";
import { createGroupForUser, ensureLocalUser } from "../src/groups.js";

async function book(name) {
  const owner = await ensureLocalUser(env.DB, `${name}@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.id, name });
  await addParticipant(env.DB, { groupId: group.id, userId: owner.id, name: "Beto" });
  const data = await readLedger(env.DB, { groupId: group.id, userId: owner.id });
  return { owner, group, ledger: data.ledger, people: data.participants, categories: data.categories };
}
const entry = (people, extra = {}) => ({
  type: "expense", currency: "COP", totalMinor: 10000, description: "Cena", note: "", occurredAt: "2026-10-24",
  cashParties: [{ participantId: people[0].id, direction: "out", amountMinor: 10000 }], allocations: [],
  split: { method: "equal", beneficiaries: people.map(person => person.id), inputs: {} }, ...extra,
});
const save = (b, input, extra = {}) => saveEntry(env.DB, { groupId: b.group.id, userId: b.owner.id, input, idempotencyKey: crypto.randomUUID(), ...extra });
const column = (b, id) => env.DB.prepare("SELECT payment_method FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(b.ledger.id, id).first().then(row => row.payment_method);
const snapshot = async (b, id, revision) => JSON.parse((await env.DB.prepare("SELECT snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? AND revision = ?").bind(b.ledger.id, id, revision).first()).snapshot_json);
const reread = b => readLedger(env.DB, { groupId: b.group.id, userId: b.owner.id });

describe("forma de pago en los movimientos", () => {
  it("elegirla la guarda, la lee y la deja en la instantánea", async () => {
    const b = await book("fp-elegir");
    const saved = await save(b, entry(b.people, { paymentMethod: "credit" }));
    expect(await column(b, saved.id)).toBe("credit");
    expect(await snapshot(b, saved.id, 1)).toMatchObject({ paymentMethod: "credit" });
    expect((await reread(b)).entries.find(item => item.id === saved.id).paymentMethod).toBe("credit");
  });

  it("sin indicar queda en null, tanto con el campo vacío como sin el campo", async () => {
    const b = await book("fp-sin");
    const empty = await save(b, entry(b.people, { paymentMethod: "" }));
    const missing = await save(b, entry(b.people));
    expect(await column(b, empty.id)).toBeNull();
    expect(await column(b, missing.id)).toBeNull();
    expect(await snapshot(b, missing.id, 1)).toMatchObject({ paymentMethod: null });
  });

  it("un valor que no es de la lista se rechaza y no guarda nada", async () => {
    const b = await book("fp-invalida");
    await expect(save(b, entry(b.people, { paymentMethod: "cheque" }))).rejects.toThrow("forma de pago");
    expect((await reread(b)).entries).toHaveLength(0);
  });

  it("la base también rechaza un valor fuera de la lista", async () => {
    const b = await book("fp-check");
    const saved = await save(b, entry(b.people));
    await expect(env.DB.prepare("UPDATE ledger_entries SET payment_method = 'cheque' WHERE ledger_id = ? AND id = ?").bind(b.ledger.id, saved.id).run()).rejects.toThrow();
  });

  it("una transferencia no lleva forma de pago aunque llegue en la solicitud", async () => {
    const b = await book("fp-transferencia");
    const saved = await save(b, entry(b.people, {
      type: "transfer", paymentMethod: "cash",
      cashParties: [{ participantId: b.people[0].id, direction: "out", amountMinor: 10000 }, { participantId: b.people[1].id, direction: "in", amountMinor: 10000 }],
      allocations: [], split: undefined,
    }));
    expect(await column(b, saved.id)).toBeNull();
  });

  it("corregir sin el campo la conserva; con el campo la cambia o la quita, y cada cambio es una revisión", async () => {
    const b = await book("fp-corregir");
    const created = await save(b, entry(b.people, { paymentMethod: "cash" }));
    const kept = await save(b, entry(b.people, { description: "Cena con vino" }), { entryId: created.id, expectedRevision: 1 });
    expect(await column(b, created.id)).toBe("cash");
    expect(await snapshot(b, created.id, 2)).toMatchObject({ paymentMethod: "cash" });
    expect(kept.revision).toBe(2);
    await save(b, entry(b.people, { description: "Cena con vino", paymentMethod: "wallet" }), { entryId: created.id, expectedRevision: 2 });
    expect(await column(b, created.id)).toBe("wallet");
    await save(b, entry(b.people, { description: "Cena con vino", paymentMethod: "" }), { entryId: created.id, expectedRevision: 3 });
    expect(await column(b, created.id)).toBeNull();
    const [r2, r3, r4] = await Promise.all([2, 3, 4].map(revision => env.DB.prepare("SELECT revision, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? AND revision = ?").bind(b.ledger.id, created.id, revision).first()));
    expect(revisionSummary(r2, { snapshot_json: JSON.stringify(await snapshot(b, created.id, 1)) })).toBe("Cambió: descripción");
    expect(revisionSummary(r3, r2)).toBe("Cambió: forma de pago");
    expect(revisionSummary(r4, r3)).toBe("Cambió: forma de pago");
  });

  it("anular conserva la forma de pago en el libro", async () => {
    const b = await book("fp-anular");
    const saved = await save(b, entry(b.people, { paymentMethod: "debit" }));
    await voidEntry(env.DB, { groupId: b.group.id, userId: b.owner.id, entryId: saved.id, expectedRevision: 1, idempotencyKey: crypto.randomUUID() });
    expect(await column(b, saved.id)).toBe("debit");
  });

  it("cambiar la categoría en bloque no pierde la forma de pago", async () => {
    const b = await book("fp-recategorizar");
    const saved = await save(b, entry(b.people, { paymentMethod: "transfer" }));
    const taxi = b.categories.find(category => category.name === "Taxi");
    await classifyOne(env.DB, { groupId: b.group.id, userId: b.owner.id, entryId: saved.id, categoryId: taxi.id, key: crypto.randomUUID() });
    expect(await column(b, saved.id)).toBe("transfer");
    expect(await snapshot(b, saved.id, 2)).toMatchObject({ paymentMethod: "transfer", categoryId: taxi.id });
  });

  it("la exportación JSON incluye la forma de pago de cada movimiento", async () => {
    const b = await book("fp-exportar");
    await save(b, entry(b.people, { paymentMethod: "wallet" }));
    const exported = await exportLedger(env.DB, { groupId: b.group.id, userId: b.owner.id });
    expect(exported.entries.map(item => item.paymentMethod)).toEqual(["wallet"]);
  });
});
