import { describe, expect, it, vi } from "vitest";
import { RemansoEngine } from "../public/remanso/remanso-engine.js";
import { DEFAULT_GONG, GONGS, GONG_IDS, GONG_NAMES, NIVEL_GONG, SuiteEngine, activarSesionDeAudio, synthGong } from "../public/remanso/remanso-gongs.js";

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

  it("el motor de la suite sigue siendo el del paquete: sólo reemplaza gong(), crackle(), windGust(), drop(), buildAmbient() y ensureCtx()", () => {
    expect(Object.getPrototypeOf(SuiteEngine)).toBe(RemansoEngine);
    const own = Object.getOwnPropertyNames(SuiteEngine.prototype).sort();
    expect(own).toEqual(["buildAmbient", "constructor", "crackle", "drop", "ensureCtx", "gong", "setGong", "windGust"]);
  });

  it.each([[true, 1.5], [false, 1]])("el gong baja un 25 %% respecto del paquete (inicio/fin: %s)", (main, amp) => {
    const ctx = fakeContext();
    const gains = [];
    const createGain = ctx.createGain;
    ctx.createGain = () => { const node = createGain(); gains.push(node); return node; };
    synthGong(ctx, {}, {}, 0, amp, main, GONGS.brillante);
    expect(NIVEL_GONG).toBe(0.75);
    expect(gains[0].gain.value).toBeCloseTo(0.26 * amp * 0.75, 10); // el primero es el bus del gong
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
  it("SuiteEngine deja sonar entre el 15 % y el 35 % de las gotas (un 30 % menos que el 35 % anterior) que programa el motor", () => {
    let sonaron = 0;
    const original = RemansoEngine.prototype.drop;
    RemansoEngine.prototype.drop = () => { sonaron += 1; };
    try {
      const engine = new SuiteEngine();
      for (let i = 0; i < 4000; i += 1) engine.drop(0, {}, 0.5);
    } finally { RemansoEngine.prototype.drop = original; }
    expect(sonaron / 4000).toBeGreaterThan(0.15);
    expect(sonaron / 4000).toBeLessThan(0.35);
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

describe("chispazos del fuego", () => {
  // Cuenta cuántos chasquidos suenan por llamada y con qué nivel máximo, sin audio.
  function chasquidos(EngineClass, heat, llamadas) {
    const porLlamada = [];
    let nivel = 0;
    for (let i = 0; i < llamadas; i += 1) {
      const ctx = fakeContext();
      let fuentes = 0;
      ctx.createBufferSource = () => { fuentes += 1; return { connect() {}, start() {}, stop() {}, buffer: null }; };
      const createGain = ctx.createGain;
      ctx.createGain = () => {
        const node = createGain();
        node.gain.setValueAtTime = (value) => { nivel = Math.max(nivel, value); };
        return node;
      };
      const engine = new EngineClass();
      engine.ctx = ctx; engine.buf = { white: {} };
      engine.crackle(0, {}, heat);
      porLlamada.push(fuentes);
    }
    return { porLlamada, nivel };
  }

  it("de vez en cuando suma un chispazo: varios chasquidos juntos y uno más fuerte que cualquiera del paquete", () => {
    const base = chasquidos(RemansoEngine, 0.5, 6000);
    const suite = chasquidos(SuiteEngine, 0.5, 6000);
    expect(Math.max(...base.porLlamada)).toBe(1);
    expect(base.nivel).toBeLessThanOrEqual(0.35 + 1e-9);
    const chispazos = suite.porLlamada.filter((n) => n > 1).length / 6000;
    expect(chispazos).toBeGreaterThan(0.01);
    expect(chispazos).toBeLessThan(0.05);
    expect(Math.max(...suite.porLlamada)).toBeLessThanOrEqual(12);
    expect(suite.nivel).toBeGreaterThan(0.45);
    expect(suite.nivel).toBeLessThan(0.8);
  });

  it("los chasquidos comunes siguen siendo los del paquete", () => {
    const suite = chasquidos(SuiteEngine, 0.5, 6000);
    expect(suite.porLlamada.filter((n) => n === 1).length / 6000).toBeGreaterThan(0.95);
  });
});

// En iOS 17+ el audio Web cuenta como «ambiente» y obedece el interruptor de silencio; `navigator.audioSession.type = "playback"` lo evita.
// Es una solución documentada por WebKit pero sin verificar en un iPhone real (ver el backlog), así que sólo se pide si existe.
describe("sesión de audio de iOS", () => {
  it("pide la categoría «playback» cuando el navegador ofrece audioSession", () => {
    const nav = { audioSession: { type: "auto" } };
    activarSesionDeAudio(nav);
    expect(nav.audioSession.type).toBe("playback");
  });

  it("no hace nada, ni falla, si no hay audioSession o si asignarla falla", () => {
    expect(() => activarSesionDeAudio({})).not.toThrow();
    expect(() => activarSesionDeAudio(undefined)).not.toThrow();
    const rota = { audioSession: { get type() { return "auto"; }, set type(_value) { throw new Error("no permitido"); } } };
    expect(() => activarSesionDeAudio(rota)).not.toThrow();
  });

  it("SuiteEngine la pide al crear el audio (que sólo ocurre en un gesto) y devuelve el contexto del motor", () => {
    const nav = { audioSession: { type: "auto" } };
    vi.stubGlobal("navigator", nav);
    const original = RemansoEngine.prototype.ensureCtx;
    RemansoEngine.prototype.ensureCtx = () => "contexto";
    try {
      expect(new SuiteEngine().ensureCtx()).toBe("contexto");
    } finally {
      RemansoEngine.prototype.ensureCtx = original;
      vi.unstubAllGlobals();
    }
    expect(nav.audioSession.type).toBe("playback");
  });
});
