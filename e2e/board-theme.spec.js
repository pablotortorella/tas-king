import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);

async function createBoard(page, name) {
  page.once("dialog", dialog => dialog.accept(name));
  await page.click("#newBoardBtn");
  await expect(page.locator("#board .column").first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#board .column", { timeout: 10000 });
});

test("el prompt de bienvenida aparece para el dueño en un tablero nuevo, elegir una paleta la aplica y persiste", async ({ page }) => {
  await createBoard(page, `E2E Theme Prompt ${runId}`);

  const prompt = page.locator("#themePromptOverlay");
  await expect(prompt).toHaveClass(/open/);

  await page.locator("#themePromptGrid .theme-opt", { hasText: "Sunset Pop" }).click();
  await expect(prompt).not.toHaveClass(/open/);
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sunset_pop");

  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("#themePromptOverlay")).not.toHaveClass(/open/);
  await expect(page.locator("html")).toHaveAttribute("data-palette", "sunset_pop");
});

test("omitir el prompt deja Candy Pop y no vuelve a aparecer", async ({ page }) => {
  await createBoard(page, `E2E Theme Skip ${runId}`);

  const prompt = page.locator("#themePromptOverlay");
  await expect(prompt).toHaveClass(/open/);

  await page.locator("#themePromptSkipBtn").click();
  await expect(prompt).not.toHaveClass(/open/);
  await expect(page.locator("html")).toHaveAttribute("data-palette", "candy_pop");

  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("#themePromptOverlay")).not.toHaveClass(/open/);
});

test("⚙️ → Tema permite al dueño cambiar la paleta de un tablero existente y persiste", async ({ page }) => {
  await createBoard(page, `E2E Theme Settings ${runId}`);
  await page.locator("#themePromptSkipBtn").click();
  await expect(page.locator("#themePromptOverlay")).not.toHaveClass(/open/);

  await page.click("#membersBtn");
  await page.click("#settingsTabTema");
  const grid = page.locator("#boardThemeGrid");
  await expect(grid.locator(".theme-opt.sel")).toContainText("Candy Pop");

  await grid.locator(".theme-opt", { hasText: "Jungle Pop" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "jungle_pop");
  await expect(grid.locator(".theme-opt.sel")).toContainText("Jungle Pop");

  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "jungle_pop");
});
