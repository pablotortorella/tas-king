import { defineConfig } from "@playwright/test";

// El puerto y el estado se pueden cambiar (E2E_PORT, E2E_STATE) para correr dos worktrees a la vez sin pisarse.
const port = process.env.E2E_PORT ?? "8791";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e:homesuite-app",
    cwd: "../..",
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
