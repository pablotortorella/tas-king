import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  // Estado limpio: sin preferencia guardada → arranca en claro (prefers-color-scheme light por defecto en Playwright)
  await page.goto("/tareas");
  await page.evaluate(() => localStorage.removeItem("tasking-theme"));
  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
});

test("toggle de tema cambia, muestra el ícono correcto y persiste", async ({ page }) => {
  const html = page.locator("html");
  const btn = page.locator("#themeBtn");

  // Arranca en claro
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(btn).toHaveText("🌙");

  // Cambiar a oscuro
  await btn.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(btn).toHaveText("☀️");

  // Persiste tras recargar
  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#themeBtn")).toHaveText("☀️");

  // Volver a claro
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test.describe('preferencia del sistema',()=>{
  test.use({colorScheme:'dark'});
  test("respeta prefers-color-scheme: dark cuando no hay preferencia guardada", async ({ page,browserName }) => {
    await page.goto("/tareas");
    test.skip(browserName==='firefox'&&!await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches),'Firefox 151 pierde la emulación oscura al cambiar contexto con COOP, reproducido con HTML vacío. No se relaja la política del producto.');
    await page.evaluate(() => localStorage.removeItem("tasking-theme"));
    await page.reload();
    await expect(page.locator("#board .column").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
