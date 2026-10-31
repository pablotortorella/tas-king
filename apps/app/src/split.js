// Regla única de reparto de gastos e ingresos. La usan el servidor al guardar y el navegador en la vista previa:
// /split.js publica el texto de esta misma función. Por eso debe ser autosuficiente: sin variables libres, sin
// importaciones y sin acceso a la base ni al DOM. Todo se calcula con enteros (BigInt) en la unidad menor.
//
// splitAmount({ totalMinor, units, currency, method, beneficiaries, inputs, order, names })
//   method: "equal" | "exact" | "percent" | "shares" | "fixed"
//   beneficiaries: identificadores de las personas elegidas, en cualquier orden
//   inputs: identificador -> texto ingresado (importe, porcentaje, partes o importe fijo)
//   order: identificador -> posición en el grupo (desempata el residuo); names: identificador -> nombre para los mensajes
// Devuelve { ok: true, allocations, residue: { minor, to } } o { ok: false, error, participantId }.
export function splitAmount(request) {
  const { totalMinor, units, currency, method, beneficiaries, inputs = {}, order = {}, names = {} } = request;
  const fail = (error, participantId) => ({ ok: false, error, participantId });
  const who = id => names[id] ?? "esa persona";
  const money = minor => {
    const absolute = BigInt(minor < 0n ? -minor : minor);
    const scale = 10n ** BigInt(units);
    const whole = new Intl.NumberFormat("es-CO").format(absolute / scale);
    return `${minor < 0n ? "−" : ""}${currency} ${whole}${units ? `,${String(absolute % scale).padStart(units, "0")}` : ""}`;
  };
  const hundredths = value => `${value / 100n},${String(value % 100n).padStart(2, "0")}`;
  const parseDecimal = (text, places) => {
    const clean = String(text ?? "").trim();
    if (!/^\d+(?:[.,]\d+)?$/u.test(clean)) return null;
    const [whole, fraction = ""] = clean.replace(",", ".").split(".");
    if (fraction.length > places) return null;
    return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0") || "0");
  };
  // Reparte `amount` en proporción a los pesos. El residuo va de a una unidad menor a quienes tienen el mayor resto;
  // los empates se resuelven por el orden del grupo (la posición en `rows`, ya ordenada).
  const distribute = (amount, weighted) => {
    const sum = weighted.reduce((total, item) => total + item.weight, 0n);
    const rows = weighted.map((item, index) => ({ id: item.id, index, floor: amount * item.weight / sum, remainder: amount * item.weight % sum }));
    const leftover = amount - rows.reduce((total, row) => total + row.floor, 0n);
    const ranked = [...rows].sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : a.index - b.index));
    const winners = new Set(ranked.slice(0, Number(leftover)).map(row => row.id));
    return {
      shares: rows.map(row => ({ id: row.id, amount: row.floor + (winners.has(row.id) ? 1n : 0n) })),
      leftover: Number(leftover),
      winners: rows.filter(row => winners.has(row.id)).map(row => row.id),
    };
  };

  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) return fail("El importe debe ser un entero positivo.");
  const total = BigInt(totalMinor);
  const ids = [...new Set(beneficiaries ?? [])];
  if (!ids.length) return fail("Elegí al menos una persona para el reparto.");
  ids.sort((a, b) => (order[a] ?? Infinity) - (order[b] ?? Infinity) || String(a).localeCompare(String(b)));

  let result;
  if (method === "equal") {
    result = distribute(total, ids.map(id => ({ id, weight: 1n })));
  } else if (method === "percent" || method === "shares") {
    const weights = [];
    for (const id of ids) {
      const value = parseDecimal(inputs[id], 2);
      if (value === null) return fail(`Falta el ${method === "percent" ? "porcentaje" : "número de partes"} de ${who(id)} o no es válido.`, id);
      weights.push({ id, weight: value });
    }
    const sum = weights.reduce((acc, item) => acc + item.weight, 0n);
    if (method === "percent" && sum !== 10000n) return fail(`Los porcentajes suman ${hundredths(sum)} % y deben sumar 100 %.`);
    if (sum === 0n) return fail("Al menos una persona debe tener partes.");
    result = distribute(total, weights);
  } else if (method === "exact") {
    const shares = [];
    for (const id of ids) {
      const value = parseDecimal(inputs[id], units);
      if (value === null || value === 0n) return fail(`Falta el importe de ${who(id)} o no es válido.`, id);
      shares.push({ id, amount: value });
    }
    const sum = shares.reduce((acc, item) => acc + item.amount, 0n);
    if (sum !== total) return fail(`Los importes suman ${money(sum)} y el total es ${money(total)}: ${sum > total ? "sobran" : "faltan"} ${money(sum > total ? sum - total : total - sum)}.`);
    result = { shares, leftover: 0, winners: [] };
  } else if (method === "fixed") {
    const fixed = [];
    const rest = [];
    for (const id of ids) {
      if (String(inputs[id] ?? "").trim() === "") { rest.push(id); continue; }
      const value = parseDecimal(inputs[id], units);
      if (value === null || value === 0n) return fail(`El importe fijo de ${who(id)} no es válido.`, id);
      fixed.push({ id, amount: value });
    }
    const fixedSum = fixed.reduce((acc, item) => acc + item.amount, 0n);
    if (fixedSum > total) return fail(`Los importes fijos (${money(fixedSum)}) superan el total (${money(total)}).`);
    if (!rest.length && fixedSum !== total) return fail(`Todos tienen importe fijo y suman ${money(fixedSum)}: falta repartir ${money(total - fixedSum)}.`);
    if (rest.length && fixedSum === total) return fail("Los importes fijos ya suman el total: no queda resto para repartir entre las demás personas.");
    const shared = rest.length ? distribute(total - fixedSum, rest.map(id => ({ id, weight: 1n }))) : { shares: [], leftover: 0, winners: [] };
    const byId = new Map([...fixed, ...shared.shares].map(item => [item.id, item.amount]));
    result = { shares: ids.map(id => ({ id, amount: byId.get(id) })), leftover: shared.leftover, winners: shared.winners };
  } else {
    return fail("Reparto inválido.");
  }
  return {
    ok: true,
    allocations: result.shares.filter(item => item.amount > 0n).map(item => ({ participantId: item.id, amountMinor: Number(item.amount) })),
    residue: { minor: result.leftover, to: result.winners },
  };
}

// Texto del módulo que se sirve al navegador en /split.js. El empaquetador puede envolver los nombres de las
// funciones internas con `__name`; la línea inicial lo define para que el texto funcione solo.
export const SPLIT_MODULE_SOURCE = `const __name = (target) => target;\nexport ${splitAmount.toString()}\n`;
