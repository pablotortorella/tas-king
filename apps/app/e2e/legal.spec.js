import { expect, test } from "@playwright/test";
import { lowContrast, useScheme } from "./helpers.js";

// Aviso de aceptación en el acceso, pie con los textos legales y pantalla de nueva aceptación (change politica-y-aceptacion, tarea 8.1):
// teléfono (390 px) y escritorio, en claro y oscuro, con controles de al menos 44 px, sin desborde horizontal y con contraste suficiente.
const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const SIZES = [["390 px", { width: 390, height: 844 }], ["escritorio", { width: 1280, height: 800 }]];

async function noHorizontalScroll(page, where) {
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content, `desborde en ${where}`).toBeLessThanOrEqual(sizes.viewport);
}

async function heights(page, selector) {
  return page.$$eval(selector, (nodes) => nodes.filter((node) => node.getClientRects().length).map((node) => ({ text: node.textContent.trim().slice(0, 40), height: node.getBoundingClientRect().height })));
}

for (const scheme of ["light", "dark"]) {
  for (const [label, viewport] of SIZES) {
    test.describe(`${label}, esquema ${scheme}`, () => {
      useScheme(test, scheme, viewport);

      test("el acceso muestra el aviso encima del botón, con los dos enlaces de al menos 44 px", async ({ page }) => {
        await page.goto("/");
        const notice = page.locator(".legal-notice");
        await expect(notice).toBeVisible();
        await expect(notice).toContainText("Al continuar aceptás los Términos y condiciones y la Política de privacidad, y confirmás que tenés 18 años o más.");
        const links = notice.getByRole("link");
        await expect(links).toHaveCount(2);
        await expect(links.nth(0)).toHaveAttribute("href", /\/terminos$/u);
        await expect(links.nth(1)).toHaveAttribute("href", /\/privacidad$/u);
        for (const item of await heights(page, ".legal-notice a")) expect(item.height, item.text).toBeGreaterThanOrEqual(43.5);
        // el aviso queda antes del botón y se ve sin desplazarse en el teléfono
        const noticeBox = await notice.boundingBox();
        const buttonBox = await page.getByRole("link", { name: "Continuar con Google" }).boundingBox();
        expect(noticeBox.y).toBeLessThan(buttonBox.y);
        expect(noticeBox.x + noticeBox.width).toBeLessThanOrEqual(viewport.width);
        await noHorizontalScroll(page, "/");
        expect(await lowContrast(page)).toEqual([]);
      });

      test("el pie con privacidad y términos está en el acceso y en una pantalla con sesión", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("navigation", { name: "Textos legales" }).getByRole("link")).toHaveText(["Privacidad", "Términos y condiciones"]);
        for (const item of await heights(page, ".legal-footer a")) expect(item.height, item.text).toBeGreaterThanOrEqual(43.5);
        await page.goto(`/api/local/session?as=pie-${unique()}%40example.test`);
        await expect(page).toHaveURL(/\/groups\/new$/u);
        await expect(page.getByRole("navigation", { name: "Textos legales" })).toBeVisible();
        await noHorizontalScroll(page, "/groups/new");
        expect(await lowContrast(page)).toEqual([]);
      });

      test("la pantalla de nueva aceptación: una columna, botones de 44 px, sin desborde y legible", async ({ page }) => {
        await page.goto(`/api/local/session?as=puerta-${unique()}%40example.test&sin_aceptar=1`);
        await expect(page).toHaveURL(/\/aceptar\?next=%2Fgroups%2Fnew$/u);
        await expect(page.getByRole("heading", { name: "Antes de seguir" })).toBeVisible();
        const accept = page.getByRole("button", { name: "Aceptar y continuar" });
        const decline = page.getByRole("button", { name: "No acepto: cerrar sesión" });
        await expect(accept).toBeVisible();
        await expect(decline).toBeVisible();
        for (const item of await heights(page, ".accept-actions .button, .accept-card .legal-link")) expect(item.height, item.text).toBeGreaterThanOrEqual(43.5);
        const [a, d] = [await accept.boundingBox(), await decline.boundingBox()];
        expect(d.y).toBeGreaterThan(a.y + a.height - 1); // una columna: el segundo botón va debajo del primero
        await noHorizontalScroll(page, "/aceptar");
        expect(await lowContrast(page)).toEqual([]);
      });
    });
  }
}

test("la puerta lleva a /aceptar y aceptar devuelve a la pantalla pedida", async ({ page }) => {
  await page.goto(`/api/local/session?as=acepta-${unique()}%40example.test&sin_aceptar=1`);
  await expect(page).toHaveURL(/\/aceptar\?next=%2Fgroups%2Fnew$/u);
  // otras pantallas también quedan detrás de la puerta
  await page.goto("/groups");
  await expect(page).toHaveURL(/\/aceptar\?next=%2Fgroups$/u);
  await page.getByRole("button", { name: "Aceptar y continuar" }).click();
  await expect(page).toHaveURL(/\/groups$/u);
  // con todo aceptado la pantalla ya no pide nada
  await page.goto("/aceptar?next=%2Fgroups%2Fnew");
  await expect(page).toHaveURL(/\/groups\/new$/u);
});

test("«No acepto» cierra la sesión sin registrar aceptación", async ({ page }) => {
  await page.goto(`/api/local/session?as=rechaza-${unique()}%40example.test&sin_aceptar=1`);
  await page.getByRole("button", { name: "No acepto: cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goto("/groups");
  // sin sesión: redirige a Google (el cliente de Google de la prueba es ficticio, no se sigue)
  const response = await page.request.get("/groups", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toContain("/auth/google");
});

test("las identidades de desarrollo aceptan solas: los recorridos existentes no pasan por la puerta", async ({ page }) => {
  await page.goto(`/api/local/session?as=solo-${unique()}%40example.test`);
  await expect(page).toHaveURL(/\/groups\/new$/u);
  await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
});

test("los campos de texto libre advierten sobre datos sensibles", async ({ page }) => {
  await page.goto(`/api/local/session?as=sensible-${unique()}%40example.test`);
  await expect(page.getByText("No escribas datos sensibles (salud, religión, afiliaciones).")).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa sensible ${unique()}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  const book = new URL(page.url()).pathname;
  await page.goto(`${book}/ledger/new`);
  await expect(page.getByText("No escribas datos sensibles (salud, religión, afiliaciones).")).toHaveCount(2);
  await page.goto(`${book}/people`);
  await expect(page.locator("#participant-name + .sensitive-hint")).toBeVisible();
  await page.goto(`${book}/settings`);
  await expect(page.getByText("No escribas datos sensibles (salud, religión, afiliaciones).")).toHaveCount(2);
});
