const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeSpaceName(value) {
  if (typeof value !== "string") return null;

  const name = value.trim().replace(/\s+/gu, " ");
  return name.length >= 1 && name.length <= 120 ? name : null;
}

export function canManageSpace(role) {
  return role === "owner";
}

export function canAccessSpace(role) {
  return role === "owner" || role === "member";
}

export function createPlatformId(prefix, randomUUID = crypto.randomUUID) {
  return `${prefix}_${randomUUID()}`;
}
