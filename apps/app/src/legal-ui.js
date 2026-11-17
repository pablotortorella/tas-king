import { formatLegalDate, legalLinks, LEGAL_KEYS } from "./legal.js";
import { escapeHtml } from "./ui-parts.js";

// Piezas de pantalla de los textos legales: aviso de acceso, pie, franja de versión próxima y pantalla de nueva aceptación.
const html = escapeHtml;
const external = 'target="_blank" rel="noopener"';

// Aviso que acompaña a todo «Continuar con Google»: aceptación de los dos textos y declaración de edad, con un enlace a cada uno.
// Los enlaces apuntan al sitio del ambiente (producción o staging). Una prueba recorre las pantallas públicas y exige este aviso
// junto a cada enlace a /auth/google (legal-notice.test.js).
export function renderSignInNotice(hostname, documents) {
  const links = legalLinks(hostname, documents);
  return `<p class="legal-notice">Al continuar aceptás los <a class="legal-link" href="${html(links.terms)}" ${external}>Términos y condiciones</a> y la <a class="legal-link" href="${html(links.privacy)}" ${external}>Política de privacidad</a>, y confirmás que tenés 18 años o más.</p>`;
}

// Enlace de «Continuar con Google» desde una pantalla con el aviso: `acepta=1` le dice al servidor que la persona vio el aviso, y entonces
// guarda en la cookie de estado las versiones vigentes (ver /auth/google). Un enlace directo sin ese parámetro no registra aceptación.
// Devuelve el valor ya escapado para un atributo HTML (lleva «&amp;»).
export function signInHref(returnTo = "/") {
  return `/auth/google?returnTo=${encodeURIComponent(returnTo)}&amp;acepta=1`;
}

export function renderLegalFooter(hostname, documents) {
  const links = legalLinks(hostname, documents);
  return `<nav class="legal-footer" aria-label="Textos legales"><a href="${html(links.privacy)}" ${external}>Privacidad</a><span aria-hidden="true">·</span><a href="${html(links.terms)}" ${external}>Términos y condiciones</a></nav>`;
}

// Franja de aviso previo (design.md, D5): el texto nuevo ya está publicado y todavía no rige.
export function renderLegalBand(notices, hostname, documents) {
  if (!notices.length) return "";
  const links = legalLinks(hostname, documents);
  const items = notices.map((notice) => `<a href="${html(links[notice.key])}" ${external}>${html(notice.title)}</a> desde el ${html(formatLegalDate(notice.effectiveFrom))}`);
  const list = items.length === 1 ? items[0] : `${items[0]} y ${items[1]}`;
  return `<aside class="legal-band" role="status"><p>Vamos a actualizar nuestros textos: ${list}. Podés leerlos ya; vas a tener que aceptarlos para seguir usando HomeSuite.</p></aside>`;
}

// Pantalla `/aceptar`: qué texto cambió, enlaces a ambos, aceptar y continuar o cerrar sesión. Sin desplazamiento horizontal: una
// columna con dos botones de al menos 44 px.
export function renderAcceptPage({ pending, accepted, versions, hostname, csrf, next, documents }) {
  const links = legalLinks(hostname, documents);
  const firstTime = !Object.keys(accepted).length;
  const rows = LEGAL_KEYS.map((key) => {
    const changed = pending.includes(key);
    const tag = changed ? `<span class="legal-tag">${firstTime ? "Para aceptar" : "Cambió"}: versión del ${html(formatLegalDate(versions[key]))}</span>` : `<span class="muted">Sin cambios</span>`;
    return `<li><a class="legal-link block" href="${html(links[key])}" ${external}>${html(documents[key].title)}</a>${tag}</li>`;
  }).join("");
  const intro = firstTime
    ? "Para usar HomeSuite tenés que aceptar nuestros textos vigentes. Leelos y, si estás de acuerdo, aceptalos."
    : "Actualizamos nuestros textos. Leé la versión nueva y aceptala para seguir usando HomeSuite.";
  const hidden = LEGAL_KEYS.map((key) => `<input type="hidden" name="${key}" value="${html(versions[key])}">`).join("");
  return `<p class="eyebrow">HomeSuite</p><h1>${firstTime ? "Antes de seguir" : "Actualizamos nuestros textos"}</h1><p>${intro}</p>
<section class="card accept-card" aria-label="Textos para aceptar"><ul class="legal-docs">${rows}</ul>
<p class="legal-notice">Al aceptar confirmás que tenés 18 años o más.</p>
<div class="accept-actions">
<form method="post" action="/aceptar">${csrf}${hidden}<input type="hidden" name="next" value="${html(next)}"><button class="button" type="submit">Aceptar y continuar</button></form>
<form method="post" action="/auth/logout">${csrf}<button class="button secondary" type="submit">No acepto: cerrar sesión</button></form>
</div></section>`;
}

// Pantalla para una mutación o una API rechazada por tener una versión sin aceptar.
export function renderAcceptRequired() {
  return `<p class="eyebrow">HomeSuite</p><h1>Falta aceptar los textos vigentes</h1><p class="notice" role="alert">No guardamos nada: antes de seguir tenés que aceptar la versión vigente de los Términos y condiciones y de la Política de privacidad.</p><a class="button" href="/aceptar">Revisar y aceptar</a>`;
}

export const LEGAL_CSS = `
.legal-notice{margin:12px 0;color:var(--ink-2);font-size:.95rem;line-height:1.6}
.legal-notice .legal-link{padding:13px 0;font-weight:700}
.legal-link.block{display:inline-flex;align-items:center;min-height:44px;font-weight:700}
.legal-docs{list-style:none;margin:0;padding:0}.legal-docs li{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 0;border-top:1px solid var(--line-soft)}.legal-docs li:first-child{border-top:0}
.legal-tag{color:var(--accent-deep);font-size:.9rem;font-weight:700}
.accept-actions{display:flex;flex-direction:column;gap:12px;margin-top:16px}.accept-actions form{margin:0}.accept-actions .button{width:100%;min-height:48px;margin:0}
.sensitive-hint{display:block;margin-top:4px}
.legal-footer{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 12px;margin:32px 0 0;padding-top:12px;border-top:1px solid var(--line-soft);font-size:.9rem}
.legal-footer a{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;color:var(--ink-2)}
.legal-band{max-width:1120px;margin:8px auto 0;padding:0 16px}.legal-band p{margin:0;padding:12px 14px;border-radius:14px;background:var(--ok-bg);border:1px solid var(--line);color:var(--accent-deep);font-size:.9rem}
.legal-band a{display:inline-block;padding:13px 0;margin:-13px 0;font-weight:700}
`;
