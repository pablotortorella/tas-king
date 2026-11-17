import { afterEach, describe, expect, it } from "vitest";
import {
  formatLegalDate, isGateExempt, LEGAL_DOCUMENTS, legalGateEnabled, legalLinks, parseLegalDate, pendingDocuments, publishedVersion,
  requiredVersions, sanitizeVersions, siteUrl, SITE_URL, upcomingNotices, useLegalDocuments,
} from "../src/legal.js";
import { renderAcceptPage, renderLegalBand, renderLegalFooter, renderSignInNotice, signInHref } from "../src/legal-ui.js";
import { taskingDocument } from "../src/tasking/document.js";

// Versiones de los textos legales, enlaces por ambiente, franja de versión próxima y puerta (design.md, D1, D4, D5 y D6).
afterEach(() => useLegalDocuments(null));

const docs = (terms = {}, privacy = {}) => ({ terms: { ...LEGAL_DOCUMENTS.terms, ...terms }, privacy: { ...LEGAL_DOCUMENTS.privacy, ...privacy } });
const day = (iso, hour = 12) => Date.parse(`${iso}T${String(hour).padStart(2, "0")}:00:00-05:00`);

describe("enlaces a los textos legales por ambiente", () => {
  it("la aplicación de producción lleva al sitio de producción", () => {
    expect(legalLinks("app.homesuite.info")).toEqual({ terms: "https://homesuite.info/terminos", privacy: "https://homesuite.info/privacidad" });
  });

  it.each([["app.homesuite.info", SITE_URL.production], ["staging.homesuite.info", SITE_URL.staging]])("el pie de Tareas en %s enlaza los textos de toda la suite", (host, base) => {
    const footer = /<footer class="app-footer">[\s\S]*?<\/footer>/u.exec(taskingDocument(host))[0];
    expect(footer).toContain(`href="${base}/terminos"`);
    expect(footer).toContain(`href="${base}/privacidad"`);
    expect(footer).not.toContain("terminos-anteriores");
  });

  it.each(["staging.homesuite.info", "localhost", "127.0.0.1", "app.test"])("%s lleva al sitio de staging", (host) => {
    expect(legalLinks(host)).toEqual({ terms: "https://site-staging.homesuite.info/terminos", privacy: "https://site-staging.homesuite.info/privacidad" });
    expect(siteUrl(host)).toBe(SITE_URL.staging);
  });

  it("el aviso de acceso lleva los dos enlaces, la aceptación y los 18 años", () => {
    const html = renderSignInNotice("app.homesuite.info");
    expect(html).toContain("Al continuar aceptás los");
    expect(html).toContain("18 años o más");
    expect(html).toContain('href="https://homesuite.info/terminos"');
    expect(html).toContain('href="https://homesuite.info/privacidad"');
    expect(renderSignInNotice("staging.homesuite.info")).toContain('href="https://site-staging.homesuite.info/terminos"');
  });

  it("el pie y el botón de acceso apuntan a lo mismo en cada ambiente", () => {
    expect(renderLegalFooter("app.homesuite.info")).toContain(">Privacidad</a>");
    expect(renderLegalFooter("app.homesuite.info")).toContain("Términos y condiciones</a>");
    expect(renderLegalFooter("staging.homesuite.info")).toContain("https://site-staging.homesuite.info/privacidad");
    expect(signInHref("/remanso")).toBe("/auth/google?returnTo=%2Fremanso&amp;acepta=1");
  });
});

describe("versión exigida y versión próxima", () => {
  it("sin versión próxima se exige la vigente", () => {
    expect(requiredVersions(day("2027-01-01"))).toEqual({ terms: LEGAL_DOCUMENTS.terms.version, privacy: LEGAL_DOCUMENTS.privacy.version });
  });

  it("con una versión próxima se exige la nueva recién desde su fecha, en hora de Colombia", () => {
    const documents = docs({}, { upcoming: { version: "2027-01-15", effectiveFrom: "2027-01-15" } });
    const old = LEGAL_DOCUMENTS.privacy.version;
    expect(requiredVersions(day("2027-01-05"), documents).privacy).toBe(old);
    // 14/01 a las 23:59 en Colombia todavía no rige; 15/01 a las 00:00 sí.
    expect(requiredVersions(Date.parse("2027-01-14T23:59:00-05:00"), documents).privacy).toBe(old);
    expect(requiredVersions(Date.parse("2027-01-15T00:00:00-05:00"), documents).privacy).toBe("2027-01-15");
    expect(requiredVersions(day("2027-02-01"), documents).terms).toBe(LEGAL_DOCUMENTS.terms.version);
  });

  it("la franja de aviso aparece mientras la versión próxima no rige y desaparece al regir", () => {
    const documents = docs({}, { upcoming: { version: "2027-01-15", effectiveFrom: "2027-01-15" } });
    const notices = upcomingNotices(day("2027-01-05"), documents);
    expect(notices).toEqual([{ key: "privacy", title: "Política de privacidad", path: "/privacidad", version: "2027-01-15", effectiveFrom: "2027-01-15" }]);
    expect(upcomingNotices(day("2027-01-15", 8), documents)).toEqual([]);
    expect(upcomingNotices(day("2027-01-05"), docs())).toEqual([]);
    const band = renderLegalBand(notices, "app.homesuite.info", documents);
    expect(band).toContain("15 de enero de 2027");
    expect(band).toContain("Política de privacidad");
    expect(band).toContain('href="https://homesuite.info/privacidad"');
    expect(renderLegalBand([], "app.homesuite.info")).toBe("");
  });

  it("la versión publicada en la página es la próxima si ya está anunciada", () => {
    expect(publishedVersion(LEGAL_DOCUMENTS.terms)).toBe(LEGAL_DOCUMENTS.terms.version);
    expect(publishedVersion({ ...LEGAL_DOCUMENTS.terms, upcoming: { version: "2027-03-01", effectiveFrom: "2027-03-15" } })).toBe("2027-03-01");
  });

  it("convierte entre la fecha ISO y la de «Última actualización»", () => {
    expect(formatLegalDate("2026-11-04")).toBe("4 de noviembre de 2026");
    expect(parseLegalDate("Última actualización: 4 de noviembre de 2026")).toBe("2026-11-04");
    expect(parseLegalDate("Última actualización: 27 de octubre de 2026")).toBe("2026-10-27");
    expect(parseLegalDate("sin fecha")).toBeNull();
  });
});

describe("qué está pendiente de aceptar", () => {
  const required = { terms: "2026-11-04", privacy: "2026-11-04" };

  it("pide lo que nunca se aceptó y lo anterior a la versión exigida", () => {
    expect(pendingDocuments({}, required)).toEqual(["terms", "privacy"]);
    expect(pendingDocuments({ terms: "2026-10-27", privacy: "2026-11-04" }, required)).toEqual(["terms"]);
    expect(pendingDocuments({ terms: "2026-11-04", privacy: "2026-11-04" }, required)).toEqual([]);
  });

  it("una versión aceptada posterior a la exigida no vuelve a pedirse (reversión de la constante)", () => {
    expect(pendingDocuments({ terms: "2026-12-01", privacy: "2026-12-01" }, required)).toEqual([]);
  });

  it("solo valen las versiones que el sistema publicó", () => {
    expect(sanitizeVersions({ terms: "2026-11-13", privacy: "1999-01-01", otro: "2026-11-13" })).toEqual({ terms: "2026-11-13" });
    // El borrador del 2026-11-04 nunca se publicó: el del 2026-11-13 lo reemplazó antes de integrarse.
    expect(sanitizeVersions({ terms: "2026-11-04" })).toEqual({});
    expect(sanitizeVersions({ terms: "no", privacy: 5 }, undefined, required)).toEqual(required);
    expect(sanitizeVersions(null)).toEqual({});
    const documents = docs({}, { upcoming: { version: "2027-01-15", effectiveFrom: "2027-01-15" } });
    expect(sanitizeVersions({ privacy: "2027-01-15" }, documents)).toEqual({ privacy: "2027-01-15" });
  });
});

describe("la puerta de nueva aceptación", () => {
  it("está apagada salvo LEGAL_GATE=on", () => {
    expect(legalGateEnabled({})).toBe(false);
    expect(legalGateEnabled(undefined)).toBe(false);
    expect(legalGateEnabled({ LEGAL_GATE: "off" })).toBe(false);
    expect(legalGateEnabled({ LEGAL_GATE: "true" })).toBe(false);
    expect(legalGateEnabled({ LEGAL_GATE: "on" })).toBe(true);
  });

  it.each([
    ["GET", "/aceptar"], ["POST", "/aceptar"], ["POST", "/auth/logout"], ["GET", "/auth/google"], ["GET", "/auth/callback"],
    ["GET", "/healthz"], ["GET", "/app.css"], ["GET", "/ledger-ui.js"], ["GET", "/shell.js"],
    ["GET", "/groups/casa/ledger/export.json"], ["GET", "/groups/casa/ledger/export.csv"],
    ["GET", "/sw.js"], ["GET", "/pwa.js"], ["GET", "/manifest.webmanifest"], ["GET", "/sin-conexion"], ["GET", "/sin-conexion/jardin-zen"],
    ["GET", "/sin-conexion/remanso"],
  ])("%s %s sigue disponible con una versión pendiente", (method, path) => {
    expect(isGateExempt(method, path)).toBe(true);
  });

  it.each([
    ["GET", "/"], ["GET", "/cuentas-claras"], ["GET", "/groups/casa"], ["POST", "/groups"], ["POST", "/groups/casa/participants"],
    ["GET", "/api/me"], ["PATCH", "/api/me/profile"], ["GET", "/perfil"], ["GET", "/remanso"], ["POST", "/groups/casa/ledger/export.json"],
    ["GET", "/groups/casa/ledger/export.json/otra"], ["GET", "/api/datos.json"],
    ["GET", "/tareas"], ["GET", "/api/tareas/boards"], ["GET", "/sin-conexion-otra"], ["POST", "/manifest.webmanifest"],
  ])("%s %s queda detrás de la puerta", (method, path) => {
    expect(isGateExempt(method, path)).toBe(false);
  });
});

describe("pantalla de nueva aceptación", () => {
  const versions = { terms: "2026-11-04", privacy: "2026-11-04" };
  const render = (accepted, pending) => renderAcceptPage({ pending, accepted, versions, hostname: "app.homesuite.info", csrf: '<input type="hidden" name="_csrf" value="t">', next: "/groups/casa", documents: LEGAL_DOCUMENTS });

  it("dice qué texto cambió, enlaza a ambos y ofrece aceptar o cerrar sesión", () => {
    const html = render({ terms: "2026-10-27", privacy: "2026-10-27" }, ["privacy"]);
    expect(html).toContain("Actualizamos nuestros textos");
    expect(html).toContain("Cambió: versión del 4 de noviembre de 2026");
    expect(html).toContain("Sin cambios");
    expect(html).toContain('href="https://homesuite.info/terminos"');
    expect(html).toContain('href="https://homesuite.info/privacidad"');
    expect(html).toContain("Aceptar y continuar");
    expect(html).toContain('action="/auth/logout"');
    expect(html).toContain("No acepto: cerrar sesión");
    expect(html).toContain('name="next" value="/groups/casa"');
    expect(html).toContain("18 años o más");
  });

  it("a quien nunca aceptó nada le pide aceptar ambos textos", () => {
    const html = render({}, ["terms", "privacy"]);
    expect(html).toContain("Antes de seguir");
    expect(html.match(/Para aceptar: versión del/gu)).toHaveLength(2);
  });
});
