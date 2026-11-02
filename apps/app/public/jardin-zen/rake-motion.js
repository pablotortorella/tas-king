// Jardín Zen beta v0.4 · lógica pura del rastrillo (sin DOM ni WebGL), para que el motor y las pruebas compartan reglas.
// Todo lo de acá es presentación: la geometría de los surcos sale del puntero y no depende del rumbo mostrado.

// Preferencia local (nunca se envía al servidor).
export const RAKE_VISIBLE_KEY = "homesuite:jardin-zen:rake-visible";

// Giro suave. El rumbo objetivo sale del desplazamiento del puntero; el ángulo mostrado se acerca por el arco más corto.
export const HEADING_TIME_MS = 185;        // constante de tiempo del acercamiento exponencial
export const MAX_TURN_PER_FRAME = 0.3;     // rad (~17°): tope de rotación por fotograma
export const MAX_FRAME_MS = 50;            // un fotograma largo (pestaña dormida) no da un salto
export const MIN_MOVE = 0.06;              // unidades del jardín (~1 % del ancho): por debajo no cambia el rumbo
export const SETTLED_RAD = 0.002;          // diferencia a partir de la cual se deja de animar

// Medidas del jardín (las mismas del motor): la bandeja de arena y su proyección a la textura.
export const SAND_W = 5.72;
export const SAND_D = 3.6;

// Postura de descanso: el rastrillo apoyado en el costado, como en la beta v0.2 (cabezal en x 2,25; mango hacia -z).
export const REST_POSE = Object.freeze({ x: 2.25, z: -0.65, heading: -Math.PI / 2 });
// Elevación mientras acompaña al puntero, para que el mango no se hunda en el borde de madera.
export const ACTIVE_LIFT = 0.08;

// Mango invertido (v0.4): el mango queda del lado hacia donde se mueve el rastrillo y los dientes quedan atrás, como al
// arrastrar un rastrillo hacia quien lo sostiene. Poner false deja el mango atrás del movimiento.
export const HANDLE_AHEAD = true;

// Piezas en coordenadas locales: `w` es el avance (hacia donde apunta el rumbo), `s` el lado, `y` la altura.
// El origen es el punto de contacto con la arena, en el centro de la fila de dientes.
// Medidas de la beta v0.2: los cinco dientes y el punto de contacto no cambian; sólo cabezal y mango cruzan al otro lado.
const dir = HANDLE_AHEAD ? 1 : -1;
export const RAKE_PARTS = Object.freeze([
  Object.freeze({ id: "handle", color: "handle", w: dir * 0.53, s: 0, y: 0.3, lw: 0.74, ls: 0.048, h: 0.055 }),
  Object.freeze({ id: "head", color: "head", w: dir * 0.13, s: 0, y: 0.3, lw: 0.075, ls: 0.54, h: 0.075 }),
  ...Array.from({ length: 5 }, (_, i) => Object.freeze({ id: `tooth-${i}`, color: "tooth", w: 0, s: -0.26 + i * 0.13, y: 0.28, lw: 0.2, ls: 0.038, h: 0.065 })),
]);

const TAU = Math.PI * 2;

// Diferencia angular con signo por el arco más corto, en (-π, π].
export function shortestArc(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

// Lleva un ángulo cualquiera a (-π, π].
export function normalizeAngle(a) {
  return shortestArc(0, a);
}

// Un paso del giro mostrado: acercamiento exponencial (~185 ms) con tope por fotograma. Siempre por el arco más corto.
export function stepHeading(current, target, dtMs) {
  const diff = shortestArc(current, target);
  if (Math.abs(diff) <= SETTLED_RAD) return normalizeAngle(target);
  const dt = Math.min(Math.max(Number.isFinite(dtMs) ? dtMs : 0, 0), MAX_FRAME_MS);
  const wanted = diff * (1 - Math.exp(-dt / HEADING_TIME_MS));
  const step = Math.max(-MAX_TURN_PER_FRAME, Math.min(MAX_TURN_PER_FRAME, wanted));
  return normalizeAngle(current + step);
}

export function isSettled(current, target) {
  return Math.abs(shortestArc(current, target)) <= SETTLED_RAD;
}

// Rumbo objetivo a partir del movimiento del puntero. `tracker` guarda el último punto de referencia y el objetivo.
// Un desplazamiento menor a MIN_MOVE no cambia el rumbo ni mueve la referencia (así el temblor de la mano no lo gira).
export function createHeadingTracker(heading = REST_POSE.heading) {
  return { ref: null, target: heading };
}

export function trackHeading(tracker, point, minMove = MIN_MOVE) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return tracker.target;
  if (!tracker.ref) { tracker.ref = { x: point.x, z: point.z }; return tracker.target; }
  const dx = point.x - tracker.ref.x, dz = point.z - tracker.ref.z;
  if (Math.hypot(dx, dz) < minMove) return tracker.target;
  tracker.target = Math.atan2(dz, dx);
  tracker.ref = { x: point.x, z: point.z };
  return tracker.target;
}

// Al soltar o salir de la arena se olvida la referencia, para que el primer punto nuevo no gire el rastrillo.
export function resetTracker(tracker, heading = tracker.target) {
  tracker.ref = null;
  tracker.target = heading;
}

// Punto del jardín (x, z) de un punto local (w, s) para una postura dada.
export function toWorld(pose, w, s) {
  const c = Math.cos(pose.heading), n = Math.sin(pose.heading);
  return [pose.x + w * c - s * n, pose.z + w * n + s * c];
}

// Las cuatro esquinas (x, z) de una pieza para una postura. Las usa la alternativa Canvas 2.5D.
export function partCorners(part, pose) {
  const hw = part.lw / 2, hs = part.ls / 2;
  return [[-hw, -hs], [hw, -hs], [hw, hs], [-hw, hs]].map(([dw, ds]) => toWorld(pose, part.w + dw, part.s + ds));
}

// Preferencia «rastrillo visible». Todo acceso al almacenamiento puede fallar (modo privado, datos bloqueados).
export function getStorage(win = globalThis) {
  try { return win.localStorage ?? null; } catch { return null; }
}

export function readRakeVisible(storage) {
  try {
    const raw = storage ? storage.getItem(RAKE_VISIBLE_KEY) : null;
    return raw === "0" || raw === "false" ? false : true;
  } catch {
    return true;
  }
}

export function writeRakeVisible(storage, visible) {
  try {
    if (!storage) return false;
    storage.setItem(RAKE_VISIBLE_KEY, visible ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

// Estado del rastrillo mostrado: postura que acompaña al puntero (o de descanso) y ángulo que se acerca al rumbo objetivo.
// No toca el DOM ni los surcos: el motor lo consulta para dibujar el modelo y el cursor.
export function createRake() {
  const tracker = createHeadingTracker(REST_POSE.heading);
  const state = { x: REST_POSE.x, z: REST_POSE.z, heading: REST_POSE.heading, following: false };
  return {
    state,
    tracker,
    // El rastrillo se posa sobre el punto (x, z) de la arena; el rumbo objetivo se actualiza con el desplazamiento.
    follow(x, z) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      trackHeading(tracker, { x, z });
      state.x = x; state.z = z; state.following = true;
    },
    // Vuelve a descansar en el costado, con el rumbo de reposo.
    release() {
      state.x = REST_POSE.x; state.z = REST_POSE.z; state.heading = REST_POSE.heading; state.following = false;
      resetTracker(tracker, REST_POSE.heading);
    },
    // Avanza el giro mostrado; devuelve true si el ángulo cambió (hay que redibujar).
    tick(dtMs) {
      if (isSettled(state.heading, tracker.target)) return false;
      state.heading = stepHeading(state.heading, tracker.target, dtMs);
      return true;
    },
    settled() { return isSettled(state.heading, tracker.target); },
    pose() { return { x: state.x, z: state.z, heading: state.heading }; },
    lift() { return state.following ? ACTIVE_LIFT : 0; },
  };
}
