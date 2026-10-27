// Remanso · interfaz. Módulo ES sin build; usa el motor del paquete tal cual.
//
// Reglas que este archivo respeta (CSP de la app: script-src/style-src 'self'):
//  - nada de innerHTML con datos: todo se arma con DOM y textContent;
//  - las posiciones calculadas van por `style.<propiedad>` (CSSOM) o atributos SVG,
//    nunca por atributos `style` en el marcado;
//  - start() y testGong() sólo se llaman desde handlers de click.
import { AMBIENTS, DURATIONS, gongTimes } from "./remanso-engine.js";
import { GONG_IDS, GONG_NAMES, SuiteEngine } from "./remanso-gongs.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 130;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const GONG_STORAGE_KEY = "remanso:gong";

const AMBIENT_NAMES = { silencio: "Silencio", agua: "Agua", lluvia: "Lluvia", bosque: "Bosque", fuego: "Fuego", noche: "Noche" };
const AMBIENT_ICONS = {
  silencio: ["M4 9h4l5-4v14l-5-4H4z", "M17 9l4 6M21 9l-4 6"],
  agua: ["M3 9c3-3 6 3 9 0s6 3 9 0", "M3 15c3-3 6 3 9 0s6 3 9 0"],
  lluvia: ["M7 14a4 4 0 1 1 1-7.9A5 5 0 0 1 18 8a3 3 0 0 1 0 6z", "M8 17l-1 3M12 17l-1 3M16 17l-1 3"],
  bosque: ["M12 3l6 9h-4l4 6H6l4-6H6z", "M12 18v3"],
  fuego: ["M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z"],
  noche: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
};
const LOCK_PATHS = ["M7 11V8a5 5 0 0 1 10 0v3"];
const WORDS = { 1: "Un minuto", 2: "Dos minutos", 5: "Cinco minutos", 10: "Diez minutos", 20: "Veinte minutos", 30: "Treinta minutos" };

const root = document.getElementById("remanso");
if (root) init();

function init() {
  const $ = (id) => document.getElementById(id);
  const list = (value) => (value ? value.split(",") : []);

  const config = {
    cuenta: root.dataset.acceso === "cuenta",
    nombre: root.dataset.nombre || null,
    libreMinutos: list(root.dataset.libreMinutos).map(Number),
    libreFondos: list(root.dataset.libreFondos),
    libreGongs: list(root.dataset.libreGongs),
    loginDisponible: Boolean(root.dataset.login),
  };
  const allowedMinutes = (minutes) => config.cuenta || config.libreMinutos.includes(minutes);
  const allowedAmbient = (ambient) => config.cuenta || config.libreFondos.includes(ambient);
  const allowedGong = (id) => GONG_IDS.includes(id) && (config.cuenta || config.libreGongs.includes(id));

  // La elección del gong vive en el dispositivo (nada se envía al servidor) y se ignora
  // si el nivel actual no la permite. Sin localStorage (modo privado) todo funciona igual.
  function storedGong() {
    try {
      const id = localStorage.getItem(GONG_STORAGE_KEY);
      return id && allowedGong(id) ? id : null;
    } catch { return null; }
  }
  function rememberGong(id) {
    try { localStorage.setItem(GONG_STORAGE_KEY, id); } catch { /* sin almacenamiento */ }
  }

  const state = {
    minutes: Number(root.dataset.inicialMinutos),
    ambient: root.dataset.inicialFondo,
    gong: storedGong() ?? root.dataset.inicialGong,
    volume: Number(root.dataset.inicialVolumen),
    mood: null,
    muted: false,
  };
  const engine = new SuiteEngine();
  engine.setGong(state.gong);
  let markers = [];

  // ---------- utilidades de DOM ----------
  function el(tag, { className, text, attrs } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  function icon(paths, size) {
    const svg = document.createElementNS(SVG_NS, "svg");
    for (const [name, value] of Object.entries({ "aria-hidden": "true", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(name, value);
    for (const d of paths) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  }

  function lockTag() {
    const svg = icon(LOCK_PATHS, 11);
    const body = document.createElementNS(SVG_NS, "rect");
    for (const [name, value] of Object.entries({ x: "5", y: "11", width: "14", height: "10", rx: "2" })) body.setAttribute(name, value);
    svg.append(body);
    return el("span", { className: "rem-tag" }, [svg, document.createTextNode("con cuenta")]);
  }

  const fmt = (seconds) => {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
  };

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function announce(text) {
    const region = $("rem-anuncio");
    region.textContent = "";
    requestAnimationFrame(() => { region.textContent = text; });
  }

  // ---------- pantallas ----------
  function syncThemeColor() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
    }
    meta.content = getComputedStyle(document.body).backgroundColor;
  }

  function show(name, focusId) {
    for (const screen of ["inicio", "sesion", "cierre"]) $(`rem-${screen}`).hidden = screen !== name;
    document.body.dataset.pantalla = name;
    syncThemeColor();
    window.scrollTo(0, 0);
    if (focusId) $(focusId).focus({ preventScroll: true });
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);

  // ---------- inicio ----------
  function buildHome() {
    $("rem-sonidos").replaceChildren(...GONG_IDS.map((id) => {
      const locked = !allowedGong(id);
      const button = el("button", {
        className: "rem-chip rem-sonido",
        attrs: { type: "button", "data-g": id, "aria-pressed": "false", "aria-label": `${GONG_NAMES[id]}${locked ? ", con cuenta" : ""}`, ...(locked ? { "aria-disabled": "true" } : {}) },
      }, [el("span", { text: GONG_NAMES[id] })]);
      if (locked) button.append(lockTag());
      return button;
    }));
    $("rem-duraciones").replaceChildren(...DURATIONS.map((minutes) => {
      const locked = !allowedMinutes(minutes);
      const label = `${minutes} ${minutes === 1 ? "minuto" : "minutos"}${locked ? ", con cuenta" : ""}`;
      const button = el("button", {
        className: "rem-chip rem-dur",
        attrs: { type: "button", "data-m": String(minutes), "aria-pressed": "false", "aria-label": label, ...(locked ? { "aria-disabled": "true" } : {}) },
      }, [el("b", { text: String(minutes) }), el("span", { text: "min" })]);
      if (locked) button.append(lockTag());
      return button;
    }));
    $("rem-fondos").replaceChildren(...AMBIENTS.map((ambient) => {
      const locked = !allowedAmbient(ambient);
      const label = `${AMBIENT_NAMES[ambient]}${locked ? ", con cuenta" : ""}`;
      const button = el("button", {
        className: "rem-chip rem-fondo",
        attrs: { type: "button", "data-a": ambient, "aria-pressed": "false", "aria-label": label, ...(locked ? { "aria-disabled": "true" } : {}) },
      }, [icon(AMBIENT_ICONS[ambient], 22), el("span", { text: AMBIENT_NAMES[ambient] })]);
      if (locked) button.append(lockTag());
      return button;
    }));
  }

  function updateHome() {
    for (const button of $("rem-sonidos").children) button.setAttribute("aria-pressed", String(button.dataset.g === state.gong));
    for (const button of $("rem-duraciones").children) button.setAttribute("aria-pressed", String(Number(button.dataset.m) === state.minutes));
    for (const button of $("rem-fondos").children) button.setAttribute("aria-pressed", String(button.dataset.a === state.ambient));
    const total = state.minutes * 60;
    const times = gongTimes(state.minutes);
    $("rem-pista").replaceChildren(...times.map((g) => {
      const dot = el("div", { className: "rem-punto" });
      dot.style.left = `${(g / total) * 100}%`;
      return dot;
    }));
    $("rem-marcas").replaceChildren(...times.map((g) => {
      const tick = el("span", { text: fmt(g) });
      tick.style.left = `${(g / total) * 100}%`;
      return tick;
    }));
    $("rem-regla").textContent = total <= 600 ? "Gong al inicio, a la mitad y al final" : "Gong al inicio, cada 5 min y al final";
    $("rem-comenzar").textContent = `Comenzar · ${state.minutes} min`;
  }

  function showNotice(message) {
    $("rem-aviso-texto").textContent = message;
    $("rem-aviso").hidden = false;
  }

  function showAccountNotice() {
    showNotice(config.loginDisponible
      ? "Esta opción es para quienes tienen cuenta de HomeSuite. Entrá con Google (si es tu primera vez, se crea tu cuenta) y volvés acá."
      : "Esta opción es para quienes tienen cuenta de HomeSuite, y el acceso con cuenta no está disponible en este ambiente.");
  }

  function hideNotice() { $("rem-aviso").hidden = true; }

  // ---------- sesión ----------
  function startSession() {
    if (engine.isRunning) return; // doble toque
    if (!allowedMinutes(state.minutes) || !allowedAmbient(state.ambient)) { showAccountNotice(); return; }
    try {
      engine.start({ minutes: state.minutes, ambient: state.ambient, volume: state.volume });
    } catch (error) {
      console.error(error);
      showNotice("Este navegador no permite reproducir el audio de Remanso.");
      return;
    }
    state.muted = false;
    const total = state.minutes * 60;
    $("rem-s-titulo").textContent = `Sesión de ${state.minutes} min`;
    $("rem-s-fondo").textContent = state.ambient === "silencio" ? "En silencio" : `Fondo: ${AMBIENT_NAMES[state.ambient].toLowerCase()}`;
    markers = gongTimes(state.minutes).filter((g) => g < total).map((g) => {
      const angle = (g / total) * Math.PI * 2 - Math.PI / 2;
      const node = el("div", { className: "rem-marcador" });
      node.style.left = `${((150 + RING_RADIUS * Math.cos(angle)) / 300) * 100}%`;
      node.style.top = `${((150 + RING_RADIUS * Math.sin(angle)) / 300) * 100}%`;
      return { node, g };
    });
    $("rem-marcadores").replaceChildren(...markers.map((marker) => marker.node));
    $("rem-mudo").classList.toggle("rem-oculto", state.ambient === "silencio");
    renderPause(false);
    renderMute();
    renderTick({ elapsed: 0, remaining: total, duration: total, paused: false, nextGong: null });
    show("sesion", "rem-pausa");
  }

  function renderTick(tick) {
    setText($("rem-restante"), fmt(tick.remaining));
    $("rem-progreso").setAttribute("stroke-dasharray", `${(Math.min(1, tick.elapsed / tick.duration) * RING_LENGTH).toFixed(1)} 817`);
    for (const { node, g } of markers) node.classList.toggle("rem-hecho", tick.elapsed >= g);
    setText($("rem-proximo"), tick.nextGong ? `${tick.nextGong.final ? "Gong final en " : "Próximo gong en "}${fmt(tick.nextGong.in)}` : "");
  }

  function renderPause(paused) {
    $("rem-icono-pausa").hidden = paused;
    $("rem-icono-play").hidden = !paused;
    $("rem-pausa").setAttribute("aria-label", paused ? "Reanudar" : "Pausar");
    setText($("rem-restante-etiqueta"), paused ? "En pausa" : "restantes");
  }

  function renderMute() {
    $("rem-icono-sonido").hidden = state.muted;
    $("rem-icono-mudo").hidden = !state.muted;
    $("rem-mudo").setAttribute("aria-label", state.muted ? "Activar fondo" : "Silenciar fondo");
  }

  // ---------- cierre ----------
  function renderMoods() {
    for (const button of root.querySelectorAll("[data-animo]")) button.setAttribute("aria-pressed", String(button.dataset.animo === state.mood));
  }

  function renderDone({ early, played, minutes }) {
    if (early) {
      const whole = Math.floor(played / 60);
      $("rem-c-titulo").textContent = whole < 1 ? "Un momento de calma" : `${whole} ${whole === 1 ? "minuto" : "minutos"} de calma`;
      $("rem-c-sub").textContent = "Cada pausa cuenta.";
    } else {
      $("rem-c-titulo").textContent = `${WORDS[minutes]} de calma`;
      $("rem-c-sub").textContent = "Quedate un momento más antes de volver.";
    }
    $("rem-c-saludo").textContent = config.nombre ? `Gracias por tu pausa, ${config.nombre}.` : "";
    $("rem-c-saludo").hidden = !config.nombre;
    state.mood = null; // el ánimo no se guarda ni se envía: vive sólo en esta pantalla
    renderMoods();
    show("cierre", "rem-c-titulo");
  }

  // ---------- eventos ----------
  $("rem-duraciones").addEventListener("click", (event) => {
    const button = event.target.closest("[data-m]");
    if (!button) return;
    const minutes = Number(button.dataset.m);
    if (!allowedMinutes(minutes)) { showAccountNotice(); return; }
    state.minutes = minutes;
    hideNotice();
    updateHome();
  });
  $("rem-fondos").addEventListener("click", (event) => {
    const button = event.target.closest("[data-a]");
    if (!button) return;
    if (!allowedAmbient(button.dataset.a)) { showAccountNotice(); return; }
    state.ambient = button.dataset.a;
    hideNotice();
    updateHome();
  });
  $("rem-sonidos").addEventListener("click", (event) => {
    const button = event.target.closest("[data-g]");
    if (!button) return;
    if (!allowedGong(button.dataset.g)) { showAccountNotice(); return; }
    state.gong = button.dataset.g;
    engine.setGong(state.gong);
    rememberGong(state.gong);
    hideNotice();
    updateHome();
  });
  $("rem-volumen").addEventListener("input", (event) => { state.volume = Number(event.target.value); });
  $("rem-probar").addEventListener("click", () => {
    try { engine.testGong(); } catch (error) { console.error(error); showNotice("Este navegador no permite reproducir el audio de Remanso."); }
  });
  $("rem-comenzar").addEventListener("click", startSession);
  $("rem-pausa").addEventListener("click", () => engine.togglePause());
  $("rem-terminar").addEventListener("click", () => engine.stop());
  $("rem-mudo").addEventListener("click", () => {
    state.muted = !state.muted;
    engine.setAmbientMuted(state.muted);
    renderMute();
    announce(state.muted ? "Fondo silenciado" : "Fondo activado");
  });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-animo]");
    if (!button) return;
    state.mood = state.mood === button.dataset.animo ? null : button.dataset.animo;
    renderMoods();
  });
  $("rem-volver").addEventListener("click", () => { updateHome(); show("inicio", "rem-titulo"); });
  $("rem-repetir").addEventListener("click", startSession);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideNotice(); });

  engine.on("tick", renderTick);
  engine.on("pause", ({ paused }) => { renderPause(paused); announce(paused ? "Sesión en pausa" : "Sesión reanudada"); });
  engine.on("end", renderDone);

  // El audio no sobrevive a la página: al irse (o al entrar al caché de navegación) se libera.
  window.addEventListener("pagehide", () => engine.dispose());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) { updateHome(); show("inicio"); }
  });

  buildHome();
  updateHome();
  show("inicio");
}
