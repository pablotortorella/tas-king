import { formatMoney } from "./finance.js";
import { categoryChip, entryLabel, inputAmount } from "./ledger-ui.js";
import { filterByCategory, filterByPerson, personCounts, personsInQuery, searchLedger } from "./search.js";
import { categoryGroups } from "./categories.js";
import { isPending } from "./suggest.js";
import { selectionBar } from "./recategorize-ui.js";
import { suggestTransfers } from "./settlement.js";
import { avatar, escapeHtml, ICONS, shortDate } from "./ui-parts.js";

const path = spaceId => `/spaces/${encodeURIComponent(spaceId)}`;
const signed = (amountMinor, currency) => `${amountMinor > 0 ? "+" : ""}${formatMoney(amountMinor, currency)}`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function ownParticipant(data, userId) {
  return data.participants.find(person => person.linkedUserId === userId) ?? null;
}

export function renderBookHead(space, data, userId) {
  const owner = data.ledger.role === "owner";
  const active = data.participants.filter(person => person.active).length;
  const archived = Boolean(data.ledger.archived_at);
  const actions = archived ? "" : `${owner ? `<a class="button secondary" href="${path(space.slug)}/ledger/import">Importar Splitwise</a>` : ""}<a class="button" href="${path(space.slug)}/ledger/new">Agregar movimiento</a>`;
  return `<div class="book-head"><div><p class="eyebrow">${owner ? "Titular" : "Integrante"} · Cuentas Claras</p><h1>${escapeHtml(space.name)}</h1><p class="muted">${plural(active, "persona", "personas")} · moneda predeterminada ${escapeHtml(data.ledger.default_currency)}${archived ? " · archivado" : ""}</p></div><div class="actions">${actions}</div></div>${archived ? `<p class="notice" role="status">Este grupo está archivado: se puede leer y exportar, pero no se agregan movimientos ni personas.${owner ? " Podés restaurarlo desde «Administrar grupo»." : ""}</p>` : ""}`;
}

function suggestionCard(currency, data, amounts, spaceId) {
  if (data.ledger.archived_at) return "";
  const names = new Map(data.participants.map(person => [person.id, person.displayName]));
  const transfers = suggestTransfers([...amounts].map(([participantId, amountMinor]) => ({ participantId, amountMinor })));
  if (!transfers.length) return "";
  const items = transfers.map(transfer => {
    const text = `${names.get(transfer.from)} le paga a ${names.get(transfer.to)}`;
    const query = new URLSearchParams({ type: "transfer", from: transfer.from, to: transfer.to, amount: inputAmount(transfer.amountMinor, currency), currency });
    return `<li class="suggest-row"><div><strong>${escapeHtml(text)}</strong><span class="money muted">${escapeHtml(formatMoney(transfer.amountMinor, currency))}</span></div><a class="button secondary" href="${path(spaceId)}/ledger/new?${escapeHtml(query.toString())}" aria-label="Registrar: ${escapeHtml(text)}">Registrar</a></li>`;
  }).join("");
  return `<div class="group-card"><div class="head"><h3>Para quedar a mano</h3><span class="muted">${plural(transfers.length, "sugerencia", "sugerencias")}</span></div><p class="muted">Se recalculan desde los saldos. No son deudas guardadas.</p><ul class="balance-list">${items}</ul></div>`;
}

function balanceBlock(currency, data, ownId, spaceId) {
  const amounts = new Map(data.participants.map(person => [person.id, data.balances.find(row => row.currency === currency && row.participantId === person.id)?.amountMinor ?? 0]));
  const own = ownId ? amounts.get(ownId) ?? 0 : 0;
  const peak = Math.max(1, ...[...amounts.values()].map(Math.abs));
  const total = [...amounts.values()].reduce((sum, value) => sum + BigInt(value), 0n);
  const note = own > 0 ? "Te corresponde recibir." : own < 0 ? "Te toca aportar." : "Estás a mano.";
  const rows = data.participants.map(person => {
    const amount = amounts.get(person.id);
    const width = Math.min(50, Math.round(Math.abs(amount) / peak * 50));
    const bar = amount === 0 ? "" : `<span class="fill ${amount > 0 ? "pos" : "neg"} w${width}"></span>`;
    const word = amount > 0 ? "Le deben " : amount < 0 ? "Debe " : "";
    return `<li class="balance-row">${avatar(person.displayName, { seed: person.id, noAccount: !person.linkedUserId })}<div class="who"><strong><a href="${path(spaceId)}/ledger/balance?moneda=${currency}&amp;persona=${encodeURIComponent(person.id)}">${escapeHtml(person.displayName)}</a></strong>${person.id === ownId ? ' <span class="tag">· vos</span>' : !person.linkedUserId ? ' <span class="tag">· sin cuenta</span>' : ""}<div class="bar" aria-hidden="true">${bar}</div></div><span class="amount money ${amount < 0 ? "owes" : amount > 0 ? "owed" : ""}">${word ? `<span class="word">${word}</span>` : ""}<span class="num">${escapeHtml(formatMoney(Math.abs(amount), currency))}</span></span></li>`;
  }).join("");
  return `<div class="currency-block"><div class="hero${own < 0 ? " neg" : ""}"><p class="hero-label">Tu saldo · ${escapeHtml(currency)}</p><p class="hero-amount money">${escapeHtml(signed(own, currency))}</p><p class="hero-note">${note}</p><a class="why" href="${path(spaceId)}/ledger/balance?moneda=${currency}">¿Por qué?</a></div><div class="group-card"><div class="head"><h3>Saldos del grupo · ${escapeHtml(currency)}</h3>${total === 0n ? '<span class="sum-zero">✓ Suman 0</span>' : ""}</div><ul class="balance-list">${rows}</ul></div>${suggestionCard(currency, data, amounts, spaceId)}</div>`;
}

function entryRow(entry, data, ownId, spaceId, selectable = false) {
  const names = new Map(data.participants.map(person => [person.id, person.displayName]));
  const list = direction => entry.cashParties.filter(party => party.direction === direction).map(party => names.get(party.participantId) ?? "Participante").join(", ");
  const who = entry.type === "expense" ? `pagó ${list("out")}` : entry.type === "income" ? `recibió ${list("in")}` : `${list("out")} → ${list("in")}`;
  const effect = ownId ? entry.effects.find(row => row.participantId === ownId)?.amountMinor : undefined;
  const voided = entry.status === "voided";
  const effectText = voided ? '<small class="muted">No cuenta en los saldos</small>'
    : effect ? `<small class="${effect > 0 ? "owed" : "owes"}">Tu efecto ${escapeHtml(signed(effect, entry.currency))}</small>` : "";
  const chips = [
    categoryChip(entry),
    entry.importBatchId ? `<span class="chip imp">Importado de Splitwise · fila ${escapeHtml(entry.sourceRowNumber)}</span>` : "",
    entry.inferred ? '<span class="chip warn">Pagador inferido</span>' : "",
    voided ? '<span class="chip void">Anulado</span>' : "",
    entry.matchReason ? `<span class="chip match">Coincide: ${escapeHtml(entry.matchReason)}</span>` : "",
  ].join("");
  const icon = voided ? ICONS.voided : ICONS[entry.type] ?? ICONS.expense;
  const iconClass = voided ? "" : ` ico-${entry.type}`;
  const box = selectable && !voided && entry.type !== "transfer" ? `<label class="select-box"><input type="checkbox" name="ids" value="${escapeHtml(entry.id)}"><span class="sr-only">Seleccionar ${escapeHtml(entry.description)}</span></label>` : "";
  return `<li class="entry-row${voided ? " entry-voided" : ""}${box ? " selectable" : ""}">${box}<a href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}"><span class="ico${iconClass}">${icon}</span><span class="entry-main"><strong class="entry-title">${escapeHtml(entry.description)}</strong><small>${escapeHtml(entryLabel(entry.type))} · ${escapeHtml(shortDate(entry.occurredAt))}${who ? ` · ${escapeHtml(who)}` : ""}</small>${chips ? `<span class="entry-chips">${chips}</span>` : ""}</span><span class="entry-side"><strong class="money">${escapeHtml(formatMoney(entry.totalMinor, entry.currency))}</strong>${effectText}</span></a></li>`;
}

export const PAGE_SIZE = 40;

function categoryFilter(data, selected) {
  const groups = categoryGroups(data.categories ?? []).map(group => `<optgroup label="${escapeHtml(group.name)}"><option value="g:${escapeHtml(group.key)}"${selected === `g:${group.key}` ? " selected" : ""}>Todo ${escapeHtml(group.name)}</option>${group.categories.map(category => `<option value="${escapeHtml(category.id)}"${selected === category.id ? " selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</optgroup>`).join("");
  return `<label class="sr-only" for="ledger-category">Categoría</label><select id="ledger-category" name="categoria"><option value="">Todas las categorías</option><option value="none"${selected === "none" ? " selected" : ""}>Sin categoría</option>${groups}</select>`;
}

export function renderLedgerOverview(data, { spaceId, userId, query = "", category = "", below = "", limit = PAGE_SIZE, csrf = "", person = "", recent = null }) {
  const own = ownParticipant(data, userId);
  const currencies = [...new Set([data.ledger.default_currency, ...data.balances.map(row => row.currency)])];
  const base = filterByCategory(searchLedger(data.entries, data.participants, query), category);
  const results = filterByPerson(base, person);
  const filtering = Boolean(query || category || person);
  const linkTo = extra => { const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { categoria: category } : {}), ...extra }); const text = params.toString(); return `${path(spaceId)}${text ? `?${text}` : ""}#movimientos`; };
  const personChips = query ? personsInQuery(data.participants, query).map(found => {
    const counts = personCounts(base, found.id);
    const chip = (kind, label, count) => `<a class="chip-button${person === `${kind}:${found.id}` ? " active" : ""}" href="${escapeHtml(person === `${kind}:${found.id}` ? linkTo({}) : linkTo({ quien: `${kind}:${found.id}` }))}"${person === `${kind}:${found.id}` ? ' aria-current="true"' : ""}>${label} ${escapeHtml(found.displayName)} (${count})</a>`;
    return `${chip("pago", "Pagó", counts.paid)}${chip("participa", "Participa", counts.participates)}`;
  }).join("") : "";
  const recentStrip = recent ? `<section class="recent-strip" aria-label="${escapeHtml(recent.title)}"><h3>${escapeHtml(recent.title)}</h3><ul class="entry-list">${entryRow(recent.entry, data, own?.id, spaceId)}</ul></section>` : "";
  const voidedCount = data.entries.filter(entry => entry.status === "voided").length;
  const shown = results.slice(0, limit);
  const selecting = Boolean(csrf) && !data.ledger.archived_at && results.some(entry => entry.status === "active" && entry.type !== "transfer");
  const rows = shown.map(entry => entryRow(entry, data, own?.id, spaceId, selecting)).join("");
  const rest = results.length - shown.length;
  const meta = filtering
    ? `${results.length} de ${plural(data.entries.length, "movimiento", "movimientos")}`
    : `${plural(data.entries.length - voidedCount, "vigente", "vigentes")}${voidedCount ? ` · ${plural(voidedCount, "anulado", "anulados")}` : ""}`;
  const shownNote = results.length > shown.length ? ` · mostrando ${shown.length}` : "";
  const moreParams = new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { categoria: category } : {}), ...(person ? { quien: person } : {}), mostrar: String(limit + PAGE_SIZE) });
  const more = rest > 0 ? `<a class="button secondary more" href="${path(spaceId)}?${escapeHtml(moreParams.toString())}#movimientos">Ver ${Math.min(rest, PAGE_SIZE)} ${Math.min(rest, PAGE_SIZE) === 1 ? "movimiento" : "movimientos"} más</a>` : "";
  const owner = data.ledger.role === "owner";
  const first = `<div class="empty first-run"><h3>Todavía no hay movimientos.</h3><p>El saldo se arma siempre con movimientos que se pueden revisar. Nunca se escribe a mano.</p><a class="button big" href="${path(spaceId)}/ledger/new">Agregá tu primer movimiento</a>${owner ? `<p class="first-run-import">¿Venís de Splitwise? <a href="${path(spaceId)}/ledger/import">Traé tu historial</a> y se carga como movimientos normales.</p>` : ""}</div>`;
  const empty = filtering
    ? "<p>No hay coincidencias.</p>"
    : data.ledger.archived_at ? '<div class="empty"><h3>Este grupo no tiene movimientos.</h3></div>' : first;
  const quick = data.ledger.archived_at ? "" : `<div class="quick-actions"><span class="lead">Agregar:</span><a href="${path(spaceId)}/ledger/new?type=expense">Gasto</a><a href="${path(spaceId)}/ledger/new?type=income">Ingreso</a><a href="${path(spaceId)}/ledger/new?type=transfer">Transferencia</a></div>`;
  return `<div class="book-grid"><div class="panel side"><section id="saldos" aria-labelledby="saldos-title"><h2 id="saldos-title" class="sr-only">Saldos</h2>${currencies.map(currency => balanceBlock(currency, data, own?.id, spaceId)).join("")}${quick}</section></div><div class="panel"><section id="movimientos" class="ledger-section">${recentStrip}<div class="section-top"><h2>Movimientos</h2><div class="export-actions"><a href="${path(spaceId)}/ledger/categories">Categorías</a>${!data.ledger.archived_at && data.entries.filter(isPending).length ? `<a href="${path(spaceId)}/ledger/classify">Clasificar rápido · ${data.entries.filter(isPending).length}</a>` : ""}<a href="${path(spaceId)}/ledger/export.json">Exportar JSON</a><a href="${path(spaceId)}/ledger/export.csv">Exportar CSV</a></div></div><form method="get" action="${path(spaceId)}" class="search-form" role="search"><label class="sr-only" for="ledger-search">Buscar</label><input id="ledger-search" name="q" type="search" value="${escapeHtml(query)}" placeholder="Texto, persona o monto" enterkeyhint="search"><button class="button secondary" type="submit">Buscar</button>${categoryFilter(data, category)}${filtering ? `<a class="clear" href="${path(spaceId)}">Quitar ${query && (category || person) ? "búsqueda y filtros" : category || person ? "filtro" : "búsqueda"}</a>` : ""}</form>${personChips ? `<div class="person-filters" role="group" aria-label="Filtrar por persona">${personChips}</div>` : ""}${data.entries.length ? `<p class="list-meta" aria-live="polite">${meta}${shownNote} · propios e importados</p>` : ""}${rows ? (selecting ? `<form method="post" action="${path(spaceId)}/ledger/recategorize/preview" class="selection-form">${selectionBar({ data, query, category, person, total: results.length, csrf })}<ul class="entry-list">${rows}</ul></form>${more}` : `<ul class="entry-list">${rows}</ul>${more}`) : empty}</section></div>${below ? `<div class="book-wide">${below}</div>` : ""}</div>`;
}

export function renderPeople({ data, space, members, invitations, csrf, owner, userId }) {
  const spaceHref = path(space.slug);
  const roleByUser = new Map(members.map(member => [member.user_id, member.role]));
  const inviteFor = id => invitations.find(invitation => invitation.target_participant_id === id);
  const cancel = invitation => owner ? `<div class="row-actions"><form action="${spaceHref}/invitations/${encodeURIComponent(invitation.id)}/cancel" method="post">${csrf}<button class="button secondary">Cancelar invitación</button></form></div>` : "";
  const block = (person, status, detail, extra = "") => `<div class="person-block"><div class="person-row">${avatar(person.displayName, { seed: person.id, noAccount: !person.linkedUserId })}<div class="grow"><strong>${escapeHtml(person.displayName)}${person.linkedUserId === userId ? ' <span class="muted">· vos</span>' : ""}</strong><span class="muted">${detail}</span></div>${status}</div>${extra}</div>`;
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
  const nominal = data.participants.filter(person => !person.linkedUserId && person.active && !inviteFor(person.id)).map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.displayName)}</option>`).join("");
  const archived = Boolean(data.ledger.archived_at);
  const archiveTool = archived
    ? `<form class="ledger-form" action="${spaceHref}/ledger/restore" method="post">${csrf}<p class="hint">El grupo está archivado: se puede leer y exportar, pero no recibe movimientos ni personas.</p><div class="form-actions"><button class="button">Restaurar grupo</button></div></form>`
    : `<details class="archive-tool"><summary>Archivar este grupo</summary><form class="ledger-form" action="${spaceHref}/ledger/archive" method="post">${csrf}<p class="hint">El grupo queda de sólo lectura: nadie puede agregar movimientos ni personas, pero todo se sigue viendo y exportando. No borra nada y se puede restaurar.</p><div class="form-actions"><button class="button danger">Archivar grupo</button></div></form></details>`;
  const addPerson = `<form class="ledger-form" action="${spaceHref}/participants" method="post">${csrf}<label for="participant-name">Participante sin cuenta<span class="hint">Podés sumar a alguien sin invitarlo todavía: figura en los saldos aunque no tenga acceso.</span></label><input id="participant-name" name="name" required maxlength="120"><div class="form-actions"><button class="button secondary">Agregar participante</button></div></form>`;
  const invite = `<form class="ledger-form" action="${spaceHref}/invitations" method="post">${csrf}<label for="email">Invitar por email</label><input id="email" name="email" type="email" required autocomplete="email" inputmode="email"><label for="target-participant">Vincular con participante (opcional)<span class="hint">Al aceptar, la cuenta se vincula a esa persona y conserva su historial y saldos.</span></label><select id="target-participant" name="targetParticipantId"><option value="">Crear uno nuevo</option>${nominal}</select><div class="form-actions"><button class="button">Invitar</button></div></form>`;
  const rename = `<form class="ledger-form" action="${spaceHref}/rename" method="post">${csrf}<label for="space-name">Nombre del grupo</label><input id="space-name" name="name" required maxlength="120" value="${escapeHtml(space.name)}"><div class="form-actions"><button class="button secondary">Guardar nombre</button></div></form>`;
  const tools = owner ? `<section class="ledger-section" id="administrar"><h2>Administrar grupo</h2>${archived ? `${archiveTool}${rename}` : `${addPerson}${invite}${rename}${archiveTool}`}</section>` : "";
  const lead = owner ? "Participar en las cuentas no es lo mismo que tener acceso." : "Participar en las cuentas no es lo mismo que tener acceso. La administración queda en manos del titular.";
  return `<section class="ledger-section" id="personas"><h2>Personas · ${data.participants.length}</h2><p class="muted">${lead}</p>${people}${loose}</section>${tools}<a class="button secondary" href="/cuentas-claras">Cambiar grupo</a>`;
}
