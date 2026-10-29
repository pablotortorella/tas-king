import { expect, test } from "@playwright/test";
import { lowContrast, openBook, openRecent, useScheme } from "./helpers.js";

const paymentSelect = page => page.getByLabel("¿Con qué se pagó?");

async function addExpense(page, book, description, method) {
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Importe", { exact: true }).fill("100,00");
  if (method) await paymentSelect(page).selectOption({ label: method });
  await page.getByRole("button", { name: "Guardar" }).click();
  await openRecent(page, description);
}

test("elegir la forma de pago la deja en el detalle, corregirla queda en el historial y quitarla la borra", async ({ page }) => {
  const { book } = await openBook(page, "pago");
  await page.goto(`${book}/ledger/new?type=expense`);
  await expect(paymentSelect(page).locator("option")).toHaveText(["Sin indicar", "Efectivo", "Débito", "Crédito", "Transferencia", "Billetera virtual"]);
  await expect(paymentSelect(page)).toHaveValue("");
  await addExpense(page, book, "Súper con tarjeta", "Crédito");
  await expect(page.locator(".entry-category .chip.pay")).toHaveText("Crédito");

  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await expect(paymentSelect(page)).toHaveValue("credit");
  await paymentSelect(page).selectOption({ label: "Billetera virtual" });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await openRecent(page, "Súper con tarjeta");
  await expect(page.locator(".entry-category .chip.pay")).toHaveText("Billetera virtual");
  await expect(page.getByText("Cambió: forma de pago")).toBeVisible();

  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await paymentSelect(page).selectOption({ label: "Sin indicar" });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await openRecent(page, "Súper con tarjeta");
  await expect(page.locator(".chip.pay")).toHaveCount(0);
});

test("un movimiento sin forma de pago no muestra ninguna y las transferencias no la piden", async ({ page }) => {
  const { book } = await openBook(page, "pago-sin");
  await addExpense(page, book, "Sin dato");
  await expect(page.locator(".chip.pay")).toHaveCount(0);
  await page.goto(`${book}/ledger/new?type=transfer`);
  await expect(page.getByLabel("¿Con qué se pagó?")).toHaveCount(0);
});

test("el CSV del libro trae la columna forma_pago", async ({ page }) => {
  const { book } = await openBook(page, "pago-csv");
  await addExpense(page, book, "Pagado en efectivo", "Efectivo");
  // fetch desde la propia página: viaja con la cookie de sesión, como el enlace «Exportar».
  const text = await page.evaluate(async url => { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.text(); }, `${book}/ledger/export.csv`);
  expect(text.split("\r\n")[0]).toContain('"forma_pago"');
  expect(text).toContain('"Efectivo"');
});

for (const scheme of ["light", "dark"]) {
  test.describe(`forma de pago en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("el campo no desborda, mide 44 px y el contraste alcanza", async ({ page }) => {
      const { book } = await openBook(page, `pago-${scheme}`);
      await addExpense(page, book, "Con forma de pago", "Débito");
      for (const path of [`${book}/ledger/new?type=expense`, page.url()]) {
        await page.goto(path);
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${path}`).toBeLessThanOrEqual(sizes.viewport);
        expect(await lowContrast(page), `contraste en ${path}`).toEqual([]);
      }
      await page.goto(`${book}/ledger/new?type=expense`);
      expect((await paymentSelect(page).boundingBox()).height).toBeGreaterThanOrEqual(43.5);
    });
  });
}
