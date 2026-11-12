// Toggle de tema para las páginas públicas.
//
// El mismo código estaba copiado en landing, releases y términos. No comparte
// módulo con js/theme.js porque estas páginas no cargan el frontend de la app:
// son HTML suelto con un botón, y meterlas en el grafo de módulos las obligaría
// a arrastrar el núcleo entero para alternar un atributo.
//
// El tema ya quedó aplicado por js/theme-boot.js antes del primer pintado.

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function syncThemeButton() {
  document.getElementById("themeBtn").textContent = currentTheme() === "dark" ? "☀️" : "🌙";
}
document.getElementById("themeBtn").addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("tasking-theme", next); } catch (e) { /* modo privado */ }
  syncThemeButton();
});
syncThemeButton();
