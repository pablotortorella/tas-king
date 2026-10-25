import { searchable } from "./text.js";

// Sugerencia de categoría: una regla simple y conservadora, sin aprendizaje automático. Función pura.
//
// Toma las palabras significativas de la descripción (sin conectores, números ni palabras de una o dos letras) y cuenta,
// entre los movimientos ya categorizados que comparten alguna, a qué categoría pertenece cada uno. Solo sugiere si hay al
// menos dos coincidencias y una categoría reúne el 70 % o más de ellas.
const STOP_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "en", "a", "un", "una", "unos", "unas", "por", "para", "con", "sin", "al", "que", "se", "su", "mi", "tu", "the", "and", "for", "of"]);
export const MIN_VOTES = 2;
export const MIN_SHARE = 0.7;

// Un movimiento está pendiente de categorizar cuando no tiene categoría o tiene la del grupo «Sin categoría».
export function isPending(entry) {
  return entry.status === "active" && entry.type !== "transfer" && (!entry.categoryInfo || entry.categoryInfo.groupKey === "sin categoria");
}

export function significantWords(description) {
  return [...new Set(searchable(description).split(" ").filter(word => word.length >= 3 && !/^\d+$/u.test(word) && !STOP_WORDS.has(word)))];
}

export function suggestCategory(entry, categorized) {
  const words = significantWords(entry.description);
  if (!words.length) return null;
  const wanted = new Set(words);
  const votes = new Map();
  const shared = new Map();
  let total = 0;
  for (const other of categorized) {
    if (other.id === entry.id || !other.categoryInfo) continue;
    const common = significantWords(other.description).filter(word => wanted.has(word));
    if (!common.length) continue;
    total += 1;
    const key = other.categoryInfo.id;
    votes.set(key, (votes.get(key) ?? 0) + 1);
    if (!shared.has(key)) shared.set(key, new Map());
    for (const word of common) shared.get(key).set(word, (shared.get(key).get(word) ?? 0) + 1);
  }
  if (total < MIN_VOTES) return null;
  const [topId, topVotes] = [...votes].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
  if (topVotes < MIN_VOTES || topVotes / total < MIN_SHARE) return null;
  const category = categorized.find(other => other.categoryInfo?.id === topId).categoryInfo;
  const word = [...shared.get(topId)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  return { categoryId: topId, name: category.name, votes: topVotes, total, word, reason: `«${word}» aparece en ${topVotes} ${topVotes === 1 ? "movimiento" : "movimientos"} de ${category.name}${total > topVotes ? ` (de ${total} parecidos)` : ""}` };
}
