import { expect, test } from "@playwright/test";
import { lowContrast, openBook, useScheme } from "./helpers.js";

// Paso de correspondencia de la importación: cada columna pregunta quién es en el grupo, con «Soy yo» primero.

const csv = columns => `Fecha,Descripción,Categoría,Coste,Moneda,${columns.join(",")}\n2026-01-01,Cena,Comida,30.00,COP,20.00,-10.00,-10.00\n`;

async function previewOf(page, book, columns) {
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "grupo.csv", mimeType: "text/csv", buffer: Buffer.from(csv(columns)) });
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByRole("heading", { name: "Revisá el archivo" })).toBeVisible();
}

const ownLabel = async page => (await page.locator('select[name="mapping_0"] option').first().innerText()).trim();

test("cada columna pregunta quién es y «Soy yo» es la primera opción", async ({ page }) => {
  const { book } = await openBook(page, "iy-opciones");
  await previewOf(page, book, ["Yo mismo", "Beto", "Caro"]);
  await expect(page.getByLabel("¿Quién es “Yo mismo” en este grupo?")).toBeVisible();
  await expect(page.getByLabel("¿Quién es “Caro” en este grupo?")).toBeVisible();
  const labels = await page.locator('select[name="mapping_0"] option').allInnerTexts();
  expect(labels[0]).toMatch(/^Soy yo \(/u);
  expect(labels).toContain("Beto");
  expect(labels.at(-1)).toBe("Una persona nueva");
  await expect(page.getByText("elegí «Soy yo»")).toBeVisible();
});

test("se preselecciona la persona con el mismo nombre y las desconocidas quedan como persona nueva", async ({ page }) => {
  const { book } = await openBook(page, "iy-preseleccion");
  await previewOf(page, book, ["Yo mismo", "beto", "Caro"]);
  await expect(page.getByLabel("¿Quién es “beto” en este grupo?")).toHaveValue(/participant_/u);
  expect(await page.getByLabel("¿Quién es “beto” en este grupo?").evaluate(select => select.selectedOptions[0].textContent)).toBe("Beto");
  await expect(page.getByLabel("¿Quién es “Caro” en este grupo?")).toHaveValue("new");
  await expect(page.getByLabel("¿Quién es “Yo mismo” en este grupo?")).toHaveValue("new");
});

test("elegir «Soy yo» no crea una persona repetida", async ({ page }) => {
  const { book } = await openBook(page, "iy-soy-yo");
  await previewOf(page, book, ["Yo mismo", "Beto", "Caro"]);
  const own = await ownLabel(page);
  await page.getByLabel("¿Quién es “Yo mismo” en este grupo?").selectOption({ label: own });
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByRole("heading", { name: "Así quedará el grupo" })).toBeVisible();
  await expect(page.getByText(`Yo mismo → ${own}`)).toBeVisible();
  await expect(page.getByText("quedarás fuera")).toHaveCount(0);
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 30_000 });
  await page.goto(`${book}/people`);
  await expect(page.getByRole("heading", { name: /^Personas · 3$/u })).toBeVisible();
  await expect(page.getByText("Yo mismo")).toHaveCount(0);
});

test("si ninguna columna es quien importa, la revisión lo avisa y deja continuar", async ({ page }) => {
  const { book } = await openBook(page, "iy-aviso");
  await previewOf(page, book, ["Yo mismo", "Beto", "Caro"]);
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByText(/Ninguna persona del archivo es “Soy yo/u)).toBeVisible();
  await expect(page.getByText("quedarás fuera de estos movimientos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar importación" })).toBeVisible();
});

test("dos columnas hacia la misma persona avisan que sus saldos se suman", async ({ page }) => {
  const { book } = await openBook(page, "iy-misma");
  await previewOf(page, book, ["Yo mismo", "Yo otra vez", "Beto"]);
  const own = await ownLabel(page);
  await page.getByLabel("¿Quién es “Yo mismo” en este grupo?").selectOption({ label: own });
  await page.getByLabel("¿Quién es “Yo otra vez” en este grupo?").selectOption({ label: own });
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByText(/«Yo mismo» y «Yo otra vez» se cargan a la misma persona/u)).toBeVisible();
  await expect(page.getByText("quedarás fuera")).toHaveCount(0);
});

for (const scheme of ["light", "dark"]) {
  test.describe(`correspondencia en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("el paso de personas y la revisión no desbordan, miden 44 px y tienen contraste", async ({ page }) => {
      const { book } = await openBook(page, `iy-tel-${scheme}`);
      await previewOf(page, book, ["Yo mismo con un nombre bastante largo para un teléfono", "Beto", "Caro"]);
      const check = async label => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desborde en ${label}`).toBeLessThanOrEqual(0);
        const small = await page.evaluate(() => [...document.querySelectorAll("a, button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file])")]
          .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
          .map(el => ({ text: (el.innerText || el.getAttribute("aria-label") || el.name || "").slice(0, 30), height: el.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await check("correspondencia");
      await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
      await expect(page.getByText("quedarás fuera de estos movimientos")).toBeVisible();
      await check("revisión");
    });
  });
}
