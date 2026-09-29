import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

// Estándar de teclado en ítems de checklist (ADR-014 + docs/PRODUCT_BACKLOG.md,
// "Tab/Enter estándar en toda la interfaz de tarjetas"): Tab salta directo entre
// los textos de los ítems (no por checkbox/flechas/borrar), Enter deja lista la
// fila de "Nueva subtarea" para seguir cargando, y Backspace en un ítem vacío
// lo borra y vuelve al anterior.

const runId = Date.now().toString(36);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

async function crearTarjetaConItems(page, title, items) {
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator(".add-checklist-btn").click();
  await expect(page.locator(".checklist-section")).toBeVisible();
  const addInput = page.locator(".checklist-add input").first();
  for (const text of items) {
    await addInput.fill(text);
    await addInput.press("Enter");
  }
  await expect(page.locator(".checklist-item")).toHaveCount(items.length);
}

test("Tab entre ítems salta directo al texto del siguiente, sin pasar por los botones", async ({ page }) => {
  await crearTarjetaConItems(page, `E2E kb-tab ${runId}`, ["Uno", "Dos", "Tres"]);

  const textos = page.locator(".checklist-item-text");
  await textos.nth(0).click();
  await expect(textos.nth(0)).toBeFocused();

  await textos.nth(0).press("Tab");
  await expect(textos.nth(1)).toBeFocused();

  await textos.nth(1).press("Tab");
  await expect(textos.nth(2)).toBeFocused();

  // Del último ítem, Tab sigue a la fila de "Nueva subtarea" (no a los botones).
  await textos.nth(2).press("Tab");
  await expect(page.locator(".checklist-add input").first()).toBeFocused();

  // Shift+Tab vuelve hacia atrás por los textos.
  await textos.nth(2).click();
  await textos.nth(2).press("Shift+Tab");
  await expect(textos.nth(1)).toBeFocused();
});

test("Enter en un ítem confirma la edición y deja lista la fila de Nueva subtarea", async ({ page }) => {
  await crearTarjetaConItems(page, `E2E kb-enter ${runId}`, ["Original"]);

  const texto = page.locator(".checklist-item-text").first();
  await texto.fill("Editado");
  await texto.press("Enter");

  await expect(page.locator(".checklist-add input").first()).toBeFocused();
  // La edición se confirmó (no quedó pendiente de guardar sin blur).
  await expect(texto).toHaveValue("Editado");
});

test("Backspace en un ítem vacío lo borra y vuelve el foco al anterior", async ({ page }) => {
  await crearTarjetaConItems(page, `E2E kb-backspace ${runId}`, ["Primero", "Segundo"]);

  const textos = page.locator(".checklist-item-text");
  await textos.nth(1).click();
  await textos.nth(1).fill("");
  await textos.nth(1).press("Backspace");

  await expect(page.locator(".checklist-item")).toHaveCount(1);
  await expect(page.locator(".checklist-item-text").first()).toHaveValue("Primero");
  await expect(page.locator(".checklist-item-text").first()).toBeFocused();
});

test("Backspace en el único ítem, ya vacío, lo borra y vuelve el foco a Nueva subtarea", async ({ page }) => {
  await crearTarjetaConItems(page, `E2E kb-backspace-unico ${runId}`, ["Solo"]);

  const texto = page.locator(".checklist-item-text").first();
  await texto.click();
  await texto.fill("");
  await texto.press("Backspace");

  await expect(page.locator(".checklist-item")).toHaveCount(0);
  await expect(page.locator(".checklist-add input").first()).toBeFocused();
});
