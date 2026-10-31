// Módulo del navegador que sirve /classify.js: atajos de teclado de «Clasificar rápido». Sin él la pantalla funciona igual
// con los botones. La CSP sólo admite scripts del mismo origen.
//
// Los atajos de una sola tecla se pueden apagar con la casilla «Atajos de teclado» (WCAG 2.1.4); la preferencia se guarda
// en este navegador. Enter solo acepta la sugerida cuando el foco no está en un control (enlace, botón, campo): ahí Enter
// mantiene su significado normal.
export const CLASSIFY_JS = String.raw`(function () {
  "use strict";
  var STORAGE_KEY = "homesuite.classify.shortcuts";
  var toggle = document.querySelector("[data-shortcuts-toggle]");
  var enabled = true;
  try { enabled = window.localStorage.getItem(STORAGE_KEY) !== "off"; } catch (error) { enabled = true; }
  if (toggle) {
    toggle.checked = enabled;
    toggle.addEventListener("change", function () {
      enabled = toggle.checked;
      try { window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch (error) { /* sin almacenamiento: vale para esta pantalla */ }
    });
  }
  var typing = function (node) { return node && /^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName); };
  var interactive = function (node) { return node && /^(INPUT|SELECT|TEXTAREA|A|BUTTON|SUMMARY)$/.test(node.tagName); };
  document.addEventListener("keydown", function (event) {
    if (!enabled || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
    var key = event.key;
    var target = null;
    if (/^[1-9]$/.test(key)) target = document.querySelector('[data-key="' + key + '"]');
    else if (key === "Enter" && !interactive(event.target)) target = document.querySelector("[data-accept]");
    else if (key === "s" || key === "S") target = document.querySelector("[data-skip]");
    else if (key === "u" || key === "U") target = document.querySelector("[data-undo]");
    if (!target) return;
    event.preventDefault();
    target.click();
  });
})();
`;
