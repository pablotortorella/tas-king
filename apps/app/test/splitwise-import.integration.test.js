import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { exportLedger, readLedger, saveEntry } from "../src/ledger.js";
import { ledgerCsv, searchLedger } from "../src/ledger-ui.js";
import { cancelImportPreview, commitImportPreview, createImportPreview, readImportBatch, readImportPreview, reviewImportPreview } from "../src/splitwise-import.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";

const fixtureCsv = "Fecha,Descripción,Categoría,Coste,Moneda,Don Quijote,Sancho Panza\n"
  + "2026-01-03,Posada,Comida,80000.00,COP,40000.00,-40000.00\n"
  + "2026-01-05,Forraje,Transporte,30000.00,COP,-15000.00,15000.00\n"
  + "2026-01-08,Pago,Pago,20000.00,COP,-20000.00,20000.00\n"
  + "2026-01-11,Alquiler,Ingresos,120000.00,COP,60000.00,-60000.00\n"
  + "2026-01-14,Adelanto,Otros,50000.00,COP,25000.00,-25000.00\n"
  + "2026-01-17,Pago parcial,Pago,25000.00,COP,-25000.00,25000.00\n";

describe("importación de Splitwise", () => {
  it("mapea dos cuentas, conserva seis efectos y no duplica un archivo repetido", async () => {
    const owner = await ensureLocalUser(env.DB, "splitwise-quijote@example.test");
    const member = await ensureLocalUser(env.DB, "splitwise-sancho@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Ruta sintética" });
    const invite = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
    await resolveInvitation(env.DB, { invitationId: invite.id, userId: member.id, email: member.email, accepted: true });
    const people = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants;
    const ownerId = people.find(p => p.linkedUserId === owner.id).id;
    const memberId = people.find(p => p.linkedUserId === member.id).id;
    const csvText = fixtureCsv;
    const first = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "synthetic.csv", csvText });
    const preview = await readImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: first.previewId });
    expect(preview.parsed.movements).toHaveLength(6);
    const { plan } = await reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: first.previewId, mapping: [ownerId, memberId], decisions: [] });
    expect(plan.totals.find(row => row.sourceName === "Don Quijote").amountMinor).toBe(6500000);
    const batchId = await commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: first.previewId, acknowledgeDifference: true });
    expect(await commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: first.previewId, acknowledgeDifference: true })).toBe(batchId);
    const repeat = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "again.csv", csvText });
    expect(repeat).toEqual({ batchId });
    const imported = await readLedger(env.DB, { spaceId: space.id, userId: member.id });
    expect(imported.entries).toHaveLength(6);
    expect(imported.entries.every(entry => entry.imported && entry.importBatchId === batchId)).toBe(true);
    expect(imported.balances.find(row => row.participantId === ownerId).amountMinor).toBe(6500000);
    expect(imported.balances.find(row => row.participantId === memberId).amountMinor).toBe(-6500000);
    expect(searchLedger(imported.entries, imported.participants, "POSADA")[0].matchReason).toBe("Descripción");
    expect(searchLedger(imported.entries, imported.participants, "quijote").length).toBeGreaterThan(0);
    expect(searchLedger(imported.entries, imported.participants, "80.000,00")[0].matchReason).toBe("Importe total");
    expect(searchLedger(imported.entries, imported.participants, "80000")[0].matchReason).toBe("Importe total");
    expect(searchLedger(imported.entries, imported.participants, "8.000")[0].matchReason).toBe("Importe total");
    expect(searchLedger(imported.entries, imported.participants, "80")[0].matchReason).toBe("Importe total");
    await saveEntry(env.DB, { spaceId: space.id, userId: owner.id, input: {
      type: "expense", currency: "COP", totalMinor: 10000, description: "Nueva compra", note: "", occurredAt: "2026-10-23",
      cashParties: [{ participantId: ownerId, direction: "out", amountMinor: 10000 }],
      allocations: [{ participantId: ownerId, amountMinor: 5000 }, { participantId: memberId, amountMinor: 5000 }],
    }, idempotencyKey: crypto.randomUUID() });
    const combined = await readLedger(env.DB, { spaceId: space.id, userId: member.id });
    expect(combined.entries).toHaveLength(7);
    expect(searchLedger(combined.entries, combined.participants, "compra")[0].imported).toBeUndefined();
    expect(combined.balances.find(row => row.participantId === ownerId).amountMinor).toBe(6505000);
    const exported = await exportLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(exported.imports).toHaveLength(1);
    expect(ledgerCsv(combined)).toContain('"Splitwise"');
    expect(ledgerCsv({ entries: [{ id: "test", occurredAt: "2026-01-01", type: "imported", description: "=HYPERLINK(1)", note: "", currency: "COP", totalMinor: 100, status: "active", revision: 1, effects: [{ participantId: ownerId, amountMinor: 100 }] }] })).toContain("'=HYPERLINK(1)");
  });

  it("permite un supuesto explícito, excluye una fila y muestra la diferencia", async () => {
    const owner = await ensureLocalUser(env.DB, "splitwise-incidents@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Incidentes" });
    const csvText = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Comida,Comida,10.00,COP,5.00,-5.00\n2026-01-02,Taxi,Viaje,20.00,,10.00,-10.00\n2026-01-03,Error,Otros,8.00,COP,3.00,-2.00\nSaldo total,,,,COP,20.00,-20.00\n";
    const created = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "incidents.csv", csvText });
    const preview = await readImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId });
    expect(preview.parsed.incidents.map(row => row.line)).toEqual([3, 4]);
    const { plan } = await reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId, mapping: ["new", "new"], decisions: ["assume_default", "exclude"] });
    expect(plan.rows).toHaveLength(2);
    expect(plan.assumptions[0].line).toBe(3);
    expect(plan.excluded[0].line).toBe(4);
    expect(plan.reconciliation.find(row => row.sourceName === "Ana").differenceMinor).toBe(-500);
    await expect(commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId })).rejects.toThrow("diferencias");
    const batchId = await commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId, acknowledgeDifference: true });
    const batch = await readImportBatch(env.DB, { spaceId: space.id, userId: owner.id, batchId });
    expect(batch).toMatchObject({ importedCount: 2, assumptions: [{ line: 3 }], excluded: [{ line: 4 }] });
    expect(batch.reconciliation.rows.find(row => row.sourceName === "Ana").differenceMinor).toBe(-500);
    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(data.participants).toHaveLength(3);
    expect(data.entries).toHaveLength(2);
    const second = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "other.csv", csvText: csvText.replace("Comida", "Cena") });
    await reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: second.previewId, mapping: ["new", "new"], decisions: ["assume_default", "exclude"] });
    await expect(commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: second.previewId, acknowledgeDifference: true })).rejects.toMatchObject({ status: 409 });
  });

  it("cancela sin guardar y restringe la vista previa al titular", async () => {
    const owner = await ensureLocalUser(env.DB, "splitwise-owner@example.test");
    const member = await ensureLocalUser(env.DB, "splitwise-member@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Cancelar" });
    const invite = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
    await resolveInvitation(env.DB, { invitationId: invite.id, userId: member.id, email: member.email, accepted: true });
    const csvText = fixtureCsv;
    await expect(createImportPreview(env.DB, { spaceId: space.id, userId: member.id, fileName: "no.csv", csvText })).rejects.toMatchObject({ status: 403 });
    const created = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "cancel.csv", csvText });
    await cancelImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId });
    await expect(readImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId })).rejects.toMatchObject({ status: 404 });
    expect((await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).entries).toHaveLength(0);
  });

  it("importa un export con el resumen fechado: no lo guarda como movimiento y concilia sin diferencias", async () => {
    const owner = await ensureLocalUser(env.DB, "splitwise-resumen@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Resumen fechado" });
    const csvText = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n\n2026-01-01,Comida,Comida,10.00,COP,5.00,-5.00\n2026-01-02,Taxi,Viaje,20.00,COP,-10.00,10.00\n\n2026-10-24,Saldo total, , ,COP,-5.00,5.00\n";
    const created = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "resumen-fechado.csv", csvText });
    const preview = await readImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId });
    expect(preview.parsed.movements).toHaveLength(2);
    expect(preview.parsed.summaries).toHaveLength(1);
    const { plan } = await reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId, mapping: ["new", "new"], decisions: [] });
    expect(plan.reconciliation.map(row => row.differenceMinor)).toEqual([0, 0]);
    expect(plan.warnings).toEqual([]);
    const batchId = await commitImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId });
    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    expect(data.entries.map(entry => entry.description).sort()).toEqual(["Comida", "Taxi"]);
    const batch = await readImportBatch(env.DB, { spaceId: space.id, userId: owner.id, batchId });
    expect(batch.importedCount).toBe(2);
    expect(batch.reconciliation.rows.every(row => row.differenceMinor === 0)).toBe(true);
  });
});
