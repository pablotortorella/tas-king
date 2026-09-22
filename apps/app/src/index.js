import { Hono } from "hono";

const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const DEMO_PAIRS = Object.freeze([
  ["Zelda", "Link"], ["Tom", "Jerry"], ["Sherlock", "Watson"],
  ["Quijote", "Sancho"], ["Robin", "Marian"], ["Shrek", "Fiona"],
  ["Frodo", "Sam"], ["Wallace", "Gromit"], ["Calvin", "Hobbes"],
  ["Mario", "Luigi"], ["Lilo", "Stitch"], ["Asterix", "Obelix"],
]);
let nextDemoIndex = 0;

function demoPair(c) {
  const requested = Number.parseInt(c.req.query("ejemplo") ?? "0", 10);
  const index = Number.isInteger(requested) ? Math.abs(requested) % DEMO_PAIRS.length : 0;
  return { owner: DEMO_PAIRS[index][0], member: DEMO_PAIRS[index][1], index };
}

function startDemoPair() {
  const index = nextDemoIndex;
  nextDemoIndex = (nextDemoIndex + 1) % DEMO_PAIRS.length;
  return { owner: DEMO_PAIRS[index][0], member: DEMO_PAIRS[index][1], index };
}

function demoQuery(index) {
  return `ejemplo=${index}`;
}

export const app = new Hono();

function page(title, content) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · HomeSuite</title><link rel="stylesheet" href="/app.css"><body><main class="shell"><a class="brand" href="/">⌂ HomeSuite</a>${content}</main></body></html>`;
}

app.use("*", async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
});

app.get("/healthz", (c) => c.json({ status: "ok", service: "homesuite-app" }));

app.get("/api/me", (c) => c.json({ error: "Una sesión es requerida." }, 401));

app.get("/app.css", (c) => c.body(`:root{font-family:system-ui,sans-serif;color:#20342a;background:#f7f2e8}*{box-sizing:border-box}body{margin:0}.shell{max-width:720px;margin:auto;padding:32px 24px 72px}.brand{color:#206447;text-decoration:none;font-weight:800}.eyebrow{color:#d95f46;font-size:.8rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin-top:72px}h1{font-family:Georgia,serif;font-size:clamp(2.7rem,9vw,4.8rem);line-height:1;margin:14px 0 22px}h2{font-family:Georgia,serif;font-size:2rem;margin:0 0 12px}p{font-size:1.1rem;line-height:1.6;color:#52665b}.card{background:#fffaf0;border:1px solid #d9d0c0;border-radius:18px;padding:24px;margin-top:28px}.button{display:inline-block;background:#206447;color:white;border:0;border-radius:999px;padding:14px 20px;text-decoration:none;font-weight:800;margin-top:14px}.button.secondary{background:transparent;color:#206447;border:1px solid #206447}.label{font-weight:800;display:block;margin:20px 0 7px}input{width:100%;padding:13px;border:1px solid #b8b1a5;border-radius:9px;font:inherit}.notice{background:#e6f0e9;border-radius:10px;padding:14px;color:#28533c;font-size:.95rem}.person{border-top:1px solid #ddd3c3;padding:15px 0}.muted{font-size:.9rem;color:#68766d}` , 200, { "Content-Type": "text/css; charset=utf-8" }));

app.get("/", (c) => {
  const { index } = startDemoPair();
  return c.html(page("Bienvenida", `<p class="eyebrow">Cuentas Claras</p><h1>Lo compartido, más claro.</h1><p>Un lugar privado para organizar las cuentas de tu casa, viaje o proyecto.</p><section class="card"><h2>Empezá con tu cuenta</h2><p>En la versión real vas a entrar con Google. Este es un recorrido local de prueba: no crea una cuenta ni guarda datos.</p><a class="button" href="/demo/crear-espacio?${demoQuery(index)}">Continuar con Google</a></section>`));
});

app.get("/demo/crear-espacio", (c) => {
  const { owner, member, index } = demoPair(c);
  return c.html(page("Crear espacio", `<p class="eyebrow">Primer paso</p><h1>¿Cómo se llama este espacio?</h1><p>Puede ser tu casa, familia, viaje o cualquier contexto que compartan.</p><form class="card" action="/demo/espacio"><input type="hidden" name="ejemplo" value="${index}"><label class="label" for="nombre">Nombre del espacio</label><input id="nombre" name="nombre" required maxlength="120" placeholder="Ej. Casa de ${owner} y ${member}"><button class="button" type="submit">Crear espacio</button></form>`));
});

app.get("/demo/espacio", (c) => {
  const name = c.req.query("nombre")?.trim() || "Casa compartida";
  const { owner, member, index } = demoPair(c);
  return c.html(page("Cuentas Claras", `<p class="eyebrow">${name}</p><h1>Cuentas Claras está lista.</h1><p>Cuando conectemos la cuenta real, aquí aparecerán los movimientos y balances del espacio. No inventamos números antes de tiempo.</p><section class="card"><h2>Participantes</h2><div class="person"><strong>${owner}</strong><br><span class="muted">Titular del espacio</span></div><div class="person"><strong>${member}</strong><br><span class="muted">Invitación pendiente · ${member.toLowerCase()}@example.com</span></div><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&${demoQuery(index)}">Ver lo que verá ${member}</a></section>`));
});

app.get("/demo/invitacion", (c) => {
  const name = c.req.query("nombre") || "Casa compartida";
  const { owner, index } = demoPair(c);
  const answer = c.req.query("respuesta");
  const result = answer ? `<p class="notice">Invitación ${answer === "aceptar" ? "aceptada" : "rechazada"} en esta demostración. En la aplicación real la acción quedará auditada.</p>` : `<p class="notice">Antes de aceptar no ves integrantes, movimientos ni saldos.</p><a class="button" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=aceptar&${demoQuery(index)}">Aceptar invitación</a><a class="button secondary" href="/demo/invitacion?nombre=${encodeURIComponent(name)}&respuesta=rechazar&${demoQuery(index)}">Rechazar</a>`;
  return c.html(page("Invitación", `<p class="eyebrow">Invitación a Cuentas Claras</p><h1>${name}</h1><p>Te invitó <strong>${owner}</strong>. Si aceptás, vas a poder acceder a Cuentas Claras de este espacio.</p><section class="card">${result}</section>`));
});

app.notFound((c) => c.json({ error: "No encontrado." }, 404));

app.onError((error, c) => {
  console.error("[homesuite-app]", error);
  return c.json({ error: "Error interno." }, 500);
});

export default { fetch: app.fetch };
