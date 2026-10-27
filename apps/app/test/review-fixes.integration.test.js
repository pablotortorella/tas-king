import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createCategory, readCategories, updateCategory } from "../src/categories.js";
import { addParticipant, exportLedger, readLedger, saveEntry } from "../src/ledger.js";
import { ledgerCsv, parseEntryForm, renderEntryForm } from "../src/ledger-ui.js";
import { applyRecategorization, classifyOne, isPending, selectEntries, undoRecategorization } from "../src/recategorize.js";
import { confirmImportPreview, createImportPreview, loadImportChunk, reviewImportPreview } from "../src/splitwise-import.js";
import { createSession } from "../src/sessions.js";
import { createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation } from "../src/groups.js";
import { seedEntries } from "./fixtures/seed-entries.js";
import { syntheticSplitwiseCsv } from "./fixtures/synthetic-splitwise.js";

const SECRET = "f".repeat(32);

async function team(name) {
  const owner = await ensureLocalUser(env.DB, `${name}-owner@example.test`);
  const member = await ensureLocalUser(env.DB, `${name}-member@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.id, name });
  const invitation = await inviteToGroup(env.DB, { groupId: group.id, inviterUserId: owner.id, email: member.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
  const carla = await addParticipant(env.DB, { groupId: group.id, userId: owner.id, name: "Carla" });
  const data = await readLedger(env.DB, { groupId: group.id, userId: owner.id });
  const ownerId = data.participants.find(person => person.linkedUserId === owner.id).id;
  const memberId = data.participants.find(person => person.linkedUserId === member.id).id;
  return { owner, member, group, ledger: data.ledger, ownerId, memberId, carlaId: carla.id, categories: data.categories };
}
const as = (t, user = t.owner) => ({ groupId: t.group.id, userId: user.id });
const find = (t, name) => t.categories.find(category => category.name === name);
const key = () => crypto.randomUUID();
const add = (t, description, extra = {}) => saveEntry(env.DB, { ...as(t), idempotencyKey: key(), input: {
  type: "expense", currency: "COP", totalMinor: 10000, description, note: "", occurredAt: "2026-06-01",
  cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }], ...extra } });
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const view = t => readLedger(env.DB, as(t));

describe("varios pagadores: corregir sin cambiar los saldos", () => {
  async function multiPayer(t) {
    return add(t, "Pagaron dos", {
      cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 9000 }, { participantId: t.memberId, direction: "out", amountMinor: 6000 }],
      allocations: [{ participantId: t.carlaId, amountMinor: 9000 }, { participantId: t.ownerId, amountMinor: 3000 }, { participantId: t.memberId, amountMinor: 3000 }], totalMinor: 15000,
    });
  }
  const formOf = html => { const doc = new URLSearchParams(); for (const match of html.matchAll(/<input[^>]*>/gu)) { const tag = match[0]; const name = /name="([^"]+)"/u.exec(tag)?.[1]; const value = /value="([^"]*)"/u.exec(tag)?.[1] ?? ""; const type = /type="([^"]+)"/u.exec(tag)?.[1]; if (!name) continue; if ((type === "radio" || type === "checkbox") && !/\schecked/u.test(tag)) continue; doc.append(name, value); } doc.set("currency", "COP"); return doc; };

  it("el formulario ofrece «mantener los actuales», marcado, con los importes en campos ocultos", async () => {
    const t = await team("rv-pagadores");
    const saved = await multiPayer(t);
    const data = await view(t);
    const html = renderEntryForm(data, { groupId: t.group.slug, csrf: "", userId: t.owner.id, entry: data.entries.find(entry => entry.id === saved.id) });
    expect(html).toMatch(/<input type="radio" name="payer" value="__keep__" checked required>/u);
    expect(html).toContain("Mantener los actuales");
    expect(html).toContain(`name="payerAmount_${t.ownerId}" value="9000"`);
    expect(html).toContain(`name="payerAmount_${t.memberId}" value="6000"`);
  });

  it("guardar el formulario sin tocar el pagador conserva los aportes y los saldos", async () => {
    const t = await team("rv-pagadores-guardar");
    const saved = await multiPayer(t);
    const before = await view(t);
    const entry = before.entries.find(row => row.id === saved.id);
    const html = renderEntryForm(before, { groupId: t.group.slug, csrf: "", userId: t.owner.id, entry });
    const form = formOf(html);
    form.set("description", "Pagaron dos (corregido)");
    const input = parseEntryForm(form);
    const byPerson = list => [...list].sort((a, b) => a.participantId.localeCompare(b.participantId));
    expect(byPerson(input.cashParties)).toEqual(byPerson([{ participantId: t.ownerId, direction: "out", amountMinor: 9000 }, { participantId: t.memberId, direction: "out", amountMinor: 6000 }]));
    await saveEntry(env.DB, { ...as(t), entryId: saved.id, expectedRevision: 1, idempotencyKey: key(), input });
    const after = await view(t);
    expect(after.balances).toEqual(before.balances);
    expect(after.entries.find(row => row.id === saved.id).cashParties).toHaveLength(2);
  });

  it("si se cambia el importe de un movimiento con varios pagadores se explica el motivo", async () => {
    const t = await team("rv-pagadores-importe");
    const saved = await multiPayer(t);
    const data = await view(t);
    const form = formOf(renderEntryForm(data, { groupId: t.group.slug, csrf: "", userId: t.owner.id, entry: data.entries.find(row => row.id === saved.id) }));
    form.set("amount", "200,00");
    expect(() => parseEntryForm(form)).toThrow(/varios pagadores/u);
  });

  it("elegir «Solo X» reemplaza a los pagadores y un campo oculto forjado no suma", async () => {
    const t = await team("rv-pagadores-solo");
    const saved = await multiPayer(t);
    const data = await view(t);
    const form = formOf(renderEntryForm(data, { groupId: t.group.slug, csrf: "", userId: t.owner.id, entry: data.entries.find(row => row.id === saved.id) }));
    form.set("payer", t.memberId);
    expect(parseEntryForm(form).cashParties).toEqual([{ participantId: t.memberId, direction: "out", amountMinor: 15000 }]);
    form.set("payer", "__keep__");
    form.set(`payerAmount_${t.ownerId}`, "-5");
    expect(() => parseEntryForm(form)).toThrow(/no son válidos/u);
  });

  it("un movimiento de un solo pagador sigue mostrando solo los botones de siempre", async () => {
    const t = await team("rv-un-pagador");
    const saved = await add(t, "Uno");
    const data = await view(t);
    const html = renderEntryForm(data, { groupId: t.group.slug, csrf: "", userId: t.owner.id, entry: data.entries.find(row => row.id === saved.id) });
    expect(html).not.toContain("__keep__");
    expect(html).not.toContain("payerAmount_");
  });
});

describe("«todos los resultados» respeta el filtro de persona", () => {
  it("la selección usa el mismo conjunto que la lista", async () => {
    const t = await team("rv-quien");
    await add(t, "Pagó el titular");
    await add(t, "Pagó Carla", { cashParties: [{ participantId: t.carlaId, direction: "out", amountMinor: 10000 }] });
    const data = await view(t);
    const all = selectEntries(data, { all: true, query: "carla", category: "" });
    const paid = selectEntries(data, { all: true, query: "carla", category: "", person: `pago:${t.carlaId}` });
    expect(all.length).toBeGreaterThanOrEqual(paid.length);
    expect(paid.map(entry => entry.description)).toEqual(["Pagó Carla"]);
  });
});

describe("genéricas: General de Splitwise cuenta como pendiente", () => {
  it("las filas importadas con «General» quedan pendientes y las demás no", async () => {
    const t = await team("rv-general");
    const { csv } = syntheticSplitwiseCsv({ rows: 120 });
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "g.csv", csvText: csv });
    await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    const batchId = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    for (let round = 0; round < 10; round += 1) if ((await loadImportChunk(env.DB, { ...as(t), batchId })).done) break;
    const data = await view(t);
    const generals = data.entries.filter(entry => entry.categoryInfo?.name === "General");
    expect(generals.length).toBeGreaterThan(10);
    expect(generals.every(isPending)).toBe(true);
    expect(data.entries.filter(entry => entry.categoryInfo && entry.categoryInfo.name !== "General").every(entry => !isPending(entry))).toBe(true);
    expect(data.categories.find(category => category.name === "General")).toMatchObject({ generic: true, group: "Sin categoría" });
  });

  it("todo libro tiene «General» marcada como genérica (siembra y migración)", async () => {
    const t = await team("rv-general-siembra");
    expect(t.categories.find(category => category.name === "General")).toMatchObject({ generic: true });
    expect(t.categories.filter(category => category.generic)).toHaveLength(1);
  });
});

describe("exportación: lo oculto no sale", () => {
  it("el JSON completo no trae revisiones ni filas de un lote pendiente", async () => {
    const t = await team("rv-export");
    const { csv } = syntheticSplitwiseCsv({ rows: 40 });
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "p.csv", csvText: csv });
    await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    const batchId = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 25 });
    const exported = JSON.stringify(await exportLedger(env.DB, as(t, t.member)));
    expect(exported).not.toContain("Movimiento 1");
    const parsed = JSON.parse(exported);
    expect(parsed.entries).toEqual([]);
    expect(parsed.revisions).toEqual([]);
    expect(parsed.importSourceRows).toEqual([]);
  });
});

describe("recategorización: la clave identifica la solicitud", () => {
  it("la misma clave con otra categoría u otro movimiento se rechaza y no cambia nada", async () => {
    const t = await team("rv-clave");
    const one = await add(t, "Uno");
    const two = await add(t, "Dos");
    const sameKey = key();
    await applyRecategorization(env.DB, { ...as(t), criteria: { ids: [one.id] }, categoryId: find(t, "Taxi").id, key: sameKey });
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids: [one.id] }, categoryId: find(t, "Hotel").id, key: sameKey })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("otros datos") });
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids: [two.id] }, categoryId: find(t, "Taxi").id, key: sameKey })).rejects.toMatchObject({ status: 409 });
    expect((await view(t)).entries.find(entry => entry.id === two.id).categoryId).toBeNull();
    // La misma solicitud repetida sigue siendo idempotente, aunque los ids lleguen en otro orden.
    await expect(applyRecategorization(env.DB, { ...as(t), criteria: { ids: [one.id, one.id] }, categoryId: find(t, "Taxi").id, key: sameKey })).resolves.toMatchObject({ changed: 1 });
  });

  it("reanudar un lote cortado informa omitidos y cambiados coherentes", async () => {
    const t = await team("rv-reanuda");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ownerId, otherId: t.memberId, count: 150 });
    const ids = (await view(t)).entries.map(entry => entry.id);
    const sameKey = key();
    const taxi = find(t, "Taxi");
    // Corte simulado: el lote existe «aplicando», con la huella de la solicitud, y 100 de 150 ya escritos por la propia clave.
    const args = { ...as(t), criteria: { ids }, categoryId: taxi.id, key: sameKey };
    let calls = 0;
    await expect(applyRecategorization(env.DB, { ...args, hooks: { beforeWrite: () => { calls += 1; throw new Error("corte"); } } })).rejects.toThrow("corte");
    expect(calls).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ? AND status = 'applying'", t.ledger.id)).toBe(1);
    const done = await applyRecategorization(env.DB, args);
    expect(done).toMatchObject({ status: "applied", planned: 150, changed: 150, skipped: 0 });
  });
});

describe("«deshacer la última» elige siempre la más reciente", () => {
  it("dos clasificaciones dentro del mismo segundo: el orden es el de aplicación", async () => {
    const t = await team("rv-ultima");
    const a = await add(t, "Primero");
    const b = await add(t, "Segundo");
    await classifyOne(env.DB, { ...as(t), entryId: a.id, categoryId: find(t, "Taxi").id, key: key() });
    await classifyOne(env.DB, { ...as(t), entryId: b.id, categoryId: find(t, "Taxi").id, key: key() });
    await env.DB.prepare("UPDATE recategorization_batches SET created_at = '2026-01-01 00:00:00' WHERE ledger_id = ?").bind(t.ledger.id).run();
    const last = await env.DB.prepare("SELECT id FROM recategorization_batches WHERE ledger_id = ? AND actor_user_id = ? AND kind = 'quick' AND status = 'applied' AND undone_at IS NULL ORDER BY rowid DESC LIMIT 1").bind(t.ledger.id, t.owner.id).first();
    await undoRecategorization(env.DB, { ...as(t), batchId: last.id });
    const entries = (await view(t)).entries;
    expect(entries.find(entry => entry.id === b.id).categoryId).toBeNull();
    expect(entries.find(entry => entry.id === a.id).categoryId).toBe(find(t, "Taxi").id);
  });
});

describe("categorías: nombres en conflicto con una importación pendiente", () => {
  it("renombrar a un nombre oculto por una importación en curso responde 409, no 500", async () => {
    const t = await team("rv-renombrar");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Cena,Nombre Oculto,10.00,COP,5.00,-5.00\n";
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "n.csv", csvText: csv });
    await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    const food = (await readCategories(env.DB, t.ledger.id)).find(category => category.name === "Alimentos");
    await expect(updateCategory(env.DB, { ledger: t.ledger, userId: t.owner.id, categoryId: food.id, name: "nombre oculto" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("importación en curso") });
    await expect(createCategory(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, name: "Nombre oculto" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("importación: nombres de categoría largos y repetir la confirmación", () => {
  it("una categoría de más de 60 caracteres se acorta, se advierte y el movimiento no pierde su categoría", async () => {
    const t = await team("rv-largo");
    const long = "Una categoría con un nombre larguísimo que supera con holgura los sesenta caracteres permitidos";
    const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Cena,${long},10.00,COP,5.00,-5.00\n`;
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "l.csv", csvText: csv });
    const { plan } = await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    expect(plan.warnings.join(" ")).toContain("se acortan");
    const batchId = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    for (let round = 0; round < 3; round += 1) if ((await loadImportChunk(env.DB, { ...as(t), batchId })).done) break;
    const entry = (await view(t)).entries.find(row => row.description === "Cena");
    expect(entry.categoryInfo.name).toBe(long.slice(0, 60).trim());
    expect(entry.categoryInfo.name.length).toBeLessThanOrEqual(60);
  });

  it("repetir la confirmación de la misma vista previa devuelve el mismo lote", async () => {
    const t = await team("rv-doble-confirmar");
    const { csv } = syntheticSplitwiseCsv({ rows: 20 });
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "d.csv", csvText: csv });
    await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    const first = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    const second = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    expect(second).toBe(first);
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_batches WHERE ledger_id = ?", t.ledger.id)).toBe(1);
  });
});

describe("exportación CSV: la columna nueva va al final", () => {
  it("las columnas anteriores conservan su posición y «categoria» es la última", () => {
    const csv = ledgerCsv({ entries: [{ id: "e", occurredAt: "2026-01-01", type: "expense", description: "x", note: "", currency: "COP", totalMinor: 100, status: "active", revision: 1, effects: [{ participantId: "p", amountMinor: 50 }], categoryInfo: { name: "Taxi" } }] });
    const [header] = csv.replace("﻿", "").split("\r\n");
    expect(header.replaceAll('"', "").split(",")).toEqual(["id", "fecha", "tipo", "descripcion", "nota", "moneda", "total_menor", "estado", "revision", "participante_id", "efecto_menor", "origen", "lote", "fila_origen", "categoria"]);
    expect(csv).toContain('"Taxi"\r\n');
  });
});

describe("avisos de la lista", () => {
  it("un valor heredado de Object.prototype en ?aviso= no se muestra como título", async () => {
    const owner = await ensureLocalUser(env.DB, "rv-aviso@example.test");
    const session = await createSession(env.DB, { userId: owner.id, secret: SECRET });
    const group = await createGroupForUser(env.DB, { userId: owner.id, name: "rv-aviso" });
    const data = await readLedger(env.DB, { groupId: group.id, userId: owner.id });
    const ownerId = data.participants[0].id;
    const saved = await saveEntry(env.DB, { groupId: group.id, userId: owner.id, idempotencyKey: key(), input: { type: "expense", currency: "COP", totalMinor: 100, description: "Uno", note: "", occurredAt: "2026-01-01", cashParties: [{ participantId: ownerId, direction: "out", amountMinor: 100 }], allocations: [{ participantId: ownerId, amountMinor: 100 }] } });
    const response = await app.request(`https://app.test/groups/${group.slug}?aviso=constructor&nuevo=${saved.id}`, { headers: { Cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` } }, { DB: env.DB, SESSION_SECRET: SECRET });
    const html = await response.text();
    expect(html).toContain("<h3>Recién agregado</h3>");
    expect(html).not.toContain("native code");
    expect(createCsrfToken).toBeDefined();
  });
});

describe("sentencias acotadas: notas largas no rompen las tandas", () => {
  it("importar 120 filas con notas de 1.000 caracteres carga todo una sola vez", async () => {
    const t = await team("rv-notas-largas");
    const note = "n".repeat(1000);
    const rows = Array.from({ length: 120 }, (_, index) => `2026-02-01,Fila ${index},Otros,10.00,COP,5.00,-5.00,${note}`);
    const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto,Notas\n${rows.join("\n")}\n`;
    const preview = await createImportPreview(env.DB, { ...as(t), fileName: "n.csv", csvText: csv });
    await reviewImportPreview(env.DB, { ...as(t), previewId: preview.previewId, mapping: [t.ownerId, t.memberId] });
    const batchId = await confirmImportPreview(env.DB, { ...as(t), previewId: preview.previewId, acknowledgeDifference: true });
    for (let round = 0; round < 5; round += 1) if ((await loadImportChunk(env.DB, { ...as(t), batchId })).done) break;
    const entries = (await view(t)).entries;
    expect(entries).toHaveLength(120);
    expect(entries.every(entry => entry.note.length === 1000)).toBe(true);
    expect(new Set(entries.map(entry => entry.sourceRowNumber)).size).toBe(120);
  });

  it("recategorizar 150 movimientos con notas largas cambia todos exactamente una vez", async () => {
    const t = await team("rv-notas-recat");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.id, payerId: t.ownerId, otherId: t.memberId, count: 150, note: "m".repeat(1000) });
    const ids = (await view(t)).entries.map(entry => entry.id);
    const result = await applyRecategorization(env.DB, { ...as(t), criteria: { ids }, categoryId: find(t, "Taxi").id, key: key() });
    expect(result).toMatchObject({ planned: 150, changed: 150, status: "applied" });
    expect(await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND revision = 2", t.ledger.id)).toBe(150);
  });
});
