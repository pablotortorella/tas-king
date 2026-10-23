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
});
