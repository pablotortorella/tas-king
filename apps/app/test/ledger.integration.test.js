import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { addParticipant, exportLedger, readLedger, saveEntry, voidEntry } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createCsrfToken } from "../src/csrf.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";

function draft(type, totalMinor, a, b, overrides = {}) {
  return { type, currency: "COP", totalMinor, description: "Cuenta de prueba", note: "", occurredAt: "2026-10-23",
    cashParties: type === "transfer"
      ? [{ participantId: b, direction: "out", amountMinor: totalMinor }, { participantId: a, direction: "in", amountMinor: totalMinor }]
      : [{ participantId: type === "expense" ? a : b, direction: type === "expense" ? "out" : "in", amountMinor: totalMinor }],
    allocations: type === "transfer" ? [] : [{ participantId: a, amountMinor: totalMinor / 2 }, { participantId: b, amountMinor: totalMinor / 2 }],
    ...overrides };
}

describe("libro financiero compartido", () => {
  it("separa saldos en monedas sudamericanas y MXN sin conversión", async () => {
    const owner = await ensureLocalUser(env.DB, "ledger-currencies@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Monedas", defaultCurrency: "CLP" });
    const member = await addParticipant(env.DB, { spaceId: space.id, userId: owner.id, name: "Beto" });
    const ownId = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants.find(p => p.linkedUserId === owner.id).id;
    await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: draft("expense", 1000, ownId, member.id, { currency: "CLP" }), idempotencyKey: crypto.randomUUID() });
    await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: draft("expense", 2500, ownId, member.id, { currency: "MXN" }), idempotencyKey: crypto.randomUUID() });
    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(data.ledger.default_currency).toBe("CLP");
    expect(data.balances).toHaveLength(4);
    expect(data.balances).toEqual(expect.arrayContaining([
      { currency: "CLP", participantId: ownId, amountMinor: 500 },
      { currency: "CLP", participantId: member.id, amountMinor: -500 },
      { currency: "MXN", participantId: ownId, amountMinor: 1250 },
      { currency: "MXN", participantId: member.id, amountMinor: -1250 },
    ]));
  });

  it("crea libro y participantes, y vincula una invitación sin mover saldos", async () => {
    const owner = await ensureLocalUser(env.DB, "ledger-owner@example.test");
    const invited = await ensureLocalUser(env.DB, "ledger-invited@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Casa", defaultCurrency: "USD" });
    const participant = await addParticipant(env.DB, { spaceId: space.id, userId: owner.id, name: "Invitada" });
    const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: invited.email, targetParticipantId: participant.id });
    await resolveInvitation(env.DB, { invitationId: invitation.id, userId: invited.id, email: invited.email, accepted: true });
    const data = await readLedger(env.DB, { spaceId: space.id, userId: invited.id });
    expect(data.ledger.default_currency).toBe("USD");
    expect(data.participants).toHaveLength(2);
    expect(data.participants.find(p => p.id === participant.id).linkedUserId).toBe(invited.id);
    expect(data.balances).toEqual([]);
  });

  it("registra gasto, ingreso y transferencia; corrige y anula con historia", async () => {
    const owner = await ensureLocalUser(env.DB, "ledger-a@example.test");
    const member = await ensureLocalUser(env.DB, "ledger-b@example.test");
    const outsider = await ensureLocalUser(env.DB, "ledger-outside@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Viaje" });
    const invited = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
    await resolveInvitation(env.DB, { invitationId: invited.id, userId: member.id, email: member.email, accepted: true });
    const people = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants;
    const a = people.find(p => p.linkedUserId === owner.id).id;
    const b = people.find(p => p.linkedUserId === member.id).id;
    const expenseInput = draft("expense", 10000, a, b);
    const expense = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: expenseInput, idempotencyKey: crypto.randomUUID() });
    const replayKey = crypto.randomUUID();
    const incomeInput = draft("income", 2000, a, b);
    const income = await saveEntry(env.DB, { spaceId: space.id, userId: member.id, input: incomeInput, idempotencyKey: replayKey });
    expect(await saveEntry(env.DB, { spaceId: space.id, userId: member.id, input: incomeInput, idempotencyKey: replayKey })).toEqual(income);
    await saveEntry(env.DB, { spaceId: space.id, userId: member.id, input: draft("transfer", 6000, a, b), idempotencyKey: crypto.randomUUID() });
    const before = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(before.balances.map(row => row.amountMinor)).toEqual([0, 0]);
    await expect(readLedger(env.DB, { spaceId: space.id, userId: outsider.id })).rejects.toMatchObject({ status: 404 });
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: member.id, entryId: expense.id, expectedRevision: 1, input: expenseInput, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ status: 403 });
    const correction = draft("expense", 12000, a, b);
    const correctionKey = crypto.randomUUID();
    const revised = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: expense.id, expectedRevision: 1, input: correction, idempotencyKey: correctionKey });
    expect(revised.revision).toBe(2);
    expect(await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: expense.id, expectedRevision: 1, input: correction, idempotencyKey: correctionKey })).toEqual(revised);
    const corrected = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(corrected.balances.find(row => row.participantId === a).amountMinor).toBe(1000);
    expect(corrected.balances.find(row => row.participantId === b).amountMinor).toBe(-1000);
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: expense.id, expectedRevision: 1, input: correction, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ status: 409 });
    const voidKey = crypto.randomUUID();
    const voided = await voidEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: expense.id, expectedRevision: 2, idempotencyKey: voidKey, reason: "Duplicado" });
    expect(await voidEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: expense.id, expectedRevision: 2, idempotencyKey: voidKey, reason: "Duplicado" })).toEqual(voided);
    const after = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(after.entries.find(entry => entry.id === expense.id).status).toBe("voided");
    expect(after.balances.find(row => row.participantId === a).amountMinor).toBe(-5000);
    expect(after.balances.find(row => row.participantId === b).amountMinor).toBe(5000);
    const exported = await exportLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(exported.entries).toHaveLength(3);
    expect(exported.revisions.filter(row => row.entry_id === expense.id).map(row => row.action)).toEqual(["created", "revised", "voided"]);
    expect(exported.events.some(row => row.action === "entry_voided")).toBe(true);
  });

  it("resuelve dos correcciones simultáneas sin perder una revisión", async () => {
    const owner = await ensureLocalUser(env.DB, "ledger-race@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Concurrencia" });
    const second = await addParticipant(env.DB, { spaceId: space.id, userId: owner.id, name: "Otra" });
    const first = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants.find(p => p.linkedUserId === owner.id).id;
    const original = await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: draft("expense", 10000, first, second.id), idempotencyKey: crypto.randomUUID() });
    const attempts = await Promise.allSettled([12000, 14000].map(totalMinor => saveEntry(env.DB, { spaceId: space.id, userId: owner.id, entryId: original.id, expectedRevision: 1, input: draft("expense", totalMinor, first, second.id), idempotencyKey: crypto.randomUUID() })));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(attempts.find(result => result.status === "rejected").reason).toMatchObject({ status: 409 });
    const data = await exportLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(data.revisions.filter(row => row.entry_id === original.id)).toHaveLength(2);
    expect(data.entries.find(entry => entry.id === original.id).revision).toBe(2);
  });

  it("protege formularios y expone exportaciones sólo a integrantes", async () => {
    const owner = await ensureLocalUser(env.DB, "ledger-web@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Web" });
    const secret = "w".repeat(32);
    const session = await createSession(env.DB, { userId: owner.id, secret });
    const cookie = `__Host-homesuite_session=${encodeURIComponent(session.token)}`;
    const csrf = await createCsrfToken({ sessionId: session.id, secret });
    const url = `https://app.test/spaces/${space.id}/ledger/new`;
    const page = await app.request(url, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: secret });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Agregar gasto");
    const denied = await app.request(`https://app.test/spaces/${space.id}/participants`, { method: "POST", headers: { Cookie: cookie, Origin: "https://app.test", "Content-Type": "application/x-www-form-urlencoded" }, body: "name=No" }, { DB: env.DB, SESSION_SECRET: secret });
    expect(denied.status).toBe(403);
    const created = await app.request(`https://app.test/spaces/${space.id}/participants`, { method: "POST", headers: { Cookie: cookie, Origin: "https://app.test", "X-CSRF-Token": csrf, "Content-Type": "application/x-www-form-urlencoded" }, body: "name=Otra" }, { DB: env.DB, SESSION_SECRET: secret });
    expect(created.status).toBe(303);
    const response = await app.request(`https://app.test/spaces/${space.id}/ledger/export.json`, { headers: { Cookie: cookie } }, { DB: env.DB, SESSION_SECRET: secret });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).participants).toHaveLength(2);
    const anonymous = await app.request(`https://app.test/spaces/${space.id}/ledger/export.json`, undefined, { DB: env.DB, SESSION_SECRET: secret });
    expect(anonymous.status).toBe(303);
  });
});
