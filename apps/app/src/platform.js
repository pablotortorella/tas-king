const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeGroupName(value) {
  if (typeof value !== "string") return null;

  const name = value.trim().replace(/\s+/gu, " ");
  return name.length >= 1 && name.length <= 120 ? name : null;
}

export function canManageGroup(role) {
  return role === "owner";
}

export function canAccessGroup(role) {
  return role === "owner" || role === "member";
}

export function createPlatformId(prefix, randomUUID = () => crypto.randomUUID()) {
  return `${prefix}_${randomUUID()}`;
}
