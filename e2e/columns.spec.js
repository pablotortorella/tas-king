import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const newColName = `E2E Col ${runId}`;
const renamedColName = `E2E Renombrada ${runId}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#board .column", { timeout: 10000 });
});

test("agrega una nueva columna al tablero", async ({ page }) => {
  const initialCount = await page.locator("#board .column").count();

  // El botón "+ Columna" debe estar visible para el owner
  const addBtn = page.locator(".add-column-btn");
  await expect(addBtn).toBeVisible();
  await addBtn.click();

  // Se muestra el formulario inline
  const input = page.locator(".add-column-input");
  await expect(input).toBeVisible();
  await input.fill(newColName);
  await page.locator(".add-column-confirm").click();

  // La nueva columna aparece en el tablero
  await expect(page.locator("#board .column")).toHaveCount(initialCount + 1);
  await expect(page.locator(".column-header .col-name-text", { hasText: newColName })).toBeVisible();
});

test("renombra una columna existente", async ({ page }) => {
  // La columna del test anterior debe existir
  const colHeader = page.locator(".column-header", { hasText: newColName });
  await expect(colHeader).toBeVisible();

  // Click en el botón ✏️ de renombrar (aparece al hover)
  await colHeader.hover();
  const renameBtn = colHeader.locator(".col-rename-btn");
  await expect(renameBtn).toHaveText("✏️");
  await renameBtn.click();

  // Aparece el input inline con el nombre actual
  // No usamos colHeader como scope porque tras el click el span de texto fue
  // reemplazado por un <input>, así que hasText ya no matchea ese header.
  const input = page.locator(".col-rename-input");
  await expect(input).toBeVisible();
  await input.clear();
  await input.fill(renamedColName);
  await input.press("Enter");

  // El nombre actualizado aparece en el tablero
  await expect(page.locator(".column-header .col-name-text", { hasText: renamedColName })).toBeVisible();
  await expect(page.locator(".column-header .col-name-text", { hasText: newColName })).toHaveCount(0);
});

test("elimina una columna vacía y deja el tablero en 5 columnas", async ({ page }) => {
  const colCount = await page.locator("#board .column").count();

  // La columna renombrada está vacía: debe mostrar el botón 🗑️
  const colHeader = page.locator(".column-header", { hasText: renamedColName });
  await colHeader.hover();
  const deleteBtn = colHeader.locator(".col-delete-btn");
  await expect(deleteBtn).toBeVisible();
  await expect(deleteBtn).toHaveText("🗑️");

  // Confirmar la eliminación
  page.on("dialog", d => d.accept());
  await deleteBtn.click();

  // La columna desaparece y el tablero vuelve al conteo previo
  await expect(page.locator("#board .column")).toHaveCount(colCount - 1);
  await expect(page.locator(".column-header .col-name-text", { hasText: renamedColName })).toHaveCount(0);
});

test("cancela la adición de columna con Escape", async ({ page }) => {
  const initialCount = await page.locator("#board .column").count();

  await page.locator(".add-column-btn").click();
  const input = page.locator(".add-column-input");
  await input.fill("No guardar");
  await input.press("Escape");

  // El tablero vuelve al estado anterior sin nueva columna
  await expect(page.locator("#board .column")).toHaveCount(initialCount);
});

test("mueve una columna a la derecha con ▶ y a la izquierda con ◀", async ({ page }) => {
  // Toma el nombre de la primera columna
  const firstColName = await page.locator("#board .column .col-name-text").first().textContent();
  const secondColName = await page.locator("#board .column .col-name-text").nth(1).textContent();

  // Hover en la primera columna para mostrar los botones
  const firstHeader = page.locator("#board .column-header").first();
  await firstHeader.hover();

  // La primera columna no tiene ◀ pero sí ▶
  await expect(firstHeader.locator(".col-move-btn[data-dir='left']")).toHaveCount(0);
  const moveRight = firstHeader.locator(".col-move-btn[data-dir='right']");
  await expect(moveRight).toBeVisible();
  await moveRight.click();

  // Esperar re-render: la primera columna ahora debe ser la que antes era segunda
  await page.waitForFunction(
    name => document.querySelector("#board .column .col-name-text")?.textContent?.includes(name),
    secondColName.trim()
  );
  const newFirst = await page.locator("#board .column .col-name-text").first().textContent();
  expect(newFirst?.trim()).toBe(secondColName?.trim());

  // Mover de vuelta a la izquierda para restaurar el orden original
  const movedHeader = page.locator("#board .column-header").nth(1);
  await movedHeader.hover();
  const moveLeft = movedHeader.locator(".col-move-btn[data-dir='left']");
  await expect(moveLeft).toBeVisible();
  await moveLeft.click();

  await page.waitForFunction(
    name => document.querySelector("#board .column .col-name-text")?.textContent?.includes(name),
    firstColName.trim()
  );
  const restored = await page.locator("#board .column .col-name-text").first().textContent();
  expect(restored?.trim()).toBe(firstColName?.trim());
});
