import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

// El tip del día: una franja quieta encima del pie, con el consejo de la jornada.
// El avance vive en la cuenta (no en el navegador), así que recargar no lo mueve.

test("el tip aparece al abrir el tablero, con texto y sin control de descarte", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();

  const franja = page.locator("#tipDaily");
  await expect(franja).toBeVisible();
  await expect(page.locator("#tipText")).not.toBeEmpty();
  await expect(franja.locator("button")).toHaveCount(0);

  // Está encima del pie, no adentro.
  await expect(page.locator(".app-footer #tipDaily")).toHaveCount(0);
  const tip = await franja.boundingBox();
  const pie = await page.locator(".app-footer").boundingBox();
  expect(tip.y + tip.height).toBeLessThanOrEqual(pie.y + 1);
});

test("el mismo tip persiste tras recargar el mismo día", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#tipDaily")).toBeVisible();
  const antes = await page.locator("#tipText").textContent();

  await page.reload();
  await expect(page.locator("#tipDaily")).toBeVisible();
  expect(await page.locator("#tipText").textContent()).toBe(antes);
});

test("al día siguiente avanza al tip que sigue", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#tipDaily")).toBeVisible();
  const ayer = await page.locator("#tipText").textContent();

  // El backend resuelve el avance con la fecha que manda el navegador, así que
  // alcanza con pedir otra jornada para simular el día siguiente sin tocar el reloj.
  // Cualquier fecha distinta de la guardada avanza uno: no hay forma de saltear tips.
  await page.evaluate(() => fetch("/api/me?today=2099-01-02"));
  await page.reload();
  await expect(page.locator("#tipDaily")).toBeVisible();
  const hoy = await page.locator("#tipText").textContent();
  expect(hoy).not.toBe(ayer);

  // Y lo que se ve en pantalla es exactamente el tip que el backend dice que toca.
  const { indice, catalogo } = await page.evaluate(async () => {
    const dos = n => String(n).padStart(2, "0");
    const d = new Date();
    const fecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    const r = await fetch("/api/me?today=" + fecha);   // misma jornada: no avanza
    return { indice: (await r.json()).tipIndex, catalogo: window.DAILY_TIPS };
  });
  expect(hoy).toBe(catalogo[indice % catalogo.length]);
});

test("el realce ocurre una sola vez por día", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();
  const franja = page.locator("#tipDaily");
  await expect(franja).not.toHaveClass(/tip-blink/);

  // Primera interacción del día con el tablero → titila.
  await page.locator("#board").click({ position: { x: 5, y: 5 } });
  await expect(franja).toHaveClass(/tip-blink/);

  // Ya gastó el titileo del día: recargar y volver a interactuar no lo repite.
  await page.reload();
  await expect(page.locator("#board .column").first()).toBeVisible();
  await page.locator("#board").click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  await expect(page.locator("#tipDaily")).not.toHaveClass(/tip-blink/);
});

test("en 360px el tip se lee completo y los atajos de teclado se ocultan", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(page.locator("#tipDaily")).toBeVisible();

  await expect(page.locator(".app-footer .shortcuts")).toBeHidden();

  // Sin truncado: el texto entra completo en la caja, envolviendo las líneas que necesite.
  const { desborde, lineas } = await page.evaluate(() => {
    const el = document.getElementById("tipText");
    const alturaLinea = parseFloat(getComputedStyle(el).lineHeight);
    return {
      desborde: el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1,
      lineas: Math.round(el.scrollHeight / alturaLinea),
    };
  });
  expect(desborde).toBe(false);
  expect(lineas).toBeLessThanOrEqual(3);

  // El tablero sigue usable: no hay scroll horizontal de página.
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
});

test("con movimiento reducido el tip se ve completo y sin animación", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#board .column").first()).toBeVisible();
  await expect(page.locator("#tipDaily")).toBeVisible();
  await expect(page.locator("#tipText")).not.toBeEmpty();

  await page.locator("#board").click({ position: { x: 5, y: 5 } });
  // La clase puede aplicarse igual; lo que no debe haber es animación. El realce
  // es refuerzo: sin él, el tip sigue estando visible y legible.
  const animacion = await page.evaluate(() =>
    getComputedStyle(document.getElementById("tipDaily")).animationName);
  expect(animacion).toBe("none");
});
