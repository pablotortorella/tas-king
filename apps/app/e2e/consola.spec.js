import { expect, test } from "@playwright/test";
import { lowContrast, uniqueId } from "./helpers.js";

// Consola de administración en un navegador real (consola-administracion-homesuite, tareas 7.1 y 7.4). La cuenta consola@example.test es
// dueña de la suite en el servidor E2E (HOMESUITE_OWNER_USER_IDS, seed/consola-local.sql), que también siembra estadística sintética.
const OWNER = "consola%40example.test";
const signIn = (page, email) => page.goto(`/api/local/session?as=${email}`);

for (const [name, viewport] of [["teléfono", { width: 390, height: 844 }], ["escritorio", { width: 1280, height: 900 }]]) {
  test.describe(`pestaña Suite · ${name}`, () => {
    test.use({ viewport });

    test("se ve completa, sin desbordar, con contraste suficiente y gráficos con texto alternativo y tabla", async ({ page }) => {
      await signIn(page, OWNER);
      await page.goto("/consola");
      await expect(page).toHaveURL(/\/consola\/suite$/u);
      const tabs = page.getByRole("navigation", { name: "Secciones de la consola" }).getByRole("link");
      await expect(tabs).toHaveText(["Suite", "Tareas", "Cuentas Claras", "Administradores"]);
      await expect(tabs.first()).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
      await expect(page.getByRole("table").filter({ hasText: "Hicieron algo" })).toBeVisible();

      const chart = page.getByRole("img", { name: "Personas activas por día" });
      await expect(chart).toBeVisible();
      expect(await chart.evaluate((svg) => svg.querySelector("desc")?.textContent ?? "")).toContain("En 30 días");
      await page.getByText("Ver como tabla").first().click();
      await expect(page.getByRole("table", { name: "Personas activas por día" })).toBeVisible();

      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(inner);
      expect(await lowContrast(page)).toEqual([]);
    });
  });
}

test("se recorre con teclado: período anterior, herramienta y vuelta", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/consola/suite");
  const previous = page.getByRole("link", { name: "Período anterior" });
  await previous.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/periodo=mes&clave=\d{4}-\d{2}/u);
  await expect(page.getByRole("link", { name: "Período siguiente" })).toBeVisible();
  const tool = page.getByRole("table").filter({ hasText: "Hicieron algo" }).getByRole("link", { name: "Tareas" });
  await tool.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("img", { name: "Tareas: personas distintas por período" })).toBeVisible();
  await page.getByRole("link", { name: "Cerrar la serie" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("img", { name: "Tareas: personas distintas por período" })).toHaveCount(0);
});

test("el dueño da y quita el rol de Tareas, y el historial lo muestra", async ({ page }) => {
  const email = `rol-${uniqueId()}@example.test`;
  // La cuenta tiene que existir: se crea al entrar una vez.
  await signIn(page, encodeURIComponent(email));
  expect((await page.request.get("/consola", { maxRedirects: 0 })).status()).toBe(404);

  await signIn(page, OWNER);
  await page.goto("/consola/administradores");
  await page.getByLabel("Correo de la cuenta").fill(email);
  await page.getByLabel("Herramienta").selectOption("tareas");
  await page.getByRole("button", { name: "Dar rol" }).click();
  await expect(page.getByRole("status")).toHaveText("Rol dado.");
  const roles = page.getByRole("table").filter({ hasText: "Lo dio" });
  await expect(roles.getByRole("row").filter({ hasText: email })).toContainText("Tareas");

  await signIn(page, encodeURIComponent(email));
  await page.goto("/consola");
  await expect(page).toHaveURL(/\/consola\/tareas$/u);
  await expect(page.getByRole("navigation", { name: "Secciones de la consola" }).getByRole("link")).toHaveText(["Tareas"]);
  await expect(page.getByText("Cuentas más activas")).toHaveCount(0);
  await page.getByLabel("Abrir el menú").click();
  await expect(page.getByRole("link", { name: "Consola" })).toBeVisible();

  await signIn(page, OWNER);
  await page.goto("/consola/administradores");
  await roles.getByRole("row").filter({ hasText: email }).getByRole("button", { name: /^Quitar el rol Tareas/u }).click();
  await expect(page.getByRole("status")).toHaveText("Rol quitado.");
  const name = email.split("@")[0];
  const history = page.getByRole("table").filter({ hasText: "Cambio" });
  await expect(history.getByRole("row").filter({ hasText: name }).first()).toContainText("Quitó el rol Tareas");
  await expect(history.getByRole("row").filter({ hasText: name }).nth(1)).toContainText("Dio el rol Tareas");

  await signIn(page, encodeURIComponent(email));
  expect((await page.request.get("/consola/tareas", { maxRedirects: 0 })).status()).toBe(404);
});
