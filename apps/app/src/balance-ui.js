import { formatMoney } from "./finance.js";
import { entryLabel } from "./ledger-ui.js";
import { explainBalance } from "./settlement.js";
import { escapeHtml, ICONS, shortDate, spacePath as path } from "./ui-parts.js";

const signed = (amountMinor, currency) => `${amountMinor > 0 ? "+" : ""}${formatMoney(amountMinor, currency)}`;

function story(entry, target, names, isOwn) {
  const money = amountMinor => formatMoney(amountMinor, entry.currency);
  const sum = (rows, participantId, direction) => rows.filter(row => row.participantId === participantId && (!direction || row.direction === direction)).reduce((total, row) => total + row.amountMinor, 0);
  const list = direction => entry.cashParties.filter(party => party.direction === direction).map(party => names.get(party.participantId) ?? "Participante").join(", ");
  const you = isOwn ? "Vos" : target.displayName;
  const share = sum(entry.allocations, target.id);
  if (entry.type === "expense") {
    const paid = sum(entry.cashParties, target.id, "out");
    const owes = `${isOwn ? "te tocan" : "le tocan"} ${money(share)}`;
    return paid ? `${isOwn ? "Pagaste" : `${target.displayName} pagó`} ${money(paid)}${share ? ` y ${owes}` : ""}` : `Pagó ${list("out")}; ${owes}`;
  }
  if (entry.type === "income") {
    const received = sum(entry.cashParties, target.id, "in");
    return received ? `${isOwn ? "Lo recibiste" : `Lo recibió ${target.displayName}`}${share ? ` y ${isOwn ? "te tocan" : "le tocan"} ${money(share)}` : ""}` : `Lo recibió ${list("in")}${share ? ` y ${isOwn ? "te tocan" : "le tocan"} ${money(share)}` : ""}`;
  }
  const out = sum(entry.cashParties, target.id, "out");
  if (out) return `${you === "Vos" ? "Entregaste" : `${you} entregó`} ${money(out)} a ${list("in")}`;
  return `${list("out")} ${isOwn ? "te" : "le"} entregó ${money(sum(entry.cashParties, target.id, "in"))}`;
}

function row(item, data, target, names, isOwn, spaceId) {
  const { entry, effectMinor, accumulatedMinor } = item;
  const icon = entry.importBatchId ? ICONS.imported : ICONS[entry.type] ?? ICONS.expense;
  return `<li class="entry-row"><a href="${path(spaceId)}/ledger/entries/${encodeURIComponent(entry.id)}"><span class="ico ico-${entry.importBatchId ? "imported" : entry.type}">${icon}</span><span class="entry-main"><strong class="entry-title">${escapeHtml(entry.description)}</strong><small>${escapeHtml(entry.importBatchId ? "Importado" : entryLabel(entry.type))} · ${escapeHtml(shortDate(entry.occurredAt))}</small><small>${escapeHtml(story(entry, target, names, isOwn))}</small></span><span class="entry-side"><strong class="money ${effectMinor > 0 ? "owed" : "owes"}">${escapeHtml(signed(effectMinor, entry.currency))}</strong><small class="muted">acumulado ${escapeHtml(formatMoney(accumulatedMinor, entry.currency))}</small></span></a></li>`;
}

export function renderBalanceExplanation(data, { spaceId, userId, currency, personId }) {
  const own = data.participants.find(person => person.linkedUserId === userId) ?? null;
  const target = data.participants.find(person => person.id === personId) ?? own ?? data.participants[0];
  const isOwn = target.id === own?.id;
  const names = new Map(data.participants.map(person => [person.id, person.displayName]));
  const currencies = [...new Set([data.ledger.default_currency, ...data.balances.map(balance => balance.currency)])];
  const active = currencies.includes(currency) ? currency : data.ledger.default_currency;
  const balance = data.balances.find(entry => entry.currency === active && entry.participantId === target.id)?.amountMinor ?? 0;
  const { rows, totalMinor } = explainBalance(data.entries, target.id, active);
  const newestFirst = [...rows].reverse();
  const own_rows = newestFirst.filter(item => !item.entry.importBatchId);
  const imported = newestFirst.filter(item => item.entry.importBatchId);
  const importedTotal = imported.reduce((sum, item) => sum + item.effectMinor, 0);
  const title = isOwn
    ? balance > 0 ? "Por qué te deben" : balance < 0 ? "Por qué debés" : "Cómo se arma tu saldo"
    : balance > 0 ? `Por qué le deben a ${target.displayName}` : balance < 0 ? `Por qué debe ${target.displayName}` : `Cómo se arma el saldo de ${target.displayName}`;
  const switcher = currencies.length > 1
    ? `<nav class="type-tabs" aria-label="Moneda">${currencies.map(code => `<a href="${path(spaceId)}/ledger/balance?moneda=${code}${isOwn ? "" : `&amp;persona=${encodeURIComponent(target.id)}`}"${code === active ? ' aria-current="page"' : ""}>${escapeHtml(code)}</a>`).join("")}</nav>` : "";
  const equation = rows.length ? `${rows.map(item => signed(item.effectMinor, active).replace(`${active} `, "")).join(" ")} = ${formatMoney(totalMinor, active).replace(`${active} `, "")}` : "";
  const consistent = totalMinor === balance;
  const importedBlock = imported.length
    ? `<li class="entry-row imported-group"><details><summary><span class="ico ico-imported">${ICONS.imported}</span><span class="entry-main"><strong class="entry-title">Importado de Splitwise</strong><small>${imported.length} ${imported.length === 1 ? "movimiento" : "movimientos"} que ${isOwn ? "te" : "le"} ${importedTotal >= 0 ? "suman" : "restan"}</small></span><span class="entry-side"><strong class="money ${importedTotal > 0 ? "owed" : "owes"}">${escapeHtml(signed(importedTotal, active))}</strong></span></summary><ul class="entry-list">${imported.map(item => row(item, data, target, names, isOwn, spaceId)).join("")}</ul></details></li>`
    : "";
  const verification = `<p class="footnote">${rows.length ? `Suma de ${rows.length} ${rows.length === 1 ? "movimiento" : "movimientos"}: ${escapeHtml(equation)}.` : "Todavía no hay movimientos vigentes que afecten este saldo."} ${consistent ? "Coincide con el saldo del grupo ✓" : '<strong class="owes">No coincide con el saldo del libro. Avisá para revisarlo.</strong>'}</p>`;
  return `<a class="back-link" href="${path(spaceId)}">← Volver al libro</a><p class="eyebrow">${escapeHtml(isOwn ? "Tu saldo" : target.displayName)} · ${escapeHtml(active)}</p><h1>${escapeHtml(title)}</h1>${switcher}<div class="hero${balance < 0 ? " neg" : ""}"><p class="hero-label">${escapeHtml(isOwn ? "Tu saldo" : `Saldo de ${target.displayName}`)} · ${escapeHtml(active)}</p><p class="hero-amount money">${escapeHtml(signed(balance, active))}</p><p class="hero-note">Es la suma de lo que cada movimiento ${isOwn ? "te" : "le"} suma o ${isOwn ? "te" : "le"} resta. Nada se carga a mano.</p></div><section class="ledger-section"><h2>Movimientos que lo explican</h2>${rows.length ? `<ul class="entry-list">${own_rows.map(item => row(item, data, target, names, isOwn, spaceId)).join("")}${importedBlock}</ul>` : "<p>Sin movimientos todavía.</p>"}${verification}</section><p class="footnote">Los movimientos anulados no cuentan. Otras monedas se explican aparte: nunca se suman ni se convierten.</p>`;
}
