import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();
});

test("🎯 alterna encendido/apagado y persiste tras recargar", async ({ page }) => {
  const btn = page.locator("#wipPulseBtn");
  await expect(btn).not.toHaveClass(/wip-pulse-off/);

  await btn.click();
  await expect(btn).toHaveClass(/wip-pulse-off/);

  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("#wipPulseBtn")).toHaveClass(/wip-pulse-off/);

  // Vuelve a encender para no afectar el resto de la suite / otras corridas locales
  await page.locator("#wipPulseBtn").click();
  await expect(page.locator("#wipPulseBtn")).not.toHaveClass(/wip-pulse-off/);
});

test("activar el toggle dispara un pulso de preview inmediato, sin esperar el timer", async ({ page }) => {
  const btn = page.locator("#wipPulseBtn");
  const seedCard = page.locator(".card", { hasText: "Tarjeta seed" }); // columna "pendiente", es WIP

  // Apagar y volver a prender: el prendido debe disparar el preview.
  await btn.click();
  await expect(btn).toHaveClass(/wip-pulse-off/);
  await btn.click();
  await expect(btn).not.toHaveClass(/wip-pulse-off/);

  await expect(seedCard).toHaveClass(/wip-pulse/, { timeout: 3000 });
});

test("el atajo P dispara el pulso manualmente", async ({ page }) => {
  const seedCard = page.locator(".card", { hasText: "Tarjeta seed" });
  await page.keyboard.press("p");
  await expect(seedCard).toHaveClass(/wip-pulse/, { timeout: 3000 });
});

test("el pulso resalta las tarjetas en curso y muestra el mensaje una vez por día", async ({ page }) => {
  const runId = Date.now().toString(36);
  const title = `E2E wip-pulse ${runId}`;

  await page.locator('.add-card[data-col="en_progreso"]').click();
  await page.fill("#fTitle", title);
  await page.click("#saveBtn");
  const card = page.locator(".card", { hasText: title });
  await expect(card).toBeVisible();

  await page.evaluate(() => window.runWipPulseSequence());

  // La tarjeta en la columna WIP recibe el pulso (con delay escalonado por columna).
  await expect(card).toHaveClass(/wip-pulse/, { timeout: 3000 });

  // El mensaje aparece la primera vez del día.
  const toast = page.locator("#wipToast");
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toHaveText(/Dejar de empezar y empezar a terminar/);

  // Si se dispara de nuevo el mismo día (pulso automático), el mensaje no vuelve a aparecer.
  await expect(toast).not.toHaveClass(/show/, { timeout: 6000 });
  await page.evaluate(() => window.runWipPulseSequence());
  await page.waitForTimeout(300);
  await expect(toast).not.toHaveClass(/show/);

  // Pero un disparo manual (atajo P) sí lo muestra, aunque ya se haya visto hoy.
  await page.keyboard.press("p");
  await expect(toast).toHaveClass(/show/);
});

test("no pulsa tarjetas en la primera columna ni en columnas de cierre", async ({ page }) => {
  const runId = Date.now().toString(36);
  const notStartedTitle = `E2E no-empezada ${runId}`;
  const doneTitle = `E2E terminada ${runId}`;

  await page.locator('.add-card[data-col="por_conversar"]').click();
  await page.fill("#fTitle", notStartedTitle);
  await page.click("#saveBtn");

  await page.locator('.add-card[data-col="terminado"]').click();
  await page.fill("#fTitle", doneTitle);
  await page.click("#saveBtn");

  await page.evaluate(() => window.runWipPulseSequence());
  await page.waitForTimeout(2000); // cubre el delay escalonado de todas las columnas WIP

  await expect(page.locator(".card", { hasText: notStartedTitle })).not.toHaveClass(/wip-pulse/);
  await expect(page.locator(".card", { hasText: doneTitle })).not.toHaveClass(/wip-pulse/);
});
