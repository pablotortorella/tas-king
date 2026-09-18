import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

// F1 abría la ayuda y dejaba el teclado sin salida.
//
// Son dos cosas que se combinan: el handler global corta con
// `if (document.querySelector(".overlay.open")) return;` —y la ayuda es un
// .overlay—, así que con la ayuda abierta mueren F, U, N y los filtros por
// número. Y Esc no la cerraba: el `return` de `if (helpOpen)` dejaba
// inalcanzable el chequeo que venía después, código muerto con su comentario
// «Esc: cerrar ayuda» incluido.
//
// Que un overlay modal bloquee los atajos está bien y es deliberado. El bug es
// que no hubiera forma de salir sin ir al mouse.

test.beforeAll(() => { resetDb(); });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

test("Esc cierra la ayuda", async ({ page }) => {
  const help = page.locator("#helpModal");

  await page.keyboard.press("F1");
  await expect(help).toHaveClass(/open/);

  await page.keyboard.press("Escape");
  await expect(help).not.toHaveClass(/open/);
});

test("después de cerrar la ayuda con Esc, los atajos vuelven a funcionar", async ({ page }) => {
  // Este es el síntoma que se ve de verdad: el teclado queda muerto.
  await page.keyboard.press("F1");
  await expect(page.locator("#helpModal")).toHaveClass(/open/);

  await page.keyboard.press("Escape");
  await expect(page.locator("#helpModal")).not.toHaveClass(/open/);

  await page.keyboard.press("u");
  await expect(page.locator("#urgentBtn")).toHaveClass(/urgent-on/);
});

test("el botón Cerrar sigue cerrando la ayuda", async ({ page }) => {
  await page.keyboard.press("F1");
  await expect(page.locator("#helpModal")).toHaveClass(/open/);
  await page.locator("#helpCloseBtn").click();
  await expect(page.locator("#helpModal")).not.toHaveClass(/open/);
});

test("con la ayuda abierta los atajos siguen bloqueados", async ({ page }) => {
  // No es un efecto colateral del bug: es el comportamiento correcto de un
  // overlay modal, y el fix no debe cambiarlo.
  await page.keyboard.press("F1");
  await expect(page.locator("#helpModal")).toHaveClass(/open/);

  await page.keyboard.press("u");
  await expect(page.locator("#urgentBtn")).not.toHaveClass(/urgent-on/);
});

test("Esc cierra la ayuda antes que la tarjeta que haya debajo", async ({ page }) => {
  // F1 funciona incluso con una tarjeta abierta, así que la ayuda puede quedar
  // encima. El primer Esc cierra la de arriba.
  await page.locator('.add-card[data-col="pendiente"]').click();
  await expect(page.locator("#overlay")).toHaveClass(/open/);

  await page.keyboard.press("F1");
  await expect(page.locator("#helpModal")).toHaveClass(/open/);

  await page.keyboard.press("Escape");
  await expect(page.locator("#helpModal")).not.toHaveClass(/open/);
  await expect(page.locator("#overlay")).toHaveClass(/open/);

  await page.keyboard.press("Escape");
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);
});
