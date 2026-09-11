import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  resetDb();
  // El polling se dispara explícitamente en las pruebas de concurrencia.
  await page.addInitScript(() => {
    const original = window.setInterval;
    window.setInterval = (fn, delay, ...args) => delay === 5000 ? 0 : original(fn, delay, ...args);
  });
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

function boardReads(page) {
  const reads = [];
  page.on("request", req => {
    if (req.method() === "GET" && /\/api\/boards\/[^/]+\/(cards|labels|goals)$/.test(new URL(req.url()).pathname)) {
      reads.push(new URL(req.url()).pathname);
    }
  });
  return reads;
}

async function newCard(page, title) {
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  return page.locator("#board .card", { hasText: title });
}

test("crear y editar usan la tarjeta confirmada sin recargar colecciones", async ({ page }) => {
  const reads = boardReads(page);
  const card = await newCard(page, "Guardado directo");
  await expect(card).toBeVisible();
  const id = await card.getAttribute("data-id");
  await card.click();
  await page.locator("#fTitle").fill("Guardado editado");
  await page.locator("#fColumn").selectOption("terminado");
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await expect(page.locator(`.cards[data-col="terminado"] .card[data-id="${id}"]`)).toContainText("Guardado editado");
  expect(reads).toEqual([]);
  const persisted = await (await page.request.get(`/api/cards/${id}`)).json();
  expect(persisted).toMatchObject({ title: "Guardado editado", column: "terminado" });
});

test("asignar, quitar y crear etiquetas actualiza tarjeta y catálogo sin recargas", async ({ page }) => {
  const reads = boardReads(page);
  const card = page.locator('.card[data-id="card-seed"]');
  await card.click();
  await page.locator(".add-label-btn").click();
  await page.locator(".label-picker .existing-label", { hasText: "Semilla" }).getByText("Agregar", { exact: true }).click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toContainText("Semilla");
  await expect(card.locator(".label-chip")).toContainText("Semilla");
  await page.locator("#fLabelsSection .label-in-card .remove").click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toHaveCount(0);
  await expect(card.locator(".label-chip")).toHaveCount(0);
  await page.locator(".add-label-btn").click();
  await page.locator("#newLabelName").fill("Etiqueta directa");
  await page.locator("#createLabelBtn").click();
  await expect(card.locator(".label-chip")).toContainText("Etiqueta directa");
  await page.locator("#fLabelsSection .label-in-card .remove").click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toHaveCount(0);
  await page.locator(".add-label-btn").click();
  await expect(page.locator(".label-picker .existing-label", { hasText: "Etiqueta directa" })).toBeVisible();
  expect(reads).toEqual([]);
  const persisted = await (await page.request.get("/api/cards/card-seed")).json();
  expect(persisted.labels).toEqual([]);
});

test("una etiqueta rechazada conserva el estado y permite reintentar", async ({ page }) => {
  const reads = boardReads(page);
  await page.locator('.card[data-id="card-seed"]').click();
  await page.locator(".add-label-btn").click();
  const endpoint = "**/api/cards/card-seed/labels/label-seed";
  await page.route(endpoint, route => route.fulfill({ status: 500, json: { error: "Fallo de prueba" } }));
  const dialog = page.waitForEvent("dialog");
  await page.locator(".existing-label", { hasText: "Semilla" }).getByText("Agregar", { exact: true }).click();
  await (await dialog).accept();
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await expect(page.locator("#fLabelsSection .label-in-card")).toHaveCount(0);
  await expect(page.locator('.card[data-id="card-seed"] .label-chip')).toHaveCount(0);
  await page.unroute(endpoint);
  await page.locator(".existing-label", { hasText: "Semilla" }).getByText("Agregar", { exact: true }).click();
  await expect(page.locator("#fLabelsSection .label-in-card")).toContainText("Semilla");
  expect(reads).toEqual([]);
});

test("un guardado rechazado mantiene el borrador sin inventar una tarjeta", async ({ page }) => {
  const reads = boardReads(page);
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill("Reintento");
  await page.route("**/api/boards/board-e2e/cards", route => route.request().method() === "POST"
    ? route.fulfill({ status: 500, json: { error: "Fallo de prueba" } }) : route.continue());
  const dialog = page.waitForEvent("dialog");
  await page.locator("#saveBtn").click();
  await (await dialog).accept();
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await expect(page.locator("#fTitle")).toHaveValue("Reintento");
  await expect(page.locator("#board .card", { hasText: "Reintento" })).toHaveCount(0);
  await page.unroute("**/api/boards/board-e2e/cards");
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await expect(page.locator("#board .card", { hasText: "Reintento" })).toHaveCount(1);
  expect(reads).toEqual([]);
});

test("una recarga anterior al guardado no lo pisa y el próximo poll trae cambios ajenos", async ({ page }) => {
  await page.request.post("/api/boards/board-e2e/cards", { data: { title: "Cambio de otra persona", column: "pendiente" } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let captured = false;
  await page.route("**/api/boards/board-e2e/cards", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    captured = true;
    await gate;
    await route.fulfill({ response });
  });
  await page.evaluate(() => { window.pendingPoll = window.pollTick(); });
  await expect.poll(() => captured).toBe(true);
  try {
    await newCard(page, "Cambio local");
  } finally {
    release();
  }
  await page.evaluate(() => window.pendingPoll);
  await expect(page.locator("#board .card", { hasText: "Cambio local" })).toHaveCount(1);
  await page.unroute("**/api/boards/board-e2e/cards");
  await page.evaluate(() => window.pollTick());
  await expect(page.locator("#board .card", { hasText: "Cambio de otra persona" })).toHaveCount(1);
  await expect(page.locator("#board .card", { hasText: "Cambio local" })).toHaveCount(1);
});

test("un guardado con adjuntos, checklist y objetivo relee sólo la tarjeta y actualiza progreso", async ({ page }) => {
  const response = await page.request.post("/api/boards/board-e2e/goals", { data: { title: "Objetivo directo" } });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator("#board .column")).toHaveCount(5);
  const reads = boardReads(page);
  const cardReads = [];
  page.on("request", req => {
    if (req.method() === "GET" && /\/api\/cards\/[^/]+$/.test(new URL(req.url()).pathname)) cardReads.push(req.url());
  });
  await page.locator('.add-card[data-col="terminado"]').click();
  await page.locator("#fTitle").fill("Tarjeta completa");
  await page.locator("#fFile").setInputFiles({ name: "prueba.txt", mimeType: "text/plain", buffer: Buffer.from("Prueba") });
  await page.locator(".add-checklist-btn").click();
  await page.locator(".checklist-add input").fill("Ítem confirmado");
  await page.locator(".checklist-add input").press("Enter");
  await page.locator('.checklist-item input[type="checkbox"]').check();
  await page.locator("#fGoalsSection .add-goal-btn").click();
  await page.locator(".goal-picker .existing-goal", { hasText: "Objetivo directo" }).getByText("Vincular", { exact: true }).click();
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  const card = page.locator("#board .card", { hasText: "Tarjeta completa" });
  await expect(card).toContainText("📎 1");
  await expect(card).toContainText("☑ 1/1");
  await expect(card).toContainText("🎯 1");
  expect(cardReads).toHaveLength(1);
  await card.click();
  await expect(page.locator("#fAttachments")).toContainText("prueba.txt");
  await expect(page.locator(".checklist-item-text")).toHaveValue("Ítem confirmado");
  await expect(page.locator('.checklist-item input[type="checkbox"]')).toBeChecked();
  await page.locator("#fColumn").selectOption("pendiente");
  await page.locator("#fAttachments .del").click();
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
  await expect(card.locator(".badge", { hasText: "📎" })).toHaveCount(0);
  expect(cardReads).toHaveLength(2);
  await page.locator("#goalsBtn").click();
  await expect(page.locator("#goalsDrawerList .goal-stats")).toContainText("0/1");
  expect(reads).toEqual([]);
});

test("una etiqueta lenta evita peticiones duplicadas y pausa el polling", async ({ page }) => {
  const reads = boardReads(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writes = 0, polls = 0;
  page.on("request", req => { if (req.url().endsWith("/version")) polls++; });
  await page.route("**/api/cards/card-seed/labels/label-seed", async route => {
    writes++;
    await gate;
    await route.continue();
  });
  await page.locator('.card[data-id="card-seed"]').click();
  await page.locator(".add-label-btn").click();
  try {
    await page.locator(".existing-label", { hasText: "Semilla" }).getByText("Agregar", { exact: true }).evaluate(el => {
      el.click(); el.click();
    });
    await expect.poll(() => writes).toBe(1);
    await expect(page.locator("#saveBtn")).toBeDisabled();
    await page.evaluate(() => window.pollTick());
    expect(polls).toBe(0);
  } finally { release(); }
  await expect(page.locator("#fLabelsSection .label-in-card")).toContainText("Semilla");
  await expect(page.locator("#saveBtn")).toBeEnabled();
  expect(writes).toBe(1);
  expect(reads).toEqual([]);
});

test("dos ticks simultáneos comparten una única consulta en curso", async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let polls = 0;
  await page.route("**/api/boards/board-e2e/version", async route => {
    polls++;
    await gate;
    await route.continue();
  });
  try {
    await page.evaluate(() => { window.pendingPolls = Promise.all([window.pollTick(), window.pollTick()]); });
    await expect.poll(() => polls).toBe(1);
  } finally { release(); }
  await page.evaluate(() => window.pendingPolls);
  expect(polls).toBe(1);
});

test("cambiar de tablero durante una escritura no mezcla tarjetas ni pierde la carga", async ({ page }) => {
  const other = await (await page.request.post("/api/boards", { data: { name: "Otro tablero" } })).json();
  await page.request.patch(`/api/boards/${other.id}`, { data: { themePromptSeen: true } });
  await page.reload();
  await expect(page.locator("#board .column")).toHaveCount(5);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writing = false;
  await page.route("**/api/cards/card-seed/labels/label-seed", async route => {
    writing = true;
    await gate;
    await route.continue();
  });
  try {
    await page.locator('.card[data-id="card-seed"]').click();
    await page.locator(".add-label-btn").click();
    await page.locator(".existing-label", { hasText: "Semilla" }).getByText("Agregar", { exact: true }).click();
    await expect.poll(() => writing).toBe(true);
    await page.locator("#cancelBtn").click();
    const members = page.waitForResponse(r => r.url().endsWith(`/boards/${other.id}/members`));
    await page.locator("#boardSelect").selectOption(other.id);
    await members;
  } finally { release(); }
  await expect(page.locator("#saveBtn")).toBeEnabled();
  await expect(page.locator("#board .card")).toHaveCount(0);
  await expect(page.locator("#board .column")).toHaveCount(5);
  await page.locator("#boardSelect").selectOption("board-e2e");
  await expect(page.locator('.card[data-id="card-seed"] .label-chip')).toContainText("Semilla");
});
