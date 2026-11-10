import { setHTML } from "./core/html.js";
// Panel de administración.
//
// Roles de TasKing, estadísticas y actividad del tablero.
// Solo lo ve quien es admin: el botón que lo abre se muestra según `estado.me`.
//
// Se engancha a sus propios controles al importarse, así que no exporta nada:
// app.js lo importa por su efecto, igual que drag.js.

import { api } from "./core/api.js";
import { avatarHtml, escapeHtml, relativeTime } from "./core/dom.js";
import { estado } from "./core/state.js";
import { actionLabel, loadBoard } from "./board.js";

// ---------- Panel de administración ----------
const adminOverlay = document.getElementById("adminOverlay");
const adminUserList = document.getElementById("adminUserList");
const adminNewEmail = document.getElementById("adminNewEmail");

// Tabs
function switchAdminTab(tab) {
  document.getElementById("adminPanelUsuarios").style.display    = tab === "usuarios"    ? "" : "none";
  document.getElementById("adminPanelActividad").style.display   = tab === "actividad"   ? "" : "none";
  document.getElementById("adminPanelStats").style.display       = tab === "stats"       ? "" : "none";
  document.getElementById("adminPanelSolicitudes").style.display = tab === "solicitudes" ? "" : "none";
  document.getElementById("adminTabUsuarios").classList.toggle("active",    tab === "usuarios");
  document.getElementById("adminTabActividad").classList.toggle("active",   tab === "actividad");
  document.getElementById("adminTabStats").classList.toggle("active",       tab === "stats");
  document.getElementById("adminTabSolicitudes").classList.toggle("active", tab === "solicitudes");
  if (tab === "actividad")   renderActivity();
  if (tab === "stats")       renderStats();
  if (tab === "solicitudes") renderPending();
}
document.getElementById("adminTabUsuarios").addEventListener("click",    () => switchAdminTab("usuarios"));
document.getElementById("adminTabActividad").addEventListener("click",   () => switchAdminTab("actividad"));
document.getElementById("adminTabStats").addEventListener("click",       () => switchAdminTab("stats"));
document.getElementById("adminTabSolicitudes").addEventListener("click", () => switchAdminTab("solicitudes"));

async function renderStats() {
  try {
    const stats = await api("GET", "/api/tareas/admin/stats");
    document.getElementById("statUsers").textContent = stats.users || 0;


    document.getElementById("statBoards").textContent = stats.boards || 0;
    document.getElementById("statCards").textContent = stats.cards || 0;

    // Archivos
    const fileCount = stats.files?.count || 0;
    const totalSize = stats.files?.totalSize || 0;
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    document.getElementById("statFileCount").textContent = fileCount;
    document.getElementById("statFileSize").textContent = sizeInMB + " MB";

    // Top 10 usuarios
    const topList = document.getElementById("topUsersList");
    if (stats.topUsers?.length > 0) {
      setHTML(topList, stats.topUsers.map(u =>
        `<div style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
           <div>
             <div style="font-weight:600;color:var(--text)">${escapeHtml(u.name || u.identity_id)}</div>
             <div style="font-size:10px;color:#999">${u.boards} tableros • ${u.cards} tarjetas • ${u.comments} comentarios</div>
           </div>
           <div style="font-weight:bold;color:#0079bf">${u.activity}</div>
         </div>`
      ).join(""));
    }

    // Mostrar lista de usuarios inactivos si hay
    const section = document.getElementById("inactiveUsersSection");
    const list = document.getElementById("inactiveUsersList");
    if (stats.inactiveUsers?.length > 0) {
      section.style.display = "";
      setHTML(list, stats.inactiveUsers.map(u =>
        `<div style="padding:4px 0;display:flex;justify-content:space-between">
           <span>${escapeHtml(u.identity_id)}</span>
           <span style="color:#999;font-size:10px">${u.name ? escapeHtml(u.name) : '—'}</span>
         </div>`
      ).join(""));
    } else {
      section.style.display = "none";
    }

    document.getElementById("statsTimestamp").textContent = "Actualizado: " + new Date(stats.timestamp).toLocaleString("es");
  } catch (e) {
    document.getElementById("statUsers").textContent = "Error";


    document.getElementById("statBoards").textContent = "Error";
    document.getElementById("statCards").textContent = "Error";
  }
}

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
  switchAdminTab("actividad");
  adminOverlay.classList.add("open");
  await renderAdminList();
}

async function renderAdminList() {
  try {
    const data=await api("GET","/api/tareas/admin/users");
    setHTML(adminUserList,data.users.map(u=>`<label class="tasking-admin-person"><span>${escapeHtml(u.name)} · ${escapeHtml(u.contactEmail)}</span><input type="checkbox" data-person="${escapeHtml(u.identity_id)}" ${u.is_admin?'checked':''} ${u.identity_id===estado.me.identity_id?'disabled':''}> Admin</label>`).join(''));
    adminUserList.querySelectorAll('[data-person]').forEach(input=>input.addEventListener('change',async()=>{await api('POST','/api/tareas/admin/set-admin',{identityId:input.dataset.person,isAdmin:input.checked});await renderAdminList();}));
  } catch { setHTML(adminUserList,'No pudimos cargar las cuentas de TasKing.'); }
}
function renderPending() {}
document.getElementById("adminBtn").addEventListener("click", openAdmin);
document.getElementById("adminCloseBtn").addEventListener("click", () => adminOverlay.classList.remove("open"));

adminOverlay.addEventListener("click", e => { if (e.target === adminOverlay) adminOverlay.classList.remove("open"); });

