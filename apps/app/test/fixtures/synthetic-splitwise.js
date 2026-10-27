// Generador de CSV sintéticos con la forma de un export real de Splitwise (sin datos reales): dos personas, una moneda,
// mayoría de repartos mitad y mitad, algunos al 100 % de una persona, una fila sin efecto y la fila de resumen con la
// fecha de exportación en la primera celda y el importe en blanco. Determinista: la misma semilla da el mismo archivo.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = ["General", "Restaurantes", "Alimentos", "Servicios", "Suscripciones", "Taxi", "Regalos", "Alquiler", "General", "General"];

export function syntheticSplitwiseCsv({ rows = 2485, people = ["Ana Prueba", "Beto Prueba"], seed = 7, withSummary = true, withNotes = false } = {}) {
  const random = seededRandom(seed);
  const header = ["Fecha", "Descripción", "Categoría", "Coste", "Moneda", ...people, ...(withNotes ? ["Notas"] : [])];
  const lines = [header.join(",")];
  const balances = people.map(() => 0);
  let day = Date.UTC(2023, 3, 1);
  for (let index = 0; index < rows; index += 1) {
    day += Math.floor(random() * 2) * 86400000;
    const date = new Date(day).toISOString().slice(0, 10);
    const totalMinor = (1 + Math.floor(random() * 4000)) * (random() < 0.4 ? 5 : 100) + (random() < 0.15 ? 50 : 0);
    const pattern = random();
    const effects = people.map(() => 0);
    const payer = Math.floor(random() * people.length);
    if (index === 7) { /* fila sin efecto en nadie */ }
    else if (pattern < 0.957 || people.length < 2) {
      const half = Math.floor(totalMinor / 2);
      effects[payer] += totalMinor - half;
      const other = (payer + 1) % people.length;
      effects[other] -= totalMinor - half;
    } else if (pattern < 0.998) {
      effects[payer] += totalMinor;
      effects[(payer + 1) % people.length] -= totalMinor;
    } else {
      effects[payer] += Math.floor(totalMinor / 3);
      effects[(payer + 1) % people.length] -= Math.floor(totalMinor / 3);
    }
    effects.forEach((effect, position) => { balances[position] += effect; });
    const money = minor => `${minor < 0 ? "-" : ""}${Math.floor(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
    const category = CATEGORIES[Math.floor(random() * CATEGORIES.length)];
    const note = withNotes && random() < 0.1 ? `Nota ${index}` : "";
    lines.push([date, `Movimiento ${index + 1}`, category, money(totalMinor), "COP", ...effects.map(money), ...(withNotes ? [note] : [])].join(","));
  }
  if (withSummary) {
    const money = minor => `${minor < 0 ? "-" : ""}${Math.floor(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
    lines.push(["", "", "", "", "", ...people.map(() => ""), ...(withNotes ? [""] : [])].join(","));
    lines.push([new Date(day + 86400000).toISOString().slice(0, 10), "Saldo total", "", "", "", ...balances.map(money), ...(withNotes ? [""] : [])].join(","));
  }
  return { csv: `${lines.join("\n")}\n`, balances, people };
}
