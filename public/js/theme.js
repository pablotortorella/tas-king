// Tema claro/oscuro y paleta de color por tablero.
//
// El tema ya quedó aplicado por js/theme-boot.js antes del primer pintado; este
// módulo solo maneja el toggle y la paleta. No lee ni escribe estado compartido:
// la preferencia de tema vive en localStorage y la paleta es un atributo del
// documento, así que no depende de nada del núcleo salvo el propio navegador.

export const PALETTES = [
  { key: "candy_pop", label: "Candy Pop (oficial)", swatch: "#7C3AED" },
  { key: "sunset_pop", label: "Sunset Pop", swatch: "#D9432A" },
  { key: "citrus_fresh", label: "Citrus Fresh", swatch: "#CC6600" },
  { key: "jungle_pop", label: "Jungle Pop", swatch: "#1F7A4D" },
];

export function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function syncThemeButton() {
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("tasking-theme", next); } catch (e) { /* modo privado */ }
  syncThemeButton();
}

/** theme null/undefined (tablero sin paleta asignada todavía) se renderiza como candy_pop. */
export function applyBoardPalette(theme) {
  const palette = PALETTES.some(p => p.key === theme) ? theme : "candy_pop";
  document.documentElement.setAttribute("data-palette", palette);
}

/**
 * Enlaza el botón de tema. Se llama desde app.js y no al importar: el orden de
 * los efectos de arranque se decide en un solo lugar, no según quién importa a quién.
 */
export function initTheme() {
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
  syncThemeButton();
}
