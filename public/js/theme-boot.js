// Aplica el tema ANTES del primer pintado, para evitar el flash claro->oscuro.
//
// Tiene que seguir siendo un script CLASICO y BLOQUEANTE en el <head>: con
// `defer` o `type="module"` corre despues del parseo y el parpadeo vuelve. Por
// eso queda fuera del grafo de modulos ES del resto del frontend (ver ADR-017).
(function () {
  try {
    var t = localStorage.getItem("tasking-theme");
    if (t !== "dark" && t !== "light") {
      t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* localStorage puede fallar en modo privado; usar default claro */ }
})();
