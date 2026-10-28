import { ACCOUNT_MARKER, ACCOUNT_MENU_MARKER, escapeHtml } from "./ui-parts.js";

// Cuenta de la persona en el encabezado de cada pantalla: su avatar y nombre llevan a «Mi perfil», y el menú suma «Mi perfil»
// y «Cerrar sesión». El encabezado trae dos marcas que el servidor reemplaza si hay sesión (así ninguna ruta tiene que
// conocer el perfil): `ACCOUNT_MARKER` para el enlace y `ACCOUNT_MENU_MARKER` para las opciones del menú.

export function avatarHtml(profile) {
  const value = profile.avatar;
  const inner = value.type === "photo" && value.photoUrl
    ? `<span class="avatar-fallback">${escapeHtml(value.initial)}</span><img src="${escapeHtml(value.photoUrl)}" alt="" referrerpolicy="no-referrer">`
    : value.type === "emoji" ? escapeHtml(value.emoji) : escapeHtml(value.initial);
  return `<span class="avatar avatar-${escapeHtml(value.color)}" aria-hidden="true">${inner}</span>`;
}

export function accountLink(profile) {
  return `<a class="account-link" href="/perfil" aria-label="Mi perfil: ${escapeHtml(profile.displayName)}">${avatarHtml(profile)}<span>${escapeHtml(profile.displayName)}</span></a>`;
}

// `csrfField` es el campo oculto con el token de la sesión: la ruta de salida lo exige, y un formulario sin él termina en «Solicitud no
// verificada». Sin campo no se ofrece «Cerrar sesión» (mejor ausente que roto).
export function accountMenuItems(csrfField) {
  const logout = csrfField ? `<form action="/auth/logout" method="post">${csrfField}<button type="submit">Cerrar sesión</button></form>` : "";
  return `<a href="/perfil">Ver mi perfil</a>${logout}`;
}

// Reemplaza las marcas del encabezado. Sin sesión desaparecen.
export function fillAccount(html, profile, csrfField) {
  return html.replace(ACCOUNT_MARKER, profile ? accountLink(profile) : "").replace(ACCOUNT_MENU_MARKER, profile ? accountMenuItems(csrfField) : "");
}
