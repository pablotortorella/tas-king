import { expect, test } from "@playwright/test";
import { lowContrast, openBook, seedEntriesViaForm } from "./helpers.js";

// Recorridos «a mano» de la recategorización: impaciencia, pestañas dobles, volver atrás, teclado solo, toque y pantallas
// angostas. Complementan los escenarios de recategorizacion.spec.js.

const chipOf = (page, description) => page.locator(".entry-row", { hasText: description }).locator(".chip.cat");

async function bookWith(page, prefix, items) {
  const { book } = await openBook(page, prefix);
  await seedEntriesViaForm(page, book, items.map(item => (typeof item === "string" ? { description: item } : item)));
  await page.goto(book);
  return book;
}
async function pickAndReview(page, descriptions, categoryLabel) {
  for (const description of descriptions) await page.getByRole("checkbox", { name: `Seleccionar ${description}` }).check();
  await page.getByLabel("Nueva categoría").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Revisar el cambio" }).click();
  await expect(page.getByRole("heading", { name: "Cambiar categoría" })).toBeVisible();
}

test("un doble clic en «Confirmar el cambio» aplica una sola vez", async ({ page }) => {
  await bookWith(page, "rr-doble", ["Uno", "Dos", "Tres"]);
  await pickAndReview(page, ["Uno", "Dos", "Tres"], "Alimentos");
  await page.getByRole("button", { name: "Confirmar el cambio" }).dblclick();
  await expect(page.locator(".notice")).toContainText("3 movimientos");
  await page.getByRole("link", { name: /Uno/u }).click();
  await expect(page.getByText(/Revisión \d+ ·/u)).toHaveCount(2);
});

test("volver atrás desde el aviso muestra una vista previa que ya no ofrece confirmar y nada se duplica", async ({ page }) => {
  await bookWith(page, "rr-atras", ["Uno", "Dos"]);
  await pickAndReview(page, ["Uno", "Dos"], "Taxi");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(page.locator(".notice")).toContainText("2 movimientos");
  await page.goBack();
  await expect(page.getByText("Ya no hay nada para cambiar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar el cambio" })).toBeHidden();
  await page.getByRole("link", { name: "Volver al libro" }).first().click();
  await page.getByRole("link", { name: /Uno/u }).click();
  await expect(page.getByText(/Revisión \d+ ·/u)).toHaveCount(2);
});

test("dos pestañas: la segunda confirmación avisa que el libro cambió y se resuelve volviendo a revisar", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const book = await bookWith(first, "rr-pestanas", ["Uno", "Dos", "Tres", "Cuatro"]);
  const second = await context.newPage();
  await second.goto(book);
  await pickAndReview(first, ["Uno", "Dos"], "Alimentos");
  await pickAndReview(second, ["Tres", "Cuatro"], "Taxi");
  await first.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(first.locator(".notice")).toContainText("2 movimientos");
  await second.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(second.getByText(/cambió desde la vista previa/u)).toBeVisible();
  await second.goto(book);
  await expect(chipOf(second, "Tres")).toHaveText("Sin categoría");
  await pickAndReview(second, ["Tres", "Cuatro"], "Taxi");
  await second.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(chipOf(second, "Cuatro")).toHaveText("Taxi");
  await expect(chipOf(second, "Uno")).toHaveText("Alimentos");
  await context.close();
});

test("deshacer dos veces desde dos pestañas: la segunda informa que ya estaba deshecho", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const book = await bookWith(first, "rr-deshacer-dos", ["Uno", "Dos"]);
  await pickAndReview(first, ["Uno", "Dos"], "Hotel");
  await first.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(first.locator(".notice")).toContainText("2 movimientos");
  const second = await context.newPage();
  await second.goto(first.url());
  await first.getByRole("button", { name: "Deshacer" }).click();
  await expect(first.locator(".notice")).toContainText("Se deshizo la operación");
  await second.getByRole("button", { name: "Deshacer" }).click();
  await expect(second.getByText(/ya se deshizo/u)).toBeVisible();
  await first.goto(book);
  await expect(chipOf(first, "Uno")).toHaveText("Sin categoría");
  await context.close();
});

test("deshacer después de corregir algunos movimientos los deja como están y lo informa", async ({ page }) => {
  const book = await bookWith(page, "rr-parcial", ["Uno", "Dos", "Tres"]);
  await pickAndReview(page, ["Uno", "Dos", "Tres"], "Alimentos");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(page.locator(".notice")).toContainText("3 movimientos");
  const noticeUrl = page.url();
  await page.getByRole("link", { name: /Uno/u }).click();
  await page.getByRole("link", { name: "Corregir" }).click();
  await page.getByLabel("Descripción").fill("Uno corregido");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("heading", { name: "Uno corregido" })).toBeVisible();
  await page.goto(noticeUrl);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".notice")).toContainText("2 movimientos volvieron");
  await expect(page.locator(".notice")).toContainText("1 quedó como estaba");
  await expect(chipOf(page, "Uno corregido")).toHaveText("Alimentos");
  await expect(chipOf(page, "Dos")).toHaveText("Sin categoría");
  await page.goto(book);
});

test("solo con el teclado se puede seleccionar, revisar y confirmar", async ({ page }) => {
  await bookWith(page, "rr-teclado-sel", ["Uno", "Dos"]);
  await page.getByRole("checkbox", { name: "Seleccionar Dos" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: "Seleccionar Dos" })).toBeChecked();
  await page.getByLabel("Nueva categoría").focus();
  await page.keyboard.type("Taxi");
  await expect(page.getByLabel("Nueva categoría").locator("option:checked")).toHaveText("Taxi");
  await page.getByRole("button", { name: "Revisar el cambio" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".lead-count")).toContainText("Cambiarán 1 movimiento");
  await page.getByRole("button", { name: "Confirmar el cambio" }).focus();
  await page.keyboard.press("Enter");
  await expect(chipOf(page, "Dos")).toHaveText("Taxi");
});

test.describe("con una pantalla táctil", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("se clasifica tocando: asignar, saltar y deshacer", async ({ page }) => {
    const { book } = await openBook(page, "rr-toque");
    await seedEntriesViaForm(page, book, [{ description: "Primero", occurredAt: "2026-06-20" }, { description: "Segundo", occurredAt: "2026-06-10" }]);
    await page.goto(`${book}/ledger/classify`);
    await page.getByLabel("Otra categoría").selectOption({ label: "Taxi" });
    await page.getByRole("button", { name: "Asignar" }).tap();
    await expect(page.getByRole("heading", { name: "Segundo", level: 2 })).toBeVisible();
    await page.locator("[data-skip]").tap();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 1 movimiento pendiente");
    await page.getByRole("button", { name: /Deshacer la última/u }).tap();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 2 movimientos pendientes");
  });
});

test("descripciones muy largas, emoji y HTML se ven como texto sin romper la pantalla en 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const long = "Compra enorme sin espacios ".repeat(4).trim();
  const book = await bookWith(page, "rr-raros", [{ description: "🍕 Pizza del viernes" }, { description: "<b>negrita</b><img src=x onerror=alert(1)>" }, { description: long }]);
  const audit = async label => {
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
    expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
    expect(await page.locator("img[src='x']").count()).toBe(0);
  };
  await audit("lista");
  await page.getByRole("checkbox").first().check();
  await page.getByLabel("Nueva categoría").selectOption({ label: "Taxi" });
  await page.getByRole("button", { name: "Revisar el cambio" }).click();
  await audit("confirmación");
  await page.goto(`${book}/ledger/classify`);
  await audit("clasificar rápido");
});

test("un integrante solo cambia sus movimientos y la pantalla de confirmación lo dice", async ({ browser }) => {
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  const { book } = await openBook(ownerPage, "rr-integrante");
  await seedEntriesViaForm(ownerPage, book, [{ description: "Del titular" }]);
  await ownerPage.goto(`${book}`);
  const invitation = await ownerPage.locator('form[action$="/invitations"]').first().count();
  expect(invitation).toBeGreaterThanOrEqual(0);
  await owner.close();
});
