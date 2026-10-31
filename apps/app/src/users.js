import { createPlatformId, normalizeEmail } from "./platform.js";
import { googleDisplayName, googlePictureUrl, updateGoogleProfile } from "./profiles.js";

export class GoogleIdentityConflictError extends Error {}

export async function upsertGoogleUser(db, { sub, email, name, picture }) {
  const normalizedEmail = normalizeEmail(email);
  if (typeof sub !== "string" || !sub || !normalizedEmail) throw new Error("Identidad Google inválida.");
  const matchingEmail = await db.prepare("SELECT id, google_sub FROM users WHERE email = ?").bind(normalizedEmail).first();
  if (matchingEmail && matchingEmail.google_sub !== sub) throw new GoogleIdentityConflictError("El email ya está vinculado a otra identidad.");
  const existing = await db.prepare("SELECT id FROM users WHERE google_sub = ?").bind(sub).first();
  const googleName = googleDisplayName(name);
  const visibleName = googleName || "Usuario";
  if (existing) {
    await db.prepare("UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(normalizedEmail, existing.id).run();
    const profile = await updateGoogleProfile(db, existing.id, { name, picture });
    return { id: existing.id, email: normalizedEmail, display_name: profile.display_name };
  }
  const id = createPlatformId("user");
  await db.batch([
    db.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)")
      .bind(id, sub, normalizedEmail, visibleName),
    db.prepare(`INSERT INTO user_profiles (user_id, name_source, google_display_name, google_picture_url)
      VALUES (?, 'google', ?, ?)`).bind(id, googleName, googlePictureUrl(picture)),
  ]);
  return { id, email: normalizedEmail, display_name: visibleName };
}
