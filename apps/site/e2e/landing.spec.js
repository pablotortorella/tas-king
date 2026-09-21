import { expect, test } from "@playwright/test";

test("presenta HomeSuite y lleva a las tres landings", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Organizarnos puede ser más simple.",
  })).toBeVisible();
  await expect(page.getByText("Fun TasKing", { exact: true })).toBeVisible();
  await expect(page.getByText("Gastos", { exact: true })).toBeVisible();
  await expect(page.getByText("Compras", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conocé las herramientas" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Conocé Fun TasKing" })).toHaveAttribute("href", "/tareas");
  await expect(page.getByRole("link", { name: "Conocé Gastos" })).toHaveAttribute("href", "/gastos");
  await expect(page.getByRole("link", { name: "Conocé Compras" })).toHaveAttribute("href", "/compras");
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

  await expect(page.getByRole("link", { name: "Conocé Fun TasKing" })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("Fun TasKing tiene su landing y enlaza a la aplicación actual", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Conocé Fun TasKing" }).click();

  await expect(page).toHaveURL(/\/tareas$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fun TasKing!" })).toBeVisible();
  const appLink = page.getByRole("link", { name: "Abrir Fun TasKing" });
  await expect(appLink).toHaveAttribute("href", "https://tas-king.pablotortorella.workers.dev");
  await expect(appLink).not.toHaveAttribute("target", "_blank");
  await expect(page.getByText("Por ahora, se abre en su dirección actual.")).toBeVisible();
});

for (const [slug, heading] of [
  ["gastos", "Las cuentas compartidas, más claras."],
  ["compras", "Una lista para comprar mejor, juntos."],
]) {
  test(`/${slug} explica el producto sin fingir una app disponible`, async ({ page }) => {
    await page.goto(`/${slug}`);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Esta herramienta todavía está en preparación.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Todas las herramientas/ })).toHaveAttribute("href", "/#herramientas");
    await expect(page.getByRole("link", { name: "Abrir Fun TasKing" })).toHaveCount(0);
    await expect(page.locator("form, button")).toHaveCount(0);
  });
}

for (const slug of ["tareas", "gastos", "compras"]) {
  test(`/${slug} sirve HTML con cabeceras de seguridad`, async ({ request }) => {
    const response = await request.get(`/${slug}`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
    expect(response.headers()["content-security-policy"]).toContain("script-src 'none'");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test(`/${slug} cabe en 360 píxeles`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  });
}

test("las landings respetan la preferencia de modo oscuro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/gastos");

  const pageColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--page").trim()
  );
  expect(pageColor).toBe("#161914");
});
