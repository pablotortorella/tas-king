// Forma normalizada de un texto para comparar: sin acentos, en minúsculas, con todo lo que no es letra o número
// convertido en un espacio y los espacios colapsados. La usan la búsqueda y los nombres de categoría, así
// «Casa - Otro» y «casa otro» se tratan igual en los dos lugares.
export function searchable(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim().replace(/\s+/gu, " ");
}

// Texto del módulo que se sirve al navegador en /text.js, como con /split.js: la misma función, sin copias.
export const TEXT_MODULE_SOURCE = `const __name = (target) => target;\nexport ${searchable.toString()}\n`;
