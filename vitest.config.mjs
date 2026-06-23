import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: path.join(root, "wrangler.jsonc") },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(root, "migrations")),
          SESSION_SECRET: "test-session-secret",
          DEV_USER_EMAIL: "",
          ADMIN_EMAILS: "",
          ALLOWED_EMAILS: "",
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.js"],
    fileParallelism: false,
  },
});
