/**
 * Remanso · motor de sonido (HomeSuite)
 *
 * Web Audio puro, sin dependencias y sin archivos de audio: el gong y los
 * seis fondos se sintetizan en el navegador (cero licencias, cero descargas).
 *
 *   import { RemansoEngine } from './remanso-engine.js';
 *   const engine = new RemansoEngine();
 *   engine.on('tick', (t) => ...);   // { elapsed, remaining, duration, nextGong, paused }
 *   engine.on('end',  (e) => ...);   // { early, played, minutes }
 *   engine.on('pause', (p) => ...);  // { paused }
 *   engine.start({ minutes: 10, ambient: 'lluvia', volume: 55 }); // SIEMPRE desde un click/tap
 *
 * Ver INTEGRACION.md para la API completa.
 */

export const DURATIONS = [1, 2, 5, 10, 20, 30];
export const AMBIENTS = ['silencio', 'agua', 'lluvia', 'bosque', 'fuego', 'noche'];

/** Momentos (en segundos) en que suena el gong.
 *  Hasta 10 min: inicio, mitad y final. Más de 10 min: cada 5 min, incluidos inicio y final. */
export function gongTimes(minutes) {
  const D = minutes * 60;
  if (D <= 600) return [0, D / 2, D];
  const out = [];
  for (let t = 0; t <= D; t += 300) out.push(t);
  return out;
}

export class RemansoEngine {
  constructor() {
    this.ctx = null;
    this.session = null;
    this.timer = null;
    this.wake = null;
    this.paused = false;
    this.muted = false;
    this.listeners = { tick: [], end: [], pause: [] };
  }

  // ---------- eventos ----------
  on(event, fn) {
    (this.listeners[event] = this.listeners[event] || []).push(fn);
    return () => { this.listeners[event] = this.listeners[event].filter((f) => f !== fn); };
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  }

  get isRunning() { return !!this.session; }

  // ---------- API pública ----------
  /** Empieza una sesión. Llamar SIEMPRE desde un gesto del usuario (click/tap):
   *  los navegadores no dejan sonar audio sin uno. */
  start({ minutes = 10, ambient = 'silencio', volume = 55 } = {}) {
    if (!DURATIONS.includes(minutes)) throw new Error('Duración no soportada: ' + minutes);
    if (!AMBIENTS.includes(ambient)) throw new Error('Fondo no soportado: ' + ambient);
    const ctx = this.ensureCtx();
    if (ctx.state !== 'running') ctx.resume();
    if (this.session) this.fadeOutSession(this.session, 0.5);

    const D = minutes * 60;
    const t0 = ctx.currentTime + 0.15;
    const bus = this.gain(1);
    bus.connect(this.master);
    const amb = this.gain(0);
    const mute = this.gain(1);
    amb.connect(mute); mute.connect(bus);

    const v = Math.pow(Math.max(0, Math.min(100, volume)) / 100, 2);
    amb.gain.setValueAtTime(0, t0);
    amb.gain.linearRampToValueAtTime(v, t0 + 4);
    amb.gain.setValueAtTime(v, t0 + D);
    amb.gain.linearRampToValueAtTime(0, t0 + D + 6);

    gongTimes(minutes).forEach((g) => {
      const main = g === 0 || g === D; // inicio y final: más agudo, fuerte y largo
      this.gong(t0 + g, main ? 1.5 : 1, bus, main);
    });

    this.session = { t0, D, minutes, bus, amb, mute, ambient, nextDrop: t0, nextChirp: t0 + 1 };
    this.buildAmbient(this.session);

    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 200);
    this.paused = false;
    this.muted = false;
    this.requestWake();
  }

  pause() {
    if (!this.session || this.paused) return;
    this.ctx.suspend();
    this.paused = true;
    this.emit('pause', { paused: true });
  }

  resume() {
    if (!this.session || !this.paused) return;
    this.ctx.resume();
    this.paused = false;
    this.requestWake();
    this.emit('pause', { paused: false });
  }

  togglePause() { this.paused ? this.resume() : this.pause(); }

  setAmbientMuted(muted) {
    const s = this.session;
    if (!s) return;
    this.muted = !!muted;
    s.mute.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.3);
  }

  /** Termina antes de tiempo (con fundido de 1,2 s). */
  stop() { this.finish(true); }

  /** Toca el gong de inicio/fin. También desde un click/tap. */
  testGong() {
    const ctx = this.ensureCtx();
    if (ctx.state !== 'running') ctx.resume();
    this.gong(ctx.currentTime + 0.05, 1.5, this.master, true);
  }

  /** Libera todo (al desmontar la pantalla). */
  dispose() {
    clearInterval(this.timer);
    this.timer = null;
    this.releaseWake();
    this.session = null;
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* nada */ } }
    this.ctx = null;
  }

  // ---------- reloj de la sesión ----------
  tick() {
    const s = this.session;
    if (!s || !this.ctx) return;
    const now = this.ctx.currentTime;
    const el = Math.max(0, now - s.t0);
    const endAt = s.t0 + s.D;

    if (s.ambient === 'lluvia') {
      while (s.nextGust < now + 1 && s.nextGust < endAt) s.nextGust += this.gust(s, s.nextGust);
      while (s.gusts.length && s.gusts[0].at <= now) s.level = s.gusts.shift().lvl;
      while (s.nextDrop < now + 0.3 && s.nextDrop < endAt) {
        this.drop(Math.max(s.nextDrop, now), s.amb, s.level);
        s.nextDrop += (0.015 + Math.random() * 0.1) / (0.3 + s.level * 1.4);
      }
    }
    if (s.ambient === 'agua') {
      while (s.nextWave < now + 2 && s.nextWave < endAt) s.nextWave += this.wave(s, s.nextWave);
    }
    if (s.ambient === 'bosque') {
      while (s.nextWind < now + 1 && s.nextWind < endAt) s.nextWind += this.windGust(s, s.nextWind);
      while (s.nextChirp < now + 0.3 && s.nextChirp < endAt) {
        this.phrase(Math.max(s.nextChirp, now), s.amb);
        s.nextChirp += 1 + Math.random() * 4.5;
      }
    }
    if (s.ambient === 'fuego') {
      while (s.nextFlare < now + 1 && s.nextFlare < endAt) s.nextFlare += this.flare(s, s.nextFlare);
      while (s.heatQ.length && s.heatQ[0].at <= now) s.heat = s.heatQ.shift().heat;
      while (s.nextCrackle < now + 0.3 && s.nextCrackle < endAt) {
        const tc = Math.max(s.nextCrackle, now);
        if (Math.random() < 0.15) {
          const n = 3 + Math.floor(Math.random() * 6);
          for (let c = 0; c < n; c++) this.crackle(tc + c * (0.01 + Math.random() * 0.04), s.amb, s.heat);
        } else {
          this.crackle(tc, s.amb, s.heat);
        }
        s.nextCrackle += (0.05 + Math.random() * 0.55) / (0.5 + s.heat * 2);
      }
    }
    if (s.ambient === 'noche') {
      s.crickets.forEach((cr) => {
        while (cr.next < now + 0.3 && cr.next < endAt) {
          if (cr.next >= cr.restUntil) this.chirp(Math.max(cr.next, now), s.amb, cr);
          cr.next += cr.period * (0.95 + Math.random() * 0.1);
          if (Math.random() < 0.004) cr.restUntil = cr.next + 4 + Math.random() * 12;
        }
      });
      while (s.nextFrog < now + 0.3 && s.nextFrog < endAt) {
        this.frog(Math.max(s.nextFrog, now), s.amb);
        s.nextFrog += 4 + Math.random() * 11;
      }
    }

    // el sistema (p. ej. una llamada en iOS) puede suspender el audio: lo tratamos como pausa
    if (this.ctx.state === 'suspended' && !this.paused) {
      this.paused = true;
      this.emit('pause', { paused: true });
    }

    if (el >= s.D) { this.finish(false); return; }

    const times = gongTimes(s.minutes);
    const next = times.find((g) => g > el + 0.05);
    this.emit('tick', {
      elapsed: el,
      remaining: s.D - el,
      duration: s.D,
      paused: this.paused,
      nextGong: next == null ? null : { in: next - el, final: next === s.D }
    });
  }

  finish(early) {
    const s = this.session;
    clearInterval(this.timer);
    this.timer = null;
    this.releaseWake();
    if (!s) return;
    const el = Math.min(s.D, Math.max(0, this.ctx.currentTime - s.t0));
    if (early) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      this.fadeOutSession(s, 1.2);
    } else {
      // el gong final y el fundido del fondo ya están programados: dejarlos sonar
      setTimeout(() => { try { s.bus.disconnect(); } catch (e) { /* nada */ } }, 24000);
    }
    this.session = null;
    this.paused = false;
    this.emit('end', { early, played: early ? el : s.D, minutes: s.minutes });
  }

  fadeOutSession(s, secs) {
    const now = this.ctx.currentTime;
    s.bus.gain.cancelScheduledValues(now);
    s.bus.gain.setValueAtTime(s.bus.gain.value, now);
    s.bus.gain.linearRampToValueAtTime(0, now + secs);
    setTimeout(() => { try { s.bus.disconnect(); } catch (e) { /* nada */ } }, secs * 1000 + 300);
  }

  // ---------- pantalla encendida ----------
  requestWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then((l) => { this.wake = l; }).catch(() => {});
      }
    } catch (e) { /* no soportado */ }
  }

  releaseWake() {
    try { if (this.wake) this.wake.release(); } catch (e) { /* nada */ }
    this.wake = null;
  }

  // ---------- audio base ----------
  ensureCtx() {
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);

    const len = ctx.sampleRate * 8;
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let j = 0; j < len; j++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[j] = last * 3.5;
    }
    // sin salto en el loop: alinear el final con el inicio
    const drift = b[len - 1] - b[0];
    for (let k = 0; k < len; k++) b[k] -= drift * k / (len - 1);
    this.buf = { white, brown };
    return ctx;
  }

  noise(type, t) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.buf[type];
    s.loop = true;
    s.start(t, Math.random() * 7);
    return s;
  }

  filter(type, freq, q) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  }

  gain(v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  lfo(rate, depth, param, t) {
    const o = this.ctx.createOscillator();
    o.frequency.value = rate;
    const g = this.gain(depth);
    o.connect(g); g.connect(param);
    o.start(t);
    return o;
  }

  pan(node, dest, value) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = value == null ? Math.random() * 1.6 - 0.8 : value;
      node.connect(p); p.connect(dest);
    } else {
      node.connect(dest);
    }
  }

  // ---------- gong ----------
  gong(t, amp, dest, main) {
    const ctx = this.ctx;
    const base = main ? 174.6 : 130.8;   // Fa3 (inicio/fin) · Do3 (intermedios)
    const dm = main ? 1.7 : 1;           // inicio/fin dura ~70 % más
    const partials = [[0.5, 0.25, 8], [1, 1, 12], [2.76, 0.45, 7], [5.4, 0.2, 4], [8.93, 0.08, 2.5]];
    const bus = this.gain(0.26 * amp);
    bus.connect(dest);
    partials.forEach((p) => {
      [-0.4, 0.4].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = base * p[0] + det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(p[1] / 2, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + p[2] * dm);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + p[2] * dm + 0.1);
      });
    });
    const s = ctx.createBufferSource();
    s.buffer = this.buf.white;
    const bp = this.filter('bandpass', base * 6, 2);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.12, t + 0.004);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(bp); bp.connect(sg); sg.connect(bus);
    s.start(t, Math.random() * 7); s.stop(t + 0.12);
  }

  // ---------- fondos ----------
  buildAmbient(s) {
    const type = s.ambient, t = s.t0, dest = s.amb;
    const chain = (src, nodes, out) => {
      let cur = src;
      nodes.forEach((n) => { cur.connect(n); cur = n; });
      cur.connect(out);
    };
    if (type === 'lluvia') {
      // lecho cuya intensidad sube y baja en tramos (ver gust)
      s.rain = this.gain(0.5);
      s.rain.connect(dest);
      s.rainLp = this.filter('lowpass', 5500);
      chain(this.noise('white', t), [this.filter('highpass', 500), s.rainLp, this.gain(0.13)], s.rain);
      chain(this.noise('brown', t), [this.filter('lowpass', 900), this.gain(0.45)], s.rain);
      s.rain.gain.setValueAtTime(0.5, t);
      s.rainLp.frequency.setValueAtTime(5500, t);
      s.level = 0.5; s.gusts = []; s.nextGust = t;
    }
    if (type === 'agua') {
      // olas de duración irregular (ver wave)
      s.waveBp = this.filter('bandpass', 300, 0.7);
      s.wave = this.gain(0.45);
      chain(this.noise('brown', t), [s.waveBp, s.wave], dest);
      s.foamBp = this.filter('bandpass', 1800, 4);
      s.foam = this.gain(0.02);
      chain(this.noise('white', t), [s.foamBp, s.foam], dest);
      this.lfo(0.6, 700, s.foamBp.frequency, t);
      s.waveBp.frequency.setValueAtTime(300, t);
      s.wave.gain.setValueAtTime(0.45, t);
      s.foam.gain.setValueAtTime(0.02, t);
      s.nextWave = t;
    }
    if (type === 'bosque') {
      // pájaros (ver phrase) + ráfagas de viento ocasionales (ver windGust)
      s.windBp = this.filter('bandpass', 450, 1.2);
      s.wind = this.gain(0);
      chain(this.noise('white', t), [s.windBp, s.wind], dest);
      s.leaves = this.gain(0);
      chain(this.noise('white', t), [this.filter('highpass', 3000), s.leaves], dest);
      s.wind.gain.setValueAtTime(0, t);
      s.leaves.gain.setValueAtTime(0, t);
      s.windBp.frequency.setValueAtTime(450, t);
      s.nextWind = t + 6 + Math.random() * 10;
    }
    if (type === 'fuego') {
      // rumor grave que se aviva y se calma + chasquidos (ver flare, crackle)
      s.roarLp = this.filter('lowpass', 320);
      s.roar = this.gain(0.25);
      chain(this.noise('brown', t), [s.roarLp, s.roar], dest);
      chain(this.noise('white', t), [this.filter('bandpass', 2500, 0.5), this.gain(0.012)], dest);
      s.roar.gain.setValueAtTime(0.25, t);
      s.roarLp.frequency.setValueAtTime(320, t);
      s.heat = 0.5; s.heatQ = []; s.nextFlare = t; s.nextCrackle = t + 0.3;
    }
    if (type === 'noche') {
      // aire nocturno + tres grillos con ritmo propio + rana lejana (ver chirp, frog)
      chain(this.noise('brown', t), [this.filter('lowpass', 220), this.gain(0.12)], dest);
      const pans = [-0.6, 0.5, 0.1];
      s.crickets = [4300, 4750, 3950].map((f, i) => ({
        f, pan: pans[i], period: 0.5 + Math.random() * 0.3, pulses: 3 + (i % 2),
        amp: (0.02 + Math.random() * 0.015) * (i === 2 ? 0.5 : 1),
        next: t + Math.random(), restUntil: 0
      }));
      s.nextFrog = t + 3 + Math.random() * 6;
    }
  }

  wave(s, t) {
    const rise = 1.8 + Math.random() * 3;    // 1,8–4,8 s subiendo
    const fall = 2.5 + Math.random() * 4.5;  // 2,5–7 s retirándose
    const hold = Math.random() * 1.5;        // pausa entre olas
    const peak = 0.6 + Math.random() * 0.8;
    const low = 0.35 + Math.random() * 0.2;
    const end = t + rise + fall;
    s.wave.gain.linearRampToValueAtTime(peak, t + rise);
    s.wave.gain.linearRampToValueAtTime(low, end);
    s.wave.gain.linearRampToValueAtTime(low, end + hold);
    s.waveBp.frequency.linearRampToValueAtTime(450 + 400 * (peak - 0.6), t + rise);
    s.waveBp.frequency.linearRampToValueAtTime(280 + Math.random() * 60, end);
    s.waveBp.frequency.linearRampToValueAtTime(300, end + hold);
    s.foam.gain.linearRampToValueAtTime(0.03 + 0.06 * (peak - 0.6), t + rise + 0.4);
    s.foam.gain.linearRampToValueAtTime(0.02, end);
    s.foam.gain.linearRampToValueAtTime(0.02, end + hold);
    return rise + fall + hold;
  }

  gust(s, t) {
    const dur = 4 + Math.random() * 9;       // cada tramo dura 4–13 s
    const ramp = 1.5 + Math.random() * 3.5;
    const lvl = Math.random() < 0.3 ? 0.85 + Math.random() * 0.15 : 0.2 + Math.random() * 0.45;
    s.rain.gain.linearRampToValueAtTime(lvl, t + ramp);
    s.rain.gain.linearRampToValueAtTime(lvl, t + dur);
    s.rainLp.frequency.linearRampToValueAtTime(3500 + 4000 * lvl, t + ramp);
    s.rainLp.frequency.linearRampToValueAtTime(3500 + 4000 * lvl, t + dur);
    s.gusts.push({ at: t + ramp * 0.5, lvl });
    return dur;
  }

  drop(t, dest, level) {
    const ctx = this.ctx;
    const big = Math.random() < 0.08;
    const s = ctx.createBufferSource();
    s.buffer = this.buf.white;
    const bp = big ? this.filter('bandpass', 700 + Math.random() * 700, 5) : this.filter('bandpass', 1500 + Math.random() * 4000, 8);
    const len = big ? 0.06 : 0.025;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime((big ? 0.16 : 0.05 + 0.07 * level) * (0.4 + Math.random() * 0.6), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(bp); bp.connect(g);
    this.pan(g, dest);
    s.start(t, Math.random() * 7); s.stop(t + len + 0.01);
  }

  phrase(t, dest) {
    const ctx = this.ctx;
    const kind = Math.floor(Math.random() * 3);   // 0 sube, 1 baja, 2 trino
    const far = Math.random() < 0.4;              // pájaro lejano: más suave y opaco
    const n = kind === 2 ? 6 + Math.floor(Math.random() * 8) : 2 + Math.floor(Math.random() * 5);
    const f0 = 2200 + Math.random() * 2500;
    const out = this.gain(far ? 0.4 : 1);
    if (far) { const lp = this.filter('lowpass', 2500); out.connect(lp); this.pan(lp, dest); }
    else this.pan(out, dest);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const len = kind === 2 ? 0.035 : 0.07 + Math.random() * 0.05;
      const fa = f0 * (0.9 + Math.random() * 0.2);
      const fb = kind === 0 ? fa * 1.35 : kind === 1 ? fa * 0.7 : fa * 1.08;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(fa, tt);
      o.frequency.exponentialRampToValueAtTime(fb, tt + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.035, tt + (kind === 2 ? 0.005 : 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, tt + len + 0.04);
      o.connect(g); g.connect(out);
      o.start(tt); o.stop(tt + len + 0.06);
      tt += kind === 2 ? 0.05 + Math.random() * 0.02 : 0.09 + Math.random() * 0.08;
    }
  }

  windGust(s, t) {
    const rise = 1.5 + Math.random() * 2;
    const hold = 0.5 + Math.random() * 2;
    const fall = 2 + Math.random() * 3;
    const peak = 0.3 + Math.random() * 0.35;
    const end = t + rise + hold + fall;
    s.wind.gain.setValueAtTime(0, t);
    s.wind.gain.linearRampToValueAtTime(peak, t + rise);
    s.wind.gain.linearRampToValueAtTime(peak * (0.6 + Math.random() * 0.4), t + rise + hold);
    s.wind.gain.linearRampToValueAtTime(0, end);
    s.windBp.frequency.setValueAtTime(400, t);
    s.windBp.frequency.linearRampToValueAtTime(650 + Math.random() * 450, t + rise);
    s.windBp.frequency.linearRampToValueAtTime(420, end);
    s.leaves.gain.setValueAtTime(0, t);
    s.leaves.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.015, t + rise + 0.3);
    s.leaves.gain.linearRampToValueAtTime(0, end);
    return (end - t) + 12 + Math.random() * 25;   // próxima ráfaga en 12–37 s
  }

  flare(s, t) {
    const dur = 2 + Math.random() * 6;
    const heat = Math.random();
    const lvl = 0.15 + 0.25 * heat;
    s.roar.gain.linearRampToValueAtTime(lvl, t + dur * 0.6);
    s.roar.gain.linearRampToValueAtTime(lvl, t + dur);
    s.roarLp.frequency.linearRampToValueAtTime(220 + 260 * heat, t + dur * 0.6);
    s.roarLp.frequency.linearRampToValueAtTime(220 + 260 * heat, t + dur);
    s.heatQ.push({ at: t + dur * 0.3, heat });
    return dur;
  }

  crackle(t, dest, heat) {
    const ctx = this.ctx;
    const big = Math.random() < 0.06;
    const len = big ? 0.02 : 0.002 + Math.random() * 0.006;
    const src = ctx.createBufferSource();
    src.buffer = this.buf.white;
    const f = big ? this.filter('bandpass', 600 + Math.random() * 600, 1.5) : this.filter('highpass', 1200 + Math.random() * 3000);
    const g = ctx.createGain();
    const a = (big ? 0.35 : 0.06 + Math.random() * 0.18) * (0.6 + heat * 0.8);
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g);
    this.pan(g, dest);
    src.start(t, Math.random() * 7); src.stop(t + len + 0.01);
  }

  chirp(t, dest, c) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = c.f;
    const g = ctx.createGain();
    let tt = t;
    for (let k = 0; k < c.pulses; k++) {
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(c.amp, tt + 0.004);
      g.gain.linearRampToValueAtTime(0, tt + 0.016);
      tt += 0.028;
    }
    o.connect(g);
    this.pan(g, dest, c.pan);
    o.start(t); o.stop(tt + 0.02);
  }

  frog(t, dest) {
    const ctx = this.ctx;
    const out = this.gain(0.5);
    const lp = this.filter('lowpass', 2600);
    out.connect(lp);
    this.pan(lp, dest);
    const notes = [[1150, 0.09, 0], [2050, 0.12, 0.14]];
    const reps = Math.random() < 0.5 ? 1 : 2;
    for (let r = 0; r < reps; r++) {
      notes.forEach((n) => {
        const tt = t + r * 0.6 + n[2];
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(n[0] * 0.95, tt);
        o.frequency.linearRampToValueAtTime(n[0] * 1.03, tt + n[1]);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.05, tt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + n[1]);
        o.connect(g); g.connect(out);
        o.start(tt); o.stop(tt + n[1] + 0.02);
      });
    }
  }
}
