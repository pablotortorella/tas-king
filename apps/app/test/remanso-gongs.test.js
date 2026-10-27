import { describe, expect, it } from "vitest";
import { RemansoEngine } from "../public/remanso/remanso-engine.js";
import { DEFAULT_GONG, GONGS, GONG_IDS, GONG_NAMES, SuiteEngine, synthGong } from "../public/remanso/remanso-gongs.js";

// Contexto de audio simulado: registra los osciladores que se crean.
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (extra = {}) => ({ connect() {}, ...extra });
  const oscillators = [];
  return {
    oscillators, state: "running", currentTime: 0, sampleRate: 44100,
    resume() {}, suspend() {},
    createGain: () => node({ gain: param() }),
    createOscillator() { const o = node({ type: "", frequency: { value: 0 }, start() {}, stop() {} }); oscillators.push(o); return o; },
    createBufferSource: () => node({ buffer: null, start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: "", frequency: { value: 0 }, Q: { value: 0 } }),
  };
}

const fundamental = (id, main) => (main ? GONGS[id].base.inicioFin : GONGS[id].base.medio);

function engineWith(ctx) {
  const engine = new SuiteEngine();
  engine.ensureCtx = () => { engine.ctx = ctx; engine.buf = { white: {} }; engine.master = { connect() {} }; return ctx; };
  return engine;
}

describe("sonidos de gong de Remanso", () => {
  it("son tres, con los nombres y el orden del producto", () => {
    expect(GONG_IDS).toEqual(["brillante", "profundo", "cuenco"]);
    expect(GONG_NAMES).toEqual({ brillante: "Gong brillante", profundo: "Gong profundo", cuenco: "Cuenco tibetano" });
    expect(DEFAULT_GONG).toBe("brillante");
  });

  it.each(GONG_IDS)("%s: el gong de inicio y fin es más agudo y más largo que el intermedio", (id) => {
    const sound = GONGS[id];
    expect(sound.base.inicioFin).toBeGreaterThan(sound.base.medio);
    expect(sound.duracion.inicioFin).toBeGreaterThan(sound.duracion.medio);
  });

  it.each(GONG_IDS)("%s: reparte exactamente toda la amplitud entre los dos osciladores de cada parcial", (id) => {
    expect(GONGS[id].pares.reduce((sum, [, share]) => sum + share, 0)).toBeCloseTo(1, 10);
  });

  it.each(GONG_IDS)("%s: toca su fundamental según sea inicio/fin o intermedio", (id) => {
    for (const main of [true, false]) {
      const ctx = fakeContext();
      synthGong(ctx, {}, {}, 0, main ? 1.5 : 1, main, GONGS[id]);
      const frequencies = ctx.oscillators.map((o) => o.frequency.value);
      expect(frequencies.some((f) => Math.abs(f - fundamental(id, main)) < 0.5)).toBe(true);
      expect(frequencies).toHaveLength(GONGS[id].parciales.length * GONGS[id].pares.length);
    }
  });

  it("el motor de la suite sigue siendo el del paquete: sólo reemplaza gong() y windGust()", () => {
    expect(Object.getPrototypeOf(SuiteEngine)).toBe(RemansoEngine);
    const own = Object.getOwnPropertyNames(SuiteEngine.prototype).sort();
    expect(own).toEqual(["constructor", "gong", "setGong", "windGust"]);
  });

  it("rechaza un gong que no existe y conserva el elegido", () => {
    const engine = new SuiteEngine();
    expect(engine.gongId).toBe("brillante");
    expect(() => engine.setGong("tambor")).toThrow(/Gong no soportado/u);
    expect(() => engine.setGong("__proto__")).toThrow(/Gong no soportado/u);
    expect(engine.gongId).toBe("brillante");
  });

  it.each(GONG_IDS)("«Probar gong» suena con %s", (id) => {
    const ctx = fakeContext();
    const engine = engineWith(ctx);
    engine.setGong(id);
    engine.testGong();
    const frequencies = ctx.oscillators.map((o) => o.frequency.value);
    expect(frequencies.some((f) => Math.abs(f - fundamental(id, true)) < 0.5)).toBe(true);
  });

  it("una sesión usa el sonido elegido en todos sus gongs", () => {
    const ctx = fakeContext();
    const engine = engineWith(ctx);
    engine.setGong("cuenco");
    // start() agenda un gong por cada momento: 1 min = inicio, mitad y final (3)
    const original = engine.requestWake;
    engine.requestWake = () => {};
    engine.buildAmbient = () => {};
    engine.start({ minutes: 1, ambient: "silencio", volume: 50 });
    clearInterval(engine.timer);
    engine.requestWake = original;
    const frequencies = ctx.oscillators.map((o) => o.frequency.value);
    const perGong = GONGS.cuenco.parciales.length * GONGS.cuenco.pares.length;
    expect(ctx.oscillators).toHaveLength(3 * perGong);
    const near = (target) => frequencies.filter((f) => Math.abs(f - target) < 0.5).length;
    expect(near(GONGS.cuenco.base.inicioFin)).toBe(2 * GONGS.cuenco.pares.length); // inicio y final
    expect(near(GONGS.cuenco.base.medio)).toBe(GONGS.cuenco.pares.length); // mitad
  });
});

// Registra las curvas que una ráfaga programa en la ganancia del viento, para medir su nivel sin audio.
function gustLevels(EngineClass, times) {
  const peaks = [];
  const edges = [];
  for (let i = 0; i < times; i += 1) {
    const levels = [];
    let start = null;
    const noop = { setValueAtTime() {}, linearRampToValueAtTime() {} };
    const wind = { setValueAtTime(value) { start ??= value; }, linearRampToValueAtTime(value) { levels.push(value); } };
    EngineClass.prototype.windGust.call({}, { wind: { gain: wind }, windBp: { frequency: noop }, leaves: { gain: noop } }, 0);
    peaks.push(Math.max(...levels));
    edges.push([start, levels.at(-1)]);
  }
  return { peak: Math.max(...peaks), edges };
}

describe("viento del bosque", () => {
  it("SuiteEngine limita las ráfagas a 0,20, mientras el motor del paquete llegaba a 0,65", () => {
    const base = gustLevels(RemansoEngine, 400).peak;
    const suite = gustLevels(SuiteEngine, 400);
    expect(base).toBeGreaterThan(0.6);
    expect(suite.peak).toBeLessThanOrEqual(0.2);
    expect(suite.peak).toBeGreaterThan(0.05);
    for (const [inicio, fin] of suite.edges) { expect(inicio).toBe(0); expect(fin).toBe(0); }
  });

  it("solo reemplaza windGust: el resto del fondo sigue siendo el del paquete", () => {
    for (const name of ["gust", "phrase", "start", "stop"]) expect(SuiteEngine.prototype[name]).toBe(RemansoEngine.prototype[name]);
    expect(SuiteEngine.prototype.windGust).not.toBe(RemansoEngine.prototype.windGust);
  });
});
