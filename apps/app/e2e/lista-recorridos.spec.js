import { expect, test } from "@playwright/test";
import { lowContrast, openBook, seedEntriesViaForm } from "./helpers.js";
import { syntheticSplitwiseCsv } from "../test/fixtures/synthetic-splitwise.js";

// Recorridos «a mano» de la lista y la búsqueda: consultas raras, teclado solo, toque, pestañas dobles, pantallas angostas
// y un libro del tamaño de un export real.

const listRows = page => page.locator("#movimientos .entry-list").last().locator(".entry-title");

async function bookWith(page, prefix, items) {
  const { book } = await openBook(page, prefix);
  await seedEntriesViaForm(page, book, items.map(item => (typeof item === "string" ? { description: item } : item)));
  await page.goto(book);
  return book;
}
async function search(page, text) {
  await page.getByRole("searchbox").fill(text);
  await page.getByRole("button", { name: "Buscar" }).click();
}

test("consultas raras se buscan como texto y nunca rompen la página ni ejecutan nada", async ({ page }) => {
  const book = await bookWith(page, "lr-raras", ["Pizza 🍕 viernes", "Gás natural 1.000,50", "Ñandú y Güira", "Mercado (norte) 50%"]);
  const dialogs = [];
  page.on("dialog", dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });
  const queries = ["🍕", "' OR 1=1 --", "<script>alert(1)</script>", "<img src=x onerror=alert(2)>", "%", "\\", ".*(", "[a-z]+", "a".repeat(500), "1.000,50", " 1 000 ", "—", "ñandu", "(norte)", "50%", "gás", "𝔘𝔫𝔦𝔠𝔬𝔡𝔢"];
  for (const query of queries) {
    const response = await page.goto(`${book}?q=${encodeURIComponent(query)}`);
    expect(response.status(), `estado con «${query.slice(0, 20)}»`).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("img[src='x']").count()).toBe(0);
    expect(await page.getByRole("searchbox").inputValue()).toBe(query);
  }
  expect(dialogs).toEqual([]);
  // Un texto sin letras ni números (solo emoji) no tiene nada que buscar: la lista se muestra completa.
  await page.goto(`${book}?q=${encodeURIComponent("🍕")}`);
  await expect(listRows(page)).toHaveCount(4);
  await page.goto(`${book}?q=${encodeURIComponent("pizza")}`);
  await expect(listRows(page)).toHaveText(["Pizza 🍕 viernes"]);
  await page.goto(`${book}?q=${encodeURIComponent("1.000,50")}`);
  await expect(listRows(page)).toHaveText(["Gás natural 1.000,50"]);
});

test("parámetros de filtro inválidos o hostiles se ignoran sin error", async ({ page }) => {
  const book = await bookWith(page, "lr-hostiles", ["Uno", "Dos"]);
  for (const suffix of ["quien=%3Cscript%3E", "quien=otro:xx", "quien=pago:", "categoria=g:no-existe", "categoria=%27%3B--", "mostrar=-5", "mostrar=999999", "mostrar=abc", "nuevo=%3Cb%3E", "aviso=%3Cb%3Ehola%3C/b%3E"]) {
    const response = await page.goto(`${book}?${suffix}`);
    expect(response.status(), suffix).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("b", { hasText: "hola" }).count(), suffix).toBe(0);
  }
});

test("solo con el teclado: buscar, filtrar por persona y quitar el filtro", async ({ page }) => {
  await bookWith(page, "lr-teclado", ["Uno", "Dos"]);
  await page.getByRole("searchbox").focus();
  await page.keyboard.type("Beto");
  await page.keyboard.press("Enter");
  await expect(page.locator(".person-filters")).toBeVisible();
  await page.locator(".person-filters a").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/quien=pago/u);
  await expect(page.getByText("No hay coincidencias.")).toBeVisible();
  await page.getByRole("link", { name: "Quitar búsqueda y filtros" }).focus();
  await page.keyboard.press("Enter");
  await expect(listRows(page)).toHaveCount(2);
});

test.describe("con una pantalla táctil", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("se busca y se filtra tocando", async ({ page }) => {
    await bookWith(page, "lr-toque", ["Uno", "Dos"]);
    await page.getByRole("searchbox").tap();
    await page.getByRole("searchbox").fill("Beto");
    await page.getByRole("button", { name: "Buscar" }).tap();
    await page.locator(".person-filters a", { hasText: /^Participa/u }).tap();
    await expect(listRows(page)).toHaveCount(2);
    await page.locator(".person-filters [aria-current=true]").tap();
    await expect(page).not.toHaveURL(/quien=/u);
  });
});

test("un doble clic en Guardar deja un solo movimiento y una sola franja", async ({ page }) => {
  const { book } = await openBook(page, "lr-doble");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Doble");
  await page.getByLabel("Importe", { exact: true }).fill("9,00");
  await page.getByRole("button", { name: "Guardar" }).dblclick();
  await expect(page.locator(".recent-strip")).toHaveCount(1);
  await page.goto(book);
  await expect(listRows(page)).toHaveText(["Doble"]);
});

test("recargar la lista conserva la franja y volver atrás no rompe nada", async ({ page }) => {
  const { book } = await openBook(page, "lr-atras");
  await page.goto(`${book}/ledger/new?type=expense`);
  await page.getByLabel("Descripción").fill("Atrás");
  await page.getByLabel("Importe", { exact: true }).fill("9,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Atrás");
  await page.reload();
  await expect(page.locator(".recent-strip")).toContainText("Atrás");
  await page.goBack();
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
  await page.goto(book);
  await expect(listRows(page)).toHaveText(["Atrás"]);
});

test("dos pestañas: lo que carga una aparece primero al recargar la otra", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const book = await bookWith(first, "lr-pestanas", ["Viejo"]);
  const second = await context.newPage();
  await second.goto(book);
  await seedEntriesViaForm(first, book, [{ description: "Nuevo desde la otra pestaña" }]);
  await second.reload();
  await expect(listRows(second).first()).toHaveText("Nuevo desde la otra pestaña");
  await context.close();
});

test("en 320 px la lista, los filtros y la franja no desbordan y se leen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { book } = await openBook(page, "lr-angosta");
  await seedEntriesViaForm(page, book, [{ description: "Una descripción larguísima sin cortes para probar el ajuste de línea en pantallas angostas de teléfono" }]);
  await page.goto(`${book}?aviso=guardado&nuevo=${(await page.evaluate(async path => { const html = await (await fetch(path)).text(); return /ledger\/entries\/(entry_[^"]+)"/u.exec(html)[1]; }, book))}`);
  const audit = async label => {
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
    expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
  };
  await audit("franja");
  await search(page, "Beto");
  await audit("filtros por persona");
});

test("con un libro del tamaño de un export real la búsqueda, los filtros y «Ver más» responden bien", async ({ page }) => {
  test.setTimeout(240_000);
  const { book } = await openBook(page, "lr-escala");
  const { csv } = syntheticSplitwiseCsv({ rows: 2485 });
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "grande.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 120_000 });
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await expect(page.getByText("2485 vigentes").or(page.getByText("2.485 vigentes"))).toBeVisible();
  const started = Date.now();
  await search(page, "Movimiento 12");
  await expect(page.locator(".list-meta")).toContainText("de 2485");
  const elapsed = Date.now() - started;
  console.log(`LISTA-ESCALA búsqueda con 2.485 movimientos: ${elapsed} ms (extremo a extremo)`);
  expect(elapsed).toBeLessThan(5000);
  await page.getByRole("link", { name: /Ver \d+ movimientos más/u }).click();
  await expect(listRows(page)).toHaveCount(80);
  await expect(page.locator(".person-filters")).toHaveCount(0);
  await search(page, "Ana");
  await expect(page.locator(".person-filters")).toBeVisible();
  await page.locator(".person-filters a", { hasText: /^Pagó/u }).first().click();
  await expect(page).toHaveURL(/quien=pago/u);
  await expect(listRows(page)).toHaveCount(40);
});

test("un movimiento anulado que coincide aparece tachado y rotulado", async ({ page }) => {
  const { book } = await openBook(page, "lr-anulado");
  await seedEntriesViaForm(page, book, [{ description: "Gas para anular" }]);
  await page.goto(book);
  await page.getByRole("link", { name: /Gas para anular/u }).click();
  await page.getByRole("link", { name: "Anular" }).click();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await search(page, "gas");
  await expect(page.locator("#movimientos .entry-voided")).toHaveCount(1);
  await expect(page.locator("#movimientos .entry-voided .chip.void")).toContainText("Anulado");
  await expect(page.locator("#movimientos .entry-voided .chip.match")).toContainText("Descripción");
});
