export const CURRENCY_MINOR_UNITS = Object.freeze({
  COP: 2,
  EUR: 2,
  JPY: 0,
  KWD: 3,
  USD: 2,
});

export class FinancialValidationError extends Error {}

export function normalizeCurrency(value) {
  if (typeof value !== "string") return null;
  const currency = value.trim().toUpperCase();
  return Object.hasOwn(CURRENCY_MINOR_UNITS, currency) ? currency : null;
}

export function assertMinorAmount(value, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new FinancialValidationError("El importe debe ser un entero positivo en unidad menor.");
  }
  return value;
}

export function splitEqually(totalMinor, participantIds) {
  assertMinorAmount(totalMinor);
  if (!Array.isArray(participantIds) || participantIds.length === 0 || new Set(participantIds).size !== participantIds.length || participantIds.some(id => typeof id !== "string" || !id)) {
    throw new FinancialValidationError("Los participantes del reparto deben ser únicos.");
  }
  const quotient = Math.floor(totalMinor / participantIds.length);
  const remainder = totalMinor % participantIds.length;
  return participantIds.map((participantId, index) => ({ participantId, amountMinor: quotient + (index < remainder ? 1 : 0) }));
}

function validateComponents(components, participants, allowedDirections) {
  if (!Array.isArray(components)) throw new FinancialValidationError("Los componentes financieros son requeridos.");
  const seen = new Set();
  return components.map((component) => {
    if (!component || !participants.has(component.participantId)) throw new FinancialValidationError("El participante no pertenece al libro.");
    if (allowedDirections && !allowedDirections.has(component.direction)) throw new FinancialValidationError("La dirección de efectivo no corresponde al movimiento.");
    const key = `${component.participantId}:${component.direction ?? "allocation"}`;
    if (seen.has(key)) throw new FinancialValidationError("Un participante no puede repetirse en el mismo componente.");
    seen.add(key);
    return { ...component, amountMinor: assertMinorAmount(component.amountMinor) };
  });
}

function sum(components) {
  return components.reduce((total, component) => {
    const next = total + component.amountMinor;
    if (!Number.isSafeInteger(next)) throw new FinancialValidationError("La suma excede el rango monetario permitido.");
    return next;
  }, 0);
}

function effectsFor(type, cashParties, allocations) {
  const effects = new Map();
  const add = (participantId, amount) => effects.set(participantId, (effects.get(participantId) ?? 0) + amount);
  if (type === "expense") {
    cashParties.forEach(component => add(component.participantId, component.amountMinor));
    allocations.forEach(component => add(component.participantId, -component.amountMinor));
  } else if (type === "income") {
    cashParties.forEach(component => add(component.participantId, -component.amountMinor));
    allocations.forEach(component => add(component.participantId, component.amountMinor));
  } else {
    cashParties.forEach(component => add(component.participantId, component.direction === "out" ? component.amountMinor : -component.amountMinor));
  }
  return [...effects.entries()].map(([participantId, amountMinor]) => ({ participantId, amountMinor }));
}

export function validateEntryDraft(draft, participantIds) {
  const participants = new Set(participantIds);
  const type = draft?.type;
  if (!new Set(["expense", "income", "transfer"]).has(type)) throw new FinancialValidationError("Tipo de movimiento inválido.");
  const currency = normalizeCurrency(draft.currency);
  if (!currency) throw new FinancialValidationError("Moneda no soportada.");
  const totalMinor = assertMinorAmount(draft.totalMinor);
  const direction = type === "expense" ? new Set(["out"]) : type === "income" ? new Set(["in"]) : new Set(["out", "in"]);
  const cashParties = validateComponents(draft.cashParties, participants, direction);
  const allocations = validateComponents(draft.allocations ?? [], participants);

  if (type === "transfer") {
    const outgoing = cashParties.filter(component => component.direction === "out");
    const incoming = cashParties.filter(component => component.direction === "in");
    if (outgoing.length !== 1 || incoming.length !== 1 || outgoing[0].participantId === incoming[0].participantId || allocations.length !== 0 || outgoing[0].amountMinor !== totalMinor || incoming[0].amountMinor !== totalMinor) {
      throw new FinancialValidationError("La transferencia requiere origen y destino distintos por el total.");
    }
  } else if (sum(cashParties) !== totalMinor || sum(allocations) !== totalMinor) {
    throw new FinancialValidationError("Los componentes deben sumar exactamente el total.");
  }

  const effects = effectsFor(type, cashParties, allocations);
  if (sum(effects) !== 0) throw new FinancialValidationError("Los efectos del movimiento no suman cero.");
  return { type, currency, totalMinor, cashParties, allocations, effects };
}
