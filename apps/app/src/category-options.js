import { categoryGroups } from "./categories.js";
import { escapeHtml } from "./ui-parts.js";

// Las categorías vigentes como <optgroup> por grupo. Los tres selectores (formulario, filtro de la lista y cambio en
// bloque) comparten esta estructura y solo cambian cómo se dibuja cada opción (`option`) y si el grupo ofrece una opción
// propia al principio (`groupOption`, p. ej. «Todo Casa» en el filtro).
export function categoryOptionGroups(categories, { option, groupOption = () => "" }) {
  return categoryGroups(categories).map(group => `<optgroup label="${escapeHtml(group.name)}">${groupOption(group)}${group.categories.map(option).join("")}</optgroup>`).join("");
}
