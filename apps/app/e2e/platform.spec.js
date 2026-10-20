import { expect, test } from "@playwright/test";

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
