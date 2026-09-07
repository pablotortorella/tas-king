import { expect, test } from "@playwright/test";
import { resetDb } from "./helpers/reset-db.js";

test.beforeAll(() => { resetDb(); });

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#board .column")).toHaveCount(5);
});

// Regresión: si el polling de fondo (cada 5s) cae justo a mitad de un arrastre, loadCards()
// hace board.innerHTML = "" y reconstruye todas las tarjetas mientras cardDrag sigue moviendo
// el nodo viejo (ahora huérfano) con el mouse. El próximo pointermove reinserta ese nodo
// huérfano junto al nuevo ya renderizado — misma tarjeta, dos elementos en el DOM — y al
// soltar, rebuildOrderFromDom() los contaba dos veces. Se autocorregía en el siguiente poll
// (por eso el bug se veía "un instante" y desaparecía solo). Usa window.pollTick() (hook de
// test) para forzar el tick sin depender del timer real de 5s.
test("un poll de fondo a mitad de un arrastre no deja la tarjeta duplicada", async ({ page }) => {
  const title = `E2E drag-dup ${runId}`;

  await page.locator('.add-card[data-col="pendiente"]').click();
  await page.locator("#fTitle").fill(title);
  await page.locator("#saveBtn").click();

  const card = page.locator(".card", { hasText: title });
  await expect(card).toBeVisible();
  const cardId = await card.getAttribute("data-id");

  // Simula un cambio ajeno al tablero (otra pestaña, otro usuario) mientras se arrastra —
  // es lo que hace que la próxima consulta de versión dispare loadCards().
  await page.request.post("/api/boards/board-e2e/cards", {
    data: { title: `E2E drag-dup bump ${runId}`, column: "pendiente" },
  });

  const reorderResponse = page.waitForResponse(resp => resp.url().includes("/reorder"), { timeout: 10000 });

  // El conteo se captura DENTRO del mismo evaluate, justo después del pointerup — el bug se
  // autocorrige solo en el próximo poll real (por eso en producción "esperando un instante" se
  // arregla), así que medir con un expect(...).toHaveCount() con reintentos (que espera hasta 5s,
  // el mismo intervalo del poll) enmascararía el problema en lugar de detectarlo.
  const countRightAfterDrop = await page.evaluate(async (id) => {
    const cardEl = document.querySelector(`.card[data-id="${id}"]`);
    const target = document.querySelector('.cards[data-col="en_progreso"]');
    const startBox = cardEl.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const startX = startBox.left + startBox.width / 2;
    const startY = startBox.top + startBox.height / 2;
    const midX = startX + 30;
    const midY = startY + 30;
    const endX = targetBox.left + targetBox.width / 2;
    const endY = targetBox.top + targetBox.height / 2;

    const fire = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true,
    }));

    fire("pointerdown", cardEl, startX, startY);
    fire("pointermove", window, midX, midY); // supera el umbral, activa cardDrag.active

    await window.pollTick(); // simula el tick de polling cayendo a mitad del arrastre

    fire("pointermove", window, endX, endY); // reengancharía el nodo huérfano si hay bug
    fire("pointerup", window, endX, endY);

    return document.querySelectorAll(`.card[data-id="${id}"]`).length;
  }, cardId);

  expect(countRightAfterDrop).toBe(1);

  const reorderResp = await reorderResponse;
  expect(reorderResp.status()).toBe(200);
  await expect(page.locator(`.card[data-id="${cardId}"]`)).toHaveCount(1);
});
