import { AMBIENTS, DURATIONS } from "../public/remanso/remanso-engine.js";
import { DEFAULT_GONG, GONG_IDS } from "../public/remanso/remanso-gongs.js";
import { readOwnProfile } from "./profiles.js";

// Qué puede usar quien no tiene cuenta y qué quien sí. Es la única definición:
// el navegador recibe las opciones libres por atributos de datos y no las repite.
// Es una decisión de producto, no un control de seguridad (design.md, D8): el audio
// se sintetiza en el dispositivo y no hay forma de impedir su uso desde el cliente.
export const REMANSO_ACCESO = Object.freeze({
  libre: Object.freeze({
    minutos: Object.freeze([1, 2, 5]),
    fondos: Object.freeze(["silencio", "agua", "bosque"]),
    gongs: Object.freeze([DEFAULT_GONG]),
    inicial: Object.freeze({ minutos: 5, fondo: "agua", gong: DEFAULT_GONG }),
  }),
  cuenta: Object.freeze({
    minutos: Object.freeze([...DURATIONS]),
    fondos: Object.freeze([...AMBIENTS]),
    gongs: Object.freeze([...GONG_IDS]),
    inicial: Object.freeze({ minutos: 10, fondo: "lluvia", gong: DEFAULT_GONG }),
  }),
});

const LOGIN_URL = "/auth/google?returnTo=%2Fremanso";
const REMANSO_ASSETS = Object.freeze({
  styles: ["/remanso/remanso.css"],
  scripts: ["/remanso/remanso.js"],
  bodyClass: "remanso",
});

const ICONS = Object.freeze({
  stop: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  pause: '<span id="rem-icono-pausa"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg></span>',
  play: '<span id="rem-icono-play" hidden><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>',
  soundOn: '<span id="rem-icono-sonido"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg></span>',
  soundOff: '<span id="rem-icono-mudo" hidden><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg></span>',
  calm: '<svg aria-hidden="true" width="96" height="96" viewBox="0 0 96 96" fill="none"><circle class="rem-calma-1" cx="48" cy="48" r="46" stroke-width="2"/><circle class="rem-calma-2" cx="48" cy="48" r="30" stroke-width="2"/><circle class="rem-calma-3" cx="48" cy="48" r="12"/></svg>',
});

const MOODS = Object.freeze(["En calma", "Igual", "Con inquietud"]);

export function renderRemanso({ html, nombre = null, loginDisponible = true }) {
  const nivel = nombre ? "cuenta" : "libre";
  const { libre } = REMANSO_ACCESO;
  const inicial = REMANSO_ACCESO[nivel].inicial;
  const datos = [
    `data-acceso="${nivel}"`,
    `data-libre-minutos="${libre.minutos.join(",")}"`,
    `data-libre-fondos="${libre.fondos.join(",")}"`,
    `data-libre-gongs="${libre.gongs.join(",")}"`,
    `data-inicial-minutos="${inicial.minutos}"`,
    `data-inicial-fondo="${inicial.fondo}"`,
    `data-inicial-gong="${inicial.gong}"`,
    nombre ? `data-nombre="${html(nombre)}"` : "",
    loginDisponible ? `data-login="${LOGIN_URL}"` : "",
  ].filter(Boolean).join(" ");

  const avisoEnlace = loginDisponible
    ? `<a id="rem-aviso-enlace" class="button" href="${LOGIN_URL}">Continuar con Google</a>`
    : "";
  const animos = MOODS.map((mood) => `<button type="button" class="rem-chip rem-animo" data-animo="${html(mood)}" aria-pressed="false">${html(mood)}</button>`).join("");

  return `<div id="remanso" class="remanso-app" ${datos}>
<noscript><p class="notice">Remanso necesita JavaScript para el tiempo y el sonido. Activalo en tu navegador para usarlo.</p></noscript>

<section id="rem-inicio" class="rem-pantalla" aria-labelledby="rem-titulo">
  <p class="eyebrow">Remanso</p>
  <h1 id="rem-titulo" tabindex="-1">¿Cuánto tiempo te regalás hoy?</h1>

  <section class="rem-bloque" aria-labelledby="rem-l-duracion">
    <h2 id="rem-l-duracion" class="rem-label">Duración</h2>
    <div id="rem-duraciones" class="rem-grid rem-grid-duracion" role="group" aria-labelledby="rem-l-duracion"></div>
    <div class="rem-gongs">
      <div id="rem-pista" class="rem-pista" aria-hidden="true"></div>
      <div id="rem-marcas" class="rem-marcas" aria-hidden="true"></div>
      <div class="rem-regla"><span id="rem-regla"></span></div>
    </div>
  </section>

  <section class="rem-bloque" aria-labelledby="rem-l-gong">
    <h2 id="rem-l-gong" class="rem-label">Sonido del gong</h2>
    <div id="rem-sonidos" class="rem-grid" role="group" aria-labelledby="rem-l-gong"></div>
    <div class="rem-probar"><button type="button" id="rem-probar" class="rem-enlace">Probar gong</button></div>
  </section>

  <section class="rem-bloque" aria-labelledby="rem-l-fondo">
    <h2 id="rem-l-fondo" class="rem-label">Fondo</h2>
    <div id="rem-fondos" class="rem-grid" role="group" aria-labelledby="rem-l-fondo"></div>
    <div class="rem-volumen"><label for="rem-volumen">Volumen del fondo</label><input id="rem-volumen" type="range" min="0" max="100" value="55"></div>
  </section>

  <div id="rem-aviso" class="rem-aviso" role="status" hidden>
    <p id="rem-aviso-texto"></p>
    ${avisoEnlace}
  </div>

  <button type="button" id="rem-comenzar" class="rem-primario">Comenzar</button>
</section>

<section id="rem-sesion" class="rem-pantalla rem-noche" aria-label="Sesión de meditación" hidden>
  <div class="rem-arriba"><span id="rem-s-titulo"></span><span id="rem-s-fondo"></span></div>
  <div class="rem-anillo">
    <svg id="rem-svg" width="300" height="300" viewBox="0 0 300 300" aria-hidden="true">
      <circle class="rem-anillo-pista" cx="150" cy="150" r="130" fill="none" stroke-width="4"/>
      <circle id="rem-progreso" class="rem-anillo-progreso" cx="150" cy="150" r="130" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 817" transform="rotate(-90 150 150)"/>
    </svg>
    <div id="rem-marcadores" aria-hidden="true"></div>
    <div class="rem-centro"><div id="rem-restante" class="rem-tiempo">0:00</div><div id="rem-restante-etiqueta" class="rem-sub">restantes</div></div>
  </div>
  <p id="rem-proximo" class="rem-proximo"></p>
  <p class="rem-frase">Volvé a la respiración,<br>sin apuro.</p>
  <div class="rem-controles">
    <button type="button" id="rem-terminar" class="rem-redondo" aria-label="Terminar sesión">${ICONS.stop}</button>
    <button type="button" id="rem-pausa" class="rem-grande" aria-label="Pausar">${ICONS.pause}${ICONS.play}</button>
    <button type="button" id="rem-mudo" class="rem-redondo" aria-label="Silenciar fondo">${ICONS.soundOn}${ICONS.soundOff}</button>
  </div>
  <p id="rem-anuncio" class="rem-lectores" role="status" aria-live="polite"></p>
</section>

<section id="rem-cierre" class="rem-pantalla" aria-labelledby="rem-c-titulo" hidden>
  <div class="rem-cierre-centro">
    ${ICONS.calm}
    <h1 id="rem-c-titulo" tabindex="-1"></h1>
    <p id="rem-c-saludo"></p>
    <p id="rem-c-sub"></p>
  </div>
  <fieldset class="rem-animos">
    <legend>¿Cómo te sentís? <span>(opcional)</span></legend>
    <div class="rem-grid">${animos}</div>
  </fieldset>
  <div class="rem-pila">
    <button type="button" id="rem-volver" class="rem-primario">Volver al inicio</button>
    <button type="button" id="rem-repetir" class="rem-secundario">Repetir sesión</button>
  </div>
</section>
</div>`;
}

async function currentProfile(c, { localUser, ensureLocalUser, signedInUser }) {
  const host = new URL(c.req.url).hostname;
  // Igual que /perfil: el usuario local sólo existe en localhost, nunca por IP de la red.
  const localEmail = host === "localhost" || host === "127.0.0.1" ? localUser(c) : null;
  if (localEmail) {
    const user = await ensureLocalUser(c.env.DB, localEmail);
    return readOwnProfile(c.env.DB, user.id);
  }
  // Sin cookie de sesión no se consulta D1.
  const session = await signedInUser(c);
  return session ? readOwnProfile(c.env.DB, session.user_id) : null;
}

export function registerRemansoRoutes(app, { page, html, googleConfigured, ...deps }) {
  app.get("/remanso", async (c) => {
    const profile = await currentProfile(c, deps);
    const content = renderRemanso({
      html,
      nombre: profile?.displayName ?? null,
      loginDisponible: googleConfigured(c.env),
    });
    return c.html(page("Remanso", content, REMANSO_ASSETS));
  });
}
