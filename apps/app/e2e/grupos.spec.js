import { expect, test } from "@playwright/test";
import { lowContrast, openBook, uniqueId, useScheme } from "./helpers.js";

// Identidad del grupo, «Administrar grupo», cambio de grupo y último grupo, en un navegador real.

const openMenu = page => page.getByLabel("Abrir el menú").click();

async function createGroup(page, name) {
  await page.goto("/groups/new");
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return new URL(page.url()).pathname;
}

for (const [label, size] of [["teléfono", { width: 390, height: 780 }], ["escritorio", { width: 1280, height: 800 }]]) {
  test.describe(`administrar el grupo en ${label}`, () => {
    test.use({ viewport: size });

    test("se llega por la ruedita y por el menú; nombre, descripción, emoji y color se ven en el grupo y en la lista", async ({ page }) => {
      const { book, suffix } = await openBook(page, "gr-admin");
      await page.goto(book);
      await page.getByRole("link", { name: "Administrar grupo" }).click();
      await expect(page).toHaveURL(/\/settings$/u);
      await page.goto(book);
      await openMenu(page);
      await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Administrar grupo" }).click();
      await expect(page).toHaveURL(/\/settings$/u);

      const headings = await page.locator("main h2").allInnerTexts();
      expect(headings.slice(0, 3)).toEqual(["Identidad del grupo", "Personas e invitaciones", "Archivar"]);
      const order = await page.locator("main label").allInnerTexts();
      expect(order.slice(0, 4).map(text => text.split("\n")[0])).toEqual(["Nombre del grupo", "Descripción", "Emoji", "Color de fondo"]);

      await page.getByLabel("Nombre del grupo").fill(`Viaje ${suffix}`);
      await page.getByLabel("Descripción").fill("Gastos del viaje de diciembre a Cartagena con la familia");
      await page.getByLabel("Emoji").fill("✈️");
      await page.getByLabel("Color de fondo").selectOption({ label: "Violeta" });
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Cambios del grupo guardados." })).toBeVisible();

      await page.goto(book);
      await expect(page.getByRole("heading", { name: `Viaje ${suffix}`, level: 1 })).toBeVisible();
      await expect(page.getByText("Gastos del viaje de diciembre a Cartagena con la familia")).toBeVisible();
      await expect(page.locator(".book-title .avatar-violet")).toHaveText("✈️");
      await expect(page.locator(".group-switch .avatar-violet")).toHaveText("✈️");

      await page.locator(".group-switch").click();
      await expect(page).toHaveURL(/\/groups$/u);
      const row = page.locator(".group-row", { hasText: `Viaje ${suffix}` });
      await expect(row).toContainText("Gastos del viaje de diciembre");
      await expect(row.locator(".avatar-violet")).toHaveText("✈️");
    });

    test("un emoji inválido o una descripción de 501 caracteres se explican y no guardan nada", async ({ page }) => {
      const { book, suffix } = await openBook(page, "gr-invalido");
      await page.goto(`${book}/settings`);
      await page.getByLabel("Emoji").fill("hola");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("alert")).toContainText("Elegí un único emoji completo.");
      await page.goto(`${book}/settings`);
      await page.getByLabel("Descripción").evaluate(area => { area.removeAttribute("maxlength"); area.value = "a".repeat(501); });
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("alert")).toContainText("hasta 500 caracteres");
      await page.goto(book);
      await expect(page.getByRole("heading", { name: new RegExp(suffix, "u"), level: 1 })).toBeVisible();
      await expect(page.locator(".group-description")).toHaveCount(0);
    });
  });
}

test("entrar a Cuentas Claras abre el último grupo, y cambiar de grupo cambia el recuerdo", async ({ page }) => {
  const suffix = uniqueId();
  await page.goto(`/api/local/session?as=gr-ultimo-${suffix}%40example.test`);
  const casa = await createGroup(page, `Casa ${suffix}`);
  const viaje = await createGroup(page, `Viaje ${suffix}`);
  await page.goto("/cuentas-claras");
  await expect(page).toHaveURL(new RegExp(`${viaje}$`, "u"));

  await page.locator(".group-switch").click();
  await expect(page).toHaveURL(/\/groups$/u);
  await expect(page.getByRole("link", { name: new RegExp(`Casa ${suffix}`, "u") })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`Viaje ${suffix}`, "u") })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(`Casa ${suffix}`, "u") }).click();
  await expect(page).toHaveURL(new RegExp(`${casa}$`, "u"));

  await page.goto("/");
  await page.goto("/cuentas-claras");
  await expect(page).toHaveURL(new RegExp(`${casa}$`, "u"));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${casa}$`, "u"));
});

test("no hay selector desplegable de grupos y «Mis grupos» del menú lleva a la lista, también con uno solo", async ({ page }) => {
  const { book } = await openBook(page, "gr-lista");
  await page.goto(book);
  await expect(page.locator("select[name*='group' i]")).toHaveCount(0);
  await openMenu(page);
  await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Mis grupos" }).click();
  await expect(page).toHaveURL(/\/groups$/u);
  await expect(page.getByRole("heading", { name: "Tus grupos", level: 1 })).toBeVisible();
});

test("las rutas anteriores dan 404 y las pantallas no dicen «espacio» ni «libro»", async ({ page }) => {
  const { book } = await openBook(page, "gr-lenguaje");
  const old = ["spa", "ces"].join("");
  const id = book.split("/").at(-1);
  for (const path of [`/${old}/${id}`, `/${old}/new`, `/api/${old}/${id}/members`]) expect((await page.request.get(path)).status(), path).toBe(404);
  const words = new RegExp(`\\b(${["espa", "cio"].join("")}s?|libros?)\\b`, "iu");
  for (const path of [book, `${book}/people`, `${book}/settings`, `${book}/ledger/categories`, `${book}/ledger/import`, `${book}/ledger/classify`, "/groups", "/groups/new"]) {
    await page.goto(path);
    expect(await page.locator("body").innerText(), path).not.toMatch(words);
  }
});

for (const scheme of ["light", "dark"]) {
  test.describe(`grupos en el teléfono, ${scheme}`, () => {
    useScheme(test, scheme, { width: 360, height: 800 });

    test("la lista, el grupo y «Administrar grupo» no desbordan, miden 44 px y tienen contraste, con nombres largos y emoji", async ({ page }) => {
      const suffix = uniqueId();
      await page.goto(`/api/local/session?as=gr-tel-${scheme}-${suffix}%40example.test`);
      const first = await createGroup(page, "Una familia con un nombre larguísimo que ocupa varias líneas en el encabezado del grupo");
      await page.goto(`${first}/settings`);
      await page.getByLabel("Descripción").fill("Una descripción larga ".repeat(20).trim());
      await page.getByLabel("Emoji").fill("👨‍👩‍👧");
      await page.getByLabel("Color de fondo").selectOption({ label: "Ámbar" });
      await page.getByRole("button", { name: "Guardar" }).click();
      await createGroup(page, `Casa ${suffix}`);
      const check = async label => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desborde en ${label}`).toBeLessThanOrEqual(0);
        const small = await page.evaluate(() => [...document.querySelectorAll("a, button, summary, select, input:not([type=hidden]), textarea")]
          .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !el.closest(".tabbar"))
          .map(el => ({ text: (el.innerText || el.getAttribute("aria-label") || el.name || "").slice(0, 30), height: el.getBoundingClientRect().height }))
          .filter(item => item.height < 43.5));
        expect(small, `controles chicos en ${label}`).toEqual([]);
        expect(await lowContrast(page), `contraste en ${label}`).toEqual([]);
      };
      await page.goto("/groups");
      await check("lista de grupos");
      await page.goto(first);
      await check("página del grupo");
      await page.goto(`${first}/settings`);
      await check("administrar grupo");
      await openMenu(page);
      await check("menú abierto");
    });
  });
}
