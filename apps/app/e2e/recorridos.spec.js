import { expect, test } from "@playwright/test";
import { lowContrast, openBook, openRecent } from "./helpers.js";

// Recorridos «a mano» automatizados: lo que haría una persona curiosa o apurada con un navegador real. No miden un
// contrato fino sino que nada se rompa de maneras que un humano notaría: teclado solo, toque, doble clic, volver
// atrás, sin red, nombres raros, pantallas angostas y dos pestañas a la vez.

const entryTitles = page => page.locator(".entry-title");
const categoryRow = (page, name) => page.locator(".cat-row", { has: page.locator(".chip.cat", { hasText: new RegExp(`^${name}$`, "u") }) });

async function fillExpense(page, book, description, { type } = {}) {
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Importe", { exact: true }).fill("50,00");
  if (type !== undefined) await page.getByLabel("O escribí una nueva").fill(type);
}

test("solo con el teclado: se completa el formulario, se elige la categoría y se guarda con Enter", async ({ page }) => {
  const { book } = await openBook(page, "teclado");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").focus();
  await page.keyboard.type("Viaje en taxi");
  await page.getByLabel("Importe", { exact: true }).focus();
  await page.keyboard.type("25,00");
  await page.getByLabel("Elegí una").focus();
  await page.keyboard.type("Taxi");
  await expect(page.getByLabel("Elegí una").locator("option:checked")).toHaveText("Taxi");
  await page.getByLabel("Descripción").focus();
  await page.keyboard.press("Enter");
  await openRecent(page, "Viaje en taxi");
  await expect(page.locator(".entry-category")).toContainText("Taxi");
});

test("la gestión es operable con el teclado: abrir «Editar», cambiar el nombre y guardar", async ({ page }) => {
  const { book } = await openBook(page, "teclado-gestion");
  await page.goto(`${book}/ledger/categories`);
  const summary = categoryRow(page, "Alimentos").locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  const name = categoryRow(page, "Alimentos").getByLabel("Nombre");
  await expect(name).toBeVisible();
  await name.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Compras del súper");
  await page.keyboard.press("Enter");
  await expect(page.locator(".notice")).toContainText("Categoría guardada");
  await expect(categoryRow(page, "Compras del súper")).toHaveCount(1);
});

test.describe("con una pantalla táctil", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("se navega y se guarda tocando", async ({ page }) => {
    const { book } = await openBook(page, "toque");
    await page.goto(`${book}/ledger/new?type=expense`);
    await page.getByLabel("Descripción").tap();
    await page.getByLabel("Descripción").fill("Compra con el dedo");
    await page.getByLabel("Importe", { exact: true }).fill("10,00");
    await page.getByLabel("Elegí una").selectOption({ label: "Alimentos" });
    await page.getByRole("button", { name: "Guardar" }).tap();
    await expect(page.locator(".recent-strip")).toContainText("Compra con el dedo");
    await page.goto(`${book}/ledger/categories`);
    await page.locator(".cat-row summary").first().tap();
    await expect(page.locator(".cat-row details[open]")).toHaveCount(1);
  });
});

test("un doble clic en Guardar crea un solo movimiento", async ({ page }) => {
  const { book } = await openBook(page, "doble");
  await fillExpense(page, book, "Doble clic", { type: "Panadería" });
  await page.getByRole("button", { name: "Guardar" }).dblclick();
  await expect(page.locator(".recent-strip")).toContainText("Doble clic");
  await page.goto(book);
  await expect(entryTitles(page)).toHaveText(["Doble clic"]);
  await page.goto(`${book}/ledger/categories`);
  await expect(page.locator(".cat-row", { has: page.locator(".chip.cat", { hasText: /^Panadería$/u }) })).toHaveCount(1);
});

test("volver atrás después de guardar deja un formulario limpio y usable, sin duplicar el movimiento ya guardado", async ({ page }) => {
  const { book } = await openBook(page, "atras");
  await fillExpense(page, book, "Atrás y adelante");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Atrás y adelante");
  await page.goBack();
  await expect(page.getByLabel("Descripción")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/ledger\/new/u);
  await page.getByLabel("Descripción").fill("Segundo movimiento");
  await page.getByLabel("Importe", { exact: true }).fill("7,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Segundo movimiento");
  await page.goto(book);
  await expect(entryTitles(page)).toHaveCount(2);
  expect((await entryTitles(page).allTextContents()).sort()).toEqual(["Atrás y adelante", "Segundo movimiento"]);
});

test("sin red el formulario avisa, no guarda nada y permite reintentar una sola vez", async ({ page, context }) => {
  const { book } = await openBook(page, "sinred");
  await fillExpense(page, book, "Se cortó internet", { type: "Imprevistos" });
  await context.setOffline(true);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".form-feedback.error")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Se cortó internet");
  await page.goto(book);
  await expect(entryTitles(page)).toHaveText(["Se cortó internet"]);
});

test("con una red lenta se ve que está guardando y termina bien", async ({ page }) => {
  const { book } = await openBook(page, "lenta");
  await fillExpense(page, book, "Conexión lenta");
  await page.route("**/ledger/entries", async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: /Guardar/u })).toBeDisabled();
  await expect(page.locator(".recent-strip")).toContainText("Conexión lenta", { timeout: 15_000 });
});

test("nombres raros de categoría: emoji, etiquetas HTML, acentos y largo máximo se muestran como texto y sin romper la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { book } = await openBook(page, "raros");
  const names = ["🍕 Pizza del viernes", "<b>negrita</b><img src=x onerror=alert(1)>", "Ñandú y Güira", "A".repeat(60)];
  for (const [index, name] of names.entries()) {
    await fillExpense(page, book, `Con nombre raro ${index}`, { type: name });
    await page.getByRole("button", { name: "Guardar" }).click();
    await openRecent(page, `Con nombre raro ${index}`);
    await expect(page.locator(".entry-category .chip.cat")).toHaveText(name);
  }
  for (const path of [book, `${book}/ledger/categories`, `${book}/ledger/new?type=expense`]) {
    await page.goto(path);
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content, `desborde en ${path}`).toBeLessThanOrEqual(sizes.viewport);
    expect(await page.locator("img[src='x']").count()).toBe(0);
  }
});

test("el campo de categoría nueva no deja escribir más de 60 caracteres", async ({ page }) => {
  const { book } = await openBook(page, "largo");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("O escribí una nueva").fill("x".repeat(100));
  expect((await page.getByLabel("O escribí una nueva").inputValue()).length).toBe(60);
});

test("en una pantalla muy angosta (320 px) el formulario y la gestión siguen sin desbordar y legibles", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { book } = await openBook(page, "angosta");
  for (const path of [`${book}/ledger/new?type=expense`, `${book}/ledger/categories`, book]) {
    await page.goto(path);
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content, `desborde en ${path}`).toBeLessThanOrEqual(sizes.viewport);
    expect(await lowContrast(page), `contraste en ${path}`).toEqual([]);
  }
});

test("dos pestañas que crean la misma categoría al mismo tiempo dejan una sola", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const { book } = await openBook(first, "carrera");
  const second = await context.newPage();
  await fillExpense(first, book, "Pestaña uno", { type: "Barbería" });
  await fillExpense(second, book, "Pestaña dos", { type: "barbería" });
  await Promise.all([first.getByRole("button", { name: "Guardar" }).click(), second.getByRole("button", { name: "Guardar" }).click()]);
  await expect(first.locator(".recent-strip")).toContainText("Pestaña uno");
  await expect(second.locator(".recent-strip")).toContainText("Pestaña dos");
  await first.goto(`${book}/ledger/categories`);
  await expect(first.locator(".cat-row", { has: first.locator(".chip.cat", { hasText: /^Barbería$/iu }) })).toHaveCount(1);
  await first.goto(book);
  await expect(first.locator(".chip.cat", { hasText: /^Barbería$/iu })).toHaveCount(2);
  await context.close();
});

test("fusionar mientras otra pestaña tiene el formulario abierto no pierde el movimiento", async ({ browser }) => {
  const context = await browser.newContext();
  const admin = await context.newPage();
  const { book } = await openBook(admin, "fusion-abierta");
  const writer = await context.newPage();
  await writer.goto(`${book}/ledger/new?type=expense`);
  await writer.getByLabel("Descripción").fill("Con formulario viejo");
  await writer.getByLabel("Importe", { exact: true }).fill("30,00");
  await writer.getByLabel("Elegí una").selectOption({ label: "Licor" });
  await admin.goto(`${book}/ledger/categories`);
  await categoryRow(admin, "Licor").locator("summary").click();
  await categoryRow(admin, "Licor").getByLabel("Fusionar en").selectOption({ label: "Comidas y bebidas · Restaurantes" });
  await categoryRow(admin, "Licor").getByRole("button", { name: "Fusionar" }).click();
  await expect(admin.locator(".notice")).toContainText("fusionadas");
  await writer.getByRole("button", { name: "Guardar" }).click();
  await expect(writer.locator(".form-feedback.error, h1")).toBeVisible();
  await writer.goto(book);
  const titles = await entryTitles(writer).allTextContents();
  if (titles.includes("Con formulario viejo")) await expect(writer.locator(".chip.cat", { hasText: /^Licor$/u })).toHaveCount(0);
  else await expect(writer.getByText("Licor")).toHaveCount(0);
  await context.close();
});
