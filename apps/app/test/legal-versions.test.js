import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_KEYS, parseLegalDate, publishedVersion } from "../src/legal.js";

// La versión de cada texto legal es la fecha de «Última actualización» de su página (design.md, D1). Cambiar el texto sin subir la
// versión, o al revés, no pasa CI. Si hay una versión próxima anunciada, la página ya muestra el texto nuevo.
const pageHtml = (document) => readFile(new URL(`../../site/public/${document.path.slice(1)}.html`, import.meta.url), "utf8");

// Devuelve la fecha ISO de «Última actualización» de una página, o null si no la tiene.
export function pageVersion(html) {
  const match = /Última actualización: ([^<]+)</u.exec(html);
  return match ? parseLegalDate(match[1]) : null;
}

// Devuelve los problemas de alineación entre una página y la constante de su documento (vacío si coinciden).
export function alignmentProblems(key, document, html) {
  const found = pageVersion(html);
  if (!found) return [`${key}: la página no tiene fecha de «Última actualización»`];
  const expected = publishedVersion(document);
  return found === expected ? [] : [`${key}: la página dice ${found} y legal.js declara ${expected}`];
}

describe("versiones de los textos legales", () => {
  it.each(LEGAL_KEYS)("la versión de %s es la fecha de «Última actualización» de su página", async (key) => {
    expect(alignmentProblems(key, LEGAL_DOCUMENTS[key], await pageHtml(LEGAL_DOCUMENTS[key]))).toEqual([]);
  });

  it("falla si cambia una sola de las dos: la fecha de la página o la constante", async () => {
    const html = await pageHtml(LEGAL_DOCUMENTS.terms);
    const editedPage = html.replace(/Última actualización: [^<]+</u, "Última actualización: 1 de diciembre de 2027<");
    expect(alignmentProblems("terms", LEGAL_DOCUMENTS.terms, editedPage)).toEqual([expect.stringContaining("terms: la página dice 2027-12-01")]);
    expect(alignmentProblems("terms", { ...LEGAL_DOCUMENTS.terms, version: "2027-12-01" }, html)).toEqual([expect.stringContaining("legal.js declara 2027-12-01")]);
    expect(alignmentProblems("terms", LEGAL_DOCUMENTS.terms, "<p>sin fecha</p>")).toEqual([expect.stringContaining("no tiene fecha")]);
  });

  it("con una versión próxima anunciada, la página debe mostrar la versión nueva", () => {
    const upcoming = { ...LEGAL_DOCUMENTS.terms, upcoming: { version: "2027-03-01", effectiveFrom: "2027-03-15" } };
    expect(alignmentProblems("terms", upcoming, "<p>Última actualización: 1 de marzo de 2027</p>")).toEqual([]);
    expect(alignmentProblems("terms", upcoming, "<p>Última actualización: 4 de noviembre de 2026</p>")).toHaveLength(1);
  });

  it("las rutas declaradas coinciden con las páginas del sitio y con la política de enlaces", () => {
    expect(LEGAL_DOCUMENTS.terms.path).toBe("/terminos");
    expect(LEGAL_DOCUMENTS.privacy.path).toBe("/privacidad");
  });
});
