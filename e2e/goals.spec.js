import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const goalTitle = `E2E objetivo ${runId}`;
const cardTitle = `E2E tarjeta-objetivo ${runId}`;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("crea objetivo, vincula tarjeta y refleja el progreso", async ({ page }) => {
  // 1. Crear una tarjeta en "Pendiente"
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(cardTitle);
  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: cardTitle })).toBeVisible();

  // 2. Ir a la vista de Objetivos y crear uno
  await page.locator("#viewGoalsBtn").click();
  await expect(page.locator("#goalsBoard")).toBeVisible();
  await page.locator("#newGoalTitle").fill(goalTitle);
  await page.locator("#createGoalBtn").click();

  const goalCard = page.locator(".goal-card", { hasText: goalTitle });
  await expect(goalCard).toBeVisible();
  // Sin tarjetas vinculadas todavía
  await expect(goalCard.locator(".goal-stats")).toContainText("0/0");

  // 3. Volver a Tareas, abrir la tarjeta y vincularla al objetivo
  await page.locator("#viewTasksBtn").click();
  await page.locator(".card", { hasText: cardTitle }).click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);

  await page.locator("#fGoalsSection .add-goal-btn").click();
  await expect(page.locator(".goal-picker")).toBeVisible();
  const row = page.locator(".goal-picker .existing-goal", { hasText: goalTitle });
  await row.locator("text=Vincular").click();

  // El chip del objetivo queda visible en la tarjeta
  await expect(page.locator("#fGoalsSection .goal-in-card")).toBeVisible({ timeout: 5000 });

  // 4. Mover la tarjeta a "Terminado" y guardar
  await page.locator("#fColumn").selectOption("terminado");
  await page.locator("#saveBtn").click();
  await expect(page.locator('.cards[data-col="terminado"] .card', { hasText: cardTitle })).toBeVisible();

  // El badge 🎯 aparece en la tarjeta del Kanban
  await expect(page.locator(".card", { hasText: cardTitle }).locator(".badge", { hasText: "🎯" })).toBeVisible();

  // 5. El progreso del objetivo ahora es 1/1 (100%)
  await page.locator("#viewGoalsBtn").click();
  const updatedGoal = page.locator(".goal-card", { hasText: goalTitle });
  await expect(updatedGoal.locator(".goal-stats")).toContainText("1/1");
  await expect(updatedGoal.locator(".goal-stats")).toContainText("100%");

  // 6. Eliminar el objetivo (acepta el confirm)
  page.once("dialog", dialog => dialog.accept());
  await updatedGoal.locator('[data-act="delete"]').click();
  await expect(page.locator(".goal-card", { hasText: goalTitle })).toHaveCount(0);
});
