// Helpers de presentación sin estado.
//
// Todo lo de acá es una función pura: misma entrada, misma salida, sin leer ni
// escribir estado compartido ni tocar el documento. Esa es la condición para
// estar en el núcleo — es lo que permite importarlo desde cualquier módulo sin
// crear ciclos, y probarlo sin navegador.
//
// Ojo con lo que NO vive acá: isOverdue() e isUrgent() parecen de esta familia,
// pero consultan las columnas de cierre del tablero, o sea estado compartido.
// Meterlas acá obligaría al núcleo a depender del estado, que es exactamente la
// flecha que el diseño no quiere.

export const AVATAR_COLORS = [
  "#0079bf", "#519839", "#b04632", "#89609e", "#cd5a91",
  "#4bbf6b", "#00aecc", "#838c91", "#d29034",
];

// Paleta de etiquetas. La comparten el administrador de etiquetas del tablero y
// el selector de la tarjeta, o sea dos features: por eso vive en el núcleo y no
// en ninguna de las dos.
export const LABEL_COLORS = [
  "#F44336", "#2196F3", "#4CAF50", "#FFC107", "#FF9800",
  "#9C27B0", "#00BCD4", "#009688", "#E91E63", "#3F51B5",
];

export const shortName = (email) => (email || "").split("@")[0];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/**
 * Fecha del día en zona local, como YYYY-MM-DD.
 *
 * No usa toISOString(): eso convierte a UTC y, al este de Greenwich después de
 * las 21h o al oeste antes de las 3h, devuelve el día equivocado. El tip diario
 * y el avance por cuenta dependen de que el día sea el de quien mira la pantalla.
 */
export function fechaLocal(d = new Date()) {
  const dos = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export function relativeTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(ts).toLocaleDateString("es");
}

/** Color estable por email: la misma persona siempre recibe el mismo. */
export function defaultColor(email) {
  let h = 0;
  for (const ch of (email || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function avatarHtml(p, size) {
  p = p || {};
  const email = p.email || "";
  const name = p.name || shortName(email) || "?";
  const color = p.avatarColor || defaultColor(email || name);
  const inner = p.avatarEmoji ? p.avatarEmoji : (name[0] || "?").toUpperCase();
  const px = size || 22;
  return `<span class="avatar" style="background:${color};width:${px}px;height:${px}px;font-size:${Math.round(px * 0.5)}px"
      title="${escapeHtml(name)}">${escapeHtml(inner)}</span>`;
}
