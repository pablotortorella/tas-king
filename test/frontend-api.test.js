import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "../public/js/core/api.js";

function respuesta({ ok = true, status = 200, statusText = "OK", json } = {}) {
  return {
    ok, status, statusText,
    json: json ?? (async () => ({})),
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("api()", () => {
  it("devuelve el JSON del backend", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ json: async () => ({ id: "c1" }) })));
    await expect(api("GET", "/api/cards/c1")).resolves.toEqual({ id: "c1" });
  });

  it("devuelve null en 204, sin intentar parsear", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ status: 204, json })));
    await expect(api("DELETE", "/api/cards/c1")).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("manda Content-Type y cuerpo solo cuando hay body", async () => {
    const fetchMock = vi.fn(async () => respuesta());
    vi.stubGlobal("fetch", fetchMock);

    await api("GET", "/api/me");
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();

    await api("POST", "/api/boards", { name: "X" });
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ "Content-Type": "application/json" });
    expect(fetchMock.mock.calls[1][1].body).toBe('{"name":"X"}');
  });

  it("un body explícitamente null sí se envía", async () => {
    // `body !== undefined` es la condición: null es un cuerpo válido.
    const fetchMock = vi.fn(async () => respuesta());
    vi.stubGlobal("fetch", fetchMock);
    await api("POST", "/api/x", null);
    expect(fetchMock.mock.calls[0][1].body).toBe("null");
  });

  it("lanza con el mensaje del backend y el status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({
      ok: false, status: 403, statusText: "Forbidden",
      json: async () => ({ error: "No sos miembro de este tablero." }),
    })));
    await expect(api("GET", "/api/boards/x/cards"))
      .rejects.toThrow("No sos miembro de este tablero.");
  });

  it("cae al statusText si el cuerpo del error no es JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({
      ok: false, status: 500, statusText: "Internal Server Error",
      json: async () => { throw new Error("no es json"); },
    })));
    await expect(api("GET", "/api/me")).rejects.toThrow("Internal Server Error");
  });

  it("adjunta el status al error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ ok: false, status: 404, statusText: "Not Found" })));
    await expect(api("GET", "/api/cards/nope")).rejects.toMatchObject({ status: 404 });
  });

  it("ante access_revoked navega a /revoked y no resuelve la promesa", async () => {
    // No resolver es deliberado: si resolviera o lanzara, algún catch de arriba
    // alcanzaría a mostrar un alert() a mitad de la redirección. Ver ADR-015.
    const location = { href: "" };
    vi.stubGlobal("window", { location });
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({
      ok: false, status: 403, json: async () => ({ code: "access_revoked", error: "Acceso revocado" }),
    })));

    const pendiente = api("GET", "/api/me");
    const centinela = Symbol("sin resolver");
    const resultado = await Promise.race([
      pendiente.then(() => "resolvio", () => "rechazo"),
      Promise.resolve(centinela),
    ]);

    expect(location.href).toBe("/revoked");
    expect(resultado).toBe(centinela);
  });
});
