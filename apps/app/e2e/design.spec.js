import { expect, test } from "@playwright/test";

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const TAP_TARGETS = [
  "a.button", "button", ".tabbar a", ".quick-actions a", ".export-actions a", ".type-tabs a", ".choice span", ".back-link",
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio])", "select", "textarea",
].join(",");

// Crea un grupo con una persona sin cuenta y un gasto, y devuelve las rutas para recorrer.
async function seededBook(page) {
  const suffix = unique();
  await page.goto(`/api/local/session?as=diseno-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa diseño ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  const book = new URL(page.url()).pathname;
  await page.getByLabel("Participante sin cuenta").fill("Beto");
  await page.getByRole("button", { name: "Agregar participante" }).click();
  await page.getByRole("link", { name: "Gasto", exact: true }).click();
  await page.getByLabel("Descripción").fill("Supermercado");
  await page.getByLabel("Importe", { exact: true }).fill("100,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Supermercado" })).toBeVisible();
  const detail = new URL(page.url()).pathname;
  return { suffix, book, detail, pages: [book, `${book}/ledger/new`, `${book}/ledger/new?type=transfer`, detail, `${detail}/void`, `${book}/ledger/import`, "/spaces/new", "/cuentas-claras", "/invitations"] };
}

test("ninguna página pide recursos ni estilos que la CSP bloquee", async ({ page }) => {
  const problems = [];
  page.on("console", message => { if (message.type() === "error" || /content security policy/iu.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", error => problems.push(error.message));
  const { pages } = await seededBook(page);
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(problems).toEqual([]);
});

for (const scheme of ["light", "dark"]) {
  test.describe(`esquema ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test("aplica la paleta del dispositivo", async ({ page }) => {
      await page.goto("/");
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(background).toBe(scheme === "dark" ? "rgb(18, 28, 23)" : "rgb(247, 242, 232)");
    });

    test("en 390 px no desborda y todos los controles miden al menos 44 px", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { pages } = await seededBook(page);
      for (const path of pages) {
        await page.goto(path);
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content, `desborde en ${path}`).toBeLessThanOrEqual(sizes.viewport);
        const small = await page.$$eval(TAP_TARGETS, nodes => nodes
          .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
          .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 40), height: node.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${path}`).toEqual([]);
      }
    });
  });
}

test("en escritorio el libro usa dos paneles y en el teléfono se apilan con barra inferior", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { book } = await seededBook(page);
  await page.goto(book);
  const side = await page.locator("#saldos").boundingBox();
  const main = await page.locator("#movimientos").boundingBox();
  expect(main.x).toBeGreaterThan(side.x + side.width - 1);
  expect(Math.abs(main.y - side.y)).toBeLessThan(80);
  await expect(page.locator(".tabbar")).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(book);
  await expect(page.locator(".tabbar")).toBeVisible();
  const stackedSide = await page.locator("#saldos").boundingBox();
  const stackedMain = await page.locator("#movimientos").boundingBox();
  expect(stackedMain.y).toBeGreaterThan(stackedSide.y + stackedSide.height - 1);
  await expect(page.getByRole("link", { name: "Agregar movimiento" }).first()).toBeVisible();
});

test("el libro muestra saldo propio, efecto propio y suma cero", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(book);
  await expect(page.getByText("Tu saldo · COP")).toBeVisible();
  await expect(page.getByText("Te corresponde recibir.")).toBeVisible();
  await expect(page.getByText("Tu efecto +COP 50,00")).toBeVisible();
  await expect(page.getByText("✓ Suman 0")).toBeVisible();
  await expect(page.getByText("Le deben COP 50,00")).toBeVisible();
});

test("el formulario cambia de tipo, muestra importes exactos al elegirlos y se maneja con teclado", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(`${book}/ledger/new`);
  await expect(page.getByRole("link", { name: "Gasto", exact: true }).first()).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".shares")).toBeHidden();
  await page.getByLabel("Importes exactos").check();
  await expect(page.locator(".shares")).toBeVisible();
  await page.getByRole("link", { name: "Transferencia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agregar transferencia" })).toBeVisible();
  await expect(page.getByText("No es un gasto.")).toBeVisible();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe("none");
});

test("el detalle muestra el reparto con suma, línea de tiempo y la anulación sigue visible", async ({ page }) => {
  const { detail } = await seededBook(page);
  await page.goto(detail);
  await expect(page.getByRole("heading", { name: "Cómo se repartió" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Suma" })).toBeVisible();
  await expect(page.getByText("Reparto igual entre 2 personas.")).toBeVisible();
  await expect(page.locator(".timeline")).toContainText("Revisión 1");
  await expect(page.getByText("Vigente · revisión 1")).toBeVisible();
});

test("la vista previa del movimiento muestra el efecto antes de guardar y avisa de importes ambiguos", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(`${book}/ledger/new`);
  const preview = page.locator(".effect-preview");
  await expect(preview).toBeHidden();
  await page.getByLabel("Importe", { exact: true }).fill("286.400");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("No entendemos ese importe");
  await page.getByLabel("Importe", { exact: true }).fill("101,01");
  await expect(preview).toContainText("Se guardará como COP 101,01.");
  // El residuo va a quien aparece primero en la lista (orden por creación y luego por id): el signo se mantiene.
  await expect(preview).toContainText(/\+COP 50,5[01]/u);
  await expect(preview).toContainText(/−COP 50,5[01]/u);
  await expect(preview).toContainText("Sobran 1 centavos");
  await page.getByLabel("Importes exactos").check();
  await expect(preview).toContainText("Falta el importe");
});

test("la tabla de reparto del detalle cabe en 390 px sin scroll interno", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { detail } = await seededBook(page);
  await page.goto(detail);
  const overflow = await page.$$eval(".table-scroll", nodes => nodes.map(node => node.scrollWidth - node.clientWidth));
  expect(overflow.every(value => value <= 0)).toBe(true);
});

test("un error del servidor al guardar se muestra en el formulario y permite reintentar", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(`${book}/ledger/new`);
  await page.getByLabel("Descripción").fill("Sin importe válido");
  await page.getByLabel("Importe", { exact: true }).fill("10,00");
  await page.route("**/ledger/entries", route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Este movimiento cambió. Recargá antes de guardar." }) }));
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".form-feedback.error")).toContainText("Este movimiento cambió");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
});

test("las acciones confirman con un aviso y la URL no puede inyectar texto", async ({ page }) => {
  const { book, detail } = await seededBook(page);
  await page.goto(book);
  await page.getByLabel("Participante sin cuenta").fill("Carla");
  await page.getByRole("button", { name: "Agregar participante" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Participante agregado." })).toBeVisible();
  await page.goto(`${detail}/void`);
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.getByText("Movimiento anulado.", { exact: false }).first()).toBeVisible();
  await page.goto(`${book}?aviso=%3Cb%3Ehola%3C/b%3E`);
  await expect(page.locator(".notice")).toHaveCount(0);
});

test("se explica el saldo y se registra una sugerencia hasta quedar a mano", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(book);
  await page.getByRole("link", { name: "¿Por qué?" }).click();
  await expect(page.getByRole("heading", { name: "Por qué te deben" })).toBeVisible();
  await expect(page.getByText("Coincide con el saldo del grupo")).toBeVisible();
  await expect(page.getByText("acumulado COP 50,00")).toBeVisible();
  await page.getByRole("link", { name: "← Volver al libro" }).click();
  await expect(page.getByText("Para quedar a mano")).toBeVisible();
  await page.getByRole("link", { name: /^Registrar:/u }).click();
  await expect(page.getByRole("heading", { name: "Agregar transferencia" })).toBeVisible();
  await expect(page.getByLabel("Importe", { exact: true })).toHaveValue("50.00");
  await page.getByLabel("Descripción").fill("Pago de Beto");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Pago de Beto" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al libro" }).click();
  await expect(page.getByText("Estás a mano.")).toBeVisible();
  await expect(page.getByText("Para quedar a mano")).toHaveCount(0);
});

test("archivar deja el grupo de sólo lectura y restaurar lo reabre", async ({ page }) => {
  const { book } = await seededBook(page);
  await page.goto(book);
  await page.getByText("Archivar este grupo").click();
  await page.getByRole("button", { name: "Archivar grupo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Grupo archivado." })).toBeVisible();
  await expect(page.getByText("Este grupo está archivado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Agregar movimiento" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Gasto", exact: true })).toHaveCount(0);
  await page.goto(`${book}/ledger/new`);
  await expect(page.getByRole("alert")).toContainText("El libro está archivado.");
  await page.goto(book);
  await page.getByRole("button", { name: "Restaurar grupo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Grupo restaurado." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agregar movimiento" }).first()).toBeVisible();
});

// Contraste real de lo que se ve: color de cada texto contra el primer fondo opaco de sus ancestros.
async function lowContrast(page) {
  return page.evaluate(() => {
    const parse = value => { const match = value.match(/rgba?\(([^)]+)\)/u); if (!match) return null; const [r, g, b, a = 1] = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number); return { r, g, b, a }; };
    const channel = v => { const u = v / 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    const lum = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
    const backgroundOf = node => { for (let el = node; el; el = el.parentElement) { const bg = parse(getComputedStyle(el).backgroundColor); if (bg && bg.a > 0.99) return bg; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const failures = [];
    let inspected = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim()) continue;
      const el = text.parentElement;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || !el.getClientRects().length || el.closest("[hidden]")) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      inspected += 1;
      const value = ratio(fg, backgroundOf(el));
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (value < (large ? 3 : 4.5)) failures.push(`${text.textContent.trim().slice(0, 40)} → ${value.toFixed(2)}`);
    }
    return inspected < 5 ? [`sólo se inspeccionaron ${inspected} textos`] : failures;
  });
}

for (const scheme of ["light", "dark"]) {
  test(`el texto de las pantallas cumple el contraste real en ${scheme}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const { pages, book, detail } = await seededBook(page);
    // Estado con saldo en contra, sugerencias, vista previa y aviso para cubrir más colores.
    const targets = [...pages, `${book}?aviso=participante`, `${book}/ledger/balance`, `${detail}?aviso=guardado`];
    for (const path of targets) {
      await page.goto(path);
      expect(await lowContrast(page), `contraste en ${path}`).toEqual([]);
    }
    await page.goto(`${book}/ledger/new`);
    await page.getByLabel("Importe", { exact: true }).fill("12.5.1");
    expect(await lowContrast(page), "contraste de la vista previa con advertencia").toEqual([]);
    await context.close();
  });
}
