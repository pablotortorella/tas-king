import { expect, test } from "@playwright/test";
import { lowContrast, openBook } from "./helpers.js";
import { syntheticSplitwiseCsv } from "../test/fixtures/synthetic-splitwise.js";

// Recorridos «a mano» de la importación: archivos que una persona real sube por error, impaciencia, pestañas dobles y
// pantallas angostas. Complementan el recorrido feliz de importacion.spec.js.

const file = (content, name = "grupo.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.isBuffer(content) ? content : Buffer.from(content) });

async function upload(page, book, content, name) {
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(file(content, name));
  await page.getByRole("button", { name: "Previsualizar" }).click();
}
async function confirmFlow(page) {
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) await ack.check();
}
const entryCount = async (page, book) => {
  await page.goto(book);
  const meta = page.locator(".list-meta").first();
  if (!(await meta.count())) return 0;
  return Number(/(\d+) vigentes?/u.exec((await meta.textContent()) ?? "")?.[1] ?? 0);
};

test.describe("archivos que no son lo que se esperaba", () => {
  test("un archivo que no es un export de Splitwise explica el problema y no crea nada", async ({ page }) => {
    const { book } = await openBook(page, "rec-invalido");
    for (const [content, message] of [
      ["esto no es un csv\nni parecido", /encabezado no corresponde/u],
      ["Fecha,Importe,Descripción\n2026-01-01,10,Algo\n", /encabezado no corresponde/u],
      ["Fecha,Descripción,Categoría,Coste,Moneda,Ana\n2026-01-01,Algo,Otros,10.00,COP,10.00\n", /encabezado no corresponde/u],
    ]) {
      await upload(page, book, content);
      await expect(page.getByText(message)).toBeVisible();
    }
    expect(await entryCount(page, book)).toBe(0);
  });

  test("un archivo vacío y uno de más de 2 MiB se rechazan con el límite a la vista", async ({ page }) => {
    const { book } = await openBook(page, "rec-tamano");
    await upload(page, book, Buffer.alloc(0), "vacio.csv");
    await expect(page.getByText(/hasta 2 MiB/u)).toBeVisible();
    await upload(page, book, `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n${"x".repeat(2 * 1024 * 1024 + 10)}`);
    await expect(page.getByText(/hasta 2 MiB/u)).toBeVisible();
  });

  test("un archivo con solo filas problemáticas se puede excluir entero y avisa que no queda nada para importar", async ({ page }) => {
    const { book } = await openBook(page, "rec-todo-malo");
    await upload(page, book, "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Mal,Otros,10.00,COP,3.00,-2.00\n");
    await page.locator('[name="decision_2"]').selectOption("exclude");
    await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
    await expect(page.getByText(/No quedan movimientos para importar/u)).toBeVisible();
  });
});

test("un doble clic en «Confirmar importación» crea un solo lote y cada movimiento una sola vez", async ({ page }) => {
  const { book } = await openBook(page, "rec-doble");
  const { csv } = syntheticSplitwiseCsv({ rows: 180 });
  await upload(page, book, csv);
  await confirmFlow(page);
  await page.getByRole("button", { name: "Confirmar importación" }).dblclick();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  expect(await entryCount(page, book)).toBe(180);
});

test("recargar la pantalla de progreso a mitad de la carga termina con todo exactamente una vez", async ({ page }) => {
  const { book } = await openBook(page, "rec-recarga");
  const { csv } = syntheticSplitwiseCsv({ rows: 420 });
  await upload(page, book, csv);
  await confirmFlow(page);
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.locator("[data-progress-text]")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  expect(await entryCount(page, book)).toBe(420);
});

test("subir otra vez el mismo archivo no duplica: lleva al resumen del lote ya importado", async ({ page }) => {
  const { book } = await openBook(page, "rec-repetido");
  const { csv } = syntheticSplitwiseCsv({ rows: 60 });
  await upload(page, book, csv);
  await confirmFlow(page);
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  await upload(page, book, csv, "otra-vez.csv");
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible();
  expect(await entryCount(page, book)).toBe(60);
});

test("dos pestañas continuando la misma carga no duplican movimientos", async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const { book } = await openBook(first, "rec-dos-pestanas");
  const { csv } = syntheticSplitwiseCsv({ rows: 400 });
  await upload(first, book, csv);
  await confirmFlow(first);
  await first.getByRole("button", { name: "Confirmar importación" }).click();
  const second = await context.newPage();
  await second.goto(first.url());
  await Promise.all([first, second].map(tab => tab.getByRole("heading", { name: "Importación completada" }).waitFor({ timeout: 60_000 })));
  expect(await entryCount(first, book)).toBe(400);
  await context.close();
});

test("solo con el teclado se puede recorrer la importación de principio a fin", async ({ page }) => {
  const { book } = await openBook(page, "rec-teclado-imp");
  const { csv } = syntheticSplitwiseCsv({ rows: 40 });
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(file(csv));
  await page.getByRole("button", { name: "Previsualizar" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Revisá el archivo" })).toBeVisible();
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Así quedará el grupo" })).toBeVisible();
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) { await ack.focus(); await page.keyboard.press("Space"); }
  await page.getByRole("button", { name: "Confirmar importación" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
});

test("con una red lenta la carga sigue avanzando y termina", async ({ page }) => {
  const { book } = await openBook(page, "rec-lenta-imp");
  const { csv } = syntheticSplitwiseCsv({ rows: 220 });
  await upload(page, book, csv);
  await confirmFlow(page);
  await page.route("**/ledger/import/batches/*/load", async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.locator("[data-progress-text]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
});

test("en 320 px la vista previa, la revisión y el progreso no desbordan y se leen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { book } = await openBook(page, "rec-angosta-imp");
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Válida,Otros,10.00,COP,5.00,-5.00\n2026-01-02,Sin moneda,Otros,10.00,,5.00,-5.00\n";
  const audit = async label => {
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
    expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
  };
  await upload(page, book, csv);
  // Se espera la pantalla ya dibujada: medir en el instante de la navegación mira una página sin la hoja de estilos.
  await expect(page.getByRole("heading", { name: "Revisá el archivo" })).toBeVisible();
  await audit("vista previa");
  await page.locator('[name="decision_3"]').selectOption("exclude");
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByRole("heading", { name: "Así quedará el grupo" })).toBeVisible();
  await audit("revisión");
  await page.route("**/ledger/import/batches/*/load", route => route.abort());
  await page.getByLabel("Revisé la diferencia o la falta de saldo fuente").check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
  await audit("progreso");
});

test("ante un límite de escrituras (429) la carga espera lo que indica el servidor y sigue sola", async ({ page }) => {
  const { book } = await openBook(page, "rec-limite");
  const { csv } = syntheticSplitwiseCsv({ rows: 150 });
  await upload(page, book, csv);
  await confirmFlow(page);
  let blocked = 0;
  await page.route("**/ledger/import/batches/*/load", async route => {
    if (blocked < 2) {
      blocked += 1;
      await route.fulfill({ status: 429, headers: { "Retry-After": "1", "Content-Type": "application/json" }, body: JSON.stringify({ error: "Demasiadas solicitudes." }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.locator("[data-progress-text]")).toContainText("Pausa de 1 s");
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  expect(blocked).toBe(2);
  expect(await entryCount(page, book)).toBe(150);
});
