import { AVATAR_COLORS, COLOR_LABELS } from "./profiles.js";
import { DESCRIPTION_MAX, excerpt, presentGroup } from "./group-identity.js";
import { escapeHtml, groupPath as path } from "./ui-parts.js";

// El avatar de un grupo: su emoji (o la inicial del nombre) sobre el color elegido o uno estable. Mismas clases que el avatar personal.
export function groupAvatar(row, { size = "" } = {}) {
  const group = presentGroup(row);
  return `<span class="avatar avatar-${escapeHtml(group.color)}${size ? ` avatar-${size}` : ""}" aria-hidden="true">${escapeHtml(group.emoji ?? group.initial)}</span>`;
}

// Cambiar de grupo: el nombre del grupo en el encabezado lleva a la lista (sin selector desplegable).
export function groupSwitch(row) {
  return `<a class="group-switch" href="/groups" aria-label="Cambiar de grupo. Estás en ${escapeHtml(row.name)}">${groupAvatar(row)}<span class="group-switch-name">${escapeHtml(row.name)}</span></a>`;
}

// Las secciones del grupo en el menú y, solo para la persona titular, «Administrar grupo».
export function groupMenuItems(row, role) {
  const href = path(row.slug);
  const admin = role === "owner" ? `<a href="${href}/settings">Administrar grupo</a>` : "";
  return `<p class="menu-title">Este grupo</p><a href="${href}#saldos">Saldos</a><a href="${href}#movimientos">Movimientos</a><a href="${href}/people">Personas</a><a href="${href}/ledger/categories">Categorías</a><a href="${href}/ledger/classify">Clasificar rápido</a><a href="${href}/ledger/import">Importar de Splitwise</a>${admin}<p class="menu-title">HomeSuite</p>`;
}

function roleLabel(role) {
  return role === "owner" ? "Titular" : "Integrante";
}

// Lista de los grupos de la persona, siempre visible (también con uno solo).
export function renderGroupList(rows) {
  const items = rows.map(row => {
    const group = presentGroup(row);
    const about = excerpt(group.description);
    return `<li class="group-row"><a class="group-link" href="${path(group.slug)}">${groupAvatar(row)}<span class="grow"><strong>${escapeHtml(group.name)}</strong>${about ? `<span class="group-about">${escapeHtml(about)}</span>` : ""}<span class="muted">${roleLabel(group.role)}</span></span></a></li>`;
  }).join("");
  const body = items ? `<ul class="plain-list group-list">${items}</ul>` : "<p>No tenés grupos todavía.</p>";
  return `<p class="eyebrow">Cuentas Claras</p><h1>Tus grupos</h1><p>Cada grupo conserva sus integrantes y su propia historia de movimientos.</p><section class="card">${body}<div class="form-actions"><a class="button" href="/groups/new">Crear grupo</a><a class="button secondary" href="/invitations">Invitaciones</a></div></section>`;
}

// El nombre, la descripción y el avatar del grupo en su página.
export function groupIdentityHead(row) {
  const group = presentGroup(row);
  return { avatar: groupAvatar(row, { size: "lg" }), description: group.description ? `<p class="group-description">${escapeHtml(group.description)}</p>` : "" };
}

function identityForm({ row, csrf }) {
  const group = presentGroup(row);
  const colors = Object.keys(AVATAR_COLORS).map(token => `<option value="${token}"${token === group.colorChosen ? " selected" : ""}>${escapeHtml(COLOR_LABELS[token] ?? token)}</option>`).join("");
  return `<section class="ledger-section" id="identidad"><h2>Identidad del grupo</h2><form class="ledger-form" action="${path(group.slug)}/settings" method="post">${csrf}<div class="identity-preview">${groupAvatar(row, { size: "lg" })}<span class="muted">Así se ve en la lista y en el encabezado.</span></div><label for="group-name">Nombre del grupo</label><input id="group-name" name="name" required maxlength="120" value="${escapeHtml(group.name)}" autocomplete="off"><label for="group-description">Descripción<span class="hint">Opcional, hasta ${DESCRIPTION_MAX} caracteres. En la lista se ve el comienzo.</span></label><textarea id="group-description" name="description" rows="4" maxlength="${DESCRIPTION_MAX}">${escapeHtml(group.description ?? "")}</textarea><label for="group-emoji">Emoji<span class="hint">Opcional: un único emoji. Sin emoji se usa la inicial del nombre.</span></label><input id="group-emoji" name="emoji" value="${escapeHtml(group.emoji ?? "")}" placeholder="Ej. 🏠" autocomplete="off"><label for="group-color">Color de fondo</label><select id="group-color" name="color"><option value=""${group.colorChosen ? "" : " selected"}>Automático</option>${colors}</select><div class="form-actions"><button class="button">Guardar</button></div></form></section>`;
}

// Pantalla de administración del grupo (solo la persona titular): identidad, personas y archivar.
export function renderGroupSettings({ group: row, data, invitations = [], csrf }) {
  const href = path(row.slug);
  const archived = Boolean(data.ledger.archived_at);
  const invited = new Set(invitations.map(invitation => invitation.target_participant_id));
  const nominal = data.participants.filter(person => !person.linkedUserId && person.active && !invited.has(person.id)).map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.displayName)}</option>`).join("");
  const addPerson = `<form class="ledger-form" action="${href}/participants" method="post">${csrf}<label for="participant-name">Participante sin cuenta<span class="hint">Podés sumar a alguien sin invitarlo todavía: figura en los saldos aunque no tenga acceso.</span></label><input id="participant-name" name="name" required maxlength="120"><div class="form-actions"><button class="button secondary">Agregar participante</button></div></form>`;
  const invite = `<form class="ledger-form" action="${href}/invitations" method="post">${csrf}<label for="email">Invitar por email</label><input id="email" name="email" type="email" required autocomplete="email" inputmode="email"><label for="target-participant">Vincular con participante (opcional)<span class="hint">Al aceptar, la cuenta se vincula a esa persona y conserva su historial y saldos.</span></label><select id="target-participant" name="targetParticipantId"><option value="">Crear uno nuevo</option>${nominal}</select><div class="form-actions"><button class="button">Invitar</button></div></form>`;
  const archiveTool = archived
    ? `<form class="ledger-form" action="${href}/ledger/restore" method="post">${csrf}<p class="hint">El grupo está archivado: se puede leer y exportar, pero no recibe movimientos ni personas.</p><div class="form-actions"><button class="button">Restaurar grupo</button></div></form>`
    : `<details class="archive-tool"><summary>Archivar este grupo</summary><form class="ledger-form" action="${href}/ledger/archive" method="post">${csrf}<p class="hint">El grupo queda de sólo lectura: nadie puede agregar movimientos ni personas, pero todo se sigue viendo y exportando. No borra nada y se puede restaurar.</p><div class="form-actions"><button class="button danger">Archivar grupo</button></div></form></details>`;
  const people = archived ? "" : `<section class="ledger-section" id="integrantes"><h2>Personas e invitaciones</h2>${addPerson}${invite}<p class="muted">Para renombrar o unir personas, andá a la pantalla de personas.</p><div class="form-actions"><a class="button secondary" href="${href}/people">Ver personas</a></div></section>`;
  return `<a class="back-link" href="${href}">← Volver al grupo</a><p class="eyebrow">Titular · Cuentas Claras</p><h1>Administrar grupo</h1>${identityForm({ row, csrf })}${people}<section class="ledger-section" id="archivar"><h2>Archivar</h2>${archiveTool}</section>`;
}
