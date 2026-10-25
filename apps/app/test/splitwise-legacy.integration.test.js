import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import retireSql from "../migrations/0009_retire_legacy_import_tables.sql?raw";
import { readLedger } from "../src/ledger.js";
import { convertLegacyImports } from "../src/splitwise-legacy.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";

// La migración 0009 retira las tablas del modelo anterior; para probar la conversión se recrean con su definición original.
const LEGACY_DDL = [
  `CREATE TABLE IF NOT EXISTS splitwise_import_entries (
    ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id), id TEXT NOT NULL, batch_id TEXT NOT NULL REFERENCES splitwise_import_batches(id),
    source_row_number INTEGER NOT NULL CHECK(source_row_number >= 2), occurred_at TEXT NOT NULL, description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 240),
    category TEXT NOT NULL DEFAULT '', currency_code TEXT NOT NULL, total_minor INTEGER NOT NULL CHECK(total_minor >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(ledger_id, id), UNIQUE(batch_id, source_row_number))`,
  `CREATE TABLE IF NOT EXISTS splitwise_import_effects (
    ledger_id TEXT NOT NULL, entry_id TEXT NOT NULL, participant_id TEXT NOT NULL, amount_minor INTEGER NOT NULL,
    PRIMARY KEY(ledger_id, entry_id, participant_id),
    FOREIGN KEY(ledger_id, entry_id) REFERENCES splitwise_import_entries(ledger_id, id),
    FOREIGN KEY(ledger_id, participant_id) REFERENCES ledger_participants(ledger_id, id))`,
];
// El migrador ejecuta el archivo sin comentarios; se hace lo mismo para probar sus sentencias reales.
const executable = sql => sql.split("\n").filter(line => !line.trim().startsWith("--")).join(" ").replace(/\s+/gu, " ");

async function restoreLegacyTables() {
  await env.DB.exec("DROP TABLE IF EXISTS splitwise_import_effects");
  await env.DB.exec("DROP TABLE IF EXISTS splitwise_import_entries");
  for (const ddl of LEGACY_DDL) await env.DB.exec(ddl.replace(/\s+/gu, " "));
}

async function legacyBook(name) {
  await restoreLegacyTables();
  const owner = await ensureLocalUser(env.DB, `${name}-owner@example.test`);
  const member = await ensureLocalUser(env.DB, `${name}-member@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.id, name });
  const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
  const ownerId = data.participants.find(person => person.linkedUserId === owner.id).id;
  const memberId = data.participants.find(person => person.linkedUserId === member.id).id;
  const ledgerId = data.ledger.id;
  const batchId = `import_legacy_${name}`;
  await env.DB.prepare("INSERT INTO splitwise_import_batches (id, ledger_id, actor_user_id, source_hash, file_name, status, imported_count, committed_at) VALUES (?, ?, ?, ?, 'viejo.csv', 'committed', 4, CURRENT_TIMESTAMP)").bind(batchId, ledgerId, owner.id, name.padEnd(64, "0").slice(0, 64)).run();
  const rows = [
    ["a", 2, "2026-01-01", "Pareja", "Comida", 10000, [[ownerId, 5000], [memberId, -5000]]],
    ["b", 3, "2026-01-02", "Todo del otro", "Otros", 8000, [[ownerId, -8000], [memberId, 8000]]],
    ["c", 4, "2026-01-03", "Sin efecto", "", 4500, [[ownerId, 0], [memberId, 0]]],
    ["d", 5, "2026-01-04", "Categoría nueva", "Rara Del Viejo", 3001, [[ownerId, 1500], [memberId, -1500]]],
  ];
  for (const [id, line, date, description, category, total, effects] of rows) {
    await env.DB.prepare("INSERT INTO splitwise_import_entries (ledger_id, id, batch_id, source_row_number, occurred_at, description, category, currency_code, total_minor) VALUES (?, ?, ?, ?, ?, ?, ?, 'COP', ?)").bind(ledgerId, `legacy_${id}`, batchId, line, date, description, category, total).run();
    for (const [participantId, amount] of effects) await env.DB.prepare("INSERT INTO splitwise_import_effects (ledger_id, entry_id, participant_id, amount_minor) VALUES (?, ?, ?, ?)").bind(ledgerId, `legacy_${id}`, participantId, amount).run();
  }
  return { owner, space, ledgerId, ownerId, memberId, batchId };
}

describe("conversión de importaciones del modelo anterior", () => {
  it("convierte cada fila en un gasto normal y los saldos por persona no cambian", async () => {
    const t = await legacyBook("legacy-saldos");
    const report = await convertLegacyImports(env.DB);
    expect(report.find(item => item.batchId === t.batchId)).toEqual({ batchId: t.batchId, converted: 4, skipped: 0 });
    const data = await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.id });
    expect(data.entries).toHaveLength(4);
    expect(data.entries.every(entry => entry.type === "expense" && entry.importBatchId === t.batchId && entry.inferred)).toBe(true);
    expect(data.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(5000 - 8000 + 0 + 1500);
    expect(data.balances.find(row => row.participantId === t.memberId).amountMinor).toBe(-5000 + 8000 + 0 - 1500);
    expect(data.entries.find(entry => entry.description === "Categoría nueva").categoryInfo).toMatchObject({ name: "Rara Del Viejo" });
    expect(data.entries.find(entry => entry.description === "Pareja").categoryInfo).toMatchObject({ name: "Comida".replace("Comida", data.entries.find(entry => entry.description === "Pareja").categoryInfo?.name ?? "Comida") });
  });

  it("deja los ids originales, las revisiones iniciales y las filas de origen, y vacía las tablas viejas", async () => {
    const t = await legacyBook("legacy-limpieza");
    await convertLegacyImports(env.DB);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = ? AND id LIKE 'legacy_%'").bind(t.ledgerId).first()).n).toBe(4);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM entry_revisions WHERE ledger_id = ? AND entry_id LIKE 'legacy_%'").bind(t.ledgerId).first()).n).toBe(4);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM import_source_rows WHERE batch_id = ?").bind(t.batchId).first()).n).toBe(4);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM splitwise_import_entries").first()).n).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM splitwise_import_effects").first()).n).toBe(0);
  });

  it("es idempotente: una segunda corrida no hace nada", async () => {
    await legacyBook("legacy-idempotente");
    await convertLegacyImports(env.DB);
    expect(await convertLegacyImports(env.DB)).toEqual([]);
  });

  it("la fila sin efecto queda pagada y consumida por una misma persona", async () => {
    const t = await legacyBook("legacy-sin-efecto");
    await convertLegacyImports(env.DB);
    const entry = (await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.id })).entries.find(row => row.description === "Sin efecto");
    expect(entry.cashParties).toHaveLength(1);
    expect(entry.allocations).toEqual([{ participantId: entry.cashParties[0].participantId, amountMinor: 4500 }]);
  });
});

describe("migración que retira las tablas anteriores", () => {
  it("se detiene sin borrar nada si todavía queda un lote sin convertir", async () => {
    await legacyBook("legacy-guarda");
    await expect(env.DB.exec(executable(retireSql))).rejects.toThrow(/CHECK constraint|constraint/iu);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM splitwise_import_entries").first()).n).toBe(4);
    await env.DB.exec("DROP TABLE IF EXISTS legacy_import_guard");
  });

  it("después de convertir, la migración retira las dos tablas", async () => {
    await legacyBook("legacy-retiro");
    await convertLegacyImports(env.DB);
    await env.DB.exec(executable(retireSql));
    const tables = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'splitwise_import_%' ORDER BY name").all()).results.map(row => row.name);
    expect(tables).toEqual(["splitwise_import_batches", "splitwise_import_previews", "splitwise_import_rows"]);
  });
});
