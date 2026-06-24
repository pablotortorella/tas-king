import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const cardTitle = `E2E tarjeta ${runId}`;
const importedTitle = `E2E importada ${runId}`;
const allowedEmail = `e2e-${runId}@example.com`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("crea, edita, mueve y elimina una tarjeta", async ({ page }) => {
  await page.locator('.add-card[data-col="pendiente"]').click();
  await expect(page.locator("#modalTitle")).toHaveText("Nueva tarjeta");
  await page.locator("#fTitle").fill(cardTitle);
  await page.locator("#fDetails").fill("Recorrido crítico automatizado");
  await page.locator("#saveBtn").click();

  const card = page.locator(".card", { hasText: cardTitle });
  await expect(card).toBeVisible();
  await card.click();
  await page.locator("#fColumn").selectOption("terminado");
  await page.locator("#saveBtn").click();
  await expect(page.locator('.cards[data-col="terminado"] .card', { hasText: cardTitle })).toBeVisible();

  await page.locator(".card", { hasText: cardTitle }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#deleteCardBtn").click();
  await expect(page.locator(".card", { hasText: cardTitle })).toHaveCount(0);
});

test("importa CSV agregando tarjetas", async ({ page }) => {
  const existingCount = await page.locator(".card").count();
  const csv = [
    "Name,Status,Details,Due,Comments,Archived",
    `\"${importedTitle}\",Pendiente,Detalle importado,2026-12-31,Comentario,false`,
  ].join("\n");

  await page.locator("#importFile").setInputFiles({
    name: "e2e.csv", mimeType: "text/csv", buffer: Buffer.from(csv),
  });
  await expect(page.locator("#importOverlay")).toHaveClass(/open/);
  await expect(page.locator("#importSummary")).toContainText("Tarjetas a importar");
  await page.locator("#importConfirmBtn").click();

  await expect(page.locator(".card", { hasText: importedTitle })).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(existingCount + 1);
});

test("administra la lista de acceso desde la UI", async ({ page }) => {
  await expect(page.locator("#adminBtn")).toBeVisible();
  await page.locator("#adminBtn").click();
  await expect(page.locator("#adminOverlay")).toHaveClass(/open/);
  await page.locator("#adminNewEmail").fill(allowedEmail);
  await page.locator("#adminAddBtn").click();
  await expect(page.locator("#adminUserList")).toContainText(allowedEmail);
});

test("deep-link abre la tarjeta correcta y limpia la URL al cerrar", async ({ page }) => {
  const deepTitle = `E2E deep-link ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(deepTitle);
  await page.locator("#saveBtn").click();

  const card = page.locator(".card", { hasText: deepTitle });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  const url = new URL(page.url());
  const cardId = url.searchParams.get("card");
  expect(cardId).toBeTruthy();

  await page.locator("#cancelBtn").click();
  await expect(page).toHaveURL("/");

  await page.goto(`/?card=${cardId}`);
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await expect(page.locator("#fTitle")).toHaveValue(deepTitle);

  await page.locator("#cancelBtn").click();

  await page.goto("/?card=id-inexistente");
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await expect(page).toHaveURL("/");

  // Archivar la tarjeta y verificar que deep-link aún funciona
  await page.locator(".card", { hasText: deepTitle }).click();
  await page.locator("#archiveCardBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);

  // La tarjeta archivada aún debe abrirse con deep-link
  await page.goto(`/?card=${cardId}`);
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await expect(page.locator("#fTitle")).toHaveValue(deepTitle);

  // Eliminarla desde aquí
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#deleteCardBtn").click();
});

test("los atajos no se disparan mientras se escribe", async ({ page }) => {
  await page.locator("#searchInput").fill("n");
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await page.locator("#searchInput").clear();
  await page.locator("#searchInput").evaluate(element => element.blur());
  await page.keyboard.press("KeyN");
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await expect(page.locator("#modalTitle")).toHaveText("Nueva tarjeta");
});
