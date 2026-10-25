import { searchable } from "./text.js";

// Claves de ícono permitidas. La CSP no admite recursos externos, así que cada clave se dibuja con un SVG propio.
const svg = body => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
export const CATEGORY_ICONS = Object.freeze({
  home: svg('<path d="m4 11 8-7 8 7v9H4Zm5 9v-6h6v6"/>'),
  food: svg('<path d="M7 3v8a2 2 0 0 0 2 2v8m-4-18v5m4-5v5M17 21V3c-2 1-3 4-3 8h3"/>'),
  fun: svg('<path d="M8 5v14l11-7Z"/>'),
  car: svg('<path d="M5 16V11l2-5h10l2 5v5M3 16h18M7.5 19.5h.01M16.5 19.5h.01"/>'),
  bolt: svg('<path d="M13 3 5 14h6l-1 7 8-11h-6Z"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
  plane: svg('<path d="m3 12 18-8-5 16-4-6Zm9 2 4-6"/>'),
  cash: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  cart: svg('<path d="M3 4h2l2.5 11h10l2-8H6.5M9 20h.01M17 20h.01"/>'),
  gift: svg('<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M12 9v11M3 9h18M12 9c-3 0-4-4-1.5-4S12 9 12 9Zm0 0c3 0 4-4 1.5-4S12 9 12 9Z"/>'),
  tool: svg('<path d="M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2Z"/>'),
  paw: svg('<circle cx="7" cy="10" r="1.6"/><circle cx="17" cy="10" r="1.6"/><circle cx="10" cy="6" r="1.6"/><circle cx="14" cy="6" r="1.6"/><path d="M8 17c0-3 2-4 4-4s4 1 4 4c0 2-2 2-4 2s-4 0-4-2Z"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8Zm5-5h.01"/>'),
});
export const CATEGORY_ICON_LABELS = Object.freeze({ home: "Casa", food: "Comida", fun: "Ocio", car: "Vehículo", bolt: "Servicios", heart: "Vida", plane: "Viaje", cash: "Dinero", cart: "Compras", gift: "Regalo", tool: "Herramientas", paw: "Mascotas", tag: "Etiqueta" });
export const CATEGORY_ICON_KEYS = Object.freeze(Object.keys(CATEGORY_ICONS));
export const FALLBACK_CATEGORY_GROUP = "Mis categorías";

export function categoryIcon(key) { return CATEGORY_ICONS[key] ?? CATEGORY_ICONS.tag; }

// Lista inicial propia, inspirada en el vocabulario que ya conoce quien llega desde Splitwise y ajustada a los datos
// de referencia. Es una constante: se copia a cada libro nuevo y a los anteriores la primera vez que se leen, de modo
// que cambiarla no migra los libros ya sembrados. Los «Otro» llevan el nombre del grupo para que ningún nombre se repita.
const GROUPS = [
  ["Casa", "home", ["Alquiler", "Electrónica", "Hipoteca", "Mantenimiento", "Mascotas", "Muebles", "Servicio doméstico", "Servicios", "Suministros del hogar", "Seguro del hogar", "Casa - Otro"]],
  ["Comidas y bebidas", "food", ["Alimentos", "Licor", "Restaurantes", "Comidas y bebidas - Otro"]],
  ["Entretenimiento", "fun", ["Deportes", "Juegos", "Música", "Películas", "Suscripciones", "Entretenimiento - Otro"]],
  ["Transporte", "car", ["Autobús/tren", "Bicicleta", "Coche", "Estacionamiento", "Gasolina", "Taxi", "Transporte - Otro"]],
  ["Utilidades", "bolt", ["Agua", "Basura", "Calefacción", "Electricidad", "Limpieza", "TV/teléfono/Internet", "Utilidades - Otro"]],
  ["Vida", "heart", ["Formación", "Gastos médicos", "Guardería", "Impuestos", "Regalos", "Ropa", "Seguro", "Vida - Otro"]],
  ["Viajes", "plane", ["Avión", "Hotel", "Paseos", "Viajes - Otro"]],
  ["Ingresos", "cash", ["Alquiler cobrado", "Reintegros", "Ingresos - Otro"]],
];
const SPECIFIC_ICONS = { Mascotas: "paw", Muebles: "home", Electrónica: "tool", Mantenimiento: "tool", Alimentos: "cart", Regalos: "gift" };

export const DEFAULT_CATEGORIES = Object.freeze(GROUPS.flatMap(([group, icon, names]) => names.map(name => Object.freeze({ group, name, icon: SPECIFIC_ICONS[name] ?? icon }))));

// Forma que viaja a la base como un único JSON (una sola sentencia, sin parámetros por fila).
export function defaultCategoriesJson() {
  return JSON.stringify(DEFAULT_CATEGORIES.map((category, position) => ({
    name: category.name, name_key: searchable(category.name), group_name: category.group, group_key: searchable(category.group), icon: category.icon, position,
  })));
}
