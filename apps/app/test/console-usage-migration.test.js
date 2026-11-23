import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

// Migración 0017 (change consola-administracion-homesuite, tarea 1.2): última actividad, tablas de uso, roles de plataforma y copia de la
// marca heredada de administrador de TasKing. SQLite real (node:sqlite) con las migraciones en el orden en que las aplica Wrangler.
const DIRECTORY = new URL("../migrations/", import.meta.url);
const files = readdirSync(DIRECTORY).filter((name) => name.endsWith(".sql")).sort();
const MIGRATION = "0017_console_usage.sql";
const read = (name) => readFileSync(new URL(name, DIRECTORY), "utf8");
const COPY = read(MIGRATION).slice(read(MIGRATION).indexOf("INSERT OR IGNORE INTO platform_roles"));

function databaseBefore() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of files.filter((file) => file < MIGRATION)) db.exec(read(name));
  return db;
}

function seedIdentities(db) {
  db.exec(`INSERT INTO users (id, google_sub, email, display_name) VALUES ('user_admin', 'sub_a', 'admin@example.test', 'Admin'), ('user_plain', 'sub_p', 'plain@example.test', 'Plain');
    INSERT INTO tasking_identities (identity_id, legacy_email, user_id, is_admin, created_at) VALUES
      ('id_admin', 'admin@example.test', 'user_admin', 1, 0),
      ('id_plain', 'plain@example.test', 'user_plain', 0, 0),
      ('id_orphan', 'orphan@example.test', NULL, 1, 0);`);
}

describe("migración de la consola y la estadística de uso", () => {
  it("es la última y todas las migraciones aplican en orden", () => {
    expect(files.at(-1)).toBe(MIGRATION);
    const db = databaseBefore();
    db.exec(read(MIGRATION));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'usage_%' OR name = 'platform_roles') ORDER BY name").all().map((row) => row.name);
    expect(tables).toEqual(["platform_roles", "usage_daily_counts", "usage_period_markers", "usage_period_people", "usage_suite_snapshots"]);
    expect(db.prepare("SELECT name FROM pragma_table_info('users') WHERE name = 'last_active_on'").all()).toHaveLength(1);
  });

  it("copia la marca de administrador sólo de identidades con cuenta HomeSuite", () => {
    const db = databaseBefore();
    seedIdentities(db);
    db.exec(read(MIGRATION));
    expect(db.prepare("SELECT user_id, scope, granted_by FROM platform_roles").all()).toEqual([{ user_id: "user_admin", scope: "tareas", granted_by: null }]);
    // La marca heredada queda intacta para poder volver atrás.
    expect(db.prepare("SELECT COUNT(*) AS n FROM tasking_identities WHERE is_admin = 1").get().n).toBe(2);
  });

  it("la copia es idempotente", () => {
    const db = databaseBefore();
    seedIdentities(db);
    db.exec(read(MIGRATION));
    db.exec(COPY);
    expect(db.prepare("SELECT COUNT(*) AS n FROM platform_roles").get().n).toBe(1);
  });

  it("las marcas no guardan columnas de la cuenta y los valores fuera de catálogo se rechazan", () => {
    const db = databaseBefore();
    db.exec(read(MIGRATION));
    const columns = db.prepare("SELECT name FROM pragma_table_info('usage_period_markers')").all().map((row) => row.name);
    expect(columns).toEqual(["period_type", "period_key", "tool", "level", "marker"]);
    expect(() => db.exec("INSERT INTO usage_daily_counts (day, tool, action, count) VALUES ('2026-11-23', 'zen', 'x', 1)")).toThrow(/CHECK/u);
    expect(() => db.exec("INSERT INTO platform_roles (user_id, scope) VALUES ('nadie', 'suite')")).toThrow();
    expect(() => db.exec("UPDATE users SET last_active_on = 'ayer'")).not.toThrow(); // sin filas
    db.exec("INSERT INTO users (id, google_sub, email, display_name) VALUES ('u', 's', 'u@example.test', 'U')");
    expect(() => db.exec("UPDATE users SET last_active_on = 'ayer'")).toThrow(/CHECK/u);
  });
});
