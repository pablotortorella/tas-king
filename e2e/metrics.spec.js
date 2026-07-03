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

function isoPlusDays(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

test("tarjeta con vencimiento lejano no aparece como quieta; una por vencer sí aparece en Por vencer", async ({ page }) => {
  const runId = Date.now().toString(36);
  const farTitle  = `E2E vence lejos ${runId}`;
  const soonTitle = `E2E vence pronto ${runId}`;

  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  // Tarjeta con vencimiento muy lejano: no debe figurar en "Quietas".
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(farTitle);
  await page.locator("#fDue").fill(isoPlusDays(60));
  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: farTitle })).toBeVisible();

  // Tarjeta que vence mañana: debe figurar en "Por vencer".
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(soonTitle);
  await page.locator("#fDue").fill(isoPlusDays(1));
  await page.locator("#saveBtn").click();
  await expect(page.locator(".card", { hasText: soonTitle })).toBeVisible();

  await page.locator("#metricsBtn").click();
  await expect(page.locator("#metricsDrawer")).toHaveClass(/open/);

  await expect(page.locator("#metricsStaleList .stale-item", { hasText: farTitle })).toHaveCount(0);
  await expect(page.locator("#metricsDueSoonList .stale-item", { hasText: soonTitle })).toBeVisible();
});

test("⚙️ permite configurar los días de anticipación de Por vencer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  await page.locator("#membersBtn").click();
  await expect(page.locator("#membersOverlay")).toHaveClass(/open/);

  const input = page.locator("#dueSoonInput");
  await expect(input).toBeVisible();
  await input.fill("10");
  await page.locator("#dueSoonBtn").click();

  await page.locator("#membersCloseBtn").click();
  await page.locator("#membersBtn").click();
  await expect(page.locator("#dueSoonInput")).toHaveValue("10");
});
