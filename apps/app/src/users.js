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
    if(typeof emailAuthority==='boolean') await recordTaskingAuthority(db,existing.id,sub,emailAuthority);
    return { id: existing.id, email: normalizedEmail, display_name: profile.display_name };
  }
  const id = createPlatformId("user");
  await db.batch([
    db.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)")
      .bind(id, sub, normalizedEmail, visibleName),
    db.prepare(`INSERT INTO user_profiles (user_id, name_source, google_display_name, google_picture_url)
      VALUES (?, 'google', ?, ?)`).bind(id, googleName, googlePictureUrl(picture)),
  ]);
  if(typeof emailAuthority==='boolean') await recordTaskingAuthority(db,id,sub,emailAuthority);
  return { id, email: normalizedEmail, display_name: visibleName };
}

// Both outcomes are recorded: an old session can refresh its Google proof once,
// while a checked non-authoritative email must fail without an OAuth loop.
async function recordTaskingAuthority(db,userId,sub,authority){
  await db.prepare('INSERT INTO tasking_verified_accounts(user_id,google_sub,email_authority) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub,email_authority=excluded.email_authority,verified_at=CURRENT_TIMESTAMP').bind(userId,sub,authority?1:0).run();
}
