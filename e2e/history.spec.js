import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("historial registra creación de tarjeta", async ({ page }) => {
  const title = `E2E hist-creacion ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator("#fHistory")).toContainText('Creó la tarjeta en "Pendiente"', { timeout: 5000 });
});

test("historial registra cambio de columna via modal", async ({ page }) => {
  const title = `E2E hist-columna-modal ${runId}`;

  // Crear en Pendiente
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  // Mover a "En progreso" desde el modal
  await page.locator(".card", { hasText: title }).click();
  await page.locator("#fColumn").selectOption("en_progreso");
  await page.locator("#saveBtn").click();

  // Reabrir y verificar historial
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator("#fHistory")).toContainText('En progreso', { timeout: 5000 });
});

test("historial registra cambio de columna via drag & drop", async ({ page }) => {
  const title = `E2E hist-drag ${runId}`;

  // Crear tarjeta en Pendiente
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  await expect(page.locator(".card", { hasText: title })).toBeVisible();

  // page.dragAndDrop/dragTo no funcionan bien con la implementación HTML5 de la app.
  // Interceptamos la respuesta del reorder para capturar errores antes de disparar el drag.
  const reorderResponse = page.waitForResponse(
    resp => resp.url().includes("/reorder"),
    { timeout: 10000 }
  );

  // Simulamos el drag: agregamos .dragging, movemos el nodo al target y disparamos "drop"
  // para que el handler llame rebuildOrderFromDom() + persistOrder().
  await page.evaluate((cardTitle) => {
    const card = [...document.querySelectorAll(".card")].find(c => c.textContent.includes(cardTitle));
    const target = document.querySelector('.cards[data-col="en_progreso"]');
    if (!card || !target) throw new Error(`No se encontró card "${cardTitle}" o target en_progreso`);

    card.classList.add("dragging");
    target.appendChild(card);
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
  }, title);

  // Esperar el API call (el card_moved ya está logeado al completar)
  const reorderResp = await reorderResponse;
  expect(reorderResp.status()).toBe(200);

  // Esperar que la tarjeta aparezca en la nueva columna
  await expect(
    page.locator('.cards[data-col="en_progreso"] .card', { hasText: title })
  ).toBeVisible({ timeout: 5000 });

  // Abrir y verificar historial
  await page.locator(".card", { hasText: title }).click();
  await expect(page.locator("#fHistory")).toContainText('En progreso', { timeout: 5000 });
});

test("historial registra edición de título", async ({ page }) => {
  const title = `E2E hist-edicion ${runId}`;
  const newTitle = `${title} editado`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  await page.locator(".card", { hasText: title }).click();
  await page.locator("#fTitle").fill(newTitle);
  await page.locator("#saveBtn").click();

  await page.locator(".card", { hasText: newTitle }).click();
  await expect(page.locator("#fHistory")).toContainText("cambió el título", { timeout: 5000 });
});
