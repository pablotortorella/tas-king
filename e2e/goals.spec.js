import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const goalTitle = `E2E objetivo ${runId}`;
const cardTitle = `E2E tarjeta-objetivo ${runId}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("crea objetivo en el panel, lo amplía y refleja el progreso", async ({ page }) => {
  // 1. Crear una tarjeta en "Pendiente"
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(cardTitle);
  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: cardTitle })).toBeVisible();

  // 2. Abrir el panel y crear un objetivo
  await page.locator("#goalsBtn").click();
  await expect(page.locator("#goalsDrawer")).toHaveClass(/open/);
  await page.locator("#goalsDrawerList .new-goal-title").fill(goalTitle);
  await page.locator("#goalsDrawerList .new-goal-btn").click();
  await expect(page.locator("#goalsDrawerList .goal-card", { hasText: goalTitle })).toBeVisible();

  // 3. Ampliar a pantalla completa y verificar progreso inicial
  await page.locator("#goalsExpandBtn").click();
  await expect(page.locator("#goalsDrawer")).not.toHaveClass(/open/);
  await expect(page.locator("#goalsBoard")).toBeVisible();
  const goalCard = page.locator("#goalsBoard .goal-card", { hasText: goalTitle });
  await expect(goalCard.locator(".goal-stats")).toContainText("0/0");

  // 4. Volver al tablero, abrir la tarjeta y vincularla al objetivo
  await page.locator("#goalsBoard .goals-back-btn").click();
  await expect(page.locator("#board")).toBeVisible();
  await page.locator(".card", { hasText: cardTitle }).click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);
  await page.locator("#fGoalsSection .add-goal-btn").click();
  await page.locator(".goal-picker .existing-goal", { hasText: goalTitle }).locator("text=Vincular").click();
  await expect(page.locator("#fGoalsSection .goal-in-card")).toBeVisible({ timeout: 5000 });

  // 5. Mover la tarjeta a "Terminado" y guardar
  await page.locator("#fColumn").selectOption("terminado");
  await page.locator("#saveBtn").click();
  await expect(page.locator('.cards[data-col="terminado"] .card', { hasText: cardTitle })).toBeVisible();
  await expect(page.locator(".card", { hasText: cardTitle }).locator(".badge", { hasText: "🎯" })).toBeVisible();

  // 6. Reabrir la vista ampliada: progreso 1/1 (100%)
  await page.locator("#goalsBtn").click();
  await page.locator("#goalsExpandBtn").click();
  const updatedGoal = page.locator("#goalsBoard .goal-card", { hasText: goalTitle });
  await expect(updatedGoal.locator(".goal-stats")).toContainText("1/1");
  await expect(updatedGoal.locator(".goal-stats")).toContainText("100%");
  await page.locator("#goalsBoard .goals-back-btn").click();
});

test("panel lateral: selecciona objetivo y resalta sus tarjetas", async ({ page }) => {
  const panelGoal = `E2E panel ${runId}`;
  const linked = `E2E vinculada ${runId}`;
  const other = `E2E otra ${runId}`;

  // Dos tarjetas en "Pendiente"
  for (const t of [linked, other]) {
    await page.locator('.add-card[data-col="pendiente"]').click();
    await page.locator("#fTitle").fill(t);
    await page.locator("#saveBtn").click();
    await expect(page.locator(".card", { hasText: t })).toBeVisible();
  }

  // Abrir el panel lateral (el tablero sigue visible)
  await page.locator("#goalsBtn").click();
  await expect(page.locator("#goalsDrawer")).toHaveClass(/open/);
  await expect(page.locator("body")).toHaveClass(/drawer-open/);
  await expect(page.locator("#board")).toBeVisible();

  // Crear un objetivo desde el panel
  await page.locator("#goalsDrawerList .new-goal-title").fill(panelGoal);
  await page.locator("#goalsDrawerList .new-goal-btn").click();
  await expect(page.locator("#goalsDrawerList .goal-card", { hasText: panelGoal })).toBeVisible();

  // Vincular SOLO una de las tarjetas al objetivo
  await page.locator(".card", { hasText: linked }).click();
  await page.locator("#fGoalsSection .add-goal-btn").click();
  await page.locator(".goal-picker .existing-goal", { hasText: panelGoal }).locator("text=Vincular").click();
  await expect(page.locator("#fGoalsSection .goal-in-card")).toBeVisible();
  await page.locator("#cancelBtn").click();

  // Seleccionar el objetivo en el panel → resalta la vinculada y atenúa la otra
  await page.locator("#goalsDrawerList .goal-card", { hasText: panelGoal }).click();
  await expect(page.locator(".card", { hasText: linked })).toHaveClass(/card-goal-match/);
  await expect(page.locator(".card", { hasText: other })).toHaveClass(/card-dimmed/);

  // Cerrar el panel limpia el resaltado
  await page.locator("#goalsDrawerClose").click();
  await expect(page.locator("#goalsDrawer")).not.toHaveClass(/open/);
  await expect(page.locator(".card", { hasText: other })).not.toHaveClass(/card-dimmed/);
});
