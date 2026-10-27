// Remanso · sonidos de gong elegibles.
//
// Se sintetizan en el dispositivo, con el mismo grafo de audio que el gong del paquete
// (osciladores sinusoidales con caída exponencial + un golpe de ruido filtrado), pero
// con los parámetros de cada sonido. `SuiteEngine` reemplaza únicamente `gong()`:
// el motor (remanso-engine.js) sigue siendo el del paquete, sin editar. Con el mismo método
// reemplaza `windGust()` para bajar las ráfagas del bosque (ver FACTOR_VIENTO).
//
// Los tres sonidos se afinaron de oído con Pablo (2026-10-26). Ninguno oscila de
// volumen («wa-wa»): el desafinado entre los dos osciladores de cada parcial es mínimo
// (o desbalanceado), y un E2E lo mide.
import { RemansoEngine } from "./remanso-engine.js";

// Parciales del gong: [razón sobre la base, amplitud, segundos hasta apagarse].
const PARCIALES = [[0.5, 0.25, 8], [1, 1, 12], [2.76, 0.45, 7], [5.4, 0.2, 4], [8.93, 0.08, 2.5]];
const SIN_BATIMIENTO = [[-0.02, 0.5], [0.02, 0.5]]; // [desafinado en Hz, parte de la amplitud]

export const GONGS = Object.freeze({
  brillante: Object.freeze({
    nombre: "Gong brillante",
    base: { inicioFin: 174.6, medio: 130.8 }, // Fa3 · Do3
    duracion: { inicioFin: 1.7, medio: 1 },
    parciales: [...PARCIALES, [11.3, 0.06, 1.6], [14.1, 0.03, 1.0]],
    pares: SIN_BATIMIENTO,
    golpe: { amp: 0.3, dur: 0.22, freq: 10, q: 1.2 },
    ataque: 0.004,
  }),
  profundo: Object.freeze({
    nombre: "Gong profundo",
    base: { inicioFin: 87.3, medio: 65.4 }, // Fa2 · Do2
    duracion: { inicioFin: 2.0, medio: 1.4 },
    parciales: PARCIALES,
    pares: SIN_BATIMIENTO,
    golpe: { amp: 0.12, dur: 0.09, freq: 6, q: 2 },
    ataque: 0.01,
  }),
  cuenco: Object.freeze({
    nombre: "Cuenco tibetano",
    base: { inicioFin: 261.6, medio: 220 },
    duracion: { inicioFin: 1.4, medio: 1 },
    parciales: [[1, 1, 14], [2.71, 0.5, 10], [5.05, 0.18, 6], [8.0, 0.06, 3]],
    pares: [[0, 0.9], [0.2, 0.1]], // temblor lento y suave (~2 dB), no una cancelación
    golpe: { amp: 0.03, dur: 0.05, freq: 4, q: 2 },
    ataque: 0.05,
  }),
});

export const GONG_IDS = Object.freeze(Object.keys(GONGS));
export const GONG_NAMES = Object.freeze(Object.fromEntries(GONG_IDS.map((id) => [id, GONGS[id].nombre])));
export const DEFAULT_GONG = "brillante";

/** Sintetiza un gong en `t`. `amp` es el volumen relativo del motor (1,5 inicio/fin, 1 medio). */
export function synthGong(ctx, noise, dest, t, amp, main, sound) {
  const base = main ? sound.base.inicioFin : sound.base.medio;
  const dm = main ? sound.duracion.inicioFin : sound.duracion.medio;
  const bus = ctx.createGain();
  bus.gain.value = 0.26 * amp;
  bus.connect(dest);
  for (const [ratio, level, seconds] of sound.parciales) {
    for (const [offset, share] of sound.pares) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = base * ratio + offset;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level * share, t + sound.ataque);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds * dm);
      osc.connect(gain); gain.connect(bus);
      osc.start(t); osc.stop(t + seconds * dm + 0.1);
    }
  }
  const strike = ctx.createBufferSource();
  strike.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = base * sound.golpe.freq;
  band.Q.value = sound.golpe.q;
  const strikeGain = ctx.createGain();
  strikeGain.gain.setValueAtTime(0, t);
  strikeGain.gain.linearRampToValueAtTime(sound.golpe.amp, t + 0.004);
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, t + sound.golpe.dur);
  strike.connect(band); band.connect(strikeGain); strikeGain.connect(bus);
  strike.start(t, Math.random() * 7); strike.stop(t + sound.golpe.dur + 0.03);
}

// Ajustes de oído con Pablo (2026-10-27). Cada número se afina por separado.
//
// Las ráfagas de viento del bosque del paquete llegan a un nivel de 0,30–0,65: sonaban muy fuertes y, como son ruido filtrado,
// parecidas a la lluvia. Se multiplican por este factor (0,0975 como máximo, igual que las hojas) y se espacian al doble.
export const FACTOR_VIENTO = 0.15;
// De las gotas de lluvia que programa el motor sólo suena esta proporción (el sonido original era muy denso).
export const DENSIDAD_GOTAS = 0.35;
// Nivel del lecho continuo de la lluvia (ruido blanco y marrón) respecto del paquete.
export const NIVEL_LECHO_LLUVIA = 0.6;

/** El motor del paquete con gong elegible, viento más suave y lluvia menos densa: sólo se reemplazan `gong()`, `windGust()`, `drop()` y `buildAmbient()`. */
export class SuiteEngine extends RemansoEngine {
  constructor() {
    super();
    this.gongId = DEFAULT_GONG;
  }

  setGong(id) {
    if (!Object.hasOwn(GONGS, id)) throw new Error(`Gong no soportado: ${id}`);
    this.gongId = id;
  }

  gong(t, amp, dest, main) {
    synthGong(this.ctx, this.buf.white, dest, t, amp, main, GONGS[this.gongId]);
  }

  // Igual que `windGust` del paquete, con el nivel de la ráfaga y de las hojas reducido por FACTOR_VIENTO y la espera hasta la
  // siguiente ráfaga al doble (24–74 s después de terminar la anterior, no 12–37 s). Las frecuencias no cambian.
  windGust(s, t) {
    const rise = 1.5 + Math.random() * 2;
    const hold = 0.5 + Math.random() * 2;
    const fall = 2 + Math.random() * 3;
    const peak = (0.3 + Math.random() * 0.35) * FACTOR_VIENTO;
    const end = t + rise + hold + fall;
    s.wind.gain.setValueAtTime(0, t);
    s.wind.gain.linearRampToValueAtTime(peak, t + rise);
    s.wind.gain.linearRampToValueAtTime(peak * (0.6 + Math.random() * 0.4), t + rise + hold);
    s.wind.gain.linearRampToValueAtTime(0, end);
    s.windBp.frequency.setValueAtTime(400, t);
    s.windBp.frequency.linearRampToValueAtTime(650 + Math.random() * 450, t + rise);
    s.windBp.frequency.linearRampToValueAtTime(420, end);
    s.leaves.gain.setValueAtTime(0, t);
    s.leaves.gain.linearRampToValueAtTime((0.012 + Math.random() * 0.015) * FACTOR_VIENTO, t + rise + 0.3);
    s.leaves.gain.linearRampToValueAtTime(0, end);
    return (end - t) + 24 + Math.random() * 50;
  }

  // Sólo suena una parte de las gotas que programa el motor: menos densidad sin tocar la intensidad que sube y baja.
  drop(t, bus, level) {
    if (Math.random() < DENSIDAD_GOTAS) super.drop(t, bus, level);
  }

  // Construye el fondo del paquete y, en la lluvia, pasa el lecho continuo por una ganancia que lo baja.
  buildAmbient(s) {
    super.buildAmbient(s);
    if (s.ambient === "lluvia") {
      const recorte = this.gain(NIVEL_LECHO_LLUVIA);
      s.rain.disconnect();
      s.rain.connect(recorte);
      recorte.connect(s.amb);
    }
  }
}
