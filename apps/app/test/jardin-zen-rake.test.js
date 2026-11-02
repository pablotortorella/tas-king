import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_LIFT, HANDLE_AHEAD, HEADING_TIME_MS, MAX_TURN_PER_FRAME, MIN_MOVE, RAKE_PARTS, RAKE_VISIBLE_KEY, REST_POSE,
  createHeadingTracker, createRake, getStorage, isSettled, normalizeAngle, partCorners, readRakeVisible, shortestArc,
  stepHeading, toWorld, trackHeading, writeRakeVisible,
} from "../public/jardin-zen/rake-motion.js";

const deg = (rad) => (rad * 180) / Math.PI;
const rad = (degrees) => (degrees * Math.PI) / 180;
const FRAME = 1000 / 60;

// Corre fotogramas hasta que el giro termina; devuelve los ángulos mostrados y los pasos.
function spin(from, to, { maxFrames = 600 } = {}) {
  let angle = from;
  const steps = [];
  for (let i = 0; i < maxFrames && !isSettled(angle, to); i += 1) {
    const next = stepHeading(angle, to, FRAME);
    steps.push(Math.abs(shortestArc(angle, next)));
    angle = next;
  }
  return { angle, steps };
}

describe("arco más corto", () => {
  it.each([
    [0, 90, 90], [90, 0, -90], [350, 10, 20], [10, 350, -20], [-170, 170, -20], [170, -170, 20],
  ])("de %i° a %i° gira %i°", (from, to, expected) => {
    expect(deg(shortestArc(rad(from), rad(to)))).toBeCloseTo(expected, 6);
  });

  it("nunca pasa de media vuelta y normaliza a (-180°, 180°]", () => {
    for (let a = -720; a <= 720; a += 37) for (let b = -720; b <= 720; b += 53) {
      expect(Math.abs(shortestArc(rad(a), rad(b)))).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
    expect(deg(normalizeAngle(rad(540)))).toBeCloseTo(180, 6);
    expect(deg(normalizeAngle(rad(-190)))).toBeCloseTo(170, 6);
  });
});

describe("giro suave del rastrillo", () => {
  it("invertir de golpe el rumbo se reparte en varios fotogramas y ninguno supera el tope", () => {
    const { angle, steps } = spin(0, Math.PI);
    expect(steps.length).toBeGreaterThan(10);
    expect(Math.max(...steps)).toBeLessThanOrEqual(MAX_TURN_PER_FRAME + 1e-12);
    expect(Math.abs(shortestArc(angle, Math.PI))).toBeLessThanOrEqual(0.002);
  });

  it("el primer fotograma no salta ni al 15 % de una media vuelta", () => {
    expect(Math.abs(shortestArc(0, stepHeading(0, Math.PI, FRAME)))).toBeLessThan(Math.PI * 0.15);
  });

  it("converge con la constante de ~185 ms: recorre ~63 % en ese tiempo", () => {
    expect(HEADING_TIME_MS).toBe(185);
    let angle = 0;
    const target = rad(40); // chico, para que el tope por fotograma no intervenga
    for (let t = 0; t < HEADING_TIME_MS; t += FRAME) angle = stepHeading(angle, target, FRAME);
    const fraction = angle / target;
    expect(fraction).toBeGreaterThan(0.55);
    expect(fraction).toBeLessThan(0.72);
  });

  it("va siempre por el arco más corto, también cruzando ±180°", () => {
    const from = rad(170), to = rad(-170);
    let angle = from;
    for (let i = 0; i < 4; i += 1) {
      const next = stepHeading(angle, to, FRAME);
      expect(shortestArc(angle, next)).toBeGreaterThan(0); // sigue en el mismo sentido, sin dar la vuelta larga
      angle = next;
    }
  });

  it("un fotograma largo (pestaña dormida) tampoco da un salto mayor al tope", () => {
    expect(Math.abs(shortestArc(0, stepHeading(0, Math.PI, 5000)))).toBeLessThanOrEqual(MAX_TURN_PER_FRAME + 1e-12);
  });

  it("tolera tiempos inválidos sin devolver NaN", () => {
    for (const dt of [NaN, undefined, -10, Infinity]) expect(Number.isFinite(stepHeading(0, 1, dt))).toBe(true);
  });

  it("no se mueve cuando ya llegó", () => {
    expect(isSettled(1, 1.001)).toBe(true);
    expect(stepHeading(1, 1.001, FRAME)).toBeCloseTo(1.001, 9);
  });
});

describe("rumbo objetivo a partir del puntero", () => {
  it("un desplazamiento mínimo no cambia el rumbo, ni siquiera acumulando temblores", () => {
    const tracker = createHeadingTracker(0.5);
    trackHeading(tracker, { x: 0, z: 0 });
    for (let i = 0; i < 20; i += 1) trackHeading(tracker, { x: (i % 2 ? 1 : -1) * MIN_MOVE * 0.4, z: MIN_MOVE * 0.3 });
    expect(tracker.target).toBe(0.5);
  });

  it("el primer punto sólo fija la referencia", () => {
    const tracker = createHeadingTracker(0.5);
    expect(trackHeading(tracker, { x: 3, z: 3 })).toBe(0.5);
    expect(tracker.ref).toEqual({ x: 3, z: 3 });
  });

  it("un desplazamiento suficiente apunta hacia donde se mueve el puntero", () => {
    const tracker = createHeadingTracker(0);
    trackHeading(tracker, { x: 0, z: 0 });
    expect(trackHeading(tracker, { x: 0, z: MIN_MOVE * 2 })).toBeCloseTo(Math.PI / 2, 9);
    expect(trackHeading(tracker, { x: -MIN_MOVE * 2, z: MIN_MOVE * 2 })).toBeCloseTo(Math.PI, 9);
  });

  it("ignora puntos inválidos", () => {
    const tracker = createHeadingTracker(0.25);
    trackHeading(tracker, { x: 0, z: 0 });
    expect(trackHeading(tracker, { x: NaN, z: 1 })).toBe(0.25);
    expect(trackHeading(tracker, null)).toBe(0.25);
  });
});

describe("modelo del rastrillo (mango invertido)", () => {
  const byId = Object.fromEntries(RAKE_PARTS.map((part) => [part.id, part]));

  it("conserva los cinco dientes, separados 0,13 y centrados en el punto de contacto", () => {
    const teeth = RAKE_PARTS.filter((part) => part.id.startsWith("tooth-"));
    expect(teeth).toHaveLength(5);
    expect(teeth.map((tooth) => tooth.s)).toEqual([-0.26, -0.13, 0, 0.13, 0.26].map((v) => expect.closeTo(v, 9)));
    for (const tooth of teeth) expect(tooth.w).toBe(0);
  });

  it("el mango queda del lado del avance, pasando el cabezal, y los dientes quedan atrás", () => {
    expect(HANDLE_AHEAD).toBe(true);
    expect(byId.head.w).toBeGreaterThan(0);
    expect(byId.handle.w - byId.handle.lw / 2).toBeGreaterThanOrEqual(byId.head.w - byId.head.lw / 2);
    expect(byId.handle.w).toBeGreaterThan(byId.head.w);
  });

  it("en reposo reproduce la posición de la beta v0.2: cabezal en x 2,25 y mango hacia -z", () => {
    const pose = { ...REST_POSE };
    const center = (part) => { const c = partCorners(part, pose); return [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2]; };
    const [hx, hz] = center(byId.head), [mx, mz] = center(byId.handle), [tx, tz] = center(byId["tooth-2"]);
    expect(hx).toBeCloseTo(2.25, 9); expect(hz).toBeCloseTo(-0.78, 9);
    expect(mx).toBeCloseTo(2.25, 9); expect(mz).toBeCloseTo(-1.18, 9);
    expect(tx).toBeCloseTo(2.25, 9); expect(tz).toBeCloseTo(-0.65, 9);
  });

  it("con cualquier rumbo el mango sigue del lado del avance y la distancia al punto de contacto no cambia", () => {
    for (const heading of [0, 0.7, Math.PI / 2, 2.4, Math.PI, -2, -Math.PI / 2]) {
      const pose = { x: 0.4, z: -0.3, heading };
      const forward = [Math.cos(heading), Math.sin(heading)];
      const [hx, hz] = toWorld(pose, byId.handle.w, 0);
      expect((hx - pose.x) * forward[0] + (hz - pose.z) * forward[1]).toBeCloseTo(byId.handle.w, 9);
      expect(Math.hypot(hx - pose.x, hz - pose.z)).toBeCloseTo(byId.handle.w, 9);
    }
  });

  it("las esquinas de cada pieza forman un rectángulo del tamaño de la pieza", () => {
    for (const part of RAKE_PARTS) {
      const [a, b, , d] = partCorners(part, { x: 1, z: 1, heading: 1.1 });
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(part.lw, 9);
      expect(Math.hypot(d[0] - a[0], d[1] - a[1])).toBeCloseTo(part.ls, 9);
    }
  });
});

describe("estado del rastrillo mostrado", () => {
  it("empieza en reposo, sin seguir al puntero", () => {
    const rake = createRake();
    expect(rake.pose()).toEqual(REST_POSE);
    expect(rake.state.following).toBe(false);
    expect(rake.lift()).toBe(0);
    expect(rake.settled()).toBe(true);
    expect(rake.tick(FRAME)).toBe(false);
  });

  it("al seguir el puntero se posa ahí en el acto, pero el giro llega en varios fotogramas", () => {
    const rake = createRake();
    rake.follow(0, 0);                 // referencia
    rake.follow(0.5, 0);               // rumbo objetivo 0° (desde -90°)
    expect(rake.pose().x).toBe(0.5);
    expect(rake.lift()).toBe(ACTIVE_LIFT);
    expect(rake.state.heading).toBe(REST_POSE.heading);
    let frames = 0;
    while (rake.tick(FRAME)) { frames += 1; if (frames > 500) break; }
    expect(frames).toBeGreaterThan(5);
    expect(rake.state.heading).toBeCloseTo(0, 2);
  });

  it("mover el puntero no cambia los puntos que el motor toma para el surco: el estado sólo guarda posición y rumbo", () => {
    const rake = createRake();
    const path = [[0, 0], [0.2, 0.1], [0.4, 0.3]];
    for (const [x, z] of path) rake.follow(x, z);
    expect(Object.keys(rake.state).sort()).toEqual(["following", "heading", "x", "z"]);
    expect([rake.state.x, rake.state.z]).toEqual(path.at(-1));
  });

  it("al soltar vuelve al reposo con el rumbo de reposo y olvida la referencia", () => {
    const rake = createRake();
    rake.follow(1, 1); rake.follow(1.5, 1.5);
    rake.release();
    expect(rake.pose()).toEqual(REST_POSE);
    expect(rake.state.following).toBe(false);
    expect(rake.tracker.ref).toBeNull();
    expect(rake.settled()).toBe(true);
  });

  it("ignora coordenadas que no son números", () => {
    const rake = createRake();
    rake.follow(NaN, 1);
    expect(rake.state.following).toBe(false);
  });
});

describe("preferencia «rastrillo visible»", () => {
  const memory = (initial = {}) => {
    const data = { ...initial };
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
  };
  const broken = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceededError"); } };

  it("usa la clave acordada", () => {
    expect(RAKE_VISIBLE_KEY).toBe("homesuite:jardin-zen:rake-visible");
  });

  it("visible por defecto: sin dato, sin almacenamiento o con un valor desconocido", () => {
    expect(readRakeVisible(memory())).toBe(true);
    expect(readRakeVisible(null)).toBe(true);
    expect(readRakeVisible(memory({ [RAKE_VISIBLE_KEY]: "quién sabe" }))).toBe(true);
  });

  it("recuerda oculto y vuelve a visible", () => {
    const storage = memory();
    expect(writeRakeVisible(storage, false)).toBe(true);
    expect(storage.data[RAKE_VISIBLE_KEY]).toBe("0");
    expect(readRakeVisible(storage)).toBe(false);
    writeRakeVisible(storage, true);
    expect(readRakeVisible(storage)).toBe(true);
  });

  it("si el almacenamiento falla no lanza y queda visible", () => {
    expect(readRakeVisible(broken)).toBe(true);
    expect(writeRakeVisible(broken, false)).toBe(false);
    expect(writeRakeVisible(null, false)).toBe(false);
  });

  it("acceder a localStorage puede lanzar (modo privado): getStorage lo absorbe", () => {
    const hostile = { get localStorage() { throw new Error("SecurityError"); } };
    expect(getStorage(hostile)).toBeNull();
    expect(getStorage({ localStorage: memory() })).not.toBeNull();
    expect(getStorage({})).toBeNull();
  });
});

describe("integración con el motor y la página", () => {
  const engine = readFileSync(new URL("../public/jardin-zen/jardin-zen.js", import.meta.url), "utf8");

  it("el motor importa la lógica del rastrillo del mismo origen y no usa red", () => {
    expect(engine).toMatch(/from '\.\/rake-motion\.js'/u);
    expect(engine).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//u);
  });

  it("el encuadre de la cámara no cambió: sólo se acerca, nunca se aleja de 10,2, y la rueda lo desactiva", () => {
    expect(engine).toContain("function fitDist(){const base=10.2,fillH=.60,fillW=.89/aspect,target=.82;return Math.min(base,Math.max(5.8,base*Math.max(fillH,fillW)/target));}");
    expect(engine).toContain("function fitCamera(){if(!userZoom)dist=fitDist();}");
    expect(engine).toContain("userZoom=true;dist=Math.min(15,Math.max(5.8,dist+Math.sign(e.deltaY)*.4))");
  });

  it("mantiene el ancho fino 5,6 y normal 7,8, y los dos rutas de render", () => {
    expect(engine).toContain("rakeGap=5.6");
    expect(engine).toContain("rakeGap=rakeGap===5.6?7.8:5.6");
    expect(engine).toContain("getContext('webgl2'");
    expect(engine).toContain("getContext('2d')");
  });

  it("el punto del surco sale del puntero, no del rumbo suavizado", () => {
    // addPoint (WebGL) y move (2.5D) arman el surco con la posición del puntero; el rastrillo sólo se posa en ella.
    expect(engine).toMatch(/function addPoint\(p\)\{[^}]*toPx\(p\.x,p\.z\)/u);
    expect(engine).not.toMatch(/activeStroke\.push\([^)]*heading/u);
    expect(engine).not.toMatch(/active\.push\([^)]*heading/u);
  });
});
