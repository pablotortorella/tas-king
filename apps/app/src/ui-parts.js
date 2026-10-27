// Piezas visuales compartidas: escape de HTML, íconos, avatares y la estructura de página.

import { DARK, LIGHT } from "./theme.js";

export const groupPath = groupId => `/groups/${encodeURIComponent(groupId)}`;
// El saldo grande se achica cuando el monto es largo: elige una clase según los caracteres para que nunca se salga del recuadro.
export const amountFit = text => { const length = [...String(text)].length; return length <= 12 ? "" : length <= 16 ? " fit-1" : length <= 20 ? " fit-2" : length <= 26 ? " fit-3" : " fit-4"; };
export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Marcas del encabezado que el servidor reemplaza con la cuenta de quien tiene sesión (ver account-ui.js).
export const ACCOUNT_MARKER = "<!--account-->";
export const ACCOUNT_MENU_MARKER = "<!--account-menu-->";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

const svg = (size, body) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = Object.freeze({
  expense: svg(22, '<path d="M7 17 17 7M8 7h9v9"/>'),
  income: svg(22, '<path d="M17 7 7 17M16 17H7V8"/>'),
  transfer: svg(22, '<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>'),
  imported: svg(22, '<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>'),
  voided: svg(22, '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>'),
  plus: svg(28, '<path d="M12 5v14M5 12h14"/>'),
  balance: svg(24, '<path d="M12 4v16M6 20h12M5 8h14M7 8l-3 7a3 3 0 0 0 6 0Zm10 0-3 7a3 3 0 0 0 6 0Z"/>'),
  list: svg(24, '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  people: svg(24, '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14a5.5 5.5 0 0 1 3 5"/>'),
  groups: svg(24, '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
});

export const LOGO = '<svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#245c43"/><path d="M14 30h36v25H14z" fill="#fff8e8"/><path d="M7 31 28 10a6 6 0 0 1 8 0l21 21a4 4 0 0 1-3 7H10a4 4 0 0 1-3-7Z" fill="#d7664f"/><path d="M26 55V45a6 6 0 0 1 12 0v10" fill="#245c43"/><path d="M18 42a3 3 0 0 1 6 0v5h-6Zm22 0a3 3 0 0 1 6 0v5h-6Z" fill="#f2c86b"/></svg>';

export function initials(name) {
  const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

function colorIndex(seed) {
  let hash = 0;
  for (const character of String(seed)) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return hash % 4;
}

export function avatar(name, { seed = name, noAccount = false } = {}) {
  const classes = noAccount ? "avatar noacct" : `avatar av${colorIndex(seed)}`;
  return `<span class="${classes}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

const NOTICES = Object.freeze({
  participante: "Participante agregado.",
  invitacion: "Invitación creada. Hasta que se acepte, la persona no puede ver el grupo.",
  cancelada: "Invitación cancelada.",
  renombrado: "Nombre del grupo guardado.",
  "persona-renombrada": "Nombre guardado.",
  "personas-unidas": "Personas unidas. Los movimientos de la persona unida pasaron a la destinataria y ya cuentan en su saldo.",
  guardado: "Movimiento guardado.",
  corregido: "Movimiento corregido.",
  anulado: "Movimiento anulado. Sigue visible en el historial y ya no cuenta en los saldos.",
  archivado: "Grupo archivado. Queda de sólo lectura y podés restaurarlo cuando quieras.",
  restaurado: "Grupo restaurado. Vuelve a aceptar movimientos.",
  "categoria-creada": "Categoría creada.",
  "categoria-existente": "Esa categoría ya existía (con otro nombre escrito): no se creó una nueva.",
  "categoria-guardada": "Categoría guardada.",
  "categoria-archivada": "Categoría archivada. Ya no se ofrece para movimientos nuevos y los existentes la siguen mostrando.",
  "categoria-restaurada": "Categoría restaurada.",
  "categoria-fusionada": "Categorías fusionadas. Los movimientos se muestran con la categoría de destino.",
  "importacion-cancelada": "Importación cancelada. No se guardó nada.",
});

// Sólo mensajes de la lista: el parámetro de la URL nunca se muestra tal cual.
export function noticeFor(key) {
  return Object.hasOwn(NOTICES, key ?? "") ? `<p class="notice" role="status">${escapeHtml(NOTICES[key])}</p>` : "";
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function shortDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(String(isoDate));
  if (!match) return String(isoDate);
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

// Menú de la aplicación (sin JavaScript: un <details>). Dentro de un grupo ofrece sus secciones; siempre ofrece lo común.
export function appMenu(groupHref) {
  const group = groupHref ? `<p class="menu-title">Este grupo</p><a href="${groupHref}#saldos">Saldos</a><a href="${groupHref}#movimientos">Movimientos</a><a href="${groupHref}/people">Personas</a><a href="${groupHref}/ledger/categories">Categorías</a><a href="${groupHref}/ledger/classify">Clasificar rápido</a><a href="${groupHref}/ledger/import">Importar de Splitwise</a><p class="menu-title">HomeSuite</p>` : "";
  return `<details class="menu"><summary aria-label="Abrir el menú"><span aria-hidden="true">☰</span><span class="menu-label">Menú</span></summary><nav aria-label="Menú">${group}<a href="/">Inicio</a><a href="/cuentas-claras?todos=1">Mis grupos</a>${ACCOUNT_MENU_MARKER}</nav></details>`;
}

export function tabbar(groupHref) {
  const item = (href, icon, label) => `<a href="${href}">${icon}<span>${label}</span></a>`;
  return `<nav class="tabbar" aria-label="Secciones del grupo">${item(`${groupHref}#saldos`, ICONS.balance, "Saldos")}${item(`${groupHref}#movimientos`, ICONS.list, "Movimientos")}<a class="fab" href="${groupHref}/ledger/new" aria-label="Agregar movimiento">${ICONS.plus}</a>${item(`${groupHref}/people`, ICONS.people, "Personas")}${item("/cuentas-claras", ICONS.groups, "Grupos")}</nav>`;
}

export function renderPage(title, content, { wide = false, groupHref = null } = {}) {
  const shellClass = `shell${wide ? " wide" : ""}${groupHref ? " has-tabbar" : ""}`;
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="${LIGHT.bg}" media="(prefers-color-scheme: light)"><meta name="theme-color" content="${DARK.bg}" media="(prefers-color-scheme: dark)"><title>${escapeHtml(title)} · HomeSuite</title><link rel="stylesheet" href="/app.css"><script type="module" src="/ledger-ui.js"></script><script src="/shell.js" defer></script><body><a class="skip" href="#contenido">Saltar al contenido</a><header class="topbar${wide ? "" : " narrow"}"><a class="brand" href="/">${LOGO}<span>HomeSuite</span></a><div class="header-actions">${ACCOUNT_MARKER}${appMenu(groupHref)}</div></header><main id="contenido" class="${shellClass}">${content}</main>${groupHref ? tabbar(groupHref) : ""}</body></html>`;
}
