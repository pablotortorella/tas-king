import { execSync } from "child_process";
import { resolve } from "path";

const root = resolve(process.cwd());

export function resetDb() {
  execSync(
    "npx wrangler d1 execute tas-king --local --persist-to .wrangler/e2e-state --file test/fixtures/seed.sql",
    { cwd: root, stdio: "pipe" }
  );
}
