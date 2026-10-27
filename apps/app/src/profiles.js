import { createPlatformId } from "./platform.js";

export class ProfileError extends Error {
  constructor(message, status = 400, code = "invalid_profile") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const AVATAR_COLORS = Object.freeze({
  ocean: "#0079bf", forest: "#519839", clay: "#b04632",
  violet: "#89609e", rose: "#cd5a91", mint: "#4bbf6b",
  cyan: "#00aecc", slate: "#838c91", amber: "#d29034",
});

const COLOR_TOKENS = Object.keys(AVATAR_COLORS);
const EMOJI_SEGMENTER = new Intl.Segmenter("und", { granularity: "grapheme" });
const TEXT_CONTROLS = /[\p{Cc}\p{Cf}]/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL_PAIR = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /^[0-9#*]\uFE0F?\u20E3$/u;
const GOOGLE_PICTURE_HOSTS = new Set([
  "lh3.googleusercontent.com", "lh4.googleusercontent.com",
  "lh5.googleusercontent.com", "lh6.googleusercontent.com",
]);

function invalid(message) { throw new ProfileError(message); }
function length(value) { return Array.from(value).length; }

export function normalizeVisibleName(value) {
  if (typeof value !== "string") invalid("El nombre debe ser texto.");
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!name || length(name) > 120 || TEXT_CONTROLS.test(name)) invalid("El nombre debe tener entre 1 y 120 caracteres válidos.");
  return name;
}

export function googleDisplayName(value) {
  if (typeof value !== "string") return null;
  try { return normalizeVisibleName(Array.from(value.normalize("NFC")).slice(0, 120).join("")); }
  catch { return null; }
}

export function normalizeNickname(value) {
  if (typeof value !== "string") invalid("El apodo debe ser texto.");
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (length(name) > 60 || TEXT_CONTROLS.test(name)) invalid("El apodo puede tener hasta 60 caracteres válidos.");
  return name || null;
}

export function normalizeEmoji(value) {
  if (typeof value !== "string") invalid("El emoji debe ser texto.");
  const emoji = value.normalize("NFC").trim();
  const segments = [...EMOJI_SEGMENTER.segment(emoji)];
  if (length(emoji) > 32 || segments.length !== 1 ||
      !(PICTOGRAPHIC.test(emoji) || REGIONAL_PAIR.test(emoji) || KEYCAP.test(emoji)) ||
      /[\p{Cc}]/u.test(emoji)) invalid("Elegí un único emoji completo.");
  return emoji;
}

export function googlePictureUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && GOOGLE_PICTURE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch { return null; }
}

function initial(name) {
  return [...EMOJI_SEGMENTER.segment(name || "Usuario")][0]?.segment.toLocaleUpperCase("es") || "U";
}

function defaultColor(userId) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLOR_TOKENS[hash % COLOR_TOKENS.length];
}

function visibleName(row) {
  return row.name_source === "custom"
    ? row.custom_display_name || row.display_name || "Usuario"
    : row.google_display_name || "Usuario";
}

export function presentProfile(row, nickname = null) {
  const displayName = visibleName(row);
  const color = row.avatar_color || defaultColor(row.user_id);
  const photo = row.avatar_mode === "google" ? googlePictureUrl(row.google_picture_url) : null;
  const type = photo ? "photo" : row.avatar_mode === "emoji" ? "emoji" : "initial";
  return {
    userId: row.user_id, displayName, nickname,
    avatar: {
      mode: row.avatar_mode, type,
      photoUrl: photo, emoji: type === "emoji" ? row.avatar_emoji : null,
      color, colorValue: AVATAR_COLORS[color], initial: initial(displayName),
    },
  };
}

export async function ensureProfile(db, userId) {
  await db.prepare(`INSERT OR IGNORE INTO user_profiles (user_id, name_source, custom_display_name)
    SELECT id, 'custom', display_name FROM users WHERE id = ?`).bind(userId).run();
  const row = await db.prepare(`SELECT u.id AS user_id, u.display_name, p.* FROM users u
    JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`).bind(userId).first();
  if (!row) throw new ProfileError("Usuario no encontrado.", 404, "profile_not_found");
  return row;
}

export async function readOwnProfile(db, userId) {
  const row = await ensureProfile(db, userId);
  const presentation = presentProfile(row);
  return {
    ...presentation,
    avatar: { ...presentation.avatar, savedEmoji: row.avatar_emoji },
    nameSource: row.name_source, googleDisplayName: row.google_display_name,
    revision: row.revision, colors: AVATAR_COLORS,
  };
}

export async function updateGoogleProfile(db, userId, { name, picture } = {}) {
  const validName = googleDisplayName(name);
  const validPhoto = googlePictureUrl(picture);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await ensureProfile(db, userId);
    const googleName = validName || current.google_display_name;
    if (googleName === current.google_display_name && validPhoto === current.google_picture_url) {
      return { id: userId, display_name: visibleName(current) };
    }
    const mutationId = createPlatformId("mutation");
    const nextName = current.name_source === "custom" ? current.custom_display_name : googleName || "Usuario";
    const results = await db.batch([
      db.prepare(`UPDATE user_profiles SET google_display_name = ?, google_picture_url = ?,
        revision = revision + 1, last_mutation_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND revision = ?`)
        .bind(googleName, validPhoto, mutationId, userId, current.revision),
      db.prepare(`UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ? AND last_mutation_id = ?)`)
        .bind(nextName, userId, userId, mutationId),
    ]);
    if (results[0].meta.changes === 1) return { id: userId, display_name: nextName };
  }
  throw new ProfileError("El perfil cambió durante el acceso. Reintentá.", 409, "profile_conflict");
}

function profilePatch(current, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) invalid("Datos de perfil inválidos.");
  const allowed = new Set(["expectedRevision", "nameSource", "displayName", "avatarMode", "emoji", "color"]);
  if (Object.keys(patch).some(key => !allowed.has(key))) invalid("El perfil incluye un campo desconocido.");
  if (!Number.isSafeInteger(patch.expectedRevision) || patch.expectedRevision < 0) invalid("Falta la revisión del perfil.");
  let nameSource = current.name_source;
  let customName = current.custom_display_name;
  if (Object.hasOwn(patch, "displayName")) {
    customName = normalizeVisibleName(patch.displayName);
    nameSource = "custom";
  }
  if (Object.hasOwn(patch, "nameSource")) {
    if (!["google", "custom"].includes(patch.nameSource)) invalid("Fuente de nombre inválida.");
    nameSource = patch.nameSource;
    if (nameSource === "google") customName = null;
  }
  if (nameSource === "custom" && !customName) invalid("Indicá un nombre para mostrar.");
  const mode = Object.hasOwn(patch, "avatarMode") ? patch.avatarMode : current.avatar_mode;
  if (!["google", "emoji", "initial"].includes(mode)) invalid("Modo de avatar inválido.");
  const emoji = Object.hasOwn(patch, "emoji") ? normalizeEmoji(patch.emoji) : current.avatar_emoji;
  if (mode === "emoji" && !emoji) invalid("Elegí un emoji.");
  const color = Object.hasOwn(patch, "color") ? patch.color : current.avatar_color;
  if (color != null && (typeof color !== "string" || !Object.hasOwn(AVATAR_COLORS, color))) invalid("Color de avatar inválido.");
  return { nameSource, customName, mode, emoji, color };
}

export async function saveOwnProfile(db, userId, patch) {
  const current = await ensureProfile(db, userId);
  const next = profilePatch(current, patch);
  if (patch.expectedRevision !== current.revision) throw new ProfileError("El perfil cambió. Volvé a cargarlo.", 409, "profile_conflict");
  const mutationId = createPlatformId("mutation");
  const displayName = next.nameSource === "custom" ? next.customName : current.google_display_name || "Usuario";
  const results = await db.batch([
    db.prepare(`UPDATE user_profiles SET name_source = ?, custom_display_name = ?, avatar_mode = ?,
      avatar_emoji = ?, avatar_color = ?, revision = revision + 1, last_mutation_id = ?,
      updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revision = ?`)
      .bind(next.nameSource, next.customName, next.mode, next.emoji, next.color, mutationId, userId, current.revision),
    db.prepare(`UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ? AND last_mutation_id = ?)`)
      .bind(displayName, userId, userId, mutationId),
    db.prepare(`INSERT INTO platform_audit_events (id, actor_user_id, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'profile_updated', 'user_profile', ?, ? FROM user_profiles
      WHERE user_id = ? AND last_mutation_id = ?`)
      .bind(createPlatformId("audit"), userId, userId, JSON.stringify({ revision: current.revision + 1, fields: Object.keys(patch).filter(k => k !== "expectedRevision") }), userId, mutationId),
  ]);
  if (results[0].meta.changes !== 1) throw new ProfileError("El perfil cambió. Volvé a cargarlo.", 409, "profile_conflict");
  return readOwnProfile(db, userId);
}

export async function readOwnPresentation(db, groupIdOrSlug, userId) {
  const row = await db.prepare(`SELECT m.group_id, m.nickname, m.presentation_revision,
    m.membership_generation FROM memberships m
    WHERE m.group_id = ? AND m.user_id = ?`)
    .bind(groupIdOrSlug, userId).first();
  if (!row) throw new ProfileError("Grupo no encontrado.", 404, "group_not_found");
  if (!row.membership_generation) {
    await db.prepare(`UPDATE memberships SET membership_generation = ?
      WHERE group_id = ? AND user_id = ? AND membership_generation IS NULL`)
      .bind(createPlatformId("membership"), row.group_id, userId).run();
    return readOwnPresentation(db, row.group_id, userId);
  }
  const profile = await ensureProfile(db, userId);
  return {
    ...presentProfile(profile, row.nickname),
    groupId: row.group_id, revision: row.presentation_revision,
    generation: row.membership_generation,
  };
}

export async function saveOwnNickname(db, groupId, userId, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
      Object.keys(patch).some(k => !["nickname", "expectedRevision", "generation"].includes(k)) ||
      !Object.hasOwn(patch, "nickname")) invalid("Datos del apodo inválidos.");
  const nickname = normalizeNickname(patch.nickname);
  if (!Number.isSafeInteger(patch.expectedRevision) || patch.expectedRevision < 0 ||
      typeof patch.generation !== "string" || !patch.generation) invalid("Falta la revisión de la membresía.");
  const current = await readOwnPresentation(db, groupId, userId);
  if (current.revision !== patch.expectedRevision || current.generation !== patch.generation) {
    throw new ProfileError("La membresía cambió. Volvé a cargarla.", 409, "presentation_conflict");
  }
  const mutationId = createPlatformId("mutation");
  const results = await db.batch([
    db.prepare(`UPDATE memberships SET nickname = ?, presentation_revision = presentation_revision + 1,
      last_presentation_mutation_id = ? WHERE group_id = ? AND user_id = ?
      AND presentation_revision = ? AND membership_generation = ?`)
      .bind(nickname, mutationId, current.groupId, userId, current.revision, current.generation),
    db.prepare(`INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, ?, 'nickname_updated', 'membership', ?, ? FROM memberships
      WHERE group_id = ? AND user_id = ? AND last_presentation_mutation_id = ?`)
      .bind(createPlatformId("audit"), userId, current.groupId, userId, JSON.stringify({ revision: current.revision + 1, empty: nickname === null }), current.groupId, userId, mutationId),
  ]);
  if (results[0].meta.changes !== 1) throw new ProfileError("La membresía cambió. Volvé a cargarla.", 409, "presentation_conflict");
  return readOwnPresentation(db, current.groupId, userId);
}

export async function listMemberPresentations(db, groupId, viewerId) {
  const access = await db.prepare("SELECT 1 FROM memberships WHERE group_id = ? AND user_id = ?")
    .bind(groupId, viewerId).first();
  if (!access) throw new ProfileError("Grupo no encontrado.", 404, "group_not_found");
  const rows = await db.prepare(`SELECT u.id AS user_id, u.display_name, p.name_source,
    p.google_display_name, p.custom_display_name, p.google_picture_url, p.avatar_mode,
    p.avatar_emoji, p.avatar_color, m.nickname, m.role
    FROM memberships m JOIN users u ON u.id = m.user_id
    LEFT JOIN user_profiles p ON p.user_id = u.id WHERE m.group_id = ?
    AND EXISTS (SELECT 1 FROM memberships viewer WHERE viewer.group_id = m.group_id AND viewer.user_id = ?)
    ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, u.display_name, u.id`)
    .bind(groupId, viewerId).all();
  return rows.results.map(row => ({ ...presentProfile({
    ...row, name_source: row.name_source || "custom",
    custom_display_name: row.custom_display_name || row.display_name,
    avatar_mode: row.avatar_mode || "google",
  }, row.nickname), role: row.role }));
}
