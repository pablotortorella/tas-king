import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.describe.configure({ mode: "serial" });
const member = "sync-member@test.local";

test.beforeEach(async ({ page }) => {
  resetDb();
  await page.addInitScript(() => {
    const original = window.setInterval;
    window.setInterval = (fn, delay, ...args) => delay === 5000 ? 0 : original(fn, delay, ...args);
  });
  // Escrituras como otro miembro; el navegador observa con su cuenta original.
  const invite = await page.request.post("/api/boards/board-e2e/members", { data: { email: member } });
  expect(invite.ok()).toBe(true);
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

async function remote(page, method, path, data) {
  const res = await page.request.fetch(path, { method, data, headers: { "X-Dev-User": member } });
  expect(res.ok()).toBe(true);
  return res.json();
}
const poll = page => page.evaluate(() => window.pollTick());
const seedCard = page => page.locator('#board .card[data-id="card-seed"]');

test("comentarios ajenos aparecen y desaparecen en tablero y modal sin perder el borrador", async ({ page }) => {
  await seedCard(page).click();
  await page.locator("#fTitle").fill("Título que estoy redactando");
  await page.locator("#fCommentInput").fill("Comentario todavía sin enviar");
  const cm = await remote(page, "POST", "/api/cards/card-seed/comments", { text: "Comentario de otra persona" });
  await poll(page);
  await expect(seedCard(page)).toContainText("💬 1");
  await expect(page.locator("#fComments")).toContainText("Comentario de otra persona");
  await expect(page.locator("#fTitle")).toHaveValue("Título que estoy redactando");
  await expect(page.locator("#fCommentInput")).toHaveValue("Comentario todavía sin enviar");
  await remote(page, "DELETE", `/api/comments/${cm.id}`);
  await poll(page);
  await expect(seedCard(page)).not.toContainText("💬");
  await expect(page.locator("#fComments .comment")).toHaveCount(0);
});

test("checklists ajenos se sincronizan al crear, marcar y borrar sin recargar la página", async ({ page }) => {
  await seedCard(page).click();
  const cl = await remote(page, "POST", "/api/cards/card-seed/checklists", { name: "Lista compartida" });
  const item = await remote(page, "POST", `/api/checklists/${cl.id}/items`, { text: "Paso remoto" });
  await poll(page);
  await expect(seedCard(page)).toContainText("☑ 0/1");
  await expect(page.locator(".checklist-name")).toHaveValue("Lista compartida");
  await expect(page.locator(".checklist-item-text")).toHaveValue("Paso remoto");
  await remote(page, "PUT", `/api/checklist-items/${item.id}`, { checked: true });
  await poll(page);
  await expect(seedCard(page)).toContainText("☑ 1/1");
  await expect(page.locator(".checklist-item input[type=checkbox]")).toBeChecked();
  await remote(page, "DELETE", `/api/checklists/${cl.id}`);
  await poll(page);
  await expect(seedCard(page)).not.toContainText("☑");
  await expect(page.locator(".checklist-section")).toHaveCount(0);
});

test("el polling conserva el texto de un ítem en edición y aplica lo pendiente al salir", async ({ page }) => {
  const cl = await remote(page, "POST", "/api/cards/card-seed/checklists", { name: "Lista" });
  const item = await remote(page, "POST", `/api/checklists/${cl.id}/items`, { text: "Original" });
  await poll(page);
  await seedCard(page).click();
  const input = page.locator(".checklist-add input");
  await input.fill("Siguiente paso sin enviar");
  await remote(page, "PUT", `/api/checklist-items/${item.id}`, { checked: true });
  await poll(page);
  await expect(input).toHaveValue("Siguiente paso sin enviar");
  await expect(input).toBeFocused();
  // Salir de la sección no debe perder un ítem nuevo todavía sin enviar.
  await page.locator("#fTitle").focus();
  await poll(page);
  await expect(input).toHaveValue("Siguiente paso sin enviar");
  await expect(page.locator(".checklist-item input[type=checkbox]")).toBeChecked();
});

test("borrar tarjetas antiguas, recientes y la última se refleja en el otro usuario", async ({ page }) => {
  const second = await remote(page, "POST", "/api/boards/board-e2e/cards", { title: "Segunda", column: "pendiente" });
  const third = await remote(page, "POST", "/api/boards/board-e2e/cards", { title: "Tercera", column: "pendiente" });
  await poll(page);
  await expect(page.locator("#board .card")).toHaveCount(3);
  for (const [id, remaining] of [["card-seed", 2], [third.id, 1], [second.id, 0]]) {
    await remote(page, "DELETE", `/api/cards/${id}`);
    await poll(page);
    await expect(page.locator(`#board .card[data-id="${id}"]`)).toHaveCount(0);
    await expect(page.locator("#board .card")).toHaveCount(remaining);
  }
  // Un tablero sin nuevos cambios no vuelve a descargar sus colecciones.
  const reads = [];
  page.on("request", req => { if (/\/boards\/[^/]+\/(cards|labels|goals)$/.test(req.url())) reads.push(req.url()); });
  await poll(page);
  expect(reads).toEqual([]);
});

test("también reconcilia una revisión menor, por ejemplo después de restaurar datos", async ({ page }) => {
  const { version } = await (await page.request.get("/api/boards/board-e2e/version")).json();
  await remote(page, "PUT", "/api/cards/card-seed", { title: "Datos restaurados" });
  await page.route("**/api/boards/board-e2e/version", route => route.fulfill({ json: { version: version - 1 } }));
  await poll(page);
  await expect(seedCard(page)).toContainText("Datos restaurados");
});
