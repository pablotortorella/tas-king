// Herramientas de la suite: nombre, ruta y estado en un solo lugar. El inicio de la app dibuja una tarjeta por cada una y la
// comprobación de coherencia con el sitio público (scripts/homesuite-coherencia.mjs) las compara con lo que anuncia
// homesuite.info. Compras no figura: no existe todavía y no se nombra en ninguna parte (2026-10-28).
export const HERRAMIENTAS = Object.freeze([
  { id: "tasks", nombre: "Fun TasKing", ruta: "/tareas", resumen: "Tableros para tus tareas y proyectos.", estado: "disponible", acento: "tool-card-tasks" },
  { id: "expenses", nombre: "Cuentas Claras", ruta: "/cuentas-claras", resumen: "Gastos e ingresos claros, con repartos cuando se comparten.", estado: "beta", acento: "tool-card-expenses" },
  { id: "calm", nombre: "Remanso", ruta: "/remanso", resumen: "Pausas de calma, con gong y sonidos de fondo.", estado: "beta", acento: "tool-card-calm" },
]);

// TasKing es un Worker aparte con un despliegue por ambiente; cada ambiente de la app lleva al suyo. La producción sólo se elige
// desde el dominio de producción de la app: cualquier otro host (staging, local) lleva al TasKing de staging.
export const TASKING_URL = Object.freeze({
  production: "https://tas-king.pablotortorella.workers.dev",
  staging: "https://tas-king-staging.pablotortorella.workers.dev",
});
export const PRODUCTION_APP_HOST = "app.homesuite.info";

export function taskingUrl(hostname) {
  return hostname === PRODUCTION_APP_HOST ? TASKING_URL.production : TASKING_URL.staging;
}

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderTools() {
  const cards = HERRAMIENTAS.map((tool) => `<a class="tool-card ${tool.acento}" href="${tool.ruta}"><strong>${escape(tool.nombre)}</strong><span>${escape(tool.resumen)}</span></a>`).join("");
  return `<section class="tools" aria-label="Herramientas">${cards}</section>`;
}
