import { describe, it, expect, beforeEach, vi } from "vitest";
import { on, off, emit, reset } from "../public/js/core/bus.js";

describe("bus de eventos del frontend", () => {
  beforeEach(() => { reset(); });

  it("entrega el payload a los suscriptos", () => {
    const visto = [];
    on("tarjeta:guardada", (p) => visto.push(p));
    emit("tarjeta:guardada", { id: "abc" });
    expect(visto).toEqual([{ id: "abc" }]);
  });

  it("no hace nada si nadie escucha", () => {
    expect(() => emit("evento:sin-oyentes", 1)).not.toThrow();
  });

  it("entrega a todos los suscriptos del mismo evento", () => {
    const a = vi.fn(), b = vi.fn();
    on("x", a); on("x", b);
    emit("x");
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("la función que devuelve on() desuscribe", () => {
    const fn = vi.fn();
    const desuscribir = on("x", fn);
    desuscribir();
    emit("x");
    expect(fn).not.toHaveBeenCalled();
  });

  it("off() desuscribe igual que el retorno de on()", () => {
    const fn = vi.fn();
    on("x", fn);
    off("x", fn);
    emit("x");
    expect(fn).not.toHaveBeenCalled();
  });

  it("un oyente que falla no impide que corran los demás", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const despues = vi.fn();
    on("x", () => { throw new Error("boom"); });
    on("x", despues);
    emit("x");
    expect(despues).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("un oyente puede desuscribirse a sí mismo durante la notificación", () => {
    const visto = [];
    const desuscribir = on("x", () => { visto.push(1); desuscribir(); });
    emit("x");
    emit("x");
    expect(visto).toEqual([1]);
  });
});
