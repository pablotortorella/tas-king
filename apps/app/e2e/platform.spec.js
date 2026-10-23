import { expect, test } from "@playwright/test";

test("una sesión local usa el formulario autenticado con CSRF real", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto(`/api/local/session?as=owner-${suffix}%40example.test`);
  await expect(page).toHaveURL(/\/spaces\/new$/u);
  await page.getByLabel("Nombre del espacio").fill(`Casa autenticada ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  await expect(page.getByRole("heading", { name: "Cuentas Claras está lista." })).toBeVisible();
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
