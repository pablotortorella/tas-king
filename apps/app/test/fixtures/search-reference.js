// Implementación de referencia de la búsqueda, tal como era antes del índice por petición. Solo la usan las pruebas de
// equivalencia: no se debe «mejorar». (Se retiró la rama del texto de categoría de los importados del modelo viejo: ya no existe.) La única diferencia intencional del código nuevo es el texto del motivo cuando coincide
// el nombre de una persona (antes «Participante: X», ahora «Pagó X» / «Participa X» / «Entregó X» / «Recibió X»).
import { CURRENCY_MINOR_UNITS, formatMoney } from "../../src/finance.js";
import { searchable } from "../../src/text.js";

function numericNeedle(query, currency) {
  const text = String(query ?? "").trim();
  if (!/^\d[\d.,\s]*$/u.test(text)) return null;
  const units = CURRENCY_MINOR_UNITS[currency];
  const decimal = text.match(/[.,](\d+)$/u);
  const usesDecimals = decimal && decimal[1].length === units && !(text.includes(".") && decimal[1].length === 3);
  return { digits: text.replace(/\D/gu, ""), usesDecimals };
}

function amountMatches(amountMinor, currency, query) {
  const needle = numericNeedle(query, currency);
  if (!needle?.digits) return false;
  const units = CURRENCY_MINOR_UNITS[currency];
  const digits = String(Math.abs(amountMinor)).padStart(units + 1, "0");
  const whole = units ? digits.slice(0, -units) : digits;
  return (needle.usesDecimals ? digits : whole).includes(needle.digits);
}

function matchTerm(entry, names, raw) {
  const needle = searchable(raw);
  if (!needle) return null;
  if (searchable(entry.description).includes(needle)) return "Descripción";
  if (entry.categoryInfo && searchable(entry.categoryInfo.name).includes(needle)) return "Categoría";
  if (entry.note && searchable(entry.note).includes(needle)) return "Nota";
  if (searchable(formatMoney(entry.totalMinor, entry.currency)).includes(needle) || amountMatches(entry.totalMinor, entry.currency, raw)) return "Importe total";
  for (const effect of entry.effects) {
    const name = names.get(effect.participantId) ?? "";
    if (searchable(name).includes(needle)) return `Participante: ${name}`;
    if (searchable(formatMoney(effect.amountMinor, entry.currency)).includes(needle) || amountMatches(effect.amountMinor, entry.currency, raw)) return `Efecto de ${name}`;
  }
  return null;
}

export function referenceSearch(entries, participants, query) {
  if (!searchable(query)) return entries.map(entry => ({ ...entry, matchReason: null }));
  const names = new Map(participants.map(p => [p.id, p.displayName]));
  const terms = String(query).trim().split(/\s+/u).filter(Boolean);
  return entries.flatMap(entry => {
    const whole = matchTerm(entry, names, query);
    if (whole) return [{ ...entry, matchReason: whole }];
    if (terms.length < 2) return [];
    const reasons = terms.map(term => matchTerm(entry, names, term));
    return reasons.every(Boolean) ? [{ ...entry, matchReason: [...new Set(reasons)].join(" + ") }] : [];
  });
}
