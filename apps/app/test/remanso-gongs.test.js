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

  it("el motor de la suite sigue siendo el del paquete: sólo reemplaza gong(), windGust(), drop() y buildAmbient()", () => {
    expect(Object.getPrototypeOf(SuiteEngine)).toBe(RemansoEngine);
    const own = Object.getOwnPropertyNames(SuiteEngine.prototype).sort();
    expect(own).toEqual(["buildAmbient", "constructor", "drop", "gong", "setGong", "windGust"]);
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
  it("SuiteEngine limita las ráfagas a 0,10, mientras el motor del paquete llegaba a 0,65", () => {
    const base = gustLevels(RemansoEngine, 400).peak;
    const suite = gustLevels(SuiteEngine, 400);
    expect(base).toBeGreaterThan(0.6);
    expect(suite.peak).toBeLessThanOrEqual(0.1);
    expect(suite.peak).toBeGreaterThan(0.03);
    for (const [inicio, fin] of suite.edges) { expect(inicio).toBe(0); expect(fin).toBe(0); }
  });

  it("espacia las ráfagas más que el motor: la espera hasta la siguiente nunca baja de la mínima del paquete", () => {
    // Con las duraciones mínimas de una ráfaga (1,5 + 0,5 + 2 s) el motor espera 16 s como mínimo y la suite 28 s.
    const esperas = (EngineClass) => Array.from({ length: 400 }, () => {
      const nada = { setValueAtTime() {}, linearRampToValueAtTime() {} };
      return EngineClass.prototype.windGust.call({}, { wind: { gain: nada }, windBp: { frequency: nada }, leaves: { gain: nada } }, 0);
    });
    expect(Math.min(...esperas(RemansoEngine))).toBeLessThan(28);
    expect(Math.min(...esperas(SuiteEngine))).toBeGreaterThanOrEqual(28);
  });

  it("solo reemplaza windGust: el resto del fondo sigue siendo el del paquete", () => {
    for (const name of ["gust", "phrase", "start", "stop"]) expect(SuiteEngine.prototype[name]).toBe(RemansoEngine.prototype[name]);
    expect(SuiteEngine.prototype.windGust).not.toBe(RemansoEngine.prototype.windGust);
  });
});

describe("lluvia menos densa", () => {
  it("SuiteEngine deja sonar entre el 25 % y el 45 % de las gotas que programa el motor", () => {
    let sonaron = 0;
    const original = RemansoEngine.prototype.drop;
    RemansoEngine.prototype.drop = () => { sonaron += 1; };
    try {
      const engine = new SuiteEngine();
      for (let i = 0; i < 4000; i += 1) engine.drop(0, {}, 0.5);
    } finally { RemansoEngine.prototype.drop = original; }
    expect(sonaron / 4000).toBeGreaterThan(0.25);
    expect(sonaron / 4000).toBeLessThan(0.45);
  });

  it("baja el lecho de ruido al 60 % solo en la lluvia, y los demás fondos se construyen como en el paquete", () => {
    const conexiones = (ambient, EngineClass) => {
      const ctx = fakeContext();
      const nodes = [];
      const wrap = (node) => { node.id = nodes.length; node.outputs = []; node.connect = (target) => { node.outputs.push(target); }; node.disconnect = () => { node.outputs = []; }; nodes.push(node); return node; };
      const parametro = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
      ctx.createBiquadFilter = () => ({ connect() {}, type: "", frequency: parametro(), Q: parametro() });
      ctx.createOscillator = () => ({ connect() {}, start() {}, stop() {}, type: "", frequency: parametro() });
      const factory = ctx.createGain;
      ctx.createGain = () => { const node = wrap(factory()); node.gain.value = 1; return node; };
      const engine = new EngineClass();
      engine.ctx = ctx; engine.buf = { white: {}, brown: {} };
      engine.noise = () => ({ connect() {}, start() {} });
      const dest = wrap({});
      const s = { ambient, t0: 0, amb: dest };
      engine.buildAmbient(s);
      return { s, dest };
    };
    const base = conexiones("lluvia", RemansoEngine);
    expect(base.s.rain.outputs).toEqual([base.dest]);
    const suite = conexiones("lluvia", SuiteEngine);
    expect(suite.s.rain.outputs).toHaveLength(1);
    const recorte = suite.s.rain.outputs[0];
    expect(recorte).not.toBe(suite.dest);
    expect(recorte.outputs).toEqual([suite.dest]);
    const otro = conexiones("agua", SuiteEngine);
    expect(otro.s.rain).toBeUndefined();
  });
});
