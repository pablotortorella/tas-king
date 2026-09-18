import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

// Tests de caracterización, en el sentido de Feathers: documentan lo que el
// código HACE HOY, no lo que debería hacer. Existen como red de seguridad para
// el refactor que saca las 3.215 líneas de JS de index.html a módulos: cubren los
// flujos que el inventario de cobertura mostró a ciegas (menú IO y exportar,
// tabs Stats y Solicitudes del admin, perfil, ayuda y paneo del tablero).
//
// Si alguno de estos falla después de mover código, el refactor cambió
// comportamiento — que es exactamente lo que no debe pasar.

test.beforeAll(() => { resetDb(); });
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

// ---------- Menú IO y exportación ----------

test("el menú Datos abre, cierra al clickear afuera y refleja aria-expanded", async ({ page }) => {
  const ioBtn = page.locator("#ioBtn");
  const ioPanel = page.locator("#ioPanel");

  await expect(ioBtn).toHaveAttribute("aria-expanded", "false");
  await expect(ioPanel).not.toHaveClass(/open/);

  await ioBtn.click();
  await expect(ioPanel).toHaveClass(/open/);
  await expect(ioBtn).toHaveAttribute("aria-expanded", "true");

  // Un click fuera del menú lo cierra.
  await page.locator("#board").click({ position: { x: 5, y: 5 } });
  await expect(ioPanel).not.toHaveClass(/open/);
  await expect(ioBtn).toHaveAttribute("aria-expanded", "false");
});

test("exportar CSV descarga un archivo con las tarjetas del tablero", async ({ page }) => {
  await page.locator("#ioBtn").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportCsvBtn").click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^tablero-\d{4}-\d{2}-\d{2}\.csv$/);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf-8");

  // No se afirma el contenido de las filas: se afirma la forma, que es lo que el
  // refactor no debe alterar. El BOM inicial es deliberado en el código actual
  // (hace que Excel abra el archivo en UTF-8), así que también se documenta.
  expect(csv.startsWith("\ufeff")).toBe(true);
  expect(csv.replace(/^\ufeff/, "").split("\n")[0].trim())
    .toBe("Name,Status,Details,Due,Comments,Archived");
});

test("exportar JSON descarga el estado del tablero", async ({ page }) => {
  await page.locator("#ioBtn").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportBtn").click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^tablero-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

  expect(Array.isArray(data.cards)).toBe(true);
});

// ---------- Panel de administración: tabs sin cobertura ----------

test("el tab Stats del admin muestra los contadores", async ({ page }) => {
  await page.locator("#adminBtn").click();
  await expect(page.locator("#adminOverlay")).toHaveClass(/open/);

  await page.locator("#adminTabStats").click();
  await expect(page.locator("#adminTabStats")).toHaveClass(/active/);
  await expect(page.locator("#adminPanelStats")).toBeVisible();

  // El panel se llena por fetch; esperar a que deje de estar vacío.
  await expect(page.locator("#adminPanelStats")).not.toBeEmpty();
});

test("el tab Solicitudes del admin se abre y renderiza su lista", async ({ page }) => {
  await page.locator("#adminBtn").click();
  await page.locator("#adminTabSolicitudes").click();

  await expect(page.locator("#adminTabSolicitudes")).toHaveClass(/active/);
  await expect(page.locator("#adminPanelSolicitudes")).toBeVisible();
  await expect(page.locator("#adminPendingList")).not.toBeEmpty();

  await page.locator("#adminCloseBtn").click();
  await expect(page.locator("#adminOverlay")).not.toHaveClass(/open/);
});

// ---------- Modal de perfil ----------

test("el perfil guarda nombre y emoji, y persisten tras recargar", async ({ page }) => {
  const nombre = `E2E Perfil ${Date.now().toString(36)}`;

  await page.locator("#profileBtn").click();
  await expect(page.locator("#profileOverlay")).toHaveClass(/open/);
  await expect(page.locator("#profileEmail")).not.toBeEmpty();

  await page.locator("#profileName").fill(nombre);
  await page.locator("#profileEmoji").fill("🦊");
  await page.locator("#profileSaveBtn").click();

  await expect(page.locator("#profileOverlay")).not.toHaveClass(/open/);

  await page.reload();
  // Esperar a que la sesión esté cargada antes de abrir el perfil: openProfile()
  // lee estado.me, y si se hace clic antes lanza y el modal no abre. En una
  // máquina rápida no se nota; en CI sí, y por eso este test falló ahí.
  await expect(page.locator("#board .column")).toHaveCount(5);
  await page.locator("#profileBtn").click();
  await expect(page.locator("#profileName")).toHaveValue(nombre);
  await expect(page.locator("#profileEmoji")).toHaveValue("🦊");
});

test("cancelar el perfil no guarda los cambios", async ({ page }) => {
  await page.locator("#profileBtn").click();
  const original = await page.locator("#profileName").inputValue();

  await page.locator("#profileName").fill("No debería guardarse");
  await page.locator("#profileCancelBtn").click();
  await expect(page.locator("#profileOverlay")).not.toHaveClass(/open/);

  await page.reload();
  await expect(page.locator("#board .column")).toHaveCount(5);
  await page.locator("#profileBtn").click();
  await expect(page.locator("#profileName")).toHaveValue(original);
});

// ---------- Modal de ayuda ----------

test("F1 abre la ayuda y el botón Cerrar la cierra", async ({ page }) => {
  const help = page.locator("#helpModal");
  await expect(help).not.toHaveClass(/open/);

  await page.keyboard.press("F1");
  await expect(help).toHaveClass(/open/);
  await expect(help.locator("h2")).toContainText("Atajos de teclado");

  await page.locator("#helpCloseBtn").click();
  await expect(help).not.toHaveClass(/open/);
});

// Nota deliberada: NO se afirma qué hace Escape con la ayuda abierta. Hoy no la
// cierra —hay código muerto para eso en el handler global de teclas, listado en
// docs/PRODUCT_BACKLOG.md como bug conocido—. Afirmar el comportamiento actual
// dejaría el bug congelado en un test; afirmar el correcto rompería la red de
// seguridad antes de arreglarlo. Cuando se corrija, el test va con el fix.

// ---------- Paneo del tablero ----------

test("arrastrar el fondo del tablero lo desplaza", async ({ page }) => {
  const board = page.locator("#board");
  const posicionInicial = await board.evaluate((el) => el.scrollLeft);

  const box = await board.boundingBox();
  // Arrancar en una zona vacía del tablero, no sobre una tarjeta.
  const startX = box.x + box.width - 20;
  const startY = box.y + box.height - 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 120, startY, { steps: 10 });
  await page.mouse.up();

  const posicionFinal = await board.evaluate((el) => el.scrollLeft);
  expect(posicionFinal).not.toBe(posicionInicial);
});

// ---------- Arranque del tema (anti-flash) ----------

test("el script anti-flash sigue siendo clásico y bloqueante en el head", async ({ page }) => {
  // El parpadeo claro->oscuro vuelve si este script pasa a `defer`, `async` o
  // `type="module"`: en cualquiera de esos casos corre después del parseo, o sea
  // después del primer pintado. Esta regresión existe para que el refactor a
  // módulos ES no se lo lleve puesto por uniformidad. Ver ADR-017.
  const boot = page.locator('head script[src="/js/theme-boot.js"]');
  await expect(boot).toHaveCount(1);

  const attrs = await boot.evaluate((el) => ({
    defer: el.defer,
    async: el.async,
    type: el.getAttribute("type"),
    // ¿Viene antes de la hoja de estilos?
    antesDelCss: !!(el.compareDocumentPosition(document.querySelector('link[rel="stylesheet"]'))
      & Node.DOCUMENT_POSITION_FOLLOWING),
  }));

  expect(attrs.defer).toBe(false);
  expect(attrs.async).toBe(false);
  expect(attrs.type).toBeNull();
  expect(attrs.antesDelCss).toBe(true);
});

// ---------- Actividad del tablero: el render de una entrada ----------

test("la actividad del admin renderiza entradas con avatar del autor", async ({ page }) => {
  // Este test existe por un bug concreto: al extraer admin.js, renderActivity
  // quedó usando avatarHtml sin importarlo. La suite siguió en verde porque
  // ningún test llegaba a esa rama — solo se ejecuta cuando HAY actividad, y
  // los tests que abrían el tab no garantizaban que la hubiera.
  //
  // Por eso acá se genera actividad primero y se afirma el contenido de una
  // entrada, no solo que el panel esté visible.
  const titulo = `E2E actividad ${Date.now().toString(36)}`;
  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(titulo);
  await page.locator("#saveBtn").click();
  await expect(page.locator("#overlay")).not.toHaveClass(/open/);

  await page.locator("#adminBtn").click();
  await expect(page.locator("#adminTabActividad")).toHaveClass(/active/);

  const entradas = page.locator("#adminActivityList .activity-entry");
  await expect(entradas.first()).toBeVisible();

  // El avatar del autor: es lo que rompía sin el import.
  await expect(entradas.first().locator(".avatar")).toBeVisible();
  await expect(page.locator("#adminActivityList")).toContainText(titulo);
});
