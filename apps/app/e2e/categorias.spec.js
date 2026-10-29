import { expect, test } from "@playwright/test";
import { useScheme, lowContrast, openRecent, addPerson, categoryCombo, chooseCategory } from "./helpers.js";

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

// Grupo con la persona titular y una persona sin cuenta, listo para cargar movimientos.
async function openBook(page) {
  const suffix = unique();
  await page.goto(`/api/local/session?as=cat-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa categorías ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  const book = new URL(page.url()).pathname;
  await addPerson(page, book, "Beto");
  return { book, suffix };
}

async function addExpense(page, book, description, { choose, type } = {}) {
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Importe", { exact: true }).fill("100,00");
  if (choose) await chooseCategory(page, choose);
  if (type) await categoryCombo(page).fill(type);
  await page.getByRole("button", { name: "Guardar" }).click();
  await openRecent(page, description);
}

const rows = page => page.locator(".entry-title");

test("el formulario ofrece las categorías agrupadas y el movimiento guardado la muestra en el detalle y en la lista", async ({ page }) => {
  const { book } = await openBook(page);
  await page.goto(`${book}/ledger/new?type=expense`);
  const select = page.getByLabel("Elegí una");
  await expect(select.locator("optgroup")).toHaveCount(9);
  await expect(select.locator("optgroup[label='Comidas y bebidas'] option", { hasText: "Restaurantes" })).toHaveCount(1);
  await expect(select.locator("option").first()).toHaveText("Sin categoría");
  await categoryCombo(page).click();
  await expect(page.getByRole("listbox", { name: "Categorías" }).locator(".cat-list-group")).toHaveCount(9);
  await addExpense(page, book, "Cena de prueba", { choose: "Restaurantes" });
  await expect(page.locator(".entry-category")).toContainText("Restaurantes");
  await expect(page.locator(".entry-category")).toContainText("Comidas y bebidas");
  await page.goto(book);
  await expect(page.locator(".entry-row", { hasText: "Cena de prueba" }).locator(".chip.cat")).toContainText("Restaurantes");
});

test("un movimiento sin categoría se muestra como «Sin categoría»", async ({ page }) => {
  const { book } = await openBook(page);
  await addExpense(page, book, "Sin elegir");
  await expect(page.locator(".entry-category")).toContainText("Sin categoría");
  await page.goto(book);
  await expect(page.locator(".entry-row", { hasText: "Sin elegir" }).locator(".chip.cat.none")).toHaveText("Sin categoría");
});

test("escribir una variante ofrece la existente y escribir un nombre nuevo avisa que se creará", async ({ page }) => {
  const { book } = await openBook(page);
  await page.goto(`${book}/ledger/new?type=expense`);
  const typed = categoryCombo(page);
  const hint = page.locator(".category-hint");
  await typed.fill("ALÍMENTOS ");
  await expect(hint).toContainText("Ya existe «Alimentos»");
  await expect(page.getByLabel("Elegí una")).toHaveValue(await page.getByLabel("Elegí una").locator("option", { hasText: /^Alimentos$/u }).getAttribute("value"));
  await typed.fill("Peluquería canina");
  await expect(hint).toContainText("Se va a crear «Peluquería canina»");
  await typed.fill("");
  await expect(hint).toHaveText("");
});

test("escribir parte del nombre filtra la lista sin scrollear y ofrece crear solo lo que no existe", async ({ page }) => {
  const { book } = await openBook(page);
  await page.goto(`${book}/ledger/new?type=expense`);
  const combo = categoryCombo(page);
  const options = page.getByRole("listbox", { name: "Categorías" }).getByRole("option");
  await combo.fill("restau");
  await expect(options.filter({ hasText: /^Restaurantes$/u })).toHaveCount(1);
  await expect(options.filter({ hasText: /^Alimentos$/u })).toHaveCount(0);
  await expect(options.filter({ hasText: /^Crear «restau»$/u })).toHaveCount(1);
  await combo.fill("Casa");
  await expect(options.filter({ hasText: /^Alquiler$/u })).toHaveCount(1);
  await expect(options.filter({ hasText: /^Restaurantes$/u })).toHaveCount(0);
  await combo.fill("restaurantes");
  await expect(options.filter({ hasText: /^Crear/u })).toHaveCount(0);
  await combo.fill("zzzz");
  await expect(options).toHaveText(["Crear «zzzz»"]);
  await combo.fill("");
  await expect(page.locator(".category-hint")).toHaveText("");
});

test("crear una categoría desde el selector la deja disponible y asignada", async ({ page }) => {
  const { book } = await openBook(page);
  await addExpense(page, book, "Corte de pelo", { type: "Peluquería" });
  await expect(page.locator(".entry-category")).toContainText("Peluquería");
  await page.goto(`${book}/ledger/new?type=expense`);
  await expect(page.getByLabel("Elegí una").locator("optgroup[label='Mis categorías'] option")).toHaveText(["Peluquería"]);
  await page.goto(`${book}/ledger/categories`);
  await expect(page.locator(".cat-row", { has: page.locator(".chip.cat", { hasText: /^Peluquería$/u }) }).locator(".count")).toHaveText("1 movimiento");
});

test("buscar y filtrar por categoría o por grupo, y quitar el filtro", async ({ page }) => {
  const { book } = await openBook(page);
  await addExpense(page, book, "Cena afuera", { choose: "Restaurantes" });
  await addExpense(page, book, "Pago de luz", { choose: "Electricidad" });
  await addExpense(page, book, "Mercadito", { choose: "Alimentos" });
  await addExpense(page, book, "Suelto");
  await page.goto(book);
  await expect(rows(page)).toHaveCount(4);

  await page.getByRole("searchbox").fill("restaurantes");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(rows(page)).toHaveText(["Cena afuera"]);
  await expect(page.locator(".chip.match")).toContainText("Categoría");

  await page.getByRole("link", { name: "Quitar búsqueda" }).click();
  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "Todo Comidas y bebidas" });
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Quitar filtro" })).toBeVisible();

  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "Sin categoría" });
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(rows(page)).toHaveText(["Suelto"]);

  await page.getByRole("link", { name: "Quitar filtro" }).click();
  await expect(rows(page)).toHaveCount(4);
});

test("el titular renombra, fusiona y archiva desde la pantalla y los movimientos siguen mostrándose", async ({ page }) => {
  const { book } = await openBook(page);
  await addExpense(page, book, "Mercadito", { choose: "Alimentos" });
  await page.goto(`${book}/ledger/categories`);

  const row = name => page.locator(".cat-row", { has: page.locator(".chip.cat", { hasText: new RegExp(`^${name}$`, "u") }) });
  await row("Alimentos").locator("summary").click();
  await row("Alimentos").getByLabel("Nombre").fill("Supermercado");
  await row("Alimentos").getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".notice")).toContainText("Categoría guardada");
  await expect(row("Supermercado")).toHaveCount(1);
  await expect(row("Supermercado").locator(".count")).toHaveText("1 movimiento");

  await row("Supermercado").locator("summary").click();
  await row("Supermercado").getByLabel("Fusionar en").selectOption({ label: "Comidas y bebidas · Restaurantes" });
  await row("Supermercado").getByRole("button", { name: "Fusionar" }).click();
  await expect(page.locator(".notice")).toContainText("fusionadas");
  await expect(page.getByText("Fusionada en «Restaurantes»")).toBeVisible();
  await page.goto(book);
  await expect(page.locator(".entry-row", { hasText: "Mercadito" }).locator(".chip.cat")).toContainText("Restaurantes");

  await page.goto(`${book}/ledger/categories`);
  await row("Taxi").locator("summary").click();
  await row("Taxi").getByRole("button", { name: "Archivar" }).click();
  await expect(page.locator(".notice")).toContainText("archivada");
  await page.goto(`${book}/ledger/new?type=expense`);
  await expect(page.getByLabel("Elegí una").locator("option", { hasText: /^Taxi$/u })).toHaveCount(0);
  await categoryCombo(page).fill("Taxi");
  await expect(page.getByRole("option", { name: "Taxi", exact: true })).toHaveCount(0);
});

test("renombrar a un nombre que ya existe muestra el motivo y no cambia nada", async ({ page }) => {
  const { book } = await openBook(page);
  await page.goto(`${book}/ledger/categories`);
  const row = page.locator(".cat-row", { has: page.locator(".chip.cat", { hasText: /^Alimentos$/u }) });
  await row.locator("summary").click();
  await row.getByLabel("Nombre").fill("restaurantes");
  await row.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Ya existe/u)).toBeVisible();
  await page.goto(`${book}/ledger/categories`);
  await expect(page.locator(".chip.cat", { hasText: /^Alimentos$/u })).toHaveCount(1);
});

test("corregir un movimiento reabre la categoría elegida y cambiarla queda en el historial", async ({ page }) => {
  const { book } = await openBook(page);
  await addExpense(page, book, "Para corregir", { choose: "Taxi" });
  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await expect(categoryCombo(page)).toHaveValue("Taxi");
  await chooseCategory(page, "Hotel");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await openRecent(page, "Para corregir");
  await expect(page.locator(".entry-category")).toContainText("Hotel");
  await expect(page.getByText("Cambió: categoría")).toBeVisible();
});

for (const scheme of ["light", "dark"]) {
  test.describe(`categorías en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("el selector y la gestión no desbordan, los controles miden 44 px y el contraste alcanza", async ({ page }) => {
      const { book } = await openBook(page);
      await addExpense(page, book, "Con categoría", { choose: "Restaurantes" });
      for (const path of [`${book}/ledger/new?type=expense`, `${book}/ledger/categories`, book]) {
        await page.goto(path);
        if (path.endsWith("/categories")) await page.locator(".cat-row summary").first().click();
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${path}`).toBeLessThanOrEqual(sizes.viewport);
        const small = await page.$$eval("a.button, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, summary", nodes => nodes
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
          .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 40), height: node.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${path}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${path}`).toEqual([]);
      }
    });
  });
}

test("el selector y la gestión no producen errores de consola ni violaciones de CSP", async ({ page }) => {
  const problems = [];
  page.on("console", message => { if (message.type() === "error" || /content security policy/iu.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", error => problems.push(error.message));
  const { book } = await openBook(page);
  await page.goto(`${book}/ledger/new?type=expense`);
  await categoryCombo(page).fill("algo");
  await page.goto(`${book}/ledger/categories`);
  await page.locator(".cat-row summary").first().click();
  await page.goto(`${book}?categoria=none`);
  expect(problems).toEqual([]);
});

test("el /text.js que sirve el Worker real normaliza igual que la función del servidor", async ({ page }) => {
  await page.goto("/healthz");
  const { searchable } = await import("../src/text.js");
  const samples = ["Álimentos", "Casa - Otro", "  Café  y  Panadería ", "TV/teléfono/Internet", "Ñandú", ""];
  const fromWorker = await page.evaluate(async list => {
    const module = await import("/text.js");
    return list.map(sample => module.searchable(sample));
  }, samples);
  expect(fromWorker).toEqual(samples.map(searchable));
});
