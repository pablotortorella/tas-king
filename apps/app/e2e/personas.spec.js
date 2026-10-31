import { expect, test } from "@playwright/test";
import { lowContrast, openBook, seedEntriesViaForm, useScheme } from "./helpers.js";

// Pantalla de personas: renombrar y unir dos personas. La titular une a «Beto» (sin cuenta) con ella misma.

async function ownerName(page) {
  const own = await page.locator(".person-block", { hasText: "· vos" }).locator("strong").first().innerText();
  return own.replace(/\s*·\s*vos\s*$/u, "").trim();
}

async function prepared(page, prefix) {
  const { book } = await openBook(page, prefix);
  await seedEntriesViaForm(page, book, [{ description: "Mercado" }, { description: "Cena", amount: "60,00" }, { description: "Taxi", amount: "30,00" }]);
  await page.goto(`${book}/people`);
  return { book, name: await ownerName(page) };
}

async function startMerge(page, name) {
  await page.getByRole("link", { name: "Unir a Beto con otra persona" }).click();
  await page.getByLabel("Unir con").selectOption({ label: `${name} (con cuenta)` });
  await page.getByRole("button", { name: "Ver qué cambia" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Unir a Beto con");
}

test("renombrar a una persona la actualiza en todo el libro y un nombre repetido se explica", async ({ page }) => {
  const { book } = await prepared(page, "pe-renombrar");
  await page.locator(".person-block", { hasText: "Beto" }).locator("summary", { hasText: "Renombrar" }).click();
  await page.getByLabel("Nombre de Beto").fill("Beto Ríos");
  await page.getByRole("button", { name: "Guardar nombre" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Nombre guardado." })).toBeVisible();
  await expect(page.locator(".person-block", { hasText: "Beto Ríos" })).toBeVisible();
  await page.goto(book);
  await expect(page.getByText("Beto Ríos").first()).toBeVisible();
  await page.goto(`${book}/people`);
  await page.locator(".person-block", { hasText: "Beto Ríos" }).locator("summary", { hasText: "Renombrar" }).click();
  await page.getByLabel("Nombre de Beto Ríos").fill((await ownerName(page)).toUpperCase());
  await page.getByRole("button", { name: "Guardar nombre" }).first().click();
  await expect(page.getByRole("alert")).toContainText("Ya hay una persona con ese nombre");
});

test("unir a Beto con la titular: vista previa, confirmación y resultado", async ({ page }) => {
  const { book, name } = await prepared(page, "pe-unir");
  await startMerge(page, name);
  await expect(page.getByText(`3 movimientos pasan de Beto a ${name}`)).toBeVisible();
  await expect(page.getByText("no se puede deshacer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saldos" })).toBeVisible();
  await page.getByRole("button", { name: "Unir personas" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Personas unidas." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personas unidas" })).toBeVisible();
  await expect(page.getByText(`unida a ${name}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Unir a Beto con otra persona" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Personas · 1$/u })).toBeVisible();
  await page.goto(book);
  await expect(page.locator(".balance-row")).toHaveCount(1);
  await page.getByRole("link", { name: /Mercado/u }).first().click();
  await expect(page.getByText("Cambió: unión de personas")).toBeVisible();
  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/u);
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
});

test("doble clic en «Unir personas» y volver atrás no duplican nada", async ({ page }) => {
  const { book, name } = await prepared(page, "pe-doble");
  await startMerge(page, name);
  await page.getByRole("button", { name: "Unir personas" }).dblclick();
  await expect(page.getByRole("status").filter({ hasText: "Personas unidas." })).toBeVisible();
  await expect(page.locator("#unidas li")).toHaveCount(1);
  await page.goBack();
  await page.goto(`${book}/people`);
  await expect(page.locator("#unidas li")).toHaveCount(1);
  await page.goto(book);
  await page.getByRole("link", { name: /Mercado/u }).first().click();
  await expect(page.getByText("Cambió: unión de personas")).toHaveCount(1);
});

test("cancelar en la confirmación no cambia nada", async ({ page }) => {
  const { name } = await prepared(page, "pe-cancelar");
  await startMerge(page, name);
  await page.getByRole("link", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Personas · 2$/u })).toBeVisible();
  await expect(page.locator("#unidas")).toHaveCount(0);
});

test("solo con el teclado se une a una persona de principio a fin", async ({ page }) => {
  const { name } = await prepared(page, "pe-teclado");
  await page.getByRole("link", { name: "Unir a Beto con otra persona" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Unir con").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByLabel("Unir con")).toHaveValue(/participant_/u);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Unir a Beto con");
  await page.getByRole("button", { name: "Unir personas" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Personas unidas." })).toBeVisible();
  expect(name.length).toBeGreaterThan(0);
});

for (const scheme of ["light", "dark"]) {
  test.describe(`personas en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("la lista, elegir y confirmar no desbordan, miden 44 px y tienen contraste", async ({ page }) => {
      const { name } = await prepared(page, `pe-tel-${scheme}`);
      const check = async label => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desborde en ${label}`).toBeLessThanOrEqual(0);
        const small = await page.evaluate(() => [...document.querySelectorAll("a, button, summary, select, input:not([type=hidden])")]
          .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest(".tabbar"))
          .map(el => ({ text: (el.innerText || el.getAttribute("aria-label") || el.name || "").slice(0, 30), height: el.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await check("personas");
      await page.getByRole("link", { name: "Unir a Beto con otra persona" }).click();
      await check("elegir");
      await page.getByLabel("Unir con").selectOption({ label: `${name} (con cuenta)` });
      await page.getByRole("button", { name: "Ver qué cambia" }).click();
      await check("confirmación");
    });
  });
}
