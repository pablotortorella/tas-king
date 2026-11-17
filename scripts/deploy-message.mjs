// Mensaje de versión que se guarda en Cloudflare con cada publicación.
//
// Módulo puro y sin imports de Node: los tests de la raíz corren en el pool de
// Workers. Lo usa scripts/wrangler-deploy.mjs.
//
// Formato: "<sha7> · <rama>", más " · con cambios sin commitear" si el árbol
// tenía cambios. Cloudflare admite hasta 100 caracteres en el mensaje.

export const MAX_MESSAGE_LENGTH = 100;
const DIRTY_SUFFIX = " · con cambios sin commitear";

export function deployMessage({ sha, branch, dirty }) {
  if (typeof sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new Error(`SHA inválido para el mensaje de versión: ${JSON.stringify(sha)}`);
  }
  const suffix = dirty ? DIRTY_SUFFIX : "";
  const prefix = `${sha.slice(0, 7).toLowerCase()} · `;
  let name = String(branch ?? "");
  const room = MAX_MESSAGE_LENGTH - prefix.length - suffix.length;
  if (name.length > room) name = `${name.slice(0, Math.max(room - 1, 0))}…`;
  return `${prefix}${name}${suffix}`.slice(0, MAX_MESSAGE_LENGTH);
}
