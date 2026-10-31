// Módulo del navegador que sirve /import-progress.js: encadena las tandas de carga de una importación. Sin él la pantalla
// sigue funcionando con el botón «Continuar» (cada clic carga una tanda). Ante un 429 espera el Retry-After y sigue. La CSP sólo
// admite scripts del mismo origen.
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
        if (response.status === 429) {
          // Límite de escrituras por minuto: se espera lo que indique el servidor y se sigue, sin perder lo cargado.
          var wait = Math.min(Math.max(Number(response.headers.get("Retry-After")) || 15, 1), 120);
          if (text) text.textContent = "Pausa de " + wait + " s por el límite de escrituras; se retoma sola.";
          await new Promise(function (resolve) { setTimeout(resolve, wait * 1000); });
          continue;
        }
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
