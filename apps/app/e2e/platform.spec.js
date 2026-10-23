import { expect, test } from "@playwright/test";

test("una sesión local usa el formulario autenticado con CSRF real", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto(`/api/local/session?as=owner-${suffix}%40example.test`);
  await expect(page).toHaveURL(/\/spaces\/new$/u);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa autenticada ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await expect(page.getByRole("heading", { name: `Casa autenticada ${suffix}` })).toBeVisible();
});

test("la segunda cuenta entra directo a sus invitaciones pendientes", async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `invitee-${suffix}@example.test`;
  await page.goto(`/api/local/session?as=owner-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa invitación ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await page.getByLabel("Invitar por email").fill(invitee);
  await page.getByRole("button", { name: "Invitar" }).click();

  const invitedContext = await browser.newContext();
  try {
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto(new URL(`/api/local/session?as=${encodeURIComponent(invitee)}`, page.url()).href);
    await expect(invitedPage).toHaveURL(/\/invitations$/u);
    await invitedPage.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(invitedPage.getByRole("heading", { name: `Casa invitación ${suffix}` })).toBeVisible();
  } finally {
    await invitedContext.close();
  }
});

test("registra, corrige y anula un gasto desde el teléfono", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/api/local/session?as=fin-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await page.getByLabel("Participante sin cuenta").fill("Beto");
  await page.getByRole("button", { name: "Agregar participante" }).click();
  await page.getByRole("link", { name: "Gasto", exact: true }).click();
  await page.getByLabel("Descripción").fill("Supermercado");
  await page.getByLabel("Importe", { exact: true }).fill("100,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "Supermercado" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al libro" }).click();
  await expect(page.getByText("Le deben COP 50,00")).toBeVisible();
  await page.getByRole("link", { name: /Supermercado/ }).click();
  await page.getByRole("link", { name: "Corregir" }).click();
  await page.getByLabel("Importe", { exact: true }).fill("120,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("COP 120,00")).toBeVisible();
  await page.getByRole("link", { name: "Anular" }).click();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.locator(".entry-amount")).toContainText("Anulado");
  await expect(page.getByRole("heading", { name: "Efecto original, no vigente" })).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("dos identidades crean, invitan, aceptan y quedan aisladas", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `invitee-${suffix}@example.test`;

  await page.goto("/demo/crear-espacio");
  await page.getByLabel("Nombre del espacio").fill(`Viaje ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await expect(page.getByRole("heading", { name: "Cuentas Claras está lista." })).toBeVisible();

  await page.getByLabel("Email").fill(invitee);
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText(invitee)).toBeVisible();
  const spaceUrl = page.url();

  await page.getByRole("link", { name: "Ver como invitada" }).click();
  await expect(page.getByText("Antes de aceptar no ves integrantes, movimientos ni saldos.")).toBeVisible();
  await expect(page.getByText("Participantes")).toHaveCount(0);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page.getByText("Integrante", { exact: true })).toBeVisible();

  const isolated = await page.request.get(`${new URL(spaceUrl).pathname}?as=outsider-${suffix}%40example.test`);
  expect(isolated.status()).toBe(404);
});

test("una invitación se puede rechazar sin crear membresía", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `reject-${suffix}@example.test`;

  await page.goto("/demo/crear-espacio");
  await page.getByLabel("Nombre del espacio").fill(`Casa ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await page.getByLabel("Email").fill(invitee);
  await page.getByRole("button", { name: "Invitar" }).click();
  await page.getByRole("link", { name: "Ver como invitada" }).click();
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect(page.getByText("No tenés invitaciones pendientes.")).toBeVisible();
});

test("sólo el titular puede cancelar una invitación pendiente", async ({ request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const owner = `owner-${suffix}@example.test`;
  const invitee = `invitee-${suffix}@example.test`;
  const ownerHeaders = { "Content-Type": "application/json", "X-HomeSuite-Dev-Email": owner };

  const created = await request.post("/api/local/spaces", { headers: ownerHeaders, data: { name: `Grupo ${suffix}` } });
  expect(created.status()).toBe(201);
  const space = await created.json();
  const invited = await request.post(`/api/local/spaces/${space.id}/invitations`, { headers: ownerHeaders, data: { email: invitee } });
  expect(invited.status()).toBe(201);
  const invitation = await invited.json();

  const denied = await request.delete(`/api/local/spaces/${space.id}/invitations/${invitation.id}`, {
    headers: { "X-HomeSuite-Dev-Email": invitee },
  });
  expect(denied.status()).toBe(403);

  const canceled = await request.delete(`/api/local/spaces/${space.id}/invitations/${invitation.id}`, { headers: ownerHeaders });
  expect(canceled.status()).toBe(204);
  const invitations = await request.get(`/api/local/spaces/${space.id}/invitations`, { headers: ownerHeaders });
  await expect(invitations.json()).resolves.toEqual([{ id: invitation.id, email: invitee, status: "canceled" }]);
});
