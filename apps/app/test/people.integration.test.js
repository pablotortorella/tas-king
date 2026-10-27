import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { addParticipant, exportLedger, readLedger, saveEntry, voidEntry } from "../src/ledger.js";
import { setLedgerArchived } from "../src/ledger-admin.js";
import { applyMerge, previewMerge, readMerges, renamePerson } from "../src/people.js";
import { createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation } from "../src/groups.js";
import { seedEntries } from "./fixtures/seed-entries.js";

async function team(name) {
  const owner = await ensureLocalUser(env.DB, `${name}-owner@example.test`);
  const member = await ensureLocalUser(env.DB, `${name}-member@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.id, name });
  const invitation = await inviteToGroup(env.DB, { groupId: group.id, inviterUserId: owner.id, email: member.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
  const ana = await addParticipant(env.DB, { groupId: group.id, userId: owner.id, name: "Ana" });
  const beto = await addParticipant(env.DB, { groupId: group.id, userId: owner.id, name: "Beto" });
  const caro = await addParticipant(env.DB, { groupId: group.id, userId: owner.id, name: "Caro" });
  const data = await readLedger(env.DB, { groupId: group.id, userId: owner.id });
  return { owner, member, group, ledger: data.ledger, ownerId: data.participants.find(p => p.linkedUserId === owner.id).id, memberId: data.participants.find(p => p.linkedUserId === member.id).id, ana: ana.id, beto: beto.id, caro: caro.id };
}
const as = (t, user = t.owner) => ({ groupId: t.group.id, userId: user.id });
const view = (t, user) => readLedger(env.DB, as(t, user));
const key = () => crypto.randomUUID();
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const cash = (participantId, amountMinor, direction = "out") => ({ participantId, direction, amountMinor });
const share = (participantId, amountMinor) => ({ participantId, amountMinor });
const expense = (t, { paid, shared, total = paid.reduce((sum, part) => sum + part.amountMinor, 0), description = "Compra", ...extra }) => saveEntry(env.DB, { ...as(t), idempotencyKey: key(), input: { type: "expense", currency: "COP", totalMinor: total, description, note: "", occurredAt: "2026-06-01", cashParties: paid, allocations: shared, ...extra } });
const transfer = (t, from, to, total = 3000) => saveEntry(env.DB, { ...as(t), idempotencyKey: key(), input: { type: "transfer", currency: "COP", totalMinor: total, description: "Pasó plata", note: "", occurredAt: "2026-06-02", cashParties: [cash(from, total), cash(to, total, "in")], allocations: [] } });
const merge = (t, sourceId, targetId, extra = {}) => applyMerge(env.DB, { ...as(t), sourceId, targetId, key: key(), ...extra });
const balanceOf = (data, id, currency = "COP") => data.balances.find(row => row.participantId === id && row.currency === currency)?.amountMinor ?? 0;
const entryByDescription = (data, description) => data.entries.find(entry => entry.description === description);
const latest = async (t, entryId) => JSON.parse((await env.DB.prepare("SELECT r.snapshot_json FROM entry_revisions r JOIN ledger_entries e ON e.ledger_id = r.ledger_id AND e.id = r.entry_id AND e.current_revision = r.revision WHERE r.ledger_id = ? AND r.entry_id = ?").bind(t.ledger.id, entryId).first()).snapshot_json);

describe("modelo de datos", () => {
  it("la unión de una persona se registra una sola vez y no puede ser consigo misma", async () => {
    const t = await team("pm-modelo");
    await env.DB.prepare("INSERT INTO person_merges (ledger_id, id, actor_user_id, source_id, target_id) VALUES (?, 'merge_a_0000000000000000', ?, ?, ?)").bind(t.ledger.id, t.owner.id, t.ana, t.beto).run();
    await expect(env.DB.prepare("INSERT INTO person_merges (ledger_id, id, actor_user_id, source_id, target_id) VALUES (?, 'merge_b_0000000000000000', ?, ?, ?)").bind(t.ledger.id, t.owner.id, t.ana, t.caro).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO person_merges (ledger_id, id, actor_user_id, source_id, target_id) VALUES (?, 'merge_c_0000000000000000', ?, ?, ?)").bind(t.ledger.id, t.owner.id, t.caro, t.caro).run()).rejects.toThrow();
  });
});

describe("renombrar", () => {
  it("cambia el nombre en los saldos y deja un evento", async () => {
    const t = await team("pm-renombrar");
    const before = (await view(t)).ledger.revision;
    expect(await renamePerson(env.DB, { ...as(t), personId: t.ana, name: "  Ana María " })).toEqual({ id: t.ana, displayName: "Ana María", changed: true });
    const data = await view(t);
    expect(data.participants.find(p => p.id === t.ana).displayName).toBe("Ana María");
    expect(data.ledger.revision).toBe(before + 1);
    const event = await env.DB.prepare("SELECT action, entity_id, metadata_json FROM ledger_events WHERE ledger_id = ? AND action = 'participant_renamed'").bind(t.ledger.id).first();
    expect(event).toMatchObject({ entity_id: t.ana });
    expect(JSON.parse(event.metadata_json)).toEqual({ from: "Ana", to: "Ana María" });
  });

  it("rechaza un nombre repetido sin distinguir mayúsculas ni tildes, vacío o largo", async () => {
    const t = await team("pm-nombre-repetido");
    await addParticipant(env.DB, { ...as(t), name: "José" });
    await expect(renamePerson(env.DB, { ...as(t), personId: t.ana, name: "JOSE" })).rejects.toThrow(/ya hay una persona/iu);
    await expect(renamePerson(env.DB, { ...as(t), personId: t.ana, name: "  " })).rejects.toThrow();
    await expect(renamePerson(env.DB, { ...as(t), personId: t.ana, name: "x".repeat(121) })).rejects.toThrow();
  });

  it("dejar el mismo nombre no escribe nada y se puede cambiar la capitalización de la propia persona", async () => {
    const t = await team("pm-mismo-nombre");
    const before = (await view(t)).ledger.revision;
    expect(await renamePerson(env.DB, { ...as(t), personId: t.ana, name: "Ana" })).toMatchObject({ changed: false });
    expect(await renamePerson(env.DB, { ...as(t), personId: t.ana, name: "ANA" })).toMatchObject({ changed: true });
    expect((await view(t)).ledger.revision).toBe(before + 1);
  });

  it("solo la persona titular puede renombrar, no en un grupo archivado y no a quien no existe", async () => {
    const t = await team("pm-renombrar-permisos");
    await expect(renamePerson(env.DB, { ...as(t, t.member), personId: t.ana, name: "Otra" })).rejects.toMatchObject({ status: 403 });
    await expect(renamePerson(env.DB, { ...as(t), personId: "participant_inexistente", name: "Otra" })).rejects.toMatchObject({ status: 404 });
    await setLedgerArchived(env.DB, { ...as(t), archived: true });
    await expect(renamePerson(env.DB, { ...as(t), personId: t.ana, name: "Otra" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("vista previa", () => {
  it("cuenta lo que cambiaría y no escribe nada", async () => {
    const t = await team("pm-preview");
    await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 5000), share(t.caro, 5000)], description: "Uno" });
    await expense(t, { paid: [cash(t.caro, 6000)], shared: [share(t.ana, 3000), share(t.caro, 3000)], description: "Dos" });
    await expense(t, { paid: [cash(t.caro, 4000)], shared: [share(t.beto, 4000)], description: "No toca a Ana" });
    await transfer(t, t.ana, t.beto);
    const data = await view(t);
    const revision = data.ledger.revision;
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto });
    expect(preview).toMatchObject({ revise: 2, voided: 1, accountMoves: false, source: { name: "Ana", linked: false }, target: { name: "Beto", linked: false }, ledgerRevision: revision });
    expect(preview.sample.map(row => row.description).sort()).toEqual(["Dos", "Uno"]);
    expect(preview.voidedSample.map(row => row.description)).toEqual(["Pasó plata"]);
    const cop = preview.balances.find(row => row.currency === "COP");
    expect(cop).toEqual({ currency: "COP", source: balanceOf(data, t.ana), target: balanceOf(data, t.beto), after: balanceOf(data, t.ana) + balanceOf(data, t.beto) });
    expect((await view(t)).ledger.revision).toBe(revision);
    expect(await count("SELECT COUNT(*) AS n FROM person_merges WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  });

  it("rechaza personas iguales, de otro grupo, ya unidas, sin permiso y con dos cuentas", async () => {
    const t = await team("pm-preview-rechazos");
    const other = await team("pm-preview-otro");
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.ana })).rejects.toThrow(/distintas/iu);
    await expect(previewMerge(env.DB, { ...as(t), sourceId: "", targetId: t.ana })).rejects.toThrow(/Elegí/u);
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: other.ana })).rejects.toMatchObject({ status: 404 });
    await expect(previewMerge(env.DB, { ...as(t, t.member), sourceId: t.ana, targetId: t.beto })).rejects.toMatchObject({ status: 403 });
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.ownerId, targetId: t.memberId })).rejects.toThrow(/cuentas distintas/iu);
    await merge(t, t.ana, t.beto);
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.caro })).rejects.toThrow(/ya fue unida/iu);
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.caro, targetId: t.ana })).rejects.toThrow(/ya fue unida/iu);
    await setLedgerArchived(env.DB, { ...as(t), archived: true });
    await expect(previewMerge(env.DB, { ...as(t), sourceId: t.caro, targetId: t.beto })).rejects.toMatchObject({ status: 409 });
  });
});

describe("unir personas", () => {
  it("todos los movimientos pasan a la destinataria, el saldo suma y el total del grupo no cambia", async () => {
    const t = await team("pm-unir");
    await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 4000), share(t.caro, 6000)], description: "A" });
    await expense(t, { paid: [cash(t.caro, 9000)], shared: [share(t.ana, 3000), share(t.beto, 3000), share(t.caro, 3000)], description: "B" });
    await saveEntry(env.DB, { ...as(t), idempotencyKey: key(), input: { type: "income", currency: "COP", totalMinor: 2000, description: "Ingreso", note: "", occurredAt: "2026-06-03", cashParties: [{ participantId: t.caro, direction: "in", amountMinor: 2000 }], allocations: [share(t.ana, 2000)] } });
    const before = await view(t);
    const result = await merge(t, t.ana, t.beto);
    expect(result).toMatchObject({ status: "applied", planned: 3, changed: 3, voided: 0, sourceId: t.ana, targetId: t.beto });
    const after = await view(t);
    expect(after.participants.map(p => p.id)).not.toContain(t.ana);
    expect(after.mergedParticipants).toEqual([expect.objectContaining({ id: t.ana, displayName: "Ana", mergedIntoId: t.beto })]);
    expect(balanceOf(after, t.beto)).toBe(balanceOf(before, t.ana) + balanceOf(before, t.beto));
    expect(balanceOf(after, t.ana)).toBe(0);
    expect(after.balances.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(0);
    for (const row of after.entries) {
      expect(row.cashParties.every(part => part.participantId !== t.ana)).toBe(true);
      expect(row.allocations.every(part => part.participantId !== t.ana)).toBe(true);
    }
    expect(await count("SELECT COUNT(*) AS n FROM entry_cash_parties WHERE ledger_id = ? AND participant_id = ?", t.ledger.id, t.ana)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM entry_allocations WHERE ledger_id = ? AND participant_id = ?", t.ledger.id, t.ana)).toBe(0);
    expect(await readMerges(env.DB, t.ledger.id)).toEqual([expect.objectContaining({ sourceId: t.ana, targetId: t.beto, changed: 3, voided: 0 })]);
  });

  it("si las dos participaban del mismo movimiento, quedan como una por el total", async () => {
    const t = await team("pm-misma-entrada");
    const saved = await expense(t, { paid: [cash(t.ana, 6000), cash(t.beto, 4000)], shared: [share(t.ana, 5000), share(t.beto, 5000)], description: "Cena" });
    await merge(t, t.ana, t.beto);
    const entry = entryByDescription(await view(t), "Cena");
    expect(entry.cashParties).toEqual([{ participantId: t.beto, direction: "out", amountMinor: 10000 }]);
    expect(entry.allocations).toEqual([{ participantId: t.beto, amountMinor: 10000 }]);
    expect(entry.revision).toBe(2);
    const snapshot = await latest(t, saved.id);
    expect(snapshot.cashParties).toEqual(entry.cashParties);
    expect(snapshot.personMerge).toMatch(/^merge_/u);
    const revisions = (await env.DB.prepare("SELECT revision, action FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(t.ledger.id, saved.id).all()).results;
    expect(revisions).toEqual([{ revision: 1, action: "created" }, { revision: 2, action: "revised" }]);
  });

  it("un reparto por método deja de ser «Igual»: se reabre con importes exactos", async () => {
    const t = await team("pm-metodo");
    const saved = await expense(t, { total: 9000, paid: [cash(t.ana, 9000)], shared: [], split: { method: "equal", beneficiaries: [t.ana, t.beto, t.caro], inputs: {} }, description: "Tres" });
    expect((await latest(t, saved.id)).split).toMatchObject({ method: "equal" });
    await merge(t, t.ana, t.beto);
    const snapshot = await latest(t, saved.id);
    expect(snapshot.split).toBeUndefined();
    const byPerson = rows => Object.fromEntries(rows.map(row => [row.participantId, row.amountMinor]));
    expect(byPerson(snapshot.allocations)).toEqual({ [t.beto]: 6000, [t.caro]: 3000 });
    expect(byPerson(entryByDescription(await view(t), "Tres").allocations)).toEqual(byPerson(snapshot.allocations));
  });

  it("una transferencia entre las dos personas se anula con su motivo y no cambia ningún saldo", async () => {
    const t = await team("pm-transferencia");
    const moved = await transfer(t, t.ana, t.beto, 5000);
    await expense(t, { paid: [cash(t.caro, 6000)], shared: [share(t.ana, 3000), share(t.caro, 3000)], description: "Gasto" });
    const before = await view(t);
    const result = await merge(t, t.ana, t.beto);
    expect(result).toMatchObject({ changed: 1, voided: 1, planned: 2 });
    const after = await view(t);
    expect(entryByDescription(after, "Pasó plata")).toMatchObject({ status: "voided" });
    expect(balanceOf(after, t.beto)).toBe(balanceOf(before, t.ana) + balanceOf(before, t.beto));
    const revisions = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(t.ledger.id, moved.id).all()).results;
    expect(revisions.map(row => row.action)).toEqual(["created", "voided"]);
    expect(JSON.parse(revisions[1].snapshot_json)).toMatchObject({ reason: expect.stringMatching(/unión de personas/iu), status: "voided", personMerge: expect.stringMatching(/^merge_/u) });
  });

  it("los movimientos que ya estaban anulados se siguen leyendo, a nombre de la persona vigente", async () => {
    const t = await team("pm-anulados");
    const saved = await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 5000), share(t.caro, 5000)], description: "Anulado" });
    await voidEntry(env.DB, { ...as(t), entryId: saved.id, expectedRevision: saved.revision, idempotencyKey: key(), reason: "error" });
    await expense(t, { paid: [cash(t.ana, 2000)], shared: [share(t.ana, 2000)], description: "Vigente" });
    await merge(t, t.ana, t.beto);
    const data = await view(t);
    const voided = entryByDescription(data, "Anulado");
    expect(voided.status).toBe("voided");
    expect(voided.cashParties[0].participantId).toBe(t.beto);
    expect(balanceOf(data, t.beto)).toBe(0);
  });

  it("las uniones encadenadas (A a B y B a C) se siguen hasta la persona vigente", async () => {
    const t = await team("pm-cadena");
    const saved = await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 10000)], description: "Viejo" });
    await voidEntry(env.DB, { ...as(t), entryId: saved.id, expectedRevision: saved.revision, idempotencyKey: key() });
    await merge(t, t.ana, t.beto);
    await merge(t, t.beto, t.caro);
    const data = await view(t);
    expect(entryByDescription(data, "Viejo").cashParties[0].participantId).toBe(t.caro);
    expect(data.mergedParticipants.map(p => [p.id, p.mergedIntoId]).sort()).toEqual([[t.ana, t.caro], [t.beto, t.caro]].sort());
  });

  it("una pestaña vieja ya no puede cargar movimientos a la persona unida", async () => {
    const t = await team("pm-pestana-vieja");
    await merge(t, t.ana, t.beto);
    await expect(expense(t, { paid: [cash(t.ana, 1000)], shared: [share(t.ana, 1000)] })).rejects.toThrow();
    await expect(expense(t, { paid: [cash(t.beto, 1000)], shared: [share(t.ana, 1000)] })).rejects.toThrow();
    expect((await view(t)).entries).toHaveLength(0);
  });

  it("el nombre de la persona unida queda libre y el export la incluye con su destinataria", async () => {
    const t = await team("pm-export");
    await merge(t, t.ana, t.beto);
    await addParticipant(env.DB, { ...as(t), name: "Ana" });
    const exported = await exportLedger(env.DB, as(t));
    expect(exported.participants.find(p => p.id === t.ana)).toMatchObject({ displayName: "Ana", mergedIntoId: t.beto });
  });

  it("un libro sin movimientos de la persona también se puede unir", async () => {
    const t = await team("pm-sin-movimientos");
    expect(await merge(t, t.ana, t.beto)).toMatchObject({ status: "applied", planned: 0, changed: 0, voided: 0 });
    expect((await view(t)).participants.map(p => p.id)).not.toContain(t.ana);
  });

  it("el evento del libro y su revisión quedan registrados una sola vez", async () => {
    const t = await team("pm-evento");
    await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 10000)] });
    const before = (await view(t)).ledger.revision;
    await merge(t, t.ana, t.beto);
    expect((await view(t)).ledger.revision).toBe(before + 1);
    const events = (await env.DB.prepare("SELECT entity_id, metadata_json FROM ledger_events WHERE ledger_id = ? AND action = 'person_merged'").bind(t.ledger.id).all()).results;
    expect(events).toHaveLength(1);
    expect(events[0].entity_id).toBe(t.ana);
    expect(JSON.parse(events[0].metadata_json)).toEqual({ into: t.beto, changed: 1, voided: 0 });
  });
});

describe("cuentas e invitaciones", () => {
  it("si la unida tiene cuenta y la destinataria no, la destinataria queda con la cuenta", async () => {
    const t = await team("pm-cuenta-pasa");
    await expense(t, { paid: [cash(t.memberId, 10000)], shared: [share(t.memberId, 5000), share(t.beto, 5000)] });
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.memberId, targetId: t.beto });
    expect(preview.accountMoves).toBe(true);
    await merge(t, t.memberId, t.beto);
    const data = await view(t);
    expect(data.participants.find(p => p.id === t.beto).linkedUserId).toBe(t.member.id);
    expect(data.mergedParticipants.find(p => p.id === t.memberId).linkedUserId).toBeNull();
    expect((await view(t, t.member)).participants.some(p => p.linkedUserId === t.member.id)).toBe(true);
  });

  it("si la destinataria tiene cuenta y la unida no, conserva la suya", async () => {
    const t = await team("pm-cuenta-queda");
    await merge(t, t.ana, t.memberId);
    expect((await view(t)).participants.find(p => p.id === t.memberId).linkedUserId).toBe(t.member.id);
  });

  it("dos cuentas distintas no se unen y no se escribe nada", async () => {
    const t = await team("pm-dos-cuentas");
    await expense(t, { paid: [cash(t.ownerId, 1000)], shared: [share(t.memberId, 1000)] });
    await expect(merge(t, t.ownerId, t.memberId)).rejects.toThrow(/cuentas distintas/iu);
    expect(await count("SELECT COUNT(*) AS n FROM person_merges WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  });

  it("una invitación pendiente a la unida pasa a la destinataria si esta no tiene cuenta ni invitación", async () => {
    const t = await team("pm-invitacion-pasa");
    const invitation = await inviteToGroup(env.DB, { groupId: t.group.id, inviterUserId: t.owner.id, email: "ana-invitada@example.test", targetParticipantId: t.ana });
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto });
    expect(preview.invitation).toEqual({ moves: "ana-invitada@example.test", canceled: [] });
    await merge(t, t.ana, t.beto);
    expect((await env.DB.prepare("SELECT status, target_participant_id FROM invitations WHERE id = ?").bind(invitation.id).first())).toEqual({ status: "pending", target_participant_id: t.beto });
  });

  it("si la destinataria ya tiene una invitación pendiente, la de la unida se cancela", async () => {
    const t = await team("pm-invitacion-cancela");
    const sourceInvite = await inviteToGroup(env.DB, { groupId: t.group.id, inviterUserId: t.owner.id, email: "uno@example.test", targetParticipantId: t.ana });
    const targetInvite = await inviteToGroup(env.DB, { groupId: t.group.id, inviterUserId: t.owner.id, email: "dos@example.test", targetParticipantId: t.beto });
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto });
    expect(preview.invitation).toEqual({ moves: null, canceled: ["uno@example.test"] });
    await merge(t, t.ana, t.beto);
    expect((await env.DB.prepare("SELECT status FROM invitations WHERE id = ?").bind(sourceInvite.id).first()).status).toBe("canceled");
    expect((await env.DB.prepare("SELECT status, target_participant_id FROM invitations WHERE id = ?").bind(targetInvite.id).first())).toEqual({ status: "pending", target_participant_id: t.beto });
  });

  it("si la cuenta pasa a la destinataria, su invitación pendiente deja de tener sentido y se cancela", async () => {
    const t = await team("pm-invitacion-cuenta");
    const targetInvite = await inviteToGroup(env.DB, { groupId: t.group.id, inviterUserId: t.owner.id, email: "tres@example.test", targetParticipantId: t.beto });
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.memberId, targetId: t.beto });
    expect(preview.invitation.canceled).toEqual(["tres@example.test"]);
    await merge(t, t.memberId, t.beto);
    expect((await env.DB.prepare("SELECT status FROM invitations WHERE id = ?").bind(targetInvite.id).first()).status).toBe("canceled");
  });
});

describe("repeticiones, cortes y cambios simultáneos", () => {
  it("confirmar dos veces, también en simultáneo, produce una sola unión y una sola revisión por movimiento", async () => {
    const t = await team("pm-idempotencia");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ana, otherId: t.caro, count: 30 });
    const sameKey = key();
    const args = { ...as(t), sourceId: t.ana, targetId: t.beto, key: sameKey };
    const results = await Promise.all([applyMerge(env.DB, args), applyMerge(env.DB, args)]);
    expect(results.every(row => row.status === "applied")).toBe(true);
    expect(await applyMerge(env.DB, args)).toMatchObject({ status: "applied", changed: 30 });
    expect(await count("SELECT COUNT(*) AS n FROM person_merges WHERE ledger_id = ?", t.ledger.id)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 2", t.ledger.id)).toBe(30);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision >= 3", t.ledger.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_events WHERE ledger_id = ? AND action = 'person_merged'", t.ledger.id)).toBe(1);
  });

  it("la misma clave con otras personas se rechaza y otra clave sobre una persona ya unida también", async () => {
    const t = await team("pm-clave");
    const sameKey = key();
    await applyMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto, key: sameKey });
    await expect(applyMerge(env.DB, { ...as(t), sourceId: t.caro, targetId: t.beto, key: sameKey })).rejects.toMatchObject({ status: 409 });
    await expect(applyMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto, key: key() })).rejects.toThrow(/ya fue unida/iu);
    await expect(applyMerge(env.DB, { ...as(t), sourceId: t.caro, targetId: t.beto, key: "corta" })).rejects.toThrow(/Recargá/u);
  });

  it("si el libro cambió desde la vista previa, no se aplica nada", async () => {
    const t = await team("pm-libro-cambio");
    const preview = await previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto });
    await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 10000)] });
    await expect(merge(t, t.ana, t.beto, { expectedRevision: preview.ledgerRevision })).rejects.toThrow(/El grupo cambió/u);
    expect(await count("SELECT COUNT(*) AS n FROM person_merges WHERE ledger_id = ?", t.ledger.id)).toBe(0);
    expect((await view(t)).participants.map(p => p.id)).toContain(t.ana);
  });

  it("un corte antes de escribir deja todo como estaba y repetir la confirmación la completa", async () => {
    const t = await team("pm-corte-antes");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ana, otherId: t.caro, count: 5 });
    const sameKey = key();
    const args = { ...as(t), sourceId: t.ana, targetId: t.beto, key: sameKey };
    await expect(applyMerge(env.DB, { ...args, hooks: { beforeWrite: () => { throw new Error("corte"); } } })).rejects.toThrow("corte");
    expect((await env.DB.prepare("SELECT status FROM person_merges WHERE ledger_id = ?").bind(t.ledger.id).first()).status).toBe("applying");
    expect((await view(t)).entries).toHaveLength(5);
    expect(await applyMerge(env.DB, args)).toMatchObject({ status: "applied", changed: 5 });
  });

  it("un corte a mitad: el libro se lee bien en cada paso y repetir la confirmación completa sin duplicar", async () => {
    const t = await team("pm-corte-mitad");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ana, otherId: t.caro, count: 250 });
    const before = await view(t);
    const sameKey = key();
    const args = { ...as(t), sourceId: t.ana, targetId: t.beto, key: sameKey };
    let batches = 0;
    const flaky = { prepare: sql => env.DB.prepare(sql), batch: async statements => { batches += 1; if (batches === 2) throw new Error("corte a mitad"); return env.DB.batch(statements); } };
    await expect(applyMerge(flaky, args)).rejects.toThrow("corte a mitad");
    const middle = await view(t);
    expect(middle.participants.map(p => p.id)).toContain(t.ana);
    expect(middle.balances.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(0);
    expect(balanceOf(middle, t.ana) + balanceOf(middle, t.beto)).toBe(balanceOf(before, t.ana));
    expect(await count("SELECT COUNT(*) AS n FROM person_merge_items WHERE ledger_id = ?", t.ledger.id)).toBe(100);
    expect(await applyMerge(env.DB, args)).toMatchObject({ status: "applied", changed: 250, planned: 250 });
    const after = await view(t);
    expect(balanceOf(after, t.beto)).toBe(balanceOf(before, t.ana));
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 2", t.ledger.id)).toBe(250);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision >= 3", t.ledger.id)).toBe(0);
  });

  it("repetir con otra clave después de un corte retoma la misma unión", async () => {
    const t = await team("pm-corte-otra-clave");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ana, otherId: t.caro, count: 3 });
    await expect(merge(t, t.ana, t.beto, { hooks: { beforeWrite: () => { throw new Error("corte"); } } })).rejects.toThrow("corte");
    expect(await merge(t, t.ana, t.beto)).toMatchObject({ status: "applied", changed: 3 });
    expect(await count("SELECT COUNT(*) AS n FROM person_merges WHERE ledger_id = ?", t.ledger.id)).toBe(1);
  });

  it("un movimiento corregido entre la vista previa y la escritura conserva su corrección y también se une", async () => {
    const t = await team("pm-corregido");
    const saved = await expense(t, { paid: [cash(t.ana, 10000)], shared: [share(t.ana, 5000), share(t.caro, 5000)], description: "Original" });
    await merge(t, t.beto, t.caro, {});
    const second = await expense(t, { paid: [cash(t.ana, 8000)], shared: [share(t.ana, 8000)], description: "Segundo" });
    const hooks = {
      beforeWrite: () => saveEntry(env.DB, { ...as(t), idempotencyKey: key(), entryId: saved.id, expectedRevision: 1, input: { type: "expense", currency: "COP", totalMinor: 12000, description: "Corregido", note: "", occurredAt: "2026-06-01", cashParties: [cash(t.ana, 12000)], allocations: [share(t.ana, 7000), share(t.caro, 5000)] } }),
    };
    await merge(t, t.ana, t.caro, { hooks });
    const data = await view(t);
    const corrected = entryByDescription(data, "Corregido");
    expect(corrected.cashParties).toEqual([{ participantId: t.caro, direction: "out", amountMinor: 12000 }]);
    expect(corrected.allocations).toEqual([{ participantId: t.caro, amountMinor: 12000 }]);
    expect(entryByDescription(data, "Segundo").cashParties[0].participantId).toBe(t.caro);
    const actions = (await env.DB.prepare("SELECT action FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(t.ledger.id, saved.id).all()).results.map(row => row.action);
    expect(actions).toEqual(["created", "revised", "revised"]);
    expect(second.id).toBeTruthy();
  });
});

describe("escala: una persona con 2.500 movimientos", () => {
  it("se une y deja los números en la salida", async () => {
    const t = await team("pm-escala");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ana, otherId: t.caro, count: 2500 });
    const before = await view(t);
    const timings = {};
    const time = async (label, work) => { const start = Date.now(); const result = await work(); timings[label] = Date.now() - start; return result; };
    const preview = await time("previewMs", () => previewMerge(env.DB, { ...as(t), sourceId: t.ana, targetId: t.beto }));
    let batches = 0;
    let statements = 0;
    const counting = { prepare: sql => env.DB.prepare(sql), batch: async list => { batches += 1; statements += list.length; return env.DB.batch(list); } };
    const result = await time("applyMs", () => applyMerge(counting, { ...as(t), sourceId: t.ana, targetId: t.beto, expectedRevision: preview.ledgerRevision, key: key() }));
    const after = await time("readMs", () => view(t));
    console.log(`MERGE-SCALE ${JSON.stringify({ entries: 2500, writeChunk: 100, batches, statements, ...timings })}`);
    expect(result).toMatchObject({ status: "applied", changed: 2500 });
    expect(balanceOf(after, t.beto)).toBe(balanceOf(before, t.ana));
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 2", t.ledger.id)).toBe(2500);
    expect(timings.applyMs).toBeLessThan(60_000);
  }, 180000);
});
