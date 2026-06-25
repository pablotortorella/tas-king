import { execSync } from "child_process";
import { resolve } from "path";

const root = resolve(process.cwd());

export default async function globalSetup() {
  // 1. Asegurar que el schema existe (migraciones idempotentes)
  execSync(
    "npx wrangler d1 migrations apply tas-king --local --persist-to .wrangler/e2e-state",
    { cwd: root, stdio: "pipe" }
  );
  // 2. Limpiar y resembrar con estado conocido
  execSync(
    "npx wrangler d1 execute tas-king --local --persist-to .wrangler/e2e-state --file test/fixtures/seed.sql",
    { cwd: root, stdio: "pipe" }
  );
  console.log("✅ E2E DB reseteada con seed data");
}
