// Utilidades comunes de las pruebas E2E de la aplicación.

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

export async function openBook(page, prefix = "rec") {
  const suffix = uniqueId();
  await page.goto(`/api/local/session?as=${prefix}-${suffix}%40example.test`);
  await page.getByLabel("Nombre", { exact: true }).fill(`Casa ${prefix} ${suffix}`);
  await page.getByRole("button", { name: "Crear espacio" }).click();
  const book = new URL(page.url()).pathname;
  await page.getByLabel("Participante sin cuenta").fill("Beto");
  await page.getByRole("button", { name: "Agregar participante" }).click();
  return { book, suffix };
}
