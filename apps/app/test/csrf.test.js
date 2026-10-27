import { describe, expect, it } from "vitest";
import { createCsrfToken, hasTrustedOrigin, validateCsrfRequest } from "../src/csrf.js";

describe("protección CSRF", () => {
  const secret = "c".repeat(32);

  it("acepta sólo Origin o Referer del mismo origen", () => {
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Origin: "https://app.test" } }))).toBe(true);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Referer: "https://app.test/groups/new" } }))).toBe(true);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Origin: "https://other.test" } }))).toBe(false);
    expect(hasTrustedOrigin(new Request("https://app.test/groups"))).toBe(false);
  });

  it("acepta Fetch Metadata de mismo origen sólo cuando no hay un origen explícito", () => {
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { "Sec-Fetch-Site": "same-origin" } }))).toBe(true);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Origin: "null", "Sec-Fetch-Site": "same-origin" } }))).toBe(true);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Origin: "null", "Sec-Fetch-Site": "cross-site" } }))).toBe(false);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { Origin: "https://other.test", "Sec-Fetch-Site": "same-origin" } }))).toBe(false);
    expect(hasTrustedOrigin(new Request("https://app.test/groups", { headers: { "Sec-Fetch-Site": "cross-site" } }))).toBe(false);
  });

  it("liga el token firmado a una sesión concreta", async () => {
    const token = await createCsrfToken({ sessionId: "session-one", secret });
    const request = new Request("https://app.test/groups", {
      method: "POST",
      headers: { Origin: "https://app.test", "X-CSRF-Token": token },
    });
    await expect(validateCsrfRequest(request, { sessionId: "session-one", secret })).resolves.toBe(true);
    await expect(validateCsrfRequest(request, { sessionId: "session-two", secret })).resolves.toBe(false);
  });

  it("acepta el token enviado por un formulario del mismo origen", async () => {
    const token = await createCsrfToken({ sessionId: "session-form", secret });
    const request = new Request("https://app.test/groups", {
      method: "POST",
      headers: { Origin: "https://app.test", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ _csrf: token, name: "Casa" }),
    });
    await expect(validateCsrfRequest(request, { sessionId: "session-form", secret })).resolves.toBe(true);
  });
});
