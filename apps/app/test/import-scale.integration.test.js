import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { readLedger } from "../src/ledger.js";
import { IMPORT_CHUNK, confirmImportPreview, createImportPreview, loadImportChunk, reviewImportPreview } from "../src/splitwise-import.js";
import { createSpaceForUser, ensureLocalUser } from "../src/spaces.js";
import { syntheticSplitwiseCsv } from "./fixtures/synthetic-splitwise.js";

// Medición de la carga por etapas de un archivo de la forma del caso real (2.485 filas, dos personas) contra D1 local.
// No fija tiempos exactos (dependen de la máquina): deja los números en la salida y exige límites holgados.
describe("importación a escala", () => {
  it("carga 2.485 filas por tandas, publica una sola vez y conserva los saldos", async () => {
    const owner = await ensureLocalUser(env.DB, "scale-owner@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "Escala" });
    const ledger = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    const ownerId = ledger.participants[0].id;
    const { csv, balances } = syntheticSplitwiseCsv({ rows: 2485 });
    const timings = {};
    const time = async (label, work) => { const start = Date.now(); const result = await work(); timings[label] = Date.now() - start; return result; };

    const created = await time("previewMs", () => createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "escala.csv", csvText: csv }));
    await time("reviewMs", () => reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId, mapping: [ownerId, "new"] }));
    const batchId = await time("confirmMs", () => confirmImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: created.previewId, acknowledgeDifference: true }));

    const chunkMs = [];
    let result;
    do {
      const start = Date.now();
      result = await loadImportChunk(env.DB, { spaceId: space.id, userId: owner.id, batchId });
      chunkMs.push(Date.now() - start);
    } while (!result.done);

    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    const readStart = Date.now();
    await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    const readMs = Date.now() - readStart;
    const sorted = [...chunkMs].sort((a, b) => a - b);
    const summary = { rows: 2485, chunkSize: IMPORT_CHUNK, chunks: chunkMs.length, statementsPerChunk: 5, publishStatements: 6, ...timings, chunkMsMedian: sorted[Math.floor(sorted.length / 2)], chunkMsMax: sorted.at(-1), chunkMsTotal: chunkMs.reduce((a, b) => a + b, 0), readLedgerMs: readMs };
    console.log(`IMPORT-SCALE ${JSON.stringify(summary)}`);

    expect(data.entries).toHaveLength(2485);
    expect(data.balances.find(row => row.participantId === ownerId).amountMinor).toBe(balances[0]);
    expect(chunkMs.length).toBe(Math.ceil(2485 / IMPORT_CHUNK) + 0);
    expect(summary.chunkMsMax).toBeLessThan(10_000);
    expect(summary.chunkMsTotal).toBeLessThan(120_000);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_events WHERE ledger_id = ? AND action = 'splitwise_import_committed'").bind(data.ledger.id).first()).toMatchObject({ n: 1 });
  }, 180000);
});
