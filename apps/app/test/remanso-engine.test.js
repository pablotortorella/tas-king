import { describe, expect, it } from "vitest";
import { AMBIENTS, DURATIONS, RemansoEngine, gongTimes } from "../public/remanso/remanso-engine.js";

const MINUTE = 60;

describe("reglas del motor de Remanso", () => {
  it("ofrece las seis duraciones y los seis fondos del producto", () => {
    expect(DURATIONS).toEqual([1, 2, 5, 10, 20, 30]);
    expect(AMBIENTS).toEqual(["silencio", "agua", "lluvia", "bosque", "fuego", "noche"]);
  });

  it.each([
    [1, [0, 30, 60]],
    [2, [0, 60, 120]],
    [5, [0, 150, 300]],
    [10, [0, 300, 600]],
    [20, [0, 5, 10, 15, 20].map((m) => m * MINUTE)],
    [30, [0, 5, 10, 15, 20, 25, 30].map((m) => m * MINUTE)],
  ])("%i min: gongs en los momentos de INTEGRACION.md", (minutes, expected) => {
    expect(gongTimes(minutes)).toEqual(expected);
  });

  it("siempre abre y cierra con gong, y hasta 10 min son tres", () => {
    for (const minutes of DURATIONS) {
      const times = gongTimes(minutes);
      expect(times[0]).toBe(0);
      expect(times.at(-1)).toBe(minutes * MINUTE);
      if (minutes <= 10) expect(times).toHaveLength(3);
    }
  });

  it("rechaza duraciones y fondos no soportados antes de crear audio", () => {
    const engine = new RemansoEngine();
    expect(() => engine.start({ minutes: 3, ambient: "agua" })).toThrow(/Duración no soportada/u);
    expect(() => engine.start({ minutes: 5, ambient: "mar" })).toThrow(/Fondo no soportado/u);
    expect(engine.ctx).toBeNull();
    expect(engine.isRunning).toBe(false);
  });
});
