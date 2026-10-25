// Módulo del navegador que sirve /import-progress.js: encadena las tandas de carga de una importación. Sin él la pantalla
// sigue funcionando con el botón «Continuar» (cada clic carga una tanda). La CSP sólo admite scripts del mismo origen.
export const IMPORT_PROGRESS_JS = String.raw`(function () {
  "use strict";
  var root = document.querySelector("[data-import-progress]");
  var form = root && root.querySelector("form[data-import-load]");
  if (!root || !form) return;
  var text = root.querySelector("[data-progress-text]");
  var bar = root.querySelector("progress");
  var error = root.querySelector("[data-progress-error]");
  var button = form.querySelector("button");
  var running = false;

  function show(progress) {
    if (text) text.textContent = "Importando " + progress.loaded + " de " + progress.planned;
    if (bar) { bar.max = progress.planned; bar.value = progress.loaded; }
  }

  async function run() {
    if (running) return;
    running = true;
    button.disabled = true;
    error.textContent = "";
    try {
      for (;;) {
        var response = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" }, credentials: "same-origin" });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || "No pudimos continuar la importación.");
        show(result);
        if (result.done) { location.assign(root.getAttribute("data-batch-url")); return; }
      }
    } catch (failure) {
      error.textContent = failure.message + " Podés reintentar: se sigue desde donde quedó.";
      button.disabled = false;
      button.textContent = "Reintentar";
    } finally {
      running = false;
    }
  }

  form.addEventListener("submit", function (event) { event.preventDefault(); run(); });
  run();
})();
`;
