import { expect, test } from "@playwright/test";
import { addPerson } from "./helpers.js";

test("una sesión local usa el formulario autenticado con CSRF real", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto(`/api/local/session?as=owner-${suffix}%40example.test`);
  await expect(page).toHaveURL(/\/groups\/new$/u);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa autenticada ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page.getByRole("heading", { name: `Casa autenticada ${suffix}` })).toBeVisible();
});

test("la segunda cuenta entra directo a sus invitaciones pendientes", async ({ page, browser }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `invitee-${suffix}@example.test`;
  await page.goto(`/api/local/session?as=owner-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa invitación ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await page.goto(`${new URL(page.url()).pathname}/people`);
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
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await addPerson(page, new URL(page.url()).pathname, "Beto");
  await page.getByRole("link", { name: "Gasto", exact: true }).click();
  await page.getByLabel("Descripción").fill("Supermercado");
  await page.getByLabel("Importe", { exact: true }).fill("100,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".notice")).toContainText("Movimiento guardado.");
  await expect(page.locator(".recent-strip")).toContainText("Recién agregado");
  await expect(page.getByText("Le deben COP 50,00")).toBeVisible();
  await page.locator(".recent-strip").getByRole("link", { name: /Supermercado/ }).click();
  await page.getByRole("link", { name: "Corregir", exact: true }).click();
  await page.getByLabel("Importe", { exact: true }).fill("120,00");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".notice")).toContainText("Movimiento corregido.");
  await expect(page.locator(".recent-strip")).toContainText("Recién corregido");
  await expect(page.locator(".recent-strip")).toContainText("COP 120,00");
  await page.locator(".recent-strip").getByRole("link", { name: /Supermercado/ }).click();
  await page.getByRole("link", { name: "Anular" }).click();
  await page.getByRole("button", { name: "Confirmar anulación" }).click();
  await expect(page.locator(".recent-strip")).toContainText("Recién anulado");
  await page.locator(".recent-strip").getByRole("link", { name: /Supermercado/ }).click();
  await expect(page.locator(".entry-amount")).toContainText("Anulado");
  await expect(page.getByRole("heading", { name: "Efecto original, no vigente" })).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("previsualiza, resuelve incidentes e importa Splitwise en móvil", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerName = `splitwise-e2e-${suffix}`;
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Ana,Beto\n"
    + "2026-01-01,Comida,Comida,10.00,COP,5.00,-5.00\n"
    + "2026-01-02,Taxi,Viaje,20.00,,10.00,-10.00\n"
    + "2026-01-03,Error,Otros,8.00,COP,3.00,-2.00\n"
    + "Saldo total,,,,COP,15.00,-15.00\n";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/api/local/session?as=${encodeURIComponent(`${ownerName}@example.test`)}`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Grupo ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await page.getByRole("link", { name: "Importar Splitwise" }).click();
  await page.getByLabel("Archivo CSV").setInputFiles({ name: "grupo.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByText("1 movimientos válidos · 2 incidentes · 1 filas de resumen.")).toBeVisible();
  await page.locator('[name="mapping_0"]').selectOption({ label: `Soy yo (${ownerName})` });
  await page.locator('[name="decision_3"]').selectOption("assume_default");
  await page.locator('[name="decision_4"]').selectOption("exclude");
  await page.getByRole("button", { name: "Revisar saldos y decisiones" }).click();
  await expect(page.getByRole("heading", { name: "Así quedará el grupo" })).toBeVisible();
  await expect(page.getByText("Fila 3: Moneda COP elegida explícitamente")).toBeVisible();
  await expect(page.getByText("Fila 4: Los efectos de la fila no suman cero.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible();
  await page.getByRole("link", { name: "Ver el grupo" }).click();
  await page.getByLabel("Buscar").fill("Taxi");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Importado de Splitwise", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Taxi/ })).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("dos identidades crean, invitan, aceptan y quedan aisladas", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `invitee-${suffix}@example.test`;

  await page.goto("/demo/crear-grupo");
  await page.getByLabel("Nombre del grupo").fill(`Viaje ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await expect(page.getByRole("heading", { name: "Cuentas Claras está lista." })).toBeVisible();

  await page.getByLabel("Email").fill(invitee);
  await page.getByRole("button", { name: "Invitar" }).click();
  await expect(page.getByText(invitee)).toBeVisible();
  const groupUrl = page.url();

  await page.getByRole("link", { name: "Ver como invitada" }).click();
  await expect(page.getByText("Antes de aceptar no ves integrantes, movimientos ni saldos.")).toBeVisible();
  await expect(page.getByText("Participantes")).toHaveCount(0);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page.getByText("Integrante", { exact: true })).toBeVisible();

  const isolated = await page.request.get(`${new URL(groupUrl).pathname}?as=outsider-${suffix}%40example.test`);
  expect(isolated.status()).toBe(404);
});

test("una invitación se puede rechazar sin crear membresía", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const invitee = `reject-${suffix}@example.test`;

  await page.goto("/demo/crear-grupo");
  await page.getByLabel("Nombre del grupo").fill(`Casa ${suffix}`);
  await page.getByRole("button", { name: "Crear grupo" }).click();
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

  const created = await request.post("/api/local/groups", { headers: ownerHeaders, data: { name: `Grupo ${suffix}` } });
  expect(created.status()).toBe(201);
  const group = await created.json();
  const invited = await request.post(`/api/local/groups/${group.id}/invitations`, { headers: ownerHeaders, data: { email: invitee } });
  expect(invited.status()).toBe(201);
  const invitation = await invited.json();

  const denied = await request.delete(`/api/local/groups/${group.id}/invitations/${invitation.id}`, {
    headers: { "X-HomeSuite-Dev-Email": invitee },
  });
  expect(denied.status()).toBe(403);

  const canceled = await request.delete(`/api/local/groups/${group.id}/invitations/${invitation.id}`, { headers: ownerHeaders });
  expect(canceled.status()).toBe(204);
  const invitations = await request.get(`/api/local/groups/${group.id}/invitations`, { headers: ownerHeaders });
  await expect(invitations.json()).resolves.toEqual([{ id: invitation.id, email: invitee, status: "canceled" }]);
});
