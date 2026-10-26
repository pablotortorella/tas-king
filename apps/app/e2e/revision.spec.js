import { expect, test } from "@playwright/test";
import { openBook, openBulk, openRecent, seedEntriesViaForm } from "./helpers.js";

// Regresiones de la revisión integral de código: cada escenario protege un defecto encontrado.

test("corregir un movimiento importado con varios pagadores, sin tocar el pagador, no cambia los saldos", async ({ page }) => {
  const { book } = await openBook(page, "rv-pagadores");
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto,Caro\n2026-01-03,Cena grande,Comida,150.00,COP,90.00,60.00,-150.00\n";
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "multi.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await page.getByRole("link", { name: /Cena grande/u }).click();
  const effects = async () => page.locator(".split-total, table.split tbody").first().innerText();
  const before = await effects();
  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await expect(page.getByLabel(/Mantener los actuales/u)).toBeChecked();
  await expect(page.getByText(/Este movimiento tiene varios \(2\)/u)).toBeVisible();
  await page.getByLabel("Descripción").fill("Cena grande (corregida)");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await openRecent(page, "Cena grande (corregida)");
  expect(await effects()).toBe(before);
  await expect(page.getByText("Cambió: descripción")).toBeVisible();
});

test("«Clasificar rápido»: los atajos de una tecla se pueden apagar y la preferencia se recuerda", async ({ page }) => {
  const { book } = await openBook(page, "rv-atajos");
  await seedEntriesViaForm(page, book, [{ description: "Uno" }, { description: "Dos" }]);
  await page.goto(`${book}/ledger/classify`);
  const toggle = page.getByLabel(/Atajos de teclado/u);
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole("heading", { name: "Clasificar rápido" }).click();
  await page.keyboard.press("s");
  await expect(page).not.toHaveURL(/saltar=/u);
  await page.reload();
  await expect(page.getByLabel(/Atajos de teclado/u)).not.toBeChecked();
  await page.getByLabel(/Atajos de teclado/u).check();
  await page.getByRole("heading", { name: "Clasificar rápido" }).click();
  await page.keyboard.press("s");
  await expect(page).toHaveURL(/saltar=/u);
});

test("«Clasificar rápido»: Enter sobre un enlace no acepta la sugerida", async ({ page }) => {
  const { book } = await openBook(page, "rv-enter");
  await seedEntriesViaForm(page, book, [{ description: "Veterinaria Patitas 1" }, { description: "Veterinaria Patitas 2" }, { description: "Veterinaria Patitas 3" }]);
  await page.goto(`${book}/ledger/classify`);
  for (let round = 0; round < 3; round += 1) {
    await page.getByLabel("Otra categoría").selectOption({ label: "Mascotas" });
    await page.getByRole("button", { name: "Asignar" }).click();
  }
  await seedEntriesViaForm(page, book, [{ description: "Veterinaria Patitas control", occurredAt: "2026-12-01" }]);
  await page.goto(`${book}/ledger/classify`);
  await expect(page.locator(".suggestion")).toBeVisible();
  await page.locator("[data-skip]").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/saltar=/u);
  await page.goto(book);
  await expect(page.locator(".entry-row", { hasText: "Veterinaria Patitas control" }).locator(".chip.cat")).toHaveText("Sin categoría");
});

test("crear una categoría que ya existe (con otro nombre escrito) avisa que no se creó otra", async ({ page }) => {
  const { book } = await openBook(page, "rv-existente");
  await page.goto(`${book}/ledger/categories`);
  await page.locator("form", { has: page.getByRole("heading", { name: "Nueva categoría" }) }).getByLabel("Nombre").fill("ALIMENTOS");
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(page.locator(".notice")).toContainText("ya existía");
  await expect(page.locator(".chip.cat", { hasText: /^Alimentos$/u })).toHaveCount(1);
});

test("«todos los resultados» respeta el filtro de persona: lo que dice la lista es lo que se cambia", async ({ page }) => {
  const { book } = await openBook(page, "rv-quien");
  await seedEntriesViaForm(page, book, [{ description: "Uno" }, { description: "Dos" }]);
  await page.goto(book);
  await page.getByRole("searchbox").fill("Beto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.locator(".person-filters a", { hasText: /^Participa/u }).click();
  await openBulk(page);
  await page.getByLabel(/Todos los 2 resultados/u).check();
  await page.getByLabel("Nueva categoría").selectOption({ label: "Taxi" });
  await page.getByRole("button", { name: "Revisar el cambio" }).click();
  await expect(page.locator(".lead-count")).toContainText("Cambiarán 2 movimientos");
  await expect(page).toHaveURL(/quien=participa/u);
});
