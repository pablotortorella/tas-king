import { formatLegalDate } from "../legal.js";
import { escapeHtml as html } from "../ui-parts.js";
import { periodRange } from "../usage-periods.js";
import { CONSOLE_TABS, ROLE_SCOPES, SCOPE_LABELS } from "./access.js";
import { PERIOD_NAMES, SUITE_PERIODS } from "./data.js";

// Pantallas de la consola (design.md D9): se dibujan en el servidor, sin JS; los gráficos son SVG en línea con texto alternativo y una
// tabla equivalente. Textos en español rioplatense, sin género.

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PERIOD_PARAM = Object.fromEntries(Object.entries(SUITE_PERIODS).map(([param, type]) => [type, param]));
const shortDay = (day) => { const [, month, date] = day.split("-").map(Number); return `${date} de ${MONTHS[month - 1].slice(0, 3)}.`; };
const number = (value) => new Intl.NumberFormat("es-CO").format(value);
const signed = (value) => (value === null ? "—" : value > 0 ? `+${number(value)}` : value < 0 ? `−${number(-value)}` : "0");
const percent = (value) => (value === null ? "—" : `${Math.round(value * 100)} %`);
const bytes = (value) => (value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(value / 1024)} KB`);
const when = (timestamp) => (timestamp ? formatLegalDate(String(timestamp).slice(0, 10)) : "—");

export function periodLabel(type, key) {
  const { start, end } = periodRange(type, key);
  if (type === "week") return `Semana ${Number(key.slice(6))} de ${key.slice(0, 4)} (${shortDay(start)} al ${shortDay(end)})`;
  if (type === "month") { const month = MONTHS[Number(key.slice(5)) - 1]; return `${month[0].toUpperCase()}${month.slice(1)} de ${key.slice(0, 4)}`; }
  if (type === "quarter") return `${key.slice(6)}.º trimestre de ${key.slice(0, 4)}`;
  if (type === "year") return key;
  return formatLegalDate(key);
}

const shortPeriod = (type, key) => (type === "week" ? `S${Number(key.slice(6))} ${key.slice(2, 4)}` : type === "month" ? `${MONTHS[Number(key.slice(5)) - 1].slice(0, 3)}. ${key.slice(2, 4)}` : type === "quarter" ? `T${key.slice(6)} ${key.slice(2, 4)}` : key);

function suiteHref(type, key, tool = null) {
  const params = new URLSearchParams({ periodo: PERIOD_PARAM[type], clave: key });
  if (tool) params.set("herramienta", tool);
  return html(`/consola/suite?${params}`);
}

export function consoleNav(tabs, current) {
  const links = CONSOLE_TABS.filter((tab) => tabs.includes(tab.id)).map((tab) => `<a href="/consola/${tab.id}"${tab.id === current ? ' aria-current="page"' : ""}>${html(tab.label)}</a>`).join("");
  return `<p class="eyebrow">HomeSuite</p><h1>Consola</h1><nav class="type-tabs console-tabs" aria-label="Secciones de la consola">${links}</nav>`;
}

// Gráfico de líneas: `series` = [{ label, values: (número | null)[] }]; `labels` = etiqueta de cada punto. Cada serie tiene también su
// trazo (continuo, discontinuo, de puntos) para no depender sólo del color.
function lineChart({ id, title, labels, series }) {
  const width = 640; const height = 220; const pad = { top: 16, right: 16, bottom: 30, left: 40 };
  const values = series.flatMap((serie) => serie.values).filter((value) => value !== null);
  const max = Math.max(1, ...values);
  const x = (index) => pad.left + (labels.length <= 1 ? (width - pad.left - pad.right) / 2 : (index * (width - pad.left - pad.right)) / (labels.length - 1));
  const y = (value) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const lines = series.map((serie, index) => {
    const points = serie.values.map((value, i) => (value === null ? null : `${x(i).toFixed(1)},${y(value).toFixed(1)}`)).filter(Boolean);
    const dots = serie.values.map((value, i) => (value === null ? "" : `<circle class="chart-dot chart-s${index + 1}" cx="${x(i).toFixed(1)}" cy="${y(value).toFixed(1)}" r="3"/>`)).join("");
    return `${points.length > 1 ? `<polyline class="chart-line chart-s${index + 1}" points="${points.join(" ")}"/>` : ""}${dots}`;
  }).join("");
  const step = Math.max(1, Math.ceil(labels.length / 8));
  const ticks = labels.map((label, i) => (i % step === 0 || i === labels.length - 1 ? `<text class="chart-tick" x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle">${html(label)}</text>` : "")).join("");
  const summary = series.map((serie) => { const last = [...serie.values].reverse().find((value) => value !== null); return `${serie.label}: ${last ?? "sin datos"} al final`; }).join("; ");
  const legend = series.map((serie, index) => `<li><span class="chart-key chart-s${index + 1}" aria-hidden="true"></span>${html(serie.label)}</li>`).join("");
  const rows = labels.map((label, i) => `<tr><th scope="row">${html(label)}</th>${series.map((serie) => `<td>${serie.values[i] === null ? "—" : number(serie.values[i])}</td>`).join("")}</tr>`).join("");
  return `<figure class="console-chart"><svg role="img" aria-labelledby="${id}-t ${id}-d" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><title id="${id}-t">${html(title)}</title><desc id="${id}-d">${html(summary)}</desc><line class="chart-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"/><text class="chart-tick" x="${pad.left - 6}" y="${pad.top + 4}" text-anchor="end">${number(max)}</text><text class="chart-tick" x="${pad.left - 6}" y="${height - pad.bottom}" text-anchor="end">0</text>${lines}${ticks}</svg><figcaption><ul class="chart-legend">${legend}</ul></figcaption><details class="chart-table"><summary>Ver como tabla</summary><div class="table-scroll"><table class="balance-table"><caption class="sr-only">${html(title)}</caption><thead><tr><th scope="col">Período</th>${series.map((serie) => `<th scope="col">${html(serie.label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
}

function statCards(items) {
  return `<dl class="console-stats">${items.map(([label, value, hint]) => `<div><dt>${html(label)}</dt><dd>${value}</dd>${hint ? `<p class="muted">${html(hint)}</p>` : ""}</div>`).join("")}</dl>`;
}

function periodPicker(period) {
  // Al cambiar de tipo se va al período de ese tipo que contiene el último día del elegido (o hoy, si el elegido está en curso).
  const types = Object.values(SUITE_PERIODS).map((type) => `<a href="${suiteHref(type, period.anchorKeys[type])}"${type === period.type ? ' aria-current="page"' : ""}>${PERIOD_NAMES[type]}</a>`).join("");
  const previous = `<a class="button secondary" href="${suiteHref(period.type, period.previousKey, period.tool)}" aria-label="Período anterior">← Anterior</a>`;
  const next = period.hasNext ? `<a class="button secondary" href="${suiteHref(period.type, period.nextKey, period.tool)}" aria-label="Período siguiente">Siguiente →</a>` : "";
  return `<nav class="type-tabs" aria-label="Tipo de período">${types}</nav><div class="console-period"><h2>${html(periodLabel(period.type, period.key))}</h2><div class="console-arrows">${previous}${next}</div></div>`;
}

export function renderSuite(data, period) {
  const head = periodPicker(period);
  if (!data.hasData) return `${head}<p class="notice" role="status">No hay datos para este período. La medición empezó a funcionar después.</p>`;
  const latest = data.latest;
  const snapshotHint = latest ? `Al ${formatLegalDate(latest.day)}` : "Sin foto diaria en este período";
  const cards = statCards([
    ["Cuentas", latest ? number(latest.accounts) : "—", snapshotHint],
    ["Activas en el día", latest ? number(latest.active_1d) : "—", null],
    ["Activas en 7 días", latest ? number(latest.active_7d) : "—", null],
    ["Activas en 30 días", latest ? number(latest.active_30d) : "—", null],
  ]);
  const byDay = new Map(data.snapshots.map((row) => [row.day, row]));
  const days = data.days.filter((day) => day <= period.today);
  const activity = data.snapshots.length ? lineChart({
    id: "chart-activas", title: "Personas activas por día", labels: days.map(shortDay),
    series: [["En el día", "active_1d"], ["En 7 días", "active_7d"], ["En 30 días", "active_30d"]].map(([label, column]) => ({ label, values: days.map((day) => byDay.get(day)?.[column] ?? null) })),
  }) : "";
  const rows = data.tools.map((row) => `<tr><th scope="row"><a href="${suiteHref(period.type, period.key, row.tool)}"${period.tool === row.tool ? ' aria-current="true"' : ""}>${html(row.label)}</a></th><td>${number(row.entro)}</td><td>${number(row.hizo)}</td><td>${percent(row.ratio)}</td><td>${row.hasPrevious ? signed(row.diffEntro) : "—"}</td><td>${row.hasPrevious ? signed(row.diffHizo) : "—"}</td></tr>`).join("");
  const toolTable = `<section class="card"><h2>Uso por herramienta</h2><p class="muted">Personas distintas en el período. La diferencia se compara con ${html(periodLabel(period.type, data.previous).toLowerCase())}. Elegí una herramienta para ver su serie.</p><div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Herramienta</th><th scope="col">Entraron</th><th scope="col">Hicieron algo</th><th scope="col">Proporción</th><th scope="col">Diferencia en entraron</th><th scope="col">Diferencia en hicieron algo</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  const actions = `<section class="card"><h2>Acciones del período</h2>${data.actions.map((group) => `<h3>${html(group.label)}</h3><table class="balance-table console-table"><tbody>${group.rows.map((row) => `<tr><th scope="row">${html(row.label)}</th><td>${number(row.total)}</td></tr>`).join("")}</tbody></table>`).join("")}</section>`;
  const tool = period.tool ? data.tools.find((row) => row.tool === period.tool) : null;
  const series = tool ? `<section class="card" id="serie"><h2>${html(tool.label)}: personas por ${html(PERIOD_NAMES[period.type].toLowerCase())}</h2>${lineChart({ id: "chart-herramienta", title: `${tool.label}: personas distintas por período`, labels: data.series.map((row) => shortPeriod(period.type, row.key)), series: [{ label: "Entraron", values: data.series.map((row) => row.entro) }, { label: "Hicieron algo", values: data.series.map((row) => row.hizo) }] })}<a class="button secondary" href="${suiteHref(period.type, period.key)}">Cerrar la serie</a></section>` : "";
  return `${head}${cards}${activity ? `<section class="card"><h2>Personas activas</h2>${activity}</section>` : ""}${toolTable}${series}${actions}`;
}

export function renderTareas(data, { owner }) {
  const totals = statCards([
    ["Cuentas", number(data.totals.accounts)], ["Tableros", number(data.totals.boards)],
    ["Tarjetas activas", number(data.totals.cards)], ["Adjuntos", `${number(data.totals.files)}`, bytes(data.totals.filesSize)],
  ]);
  const accounts = data.accounts.map((row) => `<tr><th scope="row">${html(row.name || "Sin nombre")}</th><td>${html(row.email)}</td><td>${row.linked ? "Sí" : "Todavía no"}</td></tr>`).join("");
  const ranking = owner && data.ranking ? `<section class="card"><h2>Cuentas más activas</h2><p class="muted">Sólo lo ven quienes tienen acceso total. Cuenta tableros propios, sus tarjetas y comentarios.</p><div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Cuenta</th><th scope="col">Tableros</th><th scope="col">Tarjetas</th><th scope="col">Comentarios</th><th scope="col">Total</th></tr></thead><tbody>${data.ranking.map((row) => `<tr><th scope="row">${html(row.name || "Sin nombre")}</th><td>${number(row.boards)}</td><td>${number(row.cards)}</td><td>${number(row.comments)}</td><td>${number(row.activity)}</td></tr>`).join("")}</tbody></table></div></section>` : "";
  return `${totals}<section class="card"><h2>Cuentas de Tareas</h2><p class="muted">Ver esta lista queda registrado.</p><div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Con cuenta de HomeSuite</th></tr></thead><tbody>${accounts}</tbody></table></div></section>${ranking}`;
}

export function renderCuentasClaras() {
  return `<section class="card"><h2>Cuentas Claras</h2><p>Todavía no hay herramientas de administración para Cuentas Claras.</p></section>`;
}

const NOTICES = Object.freeze({
  "rol-dado": "Rol dado.", "rol-quitado": "Rol quitado.", "sin-cambios": "No hubo cambios: el rol ya estaba así.",
  "cuenta-no-encontrada": "No hay ninguna cuenta de HomeSuite con ese correo.", "acceso-total": "Esa cuenta ya tiene acceso total.",
});

export function renderAdmin(data, { csrf, notice }) {
  const message = NOTICES[notice] ? `<p class="notice" role="status">${html(NOTICES[notice])}</p>` : "";
  const owners = data.owners.length
    ? `<ul class="console-list">${data.owners.map((row) => `<li><strong>${html(row.name)}</strong> · ${html(row.email)} <span class="muted">(acceso total)</span></li>`).join("")}</ul>`
    : `<p class="muted">Ninguna cuenta de esta base figura en la configuración.</p>`;
  const options = ROLE_SCOPES.map((scope) => `<option value="${scope}">${html(SCOPE_LABELS[scope])}</option>`).join("");
  const roles = data.roles.length
    ? `<div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Cuenta</th><th scope="col">Herramienta</th><th scope="col">Desde</th><th scope="col">Lo dio</th><th scope="col"><span class="sr-only">Acción</span></th></tr></thead><tbody>${data.roles.map((row) => `<tr><th scope="row">${html(row.name)}<br><span class="muted">${html(row.email)}</span></th><td>${html(SCOPE_LABELS[row.scope] ?? row.scope)}</td><td>${when(row.grantedAt)}</td><td>${html(row.grantedBy ?? "Migración de Tareas")}</td><td><form method="post" action="/consola/administradores/roles">${csrf}<input type="hidden" name="accion" value="quitar"><input type="hidden" name="cuenta" value="${html(row.userId)}"><input type="hidden" name="herramienta" value="${html(row.scope)}"><button class="button danger" type="submit" aria-label="Quitar el rol ${html(SCOPE_LABELS[row.scope] ?? row.scope)} a ${html(row.name)}">Quitar</button></form></td></tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">Todavía no hay roles por herramienta.</p>`;
  const grant = `<form class="card console-form" method="post" action="/consola/administradores/roles">${csrf}<input type="hidden" name="accion" value="dar"><h2>Dar un rol</h2><label class="label" for="rol-correo">Correo de la cuenta</label><input id="rol-correo" name="correo" type="email" required autocomplete="off" placeholder="nombre@example.com"><label class="label" for="rol-herramienta">Herramienta</label><select id="rol-herramienta" name="herramienta">${options}</select><p class="hint">Quien tiene un rol ve sólo la pestaña de esa herramienta, con los correos de sus cuentas.</p><button class="button" type="submit">Dar rol</button></form>`;
  const history = data.history.length
    ? `<div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Fecha</th><th scope="col">Cambio</th><th scope="col">Quién</th><th scope="col">Cuenta</th></tr></thead><tbody>${data.history.map((row) => `<tr><td>${when(row.createdAt)}</td><td>${row.action === "platform_role_granted" ? "Dio" : "Quitó"} el rol ${html(SCOPE_LABELS[row.scope] ?? row.scope ?? "")}</td><td>${html(row.actor ?? "—")}</td><td>${html(row.target ?? "Cuenta borrada")}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">Sin cambios de roles todavía.</p>`;
  const tabNames = Object.fromEntries(CONSOLE_TABS.map((tab) => [tab.id, tab.label]));
  const entries = data.entries.length
    ? `<div class="table-scroll"><table class="balance-table console-table"><thead><tr><th scope="col">Día</th><th scope="col">Quién</th><th scope="col">Primera pestaña</th></tr></thead><tbody>${data.entries.map((row) => `<tr><td>${formatLegalDate(row.day)}</td><td>${html(row.actor ?? "Cuenta borrada")}</td><td>${html(tabNames[row.tab] ?? "—")}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">Sin entradas registradas.</p>`;
  return `${message}<section class="card"><h2>Acceso total</h2><p class="muted">Se define en la configuración del Worker, no desde esta pantalla.</p>${owners}</section><section class="card"><h2>Roles por herramienta</h2>${roles}</section>${grant}<section class="card"><h2>Historial de roles</h2>${history}</section><section class="card"><h2>Últimas entradas a la consola</h2>${entries}</section>`;
}
