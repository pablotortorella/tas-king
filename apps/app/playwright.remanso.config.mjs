import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const PORT = 8794; // distinto de la suite de Cuentas Claras (8791), que corre con un usuario local y esta con visita anónima
const STATE = ".wrangler/remanso-e2e-state"; // estado de D1 descartable, sólo de esta suite

// `localhost` (no 127.0.0.1 de otro host) importa: el usuario local sólo existe ahí.
// Sin DEV_LOCAL_EMAIL la visita es anónima; las pruebas con cuenta envían la
// cabecera X-HomeSuite-Dev-Email. Los valores de Google y de sesión son ficticios.
const vars = [
  "DEV_LOCAL_MODE:true",
  "GOOGLE_CLIENT_ID:e2e-client",
  "GOOGLE_CLIENT_SECRET:e2e-secret",
  "SESSION_SECRET:e2e-session-secret-0123456789abcdef",
].map((pair) => `--var ${pair}`).join(" ");

const projects = [{ name: "chromium", use: devices["Desktop Chrome"] }];
if (process.env.REMANSO_E2E_FIREFOX) projects.push({ name: "firefox", use: devices["Desktop Firefox"] });

export default defineConfig({
  testDir: "./e2e-remanso",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
  webServer: {
    command: [
      `rm -rf ${STATE}`,
      `npx wrangler d1 migrations apply homesuite-app-local --local --persist-to ${STATE} --config apps/app/wrangler.jsonc`,
      `npx wrangler dev --config apps/app/wrangler.jsonc --port ${PORT} --persist-to ${STATE} ${vars}`,
    ].join(" && "),
    cwd: repoRoot,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
