import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

// Antes de esto, las etiquetas solo se podían asignar reabriendo una tarjeta
// ya creada: el picker de etiquetas asumía `editingId`. Con draftLabels
// (mismo patrón que draftGoals), también se pueden elegir mientras se redacta
// una tarjeta nueva, y se vinculan recién al guardar. Ver docs/PRODUCT_BACKLOG.md.

const runId = Date.now().toString(36);
const labelName = `E2E etiqueta ${runId}`;
const cardTitle = `E2E tarjeta-etiqueta ${runId}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("crea y vincula una etiqueta a una tarjeta nueva antes de guardarla, y persiste al guardar", async ({ page }) => {
  await page.locator('.add-card[data-col="pendiente"]').click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await page.locator("#fTitle").fill(cardTitle);

  // Crear etiqueta desde el picker en modo borrador (sin id de tarjeta todavía).
  await page.locator("#fLabelsSection .add-label-btn").click();
  await page.locator("#newLabelName").fill(labelName);
  await page.locator("#createLabelBtn").click();

  // El chip aparece en el borrador, sin necesidad de guardar la tarjeta primero.
  const draftChip = page.locator("#fLabelsSection .label-in-card", { hasText: labelName });
  await expect(draftChip).toBeVisible();

  // Guardar la tarjeta nueva: la etiqueta elegida en el borrador se vincula.
  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: cardTitle })).toBeVisible();

  // Reabrir la tarjeta ya guardada: la etiqueta quedó vinculada de verdad.
  await page.locator(".card", { hasText: cardTitle }).click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await expect(page.locator("#fLabelsSection .label-in-card", { hasText: labelName })).toBeVisible();
  await page.locator("#cancelBtn").click();
});

test("quitar una etiqueta del borrador antes de guardar no la vincula a la tarjeta", async ({ page }) => {
  const otroTitulo = `E2E tarjeta-sin-etiqueta ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(otroTitulo);

  // La etiqueta ya existe (creada en el test anterior): asignarla desde el picker.
  await page.locator("#fLabelsSection .add-label-btn").click();
  await page.locator(".label-picker .existing-label", { hasText: labelName }).locator("text=Agregar").click();
  const draftChip = page.locator("#fLabelsSection .label-in-card", { hasText: labelName });
  await expect(draftChip).toBeVisible();

  // Arrepentirse antes de guardar: quitarla del borrador.
  await draftChip.locator(".remove").click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toHaveCount(0);

  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: otroTitulo })).toBeVisible();

  // La tarjeta guardada no arrastró ninguna etiqueta.
  await page.locator(".card", { hasText: otroTitulo }).click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toHaveCount(0);
  await page.locator("#cancelBtn").click();
});
