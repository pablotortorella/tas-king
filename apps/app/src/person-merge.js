// Reglas puras de la unión de personas (sin base de datos): cómo se suman las partes de un movimiento cuando dos personas
// pasan a ser una, y cómo se siguen los alias de las personas ya unidas. Las usan la operación, la vista previa y la lectura
// del libro, para que la regla sea una sola.

// Suma por persona (y por dirección en las partes de efectivo): si pagaron o participaron las dos, quedan como una.
function fold(components, resolve, byDirection) {
  const folded = new Map();
  for (const component of components) {
    const participantId = resolve(component.participantId);
    const key = byDirection ? `${participantId}:${component.direction}` : participantId;
    const prior = folded.get(key);
    if (prior) prior.amountMinor += component.amountMinor;
    else folded.set(key, { ...component, participantId });
  }
  return [...folded.values()];
}

export function relabelComponents({ cashParties, allocations }, resolve) {
  return { cashParties: fold(cashParties, resolve, true), allocations: fold(allocations, resolve, false) };
}

export function movePerson(components, sourceId, targetId) {
  return relabelComponents(components, id => (id === sourceId ? targetId : id));
}

export function touchesPerson(entry, personId) {
  return entry.cashParties.some(part => part.participantId === personId) || entry.allocations.some(part => part.participantId === personId);
}

// Una transferencia cuyas dos puntas son las personas que se unen quedaría de una persona a sí misma.
export function isTransferBetween(entry, sourceId, targetId) {
  if (entry.type !== "transfer") return false;
  const ids = new Set(entry.cashParties.map(part => part.participantId));
  return ids.size === 2 && ids.has(sourceId) && ids.has(targetId);
}

// El método de reparto describe los importes que se ingresaron; al sumar partes de dos personas ya no los describe.
export function mergedSnapshot(previous, components, mergeId) {
  const { split, ...rest } = previous;
  return { ...rest, cashParties: components.cashParties, allocations: components.allocations, status: "active", personMerge: mergeId };
}

// Sigue las uniones encadenadas (A→B, B→C) hasta la persona vigente. Un ciclo no puede existir (cada unión exige personas vigentes) pero se corta igual.
export function aliasResolver(rows) {
  const direct = new Map(rows.map(row => [row.id, row.mergedIntoId]));
  return id => {
    let current = id;
    for (let hops = 0; direct.has(current) && hops < direct.size + 1; hops += 1) current = direct.get(current);
    return current;
  };
}
