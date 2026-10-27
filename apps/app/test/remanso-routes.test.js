import { describe, expect, it, vi } from "vitest";
import { AMBIENTS, DURATIONS } from "../public/remanso/remanso-engine.js";
import { GONG_IDS } from "../public/remanso/remanso-gongs.js";
import { app } from "../src/index.js";
import { REMANSO_ACCESO } from "../src/remanso.js";
import { expectCleanDocument } from "./helpers/documento.js";

const ORIGIN = "https://staging.homesuite.info";
const SECRET = "s".repeat(32);
const WITH_GOOGLE = { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret", SESSION_SECRET: SECRET };

describe("niveles de acceso de Remanso", () => {
  it("el volumen inicial del fondo es 58 en los dos niveles y el control lo muestra", () => {
    expect(REMANSO_ACCESO.libre.inicial.volumen).toBe(58);
    expect(REMANSO_ACCESO.cuenta.inicial.volumen).toBe(58);
  });

  it("el nivel libre es un subconjunto de lo que ofrece el motor y sus valores iniciales son válidos", () => {
    const { libre, cuenta } = REMANSO_ACCESO;
    expect(libre.minutos).toEqual([1, 2, 5]);
    expect(libre.fondos).toEqual(["silencio", "agua", "bosque"]);
    expect(libre.minutos.every((minutes) => DURATIONS.includes(minutes))).toBe(true);
    expect(libre.fondos.every((ambient) => AMBIENTS.includes(ambient))).toBe(true);
    expect(libre.minutos).toContain(libre.inicial.minutos);
    expect(libre.fondos).toContain(libre.inicial.fondo);
    expect(libre.gongs).toEqual(["brillante"]);
    expect(libre.gongs.every((id) => GONG_IDS.includes(id))).toBe(true);
    expect(libre.gongs).toContain(libre.inicial.gong);
    expect(cuenta.minutos).toEqual(DURATIONS);
    expect(cuenta.fondos).toEqual(AMBIENTS);
    expect(cuenta.gongs).toEqual(GONG_IDS);
    expect(cuenta.minutos).toContain(cuenta.inicial.minutos);
    expect(cuenta.fondos).toContain(cuenta.inicial.fondo);
    expect(cuenta.gongs).toContain(cuenta.inicial.gong);
  });
});

describe("GET /remanso sin sesión", () => {
  it("abre el nivel libre sin nombre, con acceso a Google y cabeceras de seguridad", async () => {
    const response = await app.request(`${ORIGIN}/remanso`, {}, WITH_GOOGLE);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'; style-src 'self'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    const html = await response.text();
    expect(html).toContain('data-acceso="libre"');
    expect(html).toContain('data-libre-minutos="1,2,5"');
    expect(html).toContain('data-libre-fondos="silencio,agua,bosque"');
    expect(html).toContain('data-inicial-minutos="5" data-inicial-fondo="agua" data-inicial-gong="brillante" data-inicial-volumen="58"');
    expect(html).toContain('data-libre-gongs="brillante"');
    expect(html).toContain('id="rem-sonidos"');
    expect(html).not.toContain("data-nombre=");
    // el cierre no vende: la invitación a crear cuenta sólo aparece al elegir una opción con cuenta
    expect(html).not.toContain("rem-invitacion");
    expect(html).not.toContain("meditar más tiempo");
    expect(html).toContain('data-login="/auth/google?returnTo=%2Fremanso"');
    expect(html).toContain('href="/auth/google?returnTo=%2Fremanso"');
    expect(html).toContain('href="/remanso/remanso.css"');
    expect(html).toContain('<script type="module" src="/remanso/remanso.js"></script>');
    expect(html).toContain('<body class="remanso">');
    expectCleanDocument(html);
  });

  it("no consulta la base de datos si no hay cookie de sesión", async () => {
    const prepare = vi.fn(() => { throw new Error("no debería consultar D1"); });
    const response = await app.request(`${ORIGIN}/remanso`, {}, { ...WITH_GOOGLE, DB: { prepare, batch: prepare } });
    expect(response.status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("ignora una cookie de sesión falsificada sin llegar a la base de datos", async () => {
    const prepare = vi.fn(() => { throw new Error("no debería consultar D1"); });
    const response = await app.request(`${ORIGIN}/remanso`, {
      headers: { Cookie: "__Host-homesuite_session=falsa" },
    }, { ...WITH_GOOGLE, DB: { prepare, batch: prepare } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('data-acceso="libre"');
    expect(prepare).not.toHaveBeenCalled();
  });

  it("sin acceso con Google configurado no ofrece enlaces de acceso", async () => {
    const response = await app.request(`${ORIGIN}/remanso`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-acceso="libre"');
    expect(html).not.toContain("data-login=");
    expect(html).not.toContain("/auth/google");
    expectCleanDocument(html);
  });

  it("el usuario local no existe fuera de localhost, aunque haya modo local", async () => {
    const response = await app.request(`${ORIGIN}/remanso`, {}, { DEV_LOCAL_MODE: "true", DEV_LOCAL_EMAIL: "zelda@example.test" });
    expect(await response.text()).toContain('data-acceso="libre"');
  });
});
