import { AVATAR_COLORS, defaultColor, initial, normalizeEmoji, ProfileError } from "./profiles.js";
import { normalizeGroupName } from "./platform.js";

// La identidad visible de un grupo: nombre, descripción, emoji y color. El emoji y el color siguen las mismas reglas que el avatar
// de un perfil personal; la descripción es texto plano.
export const DESCRIPTION_MAX = 500;
export const EXCERPT_MAX = 150;

export class GroupIdentityError extends ProfileError {
  constructor(message) { super(message, 400, "invalid_group"); }
}

export function normalizeDescription(value) {
  if (value == null) return null;
  if (typeof value !== "string") throw new GroupIdentityError("La descripción debe ser texto.");
  const text = value.normalize("NFC").replace(/\r\n?/gu, "\n").replace(/[^\S\n]+/gu, " ").replace(/ ?\n ?/gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
  if (/[\p{Cc}\p{Cf}]/u.test(text.replace(/\n/gu, ""))) throw new GroupIdentityError("La descripción tiene caracteres que no se pueden guardar.");
  if (Array.from(text).length > DESCRIPTION_MAX) throw new GroupIdentityError(`La descripción admite hasta ${DESCRIPTION_MAX} caracteres.`);
  return text || null;
}

function normalizeOptionalEmoji(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  return normalizeEmoji(value);
}

function normalizeColor(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !Object.hasOwn(AVATAR_COLORS, value)) throw new GroupIdentityError("Color inválido.");
  return value;
}

// Valida un cambio parcial: lo que no viene (undefined) no cambia. Devuelve solo los campos presentes, ya normalizados.
export function normalizeGroupPatch(patch) {
  const next = {};
  if (patch.name !== undefined) {
    const name = normalizeGroupName(patch.name);
    if (!name) throw new GroupIdentityError("El nombre del grupo debe tener entre 1 y 120 caracteres.");
    next.name = name;
  }
  if (patch.description !== undefined) next.description = normalizeDescription(patch.description);
  if (patch.emoji !== undefined) next.emoji = normalizeOptionalEmoji(patch.emoji);
  if (patch.color !== undefined) next.color = normalizeColor(patch.color);
  return next;
}

// Cómo se ve un grupo: nombre, descripción, avatar (emoji o inicial) y el color elegido o uno estable derivado del grupo.
export function presentGroup(row) {
  const color = row.avatar_color && Object.hasOwn(AVATAR_COLORS, row.avatar_color) ? row.avatar_color : defaultColor(String(row.id ?? row.slug ?? row.name ?? ""));
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description ?? null,
    emoji: row.avatar_emoji ?? null, color, colorChosen: row.avatar_color ?? null, initial: initial(row.name),
    role: row.role ?? null,
  };
}

// Extracto para el listado: hasta EXCERPT_MAX caracteres, cortado en el último límite de palabra y con «…» si se acorta.
export function excerpt(description, max = EXCERPT_MAX) {
  if (!description) return "";
  const flat = description.replace(/\s+/gu, " ").trim();
  const chars = Array.from(flat);
  if (chars.length <= max) return flat;
  const cut = chars.slice(0, max).join("");
  const boundary = cut.lastIndexOf(" ");
  const base = boundary > max * 0.5 ? cut.slice(0, boundary) : cut;
  return `${base.replace(/[\s.,;:!?¿¡-]+$/u, "")}…`;
}
