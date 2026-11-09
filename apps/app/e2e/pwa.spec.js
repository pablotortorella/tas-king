import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { openBook } from "./helpers.js";

// HomeSuite App instalable (openspec/changes/pwa-instalable, grupo 6): service worker real sobre `wrangler dev`.
// El resto de las suites corren con los service workers bloqueados (playwright.config.mjs); aquí se permiten.
test.use({ serviceWorkers: "allow" });

// Registra violaciones de la política de contenido y errores de la página.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
});

const expectNoViolations = async (page) => expect(await page.evaluate(() => window.__csp)).toEqual([]);

// Instala el service worker y espera a que controle la página (activate + clients.claim()).
async function instalar(page, ruta = "/jardin-zen") {
  await page.goto(ruta);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

// Lista de precarga y versión tal como las publica el Worker dentro de /sw.js.
async function swPublicado(request) {
  const texto = await (await request.get("/sw.js")).text();
  return {
    version: JSON.parse(texto.match(/const VERSION = ("[^"]*");/u)[1]),
    precarga: JSON.parse(texto.match(/const PRECARGA = (\[[^\n]*\]);/u)[1]),
  };
}

test.describe("instalación y caché", () => {
  test("registra el service worker con alcance / y la caché guarda exactamente la lista de precarga", async ({ page, request }) => {
    const { version, precarga } = await swPublicado(request);
    expect(version).toMatch(/^[0-9a-f]{12}$/u);
    for (const ruta of ["/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso", "/app.css", "/ledger-ui.js", "/split.js", "/text.js", "/shell.js", "/pwa.js", "/manifest.webmanifest"]) {
      expect(precarga).toContain(ruta);
    }
    for (const ruta of ["/", "/remanso", "/jardin-zen", "/perfil", "/profile.js", "/classify.js", "/import-progress.js"]) expect(precarga).not.toContain(ruta);
    expect(precarga.some((ruta) => ruta.startsWith("/remanso/audio/"))).toBe(false);

    await instalar(page, "/");
    const alcance = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
    expect(alcance).toBe(`${new URL(page.url()).origin}/`);

    // Recorrido por las páginas con sesión: ninguna entra en la caché.
    await openBook(page, "pwa-cache");
    for (const ruta of ["/", "/perfil", "/cuentas-claras", "/remanso", "/jardin-zen"]) {
      const respuesta = await page.goto(ruta);
      expect(respuesta.status()).toBe(200);
      await expectNoViolations(page);
    }

    const cache = await page.evaluate(async () => {
      const nombres = (await caches.keys()).filter((nombre) => nombre.startsWith("homesuite-pwa-"));
      const almacen = await caches.open(nombres[0]);
      const entradas = [];
      for (const pedido of await almacen.keys()) {
        const respuesta = await almacen.match(pedido);
        const cuerpo = /text|javascript|json|svg/u.test(respuesta.headers.get("content-type") ?? "") ? await respuesta.text() : "";
        entradas.push({ ruta: new URL(pedido.url).pathname, cuerpo });
      }
      return { nombres, entradas };
    });
    expect(cache.nombres).toEqual([`homesuite-pwa-${version}`]);
    expect(cache.entradas.map((entrada) => entrada.ruta).sort()).toEqual([...precarga].sort());
    for (const entrada of cache.entradas) {
      expect(entrada.cuerpo, entrada.ruta).not.toContain("zelda-e2e");
      expect(entrada.cuerpo, entrada.ruta).not.toContain("_csrf");
    }
  });

  test("cabeceras del service worker, el manifiesto, los íconos y las páginas sin conexión", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(sw.headers()["cache-control"]).toBe("no-cache");
    const { version } = await swPublicado(request);
    expect(sw.headers().etag).toBe(`"${version}"`);
    expect((await request.get("/sw.js", { headers: { "If-None-Match": `"${version}"` } })).status()).toBe(304);

    const manifiesto = await request.get("/manifest.webmanifest");
    expect(manifiesto.headers()["content-type"]).toContain("application/manifest+json");
    expect(manifiesto.headers()["cache-control"]).toBe("public, max-age=3600");
    const datos = await manifiesto.json();
    expect(datos).toMatchObject({ name: expect.stringContaining("HomeSuite"), start_url: "/", scope: "/", display: "standalone" });

    const icono = await request.get(datos.icons[0].src);
    expect(icono.status()).toBe(200);
    expect(icono.headers()["content-type"]).toContain("image/png");
    expect(icono.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(icono.headers()["x-content-type-options"]).toBe("nosniff");

    for (const ruta of ["/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso"]) {
      const respuesta = await request.get(ruta);
      expect(respuesta.status(), ruta).toBe(200);
      expect(respuesta.headers()["cache-control"], ruta).toBe("no-cache");
      expect(respuesta.headers()["content-security-policy"], ruta).toContain("script-src 'self'");
      expect(respuesta.headers()["set-cookie"], ruta).toBeUndefined();
      expect(await respuesta.text(), ruta).not.toContain("_csrf");
    }
  });
});

test.describe("sin conexión", () => {
  test("Jardín Zen dibuja y rastrilla, y ningún pedido de la lista falla", async ({ page, context, request }) => {
    const { precarga } = await swPublicado(request);
    await instalar(page);
    const fallidos = [];
    page.on("requestfailed", (pedido) => fallidos.push(new URL(pedido.url()).pathname));
    await context.setOffline(true);
    await page.goto("/jardin-zen");
    await expect(page.getByRole("heading", { name: "Un momento de calma" })).toBeVisible();
    await expect(page.locator("canvas#scene")).toBeVisible();
    const rake = page.locator("#rake-size");
    await expect(rake).toHaveText("Trazo fino");
    await rake.click();
    await expect(rake).toHaveText("Trazo normal");
    const caja = await page.locator("#scene").boundingBox();
    await expect(page.locator("#undo")).toBeDisabled();
    await page.mouse.move(caja.x + caja.width * 0.3, caja.y + caja.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width * 0.3 + 140, caja.y + caja.height * 0.5 + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator("#undo")).toBeEnabled();
    await expectNoViolations(page);
    expect(fallidos.filter((ruta) => precarga.includes(ruta))).toEqual([]);
  });

  test("Remanso muestra el nivel libre con aviso y una sesión de 1 minuto arranca", async ({ page, context }) => {
    await instalar(page);
    await context.setOffline(true);
    await page.goto("/remanso");
    await expect(page.getByText("Sin conexión: se muestran las opciones sin cuenta.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "¿Cuánto tiempo te regalás hoy?" })).toBeVisible();
    await expect(page.locator('[data-m="20"]')).toHaveAttribute("aria-disabled", "true");
    await page.locator('[data-m="1"]').click();
    await page.locator('[data-a="silencio"]').click();
    await page.getByRole("button", { name: "Comenzar · 1 min" }).click();
    await expect(page.locator("#rem-sesion")).toBeVisible();
    await expect(page.locator("#rem-restante")).toHaveText(/^(1:00|0:5\d)$/u);
    await expectNoViolations(page);
  });

  test("las demás páginas muestran «Sin conexión» y «Reintentar» lleva a la página real al volver la red", async ({ page, context }) => {
    const { book } = await openBook(page, "pwa-offline");
    await instalar(page, "/cuentas-claras");
    await context.setOffline(true);
    for (const ruta of ["/cuentas-claras", book]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();
      await expect(page.locator(".account-link")).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("zelda-e2e");
      await expect(page.getByRole("link", { name: "Jardín Zen" })).toHaveAttribute("href", "/jardin-zen");
    }
    await expectNoViolations(page);
    await context.setOffline(false);
    await page.getByRole("link", { name: "Reintentar" }).click();
    await expect(page).toHaveURL(new RegExp(`${book}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toHaveCount(0);
    await expect(page.locator("#rem-titulo, h1").first()).toBeVisible();
  });
});

test.describe("formularios y API con el service worker activo", () => {
  test("POST /auth/logout cierra la sesión y la siguiente navegación ya no la tiene", async ({ page }) => {
    const { book } = await openBook(page, "pwa-salir");
    await instalar(page, book);
    await page.goto(book);
    await page.getByLabel("Abrir el menú").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/u);
    await expect(page.getByText("Solicitud no verificada")).toHaveCount(0);
    await expect(page.locator(".account-link")).toHaveCount(0);
    expect((await page.request.get(book, { maxRedirects: 0 })).status()).toBe(303);
    await page.goto(book);
    await expect(page).not.toHaveURL(new RegExp(`${book}$`, "u"));
  });

  test("/api/me no aparece en la caché y un 404 del servidor se muestra tal cual", async ({ page }) => {
    await openBook(page, "pwa-api");
    await instalar(page, "/cuentas-claras");
    const estado = await page.evaluate(async () => {
      const respuesta = await fetch("/api/me");
      const cuerpo = await respuesta.json();
      let enCache = false;
      for (const nombre of await caches.keys()) enCache ||= Boolean(await (await caches.open(nombre)).match("/api/me", { ignoreSearch: true }));
      return { status: respuesta.status, email: cuerpo.email, enCache };
    });
    expect(estado.status).toBe(200);
    expect(estado.email).toContain("@example.test");
    expect(estado.enCache).toBe(false);

    const faltante = await page.goto("/esta-ruta-no-existe");
    expect(faltante.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toHaveCount(0);
  });
});

// Regresión: con navigation preload activo, Chromium hace dos pedidos a las navegaciones que el service worker no intercepta
// (/auth/google): el precargado y el de red. Cada uno fijaba una cookie `homesuite_oauth` con un `state` distinto y el acceso fallaba.
// Se cuenta lo que llega al servidor (context.on('request') incluye los del service worker y los precargados).
test("/auth/google llega una sola vez al servidor con el service worker activo (sin navigation preload)", async ({ page, context }) => {
  await instalar(page);
  const estado = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).navigationPreload.getState()));
  expect(estado.enabled).toBe(false);
  const pedidos = [];
  context.on("request", (pedido) => {
    if (new URL(pedido.url()).pathname === "/auth/google") pedidos.push({ precarga: pedido.headers()["service-worker-navigation-preload"] ?? null, desdeSW: Boolean(pedido.serviceWorker()) });
  });
  // Sin cliente de Google en este ambiente responde 503, lo que no cambia el conteo; no sale ningún pedido a otro origen.
  const respuesta = await page.goto("/auth/google?returnTo=%2Fremanso");
  expect(respuesta.status()).toBeLessThan(600);
  await page.waitForTimeout(500);
  expect(pedidos).toEqual([{ precarga: null, desdeSW: false }]);
});

// --- Apagado en dos fases con perfil persistente -------------------------------------------------------------------------------------

const RAIZ = path.resolve(__dirname, "../../..");
const PUERTO_APAGADO = Number(process.env.E2E_PWA_OFF_PORT ?? 8796);

async function iniciarWrangler(estado, variables) {
  const args = ["wrangler", "dev", "--config", "apps/app/wrangler.jsonc", "--local", "--persist-to", estado, "--port", String(PUERTO_APAGADO),
    "--var", "DEV_LOCAL_MODE:true", "--var", "SESSION_SECRET:e2e-session-secret-with-at-least-32-chars", ...variables.flatMap((variable) => ["--var", variable])];
  const proceso = spawn("npx", args, { cwd: RAIZ, detached: true, stdio: "ignore" });
  const url = `http://localhost:${PUERTO_APAGADO}`;
  for (let intento = 0; intento < 120; intento += 1) {
    try { if ((await fetch(`${url}/healthz`)).ok) return { url, detener: () => { try { process.kill(-proceso.pid, "SIGTERM"); } catch { /* ya terminó */ } } }; } catch { /* aún no escucha */ }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  try { process.kill(-proceso.pid, "SIGTERM"); } catch { /* ya terminó */ }
  throw new Error("wrangler dev no arrancó");
}

test("apagado con PWA_SW=off: tras una navegación no quedan registro ni cachés y la página no se recarga", async () => {
  test.setTimeout(180_000);
  const directorio = mkdtempSync(path.join(tmpdir(), "pwa-apagado-"));
  const estado = path.join(directorio, "estado");
  const perfil = path.join(directorio, "perfil");
  const opciones = { executablePath: process.env.E2E_CHROMIUM_PATH || undefined, serviceWorkers: "allow" };
  let servidor;
  try {
    // Fase 1: servicio normal; se instala y se llena la caché.
    servidor = await iniciarWrangler(estado, []);
    let contexto = await chromium.launchPersistentContext(perfil, opciones);
    let pagina = contexto.pages()[0] ?? await contexto.newPage();
    await pagina.goto(`${servidor.url}/jardin-zen`);
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    expect(await pagina.evaluate(async () => (await caches.keys()).filter((nombre) => nombre.startsWith("homesuite-pwa-")).length)).toBe(1);
    await contexto.close();
    servidor.detener();
    await new Promise((resolver) => setTimeout(resolver, 1500));

    // Fase 2: mismo origen y mismo perfil, con el servidor apagando el service worker.
    servidor = await iniciarWrangler(estado, ["PWA_SW:off"]);
    contexto = await chromium.launchPersistentContext(perfil, opciones);
    pagina = contexto.pages()[0] ?? await contexto.newPage();
    await pagina.goto(`${servidor.url}/jardin-zen`);
    await pagina.evaluate(() => { window.__marca = "sin-recarga"; });
    await expect.poll(() => pagina.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 30_000 }).toBe(0);
    await expect.poll(() => pagina.evaluate(async () => (await caches.keys()).filter((nombre) => nombre.startsWith("homesuite-pwa-")).length), { timeout: 30_000 }).toBe(0);
    expect(await pagina.evaluate(() => window.__marca)).toBe("sin-recarga");
    await contexto.close();
  } finally {
    servidor?.detener();
    rmSync(directorio, { recursive: true, force: true });
  }
});
