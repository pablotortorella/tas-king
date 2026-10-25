import { CURRENCY_MINOR_UNITS, formatMoney } from "./finance.js";
import { searchable } from "./text.js";

// Búsqueda del historial, en JavaScript sobre el libro ya cargado. Cada petición construye un índice con los textos ya
// normalizados (una sola vez por movimiento y por campo) y solo formatea importes cuando el término los puede alcanzar.
// El resultado es el mismo que el de la implementación anterior (la prueba de equivalencia la conserva como referencia);
// lo único que cambia es el motivo cuando coincide el nombre de una persona: «Pagó X», «Participa X», «Entregó X»,
// «Recibió X».

function numericNeedle(text, currency) {
  const clean = String(text ?? "").trim();
  if (!/^\d[\d.,\s]*$/u.test(clean)) return null;
  const units = CURRENCY_MINOR_UNITS[currency];
  const decimal = clean.match(/[.,](\d+)$/u);
  const usesDecimals = decimal && decimal[1].length === units && !(clean.includes(".") && decimal[1].length === 3);
  return { digits: clean.replace(/\D/gu, ""), usesDecimals };
}

function amountMatches(amountMinor, currency, raw) {
  const needle = numericNeedle(raw, currency);
  if (!needle?.digits) return false;
  const units = CURRENCY_MINOR_UNITS[currency];
  const digits = String(Math.abs(amountMinor)).padStart(units + 1, "0");
  const whole = units ? digits.slice(0, -units) : digits;
  return (needle.usesDecimals ? digits : whole).includes(needle.digits);
}

function makeTerm(raw) {
  const needle = searchable(raw);
  return { raw: String(raw), needle, hasDigit: /\d/u.test(needle) };
}

// Los roles de una persona en un movimiento, derivados de los pagadores, el reparto y las transferencias.
export function personRoles(entry, participantId) {
  const cash = entry.cashParties ?? [];
  const out = cash.some(party => party.participantId === participantId && party.direction === "out");
  const into = cash.some(party => party.participantId === participantId && party.direction === "in");
  const shares = (entry.allocations ?? []).some(share => share.participantId === participantId);
  if (entry.type === "transfer") return { paid: false, participates: false, gave: out, received: into };
  return { paid: entry.type === "income" ? into : out, received: false, gave: false, participates: shares, isIncome: entry.type === "income" };
}

function roleReason(entry, participantId, name) {
  const roles = personRoles(entry, participantId);
  const reasons = [];
  if (roles.gave) reasons.push(`Entregó ${name}`);
  if (roles.received) reasons.push(`Recibió ${name}`);
  if (roles.paid) reasons.push(`${roles.isIncome ? "Recibió" : "Pagó"} ${name}${entry.inferred ? " · inferido" : ""}`);
  if (roles.participates) reasons.push(`Participa ${name}`);
  return reasons.join(" + ") || `Participa ${name}`;
}

export function searchLedger(entries, participants, query) {
  if (!searchable(query)) return entries.map(entry => ({ ...entry, matchReason: null }));
  const names = new Map(participants.map(person => [person.id, person.displayName]));
  const normalizedNames = new Map(participants.map(person => [person.id, searchable(person.displayName)]));
  const rawTerms = String(query).trim().split(/\s+/u).filter(Boolean);
  const terms = rawTerms.length >= 2 ? rawTerms.map(makeTerm) : [];
  const whole = makeTerm(query);
  const moneyText = new Map();
  const money = (amountMinor, currency) => {
    const key = `${currency}:${amountMinor}`;
    if (!moneyText.has(key)) moneyText.set(key, searchable(formatMoney(amountMinor, currency)));
    return moneyText.get(key);
  };
  // El importe formateado es «<MONEDA> <dígitos>»: un término sin dígitos solo puede coincidir con el código de la moneda.
  const amountHit = (term, amountMinor, currency) => (term.hasDigit
    ? money(amountMinor, currency).includes(term.needle) || amountMatches(amountMinor, currency, term.raw)
    : searchable(currency).includes(term.needle));

  const indexOf = new Map();
  const index = entry => {
    let item = indexOf.get(entry);
    if (!item) { item = { desc: undefined, cat: undefined, note: undefined }; indexOf.set(entry, item); }
    return item;
  };
  const description = entry => { const item = index(entry); return item.desc ??= searchable(entry.description); };
  const category = entry => { const item = index(entry); return item.cat ??= `${entry.categoryInfo ? searchable(entry.categoryInfo.name) : ""}\u0000${entry.category ? searchable(entry.category) : ""}`; };
  const note = entry => { const item = index(entry); return item.note ??= (entry.note ? searchable(entry.note) : ""); };

  const matchTerm = (entry, term) => {
    const needle = term.needle;
    if (!needle) return null;
    if (description(entry).includes(needle)) return "Descripción";
    const [fromInfo, fromText] = category(entry).split("\u0000");
    if ((entry.categoryInfo && fromInfo.includes(needle)) || (entry.category && fromText.includes(needle))) return "Categoría";
    if (entry.note && note(entry).includes(needle)) return "Nota";
    if (amountHit(term, entry.totalMinor, entry.currency)) return "Importe total";
    for (const effect of entry.effects) {
      const name = names.get(effect.participantId) ?? "";
      if ((normalizedNames.get(effect.participantId) ?? searchable("")).includes(needle)) return roleReason(entry, effect.participantId, name);
      if (amountHit(term, effect.amountMinor, entry.currency)) return `Efecto de ${name}`;
    }
    return null;
  };

  return entries.flatMap(entry => {
    const hit = matchTerm(entry, whole);
    if (hit) return [{ ...entry, matchReason: hit }];
    if (terms.length < 2) return [];
    const reasons = terms.map(term => matchTerm(entry, term));
    return reasons.every(Boolean) ? [{ ...entry, matchReason: [...new Set(reasons)].join(" + ") }] : [];
  });
}

// Personas cuyo nombre coincide con algún término de la consulta (para ofrecer los filtros rápidos).
export function personsInQuery(participants, query) {
  const needles = [searchable(query), ...String(query ?? "").trim().split(/\s+/u).map(searchable)].filter(Boolean);
  if (!needles.length) return [];
  return participants.filter(person => { const name = searchable(person.displayName); return needles.some(needle => name.includes(needle)); });
}

// Filtros por persona sobre un conjunto ya encontrado: «pago:ID» (pagó, o recibió en un ingreso) y «participa:ID».
export function filterByPerson(entries, value) {
  const [kind, id] = String(value ?? "").split(":");
  if (!id || !["pago", "participa"].includes(kind)) return entries;
  return entries.filter(entry => { const roles = personRoles(entry, id); return kind === "pago" ? roles.paid || roles.gave : roles.participates || roles.received; });
}

export function personCounts(entries, personId) {
  return { paid: filterByPerson(entries, `pago:${personId}`).length, participates: filterByPerson(entries, `participa:${personId}`).length };
}

// Filtro por categoría: «none» (sin categoría), «g:<grupo>» (todas las del grupo) o el identificador de una categoría.
// Se aplica sobre la categoría ya resuelta, así que los movimientos de una categoría fusionada cuentan en la destino.
export function filterByCategory(entries, value) {
  const filter = String(value ?? "");
  if (!filter) return entries;
  if (filter === "none") return entries.filter(entry => !entry.categoryInfo && entry.type !== "transfer");
  if (filter.startsWith("g:")) return entries.filter(entry => entry.categoryInfo?.groupKey === filter.slice(2));
  return entries.filter(entry => entry.categoryInfo?.id === filter);
}

// «Los resultados de la lista»: búsqueda, filtro de categoría y filtro de persona. Es la única definición: la vista de la
// lista y la selección para recategorizar la usan, así «todos los resultados» siempre coincide con lo que se ve.
export function listResults(data, { query = "", category = "", person = "" } = {}) {
  return filterByPerson(filterByCategory(searchLedger(data.entries, data.participants, query), category), person);
}
