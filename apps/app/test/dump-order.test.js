import { describe, expect, it } from "vitest";
import { reorderDump } from "../../../scripts/homesuite-dump-order.mjs";

const dump = [
  "PRAGMA defer_foreign_keys=TRUE;",
  "CREATE TABLE hijo (",
  "  id TEXT PRIMARY KEY,",
  "  padre_id TEXT REFERENCES padre(id)",
  ");",
  'INSERT INTO "hijo" ("id","padre_id") VALUES (\'h1\', NULL);',
  "CREATE TABLE padre (id TEXT PRIMARY KEY);",
  'INSERT INTO "padre" ("id") VALUES (\'p1\');',
  "CREATE INDEX hijo_padre ON hijo(padre_id);",
  "CREATE TRIGGER no_borrar BEFORE DELETE ON hijo",
  "BEGIN",
  "  SELECT RAISE(ABORT, 'no');",
  "END;",
].join("\n");

describe("orden del dump para restaurar", () => {
  const lines = reorderDump(dump).split("\n");

  it("deja las tablas antes que cualquier dato, para que una referencia hacia adelante exista al insertar", () => {
    const lastTable = Math.max(lines.indexOf("CREATE TABLE padre (id TEXT PRIMARY KEY);"), lines.indexOf(");"));
    const firstInsert = lines.findIndex(line => line.startsWith("INSERT"));
    expect(lastTable).toBeLessThan(firstInsert);
  });

  it("conserva el PRAGMA al principio y el orden relativo del resto", () => {
    expect(lines[0]).toBe("PRAGMA defer_foreign_keys=TRUE;");
    const rest = lines.filter(line => /^(INSERT|CREATE INDEX|CREATE TRIGGER)/u.test(line));
    expect(rest.map(line => line.split(" ").slice(0, 3).join(" "))).toEqual(['INSERT INTO "hijo"', 'INSERT INTO "padre"', "CREATE INDEX hijo_padre", "CREATE TRIGGER no_borrar"]);
  });

  it("no pierde ni duplica líneas", () => {
    expect([...lines].sort()).toEqual(dump.split("\n").sort());
  });

  it("rechaza un dump cortado en medio de un CREATE TABLE", () => {
    expect(() => reorderDump("CREATE TABLE roto (\n  id TEXT")).toThrow("sin cerrar");
  });
});
