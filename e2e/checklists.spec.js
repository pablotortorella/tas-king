import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("crea checklist en tarjeta existente y ve badge en tablero", async ({ page }) => {
  const title = `E2E checklist-existente ${runId}`;

  // Crear tarjeta
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  // Abrir tarjeta
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);

  // Agregar checklist
  await page.locator(".add-checklist-btn").click();
  await expect(page.locator(".checklist-section")).toBeVisible();

  // Agregar dos ítems con Enter
  const addInput = page.locator(".checklist-add input").first();
  await addInput.fill("Ítem uno");
  await addInput.press("Enter");
  await addInput.fill("Ítem dos");
  await addInput.press("Enter");
  await expect(page.locator(".checklist-item")).toHaveCount(2, { timeout: 5000 });

  // Marcar el primer ítem
  await page.locator(".checklist-item input[type=checkbox]").first().check();
  await expect(page.locator(".checklist-progress").first()).toContainText("1/2", { timeout: 3000 });

  // Cerrar modal y verificar badge en el tablero
  await page.locator("#cancelBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await expect(
    page.locator(".card", { hasText: title }).locator(".badge")
  ).toHaveText("☑ 1/2", { timeout: 5000 });
});

test("renombra checklist e ítem", async ({ page }) => {
  const title = `E2E checklist-rename ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  await page.locator(".card", { hasText: title }).click();
  await page.locator(".add-checklist-btn").click();
  await expect(page.locator(".checklist-section")).toBeVisible();

  // Agregar ítem
  const addInput = page.locator(".checklist-add input").first();
  await addInput.fill("Nombre original");
  await addInput.press("Enter");
  await expect(page.locator(".checklist-item")).toHaveCount(1, { timeout: 5000 });

  // Renombrar checklist
  const nameInput = page.locator(".checklist-name").first();
  await nameInput.fill("Mi lista");
  await nameInput.press("Enter");

  // Renombrar ítem
  const itemText = page.locator(".checklist-item-text").first();
  await itemText.fill("Nombre editado");
  await itemText.press("Enter");

  // Reabrir para verificar persistencia
  await page.locator("#cancelBtn").click();
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator(".checklist-name").first()).toHaveValue("Mi lista", { timeout: 3000 });
  await expect(page.locator(".checklist-item-text").first()).toHaveValue("Nombre editado");
});

test("crea checklist en tarjeta nueva (modo borrador) y persiste al guardar", async ({ page }) => {
  const title = `E2E checklist-draft ${runId}`;

  // Abrir modal de nueva tarjeta
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);

  // Agregar checklist en modo borrador
  await page.locator(".add-checklist-btn").click();
  await expect(page.locator(".checklist-section")).toBeVisible();

  const addInput = page.locator(".checklist-add input").first();
  await addInput.fill("Draft item A");
  await addInput.press("Enter");
  await addInput.fill("Draft item B");
  await addInput.press("Enter");
  await expect(page.locator(".checklist-item")).toHaveCount(2);

  // Marcar el primero
  await page.locator(".checklist-item input[type=checkbox]").first().check();

  // Guardar la tarjeta nueva
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);

  // Verificar badge "☑ 1/2" en el tablero
  await expect(
    page.locator(".card", { hasText: title }).locator(".badge")
  ).toHaveText("☑ 1/2", { timeout: 5000 });

  // Reabrir y verificar persistencia de ítems
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator(".checklist-item")).toHaveCount(2, { timeout: 5000 });
  await expect(page.locator(".checklist-item input[type=checkbox]").first()).toBeChecked();
  await expect(page.locator(".checklist-item input[type=checkbox]").nth(1)).not.toBeChecked();
});

test("badge es verde cuando todos los ítems están marcados", async ({ page }) => {
  const title = `E2E checklist-done ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  await page.locator(".card", { hasText: title }).click();
  await page.locator(".add-checklist-btn").click();

  const addInput = page.locator(".checklist-add input").first();
  await addInput.fill("Único ítem");
  await addInput.press("Enter");
  await expect(page.locator(".checklist-item")).toHaveCount(1, { timeout: 5000 });
  await page.locator(".checklist-item input[type=checkbox]").first().check();

  await page.locator("#cancelBtn").click();

  const badge = page.locator(".card", { hasText: title }).locator(".badge");
  await expect(badge).toHaveText("☑ 1/1", { timeout: 5000 });
  await expect(badge).toHaveClass(/badge-done/);
});
