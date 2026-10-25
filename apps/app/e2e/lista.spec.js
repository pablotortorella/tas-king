import { expect, test } from "@playwright/test";
import { emulateScheme, lowContrast, openBook, openRecent, seedEntriesViaForm } from "./helpers.js";

const rows = page => page.locator(".entry-list .entry-title");
const listRows = page => page.locator("#movimientos .entry-list").last().locator(".entry-title");

async function bookWith(page, prefix, items) {
  const { book } = await openBook(page, prefix);
  await seedEntriesViaForm(page, book, items.map(item => (typeof item === "string" ? { description: item } : item)));
  await page.goto(book);
  return book;
}

test("guardar un movimiento nuevo vuelve a la lista con el mensaje y la franja «Recién agregado»", async ({ page }) => {
  const { book } = await openBook(page, "ls-nuevo");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Cena de hoy");
  await page.getByLabel("Importe", { exact: true }).fill("80,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/aviso=guardado&nuevo=entry_/u);
  await expect(page.locator(".notice")).toContainText("Movimiento guardado.");
  await expect(page.locator(".recent-strip h3")).toHaveText("Recién agregado");
  await expect(page.locator(".recent-strip")).toContainText("Cena de hoy");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Casa ls-nuevo");
});

test("un movimiento con fecha antigua aparece en la franja arriba y también en su lugar por fecha", async ({ page }) => {
  const book = await bookWith(page, "ls-antigua", [...Array.from({ length: 45 }, (_, index) => ({ description: `Reciente ${index}`, occurredAt: "2026-08-01" })), { description: "Muy viejo", occurredAt: "2020-02-02" }]);
  await expect(listRows(page)).toHaveCount(40);
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Recién cargado pero de 2019");
  await page.getByLabel("Fecha").fill("2019-03-03");
  await page.getByLabel("Importe", { exact: true }).fill("10,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Recién cargado pero de 2019");
  await expect(listRows(page).filter({ hasText: "Recién cargado pero de 2019" })).toHaveCount(0);
  await page.getByRole("link", { name: /Ver \d+ movimientos más/u }).click();
  await expect(page.locator("#movimientos .entry-list .entry-row", { hasText: "Recién cargado pero de 2019" }).last()).toBeVisible();
});

test("la franja desaparece al abrir la lista de nuevo y el detalle sigue disponible desde ella", async ({ page }) => {
  const { book } = await openBook(page, "ls-franja");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Con franja");
  await page.getByLabel("Importe", { exact: true }).fill("5,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toBeVisible();
  await page.goto(book);
  await expect(page.locator(".recent-strip")).toHaveCount(0);
  await expect(page.locator(".notice")).toHaveCount(0);
  await page.goto(`${book}?aviso=guardado&nuevo=entry_no_existe`);
  await expect(page.locator(".recent-strip")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("corregir y anular vuelven a la lista con su mensaje y la franja correspondiente", async ({ page }) => {
  const book = await bookWith(page, "ls-corregir", ["Para corregir"]);
  await page.getByRole("link", { name: /Para corregir/u }).click();
  await page.getByRole("link", { name: "Corregir" }).click();
  await page.getByLabel("Descripción").fill("Ya corregido");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(".notice")).toContainText("Movimiento corregido.");
  await expect(page.locator(".recent-strip h3")).toHaveText("Recién corregido");
  await expect(page.locator(".recent-strip")).toContainText("Ya corregido");
  await openRecent(page, "Ya corregido");
  await page.getByRole("link", { name: "Anular" }).click();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.locator(".recent-strip h3")).toHaveText("Recién anulado");
  await expect(page.locator(".recent-strip .entry-voided")).toHaveCount(1);
  await page.goto(book);
});

test("dos movimientos del mismo día: el último cargado aparece primero", async ({ page }) => {
  await bookWith(page, "ls-orden", ["Primero", "Segundo", "Tercero"]);
  await expect(rows(page)).toHaveText(["Tercero", "Segundo", "Primero"]);
});

test("buscar a una persona ofrece «Pagó X» y «Participa X» con su cantidad y filtra con dos personas", async ({ page }) => {
  const book = await bookWith(page, "ls-persona", ["Compra uno", "Compra dos", "Compra tres"]);
  await page.getByRole("searchbox").fill("Beto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator(".chip.match").first()).toContainText("Participa Beto");
  const filters = page.locator(".person-filters");
  await expect(filters.getByRole("link", { name: "Pagó Beto (0)" })).toBeVisible();
  await expect(filters.getByRole("link", { name: "Participa Beto (3)" })).toBeVisible();
  await filters.getByRole("link", { name: "Pagó Beto (0)" }).click();
  await expect(page.getByText("No hay coincidencias.")).toBeVisible();
  await page.getByRole("link", { name: "Quitar búsqueda y filtros" }).click();
  await expect(rows(page)).toHaveCount(3);
  expect(book).toBeTruthy();
});

test("el filtro «Participa X» se activa, se marca y se quita desde el mismo botón", async ({ page }) => {
  await bookWith(page, "ls-participa", ["Uno", "Dos"]);
  await page.getByRole("searchbox").fill("Beto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.locator(".person-filters").getByRole("link", { name: /^Participa Beto/u }).click();
  await expect(page).toHaveURL(/quien=participa%3A/u);
  await expect(page.locator(".person-filters [aria-current=true]")).toHaveCount(1);
  await page.locator(".person-filters [aria-current=true]").click();
  await expect(page).not.toHaveURL(/quien=/u);
});

test("el movimiento que pagó otra persona se encuentra con «Pagó X»", async ({ page }) => {
  const { book } = await openBook(page, "ls-pago");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Cena grande");
  await page.getByLabel("Importe", { exact: true }).fill("40,00");
  await page.getByRole("group", { name: /¿Quién pagó\?/u }).getByLabel(/Beto/u).check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toBeVisible();
  await seedEntriesViaForm(page, book, [{ description: "Lo pagó el titular" }]);
  await page.goto(book);
  await page.getByRole("searchbox").fill("Beto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("link", { name: "Pagó Beto (1)" })).toBeVisible();
  await page.getByRole("link", { name: "Pagó Beto (1)" }).click();
  await expect(listRows(page)).toHaveText(["Cena grande"]);
  await expect(page.locator(".chip.match")).toContainText("Pagó Beto");
});

for (const scheme of ["light", "dark"]) {
  test.describe(`lista en el teléfono, ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
    test.beforeEach(({ page }) => emulateScheme(page, scheme));

    test("la lista, los filtros y la franja no desbordan, los controles miden 44 px y el contraste cumple", async ({ page }) => {
      const book = await bookWith(page, "ls-movil", ["Compra uno", "Compra dos"]);
      const audit = async label => {
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
        const small = await page.$$eval("a.button, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, .person-filters a, .recent-strip a, .select-box", nodes => nodes
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
          .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 40), height: node.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await audit("lista");
      await page.getByRole("searchbox").fill("Beto");
      await page.getByRole("button", { name: "Buscar" }).click();
      await audit("búsqueda con filtros por persona");
      await page.goto(`${book}/ledger/new?type=expense`);
      await page.getByLabel("Descripción").fill("Para ver la franja");
      await page.getByLabel("Importe", { exact: true }).fill("5,00");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.locator(".recent-strip")).toBeVisible();
      await audit("franja «Recién agregado»");
    });
  });
}

test("sin errores de consola ni violaciones de CSP en la lista, la franja y los filtros", async ({ page }) => {
  const problems = [];
  page.on("console", message => { if (message.type() === "error" || /content security policy/iu.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", error => problems.push(error.message));
  const book = await bookWith(page, "ls-csp", ["Uno", "Dos"]);
  await page.getByRole("searchbox").fill("Beto");
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.locator(".person-filters a").first().click();
  await page.goto(`${book}?aviso=guardado&nuevo=entry_x`);
  expect(problems).toEqual([]);
});
