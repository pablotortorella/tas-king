import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: path.join(root, "wrangler.jsonc") },
    miniflare: { d1Databases: ["LEGACY_TASKING_DB"], r2Buckets: ["SOURCE_TASKING_BUCKET"], bindings: { TEST_FINANCIAL_SEED: await readFile(path.join(root,"seed/demo.sql"),"utf8"), TEST_LEGACY_MIGRATIONS: await readD1Migrations(path.join(root,"../../migrations")), TEST_LEGACY_SEED: await readFile(path.join(root,"../../test/fixtures/seed.sql"),"utf8"),  TEST_MIGRATIONS: await readD1Migrations(path.join(root, "migrations")), DEV_LOCAL_MODE: "true" } },
  }))],
  test: { setupFiles: ["./test/setup-integration.js"], include: ["test/**/*.integration.test.js"], fileParallelism: false },
});
