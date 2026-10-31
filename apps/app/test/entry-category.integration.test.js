import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { addParticipant, readLedger, saveEntry } from "../src/ledger.js";
import { createCategory, readCategories, mergeCategory, setCategoryArchived, updateCategory } from "../src/categories.js";
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
const find = (categories, name) => categories.find(category => category.name === name);
const row = (b, id) => env.DB.prepare("SELECT category_id FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(b.ledger.id, id).first();
const snapshot = async (b, id, revision) => JSON.parse((await env.DB.prepare("SELECT snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? AND revision = ?").bind(b.ledger.id, id, revision).first()).snapshot_json);
const reread = b => readLedger(env.DB, { groupId: b.group.id, userId: b.owner.id });

describe("categoría en los movimientos", () => {
  it("elegir una categoría la guarda, la muestra y la deja en la instantánea con su nombre", async () => {
    const b = await book("ec-elegir");
    const restaurantes = find(b.categories, "Restaurantes");
    const saved = await save(b, entry(b.people, { categoryId: restaurantes.id }));
    expect((await row(b, saved.id)).category_id).toBe(restaurantes.id);
    expect(await snapshot(b, saved.id, 1)).toMatchObject({ categoryId: restaurantes.id, categoryName: "Restaurantes" });
    const shown = (await reread(b)).entries.find(item => item.id === saved.id);
    expect(shown.categoryInfo).toMatchObject({ name: "Restaurantes", group: "Comidas y bebidas", groupKey: "comidas y bebidas", archived: false });
  });

  it("sin categoría queda sin categoría", async () => {
    const b = await book("ec-sin");
    const saved = await save(b, entry(b.people));
    expect((await row(b, saved.id)).category_id).toBeNull();
    expect((await reread(b)).entries[0].categoryInfo).toBeNull();
    expect(await snapshot(b, saved.id, 1)).toMatchObject({ categoryId: null, categoryName: null });
  });

  it("escribir un nombre nuevo crea la categoría en el libro y la asigna, con el grupo de reserva", async () => {
    const b = await book("ec-crear");
    const saved = await save(b, entry(b.people, { categoryName: "Café y panadería" }));
    const categories = await readCategories(env.DB, b.ledger.id);
    const created = find(categories, "Café y panadería");
    expect(created).toMatchObject({ group: "Mis categorías", status: "active" });
    expect((await row(b, saved.id)).category_id).toBe(created.id);
  });

  it("escribir una variante de una existente usa la existente y no crea otra", async () => {
    const b = await book("ec-variante");
    const alimentos = find(b.categories, "Alimentos");
    const saved = await save(b, entry(b.people, { categoryName: "  álimentos  " }));
    expect((await row(b, saved.id)).category_id).toBe(alimentos.id);
    expect(await readCategories(env.DB, b.ledger.id)).toHaveLength(b.categories.length);
  });

  it("repetir la solicitud con un nombre nuevo no crea dos categorías ni dos movimientos", async () => {
    const b = await book("ec-idempotencia");
    const key = crypto.randomUUID();
    const input = entry(b.people, { categoryName: "Peluquería" });
    const first = await save(b, input, { idempotencyKey: key });
    const second = await save(b, input, { idempotencyKey: key });
    expect(second).toEqual(first);
    expect((await readCategories(env.DB, b.ledger.id)).filter(category => category.name === "Peluquería")).toHaveLength(1);
    expect((await reread(b)).entries).toHaveLength(1);
  });

  it("una categoría de otro libro se rechaza y no se guarda nada", async () => {
    const mine = await book("ec-ajena-a");
    const other = await book("ec-ajena-b");
    const foreign = find(other.categories, "Restaurantes");
    await expect(save(mine, entry(mine.people, { categoryId: foreign.id }))).rejects.toThrow(/no existe en este grupo/u);
    expect((await reread(mine)).entries).toHaveLength(0);
  });

  it("una categoría inexistente se rechaza", async () => {
    const b = await book("ec-inexistente");
    await expect(save(b, entry(b.people, { categoryId: "category_nope" }))).rejects.toThrow(/no existe/u);
  });

  it("una categoría archivada no se acepta en altas nuevas pero un movimiento que ya la tenía la conserva al corregirse", async () => {
    const b = await book("ec-archivada");
    const taxi = find(b.categories, "Taxi");
    const saved = await save(b, entry(b.people, { categoryId: taxi.id }));
    await setCategoryArchived(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: taxi.id, archived: true });
    await expect(save(b, entry(b.people, { categoryId: taxi.id }))).rejects.toThrow(/archivada/u);
    await expect(save(b, entry(b.people, { categoryName: "taxi" }))).rejects.toThrow(/archivada/u);
    await save(b, entry(b.people, { description: "Cena corregida", categoryId: taxi.id }), { entryId: saved.id, expectedRevision: 1 });
    const shown = (await reread(b)).entries.find(item => item.id === saved.id);
    expect(shown.categoryInfo).toMatchObject({ name: "Taxi", archived: true });
    expect(shown.description).toBe("Cena corregida");
  });

  it("las transferencias no llevan categoría aunque el cliente la envíe", async () => {
    const b = await book("ec-transferencia");
    const saved = await save(b, { type: "transfer", currency: "COP", totalMinor: 5000, description: "Devolución", note: "", occurredAt: "2026-10-24", cashParties: [{ participantId: b.people[0].id, direction: "out", amountMinor: 5000 }, { participantId: b.people[1].id, direction: "in", amountMinor: 5000 }], allocations: [], categoryId: find(b.categories, "Taxi").id });
    expect((await row(b, saved.id)).category_id).toBeNull();
  });

  it("una llamada sin campo de categoría conserva la que tenía y un campo vacío la quita", async () => {
    const b = await book("ec-conservar");
    const taxi = find(b.categories, "Taxi");
    const saved = await save(b, entry(b.people, { categoryId: taxi.id }));
    await save(b, entry(b.people, { description: "Sin tocar categoría" }), { entryId: saved.id, expectedRevision: 1 });
    expect((await row(b, saved.id)).category_id).toBe(taxi.id);
    expect(await snapshot(b, saved.id, 2)).toMatchObject({ categoryId: taxi.id });
    await save(b, entry(b.people, { categoryId: "" }), { entryId: saved.id, expectedRevision: 2 });
    expect((await row(b, saved.id)).category_id).toBeNull();
  });
});

describe("historial y categorías", () => {
  it("cambiar la categoría crea una revisión que lo indica", async () => {
    const b = await book("hc-cambio");
    const saved = await save(b, entry(b.people, { categoryId: find(b.categories, "Taxi").id }));
    await save(b, entry(b.people, { categoryId: find(b.categories, "Hotel").id }), { entryId: saved.id, expectedRevision: 1 });
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(b.ledger.id, saved.id).all()).results;
    expect(rows).toHaveLength(2);
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: categoría");
  });

  it("repetir la misma categoría no se informa como cambio", async () => {
    const b = await book("hc-igual");
    const taxi = find(b.categories, "Taxi");
    const saved = await save(b, entry(b.people, { categoryId: taxi.id }));
    await save(b, entry(b.people, { categoryId: taxi.id, note: "ahora con nota" }), { entryId: saved.id, expectedRevision: 1 });
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(b.ledger.id, saved.id).all()).results;
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: nota");
  });

  it("renombrar la categoría no altera las revisiones pasadas pero sí lo que se muestra hoy", async () => {
    const b = await book("hc-renombrar");
    const food = find(b.categories, "Alimentos");
    const saved = await save(b, entry(b.people, { categoryId: food.id }));
    await updateCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: food.id, name: "Supermercado" });
    expect(await snapshot(b, saved.id, 1)).toMatchObject({ categoryName: "Alimentos", categoryId: food.id });
    expect((await reread(b)).entries[0].categoryInfo.name).toBe("Supermercado");
    const revisions = (await env.DB.prepare("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ?").bind(b.ledger.id).first()).n;
    expect(revisions).toBe(1);
  });

  it("los movimientos anteriores al campo no figuran como cambiados por no tener categoría", () => {
    const old = { action: "revised", snapshot_json: JSON.stringify({ description: "a" }) };
    const next = { action: "revised", snapshot_json: JSON.stringify({ description: "a", categoryId: null, categoryName: null }) };
    expect(revisionSummary(next, old)).toBe("Sin cambios de contenido");
  });
});

describe("fusión y lectura", () => {
  it("un movimiento de una categoría fusionada se muestra con la destino sin escribir ningún movimiento", async () => {
    const b = await book("fl-fusion");
    const from = find(b.categories, "Utilidades - Otro");
    const into = find(b.categories, "Suscripciones");
    const saved = await save(b, entry(b.people, { categoryId: from.id }));
    const writes = () => env.DB.prepare("SELECT updated_at, current_revision FROM ledger_entries WHERE ledger_id = ? AND id = ?").bind(b.ledger.id, saved.id).first();
    const before = await writes();
    await mergeCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: from.id, intoId: into.id });
    expect(await writes()).toEqual(before);
    const shown = (await reread(b)).entries[0];
    expect(shown.categoryInfo).toMatchObject({ id: into.id, name: "Suscripciones" });
    expect(shown.categoryId).toBe(from.id);
  });

  it("corregir un movimiento de una categoría fusionada conserva su identificador y no cuenta como cambio", async () => {
    const b = await book("fl-fusion-corregir");
    const from = find(b.categories, "Licor");
    const into = find(b.categories, "Restaurantes");
    const saved = await save(b, entry(b.people, { categoryId: from.id }));
    await mergeCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: from.id, intoId: into.id });
    await save(b, entry(b.people, { categoryId: from.id, note: "x" }), { entryId: saved.id, expectedRevision: 1 });
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(b.ledger.id, saved.id).all()).results;
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: nota");
  });

  it("escribir el nombre de una categoría fusionada asigna la destino", async () => {
    const b = await book("fl-nombre-fusionado");
    const from = find(b.categories, "Licor");
    const into = find(b.categories, "Restaurantes");
    await mergeCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: from.id, intoId: into.id });
    const saved = await save(b, entry(b.people, { categoryName: "licor" }));
    expect((await row(b, saved.id)).category_id).toBe(into.id);
  });

  it("el movimiento anterior sin categoría sigue leyéndose igual", async () => {
    const b = await book("fl-anterior");
    await env.DB.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, description, occurred_at, created_by_user_id) VALUES (?, 'viejo', 'expense', 'COP', 1000, 'Viejo', '2026-01-01', ?)").bind(b.ledger.id, b.owner.id).run();
    await env.DB.prepare("INSERT INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES (?, 'viejo', ?, 'out', 1000)").bind(b.ledger.id, b.people[0].id).run();
    await env.DB.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES (?, 'viejo', ?, 1000)").bind(b.ledger.id, b.people[0].id).run();
    const shown = (await reread(b)).entries.find(item => item.id === "viejo");
    expect(shown).toMatchObject({ categoryId: null, categoryInfo: null });
  });
});

describe("corregir un movimiento tras fusionar su categoría desde el formulario", () => {
  it("el formulario ofrece la destino y guardarla no cambia el identificador guardado ni figura como cambio", async () => {
    const b = await book("fl-fusion-formulario");
    const from = find(b.categories, "Licor");
    const into = find(b.categories, "Restaurantes");
    const saved = await save(b, entry(b.people, { categoryId: from.id }));
    await mergeCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: from.id, intoId: into.id });
    await save(b, entry(b.people, { categoryId: into.id, note: "otra cosa" }), { entryId: saved.id, expectedRevision: 1 });
    expect((await row(b, saved.id)).category_id).toBe(from.id);
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(b.ledger.id, saved.id).all()).results;
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: nota");
  });

  it("elegir una categoría distinta sí cambia y se informa", async () => {
    const b = await book("fl-fusion-distinta");
    const from = find(b.categories, "Licor");
    const into = find(b.categories, "Restaurantes");
    const saved = await save(b, entry(b.people, { categoryId: from.id }));
    await mergeCategory(env.DB, { ledger: b.ledger, userId: b.owner.id, categoryId: from.id, intoId: into.id });
    await save(b, entry(b.people, { categoryId: find(b.categories, "Taxi").id }), { entryId: saved.id, expectedRevision: 1 });
    const rows = (await env.DB.prepare("SELECT revision, action, snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? ORDER BY revision").bind(b.ledger.id, saved.id).all()).results;
    expect(revisionSummary(rows[1], rows[0])).toBe("Cambió: categoría");
  });
});
