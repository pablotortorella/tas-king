// Panel de administración.
//
// Lista de acceso, estadísticas, actividad del tablero y solicitudes pendientes.
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
    const stats = await api("GET", "/api/admin/stats");
    document.getElementById("statUsers").textContent = stats.users || 0;
    document.getElementById("statActiveUsers").textContent = stats.activeUsers || 0;
    document.getElementById("statInactiveUsers").textContent = stats.inactiveUsers?.length || 0;
    document.getElementById("statBoards").textContent = stats.boards || 0;
    document.getElementById("statCards").textContent = stats.cards || 0;

    // Archivos
    const fileCount = stats.files?.count || 0;
    const totalSize = stats.files?.totalSize || 0;
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    document.getElementById("statFileCount").textContent = fileCount;
    document.getElementById("statFileSize").textContent = sizeInMB + " MB";

    // Gráfico de actividad de cuentas
    const active = stats.activeUsers || 0;
    const inactive = stats.inactiveUsers?.length || 0;
    const total = active + inactive || 1;
    const activePercent = (active / total) * 100;
    const inactivePercent = (inactive / total) * 100;
    document.getElementById("userActivityBar").innerHTML = `
      <div style="width:${activePercent}%;background:var(--success);transition:all 0.3s"></div>
      <div style="width:${inactivePercent}%;background:#e67e22;transition:all 0.3s"></div>
    `;

    // Top 10 usuarios
    const topList = document.getElementById("topUsersList");
    if (stats.topUsers?.length > 0) {
      topList.innerHTML = stats.topUsers.map(u =>
        `<div style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
           <div>
             <div style="font-weight:600;color:var(--text)">${escapeHtml(u.name || u.email)}</div>
             <div style="font-size:10px;color:#999">${u.boards} tableros • ${u.cards} tarjetas • ${u.comments} comentarios</div>
           </div>
           <div style="font-weight:bold;color:#0079bf">${u.activity}</div>
         </div>`
      ).join("");
    }

    // Mostrar lista de usuarios inactivos si hay
    const section = document.getElementById("inactiveUsersSection");
    const list = document.getElementById("inactiveUsersList");
    if (stats.inactiveUsers?.length > 0) {
      section.style.display = "";
      list.innerHTML = stats.inactiveUsers.map(u =>
        `<div style="padding:4px 0;display:flex;justify-content:space-between">
           <span>${escapeHtml(u.email)}</span>
           <span style="color:#999;font-size:10px">${u.name ? escapeHtml(u.name) : '—'}</span>
         </div>`
      ).join("");
    } else {
      section.style.display = "none";
    }

    document.getElementById("statsTimestamp").textContent = "Actualizado: " + new Date(stats.timestamp).toLocaleString("es");
  } catch (e) {
    document.getElementById("statUsers").textContent = "Error";
    document.getElementById("statActiveUsers").textContent = "Error";
    document.getElementById("statInactiveUsers").textContent = "Error";
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
    sel.innerHTML = '<option value="">Todos los usuarios</option>'
      + estado.members.map(m => `<option value="${escapeHtml(m.email)}">${escapeHtml(m.name || m.email)}</option>`).join("");
  }

  actList.innerHTML = '<div class="activity-empty">Cargando…</div>';
  try {
    const params = new URLSearchParams({ limit: "200" });
    if (userFilter) params.set("user", userFilter);
    if (from) params.set("from", String(new Date(from).getTime()));
    if (to)   params.set("to",   String(new Date(to + "T23:59:59").getTime()));
    const data = await api("GET", "/api/boards/" + estado.currentBoardId + "/activity?" + params);
    if (!data.activity.length) {
      actList.innerHTML = '<div class="activity-empty">Sin actividad en este período.</div>';
      return;
    }
    actList.innerHTML = data.activity.map(e => {
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
    }).join("");
  } catch (_) {
    actList.innerHTML = '<div class="activity-empty" style="color:var(--danger)">Error al cargar la actividad.</div>';
  }
}

document.getElementById("activityFilterBtn").addEventListener("click", renderActivity);
document.getElementById("activityResetBtn").addEventListener("click", () => {
  document.getElementById("activityUserFilter").value = "";
  document.getElementById("activityFrom").value = "";
  document.getElementById("activityTo").value = "";
  document.getElementById("activityUserFilter").innerHTML = '<option value="">Todos los usuarios</option>';
  renderActivity();
});

async function openAdmin() {
  switchAdminTab("actividad");
  adminOverlay.classList.add("open");
  await renderAdminList();
}

async function renderAdminList() {
  adminUserList.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">Cargando…</div>';
  try {
    const data = await api("GET", "/api/admin/users");
    const adminEmails = new Set(data.admins.map(a => a.email));
    if (!data.allowed.length) {
      adminUserList.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">No hay usuarios permitidos aún.</div>';
      return;
    }
    adminUserList.innerHTML = data.allowed.map(u => {
      const isAdm = adminEmails.has(u.email);
      const isSelf = u.email === estado.me.email;
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:13px">${escapeHtml(u.email)}${isAdm ? ' <span title="Admin" style="font-size:11px;background:#ffe082;border-radius:3px;padding:1px 5px">Admin</span>' : ''}</span>
        ${!isSelf ? `<label title="Admin" style="font-size:12px;color:#555;cursor:pointer"><input type="checkbox" data-email="${escapeHtml(u.email)}" data-action="admin" ${isAdm ? "checked" : ""}> Admin</label>` : ""}
        ${!isSelf ? `<button data-email="${escapeHtml(u.email)}" data-action="remove" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:16px" title="Eliminar">✕</button>` : ""}
      </div>`;
    }).join("");

    adminUserList.querySelectorAll("[data-action='remove']").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`¿Eliminar acceso a ${btn.dataset.email}?`)) return;
        await api("DELETE", "/api/admin/allowed/" + encodeURIComponent(btn.dataset.email));
        await renderAdminList();
      });
    });
    adminUserList.querySelectorAll("[data-action='admin']").forEach(chk => {
      chk.addEventListener("change", async () => {
        await api("POST", "/api/admin/set-admin", { email: chk.dataset.email, isAdmin: chk.checked });
        await renderAdminList();
      });
    });
  } catch (e) {
    adminUserList.innerHTML = '<div style="padding:12px;color:#c0392b;font-size:13px">Error al cargar usuarios.</div>';
  }
}

async function renderPending() {
  api("POST", "/api/admin/pending/seen").catch(() => {});
  document.getElementById("adminBadge").style.display = "none";
  const list = document.getElementById("adminPendingList");
  list.innerHTML = '<div style="padding:12px;color:#888;font-size:13px">Cargando…</div>';
  try {
    const data = await api("GET", "/api/admin/pending");
    if (!data.pending.length) {
      list.innerHTML = '<div style="padding:16px;color:#888;font-size:13px;text-align:center">No hay solicitudes pendientes. 🎉</div>';
      return;
    }
    list.innerHTML = data.pending.map(u => `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${escapeHtml(u.name || u.email)}</div>
          <div style="font-size:11px;color:#888">${escapeHtml(u.email)}</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px">${new Date(u.requested_at).toLocaleString("es")}</div>
        </div>
        <button data-email="${escapeHtml(u.email)}" data-action="approve" class="btn btn-primary btn-small">Aprobar</button>
        <button data-email="${escapeHtml(u.email)}" data-action="deny" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:18px;padding:2px 6px" title="Rechazar">✕</button>
      </div>
    `).join("");
    list.querySelectorAll("[data-action='approve']").forEach(btn => {
      btn.addEventListener("click", async () => {
        await api("POST", `/api/admin/pending/${encodeURIComponent(btn.dataset.email)}/approve`);
        await renderPending();
        await renderAdminList();
      });
    });
    list.querySelectorAll("[data-action='deny']").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm(`¿Rechazar solicitud de ${btn.dataset.email}?`)) return;
        await api("DELETE", `/api/admin/pending/${encodeURIComponent(btn.dataset.email)}`);
        await renderPending();
      });
    });
  } catch (e) {
    list.innerHTML = '<div style="padding:12px;color:#c0392b;font-size:13px">Error al cargar solicitudes.</div>';
  }
}

document.getElementById("adminBtn").addEventListener("click", openAdmin);
document.getElementById("adminCloseBtn").addEventListener("click", () => adminOverlay.classList.remove("open"));

adminOverlay.addEventListener("click", e => { if (e.target === adminOverlay) adminOverlay.classList.remove("open"); });

document.getElementById("adminAddBtn").addEventListener("click", async () => {
  const email = adminNewEmail.value.trim().toLowerCase();
  if (!email) return;
  try {
    await api("POST", "/api/admin/allowed", { email });
    adminNewEmail.value = "";
    await renderAdminList();
  } catch (e) {
    alert(e.message || "Error al agregar usuario.");
  }
});
adminNewEmail.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("adminAddBtn").click(); });
