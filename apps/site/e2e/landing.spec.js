import { expect, test } from "@playwright/test";

test("presenta HomeSuite y lleva a las tres landings", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "Organizá, cuidá y disfrutá tu hogar.",
  })).toBeVisible();
  await expect(page.getByText("Fun TasKing", { exact: true })).toBeVisible();
  await expect(page.getByText("Cuentas Claras", { exact: true })).toBeVisible();
  await expect(page.getByText("Compras")).toHaveCount(0); // oculto hasta que exista
  await expect(page.getByText("Remanso", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorá las herramientas" })).toBeVisible();
  // El hero lleva a Remanso en la app. Este servidor es el de producción (sin SITE_ENV=staging): el enlace es el de producción.
  await expect(page.getByRole("link", { name: /Probá Remanso/ })).toHaveAttribute("href", "https://app.homesuite.info/remanso");

  await expect(page.getByRole("link", { name: "Conocé Fun TasKing" })).toHaveAttribute("href", "/tareas");
  await expect(page.getByRole("link", { name: "Conocé Cuentas Claras" })).toHaveAttribute("href", "/cuentas-claras");
  await expect(page.getByRole("link", { name: "Conocé Remanso" })).toHaveAttribute("href", "/remanso");
});

test("entrega la portada con cabeceras de seguridad", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain("script-src 'none'");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

for (const [slug, title] of [["privacidad", "Política de privacidad"], ["terminos", "Términos y condiciones"]]) {
  test(`la portada enlaza a /${slug} y el documento cabe en móvil`, async ({ page, request }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.getByRole("link", { name: title === "Política de privacidad" ? "Privacidad" : title }).click();
    await expect(page).toHaveURL(new RegExp(`/${slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
    const response = await request.get(`/${slug}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-security-policy"]).toContain("script-src 'none'");
  });
}

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

for (const [slug, heading, nombre] of [
  ["cuentas-claras", "Las cuentas claras, sin vueltas.", "Cuentas Claras"],
  ["remanso", "Un rato de calma para la casa.", "Remanso"],
]) {
  test(`/${slug} explica el producto, dice que está en versión beta y lleva a la app`, async ({ page }) => {
    await page.goto(`/${slug}`);

    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Esta herramienta está en versión beta.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Todas las herramientas/ })).toHaveAttribute("href", "/#herramientas");
    await expect(page.getByRole("link", { name: "Abrir Fun TasKing" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: `Entrar a ${nombre}` })).toHaveAttribute("href", `https://app.homesuite.info/${slug}`);
    await expect(page.locator("form, button")).toHaveCount(0);
  });
}

for (const slug of ["tareas", "cuentas-claras", "remanso"]) {
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
  await page.goto("/cuentas-claras");

  const pageColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--page").trim()
  );
  expect(pageColor).toBe("#161914");
});

test("/gastos ya no conserva una landing ni redirige", async ({ request }) => {
  const response = await request.get("/gastos", { maxRedirects: 0 });

  expect(response.status()).toBe(404);
  expect(response.headers().location).toBeUndefined();
  expect(await response.text()).not.toContain("Cuentas Claras");
});

test("/compras no se publica mientras la herramienta no exista", async ({ request }) => {
  for (const ruta of ["/compras", "/compras.html"]) {
    const response = await request.get(ruta, { maxRedirects: 0 });
    expect(response.status(), ruta).toBe(404);
  }
});
