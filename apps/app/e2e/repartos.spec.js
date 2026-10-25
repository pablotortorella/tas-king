import { expect, test } from "@playwright/test";
import { splitAmount } from "../src/split.js";
import { emulateScheme, lowContrast, openRecent } from "./helpers.js";

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const METHODS = [
  ["Igual", null],
  ["Importes exactos", ".method-fields.method-exact"],
  ["Porcentajes", ".method-fields.method-percent"],
  ["Partes", ".method-fields.method-shares"],
  ["Algunos fijos", ".method-fields.method-fixed"],
];

// Crea un grupo con la persona titular y una persona sin cuenta («Beto») y abre el formulario de gasto.
async function openForm(page) {
  const suffix = unique();
  await page.goto(`/api/local/session?as=rep-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa repartos ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  const book = new URL(page.url()).pathname;
  await page.getByLabel("Participante sin cuenta").fill("Beto");
  await page.getByRole("button", { name: "Agregar participante" }).click();
  await page.goto(`${book}/ledger/new?type=expense`);
  return { book, suffix };
}

async function fillAndSave(page, description, amount) {
  await page.getByLabel("Descripción").fill(description);
  await page.getByLabel("Importe", { exact: true }).fill(amount);
}
const leToca = (page, person) => page.getByRole("row", { name: person }).getByRole("cell").nth(2);

test("cada método muestra sus campos, su ayuda y oculta los de los demás", async ({ page }) => {
  await openForm(page);
  for (const [label, group] of METHODS) {
    await page.getByLabel(label, { exact: true }).check();
    for (const [, other] of METHODS) {
      if (!other) continue;
      if (other === group) await expect(page.locator(other)).toBeVisible();
      else await expect(page.locator(other)).toBeHidden();
    }
    await expect(page.locator("p.method-hint:visible")).toHaveCount(1);
  }
});

test("se guarda con cada método y el detalle muestra los importes que resultan", async ({ page }) => {
  const { book } = await openForm(page);
  const cases = [
    { label: "Igual", fill: async () => {}, own: "50,00", other: "50,00" },
    { label: "Importes exactos", fill: async () => { const inputs = page.locator(".method-fields.method-exact input"); await inputs.nth(0).fill("30,50"); await inputs.nth(1).fill("69,50"); }, own: "30,50", other: "69,50" },
    { label: "Porcentajes", fill: async () => { const inputs = page.locator(".method-fields.method-percent input"); await inputs.nth(0).fill("60"); await inputs.nth(1).fill("40"); }, own: "60,00", other: "40,00" },
    { label: "Partes", fill: async () => { const inputs = page.locator(".method-fields.method-shares input"); await inputs.nth(0).fill("2"); await inputs.nth(1).fill("1"); }, own: "66,67", other: "33,33" },
    { label: "Algunos fijos", fill: async () => { await page.locator(".method-fields.method-fixed input").nth(0).fill("10"); }, own: "10,00", other: "90,00" },
  ];
  for (const method of cases) {
    await page.goto(`${book}/ledger/new?type=expense`);
    await fillAndSave(page, `Cena ${method.label}`, "100,00");
    await page.getByLabel(method.label, { exact: true }).check();
    await method.fill();
    await page.getByRole("button", { name: "Guardar" }).click();
    await openRecent(page, `Cena ${method.label}`);
    await expect(leToca(page, "Beto")).toHaveText(method.other);
    await expect(page.getByRole("row").filter({ hasNotText: "Beto" }).filter({ hasText: method.own }).first()).toBeVisible();
  }
});

test("un reparto inválido se explica en el formulario y no guarda nada", async ({ page }) => {
  await openForm(page);
  await fillAndSave(page, "Cena inválida", "100,00");
  await page.getByLabel("Porcentajes", { exact: true }).check();
  const inputs = page.locator(".method-fields.method-percent input");
  await inputs.nth(0).fill("50");
  await inputs.nth(1).fill("49");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".form-feedback.error")).toContainText("deben sumar 100 %");
  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
});

test("al corregir, el movimiento se reabre con su método y sus datos, y el historial registra el cambio de forma", async ({ page }) => {
  await openForm(page);
  await fillAndSave(page, "Cena corregible", "100,00");
  await page.getByLabel("Porcentajes", { exact: true }).check();
  await page.locator(".method-fields.method-percent input").nth(0).fill("60");
  await page.locator(".method-fields.method-percent input").nth(1).fill("40");
  await page.getByRole("button", { name: "Guardar" }).click();
  await openRecent(page, "Cena corregible");
  await page.getByRole("link", { name: "Corregir" }).click();
  await expect(page.getByLabel("Porcentajes", { exact: true })).toBeChecked();
  await expect(page.locator(".method-fields.method-percent input").nth(0)).toHaveValue("60");
  await expect(page.locator(".method-fields.method-percent input").nth(1)).toHaveValue("40");
  await page.locator(".method-fields.method-percent input").nth(0).fill("50");
  await page.locator(".method-fields.method-percent input").nth(1).fill("50");
  await page.getByRole("button", { name: "Guardar" }).click();
  await openRecent(page, "Cena corregible");
  await expect(page.locator(".timeline")).toContainText("forma de reparto");
});

test("el atajo «lo debe todo» deja a una sola persona con todo el importe", async ({ page }) => {
  const { book } = await openForm(page);
  await fillAndSave(page, "Préstamo a Beto", "100,00");
  await page.getByRole("button", { name: "Lo debe todo Beto" }).click();
  await expect(page.locator('input[name="beneficiary"]:checked')).toHaveCount(1);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Préstamo a Beto");
  await page.goto(book);
  await expect(page.getByText("Le deben COP 100,00")).toBeVisible();
  await expect(page.getByText("Debe COP 100,00")).toBeVisible();
});

for (const scheme of ["light", "dark"]) {
  test(`en 390 px con cada método no desborda, los controles miden 44 px y el contraste cumple en ${scheme}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await emulateScheme(page, scheme);
    await openForm(page);
    for (const [label] of METHODS) {
      await page.getByLabel(label, { exact: true }).check();
      const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(sizes.content, `desborde con ${label}`).toBeLessThanOrEqual(sizes.viewport);
      const small = await page.$$eval(".method-fields input, .chip-button, .choice span", nodes => nodes
        .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
        .map(node => ({ label: (node.textContent || node.getAttribute("name") || node.tagName).trim().slice(0, 30), height: node.getBoundingClientRect().height }))
        .filter(item => item.height < 43.5));
      expect(small, `controles chicos con ${label}`).toEqual([]);
      expect(await lowContrast(page), `contraste con ${label}`).toEqual([]);
    }
    await context.close();
  });
}

// Efecto de cada persona en la vista previa: nombre y importe sin la moneda.
async function previewEffects(page) {
  const rows = await page.locator(".effect-preview li").evaluateAll(items => items.map(item => [item.children[0].textContent, item.children[1].textContent.replace("COP ", "")]));
  return Object.fromEntries(rows);
}
// Efecto de cada persona en la tabla «Cómo se repartió» del detalle.
async function detailEffects(page) {
  const rows = await page.locator("table.split tbody tr").evaluateAll(trs => trs.map(tr => [tr.children[0].textContent.trim(), tr.children[3].textContent.trim()]));
  return Object.fromEntries(rows.filter(([, effect]) => effect !== "0,00"));
}

test("para cada método la vista previa muestra los mismos importes que el movimiento guardado", async ({ page }) => {
  const { book } = await openForm(page);
  const cases = [
    { label: "Igual", fill: async () => {} },
    { label: "Importes exactos", fill: async () => { const inputs = page.locator(".method-fields.method-exact input"); await inputs.nth(0).fill("33,33"); await inputs.nth(1).fill("66,68"); } },
    { label: "Porcentajes", fill: async () => { const inputs = page.locator(".method-fields.method-percent input"); await inputs.nth(0).fill("33,33"); await inputs.nth(1).fill("66,67"); } },
    { label: "Partes", fill: async () => { const inputs = page.locator(".method-fields.method-shares input"); await inputs.nth(0).fill("1"); await inputs.nth(1).fill("2"); } },
    { label: "Algunos fijos", fill: async () => { await page.locator(".method-fields.method-fixed input").nth(1).fill("12,34"); } },
  ];
  for (const method of cases) {
    await page.goto(`${book}/ledger/new?type=expense`);
    await fillAndSave(page, `Prevista ${method.label}`, "100,01");
    await page.getByLabel(method.label, { exact: true }).check();
    await method.fill();
    await expect(page.locator(".effect-preview li")).toHaveCount(2);
    const previewed = await previewEffects(page);
    await page.getByRole("button", { name: "Guardar" }).click();
    await openRecent(page, `Prevista ${method.label}`);
    const saved = await detailEffects(page);
    expect(Object.values(previewed).sort(), method.label).toEqual(Object.values(saved).sort());
    expect(Object.keys(previewed).every(name => name in saved), method.label).toBe(true);
    for (const [name, effect] of Object.entries(previewed)) expect(saved[name], `${method.label} ${name}`).toBe(effect);
  }
});

test("con datos incompletos la vista previa dice qué falta y no muestra importes", async ({ page }) => {
  await openForm(page);
  await fillAndSave(page, "Incompleto", "100,00");
  await page.getByLabel("Porcentajes", { exact: true }).check();
  await page.locator(".method-fields.method-percent input").nth(0).fill("50");
  const preview = page.locator(".effect-preview");
  await expect(preview).toContainText("Falta el porcentaje");
  await expect(page.locator(".effect-preview li")).toHaveCount(0);
  await page.getByLabel("Algunos fijos", { exact: true }).check();
  await page.locator(".method-fields.method-fixed input").nth(0).fill("150");
  await expect(preview).toContainText("superan el total");
  await expect(page.locator(".effect-preview li")).toHaveCount(0);
});

test("el /split.js que sirve el Worker real coincide con la función del servidor", async ({ request }) => {
  const response = await request.get("/split.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/javascript");
  const served = new Function(`${(await response.text()).replace("export function", "function")}; return splitAmount;`)();
  const order = { a: 0, b: 1, c: 2 };
  const requests = [
    { totalMinor: 10001, units: 2, currency: "COP", method: "equal", beneficiaries: ["c", "a", "b"], inputs: {}, order },
    { totalMinor: 1000, units: 2, currency: "COP", method: "percent", beneficiaries: ["a", "b", "c"], inputs: { a: "33,33", b: "33,33", c: "33,34" }, order },
    { totalMinor: 10000, units: 2, currency: "COP", method: "shares", beneficiaries: ["a", "b", "c"], inputs: { a: "2", b: "1", c: "1" }, order },
    { totalMinor: 10000, units: 2, currency: "COP", method: "fixed", beneficiaries: ["a", "b", "c"], inputs: { a: "10", b: "", c: "" }, order },
    { totalMinor: 10000, units: 2, currency: "COP", method: "exact", beneficiaries: ["a", "b"], inputs: { a: "20", b: "79" }, order, names: { a: "Ana", b: "Beto" } },
  ];
  for (const request of requests) expect(served(request)).toEqual(splitAmount(request));
});
