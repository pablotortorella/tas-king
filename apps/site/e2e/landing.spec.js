import { expect, test } from "@playwright/test";

test("presenta HomeSuite y permite entrar a Fun TasKing", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "La vida compartida merece herramientas más simples.",
  })).toBeVisible();
  await expect(page.getByText("Fun TasKing", { exact: true })).toBeVisible();
  await expect(page.getByText("Gastos", { exact: true })).toBeVisible();
  await expect(page.getByText("Compras", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conocé las herramientas" })).toBeVisible();

  const taskingLink = page.getByRole("link", { name: "Abrir Fun TasKing" });
  await expect(taskingLink).toHaveAttribute(
    "href",
    "https://tas-king.pablotortorella.workers.dev",
  );
  await expect(taskingLink).not.toHaveAttribute("target", "_blank");
});

test("entrega la portada con cabeceras de seguridad", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain("script-src 'none'");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("mantiene el contenido accesible en 360 píxeles", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Abrir Fun TasKing" })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});
