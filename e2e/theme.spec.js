import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  // Estado limpio: sin preferencia guardada → arranca en claro (prefers-color-scheme light por defecto en Playwright)
  await page.goto("/");
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

test("respeta prefers-color-scheme: dark cuando no hay preferencia guardada", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("tasking-theme"));
  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await ctx.close();
});
