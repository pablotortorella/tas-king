import { describe, expect, it } from "vitest";
import { createGoogleAuthorization, getCookie, seal, unseal, validateGoogleIdToken, validReturnTo } from "../src/auth.js";

const encoder = new TextEncoder();

function encode(value) {
  return btoa(String.fromCharCode(...encoder.encode(JSON.stringify(value)))).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

async function signedGoogleToken(overrides = {}) {
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const header = encode({ alg: "RS256", kid: "test-key" });
  const payload = encode({ iss: "https://accounts.google.com", aud: "client-id", exp: 2_000_000_000, iat: 1_700_000_000, nonce: "nonce", sub: "google-sub", email: "zelda@example.test", email_verified: true, name: "Zelda", ...overrides });
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, encoder.encode(`${header}.${payload}`)));
  const token = `${header}.${payload}.${btoa(String.fromCharCode(...signature)).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "")}`;
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  return { token, fetcher: async () => ({ ok: true, json: async () => ({ keys: [{ ...jwk, kid: "test-key" }] }) }) };
}

describe("seguridad de OAuth", () => {
  it("crea PKCE, nonce, state y un destino interno para Google", async () => {
    const authorization = await createGoogleAuthorization({ clientId: "client-id", redirectUri: "https://app.homesuite.info/auth/callback", returnTo: "/cuentas-claras" });
    const url = new URL(authorization.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(authorization.state.state);
    expect(authorization.state.verifier).not.toBe(url.searchParams.get("code_challenge"));
    expect(authorization.state.nonce).toHaveLength(43);
    expect(authorization.state.returnTo).toBe("/cuentas-claras");
  });

  it("acepta sólo returnTo relativo seguro", () => {
    expect(validReturnTo("/cuentas-claras?espacio=uno")).toBe("/cuentas-claras?espacio=uno");
    expect(validReturnTo("https://evil.example")).toBe("/");
    expect(validReturnTo("//evil.example")).toBe("/");
    expect(validReturnTo("/\\evil.example")).toBe("/");
  });

  it("firma el estado y rechaza cualquier alteración", async () => {
    const secret = "a".repeat(32);
    const token = await seal({ state: "state" }, secret);
    await expect(unseal(token, secret)).resolves.toEqual({ state: "state" });
    await expect(unseal(`${token}x`, secret)).resolves.toBeNull();
    expect(getCookie("other=x; homesuite_oauth=token; last=y", "homesuite_oauth")).toBe("token");
  });

  it("acepta únicamente un ID token de Google firmado y con los claims esperados", async () => {
    const { token, fetcher } = await signedGoogleToken();
    await expect(validateGoogleIdToken({ idToken: token, audience: "client-id", nonce: "nonce", fetcher, now: 1_800_000_000_000 })).resolves.toEqual({ sub: "google-sub", email: "zelda@example.test", name: "Zelda" });
    for (const overrides of [{ nonce: "otro" }, { iss: "https://not-google.example" }, { aud: "other-client" }, { email_verified: false }]) {
      const invalid = await signedGoogleToken(overrides);
      await expect(validateGoogleIdToken({ idToken: invalid.token, audience: "client-id", nonce: "nonce", fetcher: invalid.fetcher, now: 1_800_000_000_000 })).rejects.toThrow("claims");
    }
  });
});
