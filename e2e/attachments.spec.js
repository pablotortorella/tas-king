import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("adjunta un archivo y aparece en el modal antes de guardar", async ({ page }) => {
  const title = `E2E adjunto ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);

  // Adjuntar archivo de texto en modo borrador (antes de guardar)
  await page.locator("#fFile").setInputFiles({
    name: "test-attach.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Contenido del adjunto E2E"),
  });

  // El archivo aparece en la lista de adjuntos pendientes (#fAttachments > .attachment)
  await expect(page.locator("#fAttachments .attachment")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("#fAttachments .attachment")).toContainText("test-attach.txt");

  // Guardar
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);

  // El card muestra el indicador de adjunto (📎 1)
  await expect(
    page.locator(".card", { hasText: title }).locator(".badge", { hasText: "📎" })
  ).toBeVisible({ timeout: 5000 });
});

test("adjunto persiste al reabrir la tarjeta", async ({ page }) => {
  const title = `E2E adjunto-persist ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#fFile").setInputFiles({
    name: "persist-test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Archivo persistido"),
  });
  await expect(page.locator("#fAttachments .attachment")).toBeVisible({ timeout: 3000 });
  await page.locator("#saveBtn").click();

  // Reabrir
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);

  // El adjunto debe aparecer en la sección de adjuntos del modal
  await expect(page.locator("#fAttachments .attachment")).toContainText("persist-test.txt", { timeout: 5000 });
});
