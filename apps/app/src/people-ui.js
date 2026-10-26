import { formatMoney } from "./finance.js";
import { avatar, escapeHtml, plural, shortDate, spacePath as path } from "./ui-parts.js";

const signed = (amountMinor, currency) => `${amountMinor > 0 ? "+" : ""}${formatMoney(amountMinor, currency)}`;

function balanceNote(data, personId) {
  const rows = data.balances.filter(row => row.participantId === personId && row.amountMinor !== 0);
  return rows.length ? ` · ${rows.map(row => escapeHtml(signed(row.amountMinor, row.currency))).join(" · ")}` : "";
}

// Pantalla de personas del grupo: quiénes son, su estado y saldo, y (solo la titular) renombrar, unir, agregar, invitar y
// administrar el grupo. Las personas unidas a otra se listan aparte, con la persona a la que pasaron.
export function renderPeople({ data, space, members, invitations, csrf, owner, userId }) {
  const spaceHref = path(space.slug);
  const archived = Boolean(data.ledger.archived_at);
  const roleByUser = new Map(members.map(member => [member.user_id, member.role]));
  const inviteFor = id => invitations.find(invitation => invitation.target_participant_id === id);
  const cancel = invitation => owner ? `<div class="row-actions"><form action="${spaceHref}/invitations/${encodeURIComponent(invitation.id)}/cancel" method="post">${csrf}<button class="button secondary">Cancelar invitación</button></form></div>` : "";
  const canMerge = owner && !archived && data.participants.filter(person => person.active).length > 1;
  const tools = person => {
    if (!owner || archived) return "";
    const rename = `<details class="person-tools"><summary>Renombrar</summary><form class="ledger-form" action="${spaceHref}/people/${encodeURIComponent(person.id)}/rename" method="post">${csrf}<label for="rename-${escapeHtml(person.id)}">Nombre de ${escapeHtml(person.displayName)}</label><input id="rename-${escapeHtml(person.id)}" name="name" required maxlength="120" value="${escapeHtml(person.displayName)}"><div class="form-actions"><button class="button secondary">Guardar nombre</button></div></form></details>`;
    const merge = canMerge && person.active ? `<a class="button secondary" href="${spaceHref}/people/${encodeURIComponent(person.id)}/merge" aria-label="Unir a ${escapeHtml(person.displayName)} con otra persona">Unir con otra persona</a>` : "";
    return `<div class="row-actions">${merge}</div>${rename}`;
  };
  const block = (person, status, detail, extra = "") => `<div class="person-block"><div class="person-row">${avatar(person.displayName, { seed: person.id, noAccount: !person.linkedUserId })}<div class="grow"><strong>${escapeHtml(person.displayName)}${person.linkedUserId === userId ? ' <span class="muted">· vos</span>' : ""}</strong><span class="muted">${detail}${balanceNote(data, person.id)}</span></div>${status}</div>${extra}${tools(person)}</div>`;
  const people = data.participants.map(person => {
    if (person.linkedUserId) {
      const role = roleByUser.get(person.linkedUserId) === "owner" ? "Propietario" : "Miembro";
      return block(person, `<span class="chip ${role === "Propietario" ? "ok" : ""}">${role}</span>`, `Con cuenta${person.active ? "" : " · Inactivo"}`);
    }
    const invitation = inviteFor(person.id);
    if (invitation) {
      return block(person, '<span class="chip warn">Invitación pendiente</span>', `${escapeHtml(invitation.invitee_email)} · figura en los saldos; hasta que acepte, no puede verlos`, cancel(invitation));
    }
    return block(person, '<span class="chip">Sin cuenta</span>', `Participante sin cuenta · lo cargan los demás${person.active ? "" : " · Inactivo"}`);
  }).join("");
  const loose = invitations.filter(invitation => !invitation.target_participant_id).map(invitation => `<div class="person-block"><div class="person-row">${avatar(invitation.invitee_email)}<div class="grow"><strong>${escapeHtml(invitation.invitee_email)}</strong><span class="muted">Se sumará como participante nuevo al aceptar</span></div><span class="chip warn">Invitación pendiente</span></div>${cancel(invitation)}</div>`).join("");
  const nameOf = new Map([...data.participants, ...(data.mergedParticipants ?? [])].map(person => [person.id, person.displayName]));
  const mergedPeople = data.mergedParticipants ?? [];
  const merged = mergedPeople.length ? `<section class="ledger-section" id="unidas"><h2>Personas unidas</h2><p class="muted">Ya no figuran en los repartos ni en los saldos: sus movimientos pasaron a la persona indicada. Siguen apareciendo en el historial de cada movimiento.</p><ul class="plain-list">${mergedPeople.map(person => `<li><strong>${escapeHtml(person.displayName)}</strong> <span class="muted">unida a ${escapeHtml(nameOf.get(person.mergedIntoId) ?? "otra persona")}</span></li>`).join("")}</ul></section>` : "";
  const nominal = data.participants.filter(person => !person.linkedUserId && person.active && !inviteFor(person.id)).map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.displayName)}</option>`).join("");
  const archiveTool = archived
    ? `<form class="ledger-form" action="${spaceHref}/ledger/restore" method="post">${csrf}<p class="hint">El grupo está archivado: se puede leer y exportar, pero no recibe movimientos ni personas.</p><div class="form-actions"><button class="button">Restaurar grupo</button></div></form>`
    : `<details class="archive-tool"><summary>Archivar este grupo</summary><form class="ledger-form" action="${spaceHref}/ledger/archive" method="post">${csrf}<p class="hint">El grupo queda de sólo lectura: nadie puede agregar movimientos ni personas, pero todo se sigue viendo y exportando. No borra nada y se puede restaurar.</p><div class="form-actions"><button class="button danger">Archivar grupo</button></div></form></details>`;
  const addPerson = `<form class="ledger-form" action="${spaceHref}/participants" method="post">${csrf}<label for="participant-name">Participante sin cuenta<span class="hint">Podés sumar a alguien sin invitarlo todavía: figura en los saldos aunque no tenga acceso.</span></label><input id="participant-name" name="name" required maxlength="120"><div class="form-actions"><button class="button secondary">Agregar participante</button></div></form>`;
  const invite = `<form class="ledger-form" action="${spaceHref}/invitations" method="post">${csrf}<label for="email">Invitar por email</label><input id="email" name="email" type="email" required autocomplete="email" inputmode="email"><label for="target-participant">Vincular con participante (opcional)<span class="hint">Al aceptar, la cuenta se vincula a esa persona y conserva su historial y saldos.</span></label><select id="target-participant" name="targetParticipantId"><option value="">Crear uno nuevo</option>${nominal}</select><div class="form-actions"><button class="button">Invitar</button></div></form>`;
  const rename = `<form class="ledger-form" action="${spaceHref}/rename" method="post">${csrf}<label for="space-name">Nombre del grupo</label><input id="space-name" name="name" required maxlength="120" value="${escapeHtml(space.name)}"><div class="form-actions"><button class="button secondary">Guardar nombre</button></div></form>`;
  const admin = owner ? `<section class="ledger-section" id="administrar"><h2>Administrar grupo</h2>${archived ? `${archiveTool}${rename}` : `${addPerson}${invite}${rename}${archiveTool}`}</section>` : "";
  const lead = owner ? "Participar en las cuentas no es lo mismo que tener acceso." : "Participar en las cuentas no es lo mismo que tener acceso. La administración queda en manos del titular.";
  return `<section class="ledger-section" id="personas"><h2>Personas · ${data.participants.length}</h2><p class="muted">${lead}</p>${people}${loose}</section>${merged}${admin}<a class="button secondary" href="/cuentas-claras">Cambiar grupo</a>`;
}

const backTo = (spaceId, label = "← Volver a las personas") => `<a class="back-link" href="${path(spaceId)}/people">${label}</a>`;

// Paso 1 de unir: elegir la persona destinataria (la que se queda).
export function renderMergeChoose({ spaceId, source, candidates }) {
  const options = candidates.map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.displayName)}${person.linkedUserId ? " (con cuenta)" : ""}</option>`).join("");
  return `${backTo(spaceId)}<p class="eyebrow">Cuentas Claras</p><h1>Unir a ${escapeHtml(source.displayName)}</h1><p class="lead-count">Elegí con quién se une. Todos los movimientos de ${escapeHtml(source.displayName)} pasan a esa persona y ${escapeHtml(source.displayName)} deja de aparecer en los repartos y en los saldos.</p><form class="ledger-form" method="get" action="${path(spaceId)}/people/${encodeURIComponent(source.id)}/merge/preview"><label for="merge-into">Unir con</label><select id="merge-into" name="into" required><option value="">Elegí una persona</option>${options}</select><div class="form-actions"><button class="button">Ver qué cambia</button></div></form>`;
}

function invitationNotes(preview) {
  const notes = [];
  if (preview.invitation.moves) notes.push(`La invitación pendiente a ${preview.invitation.moves} pasa a ${preview.target.name}.`);
  for (const email of preview.invitation.canceled) notes.push(`Se cancela la invitación pendiente a ${email}.`);
  if (preview.accountMoves) notes.push(`${preview.source.name} tiene cuenta: pasa a ${preview.target.name}, que conserva su nombre.`);
  return notes;
}

// Paso 2 de unir: lo que cambiaría y la confirmación. La clave identifica esta confirmación (repetirla no duplica nada).
export function renderMergePreview({ spaceId, csrf, preview, key }) {
  const { source, target } = preview;
  const rows = items => items.map(item => `<li><strong>${escapeHtml(item.description)}</strong> <span class="muted">${escapeHtml(shortDate(item.occurredAt))} · ${escapeHtml(formatMoney(item.totalMinor, item.currency))}</span></li>`).join("");
  const balances = preview.balances.map(row => `<tr><th scope="row">${escapeHtml(row.currency)}</th><td>${escapeHtml(signed(row.source, row.currency))}</td><td>${escapeHtml(signed(row.target, row.currency))}</td><td>${escapeHtml(signed(row.after, row.currency))}</td></tr>`).join("");
  const table = balances ? `<section class="ledger-section"><h2>Saldos</h2><table class="split"><thead><tr><th scope="col">Moneda</th><th scope="col">${escapeHtml(source.name)} hoy</th><th scope="col">${escapeHtml(target.name)} hoy</th><th scope="col">${escapeHtml(target.name)} después</th></tr></thead><tbody>${balances}</tbody></table></section>` : "";
  const notes = invitationNotes(preview);
  const voided = preview.voided ? `<p class="notice" role="status">${plural(preview.voided, "transferencia entre las dos personas se anula", "transferencias entre las dos personas se anulan")}: quedarían de una persona a sí misma y no cambian ningún saldo.</p><ul class="plain-list">${rows(preview.voidedSample)}</ul>` : "";
  const sample = preview.sample.length ? `<section class="ledger-section"><h2>Muestra</h2><ul class="plain-list">${rows(preview.sample)}</ul>${preview.revise > preview.sample.length ? `<p class="muted">Y ${plural(preview.revise - preview.sample.length, "movimiento más", "movimientos más")}.</p>` : ""}</section>` : "";
  return `${backTo(spaceId)}<p class="eyebrow">Cuentas Claras</p><h1>Unir a ${escapeHtml(source.name)} con ${escapeHtml(target.name)}</h1><p class="lead-count">${plural(preview.revise, "movimiento pasa", "movimientos pasan")} de ${escapeHtml(source.name)} a ${escapeHtml(target.name)}. ${escapeHtml(source.name)} deja de aparecer en los repartos y en los saldos; el saldo total del grupo no cambia.</p>${notes.length ? `<ul class="plain-list">${notes.map(note => `<li class="muted">${escapeHtml(note)}</li>`).join("")}</ul>` : ""}${voided}${table}${sample}<p class="notice" role="status">Los movimientos que pasen a ${escapeHtml(target.name)} se reparten con importes exactos, y cada uno guarda una revisión que dice «unión de personas». Esto no se puede deshacer desde la aplicación.</p><form class="ledger-form" method="post" action="${path(spaceId)}/people/${encodeURIComponent(source.id)}/merge">${csrf}<input type="hidden" name="into" value="${escapeHtml(target.id)}"><input type="hidden" name="key" value="${escapeHtml(key)}"><input type="hidden" name="expectedRevision" value="${escapeHtml(preview.ledgerRevision)}"><div class="form-actions"><button class="button" type="submit">Unir personas</button><a class="button secondary" href="${path(spaceId)}/people">Cancelar</a></div></form>`;
}
