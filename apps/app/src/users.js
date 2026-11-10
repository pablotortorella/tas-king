import { createPlatformId, normalizeEmail } from "./platform.js";
import { googleDisplayName, googlePictureUrl, updateGoogleProfile } from "./profiles.js";

export class GoogleIdentityConflictError extends Error {}

export async function upsertGoogleUser(db, { sub, email, name, picture, emailAuthority }) {
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
    if(emailAuthority) await db.prepare('INSERT INTO tasking_verified_accounts(user_id,google_sub) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub,verified_at=CURRENT_TIMESTAMP').bind(existing.id,sub).run();
    return { id: existing.id, email: normalizedEmail, display_name: profile.display_name };
  }
  const id = createPlatformId("user");
  await db.batch([
    db.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)")
      .bind(id, sub, normalizedEmail, visibleName),
    db.prepare(`INSERT INTO user_profiles (user_id, name_source, google_display_name, google_picture_url)
      VALUES (?, 'google', ?, ?)`).bind(id, googleName, googlePictureUrl(picture)),
  ]);
  if(emailAuthority) await db.prepare('INSERT INTO tasking_verified_accounts(user_id,google_sub) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub,verified_at=CURRENT_TIMESTAMP').bind(id,sub).run();
  return { id, email: normalizedEmail, display_name: visibleName };
}
