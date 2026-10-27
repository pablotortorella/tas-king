import { formatMoney } from "./finance.js";
import { categoryChip, entryLabel, inputAmount } from "./ledger-ui.js";
import { filterByCategory, filterByPerson, personCounts, personsInQuery, searchLedger } from "./search.js";
import { categoryOptionGroups } from "./category-options.js";
import { isPending } from "./suggest.js";
import { groupAvatar, groupIdentityHead } from "./group-ui.js";
import { selectionBar } from "./recategorize-ui.js";
import { suggestTransfers } from "./settlement.js";
import { amountFit, avatar, escapeHtml, ICONS, plural, shortDate, groupPath as path } from "./ui-parts.js";

const signed = (amountMinor, currency) => `${amountMinor > 0 ? "+" : ""}${formatMoney(amountMinor, currency)}`;

function ownParticipant(data, userId) {
  return data.participants.find(person => person.linkedUserId === userId) ?? null;
}

export function renderBookHead(group, data, userId) {
  const owner = data.ledger.role === "owner";
  const active = data.participants.filter(person => person.active).length;
  const archived = Boolean(data.ledger.archived_at);
  const head = groupIdentityHead(group);
  const gear = owner ? `<a class="icon-button" href="${path(group.slug)}/settings" aria-label="Administrar grupo">${ICONS.gear}</a>` : "";
  const actions = archived ? "" : `${owner ? `<a class="button secondary" href="${path(group.slug)}/ledger/import">Importar Splitwise</a>` : ""}<a class="button" href="${path(group.slug)}/ledger/new">Agregar movimiento</a>`;
  return `<div class="book-head"><div class="book-title">${groupAvatar(group, { size: "lg" })}<div><p class="eyebrow">${owner ? "Titular" : "Integrante"} · Cuentas Claras</p><h1>${escapeHtml(group.name)}</h1>${head.description}<p class="muted"><a href="${path(group.slug)}/people">${plural(active, "persona", "personas")}</a> · moneda predeterminada ${escapeHtml(data.ledger.default_currency)}${archived ? " · archivado" : ""}</p></div></div></div><div class="actions">${gear}${actions}</div></div>${archived ? `<p class="notice" role="status">Este grupo está archivado: se puede leer y exportar, pero no se agregan movimientos ni personas.${owner ? ` Podés restaurarlo desde <a href="${path(group.slug)}/settings">Administrar grupo</a>.` : ""}</p>` : ""}`;
}

function suggestionCard(currency, data, amounts, groupId) {
  if (data.ledger.archived_at) return "";
  const names = new Map(data.participants.map(person => [person.id, person.displayName]));
  const transfers = suggestTransfers([...amounts].map(([participantId, amountMinor]) => ({ participantId, amountMinor })));
  if (!transfers.length) return "";
  const items = transfers.map(transfer => {
    const text = `${names.get(transfer.from)} le paga a ${names.get(transfer.to)}`;
    const query = new URLSearchParams({ type: "transfer", from: transfer.from, to: transfer.to, amount: inputAmount(transfer.amountMinor, currency), currency });
    return `<li class="suggest-row"><div><strong>${escapeHtml(text)}</strong><span class="money muted">${escapeHtml(formatMoney(transfer.amountMinor, currency))}</span></div><a class="button secondary" href="${path(groupId)}/ledger/new?${escapeHtml(query.toString())}" aria-label="Registrar: ${escapeHtml(text)}">Registrar</a></li>`;
  }).join("");
  return `<div class="group-card"><div class="head"><h3>Para quedar a mano</h3><span class="muted">${plural(transfers.length, "sugerencia", "sugerencias")}</span></div><p class="muted">Se recalculan desde los saldos. No son deudas guardadas.</p><ul class="balance-list">${items}</ul></div>`;
}

function balanceBlock(currency, data, ownId, groupId) {
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
    return `<li class="balance-row">${avatar(person.displayName, { seed: person.id, noAccount: !person.linkedUserId })}<div class="who"><strong><a href="${path(groupId)}/ledger/balance?moneda=${currency}&amp;persona=${encodeURIComponent(person.id)}">${escapeHtml(person.displayName)}</a></strong>${person.id === ownId ? ' <span class="tag">· vos</span>' : !person.linkedUserId ? ' <span class="tag">· sin cuenta</span>' : ""}<div class="bar" aria-hidden="true">${bar}</div></div><span class="amount money ${amount < 0 ? "owes" : amount > 0 ? "owed" : ""}">${word ? `<span class="word">${word}</span>` : ""}<span class="num">${escapeHtml(formatMoney(Math.abs(amount), currency))}</span></span></li>`;
  }).join("");
  return `<div class="currency-block"><div class="hero${own < 0 ? " neg" : ""}"><p class="hero-label">Tu saldo · ${escapeHtml(currency)}</p><p class="hero-amount money${amountFit(signed(own, currency))}">${escapeHtml(signed(own, currency))}</p><p class="hero-note">${note}</p><a class="why" href="${path(groupId)}/ledger/balance?moneda=${currency}">¿Por qué?</a></div><div class="group-card"><div class="head"><h3>Saldos del grupo · ${escapeHtml(currency)}</h3>${total === 0n ? '<span class="sum-zero">✓ Suman 0</span>' : ""}</div><ul class="balance-list">${rows}</ul></div>${suggestionCard(currency, data, amounts, groupId)}</div>`;
}

function entryRow(entry, data, ownId, groupId, selectable = false) {
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
  return `<li class="entry-row${voided ? " entry-voided" : ""}${box ? " selectable" : ""}">${box}<a href="${path(groupId)}/ledger/entries/${encodeURIComponent(entry.id)}"><span class="ico${iconClass}">${icon}</span><span class="entry-main"><strong class="entry-title">${escapeHtml(entry.description)}</strong><small>${escapeHtml(entryLabel(entry.type))} · ${escapeHtml(shortDate(entry.occurredAt))}${who ? ` · ${escapeHtml(who)}` : ""}</small>${chips ? `<span class="entry-chips">${chips}</span>` : ""}</span><span class="entry-side"><strong class="money">${escapeHtml(formatMoney(entry.totalMinor, entry.currency))}</strong>${effectText}</span></a></li>`;
}

export const PAGE_SIZE = 40;

function categoryFilter(data, selected) {
  const groups = categoryOptionGroups(data.categories ?? [], {
    groupOption: group => `<option value="g:${escapeHtml(group.key)}"${selected === `g:${group.key}` ? " selected" : ""}>Todo ${escapeHtml(group.name)}</option>`,
    option: category => `<option value="${escapeHtml(category.id)}"${selected === category.id ? " selected" : ""}>${escapeHtml(category.name)}</option>`,
  });
  return `<label class="sr-only" for="ledger-category">Categoría</label><select id="ledger-category" name="categoria"><option value="">Todas las categorías</option><option value="none"${selected === "none" ? " selected" : ""}>Sin categoría</option>${groups}</select>`;
}

export function renderLedgerOverview(data, { groupId, userId, query = "", category = "", below = "", limit = PAGE_SIZE, csrf = "", person = "", recent = null }) {
  const own = ownParticipant(data, userId);
  const currencies = [...new Set([data.ledger.default_currency, ...data.balances.map(row => row.currency)])];
  const base = filterByCategory(searchLedger(data.entries, data.participants, query), category);
  const results = filterByPerson(base, person);
  const filtering = Boolean(query || category || person);
  const linkTo = extra => { const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { categoria: category } : {}), ...extra }); const text = params.toString(); return `${path(groupId)}${text ? `?${text}` : ""}#movimientos`; };
  const personChips = query ? personsInQuery(data.participants, query).map(found => {
    const counts = personCounts(base, found.id);
    const chip = (kind, label, count) => `<a class="chip-button${person === `${kind}:${found.id}` ? " active" : ""}" href="${escapeHtml(person === `${kind}:${found.id}` ? linkTo({}) : linkTo({ quien: `${kind}:${found.id}` }))}"${person === `${kind}:${found.id}` ? ' aria-current="true"' : ""}>${label} ${escapeHtml(found.displayName)} (${count})</a>`;
    return `${chip("pago", "Pagó", counts.paid)}${chip("participa", "Participa", counts.participates)}`;
  }).join("") : "";
  const recentStrip = recent ? `<section class="recent-strip" aria-label="${escapeHtml(recent.title)}"><h3>${escapeHtml(recent.title)}</h3><ul class="entry-list">${entryRow(recent.entry, data, own?.id, groupId)}</ul></section>` : "";
  const voidedCount = data.entries.filter(entry => entry.status === "voided").length;
  const shown = results.slice(0, limit);
  const selecting = Boolean(csrf) && !data.ledger.archived_at && results.some(entry => entry.status === "active" && entry.type !== "transfer");
  const rows = shown.map(entry => entryRow(entry, data, own?.id, groupId, selecting)).join("");
  const rest = results.length - shown.length;
  const meta = filtering
    ? `${results.length} de ${plural(data.entries.length, "movimiento", "movimientos")}`
    : `${plural(data.entries.length - voidedCount, "vigente", "vigentes")}${voidedCount ? ` · ${plural(voidedCount, "anulado", "anulados")}` : ""}`;
  const shownNote = results.length > shown.length ? ` · mostrando ${shown.length}` : "";
  const moreParams = new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { categoria: category } : {}), ...(person ? { quien: person } : {}), mostrar: String(limit + PAGE_SIZE) });
  const more = rest > 0 ? `<a class="button secondary more" href="${path(groupId)}?${escapeHtml(moreParams.toString())}#movimientos">Ver ${Math.min(rest, PAGE_SIZE)} ${Math.min(rest, PAGE_SIZE) === 1 ? "movimiento" : "movimientos"} más</a>` : "";
  const owner = data.ledger.role === "owner";
  const first = `<div class="empty first-run"><h3>Todavía no hay movimientos.</h3><p>El saldo se arma siempre con movimientos que se pueden revisar. Nunca se escribe a mano.</p><a class="button big" href="${path(groupId)}/ledger/new">Agregá tu primer movimiento</a>${owner ? `<p class="first-run-import">¿Venís de Splitwise? <a href="${path(groupId)}/ledger/import">Traé tu historial</a> y se carga como movimientos normales.</p>` : ""}</div>`;
  const empty = filtering
    ? "<p>No hay coincidencias.</p>"
    : data.ledger.archived_at ? '<div class="empty"><h3>Este grupo no tiene movimientos.</h3></div>' : first;
  const quick = data.ledger.archived_at ? "" : `<div class="quick-actions"><span class="lead">Agregar:</span><a href="${path(groupId)}/ledger/new?type=expense">Gasto</a><a href="${path(groupId)}/ledger/new?type=income">Ingreso</a><a href="${path(groupId)}/ledger/new?type=transfer">Transferencia</a></div>`;
  return `<div class="book-grid"><div class="panel side"><section id="saldos" aria-labelledby="saldos-title"><h2 id="saldos-title" class="sr-only">Saldos</h2>${currencies.map(currency => balanceBlock(currency, data, own?.id, groupId)).join("")}${quick}</section></div><div class="panel"><section id="movimientos" class="ledger-section">${recentStrip}<div class="section-top"><h2>Movimientos</h2><div class="export-actions"><a href="${path(groupId)}/ledger/categories">Categorías</a>${!data.ledger.archived_at && data.entries.filter(isPending).length ? `<a href="${path(groupId)}/ledger/classify">Clasificar rápido · ${data.entries.filter(isPending).length}</a>` : ""}<a href="${path(groupId)}/ledger/export.json">Exportar JSON</a><a href="${path(groupId)}/ledger/export.csv">Exportar CSV</a></div></div><form method="get" action="${path(groupId)}" class="search-form" role="search"><label class="sr-only" for="ledger-search">Buscar</label><input id="ledger-search" name="q" type="search" value="${escapeHtml(query)}" placeholder="Texto, persona o monto" enterkeyhint="search"><button class="button secondary" type="submit">Buscar</button>${categoryFilter(data, category)}${filtering ? `<a class="clear" href="${path(groupId)}">Quitar ${query && (category || person) ? "búsqueda y filtros" : category || person ? "filtro" : "búsqueda"}</a>` : ""}</form>${personChips ? `<div class="person-filters" role="group" aria-label="Filtrar por persona">${personChips}</div>` : ""}${data.entries.length ? `<p class="list-meta" aria-live="polite">${meta}${shownNote} · propios e importados</p>` : ""}${rows ? (selecting ? `<form method="post" action="${path(groupId)}/ledger/recategorize/preview" class="selection-form">${selectionBar({ data, query, category, person, total: results.length, csrf })}<ul class="entry-list">${rows}</ul></form>${more}` : `<ul class="entry-list">${rows}</ul>${more}`) : empty}</section></div>${below ? `<div class="book-wide">${below}</div>` : ""}</div>`;
}
