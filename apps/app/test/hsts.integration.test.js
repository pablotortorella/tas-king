import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

// Strict-Transport-Security de la app: política 1 año + subdominios, sin preload (la app es un subdominio). Se decide por hostname.
const CONTEXT = { DB: env.DB, SESSION_SECRET: "h".repeat(32) };
const POLICY = "max-age=31536000; includeSubDomains";
const hsts = async (url) => (await app.request(url, {}, CONTEXT)).headers.get("Strict-Transport-Security");

describe("HSTS de la app de HomeSuite", () => {
  it.each(["https://app.homesuite.info/", "https://staging.homesuite.info/", "https://app.homesuite.info/no-existe"])("%s envía la política", async (url) => {
    expect(await hsts(url)).toBe(POLICY);
  });

  it.each(["http://localhost/", "http://127.0.0.1/", "http://[::1]/"])("%s no la envía", async (url) => {
    expect(await hsts(url)).toBeNull();
  });

  it("«?x=localhost» en la URL no la apaga", async () => {
    expect(await hsts("https://app.homesuite.info/?x=localhost")).toBe(POLICY);
    expect(await hsts("https://app.homesuite.info/localhost/127.0.0.1")).toBe(POLICY);
  });

  it.each(["/sw.js", "/pwa.js", "/manifest.webmanifest", "/sin-conexion", "/sin-conexion/jardin-zen", "/sin-conexion/remanso"])("las rutas de la PWA (%s) la envían en producción y no en localhost", async (ruta) => {
    expect(await hsts(`https://app.homesuite.info${ruta}`)).toBe(POLICY);
    expect(await hsts(`https://staging.homesuite.info${ruta}`)).toBe(POLICY);
    expect(await hsts(`http://localhost${ruta}`)).toBeNull();
  });
});
