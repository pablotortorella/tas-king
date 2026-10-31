// D1 rechaza una sentencia de más de ~100 KB (SQLITE_TOOBIG; medido en staging entre 98,8 y 110 KB). Las escrituras por
// tandas mandan JSON a `json_each`, y con notas largas 100 movimientos pueden pasar ese tamaño. Esta utilidad parte una
// lista en tandas que respetan una cantidad máxima de elementos Y un tamaño máximo estimado, sin reordenar nada.
export const MAX_STATEMENT_BYTES = 60_000;

export function chunkByBytes(items, { maxItems, maxBytes = MAX_STATEMENT_BYTES, weigh = item => JSON.stringify(item).length }) {
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const item of items) {
    const size = weigh(item);
    if (current.length && (current.length >= maxItems || bytes + size > maxBytes)) { chunks.push(current); current = []; bytes = 0; }
    current.push(item);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
