import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import {
  canAccessSpace,
  canManageSpace,
  createPlatformId,
  normalizeEmail,
  normalizeSpaceName,
} from "../src/platform.js";

describe("fundaciones de plataforma", () => {
  it("normaliza emails de invitación y rechaza valores inválidos", () => {
    expect(normalizeEmail("  PABLO@Example.COM ")).toBe("pablo@example.com");
    expect(normalizeEmail("sin-email")).toBeNull();
  });

  it("normaliza nombres de espacio sin aceptar vacíos ni nombres extensos", () => {
    expect(normalizeSpaceName("  Casa   compartida ")).toBe("Casa compartida");
    expect(normalizeSpaceName("   ")).toBeNull();
    expect(normalizeSpaceName("x".repeat(121))).toBeNull();
  });

  it("distingue permisos de titular e integrante", () => {
    expect(canManageSpace("owner")).toBe(true);
    expect(canManageSpace("member")).toBe(false);
    expect(canAccessSpace("owner")).toBe(true);
    expect(canAccessSpace("member")).toBe(true);
    expect(canAccessSpace("other")).toBe(false);
  });

  it("crea IDs prefijados", () => {
    expect(createPlatformId("space", () => "uuid")).toBe("space_uuid");
  });

  it("expone salud, superficie inicial y API protegida", async () => {
    expect((await app.request("http://app.test/healthz")).status).toBe(200);
    expect((await app.request("http://app.test/api/me")).status).toBe(401);
    const root = await app.request("http://app.test/");
    expect(root.status).toBe(200);
    expect(root.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(root.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("exige el limitador de autenticación en staging y responde con trazabilidad", async () => {
    const response = await app.request("https://staging.homesuite.info/auth/google", undefined, { REQUIRE_RATE_LIMITS: "true" });
    expect(response.status).toBe(503);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("rechaza cuerpos de mutación demasiado grandes", async () => {
    const response = await app.request("https://app.test/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Length": "16385" },
    });
    expect(response.status).toBe(413);
  });

  it("escapa los datos que se interpolan en la interfaz local", async () => {
    const response = await app.request("http://app.test/demo/espacio?nombre=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", undefined, { DEV_LOCAL_MODE: "true" });
    const body = await response.text();
    expect(body).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(body).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("no expone las rutas de demostración fuera del modo local", async () => {
    expect((await app.request("https://app.test/demo/crear-espacio")).status).toBe(404);
  });
});
