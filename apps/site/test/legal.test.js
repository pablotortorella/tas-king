import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Contenidos mínimos de la política de tratamiento (Decreto 1074 de 2015, art. 2.2.2.25.3.1) y edad mínima. No prueban que el texto
// sea jurídicamente suficiente (eso lo revisa Pablo): impiden que una edición borre una sección que la norma o los specs exigen.
// Specs: openspec/changes/politica-y-aceptacion/specs/politica-de-tratamiento-de-datos.
const page = (name) => readFile(new URL(`../public/${name}.html`, import.meta.url), "utf8");
const plain = (html) => html.replace(/<!--[\s\S]*?-->/gu, " ").replace(/<[^>]+>/gu, " ").replace(/&nbsp;/gu, " ").replace(/\s+/gu, " ");

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const isoDate = (day, month, year) => `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;

function updatedDate(html) {
  const match = /Última actualización: (\d{1,2}) de (\p{L}+) de (\d{4})/u.exec(html);
  return match && MONTHS.includes(match[2]) ? isoDate(match[1], match[2], match[3]) : null;
}

describe("política de privacidad", () => {
  it("tiene las secciones mínimas", async () => {
    const html = await page("privacidad");
    for (const id of ["responsable", "finalidades", "datos", "facultativo", "compartir", "derechos", "conservacion", "sin-cuenta", "cambios"]) {
      expect(html, `sección #${id}`).toContain(`<section id="${id}">`);
      expect(html, `índice de #${id}`).toContain(`href="#${id}"`);
    }
  });

  it("identifica a quien responde y cómo escribirle", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toContain("Pablo Tortorella");
    expect(text).toContain("Rionegro, Antioquia");
    expect(text).toContain("pablotortorella@gmail.com");
    expect(text).toMatch(/\(\+57\) 304 207 0566/u);
  });

  it("informa plazos, requisitos del reclamo, gratuidad y la autoridad", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toContain("10 días hábiles");
    expect(text).toContain("5 días hábiles");
    expect(text).toContain("15 días hábiles");
    expect(text).toContain("8 días hábiles");
    expect(text).toContain("5 días");
    expect(text).toContain("reclamo en trámite");
    expect(text).toMatch(/identificación/u);
    expect(text).toMatch(/gratuito/u);
    expect(text).toContain("Superintendencia de Industria y Comercio");
  });

  it("declara la vigencia de la base y las copias de seguridad de 90 días", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toMatch(/Vigencia de la base de datos/u);
    expect(text).toMatch(/mientras exista tu cuenta o el grupo/u);
    expect(text).toMatch(/noventa días/u);
    expect(text).toMatch(/entra en vigor el \d{1,2} de \p{L}+ de \d{4}/u);
  });

  it("nombra a Cloudflare, GitHub y Google con su papel y no promete una ubicación", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toMatch(/Cloudflare.*alojamiento/u);
    expect(text).toMatch(/GitHub.*copias de seguridad/u);
    expect(text).toMatch(/Google.*proveedor de identidad/u);
    expect(text).toMatch(/encargados/u);
    expect(text).toMatch(/Estados Unidos/u);
    expect(text).toMatch(/No podemos garantizar en qué país/u);
  });

  it("fija la edad mínima, advierte sobre datos sensibles y atiende a personas sin cuenta", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toMatch(/mayor de 18 años/u);
    expect(text).toMatch(/no te pide datos sensibles/u);
    expect(text).toMatch(/voluntaria/u);
    expect(text).toMatch(/sin que tengas cuenta/u);
    expect(text).toMatch(/antes de que se aplique/u);
  });

  it("la fecha de entrada en vigor es la de «Última actualización»", async () => {
    const html = await page("privacidad");
    const vigor = /entra en vigor el (\d{1,2}) de (\p{L}+) de (\d{4})/u.exec(html);
    expect(vigor).not.toBeNull();
    expect(isoDate(vigor[1], vigor[2], vigor[3])).toBe(updatedDate(html));
  });
});

describe("términos y condiciones", () => {
  it("exigen 18 años y dicen que continuar implica aceptar", async () => {
    const text = plain(await page("terminos"));
    expect(text).toMatch(/mayor de 18 años/u);
    expect(text).toMatch(/18 años o más/u);
    expect(text).toMatch(/aceptás estas condiciones y la política de privacidad/u);
  });
});

// Un solo texto para toda la suite: desde el 2026-11-10 Tareas (antes Fun TasKing) es parte de HomeSuite y ya no tiene condiciones propias.
describe("un texto para toda la suite", () => {
  it.each(["privacidad", "terminos"])("%s cubre Tareas y Jardín Zen con su propia sección", async (name) => {
    const html = await page(name);
    for (const id of ["tareas", "jardin-zen"]) {
      expect(html, `sección #${id}`).toContain(`<section id="${id}">`);
      expect(html, `índice de #${id}`).toContain(`href="#${id}"`);
    }
  });

  it.each(["privacidad", "terminos"])("%s ya no trata a Fun TasKing como una aplicación aparte", async (name) => {
    const text = plain(await page(name));
    expect(text).not.toMatch(/aplicación independiente|propias condiciones|dirección independiente/u);
  });

  it("la política dice qué guarda Tareas, quién lo ve y qué pasó con la copia de Fun TasKing", async () => {
    const text = plain(await page("privacidad"));
    expect(text).toMatch(/tableros/u);
    expect(text).toMatch(/adjuntos/u);
    expect(text).toMatch(/integrantes del tablero/u);
    expect(text).toMatch(/10 de noviembre de 2026/u);
  });

  it("los términos absorben lo vigente de los de Fun TasKing: exportar, sin usos críticos y la licencia GPL v3", async () => {
    const text = plain(await page("terminos"));
    expect(text).toMatch(/export/u);
    expect(text).toMatch(/información crítica/u);
    expect(text).toMatch(/GNU General Public License v3/u);
  });
});

describe("fecha de «Última actualización»", () => {
  it.each(["privacidad", "terminos"])("%s tiene una fecha legible", async (name) => {
    expect(updatedDate(await page(name))).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});
