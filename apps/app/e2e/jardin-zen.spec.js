import { test, expect } from "@playwright/test";

// Prueba sencilla; la validación de WebGL real y el tacto necesita dispositivos físicos.
test("Jardín Zen se abre sin sesión y permite alternar el ancho", async ({ page }) => {
  await page.goto("/jardin-zen");
  await expect(page.getByRole("heading", { name: "Un momento de calma" })).toBeVisible();
  await expect(page.locator("canvas#scene")).toBeVisible();
  const rake = page.locator("#rake-size");
  await expect(rake).toHaveText("Trazo fino");
  await rake.click();
  await expect(rake).toHaveText("Trazo normal");
  await rake.click();
  await expect(rake).toHaveText("Trazo fino");
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "false");
});

// v0.4: rastrillo con el mango invertido, giro suave y visible u oculto. Estas pruebas corren sin WebGL, así que ejercen la
// alternativa Canvas 2.5D; la ruta WebGL 2 y el tacto real se prueban a mano.
const KEY = "homesuite:jardin-zen:rake-visible";

async function sandPoint(page, fx, fy) {
  const box = await page.locator("#scene").boundingBox();
  return [box.x + box.width * fx, box.y + box.height * fy];
}

// El Chromium de Playwright puede traer WebGL por software; para que estas pruebas ejerzan siempre la alternativa 2.5D (y se pueda leer
// el canvas) se le niega el contexto webgl2 a la página.
const sinWebGL = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
    return type === "webgl2" ? null : original.call(this, type, ...rest);
  };
};

test.describe("Jardín Zen v0.4 · rastrillo (alternativa 2.5D)", () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(sinWebGL); });

  test("el control arranca en «Rastrillo visible» y alterna con aria-pressed", async ({ page }) => {
    await page.goto("/jardin-zen");
    const toggle = page.locator("#rake-visible");
    await expect(toggle).toHaveText("Rastrillo visible");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "reposo");
    const visible = await page.locator("#scene").evaluate((c) => c.toDataURL());
    const pixels = () => page.locator("#scene").evaluate((c) => c.toDataURL());
    await toggle.click();
    await expect(toggle).toHaveText("Rastrillo oculto");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "oculto");
    await expect.poll(pixels).not.toBe(visible); // el redibujado ocurre en el siguiente fotograma
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(pixels).toBe(visible);
  });

  test("se opera con el teclado", async ({ page }) => {
    await page.goto("/jardin-zen");
    const toggle = page.locator("#rake-visible");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("recuerda la preferencia en el navegador y no la envía al servidor", async ({ page }) => {
    const requests = [];
    page.on("request", (request) => { requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`); });
    await page.goto("/jardin-zen");
    await page.locator("#rake-visible").click();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("0");
    await page.reload();
    await expect(page.locator("#rake-visible")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#rake-visible")).toHaveText("Rastrillo oculto");
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "oculto");
    expect(requests.filter((r) => /rake-visible/u.test(r))).toEqual([]);
    expect(requests.filter((r) => !r.startsWith("GET "))).toEqual([]);
    await page.locator("#rake-visible").click();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("1");
  });

  test("sin almacenamiento disponible queda visible y sin errores", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("bloqueado", "SecurityError"); } });
    });
    await page.goto("/jardin-zen");
    const toggle = page.locator("#rake-visible");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test("mover sin pulsar acompaña y gira el rastrillo sin crear surcos; arrastrar sí los crea", async ({ page }) => {
    await page.goto("/jardin-zen");
    const scene = page.locator("#scene-box");
    const undo = page.locator("#undo");
    await expect(undo).toBeDisabled();
    const [x0, y0] = await sandPoint(page, 0.3, 0.5);
    await page.mouse.move(x0, y0);
    await page.mouse.move(x0 + 160, y0, { steps: 10 });
    await expect(scene).toHaveAttribute("data-rake", "siguiendo");
    await expect(page.locator("#scene")).toHaveCSS("cursor", "none");
    await expect(scene).not.toHaveAttribute("data-rake-heading", "-90");
    await expect(undo).toBeDisabled();
    // Sale de la arena: vuelve a descansar en el costado.
    await page.mouse.move(2, 2);
    await expect(scene).toHaveAttribute("data-rake", "reposo");
    await expect(page.locator("#scene")).toHaveCSS("cursor", "crosshair");
    // Arrastrar crea un surco.
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 140, y0 + 40, { steps: 8 });
    await page.mouse.up();
    await expect(undo).toBeEnabled();
  });

  test("al invertir de golpe la dirección el rumbo mostrado pasa por ángulos intermedios", async ({ page }) => {
    await page.goto("/jardin-zen");
    const scene = page.locator("#scene-box");
    const heading = async () => Number(await scene.getAttribute("data-rake-heading"));
    const turn = (a, b) => Math.abs(((a - b + 540) % 360) - 180); // distancia angular en grados, de 0 a 180
    const [x0, y0] = await sandPoint(page, 0.5, 0.5);
    await page.mouse.move(x0 - 150, y0);
    await page.mouse.move(x0, y0, { steps: 6 });
    // Espera a que el giro hacia la derecha termine (el ángulo se queda quieto).
    let previous = NaN;
    await expect.poll(async () => { const now = await heading(); const quiet = now === previous; previous = now; return quiet; }).toBe(true);
    const before = await heading();
    // Registra el ángulo mostrado en cada fotograma mientras se invierte la dirección de un solo movimiento.
    const recording = page.evaluate(() => new Promise((resolve) => {
      const frames = [], start = performance.now();
      (function sample() {
        frames.push(Number(document.getElementById("scene-box").dataset.rakeHeading));
        if (performance.now() - start < 1200) requestAnimationFrame(sample); else resolve(frames);
      })();
    }));
    await page.mouse.move(x0 - 150, y0);
    const seen = await recording;
    const jumps = seen.slice(1).map((deg, i) => turn(deg, seen[i]));
    expect(Math.max(...jumps)).toBeLessThanOrEqual(20); // tope de 0,3 rad (~17°) por fotograma, más el redondeo
    expect(seen.filter((deg) => turn(deg, before) > 20 && turn(deg, before) < 160).length).toBeGreaterThan(4);
    expect(turn(seen.at(-1), before)).toBeGreaterThan(140);
  });

  test("ocultar el rastrillo durante un arrastre no lo interrumpe ni cambia el ancho", async ({ page }) => {
    await page.goto("/jardin-zen");
    const size = page.locator("#rake-size");
    await size.click();
    await expect(size).toHaveText("Trazo normal");
    const [x0, y0] = await sandPoint(page, 0.3, 0.55);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 80, y0 + 20, { steps: 5 });
    await page.locator("#rake-visible").evaluate((button) => button.click());
    await expect(page.locator("#rake-visible")).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(x0 + 220, y0 + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator("#undo")).toBeEnabled();
    await expect(size).toHaveText("Trazo normal");
    // Sigue rastrillando y deshaciendo con el rastrillo oculto.
    await page.mouse.move(x0, y0 - 60);
    await page.mouse.down();
    await page.mouse.move(x0 + 100, y0 - 60, { steps: 5 });
    await page.mouse.up();
    await page.locator("#undo").click();
    await page.locator("#undo").click();
    await expect(page.locator("#undo")).toBeDisabled();
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "oculto");
    await expect(page.locator("#scene")).toHaveCSS("cursor", "crosshair");
  });

  for (const width of [360, 390]) {
    test(`no hay desplazamiento horizontal a ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/jardin-zen");
      await expect(page.locator("#rake-visible")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const box = await page.locator("#rake-visible").boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    });
  }
});

test.describe("Jardín Zen v0.4 · rastrillo (WebGL 2, si el navegador lo trae)", () => {
  test("alterna, sigue al puntero y gira sin errores", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/jardin-zen");
    const conWebGL = await page.evaluate(() => { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2")); });
    test.skip(!conWebGL, "este navegador no ofrece WebGL 2; la ruta se prueba a mano");
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "reposo");
    const [x0, y0] = await sandPoint(page, 0.4, 0.5);
    await page.mouse.move(x0, y0);
    await page.mouse.move(x0 + 120, y0 + 30, { steps: 8 });
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "siguiendo");
    await expect(page.locator("#undo")).toBeDisabled();
    await page.locator("#rake-visible").click();
    await expect(page.locator("#scene-box")).toHaveAttribute("data-rake", "oculto");
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 200, y0 + 60, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator("#undo")).toBeEnabled();
    expect(errors).toEqual([]);
  });
});
