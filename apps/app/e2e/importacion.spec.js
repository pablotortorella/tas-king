import { expect, test } from "@playwright/test";
import { useScheme, lowContrast, openBook, openRecent, uniqueId } from "./helpers.js";
import { syntheticSplitwiseCsv } from "../test/fixtures/synthetic-splitwise.js";

const csvFile = (csv, name = "grupo.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });

async function startImport(page, book, csv) {
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(csvFile(csv));
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByRole("heading", { name: "Revisá el archivo" })).toBeVisible();
}
async function reviewAndConfirm(page) {
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByRole("heading", { name: "Así quedará el libro" })).toBeVisible();
  const ack = page.getByLabel("Revisé la diferencia o la falta de saldo fuente");
  if (await ack.count()) await ack.check();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
}
async function fullImport(page, book, csv) {
  await startImport(page, book, csv);
  await reviewAndConfirm(page);
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
}
const titles = page => page.locator(".entry-title");

test("recorrido completo: subir, revisar, confirmar, ver el avance y publicar", async ({ page }) => {
  const { book } = await openBook(page, "imp-flujo");
  const { csv } = syntheticSplitwiseCsv({ rows: 350, people: ["Ana Prueba", "Beto Prueba"] });
  await startImport(page, book, csv);
  await expect(page.getByText("350 movimientos válidos · 0 incidentes · 1 filas de resumen.")).toBeVisible();
  await reviewAndConfirm(page);
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".lead-count")).toContainText("350 movimientos importados");
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await expect(page.getByText("350 vigentes")).toBeVisible();
  await expect(page.locator(".entry-row .chip.imp").first()).toContainText("Importado de Splitwise · fila");
});

test("la pantalla de progreso muestra el avance y el libro no cambia hasta publicar", async ({ page }) => {
  const { book } = await openBook(page, "imp-progreso");
  const { csv } = syntheticSplitwiseCsv({ rows: 300 });
  await startImport(page, book, csv);
  // Se frena la carga después de la primera tanda para observar el estado intermedio.
  let served = 0;
  await page.route("**/ledger/import/batches/*/load", async route => {
    if (served >= 1) { await route.abort(); return; }
    served += 1;
    await route.continue();
  });
  await reviewAndConfirm(page);
  await expect(page.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
  await expect(page.locator("[data-progress-text]")).toContainText("Importando 100 de 300");
  await expect(page.locator("progress")).toHaveAttribute("value", "100");
  await page.goto(book);
  await expect(page.getByText("Todavía no hay movimientos.")).toBeVisible();
  await expect(page.locator(".entry-row")).toHaveCount(0);
  await page.goto(`${book}/ledger/export.csv`).catch(() => null);
});

test("al reabrir la importación a mitad de camino se reanuda desde lo cargado, sin duplicar", async ({ page }) => {
  const { book } = await openBook(page, "imp-reanudar");
  const { csv } = syntheticSplitwiseCsv({ rows: 250 });
  await startImport(page, book, csv);
  let served = 0;
  await page.route("**/ledger/import/batches/*/load", async route => {
    if (served >= 1) { await route.abort(); return; }
    served += 1;
    await route.continue();
  });
  await reviewAndConfirm(page);
  await expect(page.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
  const progressUrl = page.url();
  await page.unroute("**/ledger/import/batches/*/load");
  await page.goto(book);
  await page.goto(progressUrl);
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await expect(page.getByText("250 vigentes")).toBeVisible();
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("el botón «Continuar» carga una tanda por clic hasta publicar", async ({ page, browser }) => {
    // La preparación usa un contexto con JavaScript, frena la carga automática y deja el lote pendiente.
    const context = await browser.newContext({ javaScriptEnabled: true });
    const helper = await context.newPage();
    const { book } = await openBook(helper, "imp-sinjs");
    const { csv } = syntheticSplitwiseCsv({ rows: 230 });
    await startImport(helper, book, csv);
    await helper.route("**/ledger/import/batches/*/load", route => route.abort());
    await reviewAndConfirm(helper);
    await expect(helper.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
    const progressUrl = helper.url();
    await page.context().addCookies(await context.cookies());
    await context.close();
    await page.goto(progressUrl);
    await expect(page.locator("[data-progress-text]")).toContainText("Importando 0 de 230");
    for (let clicks = 0; clicks < 4; clicks += 1) {
      if (await page.getByRole("heading", { name: "Importación completada" }).count()) break;
      await page.getByRole("button", { name: "Continuar la importación" }).click();
    }
    await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible();
  });
});

test("los incidentes se paginan y las decisiones se conservan al pasar de página", async ({ page }) => {
  const { book } = await openBook(page, "imp-paginar");
  const rows = Array.from({ length: 60 }, (_, index) => `2026-02-${String(1 + (index % 27)).padStart(2, "0")},Sin moneda ${index},Otros,10.00,,5.00,-5.00`);
  const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Válida,Otros,10.00,COP,5.00,-5.00\n${rows.join("\n")}\n`;
  await startImport(page, book, csv);
  await expect(page.locator(".incident-row")).toHaveCount(25);
  await expect(page.getByText("Página 1 de 3")).toBeVisible();
  for (const select of await page.locator(".incident-row select").all()) await select.selectOption("exclude");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Página 2 de 3")).toBeVisible();
  for (const select of await page.locator(".incident-row select").all()) await select.selectOption("assume_default");
  await page.getByRole("button", { name: "Anterior" }).click();
  await expect(page.getByText("Página 1 de 3")).toBeVisible();
  await expect(page.locator(".incident-row select").first()).toHaveValue("exclude");
  await expect(page.getByText("50 de 60 resueltas")).toBeVisible();
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByText(/Faltan decisiones: 10/u)).toBeVisible();
  await page.goBack();
  await page.goto(page.url().replace(/\/review.*$/u, ""));
});

test("cancelar durante la carga descarta todo y el libro queda vacío", async ({ page }) => {
  const { book } = await openBook(page, "imp-cancelar");
  const { csv } = syntheticSplitwiseCsv({ rows: 250 });
  await startImport(page, book, csv);
  let served = 0;
  await page.route("**/ledger/import/batches/*/load", async route => {
    if (served >= 1) { await route.abort(); return; }
    served += 1;
    await route.continue();
  });
  await reviewAndConfirm(page);
  await expect(page.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
  await page.getByRole("button", { name: "Cancelar y descartar lo cargado" }).click();
  await expect(page.locator(".notice")).toContainText("Importación cancelada");
  await expect(page.getByText("Todavía no hay movimientos.")).toBeVisible();
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(csvFile(csv));
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByRole("heading", { name: "Revisá el archivo" })).toBeVisible();
});

test("un movimiento importado se corrige y se anula como cualquier otro, y la marca de inferido desaparece al corregir el pagador", async ({ page }) => {
  const { book } = await openBook(page, "imp-corregir");
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-03,Posada,Comida,80000.00,COP,40000.00,-40000.00\n2026-01-05,Forraje,Transporte,30000.00,COP,-15000.00,15000.00\nSaldo total,,,,COP,25000.00,-25000.00\n";
  await page.goto(`${book}/ledger/import`);
  await page.getByLabel("Archivo CSV").setInputFiles(csvFile(csv));
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await reviewAndConfirm(page);
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await expect(page.locator(".chip.warn", { hasText: "Pagador inferido" })).toHaveCount(2);
  await page.getByRole("link", { name: /Posada/ }).click();
  await expect(page.locator(".entry-origin")).toContainText("Importado de Splitwise · fila 2");
  await expect(page.locator(".inferred")).toContainText("se dedujeron");
  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await page.getByRole("group", { name: /¿Quién pagó\?/u }).getByLabel(/Beto/u).check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await openRecent(page, "Posada");
  await expect(page.locator(".inferred")).toHaveCount(0);
  await expect(page.getByText("Cambió: quién pagó o recibió")).toBeVisible();
  await page.getByRole("link", { name: "Anular" }).click();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await openRecent(page, "Posada");
  await expect(page.locator(".entry-amount")).toContainText("Anulado");
});

test("la búsqueda por pagador de un importado indica que el pagador fue inferido", async ({ page }) => {
  const { book } = await openBook(page, "imp-buscar");
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-03,Posada,Comida,80000.00,COP,40000.00,-40000.00\n";
  await fullImport(page, book, csv);
  await page.goto(book);
  await page.getByRole("searchbox").fill("Ana Prueba");
  await page.getByRole("searchbox").fill("Ana");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".chip.match")).toContainText("· inferido");
});

test.describe("punto de partida", () => {
  test("por defecto el grupo se crea en cero; elegir «Traer de Splitwise» lleva a importar; abandonar deja el libro vacío con la guía", async ({ page }) => {
    const suffix = uniqueId();
    await page.goto(`/api/local/session?as=punto-${suffix}%40example.test`);
    await expect(page.getByRole("radio", { name: "Empezar en cero" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Saldos anteriores/u })).toBeDisabled();
    await page.getByLabel("Nombre", { exact: true }).fill(`Punto ${suffix}`);
    await page.getByRole("radio", { name: "Traer de Splitwise" }).check();
    await page.getByRole("button", { name: "Crear espacio" }).click();
    await expect(page.getByRole("heading", { name: "Importar Splitwise" })).toBeVisible();
    await page.getByRole("link", { name: "Cancelar", exact: true }).click();
    await expect(page.getByText("Todavía no hay movimientos.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregá tu primer movimiento" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Traé tu historial" })).toBeVisible();
  });

  test("la guía del libro vacío desaparece con el primer movimiento", async ({ page }) => {
    const { book } = await openBook(page, "punto-guia");
    await page.goto(book);
    const cta = page.getByRole("link", { name: "Agregá tu primer movimiento" });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(56);
    await cta.click();
    await page.getByLabel("Descripción").fill("El primero");
    await page.getByLabel("Importe", { exact: true }).fill("10,00");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".recent-strip")).toContainText("El primero");
    await expect(page.getByRole("link", { name: "Agregá tu primer movimiento" })).toHaveCount(0);
    await page.goto(book);
    await expect(page.getByRole("link", { name: "Agregá tu primer movimiento" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Traé tu historial" })).toHaveCount(0);
  });
});

for (const scheme of ["light", "dark"]) {
  test.describe(`importación en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("la vista previa, la revisión y el progreso no desbordan, miden 44 px y tienen contraste", async ({ page }) => {
      const { book } = await openBook(page, "imp-movil");
      const csv = `Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n2026-01-01,Válida,Otros,10.00,COP,5.00,-5.00\n2026-01-02,Sin moneda,Otros,10.00,,5.00,-5.00\n`;
      const audit = async label => {
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
        const small = await page.$$eval("a.button, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select", nodes => nodes
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
          .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 40), height: node.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await startImport(page, book, csv);
      await audit("vista previa");
      await page.locator('[name="decision_3"]').selectOption("exclude");
      await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
      await expect(page.getByRole("heading", { name: "Así quedará el libro" })).toBeVisible();
      await audit("revisión");
      await page.route("**/ledger/import/batches/*/load", route => route.abort());
      await page.getByLabel("Revisé la diferencia o la falta de saldo fuente").check();
      await page.getByRole("button", { name: "Confirmar importación" }).click();
      await expect(page.locator("[data-progress-error]")).toContainText("Podés reintentar", { timeout: 30_000 });
      await audit("progreso");
    });
  });
}

test("sin errores de consola ni violaciones de CSP en todo el recorrido de importación", async ({ page }) => {
  const problems = [];
  page.on("console", message => { if (message.type() === "error" || /content security policy/iu.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", error => problems.push(error.message));
  const { book } = await openBook(page, "imp-csp");
  const { csv } = syntheticSplitwiseCsv({ rows: 120 });
  await fullImport(page, book, csv);
  await page.getByRole("link", { name: "Ver el libro" }).click();
  await page.locator(".entry-row a").first().click();
  expect(problems).toEqual([]);
});
