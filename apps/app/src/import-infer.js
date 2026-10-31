// Inferencia de pagadores y reparto de una fila importada de Splitwise. Función pura: no toca la base ni el DOM.
//
// Una fila de Splitwise trae un total y un efecto por persona (positivo: le deben; negativo: debe). La aplicación guarda
// gastos con pagadores y reparto, así que cada fila se descompone así:
//   - pagan quienes quedan a favor; cada pagador aporta su efecto más su propia parte;
//   - las partes propias suman el total menos la suma de los efectos a favor y se reparten en proporción al efecto,
//     con el residuo en el último pagador;
//   - quienes quedan en contra deben exactamente su efecto;
//   - sin efecto en nadie, una misma persona paga y consume el total.
// Por construcción los efectos que resultan son idénticos a los de la fila.
export function inferComponents({ totalMinor, effects, fallbackParticipantId = null }) {
  const reject = reason => ({ ok: false, reason });
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) return reject("El total debe ser mayor que cero.");
  const merged = new Map();
  for (const effect of effects) {
    if (!Number.isSafeInteger(effect.amountMinor)) return reject("Un efecto no es un entero válido.");
    merged.set(effect.participantId, (merged.get(effect.participantId) ?? 0) + effect.amountMinor);
  }
  const entries = [...merged].filter(([, amount]) => amount !== 0);
  if (entries.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== 0n) return reject("Los efectos de la fila no suman cero.");
  if (!entries.length) {
    if (!fallbackParticipantId) return reject("Falta una persona para una fila sin efectos.");
    return { ok: true, cashParties: [{ participantId: fallbackParticipantId, direction: "out", amountMinor: totalMinor }], allocations: [{ participantId: fallbackParticipantId, amountMinor: totalMinor }] };
  }
  const creditors = entries.filter(([, amount]) => amount > 0);
  const debtors = entries.filter(([, amount]) => amount < 0);
  const positive = creditors.reduce((sum, [, amount]) => sum + BigInt(amount), 0n);
  const total = BigInt(totalMinor);
  if (positive > total) return reject("El efecto a favor supera el total del movimiento.");
  const own = total - positive;
  const shares = [];
  let assigned = 0n;
  creditors.forEach(([participantId, amount], index) => {
    const share = index === creditors.length - 1 ? own - assigned : own * BigInt(amount) / positive;
    assigned += share;
    shares.push([participantId, amount, share]);
  });
  return {
    ok: true,
    cashParties: shares.map(([participantId, amount, share]) => ({ participantId, direction: "out", amountMinor: Number(BigInt(amount) + share) })),
    allocations: [
      ...shares.filter(([, , share]) => share > 0n).map(([participantId, , share]) => ({ participantId, amountMinor: Number(share) })),
      ...debtors.map(([participantId, amount]) => ({ participantId, amountMinor: -amount })),
    ],
  };
}

// Junta en una persona del libro los efectos de varias columnas del archivo que se asociaron a ella.
export function mergeEffects(amounts, participantIds) {
  const merged = new Map();
  amounts.forEach((amountMinor, index) => merged.set(participantIds[index], (merged.get(participantIds[index]) ?? 0) + amountMinor));
  return [...merged].map(([participantId, amountMinor]) => ({ participantId, amountMinor }));
}
