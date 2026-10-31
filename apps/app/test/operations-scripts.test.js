import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");

describe("operación recuperable", () => {
  it("respalda antes de migrar y desplegar staging", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const deploy = pkg.scripts["deploy:homesuite-app:staging"];
    expect(deploy.indexOf("db:backup:homesuite-app:staging")).toBeLessThan(deploy.indexOf("db:migrate:homesuite-app:staging"));
    expect(deploy.indexOf("db:migrate:homesuite-app:staging")).toBeLessThan(deploy.indexOf("wrangler deploy"));
  });

  it("el restore drill sólo usa una base local aislada y verifica integridad y claves foráneas", () => {
    const script = fs.readFileSync(path.join(root, "scripts/homesuite-app-restore-drill.sh"), "utf8");
    expect(script).not.toContain("--remote");
    expect(script).toContain("mktemp -d");
    expect(script).toContain("PRAGMA quick_check");
    expect(script).toContain("PRAGMA foreign_key_check");
  });

  describe("restore drill con un export al estilo de D1", () => {
    const drill = path.join(root, "scripts/homesuite-app-restore-drill.sh");
    const essential = "CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE groups(id TEXT PRIMARY KEY);CREATE TABLE memberships(id TEXT PRIMARY KEY);CREATE TABLE invitations(id TEXT PRIMARY KEY);CREATE TABLE sessions(id TEXT PRIMARY KEY);";
    const run = sql => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "drill-test-"));
      const file = path.join(dir, "database.sql");
      fs.writeFileSync(file, sql);
      try { return spawnSync("bash", [drill, file], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } }); }
      finally { fs.rmSync(dir, { recursive: true, force: true }); }
    };
    // D1 exporta las tablas en el orden de las migraciones: una clave foránea agregada después apunta a una tabla creada más abajo,
    // y las filas de la primera se insertan antes de que exista la segunda. Con la base vacía eso no se nota.
    const outOfOrder = `PRAGMA defer_foreign_keys=TRUE;${essential}CREATE TABLE child(id TEXT PRIMARY KEY, batch_id TEXT REFERENCES batches(id));INSERT INTO child VALUES('c1','b1');CREATE TABLE batches(id TEXT PRIMARY KEY);INSERT INTO batches VALUES('b1');`;

    it("restaura filas cuya tabla padre se crea más abajo", () => {
      const result = run(outOfOrder);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Restore drill correcto");
    });

    it("sigue fallando si una fila queda huérfana", () => {
      const result = run(outOfOrder.replace("INSERT INTO batches VALUES('b1');", ""));
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("foreign_key_check");
    });

    it("sigue fallando si faltan las tablas esenciales", () => {
      const result = run("CREATE TABLE users(id TEXT PRIMARY KEY);");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("tablas esenciales");
    });
  });

  it("el reinicio de staging exige confirmación explícita, solo toca staging y no corre sin ella", () => {
    const script = path.join(root, "scripts/homesuite-app-reset-staging.sh");
    const text = fs.readFileSync(script, "utf8");
    expect(text).toContain('homesuite-app-db-staging');
    expect(text).not.toMatch(/--env\s+(production|prod)\b/u);
    expect(text.indexOf('if [ "${CONFIRM_RESET_STAGING:-}"')).toBeGreaterThan(0);
    expect(text.indexOf('if [ "${CONFIRM_RESET_STAGING:-}"')).toBeLessThan(text.lastIndexOf("run_sql staging - file"));
    const withoutConfirmation = spawnSync("bash", [script, "staging"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    expect(withoutConfirmation.status).toBe(1);
    expect(withoutConfirmation.stderr).toContain("CONFIRM_RESET_STAGING=homesuite-app-db-staging");
    const wrongConfirmation = spawnSync("bash", [script, "staging"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, CONFIRM_RESET_STAGING: "yes" } });
    expect(wrongConfirmation.status).toBe(1);
    const production = spawnSync("bash", [script, "production"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    expect(production.status).toBe(1);
    expect(production.stderr).toContain("Producción no está habilitada");
  });

  it("el reinicio no borra tablas internas de SQLite ni de Cloudflare", () => {
    const text = fs.readFileSync(path.join(root, "scripts/homesuite-app-reset-staging.sh"), "utf8");
    expect(text).toContain("NOT LIKE 'sqlite_%'");
    expect(text).toContain("_cf");
    expect(text).toContain("ESCAPE");
  });
});
