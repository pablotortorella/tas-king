import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // Un reintento en local, no para tapar fallas sino para que la suite siga
  // siendo utilizable como red de seguridad del refactor.
  //
  // Lo que se sabe: cada tanto (~1 de cada 4 corridas completas) el beforeEach de
  // card-mutation-performance se cuelga en page.goto. La traza muestra que el
  // documento y los primeros assets responden, y que dos subrecursos quedan sin
  // completarse nunca — por eso el evento `load` no dispara y no alcanza con
  // agrandar el timeout. Solo pasa dentro de una corrida completa: no se reproduce
  // con 200 requests en paralelo ni con seis resets de base simultáneos.
  //
  // Lo que NO se sabe: la causa. Playwright reporta aparte los tests que pasaron
  // en reintento, con la etiqueta "flaky", así que esto no esconde el problema:
  // lo deja contado. Si ese contador deja de ser cero de forma persistente, o
  // aparece en otros specs, hay que volver acá.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./test/global-setup.mjs",
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Permite apuntar a un Chromium ya instalado (p. ej. en entornos donde
        // no se puede correr `playwright install`). Sin la variable, usa el default.
        ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:8787/api/me",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
