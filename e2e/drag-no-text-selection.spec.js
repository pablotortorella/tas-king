import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

// Regresión: el D&D nativo HTML5 (draggable=true) prevenía la selección de
// texto del navegador automáticamente. Al reemplazarlo por Pointer Events
// (arrastre en Firefox mobile) se perdió eso — arrastrar una tarjeta con
// mouse seleccionaba el texto de tarjetas/columnas vecinas. Usa page.mouse
// (eventos reales, no dispatchEvent sintético) porque la selección nativa
// del navegador solo se dispara con eventos "trusted".
test("arrastrar una tarjeta con mouse no selecciona texto de la ventana", async ({ page }) => {
  const card = page.locator(".card").first();
  const box = await card.boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Movimiento lento en varios pasos, cruzando texto de columnas vecinas —
  // así es como un usuario real dispara la selección nativa del navegador.
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + 5, { steps: 10 });
  await page.mouse.move(box.x + 400, box.y + 20, { steps: 15 });
  await page.mouse.move(box.x + 600, box.y + 60, { steps: 15 });

  const selectionDuringDrag = await page.evaluate(() => window.getSelection().toString());
  expect(selectionDuringDrag).toBe("");

  await page.mouse.up();
  const selectionAfterDrag = await page.evaluate(() => window.getSelection().toString());
  expect(selectionAfterDrag).toBe("");
});
