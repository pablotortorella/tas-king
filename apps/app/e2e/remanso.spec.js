import { expect, test } from "@playwright/test";

const ROUTES_HTML = ["/", "/tareas", "/cuentas-claras", "/compras", "/remanso"];
const ACCOUNT = { "X-HomeSuite-Dev-Email": "pablo@example.test" };

// Registra violaciones de la política de contenido, errores de consola y los
// AudioContext creados/cerrados (el contador de cierres sobrevive a la navegación).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`));
    // frecuencias de los osciladores que se inician: permite saber qué gong sonó
    window.__freqs = [];
    const originalStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) { window.__freqs.push(this.frequency.value); return originalStart.apply(this, args); };
    const Original = window.AudioContext;
    window.__contexts = 0;
    window.AudioContext = class extends Original {
      constructor(...args) { super(...args); window.__contexts += 1; }
      close() {
        sessionStorage.setItem("closed", String(Number(sessionStorage.getItem("closed") || 0) + 1));
        return super.close();
      }
    };
  });
});

async function expectNoViolations(page) {
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
}

async function noHorizontalOverflow(page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
}

test.describe("cabeceras sobre el servidor real", () => {
  for (const route of ROUTES_HTML) {
    test(`${route} entrega política y cabeceras de seguridad`, async ({ request }) => {
      const response = await request.get(route);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["content-security-policy"]).toContain("script-src 'self'; style-src 'self'");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["cache-control"]).toBe("private, no-store");
    });
  }

  test("/perfil sin sesión redirige conservando las cabeceras", async ({ request }) => {
    const response = await request.get("/perfil", { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers()["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  for (const [file, type] of [["remanso.js", "javascript"], ["remanso-engine.js", "javascript"], ["remanso.css", "text/css"]]) {
    test(`/remanso/${file} se entrega con su tipo y nosniff`, async ({ request }) => {
      const response = await request.get(`/remanso/${file}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain(type);
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    });
  }

  test("el documento no trae código incrustado y los recursos propios no son HTML", async ({ request }) => {
    const html = await (await request.get("/remanso")).text();
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>|<style|\sstyle\s*=|\son[a-z]+\s*=/iu);
    // Si alguien agregara un .html a public/, saldría sin cabeceras de seguridad.
    expect((await request.get("/remanso/index.html")).status()).toBe(404);
  });

  test("el detector de violaciones de la política funciona (control de falsos verdes)", async ({ page }) => {
    await page.goto("/remanso");
    await page.evaluate(() => document.body.setAttribute("style", "color: red"));
    await expect.poll(() => page.evaluate(() => window.__csp.length)).toBeGreaterThan(0);
  });
});

test.describe("sin cuenta", () => {
  test("ofrece el nivel libre y explica las opciones con cuenta sin cambiar nada ni sonar", async ({ page }) => {
    await page.goto("/remanso");
    await expect(page.getByRole("heading", { level: 1, name: "¿Cuánto tiempo te regalás hoy?" })).toBeVisible();
    await expect(page.locator('[data-m="5"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-a="agua"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Comenzar · 5 min" })).toBeVisible();

    for (const minutes of [10, 20, 30]) await expect(page.locator(`[data-m="${minutes}"]`)).toHaveAttribute("aria-disabled", "true");
    for (const ambient of ["lluvia", "fuego", "noche"]) await expect(page.locator(`[data-a="${ambient}"]`)).toHaveAttribute("aria-disabled", "true");
    for (const minutes of [1, 2, 5]) await expect(page.locator(`[data-m="${minutes}"]`)).not.toHaveAttribute("aria-disabled", "true");
    await expect(page.locator('[data-m="20"]')).toContainText("con cuenta");

    await expect(page.locator("#rem-aviso")).toBeHidden();
    // aria-disabled (no `disabled`) deja la opción enfocable y activable a propósito:
    // Playwright la ve como "no habilitada", por eso force.
    await page.locator('[data-m="20"]').click({ force: true });
    await expect(page.locator("#rem-aviso")).toBeVisible();
    await expect(page.locator("#rem-aviso-texto")).toContainText("cuenta de HomeSuite");
    await expect(page.getByRole("link", { name: "Continuar con Google" }).first()).toHaveAttribute("href", "/auth/google?returnTo=%2Fremanso");
    await expect(page.locator('[data-m="5"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-m="20"]')).toHaveAttribute("aria-pressed", "false");

    await page.locator('[data-a="lluvia"]').click({ force: true });
    await expect(page.locator('[data-a="agua"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Comenzar · 5 min" })).toBeVisible();

    expect(await page.evaluate(() => window.__contexts)).toBe(0);
    await expectNoViolations(page);
  });

  test("sesión corta y silenciosa: pausa, terminar antes y cierre sin nombre", async ({ page }) => {
    const sent = [];
    page.on("request", (request) => { if (request.method() !== "GET") sent.push(`${request.method()} ${request.url()}`); });
    await page.goto("/remanso");
    await page.locator('[data-m="1"]').click();
    await page.locator('[data-a="silencio"]').click();
    await expect(page.getByRole("button", { name: "Comenzar · 1 min" })).toBeVisible();
    await page.getByRole("button", { name: "Comenzar · 1 min" }).click();

    await expect(page.locator("#rem-sesion")).toBeVisible();
    await expect(page.locator(".shell-header")).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-pantalla", "sesion");
    await expect(page.locator("#rem-s-fondo")).toHaveText("En silencio");
    await expect(page.locator("#rem-mudo")).toBeHidden();
    await expect(page.locator("#rem-restante")).toHaveText(/^(1:00|0:5\d)$/u);
    await expect(page.locator("#rem-proximo")).toContainText("Próximo gong en");
    expect(await page.evaluate(() => window.__contexts)).toBe(1);

    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByRole("button", { name: "Reanudar" })).toBeVisible();
    await expect(page.locator("#rem-restante-etiqueta")).toHaveText("En pausa");
    await page.getByRole("button", { name: "Reanudar" }).click();
    await expect(page.locator("#rem-restante-etiqueta")).toHaveText("restantes");

    await page.getByRole("button", { name: "Terminar sesión" }).click();
    await expect(page.locator("#rem-cierre")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Un momento de calma");
    await expect(page.locator("#rem-c-saludo")).toBeHidden();
    // Sin cuenta el cierre es igual de sobrio: sin invitación ni mensaje de venta.
    await expect(page.locator("#rem-cierre")).not.toContainText(/cuenta de|con cuenta|Google|crear|HomeSuite/iu);
    await expect(page.locator("#rem-cierre").getByRole("link")).toHaveCount(0);

    const mood = page.getByRole("button", { name: "En calma" });
    await mood.click();
    await expect(mood).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Volver al inicio" }).click();
    await expect(page.locator("#rem-inicio")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-pantalla", "inicio");
    await page.locator('[data-m="1"]').click();
    await page.getByRole("button", { name: "Comenzar · 1 min" }).click();
    await page.getByRole("button", { name: "Terminar sesión" }).click();
    await expect(page.getByRole("button", { name: "En calma" })).toHaveAttribute("aria-pressed", "false");

    expect(sent).toEqual([]); // nada de la sesión ni del ánimo sale hacia el servidor
    await expectNoViolations(page);
  });

  test("repetir sesión conserva duración, fondo y volumen", async ({ page }) => {
    await page.goto("/remanso");
    await page.locator('[data-m="2"]').click();
    await page.locator('[data-a="bosque"]').click();
    await page.getByRole("button", { name: "Comenzar · 2 min" }).click();
    await expect(page.locator("#rem-s-titulo")).toHaveText("Sesión de 2 min");
    await page.getByRole("button", { name: "Terminar sesión" }).click();
    await page.getByRole("button", { name: "Repetir sesión" }).click();
    await expect(page.locator("#rem-s-titulo")).toHaveText("Sesión de 2 min");
    await expect(page.locator("#rem-s-fondo")).toHaveText("Fondo: bosque");
    await expect(page.locator("#rem-mudo")).toBeVisible();
  });

  test("probar el gong no inicia una sesión", async ({ page }) => {
    await page.goto("/remanso");
    expect(await page.evaluate(() => window.__contexts)).toBe(0);
    await page.getByRole("button", { name: "Probar gong" }).click();
    await expect(page.locator("#rem-inicio")).toBeVisible();
    expect(await page.evaluate(() => window.__contexts)).toBe(1);
  });

  test("salir de la página en medio de la sesión libera el audio", async ({ page }) => {
    await page.goto("/remanso");
    await page.getByRole("button", { name: "Comenzar · 5 min" }).click();
    await expect(page.locator("#rem-sesion")).toBeVisible();
    await page.goto("/compras");
    expect(await page.evaluate(() => Number(sessionStorage.getItem("closed") || 0))).toBeGreaterThanOrEqual(1);
  });
});

test.describe("con cuenta", () => {
  test.use({ extraHTTPHeaders: ACCOUNT });

  test("abre todo, nombra a la persona en el cierre y muestra su perfil en el encabezado", async ({ page }) => {
    await page.goto("/remanso");
    await expect(page.locator(".account-link")).toContainText("pablo");
    await expect(page.locator('[data-m="10"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-a="lluvia"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[aria-disabled='true']")).toHaveCount(0);

    await page.locator('[data-m="20"]').click();
    await page.locator('[data-a="fuego"]').click();
    await expect(page.locator("#rem-aviso")).toBeHidden();
    await expect(page.locator("#rem-regla")).toHaveText("Gong al inicio, cada 5 min y al final");
    await expect(page.locator("#rem-marcas span")).toHaveText(["0:00", "5:00", "10:00", "15:00", "20:00"]);

    await page.getByRole("button", { name: "Comenzar · 20 min" }).click();
    await expect(page.locator("#rem-restante")).toHaveText(/^(20:00|19:5\d)$/u);
    await expect(page.locator("#rem-mudo")).toBeVisible();
    await page.getByRole("button", { name: "Silenciar fondo" }).click();
    await expect(page.getByRole("button", { name: "Activar fondo" })).toBeVisible();
    await page.getByRole("button", { name: "Terminar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Un momento de calma");
    await expect(page.locator("#rem-c-saludo")).toHaveText("Gracias por tu pausa, pablo.");
    await expectNoViolations(page);
  });
});

// Presupuesto de oscilación de volumen en dB. El «wa-wa» original del paquete mide ~21.
// El cuenco conserva a propósito un temblor lento y suave (~2,3 dB inicio/fin, ~3,1 dB
// intermedio): es parte de su carácter y Pablo lo aprobó de oído.
const OSCILACION_MAXIMA = { brillante: 3, profundo: 3, cuenco: 4 };

test.describe("sonido", () => {
  // Renderiza cada gong sin conexión con el módulo servido y mide cuánto oscila su volumen
  // (percentil 95 menos 5 del residuo en dB tras quitar la caída natural, 0,5 a 10 s).
  // El desafinado original del paquete (±0,4 Hz) da ~21 dB: cancelaciones completas cada
  // 1,25 s, el «wa-wa». Un gong sano queda por debajo de 3 dB.
  for (const [id, maximo] of Object.entries(OSCILACION_MAXIMA)) {
    for (const [nombre, principal] of [["de inicio y fin", true], ["intermedio", false]]) {
      test(`${id}: el gong ${nombre} no tiene oscilaciones de volumen audibles («wa-wa»)`, async ({ page }) => {
        await page.goto("/remanso");
        const oscilacion = await page.evaluate(async ([gong, main]) => {
          const { SuiteEngine } = await import("/remanso/remanso-gongs.js");
          const rate = 44100;
          const offline = new OfflineAudioContext(1, rate * 24, rate);
          const engine = new SuiteEngine();
          engine.setGong(gong);
          engine.ctx = offline;
          const white = offline.createBuffer(1, rate * 8, rate);
          const noise = white.getChannelData(0);
          let seed = 12345;
          for (let i = 0; i < noise.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; noise[i] = (seed / 4294967296) * 2 - 1; }
          engine.buf = { white, brown: white };
          engine.gong(0, main ? 1.5 : 1, offline.destination, main);
          const x = (await offline.startRendering()).getChannelData(0);
          const win = Math.round(rate * 0.025);
          const db = [];
          for (let i = 0; i < Math.floor(x.length / win); i++) {
            let sum = 0;
            for (let j = 0; j < win; j++) sum += x[i * win + j] ** 2;
            db.push(10 * Math.log10(sum / win + 1e-14));
          }
          const half = Math.round(1.25 / 0.025);
          const residual = [];
          for (let i = Math.round(0.5 / 0.025); i < Math.round(10 / 0.025); i++) {
            let total = 0, count = 0;
            for (let k = Math.max(0, i - half); k <= Math.min(db.length - 1, i + half); k++) { total += db[k]; count++; }
            residual.push(db[i] - total / count);
          }
          residual.sort((a, b) => a - b);
          return residual[Math.floor(residual.length * 0.95)] - residual[Math.floor(residual.length * 0.05)];
        }, [id, principal]);
        expect(oscilacion).toBeLessThan(maximo);
        await expectNoViolations(page);
      });
    }
  }
});

test.describe("elegir el gong", () => {
  test("sin cuenta sólo se puede el Gong brillante; los otros explican y no cambian nada", async ({ page }) => {
    await page.goto("/remanso");
    const botones = page.locator("#rem-sonidos button");
    await expect(botones).toHaveCount(3);
    await expect(botones.nth(0)).toContainText("Gong brillante");
    await expect(botones.nth(1)).toContainText("Gong profundo");
    await expect(botones.nth(2)).toContainText("Cuenco tibetano");
    await expect(botones.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(botones.nth(0)).not.toHaveAttribute("aria-disabled", "true");
    for (const i of [1, 2]) {
      await expect(botones.nth(i)).toHaveAttribute("aria-disabled", "true");
      await expect(botones.nth(i)).toContainText("con cuenta");
    }
    await botones.nth(2).click({ force: true });
    await expect(page.locator("#rem-aviso")).toBeVisible();
    await expect(botones.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(botones.nth(2)).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => localStorage.getItem("remanso:gong"))).toBeNull();
    expect(await page.evaluate(() => window.__contexts)).toBe(0);
  });

  test.describe("con cuenta", () => {
    test.use({ extraHTTPHeaders: ACCOUNT });

    test("«Probar gong» y la sesión suenan con el sonido elegido, y la elección se recuerda", async ({ page }) => {
      await page.goto("/remanso");
      await expect(page.locator('#rem-sonidos [data-g="brillante"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#rem-sonidos [aria-disabled='true']")).toHaveCount(0);

      await page.locator('#rem-sonidos [data-g="cuenco"]').click();
      await expect(page.locator('#rem-sonidos [data-g="cuenco"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('#rem-sonidos [data-g="brillante"]')).toHaveAttribute("aria-pressed", "false");
      await page.evaluate(() => { window.__freqs.length = 0; });
      await page.getByRole("button", { name: "Probar gong" }).click();
      const probar = await page.evaluate(() => window.__freqs.slice());
      expect(probar.some((f) => Math.abs(f - 261.6) < 0.5)).toBe(true); // fundamental del cuenco
      expect(probar.every((f) => Math.abs(f - 174.6) > 0.5)).toBe(true); // no el brillante

      await page.locator('[data-m="1"]').click();
      await page.locator('[data-a="silencio"]').click();
      await page.evaluate(() => { window.__freqs.length = 0; });
      await page.getByRole("button", { name: "Comenzar · 1 min" }).click();
      await expect(page.locator("#rem-sesion")).toBeVisible();
      const sesion = await page.evaluate(() => window.__freqs.slice());
      expect(sesion.filter((f) => Math.abs(f - 261.6) < 0.5)).toHaveLength(4); // inicio y final: 2 gongs × 2 osciladores
      expect(sesion.filter((f) => Math.abs(f - 220) < 0.5)).toHaveLength(2); // mitad: 1 gong × 2 osciladores
      await page.getByRole("button", { name: "Terminar sesión" }).click();

      await page.reload();
      await expect(page.locator('#rem-sonidos [data-g="cuenco"]')).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => localStorage.getItem("remanso:gong"))).toBe("cuenco");
      await expectNoViolations(page);
    });

    test("la elección guardada no se aplica sin cuenta, pero no se pierde", async ({ page, context }) => {
      await page.goto("/remanso");
      await page.locator('#rem-sonidos [data-g="profundo"]').click();
      await context.setExtraHTTPHeaders({}); // misma máquina, ahora sin sesión
      await page.reload();
      await expect(page.locator("#rem-sonidos")).toBeVisible();
      await expect(page.locator('#rem-sonidos [data-g="brillante"]')).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('#rem-sonidos [data-g="profundo"]')).toHaveAttribute("aria-disabled", "true");
      expect(await page.evaluate(() => localStorage.getItem("remanso:gong"))).toBe("profundo");
      await context.setExtraHTTPHeaders(ACCOUNT);
      await page.reload();
      await expect(page.locator('#rem-sonidos [data-g="profundo"]')).toHaveAttribute("aria-pressed", "true");
    });

    test("funciona igual si el navegador no deja usar localStorage", async ({ page }) => {
      const errores = [];
      page.on("pageerror", (error) => errores.push(error.message));
      await page.addInitScript(() => {
        const bloqueado = () => { throw new DOMException("bloqueado", "SecurityError"); };
        Storage.prototype.getItem = bloqueado;
        Storage.prototype.setItem = bloqueado;
      });
      await page.goto("/remanso");
      await page.locator('#rem-sonidos [data-g="profundo"]').click();
      await expect(page.locator('#rem-sonidos [data-g="profundo"]')).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Probar gong" }).click();
      expect(errores).toEqual([]);
    });
  });
});

test.describe("teclado, pantallas angostas y esquemas de color", () => {
  test("se opera con teclado sin perder el foco al elegir", async ({ page }) => {
    await page.goto("/remanso");
    await page.locator('[data-m="2"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-m="2"]')).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.activeElement?.dataset.m)).toBe("2");
    await page.locator('[data-a="bosque"]').focus();
    await page.keyboard.press("Space");
    await expect(page.locator('[data-a="bosque"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-m="20"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#rem-aviso")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#rem-aviso")).toBeHidden();
  });

  test("las tres pantallas caben en 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/remanso");
    await page.locator('[data-m="1"]').click();
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: "Comenzar · 1 min" }).click();
    await expect(page.locator("#rem-sesion")).toBeVisible();
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: "Terminar sesión" }).click();
    await expect(page.locator("#rem-cierre")).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("sigue el esquema del sistema, y la sesión es siempre oscura", async ({ page }) => {
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    for (const [scheme, expected] of [["light", "rgb(247, 242, 232)"], ["dark", "rgb(22, 25, 20)"]]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/remanso");
      expect(await background()).toBe(expected);
      await page.getByRole("button", { name: "Comenzar · 5 min" }).click();
      await expect(page.locator("#rem-sesion")).toBeVisible();
      expect(await background()).toBe("rgb(15, 20, 16)");
      await page.getByRole("button", { name: "Terminar sesión" }).click();
      await expect(page.locator("#rem-cierre")).toBeVisible();
      expect(await background()).toBe(expected);
    }
  });
});
