// Utilidades comunes de las pruebas E2E de la aplicación.
import { expect } from "@playwright/test";

// Contraste real de lo que se ve: color de cada texto contra el primer fondo opaco de sus ancestros.
export async function lowContrast(page) {
  return page.evaluate(() => {
    const parse = value => { const match = value.match(/rgba?\(([^)]+)\)/u); if (!match) return null; const [r, g, b, a = 1] = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number); return { r, g, b, a }; };
    const channel = v => { const u = v / 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    const lum = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
    const backgroundOf = node => { for (let el = node; el; el = el.parentElement) { const bg = parse(getComputedStyle(el).backgroundColor); if (bg && bg.a > 0.99) return bg; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const failures = [];
    let inspected = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim()) continue;
      const el = text.parentElement;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || !el.getClientRects().length || el.closest("[hidden]")) continue;
      const fg = parse(style.color);
      if (!fg) continue;
      inspected += 1;
      const value = ratio(fg, backgroundOf(el));
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      if (value < (large ? 3 : 4.5)) failures.push(`${text.textContent.trim().slice(0, 40)} → ${value.toFixed(2)}`);
    }
    return inspected < 5 ? [`sólo se inspeccionaron ${inspected} textos`] : failures;
  });
}

// Recorridos exploratorios: preparan un grupo con dos personas en un navegador real, igual que lo haría una persona.
export const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

// Agrega una persona sin cuenta desde la pantalla de personas y vuelve al libro.
export async function addPerson(page, book, name) {
  await page.goto(`${book}/people`);
  await page.getByLabel("Participante sin cuenta").fill(name);
  await page.getByRole("button", { name: "Agregar participante" }).click();
  await expect(page).toHaveURL(/\/people\?aviso=participante/u);
  await page.goto(book);
}

export async function openBook(page, prefix = "rec") {
  const suffix = uniqueId();
  await page.goto(`/api/local/session?as=${prefix}-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa ${prefix} ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  const book = new URL(page.url()).pathname;
  await addPerson(page, book, "Beto");
  return { book, suffix };
}

// Carga movimientos con el mismo formulario que usa la persona, pero desde la propia página (así viajan las cookies de la
// sesión y el origen es el real). items: [{ description, amount?, occurredAt?, categoryId? }]
export async function seedEntriesViaForm(page, book, items) {
  await page.evaluate(async ({ book: path, items: list }) => {
    const html = await (await fetch(`${path}/ledger/new?type=expense`, { credentials: "same-origin" })).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const csrf = doc.querySelector('input[name="_csrf"]').value;
    const payer = doc.querySelector('input[name="payer"]').value;
    const people = [...doc.querySelectorAll('input[name="beneficiary"]')].map(input => input.value);
    for (const item of list) {
      const fields = [["_csrf", csrf], ["type", "expense"], ["currency", "COP"], ["amount", item.amount ?? "100,00"], ["description", item.description], ["occurredAt", item.occurredAt ?? "2026-06-01"], ["payer", payer], ["splitMethod", "equal"], ["idempotencyKey", crypto.randomUUID()], ["note", ""], ...people.map(id => ["beneficiary", id])];
      if (item.categoryId !== undefined) fields.push(["categoryId", item.categoryId]);
      const response = await fetch(`${path}/ledger/entries`, { method: "POST", body: new URLSearchParams(fields), headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (!response.ok) throw new Error(`No se pudo cargar «${item.description}»: ${response.status} ${await response.text()}`);
    }
  }, { book, items });
}

// Tras guardar, corregir o anular se vuelve a la lista con una franja «Recién …» que muestra el movimiento afectado.
// Esta utilidad comprueba la franja y abre el detalle desde ella (los escenarios que necesitan el detalle siguen desde ahí).
export async function openRecent(page, description) {
  const strip = page.locator(".recent-strip");
  await expect(strip).toBeVisible();
  await strip.getByRole("link", { name: new RegExp(description.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u") }).click();
  await expect(page.getByRole("heading", { name: description, level: 1 })).toBeVisible();
}

// Firefox ignora la opción `colorScheme` del contexto y, si `emulateMedia` se llama sobre about:blank, la pierde al navegar.
// Con un documento real cargado la emulación sí persiste en todas las navegaciones siguientes: se abre /healthz (liviano y
// sin sesión) y recién entonces se emula. Las pruebas por esquema de color lo llaman además de `test.use({ colorScheme })`.
export async function emulateScheme(page, scheme) {
  if (page.url() === "about:blank") await page.goto("/healthz");
  await page.emulateMedia({ colorScheme: scheme });
}

// Una descripción por esquema de color: aplica la opción del contexto y la emulación que Firefox sí respeta.
export function useScheme(test, scheme, viewport = null) {
  test.use({ colorScheme: scheme, ...(viewport ? { viewport } : {}) });
  test.beforeEach(({ page }) => emulateScheme(page, scheme));
}
