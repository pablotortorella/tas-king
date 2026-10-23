import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8791",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e:homesuite-app",
    cwd: "../..",
    url: "http://127.0.0.1:8791/healthz",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
