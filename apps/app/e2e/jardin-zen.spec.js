import { test, expect } from "@playwright/test";

// Prueba sencilla; la validación de WebGL real y el tacto necesita dispositivos físicos.
test("Jardín Zen se abre sin sesión y permite alternar el ancho", async ({ page }) => {
  await page.goto("/jardin-zen");
  await expect(page.getByRole("heading", { name: "Un momento de calma" })).toBeVisible();
  await expect(page.locator("canvas#scene")).toBeVisible();
  const rake = page.locator("#rake-size");
  await expect(rake).toHaveText("Trazo fino");
  await rake.click();
  await expect(rake).toHaveText("Trazo normal");
  await rake.click();
  await expect(rake).toHaveText("Trazo fino");
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "false");
});
