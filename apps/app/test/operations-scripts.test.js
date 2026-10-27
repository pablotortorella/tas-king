import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

  it("el restore drill sólo usa D1 local", () => {
    const script = fs.readFileSync(path.join(root, "scripts/homesuite-app-restore-drill.sh"), "utf8");
    expect(script).toContain("--local");
    expect(script).toContain("--persist-to");
    expect(script).not.toContain("--remote");
    expect(script).toContain("PRAGMA quick_check");
    expect(script).toContain("PRAGMA foreign_key_check");
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
