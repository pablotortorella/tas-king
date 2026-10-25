import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { addParticipant, readLedger, saveEntry } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSpaceForUser, ensureLocalUser } from "../src/spaces.js";

const SECRET = "s".repeat(32);

async function book(name) {
  const owner = await ensureLocalUser(env.DB, `${name}@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.id, name });
  await addParticipant(env.DB, { spaceId: space.id, userId: owner.id, name: "Beto" });
  await addParticipant(env.DB, { spaceId: space.id, userId: owner.id, name: "Carla" });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
  return { owner, space, people: data.participants, order: data.participants.map(person => person.id) };
}
const entry = (people, overrides = {}) => ({
  type: "expense", currency: "COP", totalMinor: 10000, description: "Cena", note: "", occurredAt: "2026-10-24",
  cashParties: [{ participantId: people[0].id, direction: "out", amountMinor: 10000 }], allocations: [],
  split: { method: "equal", beneficiaries: people.map(person => person.id), inputs: {} }, ...overrides,
});
const allocationsOf = async (ledgerId, entryId) => Object.fromEntries((await env.DB.prepare("SELECT participant_id, amount_minor FROM entry_allocations WHERE ledger_id = ? AND entry_id = ?").bind(ledgerId, entryId).all()).results.map(row => [row.participant_id, row.amount_minor]));

describe("reparto en el servidor", () => {
  it("calcula las asignaciones con el método elegido y guarda el método en la revisión", async () => {
    const { owner, space, people } = await book("reparto-porcentajes");
    const ids = people.map(person => person.id);
    const split = { method: "percent", beneficiaries: [...ids].reverse(), inputs: { [ids[0]]: "50", [ids[1]]: "30", [ids[2]]: "20" } };
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people, { split }), idempotencyKey: crypto.randomUUID() });
    const ledgerId = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).ledger.id;
    expect(await allocationsOf(ledgerId, saved.id)).toEqual({ [ids[0]]: 5000, [ids[1]]: 3000, [ids[2]]: 2000 });
    const revision = await env.DB.prepare("SELECT snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? AND revision = 1").bind(ledgerId, saved.id).first();
    expect(JSON.parse(revision.snapshot_json).split).toEqual({ method: "percent", beneficiaries: ids, inputs: split.inputs });
  });

  it("ignora los importes calculados por el cliente", async () => {
    const { owner, space, people } = await book("reparto-manipulado");
    const ids = people.map(person => person.id);
    const forged = [{ participantId: ids[0], amountMinor: 9999 }, { participantId: ids[1], amountMinor: 1 }];
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people, { allocations: forged }), idempotencyKey: crypto.randomUUID() });
    const ledgerId = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).ledger.id;
    expect(await allocationsOf(ledgerId, saved.id)).toEqual({ [ids[0]]: 3334, [ids[1]]: 3333, [ids[2]]: 3333 });
  });

  it("asigna el residuo según el orden del grupo y no según el orden recibido ni el de los identificadores", async () => {
    const created = await book("reparto-residuo");
    const { owner, space } = created;
    // Se fuerza un orden de incorporación distinto del orden alfabético de los identificadores.
    const byId = [...created.people].sort((a, b) => b.id.localeCompare(a.id));
    for (const [index, person] of byId.entries()) await env.DB.prepare("UPDATE ledger_participants SET created_at = ? WHERE id = ?").bind(`2026-01-01 00:00:0${index}`, person.id).run();
    const people = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants;
    const order = people.map(person => person.id);
    expect(order).toEqual(byId.map(person => person.id));
    const reversed = { method: "equal", beneficiaries: [...order].reverse(), inputs: {} };
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people, { totalMinor: 10001, cashParties: [{ participantId: order[0], direction: "out", amountMinor: 10001 }], split: reversed }), idempotencyKey: crypto.randomUUID() });
    const ledgerId = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).ledger.id;
    expect(await allocationsOf(ledgerId, saved.id)).toEqual({ [order[0]]: 3334, [order[1]]: 3334, [order[2]]: 3333 });
  });

  it("rechaza un reparto inválido con el motivo y no guarda nada", async () => {
    const { owner, space, people } = await book("reparto-invalido");
    const ids = people.map(person => person.id);
    const split = { method: "percent", beneficiaries: ids, inputs: { [ids[0]]: "50", [ids[1]]: "30", [ids[2]]: "19" } };
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people, { split }), idempotencyKey: crypto.randomUUID() })).rejects.toThrow("99,00 %");
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = (SELECT id FROM expense_ledgers WHERE space_id = ?)").bind(space.id).first();
    expect(count.n).toBe(0);
    const foreign = { method: "equal", beneficiaries: ["participant_ajeno"], inputs: {} };
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people, { split: foreign }), idempotencyKey: crypto.randomUUID() })).rejects.toThrow();
  });

  it("repetir la misma clave devuelve la respuesta original y otra clave con otro método es otra operación", async () => {
    const { owner, space, people } = await book("reparto-idempotencia");
    const key = crypto.randomUUID();
    const first = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people), idempotencyKey: key });
    const again = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: entry(people), idempotencyKey: key });
    expect(again).toEqual(first);
    const ids = people.map(person => person.id);
    const different = entry(people, { split: { method: "shares", beneficiaries: ids, inputs: { [ids[0]]: "1", [ids[1]]: "1", [ids[2]]: "1" } } });
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: different, idempotencyKey: key })).rejects.toMatchObject({ status: 409 });
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = (SELECT id FROM expense_ledgers WHERE space_id = ?)").bind(space.id).first();
    expect(count.n).toBe(1);
  });

  it("el historial indica que cambió la forma de reparto aunque los importes no cambien", async () => {
    const { owner, space, people } = await book("reparto-historial");
    const ids = people.map(person => person.id);
    const two = [ids[0], ids[1]];
    const equal = entry(people, { split: { method: "equal", beneficiaries: two, inputs: {} } });
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: equal, idempotencyKey: crypto.randomUUID() });
    const percent = entry(people, { split: { method: "percent", beneficiaries: two, inputs: { [ids[0]]: "50", [ids[1]]: "50" } } });
    await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: saved.id, expectedRevision: 1, input: percent, idempotencyKey: crypto.randomUUID() });
    const session = await createSession(env.DB, { userId: owner.id, secret: SECRET });
    const cookie = `__Host-homesuite_session=${encodeURIComponent(session.token)}`;
    await createCsrfToken({ sessionId: session.id, secret: SECRET });
    const page = await app.request(`https://app.test/spaces/${space.slug}/ledger/entries/${saved.id}`, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: SECRET });
    const html = await page.text();
    expect(html).toContain("Cambió: forma de reparto");
    expect(html).not.toContain("Sin cambios de contenido");
  });

  it("una llamada con asignaciones ya resueltas, sin método, conserva el comportamiento anterior", async () => {
    const { owner, space, people } = await book("reparto-compatibilidad");
    const ids = people.map(person => person.id);
    const legacy = { type: "expense", currency: "COP", totalMinor: 10000, description: "Antiguo", note: "", occurredAt: "2026-10-24",
      cashParties: [{ participantId: ids[0], direction: "out", amountMinor: 10000 }],
      allocations: [{ participantId: ids[0], amountMinor: 6000 }, { participantId: ids[1], amountMinor: 4000 }] };
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: legacy, idempotencyKey: crypto.randomUUID() });
    const ledgerId = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).ledger.id;
    expect(await allocationsOf(ledgerId, saved.id)).toEqual({ [ids[0]]: 6000, [ids[1]]: 4000 });
    const revision = await env.DB.prepare("SELECT snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ?").bind(ledgerId, saved.id).first();
    expect(JSON.parse(revision.snapshot_json).split).toBeUndefined();
  });
});
