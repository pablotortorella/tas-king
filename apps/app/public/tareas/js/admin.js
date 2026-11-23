// Actividad del tablero.
//
// La administración de Tareas (cuentas, estadísticas y roles) vive en la consola de HomeSuite, /consola/tareas
// (consola-administracion-homesuite, D10). Acá queda sólo la actividad del tablero, con un enlace a la consola, para quien
// administra Tareas: el botón que lo abre se muestra según `estado.me.isAdmin`.
//
// Se engancha a sus propios controles al importarse, así que no exporta nada:
// app.js lo importa por su efecto, igual que drag.js.

import { setHTML } from "./core/html.js";
import { api } from "./core/api.js";
import { avatarHtml, escapeHtml, relativeTime } from "./core/dom.js";
import { estado } from "./core/state.js";
import { actionLabel } from "./board.js";

const adminOverlay = document.getElementById("adminOverlay");

async function renderActivity() {
  if (!estado.currentBoardId) return;
  const actList = document.getElementById("adminActivityList");
  const userFilter = document.getElementById("activityUserFilter").value;
  const from = document.getElementById("activityFrom").value;
  const to   = document.getElementById("activityTo").value;

  // Poblar selector de usuarios con miembros del tablero (solo la primera vez)
  const sel = document.getElementById("activityUserFilter");
  if (sel.options.length <= 1) {
    setHTML(sel, '<option value="">Todos los usuarios</option>'
      + estado.members.map(m => `<option value="${escapeHtml(m.identity_id)}">${escapeHtml(m.name || m.identity_id)}</option>`).join(""));
  }

  setHTML(actList, '<div class="activity-empty">Cargando…</div>');
  try {
    const params = new URLSearchParams({ limit: "200" });
    if (userFilter) params.set("user", userFilter);
    if (from) params.set("from", String(new Date(from).getTime()));
    if (to)   params.set("to",   String(new Date(to + "T23:59:59").getTime()));
    const data = await api("GET", "/api/tareas/boards/" + estado.currentBoardId + "/activity?" + params);
    if (!data.activity.length) {
      setHTML(actList, '<div class="activity-empty">Sin actividad en este período.</div>');
      return;
    }
    setHTML(actList, data.activity.map(e => {
      const cardInfo = (e.cardTitle || (e.details && e.details.title))
        ? `<div class="activity-card">📋 ${escapeHtml(e.cardTitle || e.details.title)}</div>` : "";
      return `<div class="activity-entry">
        ${avatarHtml(e.author, 20)}
        <div class="activity-body">
          <span class="activity-who">${escapeHtml(e.author.name)} </span>
          <span class="activity-action">${escapeHtml(actionLabel(e.action, e.details))}</span>
          ${cardInfo}
        </div>
        <time class="activity-time" title="${new Date(e.ts).toLocaleString("es")}">${relativeTime(e.ts)}</time>
      </div>`;
    }).join(""));
  } catch (_) {
    setHTML(actList, '<div class="activity-empty" style="color:var(--danger)">Error al cargar la actividad.</div>');
  }
}

document.getElementById("activityFilterBtn").addEventListener("click", renderActivity);
document.getElementById("activityResetBtn").addEventListener("click", () => {
  document.getElementById("activityUserFilter").value = "";
  document.getElementById("activityFrom").value = "";
  document.getElementById("activityTo").value = "";
  setHTML(document.getElementById("activityUserFilter"), '<option value="">Todos los usuarios</option>');
  renderActivity();
});

async function openAdmin() {
  adminOverlay.classList.add("open");
  await renderActivity();
}
document.getElementById("adminBtn").addEventListener("click", openAdmin);
document.getElementById("adminCloseBtn").addEventListener("click", () => adminOverlay.classList.remove("open"));

adminOverlay.addEventListener("click", e => { if (e.target === adminOverlay) adminOverlay.classList.remove("open"); });

