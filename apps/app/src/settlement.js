// Cálculos derivados de los saldos. No acceden a la base de datos ni guardan nada: las sugerencias
// y la explicación de un saldo se recalculan al leer (libro-y-saldos-cuentas-claras, D3 y D6).

// D6: acreedores y deudores ordenados por monto descendente y luego por id; se empareja el mayor con el
// mayor hasta agotar. Devuelve a lo sumo n−1 transferencias y el mismo resultado ante los mismos saldos.
export function suggestTransfers(balances) {
  const byAmount = (a, b) => b.amountMinor - a.amountMinor || a.participantId.localeCompare(b.participantId);
  const creditors = balances.filter(row => row.amountMinor > 0).map(row => ({ ...row })).sort(byAmount);
  const debtors = balances.filter(row => row.amountMinor < 0).map(row => ({ participantId: row.participantId, amountMinor: -row.amountMinor })).sort(byAmount);
  const transfers = [];
  let creditor = 0;
  let debtor = 0;
  while (creditor < creditors.length && debtor < debtors.length) {
    const amountMinor = Math.min(creditors[creditor].amountMinor, debtors[debtor].amountMinor);
    transfers.push({ from: debtors[debtor].participantId, to: creditors[creditor].participantId, amountMinor });
    creditors[creditor].amountMinor -= amountMinor;
    debtors[debtor].amountMinor -= amountMinor;
    if (creditors[creditor].amountMinor === 0) creditor++;
    if (debtors[debtor].amountMinor === 0) debtor++;
  }
  return transfers;
}

// Movimientos vigentes que componen el saldo de un participante en una moneda, en orden cronológico,
// con el acumulado después de cada uno. `total` es la suma y debe coincidir con el saldo del libro.
export function explainBalance(entries, participantId, currency) {
  const own = entries
    .filter(entry => entry.status === "active" && entry.currency === currency)
    .map(entry => ({ entry, effectMinor: entry.effects.find(effect => effect.participantId === participantId)?.amountMinor ?? 0 }))
    .filter(row => row.effectMinor !== 0)
    .sort((a, b) => a.entry.occurredAt.localeCompare(b.entry.occurredAt) || a.entry.id.localeCompare(b.entry.id));
  let accumulated = 0;
  const rows = own.map(row => {
    accumulated += row.effectMinor;
    return { ...row, accumulatedMinor: accumulated };
  });
  return { rows, totalMinor: accumulated };
}
