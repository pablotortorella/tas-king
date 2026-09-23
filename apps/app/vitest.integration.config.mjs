import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: path.join(root, "wrangler.jsonc") },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(root, "migrations")), DEV_LOCAL_MODE: "true" } },
  }))],
  test: { setupFiles: ["./test/setup-integration.js"], include: ["test/**/*.integration.test.js"], fileParallelism: false },
});
