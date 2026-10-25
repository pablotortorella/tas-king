import { expect, test } from "@playwright/test";
import { useScheme, lowContrast, openBook, seedEntriesViaForm } from "./helpers.js";

const rows = page => page.locator(".entry-title");
const chipOf = (page, description) => page.locator(".entry-row", { hasText: description }).locator(".chip.cat");

async function bookWith(page, prefix, descriptions) {
  const { book } = await openBook(page, prefix);
  await seedEntriesViaForm(page, book, descriptions.map(description => (typeof description === "string" ? { description } : description)));
  await page.goto(book);
  return book;
}
async function searchFor(page, text) {
  await page.getByRole("searchbox").fill(text);
  await page.getByRole("button", { name: "Buscar" }).click();
}
async function reviewChange(page, categoryLabel) {
  await page.getByLabel("Nueva categoría").selectOption({ label: categoryLabel });
  await page.getByRole("button", { name: "Revisar el cambio" }).click();
  await expect(page.getByRole("heading", { name: "Cambiar categoría" })).toBeVisible();
}

test("buscar, seleccionar todos los resultados, revisar, confirmar y deshacer", async ({ page }) => {
  const book = await bookWith(page, "rc-flujo", [...Array.from({ length: 12 }, (_, index) => `Carulla ${index}`), "Otra cosa"]);
  await searchFor(page, "carulla");
  await expect(rows(page)).toHaveCount(12);
  await page.getByLabel(/Todos los 12 resultados/u).check();
  await reviewChange(page, "Alimentos");
  await expect(page.locator(".lead-count")).toContainText("Cambiarán 12 movimientos");
  await expect(page.locator(".ledger-section li").first()).toContainText("ahora: Sin categoría");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(page.locator(".notice")).toContainText("Se cambió la categoría de 12 movimientos");
  await expect(page.locator(".notice")).toContainText("«Alimentos»");
  await expect(chipOf(page, "Carulla 3")).toHaveText("Alimentos");
  await expect(chipOf(page, "Otra cosa")).toHaveText("Sin categoría");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.locator(".notice")).toContainText("Se deshizo la operación: 12 movimientos volvieron");
  await expect(chipOf(page, "Carulla 3")).toHaveText("Sin categoría");
  await page.goto(book);
});

test("con casillas marcadas se cambian solo esos movimientos", async ({ page }) => {
  await bookWith(page, "rc-casillas", ["Uno", "Dos", "Tres", "Cuatro"]);
  await page.getByRole("checkbox", { name: "Seleccionar Uno" }).check();
  await page.getByRole("checkbox", { name: "Seleccionar Tres" }).check();
  await reviewChange(page, "Taxi");
  await expect(page.locator(".lead-count")).toContainText("Cambiarán 2 movimientos");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(chipOf(page, "Uno")).toHaveText("Taxi");
  await expect(chipOf(page, "Tres")).toHaveText("Taxi");
  await expect(chipOf(page, "Dos")).toHaveText("Sin categoría");
});

test("«todos los resultados» incluye los que «Ver más» todavía no muestra", async ({ page }) => {
  await bookWith(page, "rc-vermas", Array.from({ length: 60 }, (_, index) => `Mercado ${index}`));
  await expect(rows(page)).toHaveCount(40);
  await page.getByLabel(/Todos los 60 resultados/u).check();
  await reviewChange(page, "Alimentos");
  await expect(page.locator(".lead-count")).toContainText("Cambiarán 60 movimientos");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await expect(page.locator(".notice")).toContainText("60 movimientos");
});

test("cancelar en la pantalla de confirmación no cambia nada", async ({ page }) => {
  const book = await bookWith(page, "rc-cancelar", ["Uno", "Dos"]);
  await page.getByRole("checkbox", { name: "Seleccionar Uno" }).check();
  await reviewChange(page, "Taxi");
  await page.getByRole("link", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(new RegExp(`${book}$`, "u"));
  await expect(chipOf(page, "Uno")).toHaveText("Sin categoría");
});

test("revisar sin elegir categoría o sin seleccionar explica el motivo", async ({ page }) => {
  await bookWith(page, "rc-vacio", ["Uno"]);
  await page.getByRole("checkbox", { name: "Seleccionar Uno" }).check();
  await page.getByLabel("Nueva categoría").evaluate(select => select.removeAttribute("required"));
  await page.getByRole("button", { name: "Revisar el cambio" }).click();
  await expect(page.getByText("Elegí la categoría")).toBeVisible();
});

test("el historial del movimiento muestra la revisión de la recategorización", async ({ page }) => {
  await bookWith(page, "rc-historial", ["Para el historial"]);
  await page.getByRole("checkbox", { name: "Seleccionar Para el historial" }).check();
  await reviewChange(page, "Hotel");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await page.getByRole("link", { name: /Para el historial/u }).click();
  await expect(page.getByText("Cambió: categoría · recategorización en lote")).toBeVisible();
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("la selección, la confirmación y el deshacer funcionan con formularios comunes", async ({ page, browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: true });
    const helper = await context.newPage();
    const { book } = await openBook(helper, "rc-sinjs");
    await seedEntriesViaForm(helper, book, [{ description: "Uno" }, { description: "Dos" }]);
    await page.context().addCookies(await context.cookies());
    await context.close();
    await page.goto(book);
    await page.getByRole("checkbox", { name: "Seleccionar Uno" }).check();
    await page.getByLabel("Nueva categoría").selectOption({ label: "Taxi" });
    await page.getByRole("button", { name: "Revisar el cambio" }).click();
    await page.getByRole("button", { name: "Confirmar el cambio" }).click();
    await expect(chipOf(page, "Uno")).toHaveText("Taxi");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(chipOf(page, "Uno")).toHaveText("Sin categoría");
  });
});

test.describe("clasificar rápido", () => {
  test("asignar baja el contador y muestra el siguiente; saltar y deshacer lo último", async ({ page }) => {
    const book = await bookWith(page, "rc-rapido", [{ description: "Tercero", occurredAt: "2026-06-01" }, { description: "Segundo", occurredAt: "2026-06-10" }, { description: "Primero", occurredAt: "2026-06-20" }]);
    await page.getByRole("link", { name: /Clasificar rápido · 3/u }).click();
    await expect(page.getByRole("heading", { name: "Primero", level: 2 })).toBeVisible();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 3 movimientos pendientes");
    await page.getByLabel("Otra categoría").selectOption({ label: "Taxi" });
    await page.getByRole("button", { name: "Asignar" }).click();
    await expect(page.getByRole("heading", { name: "Segundo", level: 2 })).toBeVisible();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 2 movimientos pendientes");
    await page.locator("[data-skip]").click();
    await expect(page.getByRole("heading", { name: "Tercero", level: 2 })).toBeVisible();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 2 movimientos pendientes");
    await page.getByRole("button", { name: /Deshacer la última/u }).click();
    await expect(page.getByRole("heading", { name: "Primero", level: 2 })).toBeVisible();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 3 movimientos pendientes");
    await page.goto(book);
    await expect(chipOf(page, "Primero")).toHaveText("Sin categoría");
  });

  test("ofrece la sugerida con su causa y la aplica solo si se acepta; al terminar avisa que no quedan pendientes", async ({ page }) => {
    const { book } = await openBook(page, "rc-sugerida");
    await page.goto(`${book}/ledger/categories`);
    await seedEntriesViaForm(page, book, [{ description: "Veterinaria Patitas 1" }, { description: "Veterinaria Patitas 2" }, { description: "Veterinaria Patitas 3" }]);
    await page.goto(`${book}/ledger/classify`);
    await page.getByLabel("Otra categoría").selectOption({ label: "Mascotas" });
    await page.getByRole("button", { name: "Asignar" }).click();
    await page.getByLabel("Otra categoría").selectOption({ label: "Mascotas" });
    await page.getByRole("button", { name: "Asignar" }).click();
    await seedEntriesViaForm(page, book, [{ description: "Veterinaria Patitas control", occurredAt: "2026-12-01" }]);
    await page.goto(`${book}/ledger/classify`);
    await expect(page.locator(".suggestion")).toContainText("Mascotas");
    await expect(page.locator(".suggestion")).toContainText("aparece en 2 movimientos de Mascotas");
    await page.goto(book);
    await expect(chipOf(page, "Veterinaria Patitas control")).toHaveText("Sin categoría");
    await page.goto(`${book}/ledger/classify`);
    await page.getByRole("button", { name: /Aceptar la sugerida/u }).click();
    await expect(page.locator("[data-remaining]")).toContainText("Quedan 1 movimiento pendiente");
    await page.getByLabel("Otra categoría").selectOption({ label: "Mascotas" });
    await page.getByRole("button", { name: "Asignar" }).click();
    await expect(page.getByText("No quedan movimientos pendientes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al libro" }).last()).toBeVisible();
  });

  test("solo con el teclado: números, Enter, S y U", async ({ page }) => {
    const { book } = await openBook(page, "rc-teclado");
    await seedEntriesViaForm(page, book, [{ description: "Veterinaria Patitas 1", categoryId: "" }, { description: "Veterinaria Patitas 2" }, { description: "Veterinaria Patitas 3" }, { description: "Uno", occurredAt: "2026-06-05" }, { description: "Dos", occurredAt: "2026-06-04" }, { description: "Tres", occurredAt: "2026-06-03" }, { description: "Cuatro", occurredAt: "2026-06-02" }]);
    await page.goto(`${book}/ledger/classify`);
    // Se arman «recientes» asignando con el selector una primera vez.
    await page.getByLabel("Otra categoría").selectOption({ label: "Taxi" });
    await page.getByRole("button", { name: "Asignar" }).click();
    await expect(page.locator("[data-key='1']")).toContainText("Taxi");
    const titleNow = async () => page.getByRole("heading", { level: 2 }).first().textContent();
    const first = await titleNow();
    await page.keyboard.press("1");
    await expect(page.locator("[data-remaining]")).not.toContainText("Quedan 7 ");
    const second = await titleNow();
    expect(second).not.toBe(first);
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/saltar=/u);
    expect(await titleNow()).not.toBe(second);
    await page.keyboard.press("u");
    await expect(page.locator("[data-remaining]")).toContainText("Quedan");
    await page.keyboard.press("1");
    await expect(page.locator("[data-remaining]")).toBeVisible();
  });

  test("los atajos no actúan mientras se escribe o se elige en el selector", async ({ page }) => {
    const { book } = await openBook(page, "rc-escribir");
    await seedEntriesViaForm(page, book, [{ description: "Uno" }]);
    await page.goto(`${book}/ledger/classify`);
    await page.getByLabel("Otra categoría").focus();
    await page.keyboard.press("s");
    await expect(page).not.toHaveURL(/saltar=/u);
    await expect(page.getByRole("heading", { name: "Uno", level: 2 })).toBeVisible();
  });
});

for (const scheme of ["light", "dark"]) {
  test.describe(`recategorización en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 390, height: 844 });

    test("la lista con selección, la confirmación y clasificar rápido no desbordan, miden 44 px y tienen contraste", async ({ page }) => {
      const book = await bookWith(page, "rc-movil", ["Compra uno", "Compra dos", "Compra tres"]);
      const audit = async label => {
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${label}`).toBeLessThanOrEqual(sizes.viewport);
        const small = await page.$$eval("a.button, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, .select-box, .chip-button", nodes => nodes
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
          .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 40), height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await audit("lista con selección");
      await page.getByRole("checkbox", { name: "Seleccionar Compra uno" }).check();
      await reviewChange(page, "Taxi");
      await audit("confirmación");
      await page.getByRole("button", { name: "Confirmar el cambio" }).click();
      await expect(page.locator(".notice")).toBeVisible();
      await audit("aviso con deshacer");
      await page.goto(`${book}/ledger/classify`);
      await audit("clasificar rápido");
    });
  });
}

test("sin errores de consola ni violaciones de CSP en la selección y en clasificar rápido", async ({ page }) => {
  const problems = [];
  page.on("console", message => { if (message.type() === "error" || /content security policy/iu.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", error => problems.push(error.message));
  const book = await bookWith(page, "rc-csp", ["Uno", "Dos"]);
  await page.getByRole("checkbox", { name: "Seleccionar Uno" }).check();
  await reviewChange(page, "Taxi");
  await page.getByRole("button", { name: "Confirmar el cambio" }).click();
  await page.goto(`${book}/ledger/classify`);
  await page.keyboard.press("s");
  expect(problems).toEqual([]);
});
