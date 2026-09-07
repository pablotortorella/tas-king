import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

const revokedResponse = {
  status: 403,
  contentType: "application/json",
  body: JSON.stringify({
    error: "Tu acceso a este tablero fue revocado. Si creés que es un error, contactá al administrador.",
    code: "access_revoked",
  }),
};

// El backend real ya está cubierto por test/access-revocation.test.js (re-chequeo de
// allowed_emails con una cookie de sesión real). Acá se testea el lado del navegador:
// que cualquier respuesta 403 con code:"access_revoked" (venga de la carga inicial o de
// una llamada de fondo como el poll) haga que la app navegue a /revoked.html en vez de
// mostrar el error genérico o quedarse trabada en un catch silencioso.
test("una respuesta access_revoked en la carga inicial redirige a /revoked.html", async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill(revokedResponse));
  await page.goto("/");

  await expect(page).toHaveURL(/\/revoked$/);
  await expect(page.locator("h1")).toContainText("Acceso revocado");
});

test("una respuesta access_revoked durante el poll de fondo también redirige", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);

  await page.route("**/version", route => route.fulfill(revokedResponse));
  // No se espera la promesa: api() nunca la resuelve cuando redirige (a propósito, para
  // que ningún catch de arriba llegue a correr) — awaitearla acá colgaría el test.
  await page.evaluate(() => { window.pollTick(); });

  await expect(page).toHaveURL(/\/revoked$/);
});
