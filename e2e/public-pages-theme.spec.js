import { expect, test } from "@playwright/test";

// Landing/términos/releases no requieren sesión ni tocan la DB — solo el
// toggle claro/oscuro + colores Candy Pop (#10).
for (const path of ["/landing", "/terminos", "/releases"]) {
  test(`${path}: toggle de tema cambia y persiste tras recargar`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => localStorage.removeItem("tasking-theme"));
    await page.reload();

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.locator("#themeBtn").click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}
