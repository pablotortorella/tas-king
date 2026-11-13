import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

// Migración 0014 (tabla legal_acceptances): se aplica sobre el esquema anterior con datos sin tocarlos, es aditiva y sus restricciones
// rechazan lo que no debe guardarse. Usa SQLite real (node:sqlite) con las migraciones en el orden en que las aplica Wrangler.
const DIRECTORY = new URL("../migrations/", import.meta.url);
const files = readdirSync(DIRECTORY).filter((name) => name.endsWith(".sql")).sort();
const MIGRATION = "0014_legal_acceptances.sql";
const read = (name) => readFileSync(new URL(name, DIRECTORY), "utf8");

function databaseBefore() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of files.filter((file) => file < MIGRATION)) db.exec(read(name));
  return db;
}

describe("migración legal_acceptances", () => {
  it("es la siguiente migración libre y las anteriores no la conocen", () => {
    expect(files.indexOf(MIGRATION)).toBe(files.length - 1);
    expect(files.at(-2)).toMatch(/^0013_tasking/u);
  });

  it("actualiza desde el esquema anterior con datos y los deja intactos", () => {
    const db = databaseBefore();
    db.exec("INSERT INTO users (id, google_sub, email, display_name) VALUES ('user_a', 'sub-a', 'a@example.test', 'Ana'), ('user_b', 'sub-b', 'b@example.test', 'Beto')");
    db.exec("INSERT INTO sessions (id, user_id, expires_at) VALUES ('session_a', 'user_a', '2027-01-01T00:00:00.000Z')");
    const before = { users: db.prepare("SELECT * FROM users ORDER BY id").all(), sessions: db.prepare("SELECT * FROM sessions").all() };
    const tablesBefore = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);

    db.exec(read(MIGRATION));

    expect(db.prepare("SELECT * FROM users ORDER BY id").all()).toEqual(before.users);
    expect(db.prepare("SELECT * FROM sessions").all()).toEqual(before.sessions);
    const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
    expect(tablesAfter.filter((name) => !tablesBefore.includes(name))).toEqual(["legal_acceptances"]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM legal_acceptances").get().n).toBe(0);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("el código anterior sigue funcionando: las tablas que usaba no cambian", () => {
    const db = databaseBefore();
    const shape = () => db.prepare("SELECT name, sql FROM sqlite_master WHERE name != 'legal_acceptances' AND sql IS NOT NULL ORDER BY name").all();
    const before = shape();
    db.exec(read(MIGRATION));
    expect(shape()).toEqual(before);
  });

  describe("restricciones", () => {
    const withTable = () => {
      const db = databaseBefore();
      db.exec(read(MIGRATION));
      db.exec("INSERT INTO users (id, google_sub, email, display_name) VALUES ('user_a', 'sub-a', 'a@example.test', 'Ana')");
      return db;
    };
    const insert = (db, document, version, method = "login", userId = "user_a") =>
      db.prepare("INSERT INTO legal_acceptances (user_id, document, version, method) VALUES (?, ?, ?, ?)").run(userId, document, version, method);

    it("guarda una fila por persona, documento y versión, con fecha automática", () => {
      const db = withTable();
      insert(db, "terms", "2026-11-04");
      insert(db, "privacy", "2026-11-04", "gate");
      insert(db, "terms", "2027-01-01", "gate");
      expect(() => insert(db, "terms", "2026-11-04")).toThrow(/UNIQUE|PRIMARY/iu);
      const rows = db.prepare("SELECT document, version, method, accepted_at FROM legal_acceptances ORDER BY document, version").all();
      expect(rows).toHaveLength(3);
      for (const row of rows) expect(row.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u);
    });

    it("rechaza documentos, métodos y versiones inválidos", () => {
      const db = withTable();
      expect(() => insert(db, "cookies", "2026-11-04")).toThrow(/CHECK/iu);
      expect(() => insert(db, "terms", "2026-11-04", "silencio")).toThrow(/CHECK/iu);
      expect(() => insert(db, "terms", "4 de noviembre")).toThrow(/CHECK/iu);
      expect(() => insert(db, "terms", "2026-11-04", "login", "user_inexistente")).toThrow(/FOREIGN/iu);
    });
  });
});
