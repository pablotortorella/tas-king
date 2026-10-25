// Aviso estructurado cuando abrir el libro tarda más de lo esperado. Solo lleva cantidades y tiempos (nunca nombres,
// descripciones ni importes). Junto con el umbral de 5.000 movimientos decide cuándo conviene pasar la búsqueda y la
// paginación a SQL (ver CASO-REAL-INTERNO.md). Función pura: el servidor decide qué hacer con el evento.
export const SLOW_BOOK_MS = 300;
export const SQL_TRIGGER_ENTRIES = 5000;

export function slowBookEvent({ elapsedMs, entries, participants, categories, requestId = null }, threshold = SLOW_BOOK_MS) {
  const limit = threshold === "" || threshold === null || threshold === undefined || !Number.isFinite(Number(threshold)) ? SLOW_BOOK_MS : Number(threshold);
  if (!(elapsedMs >= limit) || elapsedMs < 0) return null;
  return { event: "slow_book_open", elapsedMs: Math.round(elapsedMs), thresholdMs: limit, entries, participants, categories, overSqlTrigger: entries >= SQL_TRIGGER_ENTRIES, requestId };
}
