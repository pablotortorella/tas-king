import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { exportLedger, readLedger, saveEntry, voidEntry } from "../src/ledger.js";
import { ledgerCsv, searchLedger } from "../src/ledger-ui.js";
import { runMaintenance } from "../src/maintenance.js";
import { createSession } from "../src/sessions.js";
import { cancelImportBatch, cancelImportPreview, confirmImportPreview, createImportPreview, loadImportChunk, readImportBatch, readImportPlan, readImportPreview, readImportProgress, readPreviewSummary, reviewImportPreview } from "../src/splitwise-import.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";
import { syntheticSplitwiseCsv } from "./fixtures/synthetic-splitwise.js";

const SECRET = "i".repeat(32);
const fixtureCsv = "Fecha,Descripción,Categoría,Coste,Moneda,Don Quijote,Sancho Panza\n"
  + "2026-01-03,Posada,Comida,80000.00,COP,40000.00,-40000.00\n"
  + "2026-01-05,Forraje,Transporte,30000.00,COP,-15000.00,15000.00\n"
  + "2026-01-08,Pago,Pago,20000.00,COP,-20000.00,20000.00\n"
  + "2026-01-11,Alquiler,Ingresos,120000.00,COP,60000.00,-60000.00\n"
  + "2026-01-14,Adelanto,Otros,50000.00,COP,25000.00,-25000.00\n"
  + "2026-01-17,Pago parcial,Pago,25000.00,COP,-25000.00,25000.00\n";

async function team(name) {
  const owner = await ensureLocalUser(env.DB, `${name}-owner@example.test`);
  const member = await ensureLocalUser(env.DB, `${name}-member@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.id, name });
  const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
  const ownerId = data.participants.find(person => person.linkedUserId === owner.id).id;
  const memberId = data.participants.find(person => person.linkedUserId === member.id).id;
  return { owner, member, space, ledger: data.ledger, ownerId, memberId };
}
const as = (t, user = t.owner) => ({ spaceId: t.space.id, userId: user.id });
const view = t => readLedger(env.DB, as(t));

async function preview(t, csvText, mapping, decisions = {}) {
  const created = await createImportPreview(env.DB, { ...as(t), fileName: "synthetic.csv", csvText });
  if (created.batchId) return created;
  const reviewed = await reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping, decisions });
  return { previewId: created.previewId, plan: reviewed.plan };
}
async function confirm(t, previewId, extra = {}) { return confirmImportPreview(env.DB, { ...as(t), previewId, acknowledgeDifference: true, ...extra }); }
async function loadAll(t, batchId, { chunk, limit = 1000 } = {}) {
  let result;
  for (let round = 0; round < limit; round += 1) {
    result = await loadImportChunk(env.DB, { ...as(t), batchId, chunk });
    if (result.done) return result;
  }
  throw new Error("la carga no termina");
}
async function importAll(t, csvText, mapping, decisions = {}, options) {
  const { previewId } = await preview(t, csvText, mapping, decisions);
  const batchId = await confirm(t, previewId);
  await loadAll(t, batchId, options);
  return batchId;
}
const count = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()).n;
const leftovers = async (t, batchId) => ({
  entries: await count("SELECT COUNT(*) AS n FROM ledger_entries WHERE import_batch_id = ?", batchId),
  revisions: await count("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND entry_id LIKE ?", t.ledger.id, `entry_imp_${batchId.replace("import_", "")}%`),
  cash: await count("SELECT COUNT(*) AS n FROM entry_cash_parties WHERE ledger_id = ? AND entry_id LIKE ?", t.ledger.id, `entry_imp_${batchId.replace("import_", "")}%`),
  allocations: await count("SELECT COUNT(*) AS n FROM entry_allocations WHERE ledger_id = ? AND entry_id LIKE ?", t.ledger.id, `entry_imp_${batchId.replace("import_", "")}%`),
  sources: await count("SELECT COUNT(*) AS n FROM import_source_rows WHERE batch_id = ?", batchId),
  rows: await count("SELECT COUNT(*) AS n FROM splitwise_import_rows WHERE owner_id = ?", batchId),
  pendingPeople: await count("SELECT COUNT(*) AS n FROM ledger_participants WHERE pending_import_batch_id = ?", batchId),
  pendingCategories: await count("SELECT COUNT(*) AS n FROM ledger_categories WHERE pending_import_batch_id = ?", batchId),
  batch: await count("SELECT COUNT(*) AS n FROM splitwise_import_batches WHERE id = ?", batchId),
});
const ZERO = { entries: 0, revisions: 0, cash: 0, allocations: 0, sources: 0, rows: 0, pendingPeople: 0, pendingCategories: 0, batch: 0 };

describe("importación de Splitwise: vista previa", () => {
  it("previsualiza un archivo de 2.485 filas sin crear movimientos y guarda las filas una por una", async () => {
    const t = await team("imp-prev-escala");
    const { csv } = syntheticSplitwiseCsv({ rows: 2485 });
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "real-like.csv", csvText: csv });
    const loaded = await readImportPreview(env.DB, { ...as(t), previewId: created.previewId });
    expect(loaded.meta.counts).toEqual({ movements: 2485, incidents: 0, summaries: 1 });
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_rows WHERE owner_id = ?", created.previewId)).toBe(2486);
    expect((await view(t)).entries).toHaveLength(0);
    const meta = await env.DB.prepare("SELECT length(parsed_json) AS size FROM splitwise_import_previews WHERE id = ?").bind(created.previewId).first();
    expect(meta.size).toBeLessThan(2000);
  });

  it("rechaza un archivo de más de 2 MiB con el límite en el mensaje, antes de procesarlo", async () => {
    const t = await team("imp-prev-grande");
    const big = `${fixtureCsv}${"x".repeat(2 * 1024 * 1024)}`;
    await expect(createImportPreview(env.DB, { ...as(t), fileName: "big.csv", csvText: big })).rejects.toMatchObject({ status: 413, message: expect.stringContaining("2 MiB") });
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_previews WHERE ledger_id = ?", t.ledger.id)).toBe(0);
  });

  it("reconoce el resumen con la fecha en la primera celda: no se guarda como movimiento y concilia con diferencia cero", async () => {
    const t = await team("imp-resumen");
    const { csv, people } = syntheticSplitwiseCsv({ rows: 300 });
    const { plan } = await preview(t, csv, [t.ownerId, t.memberId]);
    expect(plan.rows).toHaveLength(300);
    expect(plan.reconciliation.map(row => row.differenceMinor)).toEqual([0, 0]);
    expect(plan.warnings).toEqual([]);
    expect(people).toHaveLength(2);
  });

  it("pagina los incidentes y conserva las decisiones al cambiar de página", async () => {
    const t = await team("imp-paginar");
    const rows = Array.from({ length: 60 }, (_, index) => `2026-02-${String(1 + (index % 27)).padStart(2, "0")},Sin moneda ${index},Otros,10.00,,5.00,-5.00`);
    const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Válida,Otros,10.00,COP,5.00,-5.00\n${rows.join("\n")}\n`;
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "incidentes.csv", csvText: csv });
    const meta = (await readImportPreview(env.DB, { ...as(t), previewId: created.previewId })).meta;
    const first = await readPreviewSummary(env.DB, created.previewId, meta, { page: 1 });
    expect(first.pages).toBe(3);
    expect(first.incidents).toHaveLength(25);
    const third = await readPreviewSummary(env.DB, created.previewId, meta, { page: 3 });
    expect(third.incidents).toHaveLength(10);
    await reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: ["new", "new"], decisions: Object.fromEntries(first.incidents.map(item => [item.line, "exclude"])), partial: true });
    await reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: ["new", "new"], decisions: Object.fromEntries(third.incidents.map(item => [item.line, "assume_default"])), partial: true });
    const saved = (await readImportPreview(env.DB, { ...as(t), previewId: created.previewId })).review.decisions;
    expect(Object.keys(saved)).toHaveLength(35);
    await expect(reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: ["new", "new"] })).rejects.toThrow(/Faltan decisiones: 25/u);
  });

  it("cancelar la vista previa no deja movimientos ni filas, y solo el titular previsualiza", async () => {
    const t = await team("imp-cancelar-prev");
    await expect(createImportPreview(env.DB, { ...as(t, t.member), fileName: "no.csv", csvText: fixtureCsv })).rejects.toMatchObject({ status: 403 });
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "cancel.csv", csvText: fixtureCsv });
    await cancelImportPreview(env.DB, { ...as(t), previewId: created.previewId });
    await expect(readImportPreview(env.DB, { ...as(t), previewId: created.previewId })).rejects.toMatchObject({ status: 404 });
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_rows WHERE owner_id = ?", created.previewId)).toBe(0);
    expect((await view(t)).entries).toHaveLength(0);
  });
});

describe("importación de Splitwise: conversión en movimientos normales", () => {
  it("cada fila queda como un gasto con pagadores, reparto, revisión inicial, fila de origen y los mismos efectos", async () => {
    const t = await team("imp-normal");
    const batchId = await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    const data = await view(t);
    expect(data.entries).toHaveLength(6);
    for (const entry of data.entries) {
      expect(entry).toMatchObject({ type: "expense", importBatchId: batchId, inferred: true, status: "active", revision: 1 });
      expect(entry.cashParties.length).toBeGreaterThan(0);
      expect(entry.allocations.length).toBeGreaterThan(0);
    }
    const posada = data.entries.find(entry => entry.description === "Posada");
    expect(posada.effects.find(effect => effect.participantId === t.ownerId).amountMinor).toBe(4000000);
    expect(posada.cashParties).toEqual([{ participantId: t.ownerId, direction: "out", amountMinor: 8000000 }]);
    expect(posada.sourceRowNumber).toBe(2);
    expect(data.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(6500000);
    expect(data.balances.find(row => row.participantId === t.memberId).amountMinor).toBe(-6500000);
    const source = await env.DB.prepare("SELECT raw_json FROM import_source_rows WHERE entry_id = ?").bind(posada.id).first();
    expect(JSON.parse(source.raw_json)).toMatchObject({ line: 2, description: "Posada", totalMinor: 8000000 });
    const revision = await env.DB.prepare("SELECT action, snapshot_json FROM entry_revisions WHERE entry_id = ?").bind(posada.id).first();
    expect(revision.action).toBe("created");
    expect(JSON.parse(revision.snapshot_json)).toMatchObject({ type: "expense", description: "Posada", categoryName: "Comida" });
  });

  it("los saldos importados coinciden con los efectos del archivo en un export de 2.485 filas", async () => {
    const t = await team("imp-saldos-escala");
    const { csv, balances } = syntheticSplitwiseCsv({ rows: 2485 });
    await importAll(t, csv, [t.ownerId, t.memberId]);
    const data = await view(t);
    expect(data.entries).toHaveLength(2485);
    expect(data.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(balances[0]);
    expect(data.balances.find(row => row.participantId === t.memberId).amountMinor).toBe(balances[1]);
    expect(data.entries.filter(entry => entry.description === "Movimiento 8")).toHaveLength(1);
    const noEffect = data.entries.find(entry => entry.description === "Movimiento 8");
    expect(noEffect.effects.filter(effect => effect.amountMinor !== 0)).toEqual([]);
    expect(noEffect.cashParties).toEqual([{ participantId: t.ownerId, direction: "out", amountMinor: noEffect.totalMinor }]);
  }, 120000);

  it("dos columnas del archivo asociadas a la misma persona se juntan sin romper los saldos", async () => {
    const t = await team("imp-misma-persona");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Ana Bis,Beto\n2026-03-01,Cena,Comida,90.00,COP,30.00,15.00,-45.00\n";
    const batchId = await importAll(t, csv, [t.ownerId, t.ownerId, t.memberId]);
    const entry = (await view(t)).entries[0];
    expect(entry.importBatchId).toBe(batchId);
    expect(Object.fromEntries(entry.effects.map(effect => [effect.participantId, effect.amountMinor]))).toEqual({ [t.ownerId]: 4500, [t.memberId]: -4500 });
  });

  it("una fila cuyo efecto a favor supera el total es un incidente que se excluye, y la conciliación muestra la diferencia", async () => {
    const t = await team("imp-efecto-mayor");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Normal,Otros,10.00,COP,5.00,-5.00\n2026-01-02,Imposible,Otros,10.00,COP,15.00,-15.00\nSaldo total,,,,COP,20.00,-20.00\n";
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "mayor.csv", csvText: csv });
    const meta = (await readImportPreview(env.DB, { ...as(t), previewId: created.previewId })).meta;
    expect(meta.counts).toMatchObject({ movements: 1, incidents: 1 });
    const incident = (await readPreviewSummary(env.DB, created.previewId, meta)).incidents[0];
    expect(incident).toMatchObject({ line: 3, reason: expect.stringContaining("supera el total") });
    const { plan } = await reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: [t.ownerId, t.memberId], decisions: { 3: "exclude" } });
    expect(plan.rows).toHaveLength(1);
    expect(plan.excluded).toEqual([{ line: 3, reason: expect.stringContaining("supera") }]);
    expect(plan.reconciliation.find(row => row.sourceName === "Ana").differenceMinor).toBe(-1500);
  });

  it("permite un supuesto explícito, excluye una fila y deja ambos en el resumen del lote", async () => {
    const t = await team("imp-incidentes");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Comida,Comida,10.00,COP,5.00,-5.00\n2026-01-02,Taxi,Viaje,20.00,,10.00,-10.00\n2026-01-03,Error,Otros,8.00,COP,3.00,-2.00\nSaldo total,,,,COP,20.00,-20.00\n";
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "incidents.csv", csvText: csv });
    const meta = (await readImportPreview(env.DB, { ...as(t), previewId: created.previewId })).meta;
    expect((await readPreviewSummary(env.DB, created.previewId, meta)).incidents.map(row => row.line)).toEqual([3, 4]);
    const { plan } = await reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: ["new", "new"], decisions: { 3: "assume_default", 4: "exclude" } });
    expect(plan.rows).toHaveLength(2);
    expect(plan.reconciliation.find(row => row.sourceName === "Ana").differenceMinor).toBe(-500);
    await expect(confirmImportPreview(env.DB, { ...as(t), previewId: created.previewId })).rejects.toThrow("diferencias");
    const batchId = await confirm(t, created.previewId);
    await loadAll(t, batchId);
    const batch = await readImportBatch(env.DB, { ...as(t), batchId });
    expect(batch).toMatchObject({ importedCount: 2, assumptions: [{ line: 3 }], excluded: [{ line: 4 }] });
    const data = await view(t);
    expect(data.participants).toHaveLength(4);
    expect(data.entries.map(entry => entry.description).sort()).toEqual(["Comida", "Taxi"]);
    expect(data.entries.find(entry => entry.description === "Taxi").currency).toBe("COP");
  });

  it("importa el texto de comentario como nota sin tocar la descripción", async () => {
    const t = await team("imp-notas");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto,Notas\n2026-01-01,Supermercado,Alimentos,10.00,COP,5.00,-5.00,Pagado con la tarjeta del súper\n2026-01-02,Taxi,Taxi,20.00,COP,10.00,-10.00,\n";
    await importAll(t, csv, [t.ownerId, t.memberId]);
    const entries = (await view(t)).entries;
    expect(entries.find(entry => entry.description === "Supermercado")).toMatchObject({ note: "Pagado con la tarjeta del súper", description: "Supermercado" });
    expect(entries.find(entry => entry.description === "Taxi").note).toBe("");
  });

  it("las categorías del archivo se reconocen por nombre normalizado y las nuevas se crean al publicar", async () => {
    const t = await team("imp-categorias");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Cena,restaurantes,10.00,COP,5.00,-5.00\n2026-01-02,Rareza,Categoría Nueva De Prueba,10.00,COP,5.00,-5.00\n2026-01-03,Sin,,10.00,COP,5.00,-5.00\n";
    const { previewId } = await preview(t, csv, [t.ownerId, t.memberId]);
    const before = (await view(t)).categories.length;
    const batchId = await confirm(t, previewId);
    expect((await view(t)).categories).toHaveLength(before);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_categories WHERE pending_import_batch_id = ?", batchId)).toBe(1);
    await loadAll(t, batchId);
    const data = await view(t);
    expect(data.categories).toHaveLength(before + 1);
    const byDescription = name => data.entries.find(entry => entry.description === name).categoryInfo;
    expect(byDescription("Cena")).toMatchObject({ name: "Restaurantes", group: "Comidas y bebidas" });
    expect(byDescription("Rareza")).toMatchObject({ name: "Categoría Nueva De Prueba", group: "Importadas de Splitwise" });
    expect(byDescription("Sin")).toBeNull();
  });
});

describe("importación de Splitwise: carga por etapas", () => {
  it("al confirmar queda un lote pendiente y el libro no cambia: ni movimientos, ni saldos, ni personas, ni categorías", async () => {
    const t = await team("imp-pendiente");
    const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Nueva Persona\n2026-01-01,Cena,Categoría Escondida,10.00,COP,5.00,-5.00\n";
    const before = await view(t);
    const { previewId } = await preview(t, csv, [t.ownerId, "new"]);
    const batchId = await confirm(t, previewId);
    const after = await view(t);
    expect(after.entries).toEqual(before.entries);
    expect(after.balances).toEqual(before.balances);
    expect(after.participants).toEqual(before.participants);
    expect(after.categories).toEqual(before.categories);
    expect(await readImportProgress(env.DB, { ...as(t), batchId })).toMatchObject({ status: "pending", planned: 1, loaded: 0 });
    expect((await readImportPreview(env.DB, { ...as(t), previewId })).batchId).toBe(batchId);
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_rows WHERE owner_id = ?", batchId)).toBe(1);
  });

  it("una tanda crea movimiento, revisión, pagadores, reparto y fila de origen, y las tandas siguientes retoman donde quedó", async () => {
    const t = await team("imp-tanda");
    const { csv } = syntheticSplitwiseCsv({ rows: 40 });
    const { previewId } = await preview(t, csv, [t.ownerId, t.memberId]);
    const batchId = await confirm(t, previewId);
    const first = await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 15 });
    expect(first).toEqual({ status: "pending", loaded: 15, planned: 40, done: false });
    const snapshot = await leftovers(t, batchId);
    expect(snapshot).toMatchObject({ entries: 15, revisions: 15, sources: 15 });
    const second = await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 15 });
    expect(second).toMatchObject({ loaded: 30, done: false });
    await loadAll(t, batchId, { chunk: 15 });
    expect(await count("SELECT COUNT(*) AS n FROM ledger_entries WHERE import_batch_id = ?", batchId)).toBe(40);
    expect(await count("SELECT COUNT(DISTINCT source_row_number) AS n FROM ledger_entries WHERE import_batch_id = ?", batchId)).toBe(40);
  });

  it("dos tandas al mismo tiempo no duplican movimientos", async () => {
    const t = await team("imp-paralelas");
    const { csv } = syntheticSplitwiseCsv({ rows: 60 });
    const { previewId } = await preview(t, csv, [t.ownerId, t.memberId]);
    const batchId = await confirm(t, previewId);
    await Promise.all([loadImportChunk(env.DB, { ...as(t), batchId, chunk: 30 }), loadImportChunk(env.DB, { ...as(t), batchId, chunk: 30 })]);
    await Promise.all([loadImportChunk(env.DB, { ...as(t), batchId, chunk: 30 }), loadImportChunk(env.DB, { ...as(t), batchId, chunk: 30 })]);
    await loadAll(t, batchId, { chunk: 30 });
    const data = await view(t);
    expect(data.entries).toHaveLength(60);
    expect(await count("SELECT COUNT(*) AS n FROM import_source_rows WHERE batch_id = ?", batchId)).toBe(60);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_events WHERE ledger_id = ? AND action = 'splitwise_import_committed'", t.ledger.id)).toBe(1);
  });

  it("reanuda desde lo cargado: interrumpir tras una tanda y continuar termina con todos los movimientos una sola vez", async () => {
    const t = await team("imp-reanudar");
    const { csv, balances } = syntheticSplitwiseCsv({ rows: 90 });
    const { previewId } = await preview(t, csv, [t.ownerId, t.memberId]);
    const batchId = await confirm(t, previewId);
    await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 40 });
    expect(await readImportProgress(env.DB, { ...as(t), batchId })).toMatchObject({ status: "pending", loaded: 40 });
    // «Se cierra la pestaña»: nada en memoria, solo lo que hay en la base.
    await loadAll(t, batchId, { chunk: 40 });
    const data = await view(t);
    expect(data.entries).toHaveLength(90);
    expect(new Set(data.entries.map(entry => entry.sourceRowNumber)).size).toBe(90);
    expect(data.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(balances[0]);
  });

  it("el lote se publica en un solo paso: antes no hay datos visibles en ninguna vista y después están todos", async () => {
    const t = await team("imp-atomica");
    const { csv } = syntheticSplitwiseCsv({ rows: 50 });
    const { previewId } = await preview(t, csv, [t.ownerId, "new"]);
    const batchId = await confirm(t, previewId);
    const secret = await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 49 });
    expect(secret).toMatchObject({ done: false, loaded: 49 });
    const hidden = await env.DB.prepare("SELECT id FROM ledger_entries WHERE import_batch_id = ? LIMIT 1").bind(batchId).first();
    const owner = await identity(t.owner);
    const get = path => app.request(`https://app.test${path}`, { headers: { Cookie: owner.cookie } }, { DB: env.DB, SESSION_SECRET: SECRET });
    const base = `/spaces/${t.space.slug}`;
    expect((await view(t)).entries).toHaveLength(0);
    expect((await exportLedger(env.DB, as(t))).entries).toHaveLength(0);
    expect((await exportLedger(env.DB, as(t))).importSourceRows).toEqual([]);
    expect(searchLedger((await view(t)).entries, [], "Movimiento")).toEqual([]);
    expect((await get(`${base}/ledger/entries/${hidden.id}`)).status).toBe(404);
    expect((await get(`${base}/ledger/entries/${hidden.id}/edit`)).status).toBe(404);
    expect((await (await get(`${base}/ledger/export.csv`)).text()).split("\r\n").filter(Boolean)).toHaveLength(1);
    expect((await (await get(base)).text())).not.toContain("Movimiento 1<");
    expect(await saveEntryAttempt(t, hidden.id)).toMatchObject({ status: 404 });
    expect(await voidAttempt(t, hidden.id)).toMatchObject({ status: 404 });
    expect((await view(t)).participants.map(person => person.displayName)).not.toContain("Beto Prueba");
    const last = await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 49 });
    expect(last).toMatchObject({ done: true, status: "committed", loaded: 50 });
    const published = await view(t);
    expect(published.entries).toHaveLength(50);
    expect(published.participants.map(person => person.displayName)).toContain("Beto Prueba");
    expect((await get(`${base}/ledger/entries/${hidden.id}`)).status).toBe(200);
    expect(await count("SELECT COUNT(*) AS n FROM splitwise_import_rows WHERE owner_id = ?", batchId)).toBe(0);
  });

  it("cancelar descarta todo lo cargado, incluidas las personas y categorías nuevas, y el libro queda como estaba", async () => {
    const t = await team("imp-cancelar");
    const csv = `${syntheticSplitwiseCsv({ rows: 30, people: ["Ana Prueba", "Persona Nueva"] }).csv.trimEnd()}\n2026-12-31,Con categoría nueva,Categoría Efímera,5.00,COP,2.50,-2.50\n`;
    const before = await view(t);
    const { previewId } = await preview(t, csv, [t.ownerId, "new"]);
    const batchId = await confirm(t, previewId);
    await loadImportChunk(env.DB, { ...as(t), batchId, chunk: 20 });
    expect((await leftovers(t, batchId)).entries).toBe(20);
    await cancelImportBatch(env.DB, { ...as(t), batchId });
    expect(await leftovers(t, batchId)).toEqual(ZERO);
    const after = await view(t);
    expect(after.entries).toEqual(before.entries);
    expect(after.participants).toEqual(before.participants);
    expect(after.categories).toEqual(before.categories);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_participants WHERE ledger_id = ? AND display_name = 'Persona Nueva'", t.ledger.id)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM ledger_categories WHERE ledger_id = ? AND name = 'Categoría Efímera'", t.ledger.id)).toBe(0);
  });

  it("el mantenimiento diario descarta una carga abandonada hace más de un día y respeta la que avanzó hoy", async () => {
    const abandoned = await team("imp-abandonada");
    const active = await team("imp-activa");
    const { csv } = syntheticSplitwiseCsv({ rows: 30 });
    const stale = await confirm(abandoned, (await preview(abandoned, csv, [abandoned.ownerId, "new"])).previewId);
    await loadImportChunk(env.DB, { ...as(abandoned), batchId: stale, chunk: 10 });
    const fresh = await confirm(active, (await preview(active, csv, [active.ownerId, "new"])).previewId);
    await loadImportChunk(env.DB, { ...as(active), batchId: fresh, chunk: 10 });
    await env.DB.prepare("UPDATE ledger_entries SET created_at = datetime('now', '-3 days') WHERE import_batch_id = ?").bind(stale).run();
    await env.DB.prepare("UPDATE splitwise_import_batches SET created_at = datetime('now', '-3 days') WHERE id = ?").bind(stale).run();
    const result = await runMaintenance(env.DB);
    expect(result.deletedPendingImports).toBeGreaterThanOrEqual(1);
    expect(await leftovers(abandoned, stale)).toEqual(ZERO);
    expect((await leftovers(active, fresh)).entries).toBe(10);
    // Un lote viejo pero que avanzó hoy no se descarta.
    await env.DB.prepare("UPDATE splitwise_import_batches SET created_at = datetime('now', '-3 days') WHERE id = ?").bind(fresh).run();
    await runMaintenance(env.DB);
    expect((await leftovers(active, fresh)).entries).toBe(10);
  });

  it("rechaza un segundo lote, no admite otra importación con una pendiente y devuelve el mismo lote al repetir la confirmación", async () => {
    const t = await team("imp-un-lote");
    const csvA = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Uno,Otros,10.00,COP,5.00,-5.00\n";
    const csvB = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-02,Dos,Otros,10.00,COP,5.00,-5.00\n";
    const a = await preview(t, csvA, [t.ownerId, t.memberId]);
    const b = await preview(t, csvB, [t.ownerId, t.memberId]);
    const batchId = await confirm(t, a.previewId);
    // Repetir la confirmación (doble clic, reintento) devuelve el mismo lote en lugar de un error.
    expect(await confirm(t, a.previewId)).toBe(batchId);
    await expect(cancelImportPreview(env.DB, { ...as(t), previewId: a.previewId })).rejects.toMatchObject({ status: 409 });
    await expect(confirm(t, b.previewId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("en curso") });
    await loadAll(t, batchId);
    await expect(confirm(t, b.previewId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("reimportaciones") });
    const repeat = await createImportPreview(env.DB, { ...as(t), fileName: "again.csv", csvText: csvA });
    expect(repeat).toEqual({ batchId });
  });

  it("el solapamiento se evalúa solo contra movimientos propios y un libro con un lote publicado acepta movimientos nuevos", async () => {
    const t = await team("imp-solape");
    const own = (day, description) => saveEntry(env.DB, { ...as(t), idempotencyKey: crypto.randomUUID(), input: {
      type: "expense", currency: "COP", totalMinor: 10000, description, note: "", occurredAt: day,
      cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }],
    } });
    await own("2026-03-01", "Propio");
    const overlapping = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-03-15,Solapado,Otros,10.00,COP,5.00,-5.00\n";
    const created = await createImportPreview(env.DB, { ...as(t), fileName: "solape.csv", csvText: overlapping });
    await expect(reviewImportPreview(env.DB, { ...as(t), previewId: created.previewId, mapping: [t.ownerId, t.memberId] })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("2026-03-01") });
    const earlier = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-10,Anterior,Otros,10.00,COP,5.00,-5.00\n";
    await importAll(t, earlier, [t.ownerId, t.memberId]);
    await own("2026-04-01", "Nuevo después de importar");
    expect((await view(t)).entries).toHaveLength(3);
  });

  it("solo el titular carga, ve el avance y cancela", async () => {
    const t = await team("imp-permisos");
    const { csv } = syntheticSplitwiseCsv({ rows: 10 });
    const batchId = await confirm(t, (await preview(t, csv, [t.ownerId, t.memberId])).previewId);
    await expect(loadImportChunk(env.DB, { ...as(t, t.member), batchId })).rejects.toMatchObject({ status: 403 });
    await expect(readImportProgress(env.DB, { ...as(t, t.member), batchId })).rejects.toMatchObject({ status: 403 });
    await expect(cancelImportBatch(env.DB, { ...as(t, t.member), batchId })).rejects.toMatchObject({ status: 403 });
    const stranger = await ensureLocalUser(env.DB, "imp-permisos-extraño@example.test");
    await expect(loadImportChunk(env.DB, { spaceId: t.space.id, userId: stranger.id, batchId })).rejects.toMatchObject({ status: 404 });
    await cancelImportBatch(env.DB, { ...as(t), batchId });
  });

  it("una importación publicada no se cancela", async () => {
    const t = await team("imp-publicada-no-cancela");
    const batchId = await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    await expect(cancelImportBatch(env.DB, { ...as(t), batchId })).rejects.toMatchObject({ status: 409 });
    expect((await view(t)).entries).toHaveLength(6);
  });
});

describe("movimientos importados: lo inferido se marca y se puede corregir", () => {
  it("corregir el pagador crea una revisión y quita la marca; corregir otra cosa la conserva", async () => {
    const t = await team("imp-inferido");
    await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    const entry = (await view(t)).entries.find(row => row.description === "Posada");
    expect(entry.inferred).toBe(true);
    const input = overrides => ({ type: "expense", currency: "COP", totalMinor: entry.totalMinor, description: entry.description, note: "", occurredAt: entry.occurredAt, cashParties: entry.cashParties.map(party => ({ ...party })), allocations: entry.allocations.map(share => ({ ...share })), ...overrides });
    await saveEntry(env.DB, { ...as(t), entryId: entry.id, expectedRevision: 1, idempotencyKey: crypto.randomUUID(), input: input({ note: "Solo una nota" }) });
    const afterNote = (await view(t)).entries.find(row => row.id === entry.id);
    expect(afterNote).toMatchObject({ inferred: true, revision: 2, note: "Solo una nota" });
    await saveEntry(env.DB, { ...as(t), entryId: entry.id, expectedRevision: 2, idempotencyKey: crypto.randomUUID(), input: input({ cashParties: [{ participantId: t.memberId, direction: "out", amountMinor: entry.totalMinor }] }) });
    const corrected = (await view(t)).entries.find(row => row.id === entry.id);
    expect(corrected).toMatchObject({ inferred: false, revision: 3, importBatchId: expect.any(String), sourceRowNumber: 2 });
  });

  it("un movimiento importado se anula como cualquier otro: deja de contar y queda en el historial", async () => {
    const t = await team("imp-anular");
    await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    const before = await view(t);
    const entry = before.entries.find(row => row.description === "Posada");
    await voidEntry(env.DB, { ...as(t), entryId: entry.id, expectedRevision: 1, idempotencyKey: crypto.randomUUID(), reason: "Duplicado" });
    const after = await view(t);
    expect(after.entries.find(row => row.id === entry.id)).toMatchObject({ status: "voided", revision: 2 });
    expect(after.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(6500000 - 4000000);
    const history = (await env.DB.prepare("SELECT action FROM entry_revisions WHERE entry_id = ? ORDER BY revision").bind(entry.id).all()).results.map(row => row.action);
    expect(history).toEqual(["created", "voided"]);
  });

  it("la búsqueda por pagador indica que fue inferido y el CSV de exportación marca el origen", async () => {
    const t = await team("imp-busqueda-inferido");
    await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    const data = await view(t);
    const ownerName = data.participants.find(person => person.id === t.ownerId).displayName;
    const found = searchLedger(data.entries, data.participants, ownerName).find(row => row.description === "Posada");
    expect(found.matchReason).toContain("· inferido");
    expect(ledgerCsv(data)).toContain('"Splitwise"');
    expect(ledgerCsv(data)).toContain(`"${data.entries[0].importBatchId}"`);
  });

  it("la exportación incluye procedencia, conciliación y filas de origen con la versión de esquema 3", async () => {
    const t = await team("imp-exportar");
    const batchId = await importAll(t, fixtureCsv, [t.ownerId, t.memberId]);
    const exported = await exportLedger(env.DB, as(t));
    expect(exported.schemaVersion).toBe(3);
    expect(exported.entries.every(entry => entry.importBatchId === batchId && entry.sourceRowNumber >= 2 && entry.inferred === true)).toBe(true);
    expect(exported.imports).toHaveLength(1);
    expect(JSON.parse(exported.imports[0].reconciliation_json).rows).toBeDefined();
    expect(exported.importSourceRows).toHaveLength(6);
    expect(exported.revisions).toHaveLength(6);
  });
});

async function identity(user) {
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function saveEntryAttempt(t, entryId) {
  return saveEntry(env.DB, { ...as(t), entryId, expectedRevision: 1, idempotencyKey: crypto.randomUUID(), input: { type: "expense", currency: "COP", totalMinor: 100, description: "x", note: "", occurredAt: "2026-01-01", cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 100 }], allocations: [{ participantId: t.ownerId, amountMinor: 100 }] } }).catch(error => ({ status: error.status }));
}
function voidAttempt(t, entryId) {
  return voidEntry(env.DB, { ...as(t), entryId, expectedRevision: 1, idempotencyKey: crypto.randomUUID() }).catch(error => ({ status: error.status }));
}
