import { cookie, getCookie } from "./auth.js";

// El último grupo en el que se trabajó se recuerda en el navegador (no en la base). Solo guarda el identificador: el servidor lo usa
// únicamente después de comprobar que la sesión actual es integrante de ese grupo.
export const LAST_GROUP_COOKIE = "last_group";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function lastGroupCookie(groupId, secure) {
  return cookie(LAST_GROUP_COOKIE, groupId, { maxAge: ONE_YEAR_SECONDS, secure });
}

export function readLastGroup(cookieHeader) {
  const raw = getCookie(cookieHeader, LAST_GROUP_COOKIE);
  if (!raw) return null;
  try {
    const id = decodeURIComponent(raw);
    return /^group_[A-Za-z0-9-]{1,80}$/u.test(id) ? id : null;
  } catch { return null; }
}

// A dónde lleva «entrar a Cuentas Claras»: el último grupo si sigue siendo de la persona, el único que tenga, o la lista.
export function entryTarget({ groups, lastGroupId }) {
  const remembered = lastGroupId ? groups.find(group => group.id === lastGroupId) : null;
  if (remembered) return `/groups/${encodeURIComponent(remembered.slug)}`;
  if (groups.length === 1) return `/groups/${encodeURIComponent(groups[0].slug)}`;
  return "/groups";
}
