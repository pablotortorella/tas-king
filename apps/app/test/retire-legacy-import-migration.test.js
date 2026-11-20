import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

// Migración 0015 (change importacion-como-movimientos, tarea 7.2): retira las tablas del modelo anterior de importación
// (splitwise_import_entries y splitwise_import_effects). Su guarda la detiene sin borrar nada si todavía queda alguna fila.
// Usa SQLite real (node:sqlite) con las migraciones en el orden en que las aplica Wrangler.
const DIRECTORY = new URL("../migrations/", import.meta.url);
const files = readdirSync(DIRECTORY).filter((name) => name.endsWith(".sql")).sort();
const MIGRATION = "0015_retire_legacy_import_tables.sql";
const read = (name) => readFileSync(new URL(name, DIRECTORY), "utf8");
const importTables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'splitwise_import_%' ORDER BY name").all().map((row) => row.name);

function databaseBefore() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of files.filter((file) => file < MIGRATION)) db.exec(read(name));
  return db;
}

describe("migración que retira las tablas anteriores de importación", () => {
  it("sigue a la de los textos legales", () => {
    expect(files[files.indexOf(MIGRATION) - 1]).toMatch(/^0014_legal_acceptances/u);
  });

  it("con las tablas viejas vacías, las retira y deja las del modelo nuevo", () => {
    const db = databaseBefore();
    expect(importTables(db)).toEqual(["splitwise_import_batches", "splitwise_import_effects", "splitwise_import_entries", "splitwise_import_previews", "splitwise_import_rows"]);
    db.exec(read(MIGRATION));
    expect(importTables(db)).toEqual(["splitwise_import_batches", "splitwise_import_previews", "splitwise_import_rows"]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'legacy_import_guard'").all()).toEqual([]);
  });

  it("se detiene sin borrar nada si todavía queda una fila del modelo anterior", () => {
    const db = databaseBefore();
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("INSERT INTO splitwise_import_entries (ledger_id, id, batch_id, source_row_number, occurred_at, description, currency_code, total_minor) VALUES ('ledger_a', 'entry_a', 'batch_a', 2, '2026-01-01', 'Viejo', 'COP', 1000)");
    expect(() => db.exec(read(MIGRATION))).toThrow(/CHECK constraint/u);
    expect(importTables(db)).toContain("splitwise_import_entries");
    expect(importTables(db)).toContain("splitwise_import_effects");
    expect(db.prepare("SELECT COUNT(*) AS n FROM splitwise_import_entries").get().n).toBe(1);
  });
});
