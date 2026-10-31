import { expect, test } from "@playwright/test";
import { lowContrast, openBook } from "./helpers.js";

// El menú de la app lleva a las secciones del libro (antes sólo se llegaba bajando hasta el final) y suma «Ver mi perfil».

const openMenu = page => page.getByLabel("Abrir el menú").click();

const sections = [
  ["Personas", /\/people$/u],
  ["Categorías", /\/ledger\/categories$/u],
  ["Importar de Splitwise", /\/ledger\/import$/u],
];

for (const [label, size] of [["teléfono", { width: 390, height: 780 }], ["escritorio", { width: 1280, height: 800 }]]) {
  test.describe(`menú en ${label}`, () => {
    test.use({ viewport: size });

    test("alcanza cada sección del grupo sin desplazarse hasta el final", async ({ page }) => {
      const { book } = await openBook(page, "menu-secciones");
      for (const [name, url] of sections) {
        await page.goto(book);
        await openMenu(page);
        await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name }).click();
        await expect(page).toHaveURL(url);
      }
    });

    // Estuvo roto: el formulario del menú no llevaba el token CSRF y toda persona veía «Solicitud no verificada».
    test("«Cerrar sesión» cierra la sesión y vuelve al inicio sin cuenta", async ({ page }) => {
      const { book } = await openBook(page, "menu-salir");
      await page.goto(book);
      await openMenu(page);
      await page.getByRole("button", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL(/\/$/u);
      await expect(page.getByText("Solicitud no verificada")).toHaveCount(0);
      await expect(page.locator(".account-link")).toHaveCount(0);
      // Sin sesión, el grupo pide entrar de nuevo (redirige al acceso) en vez de abrirse.
      const respuesta = await page.request.get(book, { maxRedirects: 0 });
      expect(respuesta.status()).toBe(303);
    });

    test("«Ver mi perfil» abre el perfil propio y el menú se puede cerrar con Escape", async ({ page }) => {
      const { book } = await openBook(page, "menu-perfil");
      await page.goto(book);
      await openMenu(page);
      await expect(page.getByRole("navigation", { name: "Menú" })).toBeVisible();
      expect(await lowContrast(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "Menú" })).toBeHidden();
      await openMenu(page);
      await page.getByRole("link", { name: "Ver mi perfil" }).click();
      await expect(page).toHaveURL(/\/perfil$/u);
      await expect(page.locator("#profile-form")).toBeVisible();
    });

    test("elegir una sección de la misma página cierra el menú y tocar afuera también", async ({ page }) => {
      const { book } = await openBook(page, "menu-cierra");
      await page.goto(book);
      await openMenu(page);
      await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Movimientos" }).click();
      await expect(page.getByRole("navigation", { name: "Menú" })).toBeHidden();
      await openMenu(page);
      await page.mouse.click(6, 300);
      await expect(page.getByRole("navigation", { name: "Menú" })).toBeHidden();
    });

    test("el enlace de la cuenta lleva al perfil y la página no desborda", async ({ page }) => {
      const { book } = await openBook(page, "menu-cuenta");
      await page.goto(book);
      await page.getByRole("link", { name: /^Mi perfil:/u }).click();
      await expect(page).toHaveURL(/\/perfil$/u);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
