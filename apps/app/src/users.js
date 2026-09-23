import { createPlatformId, normalizeEmail } from "./platform.js";

export class GoogleIdentityConflictError extends Error {}

function displayName(name, email) {
  const candidate = typeof name === "string" ? name.trim().replace(/\s+/gu, " ") : "";
  return (candidate || email.split("@")[0]).slice(0, 120);
}

export async function upsertGoogleUser(db, { sub, email, name }) {
  const normalizedEmail = normalizeEmail(email);
  if (typeof sub !== "string" || !sub || !normalizedEmail) throw new Error("Identidad Google inválida.");
  const matchingEmail = await db.prepare("SELECT id, google_sub FROM users WHERE email = ?").bind(normalizedEmail).first();
  if (matchingEmail && matchingEmail.google_sub !== sub) throw new GoogleIdentityConflictError("El email ya está vinculado a otra identidad.");
  const existing = await db.prepare("SELECT id FROM users WHERE google_sub = ?").bind(sub).first();
  const visibleName = displayName(name, normalizedEmail);
  if (existing) {
    await db.prepare("UPDATE users SET email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(normalizedEmail, visibleName, existing.id).run();
    return { id: existing.id, email: normalizedEmail, display_name: visibleName };
  }
  const id = createPlatformId("user");
  await db.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind(id, sub, normalizedEmail, visibleName).run();
  return { id, email: normalizedEmail, display_name: visibleName };
}
