// Módulo del navegador que sirve /classify.js: atajos de teclado de «Clasificar rápido». Sin él la pantalla funciona igual
// con los botones. La CSP sólo admite scripts del mismo origen.
export const CLASSIFY_JS = String.raw`(function () {
  "use strict";
  var typing = function (node) { return node && /^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName); };
  document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
    var key = event.key;
    var target = null;
    if (/^[1-9]$/.test(key)) target = document.querySelector('[data-key="' + key + '"]');
    else if (key === "Enter" && !(event.target && event.target.tagName === "BUTTON")) target = document.querySelector("[data-accept]");
    else if (key === "s" || key === "S") target = document.querySelector("[data-skip]");
    else if (key === "u" || key === "U") target = document.querySelector("[data-undo]");
    if (!target) return;
    event.preventDefault();
    target.click();
  });
})();
`;
