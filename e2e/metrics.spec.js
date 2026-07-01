import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

test("botón 📊 Métricas visible en header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("#metricsBtn")).toBeVisible();
});

test("al hacer click, panel desliza y muestra todas las secciones", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  await page.locator("#metricsBtn").click();
  await expect(page.locator("#metricsDrawer")).toHaveClass(/open/);

  await expect(page.locator("#mToday")).toBeVisible();
  await expect(page.locator("#mWeek")).toBeVisible();
  await expect(page.locator("#mMonth")).toBeVisible();
  await expect(page.locator("#mLeadAvg")).toBeVisible();
  await expect(page.locator("#metricsBurnupWrap")).toBeVisible();
  await expect(page.locator("#metricsWipWrap")).toBeVisible();
  await expect(page.locator("#metricsStaleList")).toBeVisible();
});

test("números de completadas son >= 0 tras cargar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  await page.locator("#metricsBtn").click();
  await expect(page.locator("#metricsDrawer")).toHaveClass(/open/);

  // Esperar que carguen (dejan de ser "-")
  await page.waitForFunction(() => document.getElementById("mToday").textContent !== "-", { timeout: 5000 });

  const today = parseInt(await page.locator("#mToday").textContent(), 10);
  const week  = parseInt(await page.locator("#mWeek").textContent(), 10);
  const month = parseInt(await page.locator("#mMonth").textContent(), 10);

  expect(today).toBeGreaterThanOrEqual(0);
  expect(week).toBeGreaterThanOrEqual(0);
  expect(month).toBeGreaterThanOrEqual(0);
});

test("botón cerrar oculta el panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  await page.locator("#metricsBtn").click();
  await expect(page.locator("#metricsDrawer")).toHaveClass(/open/);

  await page.locator("#metricsDrawerClose").click();
  await expect(page.locator("#metricsDrawer")).not.toHaveClass(/open/);
});
