import base from "./playwright.config.mjs";

// Mismo conjunto de pruebas E2E, con Firefox como segundo motor además de Chromium (docs/homesuite/VERIFICACION.md).
// Requiere `npx playwright install firefox`. Usá E2E_PORT / E2E_STATE para no pisar otra corrida.
export default { ...base, use: { ...base.use, browserName: "firefox" } };
