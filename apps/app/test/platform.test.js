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
  });

  it("escapa los datos que se interpolan en la interfaz local", async () => {
    const response = await app.request("http://app.test/demo/espacio?nombre=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
    const body = await response.text();
    expect(body).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(body).not.toContain("<img src=x onerror=alert(1)>");
  });
});
