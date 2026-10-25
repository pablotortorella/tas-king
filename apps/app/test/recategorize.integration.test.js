import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createCategory, mergeCategory, readCategories, setCategoryArchived } from "../src/categories.js";
import { addParticipant, readLedger, saveEntry, voidEntry } from "../src/ledger.js";
import { setLedgerArchived } from "../src/ledger-admin.js";
import { revisionSummary } from "../src/ledger-ui.js";
import { MAX_BATCH, applyRecategorization, classifyOne, previewRecategorization, readRecategorizationBatch, selectEntries, undoRecategorization } from "../src/recategorize.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";
import { seedEntries } from "./fixtures/seed-entries.js";

async function team(name) {
  const owner = await ensureLocalUser(env.DB, `${name}-owner@example.test`);
  const member = await ensureLocalUser(env.DB, `${name}-member@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.id, name });
  const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
  const ownerId = data.participants.find(person => person.linkedUserId === owner.id).id;
  const memberId = data.participants.find(person => person.linkedUserId === member.id).id;
  return { owner, member, space, ledger: data.ledger, ownerId, memberId, categories: data.categories };
}
const as = (t, user = t.owner) => ({ spaceId: t.space.id, userId: user.id });
const find = (t, name) => t.categories.find(category => category.name === name);
const view = (t, user) => readLedger(env.DB, as(t, user));
const key = () => crypto.randomUUID();
const entryInput = (t, extra = {}) => ({
  type: "expense", currency: "COP", totalMinor: 10000, description: "Compra", note: "", occurredAt: "2026-06-01",
  cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }], ...extra,
});
const addEntry = (t, extra = {}, user = t.owner) => saveEntry(env.DB, { ...as(t, user), idempotencyKey: key(), input: entryInput(t, extra) });
const seed = (t, count, extra = {}) => seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ownerId, otherId: t.memberId, count, ...extra });
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const bulk = (t, criteria, categoryId, extra = {}, user = t.owner) => applyRecategorization(env.DB, { ...as(t, user), criteria, categoryId, key: key(), ...extra });
const allIds = async t => (await view(t)).entries.map(entry => entry.id);

describe("modelo de datos", () => {
  it("un lote con sus elementos se guarda y se lee", async () => {
    const t = await team("rc-modelo");
    await seed(t, 3);
    const batchId = "recat_modelo_000000000000";
    await env.DB.prepare("INSERT INTO recategorization_batches (ledger_id, id, actor_user_id, kind, category_id, planned) VALUES (?, ?, ?, 'bulk', ?, 1)").bind(t.ledger.id, batchId, t.owner.id, find(t, "Taxi").id).run();
    await env.DB.prepare("INSERT INTO recategorization_items (ledger_id, batch_id, entry_id, revision, previous_category_id) VALUES (?, ?, 'seed_000000', 2, NULL)").bind(t.ledger.id, batchId).run();
    expect(await env.DB.prepare("SELECT kind, status, planned FROM recategorization_batches WHERE id = ?").bind(batchId).first()).toEqual({ kind: "bulk", status: "applying", planned: 1 });
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_items WHERE batch_id = ?", batchId)).toBe(1);
    await expect(env.DB.prepare("INSERT INTO recategorization_batches (ledger_id, id, actor_user_id, kind) VALUES (?, 'recat_malo_00000000000000', ?, 'otro')").bind(t.ledger.id, t.owner.id).run()).rejects.toThrow();
  });
});

describe("selección y vista previa", () => {
  it("«todos los resultados» incluye los que «Ver más» no muestra", async () => {
    const t = await team("rc-todos");
    await seed(t, 160, { prefix: "Carulla" });
    await seed(t, 20, { prefix: "Otra cosa", idPrefix: "otro" });
    const data = await view(t);
    expect(selectEntries(data, { all: true, query: "carulla", category: "" })).toHaveLength(160);
    const preview = await previewRecategorization(env.DB, { ...as(t), criteria: { all: true, query: "carulla", category: "" }, categoryId: find(t, "Alimentos").id });
    expect(preview).toMatchObject({ count: 160, selected: 160, category: { name: "Alimentos" } });
    expect(preview.sample).toHaveLength(8);
    expect(preview.ledgerRevision).toBe(data.ledger.revision);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = ? AND category_id IS NOT NULL", t.ledger.id)).toBe(0);
  });

  it("la vista previa no escribe nada", async () => {
    const t = await team("rc-previa-pura");
    await seed(t, 5);
    const before = await view(t);
    await previewRecategorization(env.DB, { ...as(t), criteria: { ids: await allIds(t) }, categoryId: find(t, "Taxi").id });
    expect((await view(t)).ledger.revision).toBe(before.ledger.revision);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  });

  it("separa anulados, transferencias, sin permiso y los que ya tienen la categoría", async () => {
    const t = await team("rc-omitidos");
    const taxi = find(t, "Taxi");
    const mine = await addEntry(t, { description: "Mío", categoryId: "" });
    const alreadyTaxi = await addEntry(t, { description: "Ya taxi", categoryId: taxi.id });
    const voided = await addEntry(t, { description: "Anulado" });
    await voidEntry(env.DB, { ...as(t), entryId: voided.id, expectedRevision: 1, idempotencyKey: key() });
    const transfer = await saveEntry(env.DB, { ...as(t), idempotencyKey: key(), input: { type: "transfer", currency: "COP", totalMinor: 100, description: "Pase", note: "", occurredAt: "2026-06-02", cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 100 }, { participantId: t.memberId, direction: "in", amountMinor: 100 }], allocations: [] } });
    const ownerOnly = await addEntry(t, { description: "Del titular" });
    const memberOwn = await addEntry(t, { description: "Del integrante", cashParties: [{ participantId: t.memberId, direction: "out", amountMinor: 10000 }] }, t.member);
    const ids = [mine.id, alreadyTaxi.id, voided.id, transfer.id, ownerOnly.id, memberOwn.id];
    const asOwner = await previewRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: taxi.id });
    expect(asOwner.count).toBe(3);
    expect(asOwner.skipped).toEqual({ voided: 1, permission: 0, unchanged: 1, transfers: 1 });
    const asMember = await previewRecategorization(env.DB, { ...as(t, t.member), criteria: { ids }, categoryId: taxi.id });
    expect(asMember.count).toBe(1);
    expect(asMember.skipped).toEqual({ voided: 1, permission: 3, unchanged: 0, transfers: 1 });
  });

  it("rechaza un libro archivado, una selección vacía, una categoría ajena o archivada y un destino que no cambia nada", async () => {
    const t = await team("rc-rechazos");
    const other = await team("rc-rechazos-otro");
    const one = await addEntry(t, { description: "Uno" });
    const call = (criteria, categoryId) => previewRecategorization(env.DB, { ...as(t), criteria, categoryId });
    await expect(call({ ids: [] }, find(t, "Taxi").id)).rejects.toThrow(/No hay movimientos seleccionados/u);
    await expect(call({ ids: [one.id] }, "")).rejects.toThrow(/Elegí la categoría/u);
    await expect(call({ ids: [one.id] }, find(other, "Taxi").id)).rejects.toThrow(/no existe en este libro/u);
    await setCategoryArchived(env.DB, { ledger: t.ledger, userId: t.owner.id, categoryId: find(t, "Hotel").id, archived: true });
    await expect(call({ ids: [one.id] }, find(t, "Hotel").id)).rejects.toThrow(/archivada/u);
    await expect(bulk(t, { ids: [one.id] }, find(t, "Taxi").id)).resolves.toMatchObject({ changed: 1 });
    await expect(bulk(t, { ids: [one.id] }, find(t, "Taxi").id)).rejects.toThrow(/No hay movimientos para cambiar/u);
    await setLedgerArchived(env.DB, { spaceId: t.space.id, userId: t.owner.id, archived: true });
    await expect(call({ ids: [one.id] }, find(t, "Restaurantes").id)).rejects.toMatchObject({ status: 409 });
    await expect(bulk(t, { ids: [one.id] }, find(t, "Restaurantes").id)).rejects.toMatchObject({ status: 409 });
  });

  it("un conjunto de más de 1.000 se rechaza con el límite y cuántos quedan", async () => {
    const t = await team("rc-limite");
    await seed(t, MAX_BATCH + 5);
    const criteria = { ids: await allIds(t) };
    await expect(previewRecategorization(env.DB, { ...as(t), criteria, categoryId: find(t, "Taxi").id })).rejects.toMatchObject({ status: 413, message: expect.stringMatching(/1\.000.*1\.005.*5 para repetirla/u) });
    await expect(bulk(t, criteria, find(t, "Taxi").id)).rejects.toMatchObject({ status: 413 });
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  }, 60000);
});

describe("aplicar", () => {
  it("cada movimiento queda con su revisión «Cambió: categoría» y el lote registra autor, destino, cantidad y omitidos", async () => {
    const t = await team("rc-aplicar");
    await seed(t, 40, { prefix: "Carulla" });
    const voided = await addEntry(t, { description: "Carulla anulada" });
    await voidEntry(env.DB, { ...as(t), entryId: voided.id, expectedRevision: 1, idempotencyKey: key() });
    const food = find(t, "Alimentos");
    const before = (await view(t)).ledger.revision;
    const batch = await bulk(t, { all: true, query: "carulla", category: "" }, food.id);
    expect(batch).toMatchObject({ kind: "bulk", status: "applied", planned: 40, changed: 40, skipped: 1, undone: false });
    const data = await view(t);
    expect(data.ledger.revision).toBe(before + 1);
    const changed = data.entries.filter(entry => entry.description.startsWith("Carulla ") && entry.description !== "Carulla anulada");
    expect(changed).toHaveLength(40);
    for (const entry of changed) expect(entry).toMatchObject({ categoryId: food.id, revision: 2, status: "active" });
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(t.ledger.id, changed[0].id).all()).results;
    expect(rows.map(row => row.action)).toEqual(["created", "revised"]);
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: categoría");
    expect(JSON.parse(rows[1].snapshot_json)).toMatchObject({ categoryId: food.id, categoryName: "Alimentos", recategorizationBatch: batch.id, cashParties: [{ participantId: t.ownerId }] });
    const info = await readRecategorizationBatch(env.DB, { ...as(t), batchId: batch.id });
    expect(info).toMatchObject({ actorName: expect.any(String), categoryName: "Alimentos", canUndo: true, changed: 40 });
    expect(await count("SELECT COUNT(*) AS n FROM ledger_events WHERE ledger_id = ? AND action = 'recategorization_applied'", t.ledger.id)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_items WHERE batch_id = ?", batch.id)).toBe(40);
  });

  it("no toca los saldos, los importes ni el reparto", async () => {
    const t = await team("rc-saldos");
    await seed(t, 20);
    const before = await view(t);
    await bulk(t, { ids: await allIds(t) }, find(t, "Taxi").id);
    const after = await view(t);
    expect(after.balances).toEqual(before.balances);
    expect(after.entries.map(entry => ({ ...entry, categoryId: 0, categoryInfo: 0, revision: 0 }))).toEqual(before.entries.map(entry => ({ ...entry, categoryId: 0, categoryInfo: 0, revision: 0 })));
  });

  it("un movimiento fusionado o con categoría anterior distinta guarda la categoría que tenía como previa", async () => {
    const t = await team("rc-previa");
    const [first, second] = [find(t, "Taxi"), find(t, "Hotel")];
    const a = await addEntry(t, { description: "A", categoryId: first.id });
    const b = await addEntry(t, { description: "B" });
    const batch = await bulk(t, { ids: [a.id, b.id] }, second.id);
    const items = (await env.DB.prepare("SELECT entry_id, previous_category_id FROM recategorization_items WHERE batch_id = ?").bind(batch.id).all()).results;
    expect(Object.fromEntries(items.map(item => [item.entry_id, item.previous_category_id]))).toEqual({ [a.id]: first.id, [b.id]: null });
  });

  it("rechaza la confirmación si el libro cambió desde la vista previa y no cambia ningún movimiento", async () => {
    const t = await team("rc-conflicto");
    await seed(t, 10);
    const ids = await allIds(t);
    const preview = await previewRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id });
    await addEntry(t, { description: "Cargado por otra persona" }, t.member);
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id, expectedRevision: preview.ledgerRevision, key: key() })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("cambió") });
    expect(await count("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = ? AND category_id IS NOT NULL", t.ledger.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  });

  it("con la revisión vigente la confirmación sí se aplica", async () => {
    const t = await team("rc-vigente");
    await seed(t, 4);
    const ids = await allIds(t);
    const preview = await previewRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id });
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id, expectedRevision: preview.ledgerRevision, key: key() })).resolves.toMatchObject({ changed: 4 });
  });

  it("repetir la misma confirmación, incluso en simultáneo, deja un solo lote y un solo cambio por movimiento", async () => {
    const t = await team("rc-idempotente");
    await seed(t, 30);
    const ids = await allIds(t);
    const sameKey = key();
    const args = { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id, key: sameKey };
    const results = await Promise.all([applyRecategorization(env.DB, args), applyRecategorization(env.DB, args), applyRecategorization(env.DB, args)]);
    for (const result of results) expect(result.id).toBe(`recat_${sameKey}`);
    const again = await applyRecategorization(env.DB, args);
    expect(again).toMatchObject({ status: "applied", changed: 30 });
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ?", t.ledger.id)).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 2", t.ledger.id)).toBe(30);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 3", t.ledger.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_events WHERE ledger_id = ? AND action = 'recategorization_applied'", t.ledger.id)).toBe(1);
    expect((await view(t)).entries.every(entry => entry.revision === 2)).toBe(true);
  });

  it("una operación cortada a la mitad se completa al repetir la confirmación sin duplicar", async () => {
    const t = await team("rc-reanudar");
    await seed(t, 50);
    const ids = await allIds(t);
    const sameKey = key();
    const taxi = find(t, "Taxi");
    // Se simula el corte: el lote quedó «aplicando» con 20 de 50 ya escritos.
    await env.DB.prepare("INSERT INTO recategorization_batches (ledger_id, id, actor_user_id, kind, category_id, planned) VALUES (?, ?, ?, 'bulk', ?, 50)").bind(t.ledger.id, `recat_${sameKey}`, t.owner.id, taxi.id).run();
    await applyRecategorization(env.DB, { ...as(t), criteria: { ids: ids.slice(0, 20) }, categoryId: taxi.id, key: key() });
    expect((await view(t)).entries.filter(entry => entry.categoryId === taxi.id)).toHaveLength(20);
    const done = await applyRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: taxi.id, key: sameKey });
    expect(done).toMatchObject({ status: "applied" });
    expect((await view(t)).entries.every(entry => entry.categoryId === taxi.id)).toBe(true);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision >= 3", t.ledger.id)).toBe(0);
  });

  it("un movimiento corregido a mitad de camino no se pisa y las demás revisiones siguen consistentes", async () => {
    const t = await team("rc-corregido");
    await seed(t, 5);
    const entries = (await view(t)).entries;
    const stale = entries[0];
    const taxi = find(t, "Taxi");
    // La selección se resolvió con la revisión 1; antes de escribir, otra persona corrige ese movimiento.
    const batch = await applyRecategorization(env.DB, { ...as(t), criteria: { ids: entries.map(entry => entry.id) }, categoryId: taxi.id, key: key(), hooks: { beforeWrite: () => saveEntry(env.DB, { ...as(t), entryId: stale.id, expectedRevision: 1, idempotencyKey: key(), input: entryInput(t, { description: "Corregido antes" }) }) } });
    expect(batch.changed).toBe(4);
    const after = (await view(t)).entries;
    expect(after.find(entry => entry.id === stale.id)).toMatchObject({ description: "Corregido antes", revision: 2, categoryId: null });
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND entry_id = ?", t.ledger.id, stale.id)).toBe(2);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_items WHERE batch_id = ? AND entry_id = ?", batch.id, stale.id)).toBe(0);
    expect(after.filter(entry => entry.categoryId === taxi.id)).toHaveLength(4);
  });

  it("solo la persona titular recategoriza movimientos ajenos", async () => {
    const t = await team("rc-permisos");
    const ownerEntry = await addEntry(t, { description: "Del titular" });
    const memberEntry = await addEntry(t, { description: "Del integrante" }, t.member);
    const batch = await bulk(t, { ids: [ownerEntry.id, memberEntry.id] }, find(t, "Taxi").id, {}, t.member);
    expect(batch).toMatchObject({ changed: 1, skipped: 1 });
    const entries = (await view(t)).entries;
    expect(entries.find(entry => entry.id === ownerEntry.id).categoryId).toBeNull();
    expect(entries.find(entry => entry.id === memberEntry.id).categoryId).toBe(find(t, "Taxi").id);
    await expect(bulk(t, { ids: [ownerEntry.id] }, find(t, "Taxi").id, {}, t.member)).rejects.toThrow(/No hay movimientos para cambiar/u);
  });

  it("una clave inválida o ajena se rechaza", async () => {
    const t = await team("rc-clave");
    const one = await addEntry(t, { description: "Uno" });
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids: [one.id] }, categoryId: find(t, "Taxi").id, key: "corta" })).rejects.toThrow(/Recargá/u);
    const sameKey = key();
    await applyRecategorization(env.DB, { ...as(t), criteria: { ids: [one.id] }, categoryId: find(t, "Taxi").id, key: sameKey });
    await expect(applyRecategorization(env.DB, { ...as(t, t.member), criteria: { ids: [one.id] }, categoryId: find(t, "Taxi").id, key: sameKey })).rejects.toMatchObject({ status: 409 });
  });

  it("la categoría fusionada se resuelve: aplicar la destino a movimientos de la fusionada cuenta como cambio", async () => {
    const t = await team("rc-fusion");
    const [from, into] = [find(t, "Licor"), find(t, "Restaurantes")];
    const entry = await addEntry(t, { description: "Cerveza", categoryId: from.id });
    await mergeCategory(env.DB, { ledger: t.ledger, userId: t.owner.id, categoryId: from.id, intoId: into.id });
    await expect(bulk(t, { ids: [entry.id] }, into.id)).rejects.toThrow(/No hay movimientos para cambiar/u);
  });
});

describe("deshacer", () => {
  it("devuelve cada movimiento a su categoría anterior, con revisiones nuevas y un lote propio", async () => {
    const t = await team("rc-deshacer");
    const [taxi, hotel] = [find(t, "Taxi"), find(t, "Hotel")];
    const a = await addEntry(t, { description: "A", categoryId: taxi.id });
    await seed(t, 30);
    const ids = [a.id, ...(await view(t)).entries.filter(entry => entry.id.startsWith("seed")).map(entry => entry.id)];
    const batch = await bulk(t, { ids }, hotel.id);
    expect(batch.changed).toBe(31);
    const undone = await undoRecategorization(env.DB, { ...as(t), batchId: batch.id });
    expect(undone).toMatchObject({ kind: "undo", changed: 31, skipped: 0, undoOf: batch.id, kept: [] });
    const entries = (await view(t)).entries;
    expect(entries.find(entry => entry.id === a.id)).toMatchObject({ categoryId: taxi.id, revision: 3 });
    expect(entries.filter(entry => entry.id.startsWith("seed")).every(entry => entry.categoryId === null && entry.revision === 3)).toBe(true);
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(t.ledger.id, a.id).all()).results;
    expect(rows.map(row => row.revision)).toEqual([1, 2, 3]);
    expect(JSON.parse(rows[2].snapshot_json)).toMatchObject({ categoryId: taxi.id, categoryName: "Taxi" });
    expect((await readRecategorizationBatch(env.DB, { ...as(t), batchId: batch.id })).undone).toBe(true);
  });

  it("los movimientos modificados después quedan como están y se informan", async () => {
    const t = await team("rc-deshacer-parcial");
    await seed(t, 10);
    const entries = (await view(t)).entries;
    const batch = await bulk(t, { ids: entries.map(entry => entry.id) }, find(t, "Taxi").id);
    const touched = entries.slice(0, 3);
    for (const entry of touched) await saveEntry(env.DB, { ...as(t), entryId: entry.id, expectedRevision: 2, idempotencyKey: key(), input: entryInput(t, { description: `${entry.description} corregido`, categoryId: find(t, "Taxi").id }) });
    await voidEntry(env.DB, { ...as(t), entryId: entries[3].id, expectedRevision: 2, idempotencyKey: key() });
    const undone = await undoRecategorization(env.DB, { ...as(t), batchId: batch.id });
    expect(undone.changed).toBe(6);
    expect(undone.kept.map(item => item.id).sort()).toEqual(entries.slice(0, 4).map(entry => entry.id).sort());
    expect(undone.kept.find(item => item.id === entries[3].id).reason).toContain("anuló");
    const after = (await view(t)).entries;
    for (const entry of entries.slice(0, 3)) expect(after.find(row => row.id === entry.id).categoryId).toBe(find(t, "Taxi").id);
    for (const entry of entries.slice(4)) expect(after.find(row => row.id === entry.id).categoryId).toBeNull();
  });

  it("rechaza deshacer dos veces, deshacer un deshacer y a quien no aplicó el lote ni es titular", async () => {
    const t = await team("rc-deshacer-reglas");
    const mine = await addEntry(t, { description: "Del integrante", cashParties: [{ participantId: t.memberId, direction: "out", amountMinor: 10000 }] }, t.member);
    const batch = await bulk(t, { ids: [mine.id] }, find(t, "Taxi").id, {}, t.member);
    const stranger = await ensureLocalUser(env.DB, "rc-deshacer-extraño@example.test");
    await expect(undoRecategorization(env.DB, { spaceId: t.space.id, userId: stranger.id, batchId: batch.id })).rejects.toMatchObject({ status: 404 });
    const ownerBatch = await bulk(t, { ids: [(await addEntry(t, { description: "Del titular" })).id] }, find(t, "Hotel").id);
    await expect(undoRecategorization(env.DB, { ...as(t, t.member), batchId: ownerBatch.id })).rejects.toMatchObject({ status: 403 });
    const undone = await undoRecategorization(env.DB, { ...as(t), batchId: batch.id });
    await expect(undoRecategorization(env.DB, { ...as(t), batchId: batch.id })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ya se deshizo") });
    await expect(undoRecategorization(env.DB, { ...as(t), batchId: undone.id })).rejects.toMatchObject({ status: 409 });
    await expect(undoRecategorization(env.DB, { ...as(t), batchId: "recat_no_existe_000000" })).rejects.toMatchObject({ status: 404 });
  });

  it("dos pedidos de deshacer al mismo tiempo restauran una sola vez", async () => {
    const t = await team("rc-deshacer-doble");
    await seed(t, 25);
    const batch = await bulk(t, { ids: await allIds(t) }, find(t, "Taxi").id);
    await Promise.allSettled([undoRecategorization(env.DB, { ...as(t), batchId: batch.id }), undoRecategorization(env.DB, { ...as(t), batchId: batch.id })]);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 3", t.ledger.id)).toBe(25);
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 4", t.ledger.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ? AND kind = 'undo'", t.ledger.id)).toBe(1);
  });

  it("un libro archivado no se deshace", async () => {
    const t = await team("rc-deshacer-archivado");
    const one = await addEntry(t, { description: "Uno" });
    const batch = await bulk(t, { ids: [one.id] }, find(t, "Taxi").id);
    await setLedgerArchived(env.DB, { spaceId: t.space.id, userId: t.owner.id, archived: true });
    await expect(undoRecategorization(env.DB, { ...as(t), batchId: batch.id })).rejects.toMatchObject({ status: 409 });
  });
});

describe("clasificar rápido", () => {
  it("asignar una categoría a un movimiento crea un lote «quick» que se puede deshacer", async () => {
    const t = await team("rc-rapido");
    const one = await addEntry(t, { description: "Pendiente" });
    const batch = await classifyOne(env.DB, { ...as(t), entryId: one.id, categoryId: find(t, "Taxi").id, key: key() });
    expect(batch).toMatchObject({ kind: "quick", changed: 1 });
    expect((await view(t)).entries[0].categoryInfo.name).toBe("Taxi");
    await undoRecategorization(env.DB, { ...as(t), batchId: batch.id });
    expect((await view(t)).entries[0].categoryInfo).toBeNull();
  });

  it("un integrante no clasifica movimientos ajenos", async () => {
    const t = await team("rc-rapido-ajeno");
    const ownerEntry = await addEntry(t, { description: "Del titular" });
    await expect(classifyOne(env.DB, { ...as(t, t.member), entryId: ownerEntry.id, categoryId: find(t, "Taxi").id, key: key() })).rejects.toThrow(/No hay movimientos para cambiar/u);
  });
});

describe("escala: 1.000 movimientos en una operación", () => {
  it("se aplica y se deshace, y deja los números en la salida", async () => {
    const t = await team("rc-escala");
    await seed(t, MAX_BATCH);
    const ids = await allIds(t);
    const timings = {};
    const time = async (label, work) => { const start = Date.now(); const result = await work(); timings[label] = Date.now() - start; return result; };
    const preview = await time("previewMs", () => previewRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id }));
    const batch = await time("applyMs", () => applyRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id, expectedRevision: preview.ledgerRevision, key: key() }));
    const undone = await time("undoMs", () => undoRecategorization(env.DB, { ...as(t), batchId: batch.id }));
    const json = JSON.stringify(ids.slice(0, 100).map(id => ({ id, rev: 1, next: 2, categoryId: "category_xxxxxxxxxxxxxxxxxxxxxxxx", previous: null, snapshot: { description: "Movimiento 123", note: "", occurredAt: "2026-05-01", type: "expense", currency: "COP", totalMinor: 10000, cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }], categoryId: "x", categoryName: "Taxi", status: "active", recategorizationBatch: batch.id } })));
    const summary = { entries: MAX_BATCH, writeChunk: 100, chunks: 10, statementsPerChunk: 3, finishStatements: 3, jsonBytesPerChunk: new TextEncoder().encode(json).byteLength, ...timings };
    console.log(`RECATEGORIZE-SCALE ${JSON.stringify(summary)}`);
    expect(batch).toMatchObject({ changed: MAX_BATCH, status: "applied" });
    expect(undone).toMatchObject({ changed: MAX_BATCH, kept: [] });
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 3", t.ledger.id)).toBe(MAX_BATCH);
    expect(timings.applyMs).toBeLessThan(60_000);
  }, 180000);
});
